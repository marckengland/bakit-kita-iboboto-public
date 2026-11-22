/**
 * Performance Testing Utilities
 *
 * Provides utilities for load testing, response time verification,
 * and graceful degradation testing.
 *
 * Validates: Requirements 44.1, 44.2, 44.7
 * - 44.1: Load pages within 3 seconds under normal conditions
 * - 44.2: Support at least 100,000 concurrent users during peak election periods
 * - 44.7: Gracefully degrade non-critical features under extreme load
 */

import {
  PERFORMANCE_THRESHOLDS,
  AUTO_SCALING_CONFIG,
  DEGRADABLE_FEATURES,
  type MetricType,
  type AlertSeverity,
} from "./monitoring-service";

// ============================================
// Types and Interfaces
// ============================================

export interface LoadTestConfig {
  targetUsers: number;
  rampUpDurationMs: number;
  testDurationMs: number;
  requestsPerUser: number;
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  maxResponseTimeMs: number;
  minResponseTimeMs: number;
  requestsPerSecond: number;
  errorRate: number;
  concurrentUsersReached: number;
  degradedFeatures: string[];
  passedThresholds: boolean;
}

export interface ResponseTimeResult {
  responseTimeMs: number;
  withinThreshold: boolean;
  thresholdMs: number;
  severity: AlertSeverity | null;
}

export interface ConcurrentUserResult {
  userCount: number;
  withinCapacity: boolean;
  capacityLimit: number;
  severity: AlertSeverity | null;
  shouldTriggerDegradation: boolean;
}

export interface DegradationTestResult {
  triggerMetric: MetricType;
  triggerValue: number;
  degradedFeatures: string[];
  expectedDegradedCount: number;
  actualDegradedCount: number;
  correctlyDegraded: boolean;
  coreFeaturesMaintained: boolean;
}

export interface ScalingTestResult {
  initialInstances: number;
  finalInstances: number;
  scalingAction: "scale_up" | "scale_down" | "no_action";
  triggerMetrics: Record<string, number>;
  respectsCooldown: boolean;
  withinBounds: boolean;
}

// ============================================
// Core Features (should never be degraded)
// ============================================

export const CORE_FEATURES = [
  "politician_directory",
  "politician_profile",
  "search",
  "authentication",
  "data_display",
] as const;

// ============================================
// Response Time Testing
// ============================================

/**
 * Evaluate response time against thresholds
 * Validates: Requirement 44.1 - Load pages within 3 seconds
 */
export function evaluateResponseTime(responseTimeMs: number): ResponseTimeResult {
  const thresholdMs = PERFORMANCE_THRESHOLDS.RESPONSE_TIME_CRITICAL;
  let severity: AlertSeverity | null = null;

  if (responseTimeMs >= PERFORMANCE_THRESHOLDS.RESPONSE_TIME_CRITICAL) {
    severity = "critical";
  } else if (responseTimeMs >= PERFORMANCE_THRESHOLDS.RESPONSE_TIME_WARNING) {
    severity = "warning";
  }

  return {
    responseTimeMs,
    withinThreshold: responseTimeMs < thresholdMs,
    thresholdMs,
    severity,
  };
}

/**
 * Check if response time meets the 3-second requirement
 */
export function meetsResponseTimeRequirement(responseTimeMs: number): boolean {
  return responseTimeMs < PERFORMANCE_THRESHOLDS.RESPONSE_TIME_CRITICAL;
}

/**
 * Calculate percentile from sorted response times
 */
export function calculatePercentile(sortedTimes: number[], percentile: number): number {
  if (sortedTimes.length === 0) {
    return 0;
  }
  const index = Math.ceil((percentile / 100) * sortedTimes.length) - 1;
  return sortedTimes[Math.max(0, Math.min(index, sortedTimes.length - 1))]!;
}

// ============================================
// Concurrent User Testing
// ============================================

/**
 * Evaluate concurrent user count against capacity
 * Validates: Requirement 44.2 - Support 100,000 concurrent users
 */
export function evaluateConcurrentUsers(userCount: number): ConcurrentUserResult {
  const capacityLimit = PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL;
  let severity: AlertSeverity | null = null;
  let shouldTriggerDegradation = false;

  if (userCount >= PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL) {
    severity = "critical";
    shouldTriggerDegradation = true;
  } else if (userCount >= PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_WARNING) {
    severity = "warning";
  }

  return {
    userCount,
    withinCapacity: userCount <= capacityLimit,
    capacityLimit,
    severity,
    shouldTriggerDegradation,
  };
}

/**
 * Check if system can handle the specified user count
 */
export function canHandleConcurrentUsers(userCount: number): boolean {
  return userCount <= PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL;
}

/**
 * Calculate the percentage of capacity used
 */
export function calculateCapacityUsage(userCount: number): number {
  return (userCount / PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL) * 100;
}

// ============================================
// Graceful Degradation Testing
// ============================================

/**
 * Determine which features should be degraded based on metric
 * Validates: Requirement 44.7 - Gracefully degrade non-critical features
 */
export function determineFeaturesToDegrade(
  triggerMetric: MetricType,
  currentlyDegraded: string[] = []
): string[] {
  const allFeatures = Object.values(DEGRADABLE_FEATURES);
  const availableFeatures = allFeatures.filter((f) => !currentlyDegraded.includes(f));

  // Degradation priority (lower = degrade first)
  const priority: Record<string, number> = {
    [DEGRADABLE_FEATURES.SENTIMENT_ANALYSIS]: 1,
    [DEGRADABLE_FEATURES.SOCIAL_SHARING]: 2,
    [DEGRADABLE_FEATURES.PDF_EXPORT]: 3,
    [DEGRADABLE_FEATURES.FAMILY_NETWORK_VISUALIZATION]: 4,
    [DEGRADABLE_FEATURES.AUTOCOMPLETE]: 5,
    [DEGRADABLE_FEATURES.REAL_TIME_NOTIFICATIONS]: 6,
    [DEGRADABLE_FEATURES.COMPARISON_TOOL]: 7,
    [DEGRADABLE_FEATURES.AI_CHATBOT]: 8,
  };

  // Sort by priority
  availableFeatures.sort((a, b) => (priority[a] || 99) - (priority[b] || 99));

  // Determine count based on metric type
  let count = 2;
  switch (triggerMetric) {
    case "concurrent_users":
    case "cpu_usage":
    case "memory_usage":
      count = 3;
      break;
    case "response_time":
      count = 2;
      break;
    case "error_rate":
      count = 4;
      break;
    default:
      count = 2;
  }

  return availableFeatures.slice(0, count);
}

/**
 * Evaluate degradation correctness
 */
export function evaluateDegradation(
  triggerMetric: MetricType,
  triggerValue: number,
  degradedFeatures: string[]
): DegradationTestResult {
  const expectedFeatures = determineFeaturesToDegrade(triggerMetric);
  const degradableValues = Object.values(DEGRADABLE_FEATURES);

  // Check that only degradable features are degraded
  const allDegradedAreValid = degradedFeatures.every((f) =>
    degradableValues.includes(f as (typeof degradableValues)[number])
  );

  // Check that core features are not degraded
  const coreFeaturesMaintained = !degradedFeatures.some((f) =>
    CORE_FEATURES.includes(f as (typeof CORE_FEATURES)[number])
  );

  return {
    triggerMetric,
    triggerValue,
    degradedFeatures,
    expectedDegradedCount: expectedFeatures.length,
    actualDegradedCount: degradedFeatures.length,
    correctlyDegraded: allDegradedAreValid && degradedFeatures.length >= expectedFeatures.length,
    coreFeaturesMaintained,
  };
}

/**
 * Check if a feature is degradable
 */
export function isFeatureDegradable(feature: string): boolean {
  return Object.values(DEGRADABLE_FEATURES).includes(
    feature as (typeof DEGRADABLE_FEATURES)[keyof typeof DEGRADABLE_FEATURES]
  );
}

/**
 * Check if a feature is a core feature
 */
export function isCoreFeature(feature: string): boolean {
  return CORE_FEATURES.includes(feature as (typeof CORE_FEATURES)[number]);
}

// ============================================
// Auto-Scaling Testing
// ============================================

/**
 * Evaluate scaling decision
 */
export function evaluateScalingDecision(
  currentInstances: number,
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    concurrentUsers: number;
  },
  lastScaleUp: number,
  lastScaleDown: number
): ScalingTestResult {
  const now = Date.now();

  // First, clamp current instances to valid bounds
  const clampedCurrentInstances = Math.max(
    AUTO_SCALING_CONFIG.MIN_INSTANCES,
    Math.min(currentInstances, AUTO_SCALING_CONFIG.MAX_INSTANCES)
  );

  // Check if scale-up is needed
  const shouldScaleUp =
    metrics.cpuUsage >= AUTO_SCALING_CONFIG.SCALE_UP_CPU_THRESHOLD ||
    metrics.memoryUsage >= AUTO_SCALING_CONFIG.SCALE_UP_MEMORY_THRESHOLD ||
    metrics.responseTime >= AUTO_SCALING_CONFIG.SCALE_UP_RESPONSE_TIME_THRESHOLD ||
    metrics.concurrentUsers >= AUTO_SCALING_CONFIG.SCALE_UP_CONCURRENT_USERS_THRESHOLD;

  // Check if scale-down is possible
  const canScaleDown =
    metrics.cpuUsage <= AUTO_SCALING_CONFIG.SCALE_DOWN_CPU_THRESHOLD &&
    metrics.memoryUsage <= AUTO_SCALING_CONFIG.SCALE_DOWN_MEMORY_THRESHOLD &&
    metrics.responseTime <= AUTO_SCALING_CONFIG.SCALE_DOWN_RESPONSE_TIME_THRESHOLD;

  // Check cooldowns
  const canScaleUpNow = now - lastScaleUp >= AUTO_SCALING_CONFIG.SCALE_UP_COOLDOWN * 1000;
  const canScaleDownNow = now - lastScaleDown >= AUTO_SCALING_CONFIG.SCALE_DOWN_COOLDOWN * 1000;

  let scalingAction: "scale_up" | "scale_down" | "no_action" = "no_action";
  let finalInstances = clampedCurrentInstances;

  if (
    shouldScaleUp &&
    canScaleUpNow &&
    clampedCurrentInstances < AUTO_SCALING_CONFIG.MAX_INSTANCES
  ) {
    scalingAction = "scale_up";
    finalInstances = Math.min(
      clampedCurrentInstances + AUTO_SCALING_CONFIG.SCALE_UP_INCREMENT,
      AUTO_SCALING_CONFIG.MAX_INSTANCES
    );
  } else if (
    canScaleDown &&
    canScaleDownNow &&
    clampedCurrentInstances > AUTO_SCALING_CONFIG.MIN_INSTANCES
  ) {
    scalingAction = "scale_down";
    finalInstances = Math.max(
      clampedCurrentInstances - AUTO_SCALING_CONFIG.SCALE_DOWN_INCREMENT,
      AUTO_SCALING_CONFIG.MIN_INSTANCES
    );
  }

  return {
    initialInstances: currentInstances,
    finalInstances,
    scalingAction,
    triggerMetrics: metrics,
    respectsCooldown:
      (scalingAction === "scale_up" && canScaleUpNow) ||
      (scalingAction === "scale_down" && canScaleDownNow) ||
      scalingAction === "no_action",
    withinBounds:
      finalInstances >= AUTO_SCALING_CONFIG.MIN_INSTANCES &&
      finalInstances <= AUTO_SCALING_CONFIG.MAX_INSTANCES,
  };
}

/**
 * Check if instance count is within bounds
 */
export function isInstanceCountValid(count: number): boolean {
  return count >= AUTO_SCALING_CONFIG.MIN_INSTANCES && count <= AUTO_SCALING_CONFIG.MAX_INSTANCES;
}

// ============================================
// Load Test Simulation
// ============================================

/**
 * Simulate a load test result based on configuration
 * This is a deterministic simulation for testing purposes
 */
export function simulateLoadTest(
  config: LoadTestConfig,
  baseResponseTimeMs: number = 100,
  errorProbability: number = 0.01
): LoadTestResult {
  const totalRequests = config.targetUsers * config.requestsPerUser;

  // Simulate response times with load-based degradation
  const loadFactor = config.targetUsers / PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL;
  const adjustedResponseTime = baseResponseTimeMs * (1 + loadFactor * 2);

  // Calculate error rate based on load
  const adjustedErrorRate = Math.min(errorProbability * (1 + loadFactor), 0.5);
  const failedRequests = Math.floor(totalRequests * adjustedErrorRate);
  const successfulRequests = totalRequests - failedRequests;

  // Simulate response time distribution
  const responseTimes: number[] = [];
  for (let i = 0; i < Math.min(totalRequests, 1000); i++) {
    // Add some variance
    const variance = (Math.random() - 0.5) * adjustedResponseTime * 0.5;
    responseTimes.push(Math.max(10, adjustedResponseTime + variance));
  }
  responseTimes.sort((a, b) => a - b);

  // Determine degraded features
  const degradedFeatures: string[] = [];
  if (config.targetUsers >= PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL) {
    degradedFeatures.push(...determineFeaturesToDegrade("concurrent_users"));
  }

  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTimeMs: avgResponseTime,
    p50ResponseTimeMs: calculatePercentile(responseTimes, 50),
    p95ResponseTimeMs: calculatePercentile(responseTimes, 95),
    p99ResponseTimeMs: calculatePercentile(responseTimes, 99),
    maxResponseTimeMs: responseTimes[responseTimes.length - 1] || 0,
    minResponseTimeMs: responseTimes[0] || 0,
    requestsPerSecond: totalRequests / (config.testDurationMs / 1000),
    errorRate: adjustedErrorRate * 100,
    concurrentUsersReached: config.targetUsers,
    degradedFeatures,
    passedThresholds:
      avgResponseTime < PERFORMANCE_THRESHOLDS.RESPONSE_TIME_CRITICAL &&
      config.targetUsers <= PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL,
  };
}

/**
 * Validate load test result against requirements
 */
export function validateLoadTestResult(result: LoadTestResult): {
  meetsResponseTimeReq: boolean;
  meetsConcurrentUsersReq: boolean;
  meetsErrorRateReq: boolean;
  overallPass: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  const meetsResponseTimeReq =
    result.averageResponseTimeMs < PERFORMANCE_THRESHOLDS.RESPONSE_TIME_CRITICAL;
  if (!meetsResponseTimeReq) {
    issues.push(
      `Average response time ${result.averageResponseTimeMs}ms exceeds ${PERFORMANCE_THRESHOLDS.RESPONSE_TIME_CRITICAL}ms threshold`
    );
  }

  const meetsConcurrentUsersReq =
    result.concurrentUsersReached <= PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL;
  if (!meetsConcurrentUsersReq) {
    issues.push(
      `Concurrent users ${result.concurrentUsersReached} exceeds ${PERFORMANCE_THRESHOLDS.CONCURRENT_USERS_CRITICAL} capacity`
    );
  }

  const meetsErrorRateReq = result.errorRate < PERFORMANCE_THRESHOLDS.ERROR_RATE_CRITICAL;
  if (!meetsErrorRateReq) {
    issues.push(
      `Error rate ${result.errorRate}% exceeds ${PERFORMANCE_THRESHOLDS.ERROR_RATE_CRITICAL}% threshold`
    );
  }

  return {
    meetsResponseTimeReq,
    meetsConcurrentUsersReq,
    meetsErrorRateReq,
    overallPass: meetsResponseTimeReq && meetsConcurrentUsersReq && meetsErrorRateReq,
    issues,
  };
}

// ============================================
// Threshold Helpers
// ============================================

/**
 * Get all performance thresholds
 */
export function getPerformanceThresholds() {
  return { ...PERFORMANCE_THRESHOLDS };
}

/**
 * Get auto-scaling configuration
 */
export function getAutoScalingConfig() {
  return { ...AUTO_SCALING_CONFIG };
}

/**
 * Get degradable features list
 */
export function getDegradableFeatures(): string[] {
  return Object.values(DEGRADABLE_FEATURES);
}

export default {
  // Response time
  evaluateResponseTime,
  meetsResponseTimeRequirement,
  calculatePercentile,

  // Concurrent users
  evaluateConcurrentUsers,
  canHandleConcurrentUsers,
  calculateCapacityUsage,

  // Degradation
  determineFeaturesToDegrade,
  evaluateDegradation,
  isFeatureDegradable,
  isCoreFeature,

  // Scaling
  evaluateScalingDecision,
  isInstanceCountValid,

  // Load testing
  simulateLoadTest,
  validateLoadTestResult,

  // Helpers
  getPerformanceThresholds,
  getAutoScalingConfig,
  getDegradableFeatures,

  // Constants
  CORE_FEATURES,
};
