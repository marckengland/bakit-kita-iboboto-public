/**
 * Elections API Route
 *
 * Provides data for upcoming elections dashboard.
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7
 */

import { NextRequest, NextResponse } from "next/server";

// Types for upcoming elections
export interface UpcomingElection {
  id: string;
  name: string;
  type: "national" | "local" | "barangay" | "special";
  date: string;
  level: "national" | "regional" | "provincial" | "city" | "municipal" | "barangay";
  jurisdiction?: string;
  deadlines: ElectionDeadline[];
  positions: ElectionPosition[];
}

export interface ElectionDeadline {
  id: string;
  name: string;
  date: string;
  description: string;
  type:
    | "voter_registration"
    | "filing_period_start"
    | "filing_period_end"
    | "campaign_start"
    | "campaign_end"
    | "election_day";
  isPast: boolean;
}

export interface ElectionPosition {
  id: string;
  title: string;
  level: string;
  jurisdiction?: string;
  slots: number;
  candidates: FiledCandidate[];
}

export interface FiledCandidate {
  id: string;
  politicianId: string;
  fullName: string;
  photo: string | null;
  party: string | null;
  position: string;
  filingDate: string;
  runningMate?: {
    id: string;
    fullName: string;
    photo: string | null;
  };
}

// Mock data for upcoming elections - Requirement 26.1
const UPCOMING_ELECTIONS: UpcomingElection[] = [
  {
    id: "2028-national",
    name: "2028 National and Local Elections",
    type: "national",
    date: "2028-05-08",
    level: "national",
    deadlines: [
      {
        id: "d1",
        name: "Voter Registration Deadline",
        date: "2027-09-30",
        description: "Last day to register as a voter for the 2028 elections",
        type: "voter_registration",
        isPast: false,
      },
      {
        id: "d2",
        name: "Certificate of Candidacy Filing Start",
        date: "2027-10-01",
        description: "Start of filing period for certificates of candidacy",
        type: "filing_period_start",
        isPast: false,
      },
      {
        id: "d3",
        name: "Certificate of Candidacy Filing End",
        date: "2027-10-08",
        description: "Last day to file certificate of candidacy",
        type: "filing_period_end",
        isPast: false,
      },
      {
        id: "d4",
        name: "Campaign Period Start",
        date: "2028-02-08",
        description: "Official start of campaign period for national positions",
        type: "campaign_start",
        isPast: false,
      },
      {
        id: "d5",
        name: "Campaign Period End",
        date: "2028-05-06",
        description: "End of campaign period (2 days before election)",
        type: "campaign_end",
        isPast: false,
      },
      {
        id: "d6",
        name: "Election Day",
        date: "2028-05-08",
        description: "National and Local Elections",
        type: "election_day",
        isPast: false,
      },
    ],
    positions: [
      {
        id: "p1",
        title: "President",
        level: "national",
        slots: 1,
        candidates: [],
      },
      {
        id: "p2",
        title: "Vice President",
        level: "national",
        slots: 1,
        candidates: [],
      },
      {
        id: "p3",
        title: "Senator",
        level: "national",
        slots: 12,
        candidates: [],
      },
      {
        id: "p4",
        title: "Party-list Representative",
        level: "national",
        slots: 59,
        candidates: [],
      },
    ],
  },
  {
    id: "2026-brgy",
    name: "2026 Barangay and SK Elections",
    type: "barangay",
    date: "2026-12-05",
    level: "barangay",
    deadlines: [
      {
        id: "d7",
        name: "Voter Registration Deadline",
        date: "2026-08-31",
        description: "Last day to register as a voter for the 2026 Barangay elections",
        type: "voter_registration",
        isPast: false,
      },
      {
        id: "d8",
        name: "Certificate of Candidacy Filing Start",
        date: "2026-09-01",
        description: "Start of filing period for certificates of candidacy",
        type: "filing_period_start",
        isPast: false,
      },
      {
        id: "d9",
        name: "Certificate of Candidacy Filing End",
        date: "2026-09-08",
        description: "Last day to file certificate of candidacy",
        type: "filing_period_end",
        isPast: false,
      },
      {
        id: "d10",
        name: "Campaign Period Start",
        date: "2026-11-20",
        description: "Official start of campaign period for barangay positions",
        type: "campaign_start",
        isPast: false,
      },
      {
        id: "d11",
        name: "Campaign Period End",
        date: "2026-12-03",
        description: "End of campaign period (2 days before election)",
        type: "campaign_end",
        isPast: false,
      },
      {
        id: "d12",
        name: "Election Day",
        date: "2026-12-05",
        description: "Barangay and Sangguniang Kabataan Elections",
        type: "election_day",
        isPast: false,
      },
    ],
    positions: [
      {
        id: "p5",
        title: "Barangay Captain",
        level: "barangay",
        slots: 1,
        candidates: [],
      },
      {
        id: "p6",
        title: "Barangay Kagawad",
        level: "barangay",
        slots: 7,
        candidates: [],
      },
      {
        id: "p7",
        title: "SK Chairman",
        level: "barangay",
        slots: 1,
        candidates: [],
      },
      {
        id: "p8",
        title: "SK Kagawad",
        level: "barangay",
        slots: 7,
        candidates: [],
      },
    ],
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Filter parameters - Requirement 26.4
  const level = searchParams.get("level");
  const type = searchParams.get("type");
  const jurisdiction = searchParams.get("jurisdiction");
  const year = searchParams.get("year");

  let elections = [...UPCOMING_ELECTIONS];

  // Filter by level
  if (level) {
    elections = elections.filter((e) => e.level === level);
  }

  // Filter by type
  if (type) {
    elections = elections.filter((e) => e.type === type);
  }

  // Filter by jurisdiction
  if (jurisdiction) {
    elections = elections.filter(
      (e) =>
        e.jurisdiction?.toLowerCase().includes(jurisdiction.toLowerCase()) ||
        e.positions.some((p) => p.jurisdiction?.toLowerCase().includes(jurisdiction.toLowerCase()))
    );
  }

  // Filter by year
  if (year) {
    elections = elections.filter((e) => e.date.startsWith(year));
  }

  // Calculate days until each election
  const now = new Date();
  const electionsWithDaysUntil = elections.map((election) => {
    const electionDate = new Date(election.date);
    const daysUntil = Math.ceil((electionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...election,
      daysUntil,
      isPast: daysUntil < 0,
    };
  });

  // Sort by date (upcoming first)
  electionsWithDaysUntil.sort((a, b) => {
    if (a.isPast !== b.isPast) {
      return a.isPast ? 1 : -1;
    }
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return NextResponse.json({
    elections: electionsWithDaysUntil,
    total: electionsWithDaysUntil.length,
  });
}
