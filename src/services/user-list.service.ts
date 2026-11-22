/**
 * User List Service - Bookmarks and Voting Lists
 *
 * Handles bookmark management and voting list operations for authenticated users.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 17.1, 17.2, 17.3, 17.5**
 */

import prisma from "@/lib/prisma";

// ============================================
// Types and Interfaces
// ============================================

export interface Bookmark {
  id: string;
  userId: string;
  politicianId: string;
  createdAt: Date;
  politician?: {
    id: string;
    fullName: string;
    photo: string | null;
    currentPosition?: string;
    currentLevel?: string;
  };
}

export interface VotingList {
  id: string;
  userId: string;
  electionYear: number;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: VotingListItem[];
}

export interface VotingListItem {
  id: string;
  votingListId: string;
  politicianId: string;
  position: string;
  addedAt: Date;
  politician?: {
    id: string;
    fullName: string;
    photo: string | null;
  };
}

export interface AddBookmarkRequest {
  userId: string;
  politicianId: string;
}

export interface RemoveBookmarkRequest {
  userId: string;
  politicianId: string;
}

export interface AddToVotingListRequest {
  userId: string;
  electionYear: number;
  politicianId: string;
  position: string;
}

export interface RemoveFromVotingListRequest {
  userId: string;
  electionYear: number;
  politicianId: string;
}

export interface VotingListByLevel {
  national: VotingListItem[];
  regional: VotingListItem[];
  provincial: VotingListItem[];
  city: VotingListItem[];
  municipal: VotingListItem[];
  barangay: VotingListItem[];
}

// ============================================
// Error Classes
// ============================================

export class UserListError extends Error {
  constructor(
    message: string,
    public code:
      | "USER_NOT_FOUND"
      | "POLITICIAN_NOT_FOUND"
      | "ALREADY_BOOKMARKED"
      | "BOOKMARK_NOT_FOUND"
      | "ALREADY_IN_LIST"
      | "NOT_IN_LIST"
      | "INVALID_YEAR"
  ) {
    super(message);
    this.name = "UserListError";
  }
}

// ============================================
// Constants
// ============================================

export const MIN_ELECTION_YEAR = 1986; // Post-EDSA
export const MAX_ELECTION_YEAR = 2100;

export const POSITION_LEVELS: Record<string, string> = {
  president: "national",
  "vice president": "national",
  senator: "national",
  "party-list representative": "national",
  congressman: "national",
  representative: "national",
  governor: "provincial",
  "vice governor": "provincial",
  "board member": "provincial",
  mayor: "city",
  "vice mayor": "city",
  councilor: "city",
  "barangay captain": "barangay",
  "barangay kagawad": "barangay",
};

// ============================================
// Helper Functions
// ============================================

/**
 * Validate election year
 */
export function validateElectionYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_ELECTION_YEAR && year <= MAX_ELECTION_YEAR;
}

/**
 * Get position level from position title
 */
export function getPositionLevel(position: string): string {
  const normalizedPosition = position.toLowerCase().trim();

  for (const [key, level] of Object.entries(POSITION_LEVELS)) {
    if (normalizedPosition.includes(key)) {
      return level;
    }
  }

  return "other";
}

/**
 * Organize voting list items by government level
 */
export function organizeByLevel(items: VotingListItem[]): VotingListByLevel {
  const result: VotingListByLevel = {
    national: [],
    regional: [],
    provincial: [],
    city: [],
    municipal: [],
    barangay: [],
  };

  for (const item of items) {
    const level = getPositionLevel(item.position);
    if (level in result) {
      result[level as keyof VotingListByLevel].push(item);
    } else {
      // Default to municipal for unknown positions
      result.municipal.push(item);
    }
  }

  return result;
}

// ============================================
// Bookmark Operations
// ============================================

/**
 * Add a politician to user's bookmarks
 */
export async function addBookmark(request: AddBookmarkRequest): Promise<Bookmark> {
  const { userId, politicianId } = request;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new UserListError("User not found", "USER_NOT_FOUND");
  }

  // Check if politician exists
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
  });

  if (!politician) {
    throw new UserListError("Politician not found", "POLITICIAN_NOT_FOUND");
  }

  // Check if already bookmarked
  const existing = await prisma.bookmark.findUnique({
    where: {
      userId_politicianId: { userId, politicianId },
    },
  });

  if (existing) {
    throw new UserListError("Already bookmarked", "ALREADY_BOOKMARKED");
  }

  // Create bookmark
  const bookmark = await prisma.bookmark.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      politicianId,
    },
    include: {
      Politician: {
        select: {
          id: true,
          fullName: true,
          photo: true,
        },
      },
    },
  });

  return bookmark;
}

/**
 * Remove a politician from user's bookmarks
 */
export async function removeBookmark(request: RemoveBookmarkRequest): Promise<boolean> {
  const { userId, politicianId } = request;

  const bookmark = await prisma.bookmark.findUnique({
    where: {
      userId_politicianId: { userId, politicianId },
    },
  });

  if (!bookmark) {
    throw new UserListError("Bookmark not found", "BOOKMARK_NOT_FOUND");
  }

  await prisma.bookmark.delete({
    where: {
      userId_politicianId: { userId, politicianId },
    },
  });

  return true;
}

/**
 * Get all bookmarks for a user
 */
export async function getBookmarks(userId: string): Promise<Bookmark[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    include: {
      Politician: {
        select: {
          id: true,
          fullName: true,
          photo: true,
          Position: {
            where: { isCurrent: true },
            select: {
              title: true,
              level: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return bookmarks.map((b) => ({
    ...b,
    politician: b.Politician
      ? {
          id: b.Politician.id,
          fullName: b.Politician.fullName,
          photo: b.Politician.photo,
          currentPosition: b.Politician.Position[0]?.title,
          currentLevel: b.Politician.Position[0]?.level,
        }
      : undefined,
  }));
}

/**
 * Check if a politician is bookmarked by user
 */
export async function isBookmarked(userId: string, politicianId: string): Promise<boolean> {
  const bookmark = await prisma.bookmark.findUnique({
    where: {
      userId_politicianId: { userId, politicianId },
    },
  });

  return bookmark !== null;
}

// ============================================
// Voting List Operations
// ============================================

/**
 * Get or create voting list for a user and election year
 */
export async function getOrCreateVotingList(
  userId: string,
  electionYear: number
): Promise<VotingList> {
  if (!validateElectionYear(electionYear)) {
    throw new UserListError("Invalid election year", "INVALID_YEAR");
  }

  let votingList = await prisma.votingList.findUnique({
    where: {
      userId_electionYear: { userId, electionYear },
    },
    include: {
      VotingListItem: {
        include: {
          Politician: {
            select: {
              id: true,
              fullName: true,
              photo: true,
            },
          },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });

  if (!votingList) {
    votingList = await prisma.votingList.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        electionYear,
        updatedAt: new Date(),
      },
      include: {
        VotingListItem: {
          include: {
            Politician: {
              select: {
                id: true,
                fullName: true,
                photo: true,
              },
            },
          },
        },
      },
    });
  }

  return {
    ...votingList,
    items: votingList.VotingListItem.map((item) => ({
      ...item,
      politician: item.Politician
        ? {
            id: item.Politician.id,
            fullName: item.Politician.fullName,
            photo: item.Politician.photo,
          }
        : undefined,
    })),
  };
}

/**
 * Add a politician to voting list
 */
export async function addToVotingList(request: AddToVotingListRequest): Promise<VotingListItem> {
  const { userId, electionYear, politicianId, position } = request;

  if (!validateElectionYear(electionYear)) {
    throw new UserListError("Invalid election year", "INVALID_YEAR");
  }

  // Check if politician exists
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
  });

  if (!politician) {
    throw new UserListError("Politician not found", "POLITICIAN_NOT_FOUND");
  }

  // Get or create voting list
  const votingList = await getOrCreateVotingList(userId, electionYear);

  // Check if already in list
  const existing = await prisma.votingListItem.findUnique({
    where: {
      votingListId_politicianId: {
        votingListId: votingList.id,
        politicianId,
      },
    },
  });

  if (existing) {
    throw new UserListError("Already in voting list", "ALREADY_IN_LIST");
  }

  // Add to list
  const item = await prisma.votingListItem.create({
    data: {
      id: crypto.randomUUID(),
      votingListId: votingList.id,
      politicianId,
      position,
    },
    include: {
      Politician: {
        select: {
          id: true,
          fullName: true,
          photo: true,
        },
      },
    },
  });

  return item;
}

/**
 * Remove a politician from voting list
 */
export async function removeFromVotingList(request: RemoveFromVotingListRequest): Promise<boolean> {
  const { userId, electionYear, politicianId } = request;

  if (!validateElectionYear(electionYear)) {
    throw new UserListError("Invalid election year", "INVALID_YEAR");
  }

  const votingList = await prisma.votingList.findUnique({
    where: {
      userId_electionYear: { userId, electionYear },
    },
  });

  if (!votingList) {
    throw new UserListError("Not in voting list", "NOT_IN_LIST");
  }

  const item = await prisma.votingListItem.findUnique({
    where: {
      votingListId_politicianId: {
        votingListId: votingList.id,
        politicianId,
      },
    },
  });

  if (!item) {
    throw new UserListError("Not in voting list", "NOT_IN_LIST");
  }

  await prisma.votingListItem.delete({
    where: { id: item.id },
  });

  return true;
}

/**
 * Get voting list organized by position level
 */
export async function getVotingListByLevel(
  userId: string,
  electionYear: number
): Promise<VotingListByLevel> {
  const votingList = await getOrCreateVotingList(userId, electionYear);
  return organizeByLevel(votingList.items);
}

/**
 * Get all voting lists for a user
 */
export async function getAllVotingLists(userId: string): Promise<VotingList[]> {
  const lists = await prisma.votingList.findMany({
    where: { userId },
    include: {
      VotingListItem: {
        include: {
          Politician: {
            select: {
              id: true,
              fullName: true,
              photo: true,
            },
          },
        },
        orderBy: { addedAt: "desc" },
      },
    },
    orderBy: { electionYear: "desc" },
  });

  return lists.map((list) => ({
    ...list,
    items: list.VotingListItem.map((item) => ({
      ...item,
      politician: item.Politician
        ? {
            id: item.Politician.id,
            fullName: item.Politician.fullName,
            photo: item.Politician.photo,
          }
        : undefined,
    })),
  }));
}

/**
 * Check if a politician is in voting list
 */
export async function isInVotingList(
  userId: string,
  electionYear: number,
  politicianId: string
): Promise<boolean> {
  const votingList = await prisma.votingList.findUnique({
    where: {
      userId_electionYear: { userId, electionYear },
    },
  });

  if (!votingList) {
    return false;
  }

  const item = await prisma.votingListItem.findUnique({
    where: {
      votingListId_politicianId: {
        votingListId: votingList.id,
        politicianId,
      },
    },
  });

  return item !== null;
}

/**
 * Get voting list item count
 */
export async function getVotingListCount(userId: string, electionYear: number): Promise<number> {
  const votingList = await prisma.votingList.findUnique({
    where: {
      userId_electionYear: { userId, electionYear },
    },
    include: {
      _count: {
        select: { VotingListItem: true },
      },
    },
  });

  return votingList?._count.VotingListItem ?? 0;
}
