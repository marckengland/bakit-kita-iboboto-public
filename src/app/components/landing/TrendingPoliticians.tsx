"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useOnlineReview } from "@/hooks/useOnlineReview";
import { useTranslations } from "next-intl";

export type TrendingReason =
  | "most_bookmarked"
  | "new_bills"
  | "bill_passed"
  | "bill_vetoed"
  | "new_controversy"
  | "reviewed_case_update"
  | "critical_red_flag"
  | "saln_anomaly"
  | "saln_updated"
  | "broken_promise"
  | "high_mentions"
  | "most_searched";

export interface TrendingPolitician {
  id: string;
  fullName: string;
  photo: string | null;
  currentPosition: string | null;
  trendingReason: TrendingReason;
  trendingScore: number;
  billCount: number;
  reviewedCases: number | null;
  bookmarkCount: number;
}

interface TrendingPoliticiansProps {
  politicians: TrendingPolitician[];
}

const REASON_CONFIG: Record<
  TrendingReason,
  { icon: string; colorClass: string; labelKey: string }
> = {
  bill_passed: {
    icon: "✅",
    colorClass: "bg-success-50 text-success-700 dark:bg-success-900/50 dark:text-success-300",
    labelKey: "trending.reasons.billPassed",
  },
  bill_vetoed: {
    icon: "🚫",
    colorClass:
      "bg-secondary-50 text-secondary-700 dark:bg-secondary-900/50 dark:text-secondary-300",
    labelKey: "trending.reasons.billVetoed",
  },
  critical_red_flag: {
    icon: "🚩",
    colorClass: "bg-error-50 text-error-700 dark:bg-error-900/50 dark:text-error-300",
    labelKey: "trending.reasons.criticalRedFlag",
  },
  saln_anomaly: {
    icon: "📊",
    colorClass: "bg-warning-50 text-warning-700 dark:bg-warning-900/50 dark:text-warning-300",
    labelKey: "trending.reasons.salnAnomaly",
  },
  reviewed_case_update: {
    icon: "⚖️",
    colorClass:
      "bg-secondary-50 text-secondary-700 dark:bg-secondary-900/50 dark:text-secondary-300",
    labelKey: "trending.reasons.reviewedCaseUpdate",
  },
  broken_promise: {
    icon: "💔",
    colorClass: "bg-error-50 text-error-700 dark:bg-error-900/50 dark:text-error-300",
    labelKey: "trending.reasons.brokenPromise",
  },
  new_controversy: {
    icon: "⚠️",
    colorClass:
      "bg-secondary-50 text-secondary-700 dark:bg-secondary-900/50 dark:text-secondary-300",
    labelKey: "trending.reasons.newControversy",
  },
  most_bookmarked: {
    icon: "🔥",
    colorClass: "bg-accent-100 text-accent-700 dark:bg-accent-900/50 dark:text-accent-300",
    labelKey: "trending.reasons.mostBookmarked",
  },
  new_bills: {
    icon: "📝",
    colorClass: "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300",
    labelKey: "trending.reasons.newBills",
  },
  saln_updated: {
    icon: "💰",
    colorClass: "bg-success-50 text-success-700 dark:bg-success-900/50 dark:text-success-300",
    labelKey: "trending.reasons.salnUpdated",
  },
  high_mentions: {
    icon: "📢",
    colorClass: "bg-info-50 text-info-700 dark:bg-info-900/50 dark:text-info-300",
    labelKey: "trending.reasons.highMentions",
  },
  most_searched: {
    icon: "🔍",
    colorClass: "bg-warning-50 text-warning-700 dark:bg-warning-900/50 dark:text-warning-300",
    labelKey: "trending.reasons.mostSearched",
  },
};

export function TrendingPoliticians({ politicians }: TrendingPoliticiansProps) {
  const onlineReview = useOnlineReview();
  const t = useTranslations("home");
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Cards visible per viewport
  const getVisibleCount = useCallback(() => {
    if (typeof window === "undefined") {
      return 4;
    }
    if (window.innerWidth >= 1024) {
      return 4;
    }
    if (window.innerWidth >= 640) {
      return 2;
    }
    return 1;
  }, []);

  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    setVisibleCount(getVisibleCount());
    const handleResize = () => setVisibleCount(getVisibleCount());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getVisibleCount]);

  const totalPages = Math.ceil(politicians.length / visibleCount);
  const [currentPage, setCurrentPage] = useState(0);

  // Auto-scroll by page
  useEffect(() => {
    if (!isAutoPlaying || totalPages <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setCurrentPage((prev) => (prev >= totalPages - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, totalPages]);

  if (!politicians.length) {
    return null;
  }

  const goTo = (page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
    setIsAutoPlaying(false);
  };

  return (
    <section className="mx-auto mt-20 max-w-6xl">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl dark:text-white">
          {t("trending.title")}
        </h2>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">{t("trending.subtitle")}</p>
      </div>

      <div className="relative">
        {/* Navigation arrows */}
        {currentPage > 0 && (
          <button
            onClick={() => goTo(currentPage - 1)}
            className="absolute top-1/2 -left-4 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-md transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            aria-label={t("trending.previous")}
          >
            <span aria-hidden="true">‹</span>
          </button>
        )}
        {currentPage < totalPages - 1 && (
          <button
            onClick={() => goTo(currentPage + 1)}
            className="absolute top-1/2 -right-4 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-md transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            aria-label={t("trending.next")}
          >
            <span aria-hidden="true">›</span>
          </button>
        )}

        {/* Carousel track */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{
              transform: `translateX(-${currentPage * 100}%)`,
            }}
          >
            {politicians.map((pol) => {
              const reason = REASON_CONFIG[pol.trendingReason];
              return (
                <div
                  key={pol.id}
                  className="flex-shrink-0 px-2"
                  style={{ width: `${100 / visibleCount}%` }}
                >
                  <Link
                    href={`/politicians/${pol.id}`}
                    className="group hover:border-primary-300 dark:hover:border-primary-600 block rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    {/* Trending reason tag */}
                    <div className="mb-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${reason.colorClass}`}
                      >
                        <span aria-hidden="true">{reason.icon}</span>
                        {onlineReview || pol.trendingReason !== "reviewed_case_update"
                          ? t(reason.labelKey)
                          : "Online review required"}
                      </span>
                    </div>

                    <div className="mb-3 flex items-center gap-3">
                      <div className="bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold">
                        {pol.photo ? (
                          <Image
                            src={pol.photo}
                            alt={pol.fullName}
                            width={48}
                            height={48}
                            sizes="48px"
                            unoptimized
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          pol.fullName.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate text-sm font-semibold text-neutral-900 dark:text-white">
                          {pol.fullName}
                        </h3>
                        {pol.currentPosition && (
                          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {pol.currentPosition}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {pol.billCount > 0 && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                          {pol.billCount} {t("trending.bills")}
                        </span>
                      )}
                      {onlineReview && pol.reviewedCases !== null && pol.reviewedCases > 0 && (
                        <span className="bg-secondary-50 text-secondary-700 dark:bg-secondary-900/50 dark:text-secondary-300 rounded-full px-2 py-0.5 font-medium">
                          {pol.reviewedCases} {t("trending.reviewedCases")}
                        </span>
                      )}

                      {pol.bookmarkCount > 0 && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                          {pol.bookmarkCount} {t("trending.bookmarks")}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dot indicators */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all ${
                  i === currentPage
                    ? "bg-primary-500 h-1.5 w-4"
                    : "h-1.5 w-1.5 bg-neutral-300 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500"
                }`}
                aria-label={`Go to page ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
