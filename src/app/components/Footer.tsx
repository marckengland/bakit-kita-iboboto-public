/**
 * Shared Footer Component
 *
 * Reusable footer with copyright and data source information.
 */

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { FeedbackButton } from "./FeedbackButton";

interface FooterProps {
  /** Custom data source text */
  dataSourceText?: string;
}

export function Footer({ dataSourceText }: FooterProps) {
  const tCommon = useTranslations("common");

  return (
    <footer className="border-t border-neutral-300 bg-neutral-50 py-8 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="container-wide">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0 space-y-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <p>{tCommon("copyright")}</p>
            <p>{dataSourceText || tCommon("dataSource")}</p>
          </div>
          <nav aria-label="Feedback and contact" className="flex flex-wrap items-center gap-2">
            <FeedbackButton
              variant="inline"
              className="rounded-lg px-3 underline-offset-4 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-neutral-800"
            />
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-neutral-600 underline underline-offset-4 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Private contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
