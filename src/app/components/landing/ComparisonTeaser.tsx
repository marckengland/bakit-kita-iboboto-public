"use client";

import Link from "next/link";
import Image from "next/image";
import { useOnlineReview } from "@/hooks/useOnlineReview";
import { useTranslations } from "next-intl";

export interface ComparisonPolitician {
  id: string;
  fullName: string;
  photo: string | null;
  currentPosition: string | null;
  billCount: number;
  netWorth: string | null;
  attendanceRate: string | null;
  reviewedCases: number | null;
  redFlags: number;
  researchHeld: boolean;
  promisesKept: number;
  promisesBroken: number;
  totalPromises: number;
}

interface ComparisonTeaserProps {
  politicianA: ComparisonPolitician;
  politicianB: ComparisonPolitician;
}

export function ComparisonTeaser({ politicianA, politicianB }: ComparisonTeaserProps) {
  const onlineReview = useOnlineReview();
  const t = useTranslations("home");

  return (
    <section className="mx-auto mt-20 max-w-4xl">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl dark:text-white">
          {t("comparison.title")}
        </h2>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">{t("comparison.subtitle")}</p>
      </div>

      {(politicianA.researchHeld || politicianB.researchHeld) && (
        <p className="mb-3 text-sm" role="status">
          Research is being reviewed. Counts show the indicators currently shown.
        </p>
      )}
      {!onlineReview && <p role="status">Case details require an online review check.</p>}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
        {/* Header row */}
        <div className="grid grid-cols-3 border-b border-neutral-100 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
          <PoliticianHeader politician={politicianA} />
          <div className="flex items-center justify-center p-4">
            <span className="bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded-full px-3 py-1 text-xs font-bold">
              VS
            </span>
          </div>
          <PoliticianHeader politician={politicianB} />
        </div>

        {/* Stats rows */}
        <ComparisonRow
          icon="📝"
          label={t("comparison.billsFiled")}
          valueA={String(politicianA.billCount)}
          valueB={String(politicianB.billCount)}
          highlightHigher
        />
        <ComparisonRow
          icon="💰"
          label={t("comparison.netWorth")}
          valueA={politicianA.netWorth || "N/A"}
          valueB={politicianB.netWorth || "N/A"}
        />
        <ComparisonRow
          icon="📋"
          label={t("comparison.attendance")}
          valueA={politicianA.attendanceRate || "N/A"}
          valueB={politicianB.attendanceRate || "N/A"}
          highlightHigher
        />
        <ComparisonRow
          icon="⚖️"
          label={t("comparison.reviewedCases")}
          valueA={String(onlineReview ? (politicianA.reviewedCases ?? "—") : "—")}
          valueB={String(onlineReview ? (politicianB.reviewedCases ?? "—") : "—")}
          highlightLower
        />
        <ComparisonRow
          icon="🚩"
          label={t("comparison.redFlags")}
          valueA={String(onlineReview ? politicianA.redFlags : "—")}
          valueB={String(onlineReview ? politicianB.redFlags : "—")}
          highlightLower
        />
        <ComparisonRow
          icon="🤝"
          label={t("comparison.promisesKept")}
          valueA={
            politicianA.totalPromises > 0
              ? `${politicianA.promisesKept}/${politicianA.totalPromises}`
              : "N/A"
          }
          valueB={
            politicianB.totalPromises > 0
              ? `${politicianB.promisesKept}/${politicianB.totalPromises}`
              : "N/A"
          }
          isLast
        />

        {/* CTA */}
        <div className="border-t border-neutral-100 bg-neutral-50 p-4 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <Link
            href={`/compare?ids=${politicianA.id},${politicianB.id}`}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm"
          >
            {t("comparison.cta")}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

function PoliticianHeader({ politician }: { politician: ComparisonPolitician }) {
  return (
    <div className="flex flex-col items-center p-4">
      <div className="bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300 mb-2 flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold">
        {politician.photo ? (
          <Image
            src={politician.photo}
            alt={politician.fullName}
            width={56}
            height={56}
            sizes="56px"
            unoptimized
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          politician.fullName.charAt(0)
        )}
      </div>
      <h3 className="text-center text-sm font-semibold text-neutral-900 dark:text-white">
        {politician.fullName}
      </h3>
      {politician.currentPosition && (
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          {politician.currentPosition}
        </p>
      )}
    </div>
  );
}

function ComparisonRow({
  icon,
  label,
  valueA,
  valueB,
  isLast = false,
  highlightHigher = false,
  highlightLower = false,
}: {
  icon: string;
  label: string;
  valueA: string;
  valueB: string;
  isLast?: boolean;
  highlightHigher?: boolean;
  highlightLower?: boolean;
}) {
  // Determine which side to highlight
  let highlightA = false;
  let highlightB = false;

  if (highlightHigher || highlightLower) {
    const numA = parseFloat(valueA.replace(/[^0-9.]/g, ""));
    const numB = parseFloat(valueB.replace(/[^0-9.]/g, ""));
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      if (highlightHigher) {
        highlightA = numA > numB;
        highlightB = numB > numA;
      } else {
        // Lower is better (e.g., fewer cases/red flags)
        highlightA = numA < numB;
        highlightB = numB < numA;
      }
    }
  }

  return (
    <div
      className={`grid grid-cols-3 ${!isLast ? "border-b border-neutral-100 dark:border-neutral-700" : ""}`}
    >
      <div className="flex items-center justify-center p-3">
        <span
          className={`text-sm font-semibold ${highlightA ? "text-success-600 dark:text-success-400" : "text-neutral-900 dark:text-white"}`}
        >
          {valueA}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 bg-neutral-50/50 p-3 dark:bg-neutral-900/30">
        <span aria-hidden="true">{icon}</span>
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
      </div>
      <div className="flex items-center justify-center p-3">
        <span
          className={`text-sm font-semibold ${highlightB ? "text-success-600 dark:text-success-400" : "text-neutral-900 dark:text-white"}`}
        >
          {valueB}
        </span>
      </div>
    </div>
  );
}
