/**
 * Upcoming Elections Dashboard Page
 *
 * Displays upcoming elections with calendar view, filed candidates, and deadlines.
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { ElectionsDashboard } from "./components/ElectionsDashboard";
import { ElectionsDashboardSkeleton } from "./components/ElectionsDashboardSkeleton";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Upcoming Elections | Bakit Kita Iboboto?",
  description:
    "View upcoming Philippine elections, filed candidates, and important election deadlines. Prepare for voting day.",
};

interface PageProps {
  searchParams: Promise<{
    level?: string;
    type?: string;
    jurisdiction?: string;
    year?: string;
    view?: "calendar" | "list";
  }>;
}

export default async function ElectionsPage({ searchParams }: PageProps) {
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
            Upcoming Elections
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Tingnan ang mga darating na eleksyon, mga kandidato, at mahahalagang petsa
          </p>
        </div>

        {/* Dashboard */}
        <Suspense fallback={<ElectionsDashboardSkeleton />}>
          <ElectionsDashboard searchParams={params} />
        </Suspense>
      </div>

      {/* Footer */}
      <Footer dataSourceText="Data sourced from COMELEC official records." />
    </main>
  );
}
