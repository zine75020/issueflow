import { createClient, type RedisClientType } from "redis";

// Le store Redis provisionné via l'intégration Vercel Marketplace expose une connexion TCP
// classique (REDIS_URL), pas l'API REST attendue par @upstash/redis — d'où le client "redis"
// standard ici plutôt que le SDK Upstash. En serverless, une connexion TCP par invocation
// serait lente et risquerait d'épuiser les connexions simultanées du plan gratuit : on
// réutilise donc un client singleton entre invocations (même pattern que lib/prisma.ts),
// en vérifiant son état avant chaque usage plutôt qu'en le recréant.
const globalForRedis = globalThis as unknown as {
  redisClient: RedisClientType | undefined;
};

function createRedisClient(): RedisClientType {
  const client = createClient({ url: process.env.REDIS_URL });
  client.on("error", (err) => console.error("Redis client error:", err));
  return client;
}

const redisClient = globalForRedis.redisClient ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisClient = redisClient;
}

// Évite que deux invocations concurrentes sur la même instance chaude ne déclenchent
// chacune leur propre connect() (node-redis lève une erreur si connect() est appelé
// pendant qu'une connexion est déjà en cours).
let connectingPromise: Promise<RedisClientType> | null = null;

async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient.isOpen) return redisClient;
  if (!connectingPromise) {
    connectingPromise = redisClient
      .connect()
      .then(() => redisClient)
      .finally(() => {
        connectingPromise = null;
      });
  }
  return connectingPromise;
}

/** IP du visiteur, utilisée comme identifiant pour le rate limiting par IP. Vercel injecte
 * x-forwarded-for sur toutes les requêtes ; x-real-ip en secours, "unknown" sinon (ex. tests
 * locaux sans ces headers — toutes les requêtes sans IP identifiable partagent alors le même
 * compteur, ce qui est acceptable puisque ce cas ne se produit pas en production). */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Sliding window rate limiting via un sorted set Redis : chaque requête autorisée ajoute
 * un membre horodaté (ZADD), les membres sortis de la fenêtre sont purgés avant de compter
 * (ZREMRANGEBYSCORE + ZCARD), le tout dans une transaction (MULTI) pour rester atomique sous
 * charge concurrente. La clé expire automatiquement (PEXPIRE) pour ne jamais accumuler de
 * données mortes en Redis au-delà de la fenêtre.
 */
async function checkSlidingWindow(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number }> {
  const client = await getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;

  const results = await client
    .multi()
    .zRemRangeByScore(key, 0, windowStart)
    .zAdd(key, { score: now, value: member })
    .zCard(key)
    .pExpire(key, windowMs)
    .exec();

  const count = Number(results[2] ?? 0);

  return { success: count <= limit, remaining: Math.max(0, limit - count) };
}

// Protection des coûts de l'API Anthropic : 5 messages/heure par IP (limite volontairement
// stricte, l'agent n'est qu'une démo) + plafond global de 50 messages/jour tous visiteurs
// confondus (protège le budget même en cas d'IPs multiples). Voir CLAUDE.md.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function checkAgentChatIpLimit(ip: string) {
  return checkSlidingWindow(`ratelimit:agent-chat:ip:${ip}`, 5, HOUR_MS);
}

export function checkAgentChatGlobalLimit() {
  return checkSlidingWindow("ratelimit:agent-chat:global", 50, DAY_MS);
}

// Protection du quota gratuit Vercel Blob : 20 uploads/heure par IP, en plus de la limite
// (déjà existante) de 10 pièces jointes par item.
export function checkAttachmentUploadIpLimit(ip: string) {
  return checkSlidingWindow(`ratelimit:attachment-upload:ip:${ip}`, 20, HOUR_MS);
}
