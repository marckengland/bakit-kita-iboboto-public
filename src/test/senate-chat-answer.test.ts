import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import messages from "../i18n/messages/en.json";
import { ReviewedChatAnswerView } from "../app/components/ReviewedChatAnswer";
import { getReleasedFiling } from "../lib/release-data";
import type { ReviewedChatAnswer } from "../lib/reviewed-chat";
import type { SenateChatResult } from "../lib/senate-chat";
const filing = getReleasedFiling("ph-senate-20-sbn-142")!;
function render(status: SenateChatResult["status"], filings = [filing]) {
  const answer: ReviewedChatAnswer = {
    status: "records",
    profile: null,
    candidates: [],
    moreProfiles: false,
    records: [],
    remainingRecords: 0,
    checkedAt: "2026-11-19T00:00:00Z",
    senate: {
      status,
      query: "SBN-142",
      filings,
      remainingFilings: 0,
      datasetUrl: "/data/senate-20/INDEX.md",
    },
  };
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: createElement(ReviewedChatAnswerView, { answer, onSelect: () => {} }),
    })
  );
}
it("renders a filing as a proposal with exact citations, conflicts, unknowns and sample scope", () => {
  const html = render("records");
  expect(html).toContain("SBN-142");
  expect(html).toContain("Anti-Online Gambling Act of 2025");
  expect(html).toContain("Would prohibit online gambling in the Philippines.");
  expect(html).toContain("Status unknown");
  expect(html).toContain("Not verified");
  expect(html).toContain("not complete career totals");
  expect(html).toContain("July 7, 2025");
  expect(html).toContain("July 14, 2025");
  expect(html).toContain("Field citations");
  expect(html).toContain("https://legacy.senate.gov.ph/lisdata/4661942623%21.pdf");
  expect(html).toContain("BetterGov’s entry is derived from Senate records");
  expect(html).not.toContain("These are the reviewed cases");
});
it.each([
  ["not_loaded", "not available in this installation"],
  ["needs_review", "differ from the approved batch"],
  ["no_matching_filings", "does not mean no filings exist"],
  ["outside_coverage", "cannot establish"],
  ["unavailable", "temporarily unavailable"],
] as const)("explains %s without treating missing data as zero", (status, text) => {
  const html = render(status, []);
  expect(html).toContain(text);
  expect(html).not.toContain("0 bills");
  expect(html).toContain("/data/senate-20/INDEX.md");
});
it("renders field text without converting injected markup into a citation", () => {
  const html = render("records", [
    { ...filing, summary: "<script>sentinel</script> [fake](https://fake.example.test)" },
  ]);
  expect(html).not.toContain("<script>");
  expect(html).not.toContain('href="https://fake.example.test"');
  expect(html).toContain("&lt;script&gt;");
});
