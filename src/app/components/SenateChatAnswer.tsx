"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ChatProfile, ReviewedChatAnswer } from "@/lib/reviewed-chat";
import { ReviewedFilingEvidence } from "@/app/politicians/[id]/components/ReviewedFilingEvidence";
import { formatReviewedDate } from "@/app/politicians/components/ReviewedMembership";

export function SenateChatAnswer({
  answer,
  onSelect,
}: {
  answer: ReviewedChatAnswer;
  onSelect: (profile: ChatProfile) => void;
}) {
  const t = useTranslations("senateChat");
  const senate = answer.senate;
  if (!senate) {
    return null;
  }
  return (
    <div className="min-w-0 space-y-4 text-sm break-words">
      <p role="status">{t(`status.${senate.status}`)}</p>
      {answer.profile && <p className="font-semibold">{answer.profile.fullName}</p>}
      {answer.candidates.length > 0 && (
        <ul className="space-y-2">
          {answer.candidates.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                onClick={() => onSelect(profile)}
                className="min-h-11 rounded-lg border border-neutral-400 px-3 py-2 text-left font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {profile.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {answer.moreProfiles && <p>{t("moreProfiles")}</p>}
      {senate.filings.map((filing) => (
        <article
          key={filing.id}
          className="min-w-0 space-y-3 rounded-lg border border-neutral-300 p-3 dark:border-neutral-600"
        >
          <p className="text-xs">
            {filing.reference} · {filing.congress}
            {t("congressSuffix")}
          </p>
          <h3 className="font-semibold">{filing.title}</h3>
          <p>{filing.summary}</p>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium">{t("introducer")}</dt>
              <dd>
                <Link
                  href={`/politicians/${filing.introducedBy.profileId}#selected-filings`}
                  className="underline underline-offset-4"
                >
                  {filing.introducedBy.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium">{t("filed")}</dt>
              <dd>
                {filing.filingDate ? (
                  <time dateTime={filing.filingDate}>{formatReviewedDate(filing.filingDate)}</time>
                ) : (
                  t("unknown")
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium">{t("statusUnknown")}</dt>
              <dd>{t("enactmentUnknown")}</dd>
            </div>
          </dl>
          <details open={senate.filings.length === 1}>
            <summary className="min-h-11 cursor-pointer py-2 font-medium">{t("evidence")}</summary>
            <ReviewedFilingEvidence batch={filing} />
          </details>
        </article>
      ))}
      {senate.remainingFilings > 0 && <p>{t("remaining", { count: senate.remainingFilings })}</p>}
      <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">{t("scope")}</p>
      <a href={senate.datasetUrl} className="inline-block min-h-11 py-2 underline">
        {t("dataset")}
      </a>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("checked", { date: answer.checkedAt })}
      </p>
    </div>
  );
}
