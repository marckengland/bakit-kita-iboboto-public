import { getReleasedFiling, releaseData } from "./release-data";

/** Show approved examples only for profiles actually present in this installation. */
export function getHomeFilingExamples(loadedProfileIds: readonly string[]) {
  const loaded = new Set(loadedProfileIds);
  return releaseData.filings
    .filter((filing) => loaded.has(filing.introducedBy.profileId))
    .sort((a, b) => a.billNumber - b.billNumber)
    .slice(0, 3)
    .map((filing) => getReleasedFiling(filing.id)!);
}
