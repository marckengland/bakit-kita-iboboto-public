/**
 * Performance Monitoring Service
 * Implements monitoring, alerting, and graceful degradation
 *
 * Validates: Requirements 44.1, 44.2, 44.5, 44.6, 44.7
 * - 44.1: Load pages within 3 seconds under normal conditions
 * - 44.2: Support at least 100,000 concurrent users during peak election periods
 * - 44.5: Auto-scale infrastructure based on traffic demand
 * - 44.6: Monitor performance metrics and alert administrators when thresholds are exceeded
 * - 44.7: Gracefully degrade non-critical features under extreme load
 */

import { redis, cache } from "./redis";
import { logger } from "./logger";

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  // Response time thresholds (milliseconds)
  RESPONSE_TIME_WARNING: 2000, // 2 seconds - warning
  RESPONSE_TIME_CRITICAL: 3000, // 3 seconds - critical (Req 44.1)

  // Concurrent users thresholds
  CONCURRENT_USERS_WARNING: 80000, // 80% of max capacity
  CONCURRENT_USERS_CRITICAL: 100000, // Max capacity (Req 44.2)

  // CPU usage thresholds (percentage)
  CPU_WARNING: 70,
  CPU_CRITICAL: 85,

  // Memory usage thresholds (percentage)
  MEMORY_WARNING: 75,
  MEMORY_CRITICAL: 90,

  // Error rate thresholds (percentage)
  ERROR_RATE_WARNING: 1,
  ERROR_RATE_CRITICAL: 5,

  // Cache hit rate thresholds (percentage)
  CACHE_HIT_RATE_WARNING: 70,
  CACHE_HIT_RATE_CRITICAL: 50,

  // Database connection pool thresholds (percentage)
  DB_POOL_WARNING: 70,
  DB_POOL_CRITICAL: 90,
} as const;

// Auto-scaling configuration
export const AUTO_SCALING_CONFIG = {
  // Minimum and maximum instances
  MIN_INSTANCES: 2,
  MAX_INSTANCES: 20,

  // Scale-up thresholds
  SCALE_UP_CPU_THRESHOLD: 70,
  SCALE_UP_MEMORY_THRESHOLD: 75,
  SCALE_UP_RESPONSE_TIME_THRESHOLD: 2000,
  SCALE_UP_CONCURRENT_USERS_THRESHOLD: 50000,

  // Scale-down thresholds
  SCALE_DOWN_CPU_THRESHOLD: 30,
  SCALE_DOWN_MEMORY_THRESHOLD: 40,
  SCALE_DOWN_RESPONSE_TIME_THRESHOLD: 500,

  // Cooldown periods (seconds)
  SCALE_UP_COOLDOWN: 180, // 3 minutes
  SCALE_DOWN_COOLDOWN: 300, // 5 minutes

  // Scaling increments
  SCALE_UP_INCREMENT: 2,
  SCALE_DOWN_INCREMENT: 1,
} as const;

// Metric types
export type MetricType =
  | "response_time"
  | "concurrent_users"
  | "cpu_usage"
  | "memory_usage"
  | "error_rate"
  | "cache_hit_rate"
  | "db_pool_usage"
  | "request_count";

export type AlertSeverity = "info" | "warning" | "critical";

export interface PerformanceMetric {
  type: MetricType;
  value: number;
  timestamp: number;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: MetricType;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}

export interface SystemHealth {
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

export interface ScalingDecision {
  action: "scale_up" | "scale_down" | "no_action";
  currentInstances: number;
  targetInstances: number;
  reason: string;
  metrics: Record<string, number>;
  timestamp: number;
}

// Redis keys for monitoring
const MONITORING_KEYS = {
  METRICS_PREFIX: "monitoring:metrics:",
  ALERTS_PREFIX: "monitoring:alerts:",
  HEALTH: "monitoring:health",
  SCALING_STATE: "monitoring:scaling_state",
  DEGRADATION_STATE: "monitoring:degradation",
  CONCURRENT_USERS: "monitoring:concurrent_users",
  REQUEST_COUNT: "monitoring:request_count:",
} as const;

// Metric retention periods (seconds)
const METRIC_RETENTION = {
  REALTIME: 300, // 5 minutes for real-time metrics
  HOURLY: 3600, // 1 hour for hourly aggregates
  DAILY: 86400, // 24 hours for daily aggregates
} as const;

/**
 * Record a performance metric
 */
export async function recordMetric(metric: PerformanceMetric): Promise<void> {
  if (!cache.isAvailable() || !redis) {
    return;
  }

  const key = `${MONITORING_KEYS.METRICS_PREFIX}${metric.type}`;
  const entry = JSON.stringify({
    ...metric,
    timestamp: metric.timestamp || Date.now(),
  });

  try {
    // Add to sorted set with timestamp as score
    await redis.zadd(key, metric.timestamp || Date.now(), entry);

    // Trim old entries (keep last 5 minutes of real-time data)
    const cutoff = Date.now() - METRIC_RETENTION.REALTIME * 1000;
    await redis.zremrangebyscore(key, 0, cutoff);

    // Check thresholds and create alerts if needed
    await checkThresholds(metric);
  } catch (error) {
    console.error("Failed to record metric:", error);
  }
}

/**
 * Record response time for an endpoint
 */
export async function recordResponseTime(endpoint: string, responseTimeMs: number): Promise<void> {
  await recordMetric({
    type: "response_time",
    value: responseTimeMs,
    timestamp: Date.now(),
    endpoint,
  });
}

/**
 * Track concurrent users
 */
export async function trackConcurrentUser(
  userId: string,
  action: "connect" | "disconnect"
): Promise<number> {
  if (!cache.isAvailable() || !redis) {
    return 0;
  }

  const key = MONITORING_KEYS.CONCURRENT_USERS;
  const now = Date.now();

  try {
    if (action === "connect") {
      // Add user with current timestamp
      await redis.zadd(key, now, userId);
    } else {
      // Remove user
      await redis.zrem(key, userId);
    }

    // Clean up stale connections (older than 5 minutes)
    const staleThreshold = now - 300000;
    await redis.zremrangebyscore(key, 0, staleThreshold);

    // Get current count
    const count = await redis.zcard(key);

    // Record metric
    await recordMetric({
      type: "concurrent_users",
      value: count,
      timestamp: now,
    });

    return count;
  } catch (error) {
    console.error("Failed to track concurrent user:", error);
    return 0;
  }
}

/**
 * Get current concurrent user count
 */
export async function getConcurrentUserCount(): Promise<number> {
  if (!cache.isAvailable() || !redis) {
    return 0;
  }

  try {
    // Clean up stale connections first
    const staleThreshold = Date.now() - 300000;
    await redis.zremrangebyscore(MONITORING_KEYS.CONCURRENT_USERS, 0, staleThreshold);
    return await redis.zcard(MONITORING_KEYS.CONCURRENT_USERS);
  } catch (error) {
    console.error("Failed to get concurrent user count:", error);
    return 0;
  }
}

/**
 * Increment request count for rate tracking
 */
export async function incrementRequestCount(endpoint: string): Promise<number> {
  if (!cache.isAvailable() || !redis) {
    return 0;
  }

  const minute = Math.floor(Date.now() / 60000);
  const key = `${MONITORING_KEYS.REQUEST_COUNT}${minute}:${endpoint}`;

  try {
    const count = await redis.incr(key);
    await redis.expire(key, 120); // Keep for 2 minutes
    return count;
  } catch (error) {
    console.error("Failed to increment request count:", error);
    return 0;
  }
}

/**
 * Check thresholds and create alerts if needed
 */
async function checkThresholds(metric: PerformanceMetric): Promise<void> {
  let severity: AlertSeverity | null = null;
  let threshold = 0;

  switch (metric.type) {
    case "response_time":
      if (metric.value >= PERFORMANCE_THRESHOLDS.RESPONSE_TIME_CRITICAL) {
        severity = "critical";
        threshold = PERFORMANCE_THRESHOLDS.RESPONSE_TIME_CRITICAL;
      } else if (metric.value >= PERFORMANCE_THRESHOLDS.RESPONSE_TIME_WARNING) {
        severity = "warning";
        threshold = PERFORMANCE_THRESHOLDS.RESPONSE_TIME_WARNING;
      }
      break;

    case "concurrent_users":
      if (metric.value >= PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL) {
        severity = "critical";
        threshold = PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL;
      } else if (metric.value >= PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_WARNING) {
        severity = "warning";
        threshold = PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_WARNING;
      }
      break;

    case "cpu_usage":
      if (metric.value >= PERFORMANCE_THRESHOLDS.CPU_CRITICAL) {
        severity = "critical";
        threshold = PERFORMANCE_THRESHOLDS.CPU_CRITICAL;
      } else if (metric.value >= PERFORMANCE_THRESHOLDS.CPU_WARNING) {
        severity = "warning";
        threshold = PERFORMANCE_THRESHOLDS.CPU_WARNING;
      }
      break;

    case "memory_usage":
      if (metric.value >= PERFORMANCE_THRESHOLDS.MEMORY_CRITICAL) {
        severity = "critical";
        threshold = PERFORMANCE_THRESHOLDS.MEMORY_CRITICAL;
      } else if (metric.value >= PERFORMANCE_THRESHOLDS.MEMORY_WARNING) {
        severity = "warning";
        threshold = PERFORMANCE_THRESHOLDS.MEMORY_WARNING;
      }
      break;

    case "error_rate":
      if (metric.value >= PERFORMANCE_THRESHOLDS.ERROR_RATE_CRITICAL) {
        severity = "critical";
        threshold = PERFORMANCE_THRESHOLDS.ERROR_RATE_CRITICAL;
      } else if (metric.value >= PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING) {
        severity = "warning";
        threshold = PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING;
      }
      break;

    case "cache_hit_rate":
      if (metric.value <= PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_CRITICAL) {
        severity = "critical";
        threshold = PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_CRITICAL;
      } else if (metric.value <= PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_WARNING) {
        severity = "warning";
        threshold = PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_WARNING;
      }
      break;

    case "db_pool_usage":
      if (metric.value >= PERFORMANCE_THRESHOLDS.DB_POOL_CRITICAL) {
        severity = "critical";
        threshold = PERFORMANCE_THRESHOLDS.DB_POOL_CRITICAL;
      } else if (metric.value >= PERFORMANCE_THRESHOLDS.DB_POOL_WARNING) {
        severity = "warning";
        threshold = PERFORMANCE_THRESHOLDS.DB_POOL_WARNING;
      }
      break;
  }

  if (severity) {
    await createAlert(severity, metric.type, metric.value, threshold);
  }
}

/**
 * Create an alert
 */
export async function createAlert(
  severity: AlertSeverity,
  type: MetricType,
  value: number,
  threshold: number
): Promise<Alert> {
  const alert: Alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    severity,
    type,
    message: generateAlertMessage(severity, type, value, threshold),
    value,
    threshold,
    timestamp: Date.now(),
    acknowledged: false,
  };

  const key = `${MONITORING_KEYS.ALERTS_PREFIX}${alert.id}`;

  try {
    if (cache.isAvailable() && redis) {
      // Store alert with 24-hour expiry
      await redis.setex(key, 86400, JSON.stringify(alert));

      // Add to active alerts set
      await redis.zadd(`${MONITORING_KEYS.ALERTS_PREFIX}active`, alert.timestamp, alert.id);
    }

    // Trigger graceful degradation if critical
    if (severity === "critical") {
      await triggerGracefulDegradation(type);
    }

    logger.info(`[ALERT] ${severity.toUpperCase()}: ${alert.message}`);
  } catch (error) {
    console.error("Failed to create alert:", error);
  }

  return alert;
}

/**
 * Generate alert message
 */
function generateAlertMessage(
  severity: AlertSeverity,
  type: MetricType,
  value: number,
  threshold: number
): string {
  const typeLabels: Record<MetricType, string> = {
    response_time: "Response time",
    concurrent_users: "Concurrent users",
    cpu_usage: "CPU usage",
    memory_usage: "Memory usage",
    error_rate: "Error rate",
    cache_hit_rate: "Cache hit rate",
    db_pool_usage: "Database pool usage",
    request_count: "Request count",
  };

  const label = typeLabels[type];
  const formattedValue =
    type === "response_time"
      ? `${value}ms`
      : type.includes("rate") || type.includes("usage")
        ? `${value}%`
        : value.toString();

  return `${label} ${severity === "critical" ? "exceeded critical threshold" : "exceeded warning threshold"}: ${formattedValue} (threshold: ${threshold})`;
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(): Promise<Alert[]> {
  if (!cache.isAvailable() || !redis) {
    return [];
  }

  try {
    const alertIds = await redis.zrange(`${MONITORING_KEYS.ALERTS_PREFIX}active`, 0, -1);
    const alerts: Alert[] = [];

    for (const id of alertIds) {
      const alertData = await redis.get(`${MONITORING_KEYS.ALERTS_PREFIX}${id}`);
      if (alertData) {
        const alert = JSON.parse(alertData) as Alert;
        if (!alert.acknowledged) {
          alerts.push(alert);
        }
      }
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Failed to get active alerts:", error);
    return [];
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
  if (!cache.isAvailable() || !redis) {
    return false;
  }

  const key = `${MONITORING_KEYS.ALERTS_PREFIX}${alertId}`;

  try {
    const alertData = await redis.get(key);
    if (!alertData) {
      return false;
    }

    const alert = JSON.parse(alertData) as Alert;
    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = Date.now();

    await redis.setex(key, 86400, JSON.stringify(alert));
    await redis.zrem(`${MONITORING_KEYS.ALERTS_PREFIX}active`, alertId);

    return true;
  } catch (error) {
    console.error("Failed to acknowledge alert:", error);
    return false;
  }
}

// Graceful degradation state
export interface DegradationState {
  enabled: boolean;
  degradedFeatures: string[];
  reason: string;
  triggeredAt: number;
  autoRecoveryAt?: number;
}

// Non-critical features that can be degraded
export const DEGRADABLE_FEATURES = {
  AI_CHATBOT: "ai_chatbot",
  SENTIMENT_ANALYSIS: "sentiment_analysis",
  FAMILY_NETWORK_VISUALIZATION: "family_network_visualization",
  SOCIAL_SHARING: "social_sharing",
  PDF_EXPORT: "pdf_export",
  AUTOCOMPLETE: "autocomplete",
  REAL_TIME_NOTIFICATIONS: "real_time_notifications",
  COMPARISON_TOOL: "comparison_tool",
} as const;

// Feature degradation priority (lower = degrade first)
const DEGRADATION_PRIORITY: Record<string, number> = {
  [DEGRADABLE_FEATURES.SENTIMENT_ANALYSIS]: 1,
  [DEGRADABLE_FEATURES.SOCIAL_SHARING]: 2,
  [DEGRADABLE_FEATURES.PDF_EXPORT]: 3,
  [DEGRADABLE_FEATURES.FAMILY_NETWORK_VISUALIZATION]: 4,
  [DEGRADABLE_FEATURES.AUTOCOMPLETE]: 5,
  [DEGRADABLE_FEATURES.REAL_TIME_NOTIFICATIONS]: 6,
  [DEGRADABLE_FEATURES.COMPARISON_TOOL]: 7,
  [DEGRADABLE_FEATURES.AI_CHATBOT]: 8, // Degrade last as it's important
};

/**
 * Trigger graceful degradation based on metric type
 * Validates: Requirement 44.7 - Gracefully degrade non-critical features under extreme load
 */
export async function triggerGracefulDegradation(
  triggerMetric: MetricType
): Promise<DegradationState> {
  const currentState = await getDegradationState();

  // Determine which features to degrade based on the trigger
  const featuresToDegrade = getFeaturesToDegrade(triggerMetric, currentState.degradedFeatures);

  const newState: DegradationState = {
    enabled: true,
    degradedFeatures: [...new Set([...currentState.degradedFeatures, ...featuresToDegrade])],
    reason: `Triggered by ${triggerMetric} threshold breach`,
    triggeredAt: Date.now(),
    autoRecoveryAt: Date.now() + 300000, // Auto-recover after 5 minutes
  };

  try {
    if (cache.isAvailable() && redis) {
      await redis.setex(MONITORING_KEYS.DEGRADATION_STATE, 600, JSON.stringify(newState));
    }
    logger.info(`[DEGRADATION] Enabled for features: ${newState.degradedFeatures.join(", ")}`);
  } catch (error) {
    console.error("Failed to trigger graceful degradation:", error);
  }

  return newState;
}

/**
 * Get features to degrade based on trigger metric
 */
function getFeaturesToDegrade(triggerMetric: MetricType, alreadyDegraded: string[]): string[] {
  const allFeatures = Object.values(DEGRADABLE_FEATURES);
  const availableFeatures = allFeatures.filter((f) => !alreadyDegraded.includes(f));

  // Sort by priority
  availableFeatures.sort(
    (a, b) => (DEGRADATION_PRIORITY[a] || 99) - (DEGRADATION_PRIORITY[b] || 99)
  );

  // Determine how many features to degrade based on metric type
  let count = 2; // Default: degrade 2 features

  switch (triggerMetric) {
    case "concurrent_users":
    case "cpu_usage":
    case "memory_usage":
      count = 3; // More aggressive degradation for resource issues
      break;
    case "response_time":
      count = 2;
      break;
    case "error_rate":
      count = 4; // Most aggressive for error rate issues
      break;
    default:
      count = 2;
  }

  return availableFeatures.slice(0, count);
}

/**
 * Get current degradation state
 */
export async function getDegradationState(): Promise<DegradationState> {
  if (!cache.isAvailable() || !redis) {
    return {
      enabled: false,
      degradedFeatures: [],
      reason: "",
      triggeredAt: 0,
    };
  }

  try {
    const stateData = await redis.get(MONITORING_KEYS.DEGRADATION_STATE);
    if (stateData) {
      const state = JSON.parse(stateData) as DegradationState;

      // Check for auto-recovery
      if (state.autoRecoveryAt && Date.now() >= state.autoRecoveryAt) {
        await disableGracefulDegradation();
        return {
          enabled: false,
          degradedFeatures: [],
          reason: "",
          triggeredAt: 0,
        };
      }

      return state;
    }
  } catch (error) {
    console.error("Failed to get degradation state:", error);
  }

  return {
    enabled: false,
    degradedFeatures: [],
    reason: "",
    triggeredAt: 0,
  };
}

/**
 * Check if a feature is currently degraded
 */
export async function isFeatureDegraded(feature: string): Promise<boolean> {
  const state = await getDegradationState();
  return state.enabled && state.degradedFeatures.includes(feature);
}

/**
 * Disable graceful degradation (manual recovery)
 */
export async function disableGracefulDegradation(): Promise<void> {
  if (!cache.isAvailable() || !redis) {
    return;
  }

  try {
    await redis.del(MONITORING_KEYS.DEGRADATION_STATE);
    logger.info("[DEGRADATION] Disabled - all features restored");
  } catch (error) {
    console.error("Failed to disable graceful degradation:", error);
  }
}

/**
 * Get system health status
 * Validates: Requirement 44.6 - Monitor performance metrics
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  try {
    // Get recent metrics
    const [responseTimeMetrics, concurrentUsers, activeAlerts, degradationState] =
      await Promise.all([
        getRecentMetrics("response_time", 60), // Last minute
        getConcurrentUserCount(),
        getActiveAlerts(),
        getDegradationState(),
      ]);

    // Calculate average response time
    const avgResponseTime =
      responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
        : 0;

    // Determine overall status
    let status: "healthy" | "degraded" | "critical" = "healthy";

    if (activeAlerts.some((a) => a.severity === "critical")) {
      status = "critical";
    } else if (activeAlerts.some((a) => a.severity === "warning") || degradationState.enabled) {
      status = "degraded";
    }

    const health: SystemHealth = {
      status,
      metrics: {
        responseTime: Math.round(avgResponseTime),
        concurrentUsers,
        cpuUsage: await getLatestMetricValue("cpu_usage"),
        memoryUsage: await getLatestMetricValue("memory_usage"),
        errorRate: await getLatestMetricValue("error_rate"),
        cacheHitRate: await getLatestMetricValue("cache_hit_rate"),
        dbPoolUsage: await getLatestMetricValue("db_pool_usage"),
      },
      activeAlerts,
      degradedFeatures: degradationState.degradedFeatures,
      lastUpdated: Date.now(),
    };

    // Cache health status
    if (cache.isAvailable() && redis) {
      await redis.setex(MONITORING_KEYS.HEALTH, 30, JSON.stringify(health));
    }

    return health;
  } catch (error) {
    console.error("Failed to get system health:", error);
    return {
      status: "critical",
      metrics: {
        responseTime: 0,
        concurrentUsers: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        errorRate: 0,
        cacheHitRate: 0,
        dbPoolUsage: 0,
      },
      activeAlerts: [],
      degradedFeatures: [],
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Get recent metrics of a specific type
 */
async function getRecentMetrics(type: MetricType, seconds: number): Promise<PerformanceMetric[]> {
  if (!cache.isAvailable() || !redis) {
    return [];
  }

  const key = `${MONITORING_KEYS.METRICS_PREFIX}${type}`;
  const cutoff = Date.now() - seconds * 1000;

  try {
    const entries = await redis.zrangebyscore(key, cutoff, "+inf");
    return entries.map((entry) => JSON.parse(entry) as PerformanceMetric);
  } catch (error) {
    console.error(`Failed to get recent ${type} metrics:`, error);
    return [];
  }
}

/**
 * Get latest value for a metric type
 */
async function getLatestMetricValue(type: MetricType): Promise<number> {
  if (!cache.isAvailable() || !redis) {
    return 0;
  }

  const key = `${MONITORING_KEYS.METRICS_PREFIX}${type}`;

  try {
    const entries = await redis.zrange(key, -1, -1);
    if (entries.length > 0 && entries[0]) {
      const metric = JSON.parse(entries[0]) as PerformanceMetric;
      return metric.value;
    }
  } catch (error) {
    console.error(`Failed to get latest ${type} metric:`, error);
  }

  return 0;
}

// Auto-scaling state
interface ScalingState {
  currentInstances: number;
  lastScaleUp: number;
  lastScaleDown: number;
  pendingAction: "scale_up" | "scale_down" | null;
}

/**
 * Evaluate auto-scaling decision
 * Validates: Requirement 44.5 - Auto-scale infrastructure based on traffic demand
 */
export async function evaluateAutoScaling(): Promise<ScalingDecision> {
  const state = await getScalingState();
  const health = await getSystemHealth();
  const now = Date.now();

  const metrics = {
    cpuUsage: health.metrics.cpuUsage,
    memoryUsage: health.metrics.memoryUsage,
    responseTime: health.metrics.responseTime,
    concurrentUsers: health.metrics.concurrentUsers,
  };

  // Check if we need to scale up
  const shouldScaleUp =
    metrics.cpuUsage >= AUTO_SCALING_CONFIG.SCALE_UP_CPU_THRESHOLD ||
    metrics.memoryUsage >= AUTO_SCALING_CONFIG.SCALE_UP_MEMORY_THRESHOLD ||
    metrics.responseTime >= AUTO_SCALING_CONFIG.SCALE_UP_RESPONSE_TIME_THRESHOLD ||
    metrics.concurrentUsers >= AUTO_SCALING_CONFIG.SCALE_UP_CONCURRENT_USERS_THRESHOLD;

  // Check if we can scale down
  const canScaleDown =
    metrics.cpuUsage <= AUTO_SCALING_CONFIG.SCALE_DOWN_CPU_THRESHOLD &&
    metrics.memoryUsage <= AUTO_SCALING_CONFIG.SCALE_DOWN_MEMORY_THRESHOLD &&
    metrics.responseTime <= AUTO_SCALING_CONFIG.SCALE_DOWN_RESPONSE_TIME_THRESHOLD;

  // Check cooldown periods
  const canScaleUpNow = now - state.lastScaleUp >= AUTO_SCALING_CONFIG.SCALE_UP_COOLDOWN * 1000;
  const canScaleDownNow =
    now - state.lastScaleDown >= AUTO_SCALING_CONFIG.SCALE_DOWN_COOLDOWN * 1000;

  let decision: ScalingDecision;

  if (
    shouldScaleUp &&
    canScaleUpNow &&
    state.currentInstances < AUTO_SCALING_CONFIG.MAX_INSTANCES
  ) {
    const targetInstances = Math.min(
      state.currentInstances + AUTO_SCALING_CONFIG.SCALE_UP_INCREMENT,
      AUTO_SCALING_CONFIG.MAX_INSTANCES
    );

    decision = {
      action: "scale_up",
      currentInstances: state.currentInstances,
      targetInstances,
      reason: generateScalingReason("scale_up", metrics),
      metrics,
      timestamp: now,
    };

    // Update state
    await updateScalingState({
      ...state,
      currentInstances: targetInstances,
      lastScaleUp: now,
      pendingAction: null,
    });
  } else if (
    canScaleDown &&
    canScaleDownNow &&
    state.currentInstances > AUTO_SCALING_CONFIG.MIN_INSTANCES
  ) {
    const targetInstances = Math.max(
      state.currentInstances - AUTO_SCALING_CONFIG.SCALE_DOWN_INCREMENT,
      AUTO_SCALING_CONFIG.MIN_INSTANCES
    );

    decision = {
      action: "scale_down",
      currentInstances: state.currentInstances,
      targetInstances,
      reason: generateScalingReason("scale_down", metrics),
      metrics,
      timestamp: now,
    };

    // Update state
    await updateScalingState({
      ...state,
      currentInstances: targetInstances,
      lastScaleDown: now,
      pendingAction: null,
    });
  } else {
    decision = {
      action: "no_action",
      currentInstances: state.currentInstances,
      targetInstances: state.currentInstances,
      reason: shouldScaleUp
        ? "Scale-up needed but in cooldown period"
        : canScaleDown
          ? "Scale-down possible but in cooldown period"
          : "Metrics within acceptable range",
      metrics,
      timestamp: now,
    };
  }

  // Log scaling decision
  logger.info(`[AUTO-SCALING] ${decision.action}: ${decision.reason}`);

  return decision;
}

/**
 * Generate scaling reason message
 */
function generateScalingReason(
  action: "scale_up" | "scale_down",
  metrics: Record<string, number>
): string {
  const cpuUsage = metrics.cpuUsage ?? 0;
  const memoryUsage = metrics.memoryUsage ?? 0;
  const responseTime = metrics.responseTime ?? 0;
  const concurrentUsers = metrics.concurrentUsers ?? 0;

  if (action === "scale_up") {
    const reasons: string[] = [];
    if (cpuUsage >= AUTO_SCALING_CONFIG.SCALE_UP_CPU_THRESHOLD) {
      reasons.push(`CPU at ${cpuUsage}%`);
    }
    if (memoryUsage >= AUTO_SCALING_CONFIG.SCALE_UP_MEMORY_THRESHOLD) {
      reasons.push(`Memory at ${memoryUsage}%`);
    }
    if (responseTime >= AUTO_SCALING_CONFIG.SCALE_UP_RESPONSE_TIME_THRESHOLD) {
      reasons.push(`Response time at ${responseTime}ms`);
    }
    if (concurrentUsers >= AUTO_SCALING_CONFIG.SCALE_UP_CONCURRENT_USERS_THRESHOLD) {
      reasons.push(`${concurrentUsers} concurrent users`);
    }
    return `Scaling up due to: ${reasons.join(", ")}`;
  } else {
    return `Scaling down - all metrics below thresholds (CPU: ${cpuUsage}%, Memory: ${memoryUsage}%, Response: ${responseTime}ms)`;
  }
}

/**
 * Get current scaling state
 */
async function getScalingState(): Promise<ScalingState> {
  if (!cache.isAvailable() || !redis) {
    return {
      currentInstances: AUTO_SCALING_CONFIG.MIN_INSTANCES,
      lastScaleUp: 0,
      lastScaleDown: 0,
      pendingAction: null,
    };
  }

  try {
    const stateData = await redis.get(MONITORING_KEYS.SCALING_STATE);
    if (stateData) {
      return JSON.parse(stateData) as ScalingState;
    }
  } catch (error) {
    console.error("Failed to get scaling state:", error);
  }

  // Default state
  return {
    currentInstances: AUTO_SCALING_CONFIG.MIN_INSTANCES,
    lastScaleUp: 0,
    lastScaleDown: 0,
    pendingAction: null,
  };
}

/**
 * Update scaling state
 */
async function updateScalingState(state: ScalingState): Promise<void> {
  if (!cache.isAvailable() || !redis) {
    return;
  }

  try {
    await redis.set(MONITORING_KEYS.SCALING_STATE, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to update scaling state:", error);
  }
}

/**
 * Manually set instance count (for external orchestration)
 */
export async function setInstanceCount(count: number): Promise<void> {
  const state = await getScalingState();
  await updateScalingState({
    ...state,
    currentInstances: Math.max(
      AUTO_SCALING_CONFIG.MIN_INSTANCES,
      Math.min(count, AUTO_SCALING_CONFIG.MAX_INSTANCES)
    ),
  });
}

/**
 * Get current instance count
 */
export async function getInstanceCount(): Promise<number> {
  const state = await getScalingState();
  return state.currentInstances;
}

// Alerting configuration
export interface AlertingConfig {
  emailRecipients: string[];
  slackWebhook?: string;
  pagerDutyKey?: string;
  enabled: boolean;
}

/**
 * Send alert notification
 * Validates: Requirement 44.6 - Alert administrators when thresholds are exceeded
 */
export async function sendAlertNotification(alert: Alert, config: AlertingConfig): Promise<void> {
  if (!config.enabled) {
    return;
  }

  const notification = {
    title: `[${alert.severity.toUpperCase()}] Performance Alert`,
    message: alert.message,
    timestamp: new Date(alert.timestamp).toISOString(),
    alertId: alert.id,
    metricType: alert.type,
    value: alert.value,
    threshold: alert.threshold,
  };

  // Log notification (in production, this would send to actual services)
  logger.info("[ALERT NOTIFICATION]", JSON.stringify(notification, null, 2));

  // In production, implement actual notification sending:
  // - Email via SendGrid/SES
  // - Slack via webhook
  // - PagerDuty for critical alerts
}

/**
 * Performance monitoring middleware data collector
 */
export function createPerformanceMiddleware() {
  return {
    /**
     * Record request start time
     */
    onRequestStart: () => {
      return { startTime: Date.now() };
    },

    /**
     * Record request completion
     */
    onRequestEnd: async (context: { startTime: number }, endpoint: string, statusCode: number) => {
      const responseTime = Date.now() - context.startTime;

      // Record response time
      await recordResponseTime(endpoint, responseTime);

      // Record error if applicable
      if (statusCode >= 500) {
        await recordMetric({
          type: "error_rate",
          value: 1,
          timestamp: Date.now(),
          endpoint,
          metadata: { statusCode },
        });
      }

      // Increment request count
      await incrementRequestCount(endpoint);
    },
  };
}

// Export all functions and types
export default {
  // Metrics
  recordMetric,
  recordResponseTime,
  trackConcurrentUser,
  getConcurrentUserCount,
  incrementRequestCount,

  // Alerts
  createAlert,
  getActiveAlerts,
  acknowledgeAlert,
  sendAlertNotification,

  // Graceful degradation
  triggerGracefulDegradation,
  getDegradationState,
  isFeatureDegraded,
  disableGracefulDegradation,
  DEGRADABLE_FEATURES,

  // System health
  getSystemHealth,

  // Auto-scaling
  evaluateAutoScaling,
  setInstanceCount,
  getInstanceCount,

  // Configuration
  PERFORMANCE_THRESHOLDS,
  AUTO_SCALING_CONFIG,

  // Middleware
  createPerformanceMiddleware,
};
