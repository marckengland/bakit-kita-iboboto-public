/**
 * Admin Audit Log Viewer Page
 *
 * Dashboard for Auditors to view and search audit logs,
 * verify chain integrity, and view modification history.
 *
 * Requirements: 36.6, 36.7, 36.10, 39.5
 */

import { Metadata } from "next";
import { AuditLogViewer } from "./components/AuditLogViewer";

export const metadata: Metadata = {
  title: "Audit Log Viewer",
  description: "View and verify blockchain-based audit logs",
};

export default function AdminAuditLogPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Log Viewer</h1>
          <p className="mt-2 text-gray-600">
            View modification history and verify blockchain audit chain integrity.
          </p>
        </div>
        <AuditLogViewer />
      </div>
    </main>
  );
}
