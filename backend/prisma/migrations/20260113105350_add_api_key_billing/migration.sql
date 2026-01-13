-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "activeUntil" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastOrderId" TEXT,
ADD COLUMN     "lastPaymentId" TEXT,
ADD COLUMN     "plan" TEXT;
