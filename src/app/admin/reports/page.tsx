/**
 * Admin Community Report Moderation Page
 *
 * Dashboard for Content Moderators to review and moderate community reports.
 * Implements moderation queue, verification tools, and publish/reject workflow.
 *
 * Requirements: 28.2, 28.3, 28.4, 28.5, 28.7, 39.3
 */

import { Metadata } from "next";
import { ReportModerationDashboard } from "./components/ReportModerationDashboard";

export const metadata: Metadata = {
  title: "Community Report Moderation",
  description: "Review and moderate community-submitted reports about politicians",
};

export default function AdminReportsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Community Report Moderation</h1>
          <p className="mt-2 text-gray-600">
            Review community-submitted reports, verify evidence, and publish or reject submissions.
          </p>
        </div>
        <ReportModerationDashboard />
      </div>
    </main>
  );
}
