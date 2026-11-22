import data from "../../public/data/senate-20/data.json";
import sourceManifest from "../../public/data/senate-20/sources.json";

/** Immutable reviewed facts; importing a batch into a database is a separate operation. */
export const releaseData = data;
export const releaseSources = sourceManifest.sources;
export const releaseIntegrationApproval = {
  status: "approved_for_integration" as const,
  approvedOn: "2026-11-19",
  publicationAuthorized: false,
  sourceUrl: "/data/senate-20/APPROVAL.json",
};
export type ReleaseSource = (typeof releaseSources)[number];
export type ReleasedFilingContext = (typeof releaseData.filings)[number] & {
  sources: ReleaseSource[];
  integrationApproval: typeof releaseIntegrationApproval;
};
export interface ReleasedProfileContext {
  datasetId: string;
  observedOn: string;
  office: string;
  congress: number;
  selectedFilingCount: number;
  sourceUrl: string;
  datasetUrl: string;
  currentOffice: null;
  termStart: null;
  termEnd: null;
  limitations: string[];
}

const profiles = new Map(releaseData.profiles.map((profile) => [profile.id, profile]));
const filings = new Map(releaseData.filings.map((filing) => [filing.id, filing]));
const sources = new Map(releaseSources.map((source) => [source.id, source]));

export function getReleasedProfile(id: string): ReleasedProfileContext | null {
  const profile = profiles.get(id);
  if (!profile) {
    return null;
  }
  return {
    datasetId: releaseData.datasetId,
    observedOn: profile.membership.observedOn,
    office: profile.membership.office,
    congress: profile.membership.congress,
    selectedFilingCount: profile.selectedFilingIds.length,
    sourceUrl: sources.get(profile.membership.sourceIds[0]!)!.url,
    datasetUrl: "/data/senate-20/INDEX.md",
    currentOffice: null,
    termStart: null,
    termEnd: null,
    limitations: [
      "Membership was observed on this date; current office and term dates are unknown in this batch.",
      "Selected filings are a sample, not complete career totals, exclusive authorship, or enacted laws.",
      "Cases, family links, party affiliations, elections, financial disclosures, attendance, and votes were not established by this batch.",
    ],
  };
}

export function getReleasedFiling(id: string): ReleasedFilingContext | null {
  const filing = filings.get(id);
  if (!filing) {
    return null;
  }
  return {
    ...filing,
    integrationApproval: releaseIntegrationApproval,
    sources: filing.sourceIds.map((sourceId) => {
      const source = sources.get(sourceId);
      if (!source) {
        throw new Error("Released filing has an unresolved source reference");
      }
      return source;
    }),
  };
}
