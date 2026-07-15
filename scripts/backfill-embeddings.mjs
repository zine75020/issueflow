// Backfill des embeddings (recherche sémantique RAG) pour tous les epics,
// stories et bugs existants. Idempotent : ne régénère un embedding que s'il
// est absent ou plus vieux que la dernière mise à jour de l'item.
//
// Cible : local (dev.db, comportement par défaut, inchangé) ou Turso
// distant, sélectionnée via la variable d'environnement BACKFILL_TARGET ou
// le flag --turso, sur le même principe que prisma/seed-demo.mjs et
// scripts/push-schema-to-turso.mjs. Les identifiants Turso sont lus dans
// .env.turso (jamais dans .env).
//
// Usage :
//   node scripts/backfill-embeddings.mjs                    -> backfill sur dev.db (local)
//   node scripts/backfill-embeddings.mjs --turso             -> backfill sur Turso
//   BACKFILL_TARGET=turso node scripts/backfill-embeddings.mjs -> idem, via variable d'env

import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const target =
  process.argv.includes("--turso") || process.env.BACKFILL_TARGET === "turso"
    ? "turso"
    : "local";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-4-lite";

async function embedText(text) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY est manquante dans l'environnement.");
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: [text], model: VOYAGE_MODEL, input_type: "document" }),
  });

  if (response.status === 429) {
    throw new Error("Quota Voyage AI dépassé (429 Too Many Requests).");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Erreur API Voyage AI (${response.status}) : ${body}`);
  }

  const data = await response.json();
  const vector = data.data?.[0]?.embedding;
  if (!vector) {
    throw new Error("Réponse Voyage AI invalide : aucun vecteur retourné.");
  }
  return vector;
}

function buildText(itemType, row) {
  const parts = [row.title, row.description];
  if (itemType === "STORY" && row.acceptanceCriteria) {
    parts.push(row.acceptanceCriteria);
  }
  return parts.filter((part) => part && part.trim().length > 0).join("\n\n");
}

/** Ouvre dev.db (local) et expose le store d'embeddings sur l'API synchrone better-sqlite3. */
async function createLocalStore() {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(path.join(__dirname, "..", "dev.db"));

  function getEmbeddingRow(itemType, itemId) {
    return db
      .prepare("SELECT itemId, updatedAt FROM Embedding WHERE itemType = ? AND itemId = ?")
      .get(itemType, itemId);
  }

  return {
    async fetchItems() {
      const stories = db
        .prepare("SELECT id, title, description, acceptanceCriteria, updatedAt FROM Story")
        .all();
      const bugs = db.prepare("SELECT id, title, description, updatedAt FROM Bug").all();
      const epics = db.prepare("SELECT id, title, description, updatedAt FROM Epic").all();
      return { stories, bugs, epics };
    },
    async needsEmbedding(itemType, itemId, updatedAt) {
      const existing = getEmbeddingRow(itemType, itemId);
      if (!existing) return true;
      return new Date(existing.updatedAt) < new Date(updatedAt);
    },
    async upsertEmbeddingRow(itemType, itemId, vector) {
      const now = new Date().toISOString();
      const existing = getEmbeddingRow(itemType, itemId);
      if (existing) {
        db.prepare(
          "UPDATE Embedding SET vector = ?, model = ?, updatedAt = ? WHERE itemType = ? AND itemId = ?"
        ).run(JSON.stringify(vector), VOYAGE_MODEL, now, itemType, itemId);
      } else {
        db.prepare(
          "INSERT INTO Embedding (id, itemType, itemId, vector, model, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(randomUUID(), itemType, itemId, JSON.stringify(vector), VOYAGE_MODEL, now);
      }
    },
    close() {
      db.close();
    },
  };
}

/** Se connecte à Turso (identifiants dans .env.turso) et expose le même store, version async/libsql. */
async function createTursoStore() {
  const { config } = await import("dotenv");
  config({ path: path.join(__dirname, "..", ".env.turso") });

  if (!process.env.DATABASE_URL || !process.env.TOKEN_DATABASE) {
    console.error(
      "DATABASE_URL et TOKEN_DATABASE doivent être définis dans .env.turso pour backfiller Turso."
    );
    process.exitCode = 1;
    return null;
  }

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TOKEN_DATABASE,
  });

  async function getEmbeddingRow(itemType, itemId) {
    const res = await client.execute({
      sql: "SELECT itemId, updatedAt FROM Embedding WHERE itemType = ? AND itemId = ?",
      args: [itemType, itemId],
    });
    return res.rows[0] ?? null;
  }

  return {
    async fetchItems() {
      const [storiesRes, bugsRes, epicsRes] = await Promise.all([
        client.execute("SELECT id, title, description, acceptanceCriteria, updatedAt FROM Story;"),
        client.execute("SELECT id, title, description, updatedAt FROM Bug;"),
        client.execute("SELECT id, title, description, updatedAt FROM Epic;"),
      ]);
      return { stories: storiesRes.rows, bugs: bugsRes.rows, epics: epicsRes.rows };
    },
    async needsEmbedding(itemType, itemId, updatedAt) {
      const existing = await getEmbeddingRow(itemType, itemId);
      if (!existing) return true;
      return new Date(existing.updatedAt) < new Date(updatedAt);
    },
    async upsertEmbeddingRow(itemType, itemId, vector) {
      const now = new Date().toISOString();
      const existing = await getEmbeddingRow(itemType, itemId);
      if (existing) {
        await client.execute({
          sql: "UPDATE Embedding SET vector = ?, model = ?, updatedAt = ? WHERE itemType = ? AND itemId = ?",
          args: [JSON.stringify(vector), VOYAGE_MODEL, now, itemType, itemId],
        });
      } else {
        await client.execute({
          sql: "INSERT INTO Embedding (id, itemType, itemId, vector, model, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
          args: [randomUUID(), itemType, itemId, JSON.stringify(vector), VOYAGE_MODEL, now],
        });
      }
    },
    close() {
      client.close();
    },
  };
}

async function backfillTable(itemType, rows, store) {
  let generated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!(await store.needsEmbedding(itemType, row.id, row.updatedAt))) {
      skipped += 1;
      continue;
    }

    const text = buildText(itemType, row);
    try {
      const vector = await embedText(text);
      await store.upsertEmbeddingRow(itemType, row.id, vector);
      generated += 1;
      console.log(`  ✓ ${itemType} ${row.id} — "${row.title}"`);
    } catch (error) {
      console.error(`  ✗ ${itemType} ${row.id} — "${row.title}" :`, error.message);
    }
  }

  console.log(`${itemType} : ${generated} embedding(s) généré(s), ${skipped} déjà à jour.`);
}

async function main() {
  const store = target === "turso" ? await createTursoStore() : await createLocalStore();
  if (!store) return;

  const { stories, bugs, epics } = await store.fetchItems();

  console.log(
    `Backfill embeddings (cible : ${target}) : ${stories.length} stories, ${bugs.length} bugs, ${epics.length} epics.`
  );

  await backfillTable("STORY", stories, store);
  await backfillTable("BUG", bugs, store);
  await backfillTable("EPIC", epics, store);

  store.close();
  console.log("Backfill terminé.");
}

main().catch((error) => {
  console.error("Le backfill a échoué :", error);
  process.exitCode = 1;
});
