import data from "../../public/data/senate-20-refresh-2026-11-22/data.json";

export interface RefreshSource {
  id: string;
  url: string;
  accessUrl: string | null;
  publisher: string;
  documentDate: string | null;
  retrievedOn: string | null;
  reviewedOn: string | null;
  locator: string;
  excerpt: string | null;
  accessMethod: string;
  independence: string;
  dateMeaning: string | null;
}
export interface RefreshVersion {
  datasetId: string;
  approvedOn: string;
  scopeUrl: string;
  approvalUrl: string;
}
export interface ProfileRefresh {
  version: RefreshVersion;
  profileId: string;
  electedTerm: {
    start: string;
    scheduledEnd: string;
    startScope: string;
    endScope: string;
    sourceIds: string[];
  };
  membershipObservations: {
    office: string;
    congress: number;
    observedOn: string;
    scope: string;
    sourceIds: string[];
    evidenceName: string;
  }[];
  officeObservations: {
    office: string;
    asOf: string;
    datePrecision?: string;
    scope: string;
    sourceIds: string[];
  }[];
  sources: RefreshSource[];
}
export interface FilingRefresh {
  version: RefreshVersion;
  filingId: string;
  reference: string;
  events: { date: string; type: string; label: string; sourceIds: string[] }[];
  successor: {
    originalReference: string;
    successorReference: string;
    relationship: string;
    committeeReport: number;
    successorEnactment: {
      republicAct: string;
      approvedOn: string;
      houseBill: string;
      scope: string;
    } | null;
    sourceIds: string[];
  } | null;
  sources: RefreshSource[];
}

const version: RefreshVersion = {
  datasetId: data.datasetId,
  approvedOn: data.approvedOn,
  scopeUrl: "/data/senate-20-refresh-2026-11-22/INDEX.md",
  approvalUrl: "/data/senate-20-refresh-2026-11-22/APPROVAL.json",
};
const profiles = new Map<string, ProfileRefresh>(
  data.profiles.map((row) => [row.profileId, { ...row, version }])
);
const filings = new Map<string, FilingRefresh>(
  data.filings.map((row) => [row.filingId, { ...row, version }])
);

/** A versioned evidence addition; it does not update current-office or bill-status fields. */
export function getProfileRefresh(id: string): ProfileRefresh | undefined {
  return profiles.get(id);
}
export function getFilingRefresh(id: string): FilingRefresh | undefined {
  return filings.get(id);
}
