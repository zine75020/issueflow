import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "..", "dev.db"));

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

function getEmbeddingRow(itemType, itemId) {
  return db
    .prepare("SELECT itemId, updatedAt FROM Embedding WHERE itemType = ? AND itemId = ?")
    .get(itemType, itemId);
}

function upsertEmbeddingRow(itemType, itemId, vector) {
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
}

function needsEmbedding(itemType, itemId, updatedAt) {
  const existing = getEmbeddingRow(itemType, itemId);
  if (!existing) return true;
  return new Date(existing.updatedAt) < new Date(updatedAt);
}

async function backfillTable(itemType, rows) {
  let generated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!needsEmbedding(itemType, row.id, row.updatedAt)) {
      skipped += 1;
      continue;
    }

    const text = buildText(itemType, row);
    try {
      const vector = await embedText(text);
      upsertEmbeddingRow(itemType, row.id, vector);
      generated += 1;
      console.log(`  ✓ ${itemType} ${row.id} — "${row.title}"`);
    } catch (error) {
      console.error(`  ✗ ${itemType} ${row.id} — "${row.title}" :`, error.message);
    }
  }

  console.log(`${itemType} : ${generated} embedding(s) généré(s), ${skipped} déjà à jour.`);
}

async function main() {
  const stories = db
    .prepare("SELECT id, title, description, acceptanceCriteria, updatedAt FROM Story")
    .all();
  const bugs = db.prepare("SELECT id, title, description, updatedAt FROM Bug").all();
  const epics = db.prepare("SELECT id, title, description, updatedAt FROM Epic").all();

  console.log(
    `Backfill embeddings : ${stories.length} stories, ${bugs.length} bugs, ${epics.length} epics.`
  );

  await backfillTable("STORY", stories);
  await backfillTable("BUG", bugs);
  await backfillTable("EPIC", epics);

  db.close();
  console.log("Backfill terminé.");
}

main().catch((error) => {
  console.error("Le backfill a échoué :", error);
  db.close();
  process.exit(1);
});
