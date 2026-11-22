/**
 * Civic Education Section Page
 *
 * Educational content about Philippine government structure, legislative process,
 * and political glossary for voters, especially first-time voters.
 * Supports Filipino and English translations.
 *
 * Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 27.1, 27.4
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { CivicEducationContent } from "./components/CivicEducationContent";
import { CivicEducationSkeleton } from "./components/CivicEducationSkeleton";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Learn About Philippine Government | Bakit Kita Iboboto?",
  description:
    "Learn how Philippine government works. Understand government structure, legislative process, election requirements, and political terms in Filipino and English.",
};

interface PageProps {
  searchParams: Promise<{
    section?: string;
    term?: string;
  }>;
}

export default async function LearnPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = await getTranslations("learn");

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="container-wide py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t("title")}</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t("description")}</p>
        </div>

        {/* Content */}
        <Suspense fallback={<CivicEducationSkeleton />}>
          <CivicEducationContent searchParams={params} />
        </Suspense>
      </div>

      {/* Footer */}
      <Footer />
    </main>
  );
}
