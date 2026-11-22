"use client";

/**
 * Monitoring Dashboard Component
 * Real-time system health monitoring with alerts and controls
 *
 * Validates: Requirements 44.5, 44.6, 44.7
 */

import { useState, useEffect, useCallback } from "react";

interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  metrics: {
    responseTime: number;
    concurrentUsers: number;
    cpuUsage: number;
    memoryUsage: number;
    errorRate: number;
    cacheHitRate: number;
    dbPoolUsage: number;
  };
  activeAlerts: Alert[];
  degradedFeatures: string[];
  lastUpdated: number;
}

interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  type: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  acknowledged: boolean;
}

interface DegradationState {
  enabled: boolean;
  degradedFeatures: string[];
  reason: string;
  triggeredAt: number;
  availableFeatures: string[];
}

interface ScalingInfo {
  currentInstances: number;
  lastDecision: {
    action: string;
    reason: string;
    timestamp: number;
  };
  config: {
    MIN_INSTANCES: number;
    MAX_INSTANCES: number;
  };
}

export default function MonitoringDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [degradation, setDegradation] = useState<DegradationState | null>(null);
  const [scaling, setScaling] = useState<ScalingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(10000); // 10 seconds

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, degradationRes, scalingRes] = await Promise.all([
        fetch("/api/admin/monitoring?view=health"),
        fetch("/api/admin/monitoring?view=degradation"),
        fetch("/api/admin/monitoring?view=scaling"),
      ]);

      const [healthData, degradationData, scalingData] = await Promise.all([
        healthRes.json(),
        degradationRes.json(),
        scalingRes.json(),
      ]);

      if (healthData.success) {
        setHealth(healthData.data);
      }
      if (degradationData.success) {
        setDegradation(degradationData.data);
      }
      if (scalingData.success) {
        setScaling(scalingData.data);
      }

      setError(null);
    } catch (err) {
      setError("Failed to fetch monitoring data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch("/api/admin/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acknowledge_alert",
          alertId,
          acknowledgedBy: "admin", // In production, use actual admin ID
        }),
      });
      if ((await res.json()).success) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const toggleDegradation = async (enable: boolean) => {
    try {
      const res = await fetch("/api/admin/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: enable ? "enable_degradation" : "disable_degradation",
          triggerMetric: "cpu_usage", // Default trigger
        }),
      });
      if ((await res.json()).success) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to toggle degradation:", err);
    }
  };

  const setInstances = async (count: number) => {
    try {
      const res = await fetch("/api/admin/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_instances",
          count,
        }),
      });
      if ((await res.json()).success) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to set instances:", err);
    }
  };

  if (loading) {
    return <div className="py-8 text-center">Loading monitoring data...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
        <button onClick={fetchData} className="ml-4 text-sm underline hover:no-underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Last updated: {health ? new Date(health.lastUpdated).toLocaleTimeString() : "N/A"}
        </div>
        <div className="flex items-center gap-4">
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
          </select>
          <button
            onClick={fetchData}
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* System Status Banner */}
      {health && (
        <div
          className={`rounded-lg p-4 ${
            health.status === "healthy"
              ? "border border-green-200 bg-green-50"
              : health.status === "degraded"
                ? "border border-yellow-200 bg-yellow-50"
                : "border border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                health.status === "healthy"
                  ? "bg-green-500"
                  : health.status === "degraded"
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <span className="font-semibold capitalize">{health.status}</span>
            {health.degradedFeatures.length > 0 && (
              <span className="text-sm text-gray-600">
                ({health.degradedFeatures.length} features degraded)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {health && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="Response Time"
            value={`${health.metrics.responseTime}ms`}
            threshold={3000}
            currentValue={health.metrics.responseTime}
            unit="ms"
          />
          <MetricCard
            label="Concurrent Users"
            value={health.metrics.concurrentUsers.toLocaleString()}
            threshold={100000}
            currentValue={health.metrics.concurrentUsers}
          />
          <MetricCard
            label="CPU Usage"
            value={`${health.metrics.cpuUsage}%`}
            threshold={85}
            currentValue={health.metrics.cpuUsage}
            unit="%"
          />
          <MetricCard
            label="Memory Usage"
            value={`${health.metrics.memoryUsage}%`}
            threshold={90}
            currentValue={health.metrics.memoryUsage}
            unit="%"
          />
          <MetricCard
            label="Error Rate"
            value={`${health.metrics.errorRate}%`}
            threshold={5}
            currentValue={health.metrics.errorRate}
            unit="%"
            inverse
          />
          <MetricCard
            label="Cache Hit Rate"
            value={`${health.metrics.cacheHitRate}%`}
            threshold={50}
            currentValue={health.metrics.cacheHitRate}
            unit="%"
            inverse
          />
          <MetricCard
            label="DB Pool Usage"
            value={`${health.metrics.dbPoolUsage}%`}
            threshold={90}
            currentValue={health.metrics.dbPoolUsage}
            unit="%"
          />
          <MetricCard
            label="Instances"
            value={scaling?.currentInstances.toString() || "N/A"}
            threshold={scaling?.config.MAX_INSTANCES || 20}
            currentValue={scaling?.currentInstances || 0}
          />
        </div>
      )}

      {/* Active Alerts */}
      {health && health.activeAlerts.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold">
            Active Alerts ({health.activeAlerts.length})
          </h2>
          <div className="space-y-2">
            {health.activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between rounded p-3 ${
                  alert.severity === "critical"
                    ? "border-l-4 border-red-500 bg-red-50"
                    : alert.severity === "warning"
                      ? "border-l-4 border-yellow-500 bg-yellow-50"
                      : "border-l-4 border-blue-500 bg-blue-50"
                }`}
              >
                <div>
                  <span className="font-medium">{alert.message}</span>
                  <div className="text-sm text-gray-500">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graceful Degradation Controls */}
      {degradation && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold">Graceful Degradation</h2>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="font-medium">Status: </span>
              <span className={degradation.enabled ? "text-yellow-600" : "text-green-600"}>
                {degradation.enabled ? "Enabled" : "Disabled"}
              </span>
              {degradation.enabled && degradation.reason && (
                <div className="text-sm text-gray-500">{degradation.reason}</div>
              )}
            </div>
            <button
              onClick={() => toggleDegradation(!degradation.enabled)}
              className={`rounded px-4 py-2 ${
                degradation.enabled
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-yellow-500 text-white hover:bg-yellow-600"
              }`}
            >
              {degradation.enabled ? "Disable Degradation" : "Enable Degradation"}
            </button>
          </div>
          {degradation.degradedFeatures.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Degraded Features:</h3>
              <div className="flex flex-wrap gap-2">
                {degradation.degradedFeatures.map((feature) => (
                  <span
                    key={feature}
                    className="rounded bg-yellow-100 px-2 py-1 text-sm text-yellow-800"
                  >
                    {feature.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-Scaling Controls */}
      {scaling && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold">Auto-Scaling</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm text-gray-500">Current Instances</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInstances(scaling.currentInstances - 1)}
                  disabled={scaling.currentInstances <= scaling.config.MIN_INSTANCES}
                  className="rounded bg-gray-100 px-3 py-1 hover:bg-gray-200 disabled:opacity-50"
                >
                  -
                </button>
                <span className="w-12 text-center text-2xl font-bold">
                  {scaling.currentInstances}
                </span>
                <button
                  onClick={() => setInstances(scaling.currentInstances + 1)}
                  disabled={scaling.currentInstances >= scaling.config.MAX_INSTANCES}
                  className="rounded bg-gray-100 px-3 py-1 hover:bg-gray-200 disabled:opacity-50"
                >
                  +
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-400">
                Min: {scaling.config.MIN_INSTANCES} / Max: {scaling.config.MAX_INSTANCES}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-gray-500">Last Scaling Decision</div>
              <div className="text-sm">
                <span className="font-medium capitalize">
                  {scaling.lastDecision.action.replace(/_/g, " ")}
                </span>
                <div className="text-gray-500">{scaling.lastDecision.reason}</div>
                <div className="text-xs text-gray-400">
                  {new Date(scaling.lastDecision.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  threshold: number;
  currentValue: number;
  unit?: string;
  inverse?: boolean;
}

function MetricCard({ label, value, threshold, currentValue, inverse }: MetricCardProps) {
  const percentage = inverse ? (currentValue / threshold) * 100 : (currentValue / threshold) * 100;

  const isWarning = inverse ? percentage < 70 : percentage > 70;
  const isCritical = inverse ? percentage < 50 : percentage > 85;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-1 text-sm text-gray-500">{label}</div>
      <div
        className={`text-2xl font-bold ${isCritical ? "text-red-600" : isWarning ? "text-yellow-600" : "text-green-600"}`}
      >
        {value}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full transition-all ${isCritical ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-green-500"}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
