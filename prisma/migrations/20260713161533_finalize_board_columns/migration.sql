-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "storyPoints" INTEGER,
    "remainingEffort" REAL,
    "statusColumnId" TEXT NOT NULL,
    "epicId" TEXT,
    "sprintId" TEXT,
    "backlogPosition" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Story_statusColumnId_fkey" FOREIGN KEY ("statusColumnId") REFERENCES "BoardColumn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Story_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Story_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Story" ("id", "title", "description", "acceptanceCriteria", "storyPoints", "remainingEffort", "statusColumnId", "epicId", "sprintId", "backlogPosition", "createdAt", "updatedAt")
SELECT "id", "title", "description", "acceptanceCriteria", "storyPoints", "remainingEffort", "statusColumnId", "epicId", "sprintId", "backlogPosition", "createdAt", "updatedAt" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";

CREATE TABLE "new_Bug" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "remainingEffort" REAL,
    "statusColumnId" TEXT NOT NULL,
    "sprintId" TEXT,
    "backlogPosition" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bug_statusColumnId_fkey" FOREIGN KEY ("statusColumnId") REFERENCES "BoardColumn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bug_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bug" ("id", "title", "description", "severity", "remainingEffort", "statusColumnId", "sprintId", "backlogPosition", "createdAt", "updatedAt")
SELECT "id", "title", "description", "severity", "remainingEffort", "statusColumnId", "sprintId", "backlogPosition", "createdAt", "updatedAt" FROM "Bug";
DROP TABLE "Bug";
ALTER TABLE "new_Bug" RENAME TO "Bug";
PRAGMA foreign_keys=ON;
