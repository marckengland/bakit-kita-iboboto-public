import approval from "../../public/data/senate-20/APPROVAL.json";
import { releaseData } from "./release-data";

export function apiSourceMetadata(includesReviewedBatch: boolean, includesOtherRecords = false) {
  if (!includesReviewedBatch) {
    return {
      attribution:
        "Data sourced from official Philippine government records. Attribution required for publication.",
    };
  }

  const { structuredFactsLicense } = approval;
  const sourceTerms = includesOtherRecords
    ? " Other records retain their respective source terms."
    : "";
  return {
    attribution: `Reviewed batch structured facts are dedicated under ${structuredFactsLicense}. Source citations identify their provenance. Original documents retain their own rights.${sourceTerms}`,
    reviewedBatchReuse: {
      structuredFactsLicense,
      sourceDocumentRightsTransferred: releaseData.reuse.sourceDocumentRightsTransferred,
      datasetId: releaseData.datasetId,
      datasetUrl: "/data/senate-20/INDEX.md",
    },
  };
}
