/*
  Warnings:

  - You are about to drop the `Map` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentSpaceId" TEXT,
ALTER COLUMN "role" SET DEFAULT 'User';

-- DropTable
DROP TABLE "Map";

-- CreateTable
CREATE TABLE "_AccessibleSpaces" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AccessibleSpaces_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AccessibleSpaces_B_index" ON "_AccessibleSpaces"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentSpaceId_fkey" FOREIGN KEY ("currentSpaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AccessibleSpaces" ADD CONSTRAINT "_AccessibleSpaces_A_fkey" FOREIGN KEY ("A") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AccessibleSpaces" ADD CONSTRAINT "_AccessibleSpaces_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
