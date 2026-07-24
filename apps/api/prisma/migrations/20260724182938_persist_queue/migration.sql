-- AlterTable
ALTER TABLE "MediaSession" ADD COLUMN     "queue" JSONB NOT NULL DEFAULT '[]';
