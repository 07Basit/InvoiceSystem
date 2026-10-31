-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "documents_starred_deletedAt_idx" ON "documents"("starred", "deletedAt");
