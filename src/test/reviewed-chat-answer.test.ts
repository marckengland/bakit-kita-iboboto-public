import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import messages from "../i18n/messages/en.json";
import { caseFixture } from "./fixtures/case-review";
import { projectPublicRecord } from "../lib/case-review";
import type { ReviewedChatAnswer } from "../lib/reviewed-chat";
import { ReviewedChatAnswerView } from "../app/components/ReviewedChatAnswer";
const base: ReviewedChatAnswer = {
  status: "records",
  profile: { id: "person-1", fullName: "Synthetic Person" },
  candidates: [],
  moreProfiles: false,
  records: [],
  remainingRecords: 0,
  checkedAt: "2026-11-18T00:00:00Z",
};
function render(answer: ReviewedChatAnswer) {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: createElement(ReviewedChatAnswerView, { answer, onSelect: () => {} }),
    })
  );
}
it("puts approved citations next to records and their events with dates and evidence locators", () => {
  const record = projectPublicRecord(caseFixture())!;
  const html = render({ ...base, records: [record] });
  expect(html).toContain("Criminal conviction");
  expect(html).toContain("Synthetic reviewed facts");
  expect(html).toContain("2020-02-29");
  expect(html).toContain('href="https://source1.example.test/record/1"');
  expect(html).toContain("Synthetic fixture paragraph");
  expect(html).toContain("Primary document");
  expect(html).toContain("Record sources");
  expect(html).toContain("Event sources");
  expect(html).toContain("2026-11-16");
  expect(html).toContain("Checked");
});
it("renders approved wording as text rather than turning embedded links or HTML into claims", () => {
  const record = projectPublicRecord(caseFixture())!;
  record.description =
    "<script>alert(1)</script> [invented citation](https://invented.example.test)";
  record.events[0]!.date = null;
  const html = render({ ...base, records: [record] });
  expect(html).not.toContain("<script>");
  expect(html).not.toContain('href="https://invented.example.test"');
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("Date unknown");
});
it.each([
  ["withheld", "Research is being reviewed"],
  ["unavailable", "temporarily unavailable"],
  ["no_reviewed_records", "does not mean no cases exist"],
  ["no_profile", "Try just the person&#x27;s name"],
  ["profile_not_found", "profile is no longer available"],
] as const)("explains %s without implying a clean record", (status, text) => {
  const html = render({ ...base, status, profile: null });
  expect(html).toContain(text);
  expect(html).not.toContain("Criminal conviction");
});
it("keeps profile choices separate from case evidence", () => {
  const html = render({
    ...base,
    status: "choose_profile",
    profile: null,
    candidates: [
      { id: "one", fullName: "Synthetic One" },
      { id: "two", fullName: "Synthetic Two" },
    ],
    moreProfiles: true,
  });
  expect(html).toContain("Choose a profile");
  expect(html).toContain("Synthetic One");
  expect(html).toContain("Synthetic Two");
  expect(html).toContain("More profiles match");
});

it("distinguishes different profiles with identical names before selection", () => {
  const html = render({
    ...base,
    status: "choose_profile",
    profile: null,
    candidates: [
      { id: "person-one", fullName: "Synthetic Same Name" },
      { id: "person-two", fullName: "Synthetic Same Name" },
    ],
  });
  expect(html).toContain("Profile ID: person-one");
  expect(html).toContain("Profile ID: person-two");
});
