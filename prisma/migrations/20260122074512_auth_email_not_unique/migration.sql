/*
  Warnings:

  - You are about to drop the column `accessToken` on the `Auth` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Auth" DROP COLUMN "accessToken";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
