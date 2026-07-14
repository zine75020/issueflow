-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "vector" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_itemType_itemId_key" ON "Embedding"("itemType", "itemId");
