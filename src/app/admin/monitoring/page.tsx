/**
 * Admin Monitoring Dashboard Page
 * Displays system health, alerts, auto-scaling status, and graceful degradation controls
 *
 * Validates: Requirements 44.5, 44.6, 44.7
 * - 44.5: Auto-scale infrastructure based on traffic demand
 * - 44.6: Monitor performance metrics and alert administrators
 * - 44.7: Gracefully degrade non-critical features under extreme load
 */

import { Suspense } from "react";
import MonitoringDashboard from "./components/MonitoringDashboard";

export const metadata = {
  title: "System Monitoring - Admin Dashboard",
  description: "Monitor system health, performance metrics, and manage auto-scaling",
};

export default function MonitoringPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">System Monitoring</h1>
      <Suspense fallback={<MonitoringLoadingSkeleton />}>
        <MonitoringDashboard />
      </Suspense>
    </div>
  );
}

function MonitoringLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-200" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-gray-200" />
      <div className="h-48 rounded-lg bg-gray-200" />
    </div>
  );
}
