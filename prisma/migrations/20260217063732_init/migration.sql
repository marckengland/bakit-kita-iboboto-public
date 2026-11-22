-- CreateEnum
CREATE TYPE "GovernmentLevel" AS ENUM ('national', 'regional', 'provincial', 'city', 'municipal', 'barangay');

-- CreateEnum
CREATE TYPE "Chamber" AS ENUM ('senate', 'house');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('pending', 'passed', 'vetoed', 'lapsed', 'withdrawn');

-- CreateEnum
CREATE TYPE "BillAuthorRole" AS ENUM ('principal_author', 'co_author');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('yes', 'no', 'abstain');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent_excused', 'absent_unexcused');

-- CreateEnum
CREATE TYPE "ControversyCategory" AS ENUM ('legal_case', 'corruption', 'ethics_violation', 'other');

-- CreateEnum
CREATE TYPE "ControversyStatus" AS ENUM ('ongoing', 'dismissed', 'convicted', 'acquitted', 'settled');

-- CreateEnum
CREATE TYPE "DonorType" AS ENUM ('individual', 'corporation', 'organization');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('cash', 'in_kind');

-- CreateEnum
CREATE TYPE "ExpenditureCategory" AS ENUM ('advertising', 'rallies', 'materials', 'personnel', 'travel', 'other');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('planned', 'ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "COAFindingSeverity" AS ENUM ('observation', 'deficiency', 'irregularity');

-- CreateEnum
CREATE TYPE "COAFindingStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "PromiseStatus" AS ENUM ('kept', 'partially_kept', 'broken', 'in_progress', 'not_yet_due');

-- CreateEnum
CREATE TYPE "PromiseEvidenceType" AS ENUM ('legislation', 'project', 'policy', 'statement');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('spouse', 'parent', 'child', 'sibling', 'in_law', 'cousin', 'grandparent', 'grandchild');

-- CreateEnum
CREATE TYPE "RedFlagType" AS ENUM ('legal_case', 'corruption', 'dynasty', 'saln_anomaly', 'attendance');

-- CreateEnum
CREATE TYPE "RedFlagSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('official_government', 'court_document', 'comelec_filing', 'legislative_record', 'coa_report', 'third_party_verified', 'ai_extracted');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('national_id', 'passport');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('new_controversy', 'new_bill', 'bill_passed', 'red_flag', 'election_reminder');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('new_info', 'correction', 'controversy');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "ReportEvidenceType" AS ENUM ('document', 'link', 'image');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'admin', 'system', 'ai');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'content_moderator', 'data_reviewer', 'auditor');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'verify', 'reject');

-- CreateEnum
CREATE TYPE "ElectionType" AS ENUM ('national', 'local', 'barangay', 'special');

-- CreateEnum
CREATE TYPE "ElectionResult" AS ENUM ('won', 'lost');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('bug_report', 'feature_suggestion', 'data_correction', 'general_feedback');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "Politician" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "suffix" TEXT,
    "birthday" TIMESTAMP(3),
    "birthplace" TEXT,
    "photo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Politician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" "GovernmentLevel" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "termNumber" INTEGER NOT NULL DEFAULT 1,
    "isConsecutive" BOOLEAN NOT NULL DEFAULT true,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticalParty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "foundedDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliticalParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyAffiliation" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "fullText" TEXT,
    "filingDate" TIMESTAMP(3) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'pending',
    "republicActNumber" TEXT,
    "chamber" "Chamber" NOT NULL,
    "congress" INTEGER NOT NULL,
    "session" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillAuthor" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "role" "BillAuthorRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingRecord" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "vote" "VoteType" NOT NULL,
    "voteDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VotingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "chamber" "Chamber" NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SALNRecord" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalAssets" DECIMAL(20,2) NOT NULL,
    "totalLiabilities" DECIMAL(20,2) NOT NULL,
    "netWorth" DECIMAL(20,2) NOT NULL,
    "declaredSalary" DECIMAL(20,2),
    "anomalyDetected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SALNRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SALNProperty" (
    "id" TEXT NOT NULL,
    "salnRecordId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "assessedValue" DECIMAL(20,2) NOT NULL,
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionMode" TEXT,
    "isRealProperty" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SALNProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SALNInvestment" (
    "id" TEXT NOT NULL,
    "salnRecordId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SALNInvestment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SALNAnomaly" (
    "id" TEXT NOT NULL,
    "salnRecordId" TEXT NOT NULL,
    "yearOverYearChange" DECIMAL(10,4) NOT NULL,
    "expectedMaxChange" DECIMAL(10,4) NOT NULL,
    "anomalyRatio" DECIMAL(10,4) NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SALNAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignFinance" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "electionYear" INTEGER NOT NULL,
    "totalContributions" DECIMAL(20,2) NOT NULL,
    "totalExpenditures" DECIMAL(20,2) NOT NULL,
    "spendingLimit" DECIMAL(20,2) NOT NULL,
    "withinLimit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignFinance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContribution" (
    "id" TEXT NOT NULL,
    "campaignFinanceId" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorType" "DonorType" NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "type" "ContributionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isNotableDonor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignExpenditure" (
    "id" TEXT NOT NULL,
    "campaignFinanceId" TEXT NOT NULL,
    "category" "ExpenditureCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignExpenditure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionResultRecord" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "electionYear" INTEGER NOT NULL,
    "electionType" "ElectionType" NOT NULL,
    "positionSought" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "result" "ElectionResult" NOT NULL,
    "voteCount" INTEGER NOT NULL,
    "totalVotes" INTEGER NOT NULL,
    "votePercentage" DECIMAL(5,2) NOT NULL,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionResultRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionOpponent" (
    "id" TEXT NOT NULL,
    "electionResultRecordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT,
    "voteCount" INTEGER NOT NULL,
    "votePercentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionOpponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Controversy" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ControversyCategory" NOT NULL,
    "status" "ControversyStatus" NOT NULL,
    "filingDate" TIMESTAMP(3),
    "resolutionDate" TIMESTAMP(3),
    "court" TEXT,
    "caseNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Controversy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "budget" DECIMAL(20,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'planned',
    "implementingAgency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "barangay" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COAFinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "finding" TEXT NOT NULL,
    "severity" "COAFindingSeverity" NOT NULL,
    "status" "COAFindingStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "COAFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectOutcome" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignPromise" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "electionYear" INTEGER NOT NULL,
    "promiseText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "PromiseStatus" NOT NULL DEFAULT 'not_yet_due',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignPromise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromiseEvidence" (
    "id" TEXT NOT NULL,
    "campaignPromiseId" TEXT NOT NULL,
    "type" "PromiseEvidenceType" NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromiseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyRelationship" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "relatedPoliticianId" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedFlag" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "type" "RedFlagType" NOT NULL,
    "severity" "RedFlagSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedEntityId" TEXT,
    "relatedEntityType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceAttribution" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "documentDate" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DECIMAL(3,2) NOT NULL,
    "isAIProcessed" BOOLEAN NOT NULL DEFAULT false,
    "originalDocumentId" TEXT,
    "fieldName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "politicianId" TEXT,
    "positionId" TEXT,
    "partyAffiliationId" TEXT,
    "billId" TEXT,
    "votingRecordId" TEXT,
    "sessionAttendanceId" TEXT,
    "salnRecordId" TEXT,
    "electionResultRecordId" TEXT,
    "controversyId" TEXT,
    "campaignFinanceId" TEXT,
    "projectId" TEXT,
    "campaignPromiseId" TEXT,
    "familyRelationshipId" TEXT,
    "redFlagId" TEXT,

    CONSTRAINT "SourceAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" "VerificationMethod",
    "verifiedAt" TIMESTAMP(3),
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "newControversy" BOOLEAN NOT NULL DEFAULT true,
    "newBill" BOOLEAN NOT NULL DEFAULT true,
    "billPassed" BOOLEAN NOT NULL DEFAULT true,
    "redFlag" BOOLEAN NOT NULL DEFAULT true,
    "electionReminder" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "electionYear" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VotingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingListItem" (
    "id" TEXT NOT NULL,
    "votingListId" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "politicianId" TEXT,
    "politicianName" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT,
    "politicianId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportEvidence" (
    "id" TEXT NOT NULL,
    "communityReportId" TEXT NOT NULL,
    "type" "ReportEvidenceType" NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationResult" (
    "id" TEXT NOT NULL,
    "communityReportId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "confidence" DECIMAL(3,2),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainAuditEntry" (
    "id" TEXT NOT NULL,
    "blockNumber" SERIAL NOT NULL,
    "entryHash" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorRole" "AdminRole",
    "action" "AuditAction" NOT NULL,
    "dataType" TEXT NOT NULL,
    "dataId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "aiVerificationResult" JSONB,
    "publicChainId" TEXT,
    "publicTransactionHash" TEXT,
    "publicBlockNumber" INTEGER,
    "anchoredAt" TIMESTAMP(3),

    CONSTRAINT "BlockchainAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminRole" "AdminRole" NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "blockchainEntryHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeJob" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsAdded" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataFreshness" (
    "id" TEXT NOT NULL,
    "dataCategory" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataFreshness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "endpoint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentimentData" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "totalMentions" INTEGER NOT NULL DEFAULT 0,
    "trendingTopics" JSONB,
    "samplePosts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentimentData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactCheck" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "claim" TEXT,
    "verdict" TEXT,
    "articleUrl" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" JSONB,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "userId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Politician_fullName_idx" ON "Politician"("fullName");

-- CreateIndex
CREATE INDEX "Politician_lastName_idx" ON "Politician"("lastName");

-- CreateIndex
CREATE INDEX "Politician_isActive_idx" ON "Politician"("isActive");

-- CreateIndex
CREATE INDEX "Position_politicianId_idx" ON "Position"("politicianId");

-- CreateIndex
CREATE INDEX "Position_level_idx" ON "Position"("level");

-- CreateIndex
CREATE INDEX "Position_isCurrent_idx" ON "Position"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticalParty_name_key" ON "PoliticalParty"("name");

-- CreateIndex
CREATE INDEX "PoliticalParty_name_idx" ON "PoliticalParty"("name");

-- CreateIndex
CREATE INDEX "PartyAffiliation_politicianId_idx" ON "PartyAffiliation"("politicianId");

-- CreateIndex
CREATE INDEX "PartyAffiliation_partyId_idx" ON "PartyAffiliation"("partyId");

-- CreateIndex
CREATE INDEX "PartyAffiliation_isCurrent_idx" ON "PartyAffiliation"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE INDEX "Bill_billNumber_idx" ON "Bill"("billNumber");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_chamber_idx" ON "Bill"("chamber");

-- CreateIndex
CREATE INDEX "Bill_filingDate_idx" ON "Bill"("filingDate");

-- CreateIndex
CREATE INDEX "BillAuthor_billId_idx" ON "BillAuthor"("billId");

-- CreateIndex
CREATE INDEX "BillAuthor_politicianId_idx" ON "BillAuthor"("politicianId");

-- CreateIndex
CREATE UNIQUE INDEX "BillAuthor_billId_politicianId_key" ON "BillAuthor"("billId", "politicianId");

-- CreateIndex
CREATE INDEX "VotingRecord_politicianId_idx" ON "VotingRecord"("politicianId");

-- CreateIndex
CREATE INDEX "VotingRecord_billId_idx" ON "VotingRecord"("billId");

-- CreateIndex
CREATE INDEX "VotingRecord_voteDate_idx" ON "VotingRecord"("voteDate");

-- CreateIndex
CREATE UNIQUE INDEX "VotingRecord_politicianId_billId_key" ON "VotingRecord"("politicianId", "billId");

-- CreateIndex
CREATE INDEX "SessionAttendance_politicianId_idx" ON "SessionAttendance"("politicianId");

-- CreateIndex
CREATE INDEX "SessionAttendance_sessionDate_idx" ON "SessionAttendance"("sessionDate");

-- CreateIndex
CREATE INDEX "SessionAttendance_chamber_idx" ON "SessionAttendance"("chamber");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_politicianId_sessionDate_chamber_key" ON "SessionAttendance"("politicianId", "sessionDate", "chamber");

-- CreateIndex
CREATE INDEX "SALNRecord_politicianId_idx" ON "SALNRecord"("politicianId");

-- CreateIndex
CREATE INDEX "SALNRecord_year_idx" ON "SALNRecord"("year");

-- CreateIndex
CREATE INDEX "SALNRecord_anomalyDetected_idx" ON "SALNRecord"("anomalyDetected");

-- CreateIndex
CREATE UNIQUE INDEX "SALNRecord_politicianId_year_key" ON "SALNRecord"("politicianId", "year");

-- CreateIndex
CREATE INDEX "SALNProperty_salnRecordId_idx" ON "SALNProperty"("salnRecordId");

-- CreateIndex
CREATE INDEX "SALNInvestment_salnRecordId_idx" ON "SALNInvestment"("salnRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "SALNAnomaly_salnRecordId_key" ON "SALNAnomaly"("salnRecordId");

-- CreateIndex
CREATE INDEX "CampaignFinance_politicianId_idx" ON "CampaignFinance"("politicianId");

-- CreateIndex
CREATE INDEX "CampaignFinance_electionYear_idx" ON "CampaignFinance"("electionYear");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignFinance_politicianId_electionYear_key" ON "CampaignFinance"("politicianId", "electionYear");

-- CreateIndex
CREATE INDEX "CampaignContribution_campaignFinanceId_idx" ON "CampaignContribution"("campaignFinanceId");

-- CreateIndex
CREATE INDEX "CampaignContribution_donorType_idx" ON "CampaignContribution"("donorType");

-- CreateIndex
CREATE INDEX "CampaignContribution_isNotableDonor_idx" ON "CampaignContribution"("isNotableDonor");

-- CreateIndex
CREATE INDEX "CampaignExpenditure_campaignFinanceId_idx" ON "CampaignExpenditure"("campaignFinanceId");

-- CreateIndex
CREATE INDEX "CampaignExpenditure_category_idx" ON "CampaignExpenditure"("category");

-- CreateIndex
CREATE INDEX "ElectionResultRecord_politicianId_idx" ON "ElectionResultRecord"("politicianId");

-- CreateIndex
CREATE INDEX "ElectionResultRecord_electionYear_idx" ON "ElectionResultRecord"("electionYear");

-- CreateIndex
CREATE INDEX "ElectionResultRecord_electionType_idx" ON "ElectionResultRecord"("electionType");

-- CreateIndex
CREATE INDEX "ElectionOpponent_electionResultRecordId_idx" ON "ElectionOpponent"("electionResultRecordId");

-- CreateIndex
CREATE INDEX "Controversy_politicianId_idx" ON "Controversy"("politicianId");

-- CreateIndex
CREATE INDEX "Controversy_category_idx" ON "Controversy"("category");

-- CreateIndex
CREATE INDEX "Controversy_status_idx" ON "Controversy"("status");

-- CreateIndex
CREATE INDEX "Project_politicianId_idx" ON "Project"("politicianId");

-- CreateIndex
CREATE INDEX "Project_positionId_idx" ON "Project"("positionId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLocation_projectId_key" ON "ProjectLocation"("projectId");

-- CreateIndex
CREATE INDEX "COAFinding_projectId_idx" ON "COAFinding"("projectId");

-- CreateIndex
CREATE INDEX "COAFinding_severity_idx" ON "COAFinding"("severity");

-- CreateIndex
CREATE INDEX "COAFinding_status_idx" ON "COAFinding"("status");

-- CreateIndex
CREATE INDEX "ProjectOutcome_projectId_idx" ON "ProjectOutcome"("projectId");

-- CreateIndex
CREATE INDEX "CampaignPromise_politicianId_idx" ON "CampaignPromise"("politicianId");

-- CreateIndex
CREATE INDEX "CampaignPromise_electionYear_idx" ON "CampaignPromise"("electionYear");

-- CreateIndex
CREATE INDEX "CampaignPromise_status_idx" ON "CampaignPromise"("status");

-- CreateIndex
CREATE INDEX "PromiseEvidence_campaignPromiseId_idx" ON "PromiseEvidence"("campaignPromiseId");

-- CreateIndex
CREATE INDEX "FamilyRelationship_politicianId_idx" ON "FamilyRelationship"("politicianId");

-- CreateIndex
CREATE INDEX "FamilyRelationship_relatedPoliticianId_idx" ON "FamilyRelationship"("relatedPoliticianId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyRelationship_politicianId_relatedPoliticianId_key" ON "FamilyRelationship"("politicianId", "relatedPoliticianId");

-- CreateIndex
CREATE INDEX "RedFlag_politicianId_idx" ON "RedFlag"("politicianId");

-- CreateIndex
CREATE INDEX "RedFlag_type_idx" ON "RedFlag"("type");

-- CreateIndex
CREATE INDEX "RedFlag_severity_idx" ON "RedFlag"("severity");

-- CreateIndex
CREATE INDEX "SourceAttribution_politicianId_idx" ON "SourceAttribution"("politicianId");

-- CreateIndex
CREATE INDEX "SourceAttribution_sourceType_idx" ON "SourceAttribution"("sourceType");

-- CreateIndex
CREATE INDEX "SourceAttribution_fieldName_idx" ON "SourceAttribution"("fieldName");

-- CreateIndex
CREATE INDEX "User_isVerified_idx" ON "User"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreferences_userId_key" ON "NotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");

-- CreateIndex
CREATE INDEX "Bookmark_politicianId_idx" ON "Bookmark"("politicianId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_politicianId_key" ON "Bookmark"("userId", "politicianId");

-- CreateIndex
CREATE INDEX "VotingList_userId_idx" ON "VotingList"("userId");

-- CreateIndex
CREATE INDEX "VotingList_electionYear_idx" ON "VotingList"("electionYear");

-- CreateIndex
CREATE UNIQUE INDEX "VotingList_userId_electionYear_key" ON "VotingList"("userId", "electionYear");

-- CreateIndex
CREATE INDEX "VotingListItem_votingListId_idx" ON "VotingListItem"("votingListId");

-- CreateIndex
CREATE INDEX "VotingListItem_politicianId_idx" ON "VotingListItem"("politicianId");

-- CreateIndex
CREATE UNIQUE INDEX "VotingListItem_votingListId_politicianId_key" ON "VotingListItem"("votingListId", "politicianId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityReport_submitterId_idx" ON "CommunityReport"("submitterId");

-- CreateIndex
CREATE INDEX "CommunityReport_politicianId_idx" ON "CommunityReport"("politicianId");

-- CreateIndex
CREATE INDEX "CommunityReport_status_idx" ON "CommunityReport"("status");

-- CreateIndex
CREATE INDEX "ReportEvidence_communityReportId_idx" ON "ReportEvidence"("communityReportId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationResult_communityReportId_key" ON "VerificationResult"("communityReportId");

-- CreateIndex
CREATE INDEX "ChatConversation_userId_idx" ON "ChatConversation"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainAuditEntry_blockNumber_key" ON "BlockchainAuditEntry"("blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainAuditEntry_entryHash_key" ON "BlockchainAuditEntry"("entryHash");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_actorId_idx" ON "BlockchainAuditEntry"("actorId");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_actorType_idx" ON "BlockchainAuditEntry"("actorType");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_action_idx" ON "BlockchainAuditEntry"("action");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_dataType_idx" ON "BlockchainAuditEntry"("dataType");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_dataId_idx" ON "BlockchainAuditEntry"("dataId");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_timestamp_idx" ON "BlockchainAuditEntry"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_role_idx" ON "AdminUser"("role");

-- CreateIndex
CREATE INDEX "AdminUser_isActive_idx" ON "AdminUser"("isActive");

-- CreateIndex
CREATE INDEX "AdminAction_adminId_idx" ON "AdminAction"("adminId");

-- CreateIndex
CREATE INDEX "AdminAction_action_idx" ON "AdminAction"("action");

-- CreateIndex
CREATE INDEX "AdminAction_targetType_idx" ON "AdminAction"("targetType");

-- CreateIndex
CREATE INDEX "AdminAction_targetId_idx" ON "AdminAction"("targetId");

-- CreateIndex
CREATE INDEX "AdminAction_requiresApproval_idx" ON "AdminAction"("requiresApproval");

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- CreateIndex
CREATE INDEX "ScrapeJob_source_idx" ON "ScrapeJob"("source");

-- CreateIndex
CREATE INDEX "ScrapeJob_status_idx" ON "ScrapeJob"("status");

-- CreateIndex
CREATE INDEX "ScrapeJob_createdAt_idx" ON "ScrapeJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataFreshness_dataCategory_key" ON "DataFreshness"("dataCategory");

-- CreateIndex
CREATE INDEX "DataFreshness_dataCategory_idx" ON "DataFreshness"("dataCategory");

-- CreateIndex
CREATE INDEX "DataFreshness_lastUpdated_idx" ON "DataFreshness"("lastUpdated");

-- CreateIndex
CREATE INDEX "RateLimitEntry_userId_idx" ON "RateLimitEntry"("userId");

-- CreateIndex
CREATE INDEX "RateLimitEntry_ipAddress_idx" ON "RateLimitEntry"("ipAddress");

-- CreateIndex
CREATE INDEX "RateLimitEntry_endpoint_idx" ON "RateLimitEntry"("endpoint");

-- CreateIndex
CREATE INDEX "RateLimitEntry_windowStart_idx" ON "RateLimitEntry"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitEntry_userId_endpoint_windowStart_key" ON "RateLimitEntry"("userId", "endpoint", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitEntry_ipAddress_endpoint_windowStart_key" ON "RateLimitEntry"("ipAddress", "endpoint", "windowStart");

-- CreateIndex
CREATE INDEX "SentimentData_politicianId_idx" ON "SentimentData"("politicianId");

-- CreateIndex
CREATE INDEX "SentimentData_date_idx" ON "SentimentData"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SentimentData_politicianId_date_key" ON "SentimentData"("politicianId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FactCheck_articleUrl_key" ON "FactCheck"("articleUrl");

-- CreateIndex
CREATE INDEX "FactCheck_politicianId_idx" ON "FactCheck"("politicianId");

-- CreateIndex
CREATE INDEX "FactCheck_organization_idx" ON "FactCheck"("organization");

-- CreateIndex
CREATE INDEX "FactCheck_publishedAt_idx" ON "FactCheck"("publishedAt");

-- CreateIndex
CREATE INDEX "FactCheck_verdict_idx" ON "FactCheck"("verdict");

-- CreateIndex
CREATE INDEX "Feedback_category_idx" ON "Feedback"("category");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyAffiliation" ADD CONSTRAINT "PartyAffiliation_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyAffiliation" ADD CONSTRAINT "PartyAffiliation_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "PoliticalParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillAuthor" ADD CONSTRAINT "BillAuthor_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillAuthor" ADD CONSTRAINT "BillAuthor_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingRecord" ADD CONSTRAINT "VotingRecord_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingRecord" ADD CONSTRAINT "VotingRecord_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SALNRecord" ADD CONSTRAINT "SALNRecord_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SALNProperty" ADD CONSTRAINT "SALNProperty_real_fkey" FOREIGN KEY ("salnRecordId") REFERENCES "SALNRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SALNProperty" ADD CONSTRAINT "SALNProperty_personal_fkey" FOREIGN KEY ("salnRecordId") REFERENCES "SALNRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SALNInvestment" ADD CONSTRAINT "SALNInvestment_salnRecordId_fkey" FOREIGN KEY ("salnRecordId") REFERENCES "SALNRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SALNAnomaly" ADD CONSTRAINT "SALNAnomaly_salnRecordId_fkey" FOREIGN KEY ("salnRecordId") REFERENCES "SALNRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFinance" ADD CONSTRAINT "CampaignFinance_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContribution" ADD CONSTRAINT "CampaignContribution_campaignFinanceId_fkey" FOREIGN KEY ("campaignFinanceId") REFERENCES "CampaignFinance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignExpenditure" ADD CONSTRAINT "CampaignExpenditure_campaignFinanceId_fkey" FOREIGN KEY ("campaignFinanceId") REFERENCES "CampaignFinance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResultRecord" ADD CONSTRAINT "ElectionResultRecord_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionOpponent" ADD CONSTRAINT "ElectionOpponent_electionResultRecordId_fkey" FOREIGN KEY ("electionResultRecordId") REFERENCES "ElectionResultRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Controversy" ADD CONSTRAINT "Controversy_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLocation" ADD CONSTRAINT "ProjectLocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAFinding" ADD CONSTRAINT "COAFinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOutcome" ADD CONSTRAINT "ProjectOutcome_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPromise" ADD CONSTRAINT "CampaignPromise_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseEvidence" ADD CONSTRAINT "PromiseEvidence_campaignPromiseId_fkey" FOREIGN KEY ("campaignPromiseId") REFERENCES "CampaignPromise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyRelationship" ADD CONSTRAINT "FamilyRelationship_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyRelationship" ADD CONSTRAINT "FamilyRelationship_relatedPoliticianId_fkey" FOREIGN KEY ("relatedPoliticianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlag" ADD CONSTRAINT "RedFlag_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_partyAffiliationId_fkey" FOREIGN KEY ("partyAffiliationId") REFERENCES "PartyAffiliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_votingRecordId_fkey" FOREIGN KEY ("votingRecordId") REFERENCES "VotingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_sessionAttendanceId_fkey" FOREIGN KEY ("sessionAttendanceId") REFERENCES "SessionAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_salnRecordId_fkey" FOREIGN KEY ("salnRecordId") REFERENCES "SALNRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_electionResultRecordId_fkey" FOREIGN KEY ("electionResultRecordId") REFERENCES "ElectionResultRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_controversyId_fkey" FOREIGN KEY ("controversyId") REFERENCES "Controversy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_campaignFinanceId_fkey" FOREIGN KEY ("campaignFinanceId") REFERENCES "CampaignFinance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_campaignPromiseId_fkey" FOREIGN KEY ("campaignPromiseId") REFERENCES "CampaignPromise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_familyRelationshipId_fkey" FOREIGN KEY ("familyRelationshipId") REFERENCES "FamilyRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "SourceAttribution_redFlagId_fkey" FOREIGN KEY ("redFlagId") REFERENCES "RedFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingList" ADD CONSTRAINT "VotingList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingListItem" ADD CONSTRAINT "VotingListItem_votingListId_fkey" FOREIGN KEY ("votingListId") REFERENCES "VotingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingListItem" ADD CONSTRAINT "VotingListItem_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEvidence" ADD CONSTRAINT "ReportEvidence_communityReportId_fkey" FOREIGN KEY ("communityReportId") REFERENCES "CommunityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResult" ADD CONSTRAINT "VerificationResult_communityReportId_fkey" FOREIGN KEY ("communityReportId") REFERENCES "CommunityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactCheck" ADD CONSTRAINT "FactCheck_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;
