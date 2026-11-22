/**
 * Politician Directory Page
 *
 * Displays a paginated list of politicians with filters.
 * Supports Filipino and English translations.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 18.8, 27.1, 27.4, 32.7
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PoliticianDirectory } from "./components/PoliticianDirectory";
import { PoliticianDirectorySkeleton } from "./components/PoliticianDirectorySkeleton";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Politician Directory",
  description:
    "Browse all Philippine politicians at national and local levels. Filter by government level, region, party, and position.",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    level?: string;
    region?: string;
    province?: string;
    city?: string;
    party?: string;
    position?: string;
    hasRedFlags?: string;
    q?: string;
  }>;
}

export default async function PoliticiansPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = await getTranslations("politicians");

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="container-wide py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t("title")}</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t("description")}</p>
        </div>

        {/* Directory with Filters */}
        <Suspense fallback={<PoliticianDirectorySkeleton />}>
          <PoliticianDirectory searchParams={params} />
        </Suspense>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
