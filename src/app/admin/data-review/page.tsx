/**
 * Admin Data Review Dashboard Page
 *
 * Dashboard for Data Reviewers to review AI verification decisions
 * and manually verify data submissions.
 *
 * Requirements: 35.8, 35.9, 39.4
 */

import { Metadata } from "next";
import { DataReviewDashboard } from "./components/DataReviewDashboard";

export const metadata: Metadata = {
  title: "Data Review Dashboard",
  description: "Review AI verification decisions and manually verify data submissions",
};

export default function AdminDataReviewPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Review Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Review AI verification decisions and manually verify data submissions.
          </p>
        </div>
        <DataReviewDashboard />
      </div>
    </main>
  );
}
