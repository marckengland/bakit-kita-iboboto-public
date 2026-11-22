/**
 * Skip to Content Link
 *
 * Provides a skip link for keyboard users to bypass navigation
 * and jump directly to the main content area.
 *
 * This is a WCAG 2.1 AA requirement for keyboard accessibility.
 *
 * Requirements: 27.5
 */

"use client";

import { useTranslations } from "next-intl";

interface SkipToContentProps {
  targetId?: string;
  className?: string;
}

export function SkipToContent({ targetId = "main-content", className = "" }: SkipToContentProps) {
  const t = useTranslations("accessibility");

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={`bg-primary-500 focus-visible:ring-offset-primary-500 fixed top-4 left-4 z-[100] -translate-y-full rounded-lg px-4 py-2 text-sm font-medium text-white opacity-0 transition-all focus:translate-y-0 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none ${className}`}
    >
      {t("skipToContent")}
    </a>
  );
}

export default SkipToContent;
