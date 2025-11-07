-- AlterTable
ALTER TABLE "documents" ADD COLUMN "is_starred" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "last_accessed" TIMESTAMPTZ;
ALTER TABLE "documents" ADD COLUMN "shared_with" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateIndex
CREATE INDEX "documents_is_starred_idx" ON "documents"("is_starred");
CREATE INDEX "documents_last_accessed_idx" ON "documents"("last_accessed");
