-- AlterTable
ALTER TABLE "public"."documents" ADD COLUMN     "file_size" BIGINT;

-- CreateTable
CREATE TABLE "public"."reports" (
    "report_id" SERIAL NOT NULL,
    "today_upload" INTEGER NOT NULL DEFAULT 0,
    "today_new_user" INTEGER NOT NULL DEFAULT 0,
    "weekly_access" INTEGER NOT NULL DEFAULT 0,
    "total_download" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id")
);
