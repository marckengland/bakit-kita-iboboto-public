import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { BillAuthorRole, Chamber, SourceType } from "@prisma/client";
import { getReleasedFiling, getReleasedProfile } from "../lib/release-data";
import messages from "../i18n/messages/en.json";
import Home from "../app/page";
import { AccessibilityProvider } from "../app/providers/AccessibilityProvider";
import { prisma } from "../lib/prisma";
import * as publicResearch from "../services/public-research.service";
import { PoliticianCard } from "../app/politicians/components/PoliticianCard";
import { ProfileHeader } from "../app/politicians/[id]/components/ProfileHeader";
import { BillsSection } from "../app/politicians/[id]/components/BillsSection";
import { BillDetailsContent } from "../app/politicians/[id]/components/BillDetailsModal";
import { ComparisonView } from "../app/compare/components/ComparisonView";
import { MobileComparisonView } from "../app/compare/components/MobileComparisonView";
import { SourceTooltip } from "../app/politicians/[id]/components/SourceTooltip";
import type { BillDetails } from "../services/legislative.service";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "home.research") =>
    createTranslator({ locale: "en", messages, namespace }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const profileId = "01K5S6MAZ4YBST5GDJV827A0HM";
const reviewedBatch = getReleasedProfile(profileId)!;

const politician = {
  id: profileId,
  fullName: "Bam Aquino",
  firstName: "Bam",
  lastName: "Aquino",
  createdAt: new Date("2025-07-28"),
  updatedAt: new Date("2025-07-28"),
  isActive: true,
  positions: [],
  partyAffiliations: [],
  hasRedFlags: null,
  redFlagCount: null,
  sources: {},
  reviewedBatch,
};

function billDetails(billNumber: number): BillDetails {
  const filing = getReleasedFiling(`ph-senate-20-sbn-${billNumber}`)!;
  return {
    id: filing.id,
    billNumber: filing.reference,
    title: filing.title,
    summary: filing.summary,
    filingDate: filing.filingDate ? new Date(filing.filingDate) : null,
    status: null,
    republicActNumber: null,
    chamber: Chamber.senate,
    congress: 20,
    session: null,
    authorRole: BillAuthorRole.introduced_by,
    fullText: null,
    authors: [
      {
        politicianId: filing.introducedBy.profileId,
        politicianName: filing.introducedBy.name,
        role: BillAuthorRole.introduced_by,
      },
    ],
    sources: [],
    reviewedBatch: filing,
  };
}

function render(content: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: content,
    })
  );
}

function renderBillDetails(billNumber: number) {
  return render(createElement(BillDetailsContent, { bill: billDetails(billNumber) }));
}

describe("reviewed Senate cohort UI", () => {
  it("displays published coverage for the loaded cohort on the homepage", async () => {
    vi.mocked(prisma.politician.count).mockResolvedValueOnce(24);
    vi.mocked(prisma.politician.findMany).mockResolvedValueOnce([
      { id: profileId, fullName: "Bam Aquino", updatedAt: new Date("2026-11-19"), Position: [] },
    ] as never);
    vi.spyOn(publicResearch, "getPublicResearchBatch").mockResolvedValueOnce(new Map());

    const html = render(createElement(AccessibilityProvider, { children: await Home() }));
    expect(html).toContain("24 profiles");
    expect(html).toContain("July 28, 2025");
    expect(html).toContain("selected Senate filings");
    expect(html).toContain("Current office and career totals are unverified");
    expect(html).toContain("/data/senate-20/INDEX.md");
    expect(html).not.toContain("active profiles");
  });

  it("makes the directory office label a dated observation", () => {
    const html = render(createElement(PoliticianCard, { politician }));
    expect(html).toContain("Senator, 20th Congress");
    expect(html).toContain("July 28, 2025");
    expect(html).toContain("Current office unverified");
  });

  it("keeps generic active status and position totals off a dated profile", () => {
    const html = render(
      createElement(ProfileHeader, {
        politician,
        redFlagCount: null,
        researchAvailability: "withheld",
      })
    );
    expect(html).toContain("Senator, 20th Congress");
    expect(html).toContain("July 28, 2025");
    expect(html).toContain(reviewedBatch.sourceUrl);
    expect(html).not.toMatch(/>Active<|>Inactive<|>Former<|Positions Held|Party Affiliations/);
    expect(html).not.toContain("Indicators currently shown: 0");
    expect(html).not.toContain("Case details require an online review check.");
  });

  it("identifies the date and status as unknown in the selected filing table", () => {
    const props = {
      politicianId: billDetails(142).authors[0]!.politicianId,
      initialBills: [billDetails(142)],
      totalCount: 1,
      reviewedBatch,
    };
    const html = render(createElement(BillsSection, props));
    expect(html).toContain("Selected Senate Filings");
    expect(html).toContain("Not verified");
    expect(html).toContain("Status unknown");
    expect(html).toContain("Introducer");
    expect(html).not.toMatch(/January 1, 1970|authored or co-authored/);
  });

  it("shows competing candidate dates without choosing a filing date", () => {
    const html = renderBillDetails(142);
    expect(html).toMatch(/>Filed<\/p><p[^>]*>Not verified<\/p>/);
    expect(html).toMatch(/>Session<\/p><p[^>]*>Not verified<\/p>/);
    expect(html).toContain("Status unknown");
    expect(html).toContain("Current Senate Documents panel Date Filed");
    expect(html).toContain("July 14, 2025");
    expect(html).toContain("July 7, 2025");
    expect(html).toContain("2025-07-03");
    expect(html).toContain("https://senate.gov.ph/legislative-documents/bills/595179");
    expect(html).toContain("BetterGov provenance");
  });

  it.each([
    [11, "Robinhood Padilla", ["Joel Villanueva"], "cover/header, Introduced by line"],
    [52, "Win Gatchalian", ["Erwin Tulfo", "Francis Pangilinan"], "As-filed opening byline"],
    [82, "Raffy T. Tulfo", ["Joel Villanueva"], "First-page Congress, bill number, introducer"],
  ] as const)(
    "separates the introducer of SBN-%s from additional names in the index",
    (number, introducer, additional, locator) => {
      const html = renderBillDetails(number);
      expect(html).toContain("Introducer on the filed document");
      expect(html).toContain(introducer);
      expect(html).toContain("Additional names in the Senate index");
      for (const author of additional) {
        expect(html).toContain(author);
      }
      expect(html).toContain("Role and addition date unverified");
      expect(html).toContain(locator);
      expect(html).not.toMatch(/\(Principal\)|\(Co-Author\)/);
    }
  );

  it.each([
    ["desktop", ComparisonView],
    ["mobile", MobileComparisonView],
  ] as const)(
    "shows dated membership and sample-only coverage in the %s comparison view",
    (_viewport, View) => {
      const html = render(
        createElement(View, {
          result: {
            politicians: [politician],
            metrics: [],
            differences: [],
            comparedAt: new Date("2026-11-19"),
          },
        })
      );
      expect(html).toContain("July 28, 2025");
      expect(html).toContain("2 selected Senate filings");
      expect(html).toContain("Career totals and enactment are unverified");
    }
  );

  it("does not invent a confidence score or corroboration for two cited records", () => {
    const reference = {
      sourceType: SourceType.legislative_record,
      sourceName: "Senate filed PDF",
      retrievedAt: new Date("2026-11-18"),
      confidence: null,
      isAIProcessed: false,
    };
    const input = { sources: [reference, { ...reference, sourceName: "Senate LIS entry" }] };
    const html = render(createElement(SourceTooltip, input));
    expect(html).toContain("Senate filed PDF");
    expect(html).toContain("Senate LIS entry");
    expect(html).not.toMatch(/\d% confidence|Multiple sources corroborate/);
  });
});
