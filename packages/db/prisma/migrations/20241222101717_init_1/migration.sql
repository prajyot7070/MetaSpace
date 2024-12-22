-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profilePicture" TEXT,
ALTER COLUMN "password" DROP NOT NULL;
