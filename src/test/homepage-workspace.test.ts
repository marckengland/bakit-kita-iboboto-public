import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../i18n/messages/en.json";
import { HomeComparison } from "../app/components/landing/HomeComparison";
import { getHomeFilingExamples } from "../lib/homepage-filings";
import { releaseData } from "../lib/release-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const zubiri = releaseData.profiles.find((profile) => profile.displayName.includes("Zubiri"))!;

describe("homepage research entry points", () => {
  it("does not expose bundled examples when no profiles are loaded", () => {
    expect(getHomeFilingExamples([])).toEqual([]);
  });

  it("limits examples to the loaded profiles and preserves an unknown filing date", () => {
    const examples = getHomeFilingExamples([zubiri.id]);
    expect(examples).toHaveLength(1);
    const filing = examples[0]!;
    expect(filing.billNumber).toBe(142);
    expect(filing.filingDate).toBeNull();
    expect(examples.every((filing) => filing.introducedBy.profileId === zubiri.id)).toBe(true);
    expect(filing.sources.some((source) => source.publisher === "Senate of the Philippines")).toBe(
      true
    );
  });

  it("picks at most three examples in bill-number order without ranking people", () => {
    const examples = getHomeFilingExamples(releaseData.profiles.map((profile) => profile.id));
    expect(examples).toHaveLength(3);
    expect(examples.map((filing) => filing.billNumber)).toEqual([1, 6, 11]);
    expect(examples.every((filing) => filing.sources.length > 0)).toBe(true);
  });

  it.each([
    { profiles: [] },
    { profiles: [{ id: "synthetic-a", fullName: "Synthetic Person A" }] },
  ])("keeps the comparison unavailable without two loaded profiles: %j", ({ profiles }) => {
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "en",
        timeZone: "UTC",
        messages,
        children: createElement(HomeComparison, { profiles }),
      })
    );
    expect(html).toContain("disabled");
    expect(html).toContain("At least two profiles need to be available");
    expect(html).not.toContain("Most popular");
  });

  it("offers real loaded names without preselecting a political matchup", () => {
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "en",
        timeZone: "UTC",
        messages,
        children: createElement(HomeComparison, {
          profiles: [
            { id: "synthetic-a", fullName: "Synthetic Person A" },
            { id: "synthetic-b", fullName: "Synthetic Person B" },
          ],
        }),
      })
    );
    expect(html).toContain("Synthetic Person A");
    expect(html).toContain("Synthetic Person B");
    expect(html).toContain('data-profile-id="synthetic-a"');
    expect(html).toContain('data-profile-id="synthetic-b"');
    expect(html).not.toMatch(/data-selected-profile="synthetic-[ab]"/);
    expect(html).toContain('type="submit" disabled');
  });
});
