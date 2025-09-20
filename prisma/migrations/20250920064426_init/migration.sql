-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "public"."subjects" (
    "subject_id" SERIAL NOT NULL,
    "subject_name" VARCHAR(100) NOT NULL,
    "subject_code" VARCHAR(20),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("subject_id")
);

-- CreateTable
CREATE TABLE "public"."lecturers" (
    "lecturer_id" SERIAL NOT NULL,
    "lecturer_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "lecturers_pkey" PRIMARY KEY ("lecturer_id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "document_id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "file_url" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(100),
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'pending',
    "uploader_id" INTEGER,
    "subject_id" INTEGER,
    "lecturer_id" INTEGER,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "public"."ratings" (
    "rating_id" SERIAL NOT NULL,
    "score" SMALLINT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "document_id" INTEGER NOT NULL,
    "rated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("rating_id")
);

-- CreateTable
CREATE TABLE "public"."comments" (
    "comment_id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "document_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("comment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subjects_subject_name_key" ON "public"."subjects"("subject_name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_subject_code_key" ON "public"."subjects"("subject_code");

-- CreateIndex
CREATE INDEX "documents_uploader_id_idx" ON "public"."documents"("uploader_id");

-- CreateIndex
CREATE INDEX "documents_subject_id_idx" ON "public"."documents"("subject_id");

-- CreateIndex
CREATE INDEX "documents_lecturer_id_idx" ON "public"."documents"("lecturer_id");

-- CreateIndex
CREATE INDEX "documents_is_deleted_idx" ON "public"."documents"("is_deleted");

-- CreateIndex
CREATE INDEX "ratings_document_id_idx" ON "public"."ratings"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_user_id_document_id_key" ON "public"."ratings"("user_id", "document_id");

-- CreateIndex
CREATE INDEX "comments_document_id_idx" ON "public"."comments"("document_id");

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("subject_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturers"("lecturer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ratings" ADD CONSTRAINT "ratings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;
