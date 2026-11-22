import type { ReleasedProfileContext } from "@/lib/release-data";

export function ReviewedMembership({
  batch,
  className,
}: {
  batch: ReleasedProfileContext;
  className?: string;
}) {
  return (
    <p className={className}>
      <span className="block font-medium">
        {batch.office}, {batch.congress}th Congress
      </span>
      <span className="block">
        Observed <time dateTime={batch.observedOn}>{formatReviewedDate(batch.observedOn)}</time>
      </span>
      <span className="block">Current office unverified</span>
    </p>
  );
}

export function formatReviewedDate(date: string) {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
