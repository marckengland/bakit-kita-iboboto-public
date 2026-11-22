/**
 * Comparison Tool Page
 *
 * Allows users to compare politicians side-by-side.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { Suspense } from "react";
import { ComparisonTool } from "./components/ComparisonTool";
import { ComparisonToolSkeleton } from "./components/ComparisonToolSkeleton";
import { Header } from "../components/Header";
import { parseComparisonIds } from "@/lib/comparison-selection";
import { Footer } from "../components/Footer";

export const metadata = {
  title: "Compare Politicians | Bakit Kita Iboboto?",
  description:
    "Compare Philippine politicians side-by-side. View their legislative records, attendance, net worth, and more.",
};

interface ComparePageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { ids } = await searchParams;
  const selectedIds = parseComparisonIds(ids);

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header />

      <div className="container-wide py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Compare Politicians
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Select 2-4 politicians to compare their records side-by-side
          </p>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Counts reflect records in this database. N/A means there is not enough recorded data for
            a rate. Check that offices and reporting periods are comparable.
          </p>
        </div>

        {/* Comparison Tool */}
        <Suspense fallback={<ComparisonToolSkeleton />}>
          <ComparisonTool initialSelectedIds={selectedIds} />
        </Suspense>
      </div>

      {/* Footer */}
      <Footer />
    </main>
  );
}
