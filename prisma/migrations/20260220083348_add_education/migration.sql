-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('elementary', 'high_school', 'vocational', 'bachelors', 'masters', 'doctorate', 'law', 'medicine', 'other');

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "field" TEXT,
    "level" "EducationLevel" NOT NULL,
    "yearStart" INTEGER,
    "yearEnd" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Education_politicianId_idx" ON "Education"("politicianId");

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;
