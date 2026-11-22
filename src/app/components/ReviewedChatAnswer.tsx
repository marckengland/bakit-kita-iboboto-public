"use client";
import Link from "next/link";
import { SenateChatAnswer } from "./SenateChatAnswer";
import { useTranslations } from "next-intl";
import type { ChatProfile, ReviewedChatAnswer } from "@/lib/reviewed-chat";
import type { PublicSource } from "@/lib/case-review";

export function ReviewedChatAnswerView({
  answer,
  onSelect,
}: {
  answer: ReviewedChatAnswer;
  onSelect: (profile: ChatProfile) => void;
}) {
  const t = useTranslations("reviewedChat");
  if (answer.senate) {
    return <SenateChatAnswer answer={answer} onSelect={onSelect} />;
  }
  return (
    <div className="min-w-0 space-y-3 text-sm break-words">
      <p role="status">{t(`status.${answer.status}`)}</p>
      {answer.profile && <p className="font-semibold">{answer.profile.fullName}</p>}
      {answer.candidates.length > 0 && (
        <ul className="space-y-2">
          {answer.candidates.map((profile) => (
            <li key={profile.id} className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(profile)}
                className="min-h-11 rounded-lg border border-neutral-400 px-3 py-2 text-left font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                {profile.fullName}
                {answer.candidates.some(
                  (other) => other.id !== profile.id && other.fullName === profile.fullName
                ) && (
                  <span className="block text-xs font-normal">
                    {t("profileId", { id: profile.id })}
                  </span>
                )}
              </button>
              <Link className="underline" href={`/politicians/${encodeURIComponent(profile.id)}`}>
                {t("profile")}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {answer.moreProfiles && <p>{t("moreProfiles")}</p>}
      {answer.records.map((record) => (
        <details
          key={record.id}
          open
          className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-600"
        >
          <summary className="cursor-pointer font-semibold">{record.title}</summary>
          <p className="mt-2 font-medium">
            {record.section === "case" ? record.outcome.label : record.contextLabel}
          </p>
          {record.section === "case" &&
            record.relief.map((relief) => <p key={relief.eventId}>{relief.label}</p>)}
          <p className="mt-2 whitespace-pre-wrap">{record.description}</p>
          <p className="mt-2 text-xs">{t("reviewed", { date: record.reviewedAt.slice(0, 10) })}</p>
          <Citations sources={record.sources} label={t("recordSources")} />
          {record.events.length > 0 && (
            <>
              <p className="mt-3 text-xs">{t("eventOrder")}</p>
              <ul className="mt-2 space-y-3">
                {record.events.map((event) => (
                  <li
                    key={event.id}
                    className="border-l-2 border-neutral-300 pl-3 dark:border-neutral-600"
                  >
                    <p className="font-medium">
                      {event.date
                        ? event.date.precision === "day"
                          ? event.date.value
                          : t("datePrecision", {
                              date: event.date.value,
                              precision: event.date.precision,
                            })
                        : t("unknown")}
                    </p>
                    <p className="whitespace-pre-wrap">{event.summary}</p>
                    <p className="text-xs">
                      {[event.jurisdiction, event.court, event.caseNumber]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-xs">
                      {t(event.evidenceBasis === "attributed_reporting" ? "reported" : "primary")}.{" "}
                      {t("finality", { value: event.finality.replaceAll("_", " ") })}
                    </p>
                    {event.sources.length ? (
                      <Citations sources={event.sources} label={t("eventSources")} />
                    ) : (
                      <p className="text-xs">{t("sourceMissing")}</p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      ))}
      {answer.remainingRecords > 0 && <p>{t("moreRecords", { count: answer.remainingRecords })}</p>}
      {answer.profile && (
        <Link
          className="inline-block py-2 underline"
          href={`/politicians/${encodeURIComponent(answer.profile.id)}#reviewed-research`}
        >
          {t("profile")}
        </Link>
      )}
      <p className="text-xs text-neutral-600 dark:text-neutral-300">{t("scope")}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("checked", { date: answer.checkedAt })}
      </p>
    </div>
  );
}
function Citations({ sources, label }: { sources: PublicSource[]; label: string }) {
  const t = useTranslations("reviewedChat");
  return (
    <div className="mt-3 text-xs">
      <p className="font-semibold">{label}</p>
      <ol className="mt-1 list-decimal space-y-2 pl-4">
        {sources.map((source) => (
          <li key={source.id}>
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {source.sourceName}
            </a>
            {source.evidenceLocator && <p>{source.evidenceLocator}</p>}
            <p>
              {t("document")}: {source.documentDate?.slice(0, 10) ?? t("unknown")}. {t("retrieved")}
              : {source.retrievedAt.slice(0, 10)}.
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
