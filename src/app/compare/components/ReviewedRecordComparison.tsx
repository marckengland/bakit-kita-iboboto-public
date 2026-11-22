import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ComparisonResult } from "@/services/comparison.service";
import {
  ReviewedMembership,
  formatReviewedDate,
} from "@/app/politicians/components/ReviewedMembership";

export function ReviewedRecordComparison({ result }: { result: ComparisonResult }) {
  const t = useTranslations("reviewedComparison");
  return (
    <section aria-label={t("title")} className="space-y-5">
      <div>
        <h3 className="text-xl font-semibold">{t("title")}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {t("scope")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {result.politicians.map((profile) => {
          const entry = result.reviewedFilings?.[profile.id];
          return (
            <article
              key={profile.id}
              className="min-w-0 rounded-xl border border-neutral-300 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-950"
            >
              <h4 className="text-lg font-semibold">
                <Link href={`/politicians/${profile.id}`} className="underline underline-offset-4">
                  {profile.fullName}
                </Link>
              </h4>
              {profile.reviewedBatch && (
                <ReviewedMembership
                  batch={profile.reviewedBatch}
                  className="mt-2 text-sm text-neutral-600 dark:text-neutral-400"
                />
              )}
              {entry?.status === "records" ? (
                <>
                  <p className="mt-5 text-sm font-medium">
                    {t("selected", { count: entry.filings.length })}
                  </p>
                  <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
                    {entry.filings.map((filing) => (
                      <li key={filing.id} className="space-y-2 py-4 text-sm">
                        <p className="font-semibold">
                          {filing.reference}: {filing.title}
                        </p>
                        <p>
                          {t("filed")}:{" "}
                          {filing.filingDate ? (
                            <time dateTime={filing.filingDate}>
                              {formatReviewedDate(filing.filingDate)}
                            </time>
                          ) : (
                            t("unknown")
                          )}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          <a
                            href={filing.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-4"
                          >
                            {t("source")}
                          </a>
                          <Link
                            href={`/politicians/${profile.id}#selected-filings`}
                            className="underline underline-offset-4"
                          >
                            {t("evidence")}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-5 text-sm" role="status">
                  {t("unavailable")}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {t("missing")}
      </p>
    </section>
  );
}
