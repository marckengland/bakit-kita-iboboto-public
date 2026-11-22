import type { PublicResearchEnvelope, PublicCaseEvent } from "./case-review";
export function researchMessage(availability: PublicResearchEnvelope["availability"]): string {
  return availability === "withheld"
    ? "Research is being reviewed."
    : availability === "unavailable"
      ? "Reviewed research is temporarily unavailable."
      : "No reviewed records are available.";
}
export function eventDateLabel(date: PublicCaseEvent["date"]): string {
  return date
    ? date.value + (date.precision === "day" ? "" : ` (${date.precision} only)`)
    : "Date unknown";
}
