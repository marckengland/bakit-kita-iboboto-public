import type { ReleasedFilingContext } from "@/lib/release-data";
import { formatReviewedDate } from "../../components/ReviewedMembership";

const fieldLabels = {
  congress: "Congress",
  billNumber: "Bill number",
  introducedBy: "Introducer",
  title: "Title",
  summary: "Summary",
  filingDate: "Filing date",
} satisfies Record<keyof ReleasedFilingContext["claimEvidence"], string>;

function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <a
      className="text-primary-600 dark:text-primary-400 underline"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

function SourceLinks({ batch, ids }: { batch: ReleasedFilingContext; ids: string[] }) {
  return batch.sources
    .filter((source) => ids.includes(source.id))
    .map((source) => (
      <span key={source.id} className="ml-2 inline-block">
        <SourceLink url={source.url}>{source.locator}</SourceLink>
      </span>
    ));
}

const sourceTypeLabels: Record<string, string> = {
  as_filed_bill: "As-filed document",
  legislative_index: "Legislative index",
  migrated_legislative_record: "Migrated legislative record",
  office_announcement: "Office announcement",
};

const evidenceSupportLabels: Record<string, string> = {
  corroborates_measure_subject: "Supports the subject of the measure",
  supports_catalog_label: "Supports the catalog title",
  supports_factual_summary: "Supports the summary",
  supports_filed_short_title: "Supports the filed short title",
  supports_normalized_value: "Supports the displayed value",
};

export function ReviewedFilingEvidence({ batch }: { batch: ReleasedFilingContext }) {
  const dateClaims = [...(batch.dateObservations ?? []), ...(batch.officeDateClaims ?? [])];

  return (
    <section className="space-y-4" aria-label="Filing evidence">
      <p className="text-sm">
        This batch was approved for integration on {batch.integrationApproval.approvedOn}.{" "}
        <SourceLink url={batch.integrationApproval.sourceUrl}>Approval and scope</SourceLink> The
        frozen source packet retains its earlier proposal labels.
      </p>
      {dateClaims.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-neutral-500 uppercase">
            Dates shown in sources
          </h4>
          <ul className="mt-2 space-y-2 text-sm">
            {dateClaims.map((claim) => (
              <li key={claim.label}>
                <span>{claim.label}</span>
                {" · "}
                <time dateTime={claim.value}>{formatReviewedDate(claim.value)}</time>
                <SourceLinks batch={batch} ids={claim.sourceIds} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {batch.fieldNotes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-neutral-500 uppercase">Review notes</h4>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {batch.fieldNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {batch.additionalIndexAuthors.length > 0 && (
        <p className="text-sm">
          Additional name entries
          <SourceLinks
            batch={batch}
            ids={batch.additionalIndexAuthors.flatMap((author) => author.sourceIds)}
          />
        </p>
      )}

      <details className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
        <summary className="cursor-pointer font-medium">Field citations</summary>
        <dl className="mt-3 space-y-3 text-sm">
          {Object.entries(batch.claimEvidence).map(([field, entries]) => (
            <div key={field}>
              <dt className="font-medium">{fieldLabels[field as keyof typeof fieldLabels]}</dt>
              <dd>
                <ul className="space-y-1">
                  {entries.map((entry, index) => (
                    <li key={`${entry.sourceId}:${entry.locator}:${entry.support}:${index}`}>
                      <SourceLink url={entry.accessUrl}>{entry.locator}</SourceLink>
                      <p className="text-neutral-500">
                        {evidenceSupportLabels[entry.support]} · {entry.method}
                      </p>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </details>

      <details className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
        <summary className="cursor-pointer font-medium">Source records and provenance</summary>
        <ul className="mt-3 space-y-3 text-sm">
          {batch.sources.map((source) => (
            <li key={source.id}>
              <SourceLink url={source.url}>
                {source.publisher} · {sourceTypeLabels[source.documentType] ?? source.documentType}
              </SourceLink>
              <p>{source.relationship}</p>
            </li>
          ))}
          <li>
            <SourceLink url={batch.provenance.bettergovDocumentUrl}>
              BetterGov provenance
            </SourceLink>
            <p>BetterGov’s entry is derived from Senate records.</p>
          </li>
        </ul>
      </details>
    </section>
  );
}
