import type { ReleasedProfileContext } from "@/lib/release-data";
import { ReviewedMembership } from "@/app/politicians/components/ReviewedMembership";

export function ReviewedComparisonCoverage({ batch }: { batch: ReleasedProfileContext }) {
  return (
    <div className="mt-2 space-y-2 text-sm text-neutral-500 dark:text-neutral-400">
      <ReviewedMembership showEvidence batch={batch} />
      <p>
        {batch.selectedFilingCount} selected Senate filing
        {batch.selectedFilingCount !== 1 ? "s" : ""}. Career totals and enactment are unverified.
      </p>
    </div>
  );
}
