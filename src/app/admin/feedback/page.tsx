/**
 * Admin Feedback Dashboard Page
 *
 * Dashboard for administrators to review and manage user feedback.
 *
 * Requirements: 43.5
 */

import { Metadata } from "next";
import { FeedbackDashboard } from "./components/FeedbackDashboard";

export const metadata: Metadata = {
  title: "Feedback Dashboard",
  description: "Review and manage user feedback submissions",
};

export default function AdminFeedbackPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Feedback Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Review and manage user feedback, bug reports, and feature suggestions.
          </p>
        </div>
        <FeedbackDashboard />
      </div>
    </main>
  );
}
