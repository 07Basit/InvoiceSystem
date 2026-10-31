-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "data" BYTEA,
ADD COLUMN     "size" INTEGER NOT NULL DEFAULT 0;
