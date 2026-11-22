import { expect, it } from "vitest";
import { researchMessage, eventDateLabel } from "./case-review-display";
it("distinguishes withholding, failure and reviewed emptiness", () => {
  expect(researchMessage("withheld")).toBe("Research is being reviewed.");
  expect(researchMessage("unavailable")).toBe("Reviewed research is temporarily unavailable.");
  expect(researchMessage("available")).toBe("No reviewed records are available.");
});
it("does not invent dates or ordering", () => {
  expect(eventDateLabel(null)).toBe("Date unknown");
  expect(eventDateLabel({ value: "2016-11", precision: "month" })).toBe("2016-11 (month only)");
});
