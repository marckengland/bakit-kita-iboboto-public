/**
 * Admin Data Freshness Dashboard Page
 *
 * Dashboard for administrators to monitor data freshness,
 * view scrape job status, and trigger manual scrapes.
 *
 * Requirements: 20.8, 20.9
 */

import { Metadata } from "next";
import { DataFreshnessDashboard } from "./components/DataFreshnessDashboard";

export const metadata: Metadata = {
  title: "Data Freshness Dashboard",
  description: "Monitor data freshness and manage scrape jobs",
};

export default function AdminDataFreshnessPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Freshness Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Monitor data freshness, view scrape job status, and trigger manual data updates.
          </p>
        </div>
        <DataFreshnessDashboard />
      </div>
    </main>
  );
}
