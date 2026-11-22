-- DropIndex
DROP INDEX IF EXISTS "Bill_billNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_congress_key" ON "Bill"("billNumber", "congress");
