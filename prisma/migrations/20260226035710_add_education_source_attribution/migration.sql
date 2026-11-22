-- AlterTable
ALTER TABLE "SourceAttribution" ADD COLUMN     "educationId" TEXT;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "Education"("id") ON DELETE CASCADE ON UPDATE CASCADE;
