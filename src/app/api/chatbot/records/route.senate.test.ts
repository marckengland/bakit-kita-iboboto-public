import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { buildReleaseImportPlan } from "@/lib/release-import";
import { POST } from "./route";
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
let client = 0;
function request(body: unknown) {
  return new NextRequest("https://example.test/api/chatbot/records", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `203.0.113.${++client}` },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "false");
  const plan = buildReleaseImportPlan();
  vi.mocked(prisma.politician.findMany).mockResolvedValue(
    plan.profiles.map(({ id, fullName }) => ({ id, fullName })) as never
  );
  vi.mocked(prisma.bill.findMany).mockResolvedValue(
    plan.bills.map((bill) => ({
      ...bill,
      BillAuthor: plan.authors.filter((author) => author.billId === bill.id),
    })) as never
  );
});
afterEach(() => vi.unstubAllEnvs());

it("automatically routes a bill number to the approved Senate reader with no-store headers", async () => {
  const response = await POST(request({ message: "SBN-142" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const data = await response.json();
  expect(data.answer.senate.status).toBe("records");
  expect(data.answer.senate.filings[0].billNumber).toBe(142);
  expect(data.answer.records).toEqual([]);
  expect(data).not.toHaveProperty("conversationId");
  expect(prisma.controversy.findMany).not.toHaveBeenCalled();
  expect(prisma.user.create).not.toHaveBeenCalled();
});

it("keeps explicit case reads behind the unchanged public case gate", async () => {
  const data = await (await POST(request({ message: "Zubiri", scope: "cases" }))).json();
  expect(data.answer.status).toBe("withheld");
  expect(data.answer.records).toEqual([]);
  expect(data.answer).not.toHaveProperty("senate");
  expect(prisma.bill.findMany).not.toHaveBeenCalled();
});

it("distinguishes unsupported questions from unavailable storage in explicit Senate scope", async () => {
  const data = await (
    await POST(request({ message: "Who should I vote for?", scope: "senate_filings" }))
  ).json();
  expect(data.answer.senate.status).toBe("outside_coverage");
  expect(data.answer.senate.filings).toEqual([]);
});

it.each([[], null, 5, "all_private_records", {}].map((scope) => ({ scope })))(
  "rejects an invalid record scope %j",
  async ({ scope }) => {
    const response = await POST(request({ message: "SBN-142", scope }));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
);

it("does not carry a Senate identity into automatic case lookup", async () => {
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "true");
  const response = await POST(
    request({
      message: "What cases does Bam Aquino have?",
      politicianId: "01K5ST4HCY5N9130WESWJH9BSZ",
      selectionScope: "senate_filings",
    })
  );
  const data = await response.json();
  expect(data.answer.profile).toBeNull();
  expect(data.answer.records).toEqual([]);
  expect(prisma.politician.findFirst).not.toHaveBeenCalled();
  expect(prisma.controversy.findMany).not.toHaveBeenCalled();
});
