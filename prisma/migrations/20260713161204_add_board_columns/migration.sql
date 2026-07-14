-- CreateTable
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bug" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "remainingEffort" REAL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "statusColumnId" TEXT,
    "sprintId" TEXT,
    "backlogPosition" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bug_statusColumnId_fkey" FOREIGN KEY ("statusColumnId") REFERENCES "BoardColumn" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bug_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bug" ("backlogPosition", "createdAt", "description", "id", "remainingEffort", "severity", "sprintId", "status", "title", "updatedAt") SELECT "backlogPosition", "createdAt", "description", "id", "remainingEffort", "severity", "sprintId", "status", "title", "updatedAt" FROM "Bug";
DROP TABLE "Bug";
ALTER TABLE "new_Bug" RENAME TO "Bug";
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "storyPoints" INTEGER,
    "remainingEffort" REAL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "statusColumnId" TEXT,
    "epicId" TEXT,
    "sprintId" TEXT,
    "backlogPosition" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Story_statusColumnId_fkey" FOREIGN KEY ("statusColumnId") REFERENCES "BoardColumn" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Story_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Story_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Story" ("acceptanceCriteria", "backlogPosition", "createdAt", "description", "epicId", "id", "remainingEffort", "sprintId", "status", "storyPoints", "title", "updatedAt") SELECT "acceptanceCriteria", "backlogPosition", "createdAt", "description", "epicId", "id", "remainingEffort", "sprintId", "status", "storyPoints", "title", "updatedAt" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
