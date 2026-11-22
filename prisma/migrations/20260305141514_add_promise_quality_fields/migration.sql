-- CreateEnum
CREATE TYPE "PromiseSignificance" AS ENUM ('high', 'medium', 'low', 'trivial');

-- CreateEnum
CREATE TYPE "PromiseAttribution" AS ENUM ('direct_action', 'partial_contribution', 'inherited_program', 'inevitable_trend', 'unverified');

-- AlterTable
ALTER TABLE "CampaignPromise" ADD COLUMN     "analysisNotes" TEXT,
ADD COLUMN     "attribution" "PromiseAttribution",
ADD COLUMN     "inheritedFrom" TEXT,
ADD COLUMN     "significance" "PromiseSignificance";
