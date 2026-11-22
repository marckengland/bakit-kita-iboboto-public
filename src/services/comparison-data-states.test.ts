import { beforeEach, expect, it, vi } from "vitest";
import { comparePoliticians } from "./comparison.service";
import prisma from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  default: {
    politician: { count: vi.fn(), findUnique: vi.fn() },
    billAuthor: { count: vi.fn() },
    votingRecord: { count: vi.fn() },
    sALNRecord: { findFirst: vi.fn() },
    sessionAttendance: { count: vi.fn() },
    campaignPromise: { groupBy: vi.fn() },
    position: { findMany: vi.fn() },
    electionResultRecord: { count: vi.fn() },
  },
}));

beforeEach(() => {
  vi.mocked(prisma.politician.count).mockResolvedValue(2);
  vi.mocked(prisma.politician.findUnique).mockImplementation(
    ({ where }) =>
      ({
        id: where.id,
        fullName: `Synthetic Person ${where.id}`,
        photo: null,
        Position: [],
        PartyAffiliation: [],
      }) as never
  );
  vi.mocked(prisma.billAuthor.count).mockResolvedValue(0);
  vi.mocked(prisma.votingRecord.count).mockResolvedValue(0);
  vi.mocked(prisma.sALNRecord.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.sessionAttendance.count).mockResolvedValue(0);
  vi.mocked(prisma.campaignPromise.groupBy).mockResolvedValue([]);
  vi.mocked(prisma.position.findMany).mockResolvedValue([]);
  vi.mocked(prisma.electionResultRecord.count).mockResolvedValue(0);
});

it("does not compare missing attendance or promise records as zero performance", async () => {
  const result = await comparePoliticians(["a", "b"]);
  expect(result.metrics.find((m) => m.name === "Attendance Rate")?.values).toEqual({
    a: null,
    b: null,
  });
  expect(result.metrics.find((m) => m.name === "Promise Fulfillment Rate")?.values).toEqual({
    a: null,
    b: null,
  });
  expect(result.metrics.find((m) => m.name === "Bill Pass Rate")?.values).toEqual({
    a: null,
    b: null,
  });
  expect(result.differences.some((m) => m.metricName === "Attendance Rate")).toBe(false);
});

it("retains genuine zero attendance when sessions are recorded", async () => {
  vi.mocked(prisma.sessionAttendance.count).mockImplementation(
    (args) => Promise.resolve(args?.where?.status ? 0 : 3) as never
  );
  const result = await comparePoliticians(["a", "b"]);
  expect(result.metrics.find((m) => m.name === "Attendance Rate")?.values).toEqual({ a: 0, b: 0 });
});
