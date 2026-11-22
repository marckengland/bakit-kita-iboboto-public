-- Preserve unestablished filing facts and source confidence as NULL.
ALTER TABLE "Bill"
    ALTER COLUMN "filingDate" DROP NOT NULL,
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" DROP NOT NULL,
    ALTER COLUMN "session" DROP NOT NULL;

ALTER TABLE "SourceAttribution"
    ALTER COLUMN "confidence" DROP NOT NULL;

ALTER TYPE "BillAuthorRole" ADD VALUE 'introduced_by';
