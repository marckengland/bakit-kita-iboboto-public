import type { FilingRefresh } from "@/lib/senate-refresh";
import { evidenceDate, RefreshSources } from "./RefreshSources";

const eventLabels: Record<string, string> = {
  historical_status: "Historical listing",
  historical_status_observation: "Historical listing",
  committee_hearing_agenda: "Hearing agenda",
  committee_hearing: "Hearing record",
  committee_hearing_coverage: "Hearing record",
  substitute_recommendation: "Substitution recommendation",
  substitution_recommendation_reported: "Substitution recommendation",
  successor_floor_activity: "Activity on the substitute bill",
  dated_external_government_status: "Dated agency snapshot",
  committee_report_filed: "Committee report",
  successor_senate_passage: "Senate passage of the substitute",
  successor_enacted: "Approval of the successor law",
  successor_historical_listing: "Historical listing for the substitute",
};

export function FilingRefreshEvidence({ refresh }: { refresh: FilingRefresh }) {
  return (
    <section className="min-w-0 space-y-3 text-sm" aria-label="Dated bill history">
      <h4 className="font-semibold">Dated bill history</h4>
      <p>
        These entries record dated evidence. They do not certify the bill's current status. An
        agenda does not establish a disposition.
      </p>
      {refresh.successor && (
        <p>
          {refresh.reference} → {refresh.successor.successorReference}, a separate successor measure
          under committee report {refresh.successor.committeeReport}.
          {refresh.successor.successorEnactment &&
            ` The successor was consolidated with ${refresh.successor.successorEnactment.houseBill} and approved as ${refresh.successor.successorEnactment.republicAct} on ${evidenceDate(refresh.successor.successorEnactment.approvedOn)}.`}{" "}
          Original bill enactment remains unverified. This relationship does not establish exclusive
          authorship or that every original provision survived.
        </p>
      )}
      <ol className="space-y-4 border-l border-neutral-300 pl-4 dark:border-neutral-700">
        {[...refresh.events]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((event, index) => (
            <li key={`${event.date}:${event.type}:${index}`} className="min-w-0 break-words">
              <p className="font-medium">
                <time dateTime={event.date}>{evidenceDate(event.date)}</time> ·{" "}
                {eventLabels[event.type] ?? "Dated record"}
              </p>
              <p>{event.label}</p>
              <ul className="mt-1 space-y-1">
                {event.sourceIds.map((id) => {
                  const source = refresh.sources.find((item) => item.id === id)!;
                  return (
                    <li key={id}>
                      <a
                        href={source.accessUrl ?? source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 dark:text-primary-400 underline"
                      >
                        {source.publisher}: {source.locator}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
      </ol>
      <RefreshSources sources={refresh.sources} />
    </section>
  );
}
