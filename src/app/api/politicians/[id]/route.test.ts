import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

describe("saved profile summaries", () => {
  beforeEach(() => {
    vi.mocked(prisma.politician.findUnique).mockReset();
  });

  async function read(id = "synthetic-a") {
    const { GET } = await import("./route");
    return GET(new NextRequest(`https://example.test/api/politicians/${id}`), {
      params: Promise.resolve({ id }),
    });
  }

  it("returns the public card fields without case or personal records", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "synthetic-a",
      fullName: "Synthetic Candidate A",
      photo: null,
      Position: [{ title: "Mayor", level: "city", jurisdiction: "Fixture City" }],
      Controversy: [{ title: "WITHHELD_SENTINEL" }],
      birthday: new Date("2000-01-01"),
    } as never);
    const response = await read();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      politician: {
        id: "synthetic-a",
        fullName: "Synthetic Candidate A",
        photo: null,
        currentPosition: { title: "Mayor", level: "city", jurisdiction: "Fixture City" },
      },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a missing record separately from a failed lookup", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue(null);
    expect((await read()).status).toBe(404);
    vi.mocked(prisma.politician.findUnique).mockRejectedValue(new Error("Database down"));
    const unavailable = await read();
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: "Profile temporarily unavailable" });
  });
});
