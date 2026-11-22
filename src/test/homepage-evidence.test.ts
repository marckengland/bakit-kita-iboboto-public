import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "../i18n/messages/en.json";
import { AccessibilityProvider } from "../app/providers/AccessibilityProvider";
import Home from "../app/page";
import { prisma } from "../lib/prisma";
import * as publicResearch from "../services/public-research.service";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "home.research") =>
    createTranslator({ locale: "en", messages, namespace }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  vi.mocked(prisma.politician.count).mockReset();
  vi.mocked(prisma.politician.findMany).mockReset();
});

async function renderHome() {
  const home = await Home();
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: createElement(AccessibilityProvider, { children: home }),
    })
  );
}

it("does not promise complete or official-source coverage for an empty database", async () => {
  vi.mocked(prisma.politician.count).mockResolvedValue(0);
  vi.mocked(prisma.politician.findMany).mockResolvedValue([]);
  const html = await renderHome();
  expect(html).not.toContain("100%");
  expect(html).toContain("No profiles available yet");
  expect(html).toContain("Data coverage");
});

it("does not present an unavailable database as zero available profiles", async () => {
  vi.mocked(prisma.politician.count).mockRejectedValue(new Error("Synthetic database outage"));
  vi.mocked(prisma.politician.findMany).mockResolvedValue([]);
  const html = await renderHome();
  expect(html).toContain("Profiles are temporarily unavailable");
  expect(html).not.toContain("No profiles available yet");
  expect(html).not.toContain("100%");
});

it("keeps profiles usable while reporting a failed research availability check", async () => {
  vi.mocked(prisma.politician.count).mockResolvedValue(1);
  vi.mocked(prisma.politician.findMany).mockResolvedValue([
    {
      id: "synthetic-a",
      fullName: "Synthetic Candidate A",
      updatedAt: new Date("2026-01-01"),
      Position: [],
    },
  ] as never);
  vi.spyOn(publicResearch, "getPublicResearchBatch").mockRejectedValueOnce(
    new Error("Synthetic research outage")
  );
  const html = await renderHome();
  expect(html).toContain("Synthetic Candidate A");
  expect(html).toContain("Reviewed research is temporarily unavailable");
  expect(html).not.toContain("No profiles available yet");
});

it.each([1, 2])(
  "renders %i active profiles without treating them as popular or verified",
  async (count) => {
    vi.mocked(prisma.politician.count).mockResolvedValue(count);
    vi.mocked(prisma.politician.findMany).mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        id: `synthetic-${i}`,
        fullName: `Synthetic Candidate ${i}`,
        updatedAt: new Date("2026-01-01"),
        Position: [{ title: "Mayor", jurisdiction: "Fixture City" }],
      })) as never
    );
    const html = await renderHome();
    expect(html).toContain("Synthetic Candidate 0");
    if (count === 2) {
      expect(html).toContain("Synthetic Candidate 1");
    }
    expect(html).toContain("2026-01-01");
    expect(html).toContain("not when every record was verified");
    expect(html).not.toContain("Most Watched");
    expect(html).not.toContain("100%");
  }
);
