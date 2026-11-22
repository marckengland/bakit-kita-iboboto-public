"use client";

/**
 * Disaster Recovery Dashboard Component
 *
 * Provides admin interface for managing backups, restoration, and monitoring
 * disaster recovery status.
 *
 * Validates: Requirements 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.7
 */

import { useState, useEffect, useCallback } from "react";

interface BackupMetadata {
  id: string;
  type: "full" | "incremental" | "differential";
  status: "pending" | "in_progress" | "completed" | "failed" | "verified";
  createdAt: string;
  completedAt?: string;
  sizeBytes: number;
  checksum: string;
  databases: DatabaseBackupInfo[];
  storageLocations: string[];
  retentionUntil: string;
  isVerified: boolean;
  verifiedAt?: string;
  verificationResult?: BackupVerificationResult;
}

interface DatabaseBackupInfo {
  name: string;
  type: string;
  sizeBytes: number;
  recordCount: number;
  checksum: string;
  backupPath: string;
}

interface BackupVerificationResult {
  success: boolean;
  testedAt: string;
  restorationTimeMs: number;
  dataIntegrityCheck: boolean;
  recordCountMatch: boolean;
  checksumMatch: boolean;
  errors: string[];
}

interface BackupSchedule {
  id: string;
  name: string;
  type: string;
  cronExpression: string;
  isActive: boolean;
  lastRun?: string;
  nextRun: string;
  databases: string[];
  storageLocations: string[];
}

interface DisasterRecoveryAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  type: string;
  message: string;
  createdAt: string;
  acknowledged: boolean;
}

interface DisasterRecoveryStatus {
  lastBackup?: BackupMetadata;
  lastVerification?: BackupVerificationResult;
  rpoCompliance: boolean;
  rtoEstimate: number;
  backupCount: number;
  totalStorageBytes: number;
  storageByRegion: Record<string, number>;
  activeSchedules: BackupSchedule[];
  alerts: DisasterRecoveryAlert[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default function DisasterRecoveryDashboard() {
  const [status, setStatus] = useState<DisasterRecoveryStatus | null>(null);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [alerts, setAlerts] = useState<DisasterRecoveryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "backups" | "schedules" | "alerts">(
    "overview"
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, backupsRes, schedulesRes, alertsRes] = await Promise.all([
        fetch("/api/admin/disaster-recovery?action=status"),
        fetch("/api/admin/disaster-recovery?action=backups&limit=10"),
        fetch("/api/admin/disaster-recovery?action=schedules"),
        fetch("/api/admin/disaster-recovery?action=alerts"),
      ]);

      const [statusData, backupsData, schedulesData, alertsData] = await Promise.all([
        statusRes.json(),
        backupsRes.json(),
        schedulesRes.json(),
        alertsRes.json(),
      ]);

      if (statusData.success) {
        setStatus(statusData.data);
      }
      if (backupsData.success) {
        setBackups(backupsData.data);
      }
      if (schedulesData.success) {
        setSchedules(schedulesData.data);
      }
      if (alertsData.success) {
        setAlerts(alertsData.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCreateBackup = async () => {
    try {
      setActionLoading("backup");
      const res = await fetch("/api/admin/disaster-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup", type: "full" }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyBackup = async (backupId: string) => {
    try {
      setActionLoading(`verify-${backupId}`);
      const res = await fetch("/api/admin/disaster-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", backupId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify backup");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      setActionLoading(`ack-${alertId}`);
      const res = await fetch("/api/admin/disaster-recovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge-alert", id: alertId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acknowledge alert");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInitSchedules = async () => {
    try {
      setActionLoading("init-schedules");
      const res = await fetch("/api/admin/disaster-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init-schedules" }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize schedules");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disaster Recovery</h1>
          <p className="text-gray-600">Manage backups, restoration, and recovery procedures</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={actionLoading === "backup"}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionLoading === "backup" ? "Creating..." : "Create Backup"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">
            ×
          </button>
        </div>
      )}

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* RPO Compliance */}
          <div
            className={`rounded-lg border p-4 ${
              status.rpoCompliance ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
            }`}
          >
            <div className="text-sm font-medium text-gray-600">RPO Compliance</div>
            <div
              className={`text-2xl font-bold ${
                status.rpoCompliance ? "text-green-700" : "text-red-700"
              }`}
            >
              {status.rpoCompliance ? "✓ Compliant" : "✗ Non-Compliant"}
            </div>
            <div className="text-xs text-gray-500">Target: 24 hours</div>
          </div>

          {/* RTO Estimate */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-medium text-gray-600">RTO Estimate</div>
            <div className="text-2xl font-bold text-blue-700">
              {formatDuration(status.rtoEstimate)}
            </div>
            <div className="text-xs text-gray-500">Target: 4 hours</div>
          </div>

          {/* Total Backups */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-medium text-gray-600">Total Backups</div>
            <div className="text-2xl font-bold text-gray-900">{status.backupCount}</div>
            <div className="text-xs text-gray-500">
              {formatBytes(status.totalStorageBytes)} total
            </div>
          </div>

          {/* Active Alerts */}
          <div
            className={`rounded-lg border p-4 ${
              status.alerts.length > 0
                ? "border-yellow-200 bg-yellow-50"
                : "border-green-200 bg-green-50"
            }`}
          >
            <div className="text-sm font-medium text-gray-600">Active Alerts</div>
            <div
              className={`text-2xl font-bold ${
                status.alerts.length > 0 ? "text-yellow-700" : "text-green-700"
              }`}
            >
              {status.alerts.length}
            </div>
            <div className="text-xs text-gray-500">
              {status.alerts.filter((a) => a.severity === "critical").length} critical
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(["overview", "backups", "schedules", "alerts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && status && (
        <div className="space-y-6">
          {/* Last Backup Info */}
          {status.lastBackup && (
            <div className="rounded-lg border bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold">Last Backup</h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-sm text-gray-500">ID</div>
                  <div className="font-mono text-sm">{status.lastBackup.id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div
                    className={`inline-flex rounded px-2 py-1 text-sm ${
                      status.lastBackup.status === "verified"
                        ? "bg-green-100 text-green-800"
                        : status.lastBackup.status === "completed"
                          ? "bg-blue-100 text-blue-800"
                          : status.lastBackup.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {status.lastBackup.status}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Size</div>
                  <div>{formatBytes(status.lastBackup.sizeBytes)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Created</div>
                  <div>{formatDate(status.lastBackup.createdAt)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Storage Distribution */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Storage Distribution</h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(status.storageByRegion).map(([region, bytes]) => (
                <div key={region} className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{formatBytes(bytes)}</div>
                  <div className="text-sm text-gray-500 capitalize">{region}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "backups" && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {backups.map((backup) => (
                <tr key={backup.id}>
                  <td className="px-6 py-4 font-mono text-sm whitespace-nowrap">
                    {backup.id.substring(0, 20)}...
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">{backup.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded px-2 py-1 text-xs ${
                        backup.status === "verified"
                          ? "bg-green-100 text-green-800"
                          : backup.status === "completed"
                            ? "bg-blue-100 text-blue-800"
                            : backup.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {backup.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">
                    {formatBytes(backup.sizeBytes)}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">
                    {formatDate(backup.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">
                    {backup.status === "completed" && !backup.isVerified && (
                      <button
                        onClick={() => handleVerifyBackup(backup.id)}
                        disabled={actionLoading === `verify-${backup.id}`}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        {actionLoading === `verify-${backup.id}` ? "Verifying..." : "Verify"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "schedules" && (
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <div className="rounded-lg border bg-white p-6 text-center">
              <p className="mb-4 text-gray-500">No backup schedules configured</p>
              <button
                onClick={handleInitSchedules}
                disabled={actionLoading === "init-schedules"}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading === "init-schedules"
                  ? "Initializing..."
                  : "Initialize Default Schedules"}
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Next Run
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="px-6 py-4 font-medium whitespace-nowrap">{schedule.name}</td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">{schedule.type}</td>
                      <td className="px-6 py-4 font-mono text-sm whitespace-nowrap">
                        {schedule.cronExpression}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded px-2 py-1 text-xs ${
                            schedule.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {schedule.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {formatDate(schedule.nextRun)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "alerts" && (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="rounded-lg border bg-white p-6 text-center">
              <p className="text-gray-500">No active alerts</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border p-4 ${
                  alert.severity === "critical"
                    ? "border-red-200 bg-red-50"
                    : alert.severity === "warning"
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-blue-200 bg-blue-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                          alert.severity === "critical"
                            ? "bg-red-100 text-red-800"
                            : alert.severity === "warning"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">{alert.type}</span>
                    </div>
                    <p className="mt-1 text-gray-900">{alert.message}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatDate(alert.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    disabled={actionLoading === `ack-${alert.id}`}
                    className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {actionLoading === `ack-${alert.id}` ? "..." : "Acknowledge"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
