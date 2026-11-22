import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import messages from "../i18n/messages/en.json";
import { ReviewedRecordComparison } from "../app/compare/components/ReviewedRecordComparison";
import { getReleasedProfile } from "../lib/release-data";
import type { ComparisonResult } from "../services/comparison.service";
const id = "01K5ST4HCY5N9130WESWJH9BSZ";
function render(status: string) {
  const result: ComparisonResult = {
    politicians: [{ id, fullName: "Juan Miguel Zubiri", reviewedBatch: getReleasedProfile(id)! }],
    metrics: [],
    differences: [],
    comparedAt: new Date("2026-11-22"),
    reviewedFilings: {
      [id]: {
        status,
        filings:
          status === "records"
            ? [
                {
                  id: "ph-senate-20-sbn-142",
                  reference: "SBN-142",
                  title: "Anti-Online Gambling Act of 2025",
                  filingDate: null,
                  sourceUrl: "https://legacy.senate.gov.ph/lisdata/4661942623%21.pdf",
                },
              ]
            : [],
      },
    },
  };
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: createElement(ReviewedRecordComparison, { result }),
    })
  );
}
it("compares actual reviewed sample facts with sources, rather than fabricated performance rates", () => {
  const html = render("records");
  expect(html).toContain("SBN-142");
  expect(html).toContain("1 selected filing in this batch");
  expect(html).toContain("Not verified");
  expect(html).toContain("does not establish better performance");
  expect(html).toContain("https://legacy.senate.gov.ph/lisdata/4661942623%21.pdf");
  expect(html).not.toContain("0%");
});
it.each(["needs_review", "not_loaded", "unavailable"])(
  "keeps %s distinct from a zero filing count",
  (status) => {
    const html = render(status);
    expect(html).toContain("unavailable or need review");
    expect(html).toContain("does not mean the person filed nothing");
    expect(html).not.toContain("0 selected");
  }
);
