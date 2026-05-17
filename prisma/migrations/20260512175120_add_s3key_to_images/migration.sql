/*
  Warnings:

  - Added the required column `s3Key` to the `Image` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "s3Key" TEXT NOT NULL;
