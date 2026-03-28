-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(12,2),
ADD COLUMN     "phone" TEXT;
