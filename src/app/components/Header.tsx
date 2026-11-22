/**
 * Shared Header Component
 *
 * Reusable header with logo, navigation, theme toggle, accessibility settings,
 * and language switcher. Used across all pages for consistency.
 */

"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./ThemeToggle";
import { AccessibilitySettings } from "./AccessibilitySettings";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  /** Optional back link to show before other controls */
  backLink?: {
    href: string;
    label: string;
  };
  /** Whether to show the login button */
  showLogin?: boolean;
  /** Whether to show the get started button */
  showGetStarted?: boolean;
  /** Custom right-side content */
  rightContent?: React.ReactNode;
}

export function Header({
  backLink,
  showLogin = true,
  showGetStarted = true,
  rightContent,
}: HeaderProps) {
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = [
    { href: "/politicians", label: tNav("browse") },
    { href: "/compare", label: tNav("compare") },
    { href: "/bookmarks", label: tNav("saved") },
  ];

  return (
    <header
      className="relative z-40 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="container-wide py-4">
        <nav
          className="flex items-center justify-between gap-4"
          aria-label={tNav("primaryNavigation")}
        >
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label={tCommon("appName")}
          >
            <div
              className="bg-primary-500 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              aria-hidden="true"
            >
              <span className="text-xl font-bold text-white">B</span>
            </div>
            <span className="text-primary-500 text-sm font-bold sm:text-lg">
              {tCommon("appName")}
            </span>
          </Link>
          <div className="hidden items-center gap-5 xl:flex">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-primary-500 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 xl:flex">
              <AccessibilitySettings />
              <LanguageSwitcher />
              {rightContent}
              {showLogin && (
                <Link href="/auth/login" className="btn-outline">
                  {tCommon("login")}
                </Link>
              )}
              {showGetStarted && (
                <Link href="/politicians" className="btn-primary">
                  {tCommon("getStarted")}
                </Link>
              )}
            </div>
            <button
              ref={menuButton}
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-300 xl:hidden dark:border-neutral-700"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label={tNav("menu")}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={menuOpen ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div
            id="site-menu"
            className="mt-4 space-y-4 border-t border-neutral-200 pt-4 xl:hidden dark:border-neutral-800"
          >
            <nav aria-label={tNav("primaryNavigation")} className="flex flex-col gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="hover:bg-primary-50 rounded-lg px-3 py-3 font-medium dark:hover:bg-neutral-800"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitcher align="start" />
              <AccessibilitySettings placement="viewport" />
              {showLogin && (
                <Link href="/auth/login" className="btn-outline">
                  {tCommon("login")}
                </Link>
              )}
              {rightContent}
            </div>
          </div>
        )}
        {backLink && (
          <Link
            href={backLink.href}
            className="hover:text-primary-500 mt-3 inline-block py-2 text-sm text-neutral-600 dark:text-neutral-400"
          >
            ← {backLink.label}
          </Link>
        )}
      </div>
    </header>
  );
}
