/**
 * Audit Log Viewer Component
 *
 * Searchable audit log interface with chain integrity verification.
 * Displays modification history for all data in the system.
 *
 * Requirements: 36.6, 36.7, 36.10, 39.5
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================
// Types
// ============================================

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "verify"
  | "reject"
  | "approve"
  | "login"
  | "logout"
  | "admin_action";

type DataType =
  | "politician"
  | "bill"
  | "controversy"
  | "saln"
  | "project"
  | "user"
  | "admin"
  | "submission"
  | "system";

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorType: "user" | "admin" | "system";
  action: AuditAction;
  dataType: DataType;
  dataId: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

interface ChainVerificationResult {
  isValid: boolean;
  invalidEntryIndex?: number;
  expectedHash?: string;
  actualHash?: string;
  message: string;
}

interface BlockchainAnchor {
  id: string;
  timestamp: string;
  entryCount: number;
  firstEntryId: string;
  lastEntryId: string;
  merkleRoot: string;
  transactionHash?: string;
  blockNumber?: number;
  network: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuditLogFilters {
  action: AuditAction | "";
  dataType: DataType | "";
  actor: string;
  dataId: string;
  startDate: string;
  endDate: string;
}

// ============================================
// Constants
// ============================================

const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete Attempt",
  verify: "Verify",
  reject: "Reject",
  approve: "Approve",
  login: "Login",
  logout: "Logout",
  admin_action: "Admin Action",
};

const DATA_TYPE_LABELS: Record<DataType, string> = {
  politician: "Politician",
  bill: "Bill",
  controversy: "Controversy",
  saln: "SALN",
  project: "Project",
  user: "User",
  admin: "Admin",
  submission: "Submission",
  system: "System",
};

const ACTION_COLORS: Record<AuditAction, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  verify: "bg-purple-100 text-purple-800",
  reject: "bg-orange-100 text-orange-800",
  approve: "bg-emerald-100 text-emerald-800",
  login: "bg-cyan-100 text-cyan-800",
  logout: "bg-gray-100 text-gray-800",
  admin_action: "bg-yellow-100 text-yellow-800",
};

const DATA_TYPE_COLORS: Record<DataType, string> = {
  politician: "bg-indigo-100 text-indigo-800",
  bill: "bg-teal-100 text-teal-800",
  controversy: "bg-rose-100 text-rose-800",
  saln: "bg-violet-100 text-violet-800",
  project: "bg-amber-100 text-amber-800",
  user: "bg-sky-100 text-sky-800",
  admin: "bg-fuchsia-100 text-fuchsia-800",
  submission: "bg-lime-100 text-lime-800",
  system: "bg-slate-100 text-slate-800",
};

// ============================================
// Main Component
// ============================================

export function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    action: "",
    dataType: "",
    actor: "",
    dataId: "",
    startDate: "",
    endDate: "",
  });
  const [verificationResult, setVerificationResult] = useState<ChainVerificationResult | null>(
    null
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [anchors, setAnchors] = useState<BlockchainAnchor[]>([]);
  const [showAnchors, setShowAnchors] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "verification" | "history">("logs");

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.action) {
        params.append("action", filters.action);
      }
      if (filters.dataType) {
        params.append("dataType", filters.dataType);
      }
      if (filters.actor) {
        params.append("actor", filters.actor);
      }
      if (filters.dataId) {
        params.append("dataId", filters.dataId);
      }
      if (filters.startDate) {
        params.append("startDate", filters.startDate);
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate);
      }

      const response = await fetch(`/api/admin/audit-log?${params}`, {
        headers: {
          "x-admin-role": "auditor",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const data = await response.json();
      setEntries(data.entries);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch("/api/admin/audit-log/verify", {
        method: "POST",
        headers: {
          "x-admin-role": "auditor",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to verify chain");
      }

      const result = await response.json();
      setVerificationResult(result);
    } catch (err) {
      setVerificationResult({
        isValid: false,
        message: err instanceof Error ? err.message : "Verification failed",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchAnchors = async () => {
    try {
      const response = await fetch("/api/admin/audit-log/anchors", {
        headers: {
          "x-admin-role": "auditor",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAnchors(data.anchors);
      }
    } catch (err) {
      console.error("Failed to fetch anchors:", err);
    }
  };

  useEffect(() => {
    if (showAnchors) {
      fetchAnchors();
    }
  }, [showAnchors]);

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      action: "",
      dataType: "",
      actor: "",
      dataId: "",
      startDate: "",
      endDate: "",
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  // Stats calculation
  const stats = {
    total: pagination.total,
    creates: entries.filter((e) => e.action === "create").length,
    updates: entries.filter((e) => e.action === "update").length,
    adminActions: entries.filter((e) => e.action === "admin_action").length,
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("logs")}
            className={`border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === "logs"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab("verification")}
            className={`border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === "verification"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Chain Verification
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === "history"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Modification History
          </button>
        </nav>
      </div>

      {activeTab === "logs" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard title="Total Entries" value={stats.total} color="blue" />
            <StatCard title="Creates" value={stats.creates} color="green" />
            <StatCard title="Updates" value={stats.updates} color="yellow" />
            <StatCard title="Admin Actions" value={stats.adminActions} color="purple" />
          </div>

          {/* Filters */}
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Action</label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Actions</option>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Data Type</label>
                <select
                  value={filters.dataType}
                  onChange={(e) => handleFilterChange("dataType", e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  {Object.entries(DATA_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Actor</label>
                <input
                  type="text"
                  value={filters.actor}
                  onChange={(e) => handleFilterChange("actor", e.target.value)}
                  placeholder="Search by actor..."
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Data ID</label>
                <input
                  type="text"
                  value={filters.dataId}
                  onChange={(e) => handleFilterChange("dataId", e.target.value)}
                  placeholder="Search by data ID..."
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="datetime-local"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="datetime-local"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            {isLoading ? (
              <div className="p-8 text-center">
                <LoadingSpinner className="mx-auto h-8 w-8 text-blue-500" />
                <p className="mt-2 text-gray-500">Loading audit logs...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <p className="text-red-600">{error}</p>
                <button
                  onClick={fetchAuditLogs}
                  className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                >
                  Retry
                </button>
              </div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center">
                <DocumentIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="text-gray-500">No audit entries found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Data Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Actor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Data ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Hash
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                          {formatDate(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${ACTION_COLORS[entry.action]}`}
                          >
                            {ACTION_LABELS[entry.action]}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${DATA_TYPE_COLORS[entry.dataType]}`}
                          >
                            {DATA_TYPE_LABELS[entry.dataType]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-600">
                          <div className="flex items-center gap-1">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                entry.actorType === "admin"
                                  ? "bg-purple-500"
                                  : entry.actorType === "system"
                                    ? "bg-gray-500"
                                    : "bg-blue-500"
                              }`}
                            />
                            {entry.actor}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm whitespace-nowrap text-gray-600">
                          {entry.dataId.length > 20
                            ? `${entry.dataId.slice(0, 20)}...`
                            : entry.dataId}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm whitespace-nowrap text-gray-500">
                          {truncateHash(entry.hash)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} entries
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "verification" && (
        <ChainVerificationPanel
          verificationResult={verificationResult}
          isVerifying={isVerifying}
          onVerify={handleVerifyChain}
          anchors={anchors}
          showAnchors={showAnchors}
          onToggleAnchors={() => setShowAnchors(!showAnchors)}
        />
      )}

      {activeTab === "history" && <ModificationHistoryPanel filters={filters} />}

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <AuditEntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}

// ============================================
// Sub-Components
// ============================================

interface StatCardProps {
  title: string;
  value: number;
  color: "blue" | "green" | "yellow" | "purple";
}

function StatCard({ title, value, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

interface ChainVerificationPanelProps {
  verificationResult: ChainVerificationResult | null;
  isVerifying: boolean;
  onVerify: () => void;
  anchors: BlockchainAnchor[];
  showAnchors: boolean;
  onToggleAnchors: () => void;
}

function ChainVerificationPanel({
  verificationResult,
  isVerifying,
  onVerify,
  anchors,
  showAnchors,
  onToggleAnchors,
}: ChainVerificationPanelProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Verification Tool */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Chain Integrity Verification</h3>
        <p className="mb-4 text-gray-600">
          Verify the integrity of the audit log chain by recomputing all cryptographic hashes and
          checking the chain linkage. This ensures no entries have been tampered with.
        </p>

        <button
          onClick={onVerify}
          disabled={isVerifying}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isVerifying ? (
            <>
              <LoadingSpinner className="h-5 w-5" />
              Verifying Chain...
            </>
          ) : (
            <>
              <ShieldIcon className="h-5 w-5" />
              Verify Chain Integrity
            </>
          )}
        </button>

        {verificationResult && (
          <div
            className={`mt-6 rounded-lg p-4 ${
              verificationResult.isValid
                ? "border border-green-200 bg-green-50"
                : "border border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-start gap-3">
              {verificationResult.isValid ? (
                <CheckCircleIcon className="h-6 w-6 flex-shrink-0 text-green-600" />
              ) : (
                <XCircleIcon className="h-6 w-6 flex-shrink-0 text-red-600" />
              )}
              <div>
                <h4
                  className={`font-semibold ${
                    verificationResult.isValid ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {verificationResult.isValid
                    ? "Chain Integrity Verified"
                    : "Chain Integrity Failed"}
                </h4>
                <p
                  className={`mt-1 ${
                    verificationResult.isValid ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {verificationResult.message}
                </p>
                {!verificationResult.isValid &&
                  verificationResult.invalidEntryIndex !== undefined && (
                    <div className="mt-3 text-sm text-red-600">
                      <p>Invalid entry at index: {verificationResult.invalidEntryIndex}</p>
                      {verificationResult.expectedHash && (
                        <p className="mt-1 font-mono">
                          Expected: {verificationResult.expectedHash}
                        </p>
                      )}
                      {verificationResult.actualHash && (
                        <p className="font-mono">Actual: {verificationResult.actualHash}</p>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Blockchain Anchors */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Blockchain Anchors</h3>
          <button
            onClick={onToggleAnchors}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {showAnchors ? "Hide Anchors" : "Show Anchors"}
          </button>
        </div>
        <p className="mb-4 text-gray-600">
          Audit log hashes are periodically anchored to the Polygon blockchain for external
          verification.
        </p>

        {showAnchors && (
          <div className="space-y-3">
            {anchors.length === 0 ? (
              <p className="py-4 text-center text-gray-500">No blockchain anchors yet</p>
            ) : (
              anchors.map((anchor) => (
                <div key={anchor.id} className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Anchor {anchor.id}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {anchor.entryCount} entries anchored
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(anchor.timestamp)}</p>
                    </div>
                    <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                      {anchor.network}
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-xs text-gray-500">
                    <p>Merkle Root: {anchor.merkleRoot.slice(0, 32)}...</p>
                    {anchor.transactionHash && <p className="mt-1">Tx: {anchor.transactionHash}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModificationHistoryPanelProps {
  filters: AuditLogFilters;
}

function ModificationHistoryPanel({ filters }: ModificationHistoryPanelProps) {
  const [dataId, setDataId] = useState(filters.dataId);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!dataId.trim()) {
      setError("Please enter a Data ID to view history");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/audit-log/history/${encodeURIComponent(dataId)}`, {
        headers: {
          "x-admin-role": "auditor",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch modification history");
      }

      const data = await response.json();
      setHistory(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">View Modification History</h3>
        <p className="mb-4 text-gray-600">
          Enter a Data ID to view the complete modification history for that record.
        </p>

        <div className="flex gap-4">
          <input
            type="text"
            value={dataId}
            onChange={(e) => setDataId(e.target.value)}
            placeholder="Enter Data ID (e.g., politician-123)"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "View History"}
          </button>
        </div>

        {error && <p className="mt-4 text-red-600">{error}</p>}
      </div>

      {history.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h4 className="font-semibold text-gray-900">Modification History for: {dataId}</h4>
            <p className="text-sm text-gray-500">{history.length} modifications found</p>
          </div>

          <div className="divide-y divide-gray-200">
            {history.map((entry, index) => (
              <div key={entry.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        entry.action === "create"
                          ? "bg-green-100"
                          : entry.action === "update"
                            ? "bg-blue-100"
                            : entry.action === "delete"
                              ? "bg-red-100"
                              : "bg-gray-100"
                      }`}
                    >
                      {entry.action === "create" ? (
                        <PlusIcon className="h-4 w-4 text-green-600" />
                      ) : entry.action === "update" ? (
                        <PencilIcon className="h-4 w-4 text-blue-600" />
                      ) : entry.action === "delete" ? (
                        <TrashIcon className="h-4 w-4 text-red-600" />
                      ) : (
                        <DocumentIcon className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{ACTION_LABELS[entry.action]}</p>
                      <p className="text-sm text-gray-500">
                        by {entry.actor} ({entry.actorType})
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">{formatDate(entry.timestamp)}</p>
                    <p className="font-mono text-xs text-gray-500">{entry.hash.slice(0, 16)}...</p>
                  </div>
                </div>

                {/* Show changes */}
                {entry.action === "update" && entry.previousValue && entry.newValue && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="mb-1 text-xs font-medium text-red-700">Previous Value</p>
                      <pre className="overflow-x-auto text-xs text-red-600">
                        {JSON.stringify(entry.previousValue, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="mb-1 text-xs font-medium text-green-700">New Value</p>
                      <pre className="overflow-x-auto text-xs text-green-600">
                        {JSON.stringify(entry.newValue, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {entry.action === "create" && entry.newValue && (
                  <div className="mt-3 rounded-lg bg-green-50 p-3">
                    <p className="mb-1 text-xs font-medium text-green-700">Created Value</p>
                    <pre className="overflow-x-auto text-xs text-green-600">
                      {JSON.stringify(entry.newValue, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Timeline connector */}
                {index < history.length - 1 && (
                  <div className="mt-2 ml-4 h-4 border-l-2 border-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface AuditEntryDetailModalProps {
  entry: AuditEntry;
  onClose: () => void;
}

function AuditEntryDetailModal({ entry, onClose }: AuditEntryDetailModalProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Audit Entry Details</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Meta Info */}
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${ACTION_COLORS[entry.action]}`}
            >
              {ACTION_LABELS[entry.action]}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${DATA_TYPE_COLORS[entry.dataType]}`}
            >
              {DATA_TYPE_LABELS[entry.dataType]}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                entry.actorType === "admin"
                  ? "bg-purple-100 text-purple-800"
                  : entry.actorType === "system"
                    ? "bg-gray-100 text-gray-800"
                    : "bg-blue-100 text-blue-800"
              }`}
            >
              {entry.actorType}
            </span>
          </div>

          {/* Entry Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Entry ID</p>
              <p className="font-mono text-sm text-gray-900">{entry.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Timestamp</p>
              <p className="text-gray-900">{formatDate(entry.timestamp)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Actor</p>
              <p className="text-gray-900">{entry.actor}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Data ID</p>
              <p className="font-mono text-sm text-gray-900">{entry.dataId}</p>
            </div>
          </div>

          {/* Hash Info */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="mb-3 text-sm font-medium text-gray-700">Cryptographic Hashes</h4>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Entry Hash</p>
                <p className="font-mono text-sm break-all text-gray-900">{entry.hash}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Previous Hash</p>
                <p className="font-mono text-sm break-all text-gray-900">{entry.previousHash}</p>
              </div>
            </div>
          </div>

          {/* Previous Value */}
          {entry.previousValue && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Previous Value</h4>
              <div className="overflow-x-auto rounded-lg bg-red-50 p-4">
                <pre className="text-sm whitespace-pre-wrap text-red-700">
                  {JSON.stringify(entry.previousValue, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* New Value */}
          {entry.newValue && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">New Value</h4>
              <div className="overflow-x-auto rounded-lg bg-green-50 p-4">
                <pre className="text-sm whitespace-pre-wrap text-green-700">
                  {JSON.stringify(entry.newValue, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Metadata */}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Metadata</h4>
              <div className="overflow-x-auto rounded-lg bg-gray-50 p-4">
                <pre className="text-sm whitespace-pre-wrap text-gray-700">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
