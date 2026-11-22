/**
 * Community Reporting Page
 *
 * Allows users to submit reports about politicians with evidence.
 * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { CommunityReportingContent } from "./components/CommunityReportingContent";
import { CommunityReportingSkeleton } from "./components/CommunityReportingSkeleton";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Mag-ulat | Bakit Kita Iboboto?",
  description:
    "Mag-submit ng ulat tungkol sa mga pulitiko. Tumulong sa transparency sa pamamagitan ng pag-share ng verified na impormasyon.",
};

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    politicianId?: string;
  }>;
}

export default async function ReportPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="container-wide py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Community Reporting
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Tumulong sa transparency sa pamamagitan ng pag-submit ng verified na impormasyon
          </p>
        </div>

        {/* Content */}
        <Suspense fallback={<CommunityReportingSkeleton />}>
          <CommunityReportingContent searchParams={params} />
        </Suspense>
      </div>

      {/* Footer */}
      <Footer dataSourceText="Lahat ng ulat ay susuriin bago i-publish." />
    </main>
  );
}
