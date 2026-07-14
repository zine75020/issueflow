import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "..", "dev.db"));

function columnExists(table, column) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  return info.some((c) => c.name === column);
}

const existingColumns = db.prepare("SELECT id, name FROM BoardColumn").all();

let columns;
if (existingColumns.length === 0) {
  const todo = { id: randomUUID(), name: "À faire", order: 0, isLocked: 1 };
  const inProgress = { id: randomUUID(), name: "En cours", order: 1, isLocked: 0 };
  const done = { id: randomUUID(), name: "Terminé", order: 2, isLocked: 1 };

  const insert = db.prepare(
    'INSERT INTO BoardColumn (id, name, "order", isLocked) VALUES (?, ?, ?, ?)'
  );
  for (const col of [todo, inProgress, done]) {
    insert.run(col.id, col.name, col.order, col.isLocked);
  }
  columns = [todo, inProgress, done];
  console.log("Seeded 3 default board columns: À faire, En cours, Terminé.");
} else {
  columns = existingColumns;
  console.log(
    `BoardColumn already seeded (${existingColumns.length} columns found), skipping creation.`
  );
}

// Backfill : uniquement pertinent tant que l'ancienne colonne Story/Bug.status
// (enum) existe encore, avant que la migration qui la supprime ne soit
// appliquée. Sur une base déjà migrée, ce bloc est ignoré silencieusement,
// ce qui rend ce script sûr à ré-exécuter indéfiniment (`prisma db seed`).
const findByName = (name) => columns.find((c) => c.name === name);
const statusMap = {
  TODO: findByName("À faire")?.id,
  IN_PROGRESS: findByName("En cours")?.id,
  DONE: findByName("Terminé")?.id,
};

if (columnExists("Story", "status") && statusMap.TODO) {
  const rows = db
    .prepare("SELECT id, status FROM Story WHERE statusColumnId IS NULL")
    .all();
  const update = db.prepare("UPDATE Story SET statusColumnId = ? WHERE id = ?");
  for (const row of rows) {
    const columnId = statusMap[row.status];
    if (columnId) update.run(columnId, row.id);
  }
  console.log(`Backfilled statusColumnId on ${rows.length} stories.`);
}

if (columnExists("Bug", "status") && statusMap.TODO) {
  const rows = db
    .prepare("SELECT id, status FROM Bug WHERE statusColumnId IS NULL")
    .all();
  const update = db.prepare("UPDATE Bug SET statusColumnId = ? WHERE id = ?");
  for (const row of rows) {
    const columnId = statusMap[row.status];
    if (columnId) update.run(columnId, row.id);
  }
  console.log(`Backfilled statusColumnId on ${rows.length} bugs.`);
}

db.close();
