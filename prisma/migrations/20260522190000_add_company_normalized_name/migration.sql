-- AlterTable
ALTER TABLE "Company" ADD COLUMN "normalizedName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_normalizedName_key" ON "Company"("normalizedName");
