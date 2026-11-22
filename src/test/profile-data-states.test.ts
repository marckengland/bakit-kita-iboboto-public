import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../i18n/messages/en.json";
import { AttendanceSection } from "../app/politicians/[id]/components/AttendanceSection";
import { FamilyNetworkSection } from "../app/politicians/[id]/components/FamilyNetworkSection";
import { ControversiesSection } from "../app/politicians/[id]/components/ControversiesSection";
import { withheldResearch } from "../lib/case-review";

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

const noSessions = {
  totalSessions: 0,
  sessionsAttended: 0,
  sessionsAbsentExcused: 0,
  sessionsAbsentUnexcused: 0,
  attendancePercentage: 0,
  byChember: [],
};
const noFamily: NonNullable<ComponentProps<typeof FamilyNetworkSection>["initialNetwork"]> = {
  politicianId: "synthetic-a",
  politicianName: "Synthetic Candidate A",
  familyMembers: [],
  totalFamilyMembersInPolitics: 0,
  concurrentPositions: 0,
  sequentialPositions: 0,
  positionOverlaps: [],
  isDynasty: false,
  dynastySeverity: "none",
};

describe("profile evidence labels", () => {
  it("does not turn missing attendance records into a performance percentage", () => {
    const html = render(
      createElement(AttendanceSection, { politicianId: "synthetic-a", initialStats: noSessions })
    );
    expect(html).toContain("No attendance records available");
    expect(html).not.toContain("0.0%");
  });

  it("still shows genuine zero attendance when sessions were recorded", () => {
    const html = render(
      createElement(AttendanceSection, {
        politicianId: "synthetic-a",
        initialStats: { ...noSessions, totalSessions: 3, sessionsAbsentUnexcused: 3 },
      })
    );
    expect(html).toContain("0.0%");
    expect(html).toContain("Unexcused Absences");
    expect(html).not.toContain("No attendance records available");
  });

  it("does not declare a person free of family connections when none are recorded", () => {
    const html = render(
      createElement(FamilyNetworkSection, { politicianId: "synthetic-a", initialNetwork: noFamily })
    );
    expect(html).toContain("No family connections recorded");
    expect(html).not.toContain("Not part of a political dynasty");
    expect(html).not.toContain("found in official records");
  });

  it("distinguishes unavailable family information from an empty network", () => {
    const html = render(
      createElement(FamilyNetworkSection, { politicianId: "synthetic-a", initialNetwork: null })
    );
    expect(html).not.toContain("Not part of a political dynasty");
    expect(html).not.toContain("No family connections recorded");
  });

  it("does not imply conflict clearance without business or legislative evidence", () => {
    const html = render(
      createElement(ControversiesSection, {
        politicianId: "synthetic-a",
        initialResearch: withheldResearch(),
        initialConflicts: {
          politicianId: "synthetic-a",
          hasConflicts: false,
          conflicts: [],
          businessInterests: [],
          billsAnalyzed: 0,
          committeesAnalyzed: 0,
          lastAnalyzedAt: new Date("2026-01-01"),
          disclaimer: "Synthetic analysis fixture",
        },
      })
    );
    expect(html).toContain("Not enough records to assess conflicts");
    expect(html).not.toContain("No potential conflicts of interest found");
    expect(html).toContain("Research is being reviewed");
  });
});
