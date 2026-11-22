/**
 * Admin Monitoring API
 * Provides endpoints for system health, alerts, and auto-scaling management
 *
 * Validates: Requirements 44.5, 44.6, 44.7
 * - 44.5: Auto-scale infrastructure based on traffic demand
 * - 44.6: Monitor performance metrics and alert administrators
 * - 44.7: Gracefully degrade non-critical features under extreme load
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSystemHealth,
  getActiveAlerts,
  acknowledgeAlert,
  getDegradationState,
  disableGracefulDegradation,
  triggerGracefulDegradation,
  evaluateAutoScaling,
  getInstanceCount,
  setInstanceCount,
  DEGRADABLE_FEATURES,
  PERFORMANCE_THRESHOLDS,
  AUTO_SCALING_CONFIG,
} from "@/lib/monitoring-service";

/**
 * GET /api/admin/monitoring
 * Get system health status, active alerts, and degradation state
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get("view") || "health";

    switch (view) {
      case "health": {
        const health = await getSystemHealth();
        return NextResponse.json({
          success: true,
          data: health,
        });
      }

      case "alerts": {
        const alerts = await getActiveAlerts();
        return NextResponse.json({
          success: true,
          data: {
            alerts,
            count: alerts.length,
          },
        });
      }

      case "degradation": {
        const state = await getDegradationState();
        return NextResponse.json({
          success: true,
          data: {
            ...state,
            availableFeatures: Object.values(DEGRADABLE_FEATURES),
          },
        });
      }

      case "scaling": {
        const instanceCount = await getInstanceCount();
        const decision = await evaluateAutoScaling();
        return NextResponse.json({
          success: true,
          data: {
            currentInstances: instanceCount,
            lastDecision: decision,
            config: AUTO_SCALING_CONFIG,
          },
        });
      }

      case "config": {
        return NextResponse.json({
          success: true,
          data: {
            thresholds: PERFORMANCE_THRESHOLDS,
            autoScaling: AUTO_SCALING_CONFIG,
            degradableFeatures: Object.values(DEGRADABLE_FEATURES),
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid view parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Monitoring API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch monitoring data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/monitoring
 * Perform monitoring actions (acknowledge alerts, manage degradation, scaling)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "acknowledge_alert": {
        const { alertId, acknowledgedBy } = body;
        if (!alertId || !acknowledgedBy) {
          return NextResponse.json(
            { success: false, error: "Missing alertId or acknowledgedBy" },
            { status: 400 }
          );
        }

        const success = await acknowledgeAlert(alertId, acknowledgedBy);
        return NextResponse.json({
          success,
          message: success ? "Alert acknowledged" : "Failed to acknowledge alert",
        });
      }

      case "enable_degradation": {
        const { triggerMetric } = body;
        if (!triggerMetric) {
          return NextResponse.json(
            { success: false, error: "Missing triggerMetric" },
            { status: 400 }
          );
        }

        const state = await triggerGracefulDegradation(triggerMetric);
        return NextResponse.json({
          success: true,
          data: state,
          message: "Graceful degradation enabled",
        });
      }

      case "disable_degradation": {
        await disableGracefulDegradation();
        return NextResponse.json({
          success: true,
          message: "Graceful degradation disabled",
        });
      }

      case "set_instances": {
        const { count } = body;
        if (typeof count !== "number") {
          return NextResponse.json(
            { success: false, error: "Missing or invalid instance count" },
            { status: 400 }
          );
        }

        await setInstanceCount(count);
        const newCount = await getInstanceCount();
        return NextResponse.json({
          success: true,
          data: { instanceCount: newCount },
          message: `Instance count set to ${newCount}`,
        });
      }

      case "evaluate_scaling": {
        const decision = await evaluateAutoScaling();
        return NextResponse.json({
          success: true,
          data: decision,
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Monitoring API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to perform monitoring action" },
      { status: 500 }
    );
  }
}
