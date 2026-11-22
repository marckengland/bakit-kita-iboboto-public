import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getReleasedFiling, getReleasedProfile } from "../lib/release-data";
import { PoliticianCard } from "../app/politicians/components/PoliticianCard";
import { ReviewedMembership } from "../app/politicians/components/ReviewedMembership";
import { ReviewedFilingEvidence } from "../app/politicians/[id]/components/ReviewedFilingEvidence";

const profile = getReleasedProfile("01K5S6MAZ4YBST5GDJV827A0HM")!;

describe("dated Senate refresh views", () => {
  it("shows a scheduled elected term and separate observations without claiming current office", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewedMembership, { batch: profile, showEvidence: true })
    );
    expect(html).toContain("Elected term begins");
    expect(html).toContain("June 30, 2025");
    expect(html).toContain("Scheduled term end");
    expect(html).toContain("June 30, 2031");
    expect(html).toContain("May 6, 2026");
    expect(html).toContain("July 28, 2025");
    expect(html).toContain("Current office unverified");
    expect(html).toContain("constitutional");
    expect(html).toContain("comelec.gov.ph");
  });

  it("labels an original-to-substitute-to-law chain and retains unknown original enactment", () => {
    const batch = getReleasedFiling("ph-senate-20-sbn-169")!;
    const html = renderToStaticMarkup(createElement(ReviewedFilingEvidence, { batch }));
    expect(html).toContain("Dated bill history");
    expect(html).toContain("SBN-169");
    expect(html).toContain("SBN-1894");
    expect(html).toContain("RA-12325");
    expect(html).toContain("September 4, 2026");
    expect(html).toContain("successor");
    expect(html).toContain("Original bill enactment remains unverified");
    expect(html).toContain("officialgazette.gov.ph");
  });

  it("describes agenda inclusion without upgrading it to a hearing disposition", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewedFilingEvidence, { batch: getReleasedFiling("ph-senate-20-sbn-142")! })
    );
    expect(html).toContain("Hearing agenda");
    expect(html).toContain("February 11, 2026");
    expect(html).toContain("An agenda does not establish a disposition");
    expect(html).toContain("July 14, 2025");
    expect(html).not.toContain("Became law");
  });

  it("keeps held discoveries off the public history view", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewedFilingEvidence, { batch: getReleasedFiling("ph-senate-20-sbn-219")! })
    );
    expect(html).not.toContain("Dated bill history");
    expect(html).not.toContain("SBN-2272");
    expect(html).toContain("BetterGov provenance");
  });
});

it("distinguishes a stored-record check from a fresh source verification", async () => {
  const messages = (await import("../i18n/messages/en.json")).default;
  expect(messages.reviewedChat.checked).toContain("Checked stored records");
  expect(messages.senateChat.checked).toContain("Checked stored records");
});

it("keeps default card and selector membership content noninteractive", () => {
  const html = renderToStaticMarkup(createElement(ReviewedMembership, { batch: profile }));
  expect(html).toContain("Scheduled term end");
  expect(html).not.toMatch(/<(?:a|button|details|section|div|p|dl)(?:\s|>)/);
});

it("renders an actual reviewed directory card with just its profile link", () => {
  const html = renderToStaticMarkup(
    createElement(PoliticianCard, {
      politician: {
        id: "01K5S6MAZ4YBST5GDJV827A0HM",
        fullName: "Bam Aquino",
        photo: null,
        currentPosition: null,
        currentParty: null,
        hasRedFlags: null,
        reviewedBatch: profile,
      },
    })
  );
  expect(html.match(/<a(?:\s|>)/g)).toHaveLength(1);
  expect(html).toContain('href="/politicians/01K5S6MAZ4YBST5GDJV827A0HM"');
  expect(html).toContain("Scheduled term end");
  expect(html).not.toContain("<details");
});
