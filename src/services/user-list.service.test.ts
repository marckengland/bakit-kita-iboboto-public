/**
 * Unit Tests for User List Service (Bookmarks and Voting Lists)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    politician: {
      findUnique: vi.fn(),
    },
    bookmark: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    votingList: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    votingListItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  validateElectionYear,
  getPositionLevel,
  organizeByLevel,
  addBookmark,
  removeBookmark,
  getBookmarks,
  isBookmarked,
  addToVotingList,
  removeFromVotingList,
  getVotingListByLevel,
  isInVotingList,
  UserListError,
  MIN_ELECTION_YEAR,
  MAX_ELECTION_YEAR,
  VotingListItem,
} from "./user-list.service";

describe("User List Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateElectionYear", () => {
    it("should accept valid election years", () => {
      expect(validateElectionYear(2022)).toBe(true);
      expect(validateElectionYear(2025)).toBe(true);
      expect(validateElectionYear(MIN_ELECTION_YEAR)).toBe(true);
      expect(validateElectionYear(MAX_ELECTION_YEAR)).toBe(true);
    });

    it("should reject years before minimum", () => {
      expect(validateElectionYear(1985)).toBe(false);
      expect(validateElectionYear(1900)).toBe(false);
    });

    it("should reject years after maximum", () => {
      expect(validateElectionYear(2101)).toBe(false);
      expect(validateElectionYear(3000)).toBe(false);
    });

    it("should reject non-integer years", () => {
      expect(validateElectionYear(2022.5)).toBe(false);
      expect(validateElectionYear(NaN)).toBe(false);
    });
  });

  describe("getPositionLevel", () => {
    it("should identify national positions", () => {
      expect(getPositionLevel("President")).toBe("national");
      expect(getPositionLevel("Vice President")).toBe("national");
      expect(getPositionLevel("Senator")).toBe("national");
      expect(getPositionLevel("Congressman")).toBe("national");
      expect(getPositionLevel("Party-List Representative")).toBe("national");
    });

    it("should identify provincial positions", () => {
      expect(getPositionLevel("Governor")).toBe("provincial");
      expect(getPositionLevel("Vice Governor")).toBe("provincial");
      expect(getPositionLevel("Board Member")).toBe("provincial");
    });

    it("should identify city/municipal positions", () => {
      expect(getPositionLevel("Mayor")).toBe("city");
      expect(getPositionLevel("Vice Mayor")).toBe("city");
      expect(getPositionLevel("Councilor")).toBe("city");
    });

    it("should identify barangay positions", () => {
      expect(getPositionLevel("Barangay Captain")).toBe("barangay");
      expect(getPositionLevel("Barangay Kagawad")).toBe("barangay");
    });

    it("should return other for unknown positions", () => {
      expect(getPositionLevel("Unknown Position")).toBe("other");
    });

    it("should be case-insensitive", () => {
      expect(getPositionLevel("PRESIDENT")).toBe("national");
      expect(getPositionLevel("senator")).toBe("national");
      expect(getPositionLevel("GoVeRnOr")).toBe("provincial");
    });
  });

  describe("organizeByLevel", () => {
    it("should organize items by government level", () => {
      const items: VotingListItem[] = [
        {
          id: "1",
          votingListId: "v1",
          politicianId: "p1",
          position: "President",
          addedAt: new Date(),
        },
        {
          id: "2",
          votingListId: "v1",
          politicianId: "p2",
          position: "Senator",
          addedAt: new Date(),
        },
        {
          id: "3",
          votingListId: "v1",
          politicianId: "p3",
          position: "Governor",
          addedAt: new Date(),
        },
        { id: "4", votingListId: "v1", politicianId: "p4", position: "Mayor", addedAt: new Date() },
        {
          id: "5",
          votingListId: "v1",
          politicianId: "p5",
          position: "Barangay Captain",
          addedAt: new Date(),
        },
      ];

      const result = organizeByLevel(items);

      expect(result.national).toHaveLength(2);
      expect(result.provincial).toHaveLength(1);
      expect(result.city).toHaveLength(1);
      expect(result.barangay).toHaveLength(1);
      expect(result.regional).toHaveLength(0);
      expect(result.municipal).toHaveLength(0);
    });

    it("should handle empty list", () => {
      const result = organizeByLevel([]);

      expect(result.national).toHaveLength(0);
      expect(result.provincial).toHaveLength(0);
      expect(result.city).toHaveLength(0);
      expect(result.municipal).toHaveLength(0);
      expect(result.barangay).toHaveLength(0);
    });
  });

  describe("Bookmark Operations", () => {
    describe("addBookmark", () => {
      it("should add bookmark successfully", async () => {
        const mockUser = { id: "user-1" };
        const mockPolitician = { id: "pol-1", fullName: "Test Politician" };
        const mockBookmark = {
          id: "bm-1",
          userId: "user-1",
          politicianId: "pol-1",
          createdAt: new Date(),
          Politician: mockPolitician,
        };

        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.politician.findUnique).mockResolvedValue(mockPolitician as any);
        vi.mocked(prisma.bookmark.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.bookmark.create).mockResolvedValue(mockBookmark as any);

        const result = await addBookmark({
          userId: "user-1",
          politicianId: "pol-1",
        });

        expect(result.id).toBe("bm-1");
        expect(result.userId).toBe("user-1");
        expect(result.politicianId).toBe("pol-1");
      });

      it("should throw error if user not found", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        await expect(addBookmark({ userId: "user-1", politicianId: "pol-1" })).rejects.toThrow(
          UserListError
        );
      });

      it("should throw error if politician not found", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
        vi.mocked(prisma.politician.findUnique).mockResolvedValue(null);

        await expect(addBookmark({ userId: "user-1", politicianId: "pol-1" })).rejects.toThrow(
          UserListError
        );
      });

      it("should throw error if already bookmarked", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
        vi.mocked(prisma.politician.findUnique).mockResolvedValue({ id: "pol-1" } as any);
        vi.mocked(prisma.bookmark.findUnique).mockResolvedValue({ id: "existing" } as any);

        await expect(addBookmark({ userId: "user-1", politicianId: "pol-1" })).rejects.toThrow(
          "Already bookmarked"
        );
      });
    });

    describe("removeBookmark", () => {
      it("should remove bookmark successfully", async () => {
        vi.mocked(prisma.bookmark.findUnique).mockResolvedValue({ id: "bm-1" } as any);
        vi.mocked(prisma.bookmark.delete).mockResolvedValue({} as any);

        const result = await removeBookmark({
          userId: "user-1",
          politicianId: "pol-1",
        });

        expect(result).toBe(true);
      });

      it("should throw error if bookmark not found", async () => {
        vi.mocked(prisma.bookmark.findUnique).mockResolvedValue(null);

        await expect(removeBookmark({ userId: "user-1", politicianId: "pol-1" })).rejects.toThrow(
          "Bookmark not found"
        );
      });
    });

    describe("getBookmarks", () => {
      it("should return user bookmarks", async () => {
        const mockBookmarks = [
          {
            id: "bm-1",
            userId: "user-1",
            politicianId: "pol-1",
            createdAt: new Date(),
            Politician: {
              id: "pol-1",
              fullName: "Test Politician",
              photo: null,
              Position: [{ title: "Senator", level: "national" }],
            },
          },
        ];

        vi.mocked(prisma.bookmark.findMany).mockResolvedValue(mockBookmarks as never);

        const result = await getBookmarks("user-1");

        expect(result).toHaveLength(1);
        expect(result[0]!.politician?.fullName).toBe("Test Politician");
        expect(result[0]!.politician?.currentPosition).toBe("Senator");
      });
    });

    describe("isBookmarked", () => {
      it("should return true if bookmarked", async () => {
        vi.mocked(prisma.bookmark.findUnique).mockResolvedValue({ id: "bm-1" } as any);

        const result = await isBookmarked("user-1", "pol-1");

        expect(result).toBe(true);
      });

      it("should return false if not bookmarked", async () => {
        vi.mocked(prisma.bookmark.findUnique).mockResolvedValue(null);

        const result = await isBookmarked("user-1", "pol-1");

        expect(result).toBe(false);
      });
    });
  });

  describe("Voting List Operations", () => {
    describe("addToVotingList", () => {
      it("should add politician to voting list", async () => {
        const mockPolitician = { id: "pol-1", fullName: "Test Politician" };
        const mockVotingList = {
          id: "vl-1",
          userId: "user-1",
          electionYear: 2025,
          VotingListItem: [],
        };
        const mockItem = {
          id: "item-1",
          votingListId: "vl-1",
          politicianId: "pol-1",
          position: "Senator",
          addedAt: new Date(),
          Politician: mockPolitician,
        };

        vi.mocked(prisma.politician.findUnique).mockResolvedValue(mockPolitician as any);
        vi.mocked(prisma.votingList.findUnique).mockResolvedValue(mockVotingList as any);
        vi.mocked(prisma.votingListItem.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.votingListItem.create).mockResolvedValue(mockItem as any);

        const result = await addToVotingList({
          userId: "user-1",
          electionYear: 2025,
          politicianId: "pol-1",
          position: "Senator",
        });

        expect(result.id).toBe("item-1");
        expect(result.position).toBe("Senator");
      });

      it("should throw error for invalid election year", async () => {
        await expect(
          addToVotingList({
            userId: "user-1",
            electionYear: 1900,
            politicianId: "pol-1",
            position: "Senator",
          })
        ).rejects.toThrow("Invalid election year");
      });

      it("should throw error if politician not found", async () => {
        vi.mocked(prisma.politician.findUnique).mockResolvedValue(null);

        await expect(
          addToVotingList({
            userId: "user-1",
            electionYear: 2025,
            politicianId: "pol-1",
            position: "Senator",
          })
        ).rejects.toThrow("Politician not found");
      });

      it("should throw error if already in list", async () => {
        vi.mocked(prisma.politician.findUnique).mockResolvedValue({ id: "pol-1" } as any);
        vi.mocked(prisma.votingList.findUnique).mockResolvedValue({
          id: "vl-1",
          VotingListItem: [],
        } as any);
        vi.mocked(prisma.votingListItem.findUnique).mockResolvedValue({ id: "existing" } as any);

        await expect(
          addToVotingList({
            userId: "user-1",
            electionYear: 2025,
            politicianId: "pol-1",
            position: "Senator",
          })
        ).rejects.toThrow("Already in voting list");
      });
    });

    describe("removeFromVotingList", () => {
      it("should remove politician from voting list", async () => {
        vi.mocked(prisma.votingList.findUnique).mockResolvedValue({ id: "vl-1" } as any);
        vi.mocked(prisma.votingListItem.findUnique).mockResolvedValue({ id: "item-1" } as any);
        vi.mocked(prisma.votingListItem.delete).mockResolvedValue({} as any);

        const result = await removeFromVotingList({
          userId: "user-1",
          electionYear: 2025,
          politicianId: "pol-1",
        });

        expect(result).toBe(true);
      });

      it("should throw error if not in list", async () => {
        vi.mocked(prisma.votingList.findUnique).mockResolvedValue({ id: "vl-1" } as any);
        vi.mocked(prisma.votingListItem.findUnique).mockResolvedValue(null);

        await expect(
          removeFromVotingList({
            userId: "user-1",
            electionYear: 2025,
            politicianId: "pol-1",
          })
        ).rejects.toThrow("Not in voting list");
      });
    });

    describe("getVotingListByLevel", () => {
      it("should return voting list organized by level", async () => {
        const mockVotingList = {
          id: "vl-1",
          userId: "user-1",
          electionYear: 2025,
          VotingListItem: [
            {
              id: "1",
              votingListId: "vl-1",
              politicianId: "p1",
              position: "President",
              addedAt: new Date(),
            },
            {
              id: "2",
              votingListId: "vl-1",
              politicianId: "p2",
              position: "Governor",
              addedAt: new Date(),
            },
          ],
        };

        vi.mocked(prisma.votingList.findUnique).mockResolvedValue(mockVotingList as any);

        const result = await getVotingListByLevel("user-1", 2025);

        expect(result.national).toHaveLength(1);
        expect(result.provincial).toHaveLength(1);
      });
    });

    describe("isInVotingList", () => {
      it("should return true if in voting list", async () => {
        vi.mocked(prisma.votingList.findUnique).mockResolvedValue({ id: "vl-1" } as any);
        vi.mocked(prisma.votingListItem.findUnique).mockResolvedValue({ id: "item-1" } as any);

        const result = await isInVotingList("user-1", 2025, "pol-1");

        expect(result).toBe(true);
      });

      it("should return false if voting list does not exist", async () => {
        vi.mocked(prisma.votingList.findUnique).mockResolvedValue(null);

        const result = await isInVotingList("user-1", 2025, "pol-1");

        expect(result).toBe(false);
      });

      it("should return false if not in voting list", async () => {
        vi.mocked(prisma.votingList.findUnique).mockResolvedValue({ id: "vl-1" } as any);
        vi.mocked(prisma.votingListItem.findUnique).mockResolvedValue(null);

        const result = await isInVotingList("user-1", 2025, "pol-1");

        expect(result).toBe(false);
      });
    });
  });
});
