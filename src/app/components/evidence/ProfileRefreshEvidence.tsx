import type { ProfileRefresh } from "@/lib/senate-refresh";
import { evidenceDate, RefreshSources } from "./RefreshSources";

export function ProfileRefreshEvidence({ refresh }: { refresh: ProfileRefresh }) {
  return (
    <section className="mt-3 min-w-0 space-y-3 text-sm" aria-label="Elected term evidence">
      <dl className="space-y-1">
        <div>
          <dt className="font-medium">Elected term begins</dt>
          <dd>{evidenceDate(refresh.electedTerm.start)}</dd>
        </div>
        <div>
          <dt className="font-medium">Scheduled term end</dt>
          <dd>{evidenceDate(refresh.electedTerm.scheduledEnd)}</dd>
        </div>
      </dl>
      <p>
        These constitutional dates describe the elected term. They do not establish continuous
        service or current office.
      </p>
      {refresh.membershipObservations.map((observation) => (
        <p key={observation.observedOn}>
          Separately recognized as a senator in the proceeding of{" "}
          {evidenceDate(observation.observedOn)}.
        </p>
      ))}
      {refresh.officeObservations.map((observation) => (
        <p key={`${observation.office}:${observation.asOf}`}>
          {observation.office}, {evidenceDate(observation.asOf)}. {observation.scope}
        </p>
      ))}
      <RefreshSources sources={refresh.sources} />
    </section>
  );
}
