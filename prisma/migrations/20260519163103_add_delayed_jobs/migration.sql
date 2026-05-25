/*
  Warnings:

  - You are about to drop the `DelayedJob` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "DelayedJob" DROP CONSTRAINT "DelayedJob_userId_fkey";

-- DropTable
DROP TABLE "DelayedJob";

-- CreateTable
CREATE TABLE "delayed_jobs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "params" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delayed_jobs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "delayed_jobs" ADD CONSTRAINT "delayed_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
