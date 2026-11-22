import {
  PublicResearchUnavailableError,
  getPublicResearchBatch,
} from "@/services/public-research.service";
import { unavailableResearch, withheldResearch } from "@/lib/case-review";
export const dynamic = "force-dynamic";
/**
 * Politician Profile Page
 *
 * Displays detailed information about a politician including personal info,
 * position history, red flags, bills, voting records, attendance, SALN, campaign finance,
 * election history, controversies, and family network.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7,
 *               5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5,
 *               8.1, 8.2, 8.3, 8.4, 8.5, 12.6, 12.7, 12.8, 15.1, 15.2, 15.3, 15.6, 18.5,
 *               21.1, 21.2, 21.3, 21.4, 21.5, 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7,
 *               29.1, 29.2, 29.3, 46.1, 46.2, 46.3
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { GovernmentLevel } from "@prisma/client";
import { getPolitician } from "@/services/politician.service";
import { getRedFlags } from "@/services/red-flag.service";
import { getBills, getVotingRecords, getAttendanceStats } from "@/services/legislative.service";
import { getSALNHistory, getNetWorthTimeline } from "@/services/saln.service";
import { getCampaignFinanceHistory } from "@/services/campaign-finance.service";
import { getElectionHistory } from "@/services/election.service";
import { getTermLimitStatus } from "@/services/term-limit.service";
import { detectConflictsOfInterest } from "@/services/conflict-of-interest.service";
import { getFamilyNetwork } from "@/services/family-network.service";
import { getProjectsByPosition, getBudgetImplementationSummary } from "@/services/project.service";
import {
  getPromisesByPolitician,
  getFulfillmentRate,
  getPromiseSummaryByCategory,
} from "@/services/promise-tracker.service";
import prisma from "@/lib/prisma";
import { ProfileHeader } from "./components/ProfileHeader";
import { PersonalInfoSection } from "./components/PersonalInfoSection";
import { PositionHistoryTimeline } from "./components/PositionHistoryTimeline";
import { RedFlagsSection } from "./components/RedFlagsSection";
import { ProfileSkeleton } from "./components/ProfileSkeleton";
import { BillsSection } from "./components/BillsSection";
import { VotingRecordSection } from "./components/VotingRecordSection";
import { AttendanceSection } from "./components/AttendanceSection";
import { SALNSection } from "./components/SALNSection";
import { CampaignFinanceSection } from "./components/CampaignFinanceSection";
import { ElectionHistorySection } from "./components/ElectionHistorySection";
import { ControversiesSection } from "./components/ControversiesSection";
import { FamilyNetworkSection } from "./components/FamilyNetworkSection";
import { ProjectsSection } from "./components/ProjectsSection";
import { PromiseTrackerSection } from "./components/PromiseTrackerSection";
import { EducationSection } from "./components/EducationSection";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const politician = await getPolitician(id).catch((error: unknown) => {
    if (error instanceof PublicResearchUnavailableError) {
      return error;
    }
    throw error;
  });
  if (politician instanceof PublicResearchUnavailableError) {
    return { title: "Profile temporarily unavailable" };
  }

  if (!politician) {
    return {
      title: "Politician Not Found",
    };
  }

  return {
    title: `${politician.fullName} - Politician Profile`,
    description: politician.reviewedBatch
      ? `${politician.fullName} was listed in the opening roster of the ${politician.reviewedBatch.congress}th Congress. View selected Senate filings and their sources.`
      : `View the profile of ${politician.fullName}${politician.currentPosition ? `, ${politician.currentPosition.title}` : ""}. See their position history, party affiliations, and more.`,
  };
}

function researchUnavailable() {
  return (
    <p className="card" role="status">
      Reviewed research is temporarily unavailable. Please try again later.
    </p>
  );
}

function loadPublicResearch(id: string) {
  return getPublicResearchBatch([id])
    .then((batch) => batch.get(id) ?? withheldResearch())
    .catch(() => unavailableResearch());
}

async function PoliticianProfileContent({ id }: { id: string }) {
  const politician = await getPolitician(id).catch((error: unknown) => {
    if (error instanceof PublicResearchUnavailableError) {
      return error;
    }
    throw error;
  });
  if (politician instanceof PublicResearchUnavailableError) {
    return researchUnavailable();
  }
  if (!politician) {
    notFound();
  }

  const { reviewedBatch } = politician;
  if (reviewedBatch) {
    const [bills, research] = await Promise.all([
      getBills(id, {}, undefined, { page: 1, pageSize: 10 }),
      loadPublicResearch(id),
    ]);

    return (
      <div className="space-y-8">
        <ProfileHeader
          politician={politician}
          redFlagCount={politician.redFlagCount}
          researchAvailability={research.availability}
        />
        <BillsSection
          politicianId={id}
          initialBills={bills.items}
          totalCount={bills.totalCount}
          reviewedBatch={reviewedBatch}
        />
        <section className="card space-y-3" aria-labelledby="reviewed-coverage">
          <h2 id="reviewed-coverage" className="text-xl font-semibold">
            Profile Coverage
          </h2>
          <a href="/data/senate-20-refresh-2026-11-22/INDEX.md" className="underline">
            November 22 evidence refresh
          </a>
          <p>
            Qualified elected-term dates and dated history are described in the separate refresh.
            Current office, actual tenure, party affiliation, biographical details, family
            relationships, financial disclosures, elections, attendance and votes remain unverified
            in this dataset.
          </p>
          <a
            className="text-primary-600 dark:text-primary-400 inline-block underline"
            href={reviewedBatch.datasetUrl}
          >
            Original dataset and review notes
          </a>
        </section>
        <ControversiesSection politicianId={id} initialResearch={research} showConflicts={false} />
      </div>
    );
  }

  const data = await Promise.all([
    getRedFlags(id),
    getSALNHistory(id),
    getNetWorthTimeline(id),
    getCampaignFinanceHistory(id),
    getElectionHistory(id),
    getTermLimitStatus(id),
    detectConflictsOfInterest(id).catch(() => null),
    getFamilyNetwork(id).catch(() => null),
    getProjectsByPosition(id).catch(() => []),
    getBudgetImplementationSummary(id).catch(() => null),
    getPromisesByPolitician(id).catch(() => ({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    })),
    getFulfillmentRate(id).catch(() => null),
    getPromiseSummaryByCategory(id).catch(() => []),
    loadPublicResearch(id),
    prisma.education
      .findMany({
        where: { politicianId: id },
        orderBy: { yearEnd: "desc" },
      })
      .catch(() => []),
  ]).catch((error: unknown) => {
    if (error instanceof PublicResearchUnavailableError) {
      return null;
    }
    throw error;
  });
  if (!data) {
    return researchUnavailable();
  }
  const [
    redFlags,
    salnRecords,
    salnTimeline,
    campaignFinanceRecords,
    electionHistory,
    termLimitStatus,
    conflictsData,
    familyNetwork,
    projectsData,
    projectsSummary,
    promisesData,
    fulfillmentRate,
    categorySummary,
    controversiesData,
    educationData,
  ] = data;

  // Check if politician is a legislator (national level) to show legislative sections
  const isLegislator =
    politician.currentPosition?.level === GovernmentLevel.national ||
    politician.positions.some((p) => p.level === GovernmentLevel.national);

  // Fetch legislative data if applicable
  let billsData = null;
  let votingRecordsData = null;
  let attendanceStats = null;

  if (isLegislator) {
    [billsData, votingRecordsData, attendanceStats] = await Promise.all([
      getBills(id, {}, undefined, { page: 1, pageSize: 10 }),
      getVotingRecords(id, { page: 1, pageSize: 10 }),
      getAttendanceStats(id),
    ]);
  }

  return (
    <div className="space-y-8">
      {/* Profile Header - Requirement 2.1 */}
      <ProfileHeader
        politician={politician}
        redFlagCount={redFlags.length}
        researchAvailability={controversiesData.availability}
      />

      {/* Personal Information - Requirement 2.1 */}
      <PersonalInfoSection politician={politician} />

      {/* Education */}
      <EducationSection education={educationData} />

      {/* Position History Timeline - Requirements 2.2, 2.3 */}
      <PositionHistoryTimeline positions={politician.positions} />

      {/* Legislative Sections - Only for legislators */}
      {isLegislator && (
        <>
          {/* Bills Section - Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 */}
          <BillsSection
            politicianId={id}
            initialBills={billsData?.items || []}
            totalCount={billsData?.totalCount || 0}
          />

          {/* Voting Record Section - Requirements 5.1, 5.2 */}
          <VotingRecordSection
            politicianId={id}
            initialRecords={votingRecordsData?.items || []}
            totalCount={votingRecordsData?.totalCount || 0}
          />

          {/* Attendance Section - Requirements 5.3, 5.4, 5.5 */}
          <AttendanceSection politicianId={id} initialStats={attendanceStats} />
        </>
      )}

      {/* SALN Section - Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 15.1, 15.2, 15.3, 15.6 */}
      <SALNSection politicianId={id} initialRecords={salnRecords} initialTimeline={salnTimeline} />

      {/* Campaign Finance Section - Requirements 21.1, 21.2, 21.3, 21.4, 21.5 */}
      <CampaignFinanceSection politicianId={id} initialRecords={campaignFinanceRecords} />

      {/* Election History Section - Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 46.1, 46.2, 46.3 */}
      <ElectionHistorySection
        politicianId={id}
        initialElections={electionHistory}
        initialTermLimitStatus={termLimitStatus}
      />

      {/* Projects Section - Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 22.1, 22.2, 22.3, 22.4, 22.5 */}
      <ProjectsSection
        politicianId={id}
        initialProjects={projectsData}
        initialSummary={projectsSummary}
      />

      {/* Promise Tracker Section - Requirements 23.1, 23.2, 23.3, 23.4, 23.5 */}
      <PromiseTrackerSection
        politicianId={id}
        initialPromises={promisesData.items}
        initialFulfillmentRate={fulfillmentRate}
        initialCategorySummary={categorySummary}
      />

      {/* Family Network Section - Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7 */}
      <FamilyNetworkSection politicianId={id} initialNetwork={familyNetwork} />

      {/* Controversies Section - Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 29.1, 29.2, 29.3 */}
      <ControversiesSection
        politicianId={id}
        initialResearch={controversiesData}
        initialConflicts={conflictsData}
      />

      {/* Red Flags Section - Requirement 18.5 */}
      {redFlags.length > 0 && (
        <RedFlagsSection
          redFlags={redFlags}
          researchAvailability={controversiesData.availability}
        />
      )}
    </div>
  );
}

export default async function PoliticianProfilePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header backLink={{ href: "/politicians", label: "Back to Directory" }} />

      {/* Main Content */}
      <main className="container-wide py-8">
        <Suspense fallback={<ProfileSkeleton />}>
          <PoliticianProfileContent id={id} />
        </Suspense>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
