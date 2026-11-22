import { evidenceDate } from "@/app/components/evidence/RefreshSources";
import { ProfileRefreshEvidence } from "@/app/components/evidence/ProfileRefreshEvidence";
import type { ReleasedProfileContext } from "@/lib/release-data";

export function ReviewedMembership({
  batch,
  className,
  showEvidence = false,
}: {
  batch: ReleasedProfileContext;
  className?: string;
  showEvidence?: boolean;
}) {
  const Container = showEvidence ? "div" : "span";
  return (
    <Container className={className}>
      <span className="block font-medium">
        {batch.office}, {batch.congress}th Congress
      </span>
      <span className="block">
        Observed <time dateTime={batch.observedOn}>{formatReviewedDate(batch.observedOn)}</time>
      </span>
      <span className="block">Current office unverified</span>
      {batch.refresh &&
        (showEvidence ? (
          <ProfileRefreshEvidence refresh={batch.refresh} />
        ) : (
          <span className="mt-2 block text-sm">
            <span className="block">
              Elected term begins {evidenceDate(batch.refresh.electedTerm.start)}.
            </span>
            <span className="block">
              Scheduled term end {evidenceDate(batch.refresh.electedTerm.scheduledEnd)}.
            </span>
            <span className="block">
              Separate membership record:{" "}
              {evidenceDate(batch.refresh.membershipObservations[0]!.observedOn)}.
            </span>
            <span className="block">Scheduled dates do not establish continuous service.</span>
          </span>
        ))}
    </Container>
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
