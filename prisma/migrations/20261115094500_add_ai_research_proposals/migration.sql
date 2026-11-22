-- Model output and its citations remain together outside public profile tables.
CREATE TABLE "AIResearchProposal" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIResearchProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIResearchProposal_politicianId_idx" ON "AIResearchProposal"("politicianId");
CREATE INDEX "AIResearchProposal_status_createdAt_idx" ON "AIResearchProposal"("status", "createdAt");
ALTER TABLE "AIResearchProposal" ADD CONSTRAINT "AIResearchProposal_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;
