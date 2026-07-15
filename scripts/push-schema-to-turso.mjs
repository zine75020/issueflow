// Applique les migrations Prisma (prisma/migrations/*/migration.sql) sur la base Turso
// distante. Nécessaire car le CLI Prisma (migrate deploy / db push) ne sait pas encore
// se connecter à un datasource libsql:// sans passer par un adaptateur driver, qui n'est
// utilisable qu'au runtime du client (voir lib/prisma.ts), pas depuis le schema engine
// de la CLI. On applique donc le SQL des migrations directement via @libsql/client, et on
// tient à jour une table _prisma_migrations pour suivre ce qui a déjà été appliqué.
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");

// Les identifiants Turso vivent dans .env.turso (séparé de .env) pour que `npm run dev`
// reste sur dev.db par défaut. On les charge explicitement ici.
config({ path: path.join(__dirname, "..", ".env.turso") });

const url = process.env.DATABASE_URL;
const authToken = process.env.TOKEN_DATABASE;

if (!url || !authToken) {
  console.error(
    "DATABASE_URL et TOKEN_DATABASE doivent être définis (base Turso) pour exécuter ce script."
  );
  process.exit(1);
}

const client = createClient({ url, authToken });

await client.execute(`
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
  );
`);

const applied = await client.execute(
  `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;`
);
const appliedNames = new Set(applied.rows.map((r) => r.migration_name));

const migrationFolders = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let appliedCount = 0;

for (const folder of migrationFolders) {
  if (appliedNames.has(folder)) {
    console.log(`⏭  ${folder} déjà appliquée, ignorée.`);
    continue;
  }

  const sqlPath = path.join(migrationsDir, folder, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  console.log(`→ Application de ${folder}...`);
  await client.executeMultiple(sql);

  await client.execute({
    sql: `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
          VALUES (?, ?, current_timestamp, ?, current_timestamp, 1);`,
    args: [randomUUID(), checksum, folder],
  });

  appliedCount++;
  console.log(`✓ ${folder} appliquée.`);
}

if (appliedCount === 0) {
  console.log("Rien à appliquer : la base Turso est déjà à jour.");
} else {
  console.log(`${appliedCount} migration(s) appliquée(s) sur Turso.`);
}

client.close();
