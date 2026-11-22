/**
 * Disaster Recovery Admin API
 *
 * Provides endpoints for managing backups, restoration, and monitoring
 * disaster recovery status.
 *
 * Validates: Requirements 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.7
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createBackup,
  getBackup,
  getLatestBackup,
  listBackups,
  verifyBackup,
  createRestorationPlan,
  executeRestoration,
  getRestorationPlan,
  createBackupSchedule,
  getBackupSchedules,
  updateBackupSchedule,
  deleteBackupSchedule,
  backupBlockchainAuditLogs,
  checkRPOCompliance,
  estimateRTO,
  getDisasterRecoveryStatus,
  getDisasterRecoveryAlerts,
  acknowledgeAlert,
  initializeDefaultSchedules,
  runScheduledBackups,
  BackupType,
  StorageRegion,
} from "@/services/disaster-recovery.service";

/**
 * GET /api/admin/disaster-recovery
 *
 * Get disaster recovery status and information
 *
 * Query params:
 * - action: "status" | "backups" | "schedules" | "alerts" | "backup" | "plan"
 * - id: backup or plan ID (for specific queries)
 * - limit: number of items to return (for list queries)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "status";
    const id = searchParams.get("id");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    switch (action) {
      case "status": {
        const status = await getDisasterRecoveryStatus();
        return NextResponse.json({
          success: true,
          data: status,
        });
      }

      case "backups": {
        const backups = await listBackups(limit);
        return NextResponse.json({
          success: true,
          data: backups,
        });
      }

      case "backup": {
        if (!id) {
          // Return latest backup
          const latest = await getLatestBackup();
          return NextResponse.json({
            success: true,
            data: latest,
          });
        }
        const backup = await getBackup(id);
        if (!backup) {
          return NextResponse.json({ success: false, error: "Backup not found" }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          data: backup,
        });
      }

      case "schedules": {
        const schedules = await getBackupSchedules();
        return NextResponse.json({
          success: true,
          data: schedules,
        });
      }

      case "alerts": {
        const alerts = await getDisasterRecoveryAlerts();
        return NextResponse.json({
          success: true,
          data: alerts,
        });
      }

      case "plan": {
        if (!id) {
          return NextResponse.json({ success: false, error: "Plan ID required" }, { status: 400 });
        }
        const plan = await getRestorationPlan(id);
        if (!plan) {
          return NextResponse.json(
            { success: false, error: "Restoration plan not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: plan,
        });
      }

      case "rpo-compliance": {
        const compliant = await checkRPOCompliance();
        return NextResponse.json({
          success: true,
          data: { compliant },
        });
      }

      case "rto-estimate": {
        const estimate = await estimateRTO();
        return NextResponse.json({
          success: true,
          data: { estimatedMinutes: estimate },
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[DR API] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/disaster-recovery
 *
 * Perform disaster recovery operations
 *
 * Body:
 * - action: "backup" | "verify" | "restore-plan" | "restore-execute" | "schedule" | "blockchain-backup" | "init-schedules" | "run-scheduled"
 * - Additional params based on action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "backup": {
        const { type = "full", databases } = body;
        const backup = await createBackup(
          type as BackupType,
          databases || ["postgresql", "redis", "elasticsearch"]
        );
        return NextResponse.json({
          success: true,
          data: backup,
          message: `Backup ${backup.id} created successfully`,
        });
      }

      case "verify": {
        const { backupId } = body;
        if (!backupId) {
          return NextResponse.json(
            { success: false, error: "Backup ID required" },
            { status: 400 }
          );
        }
        const result = await verifyBackup(backupId);
        return NextResponse.json({
          success: true,
          data: result,
          message: result.success ? "Backup verification passed" : "Backup verification failed",
        });
      }

      case "restore-plan": {
        const { backupId, targetEnvironment = "production" } = body;
        if (!backupId) {
          return NextResponse.json(
            { success: false, error: "Backup ID required" },
            { status: 400 }
          );
        }
        const plan = await createRestorationPlan(backupId, targetEnvironment);
        return NextResponse.json({
          success: true,
          data: plan,
          message: `Restoration plan ${plan.id} created`,
        });
      }

      case "restore-execute": {
        const { planId } = body;
        if (!planId) {
          return NextResponse.json({ success: false, error: "Plan ID required" }, { status: 400 });
        }
        const result = await executeRestoration(planId);
        return NextResponse.json({
          success: true,
          data: result,
          message:
            result.status === "completed"
              ? "Restoration completed successfully"
              : `Restoration ${result.status}`,
        });
      }

      case "schedule": {
        const { name, type = "full", cronExpression, databases, storageLocations } = body;
        if (!name || !cronExpression) {
          return NextResponse.json(
            { success: false, error: "Name and cron expression required" },
            { status: 400 }
          );
        }
        const schedule = await createBackupSchedule(
          name,
          type as BackupType,
          cronExpression,
          databases || ["postgresql", "redis", "elasticsearch"],
          (storageLocations as StorageRegion[]) || ["primary", "secondary"]
        );
        return NextResponse.json({
          success: true,
          data: schedule,
          message: `Schedule ${schedule.id} created`,
        });
      }

      case "blockchain-backup": {
        const backup = await backupBlockchainAuditLogs();
        return NextResponse.json({
          success: true,
          data: backup,
          message: "Blockchain audit logs backed up successfully",
        });
      }

      case "init-schedules": {
        await initializeDefaultSchedules();
        const schedules = await getBackupSchedules();
        return NextResponse.json({
          success: true,
          data: schedules,
          message: "Default schedules initialized",
        });
      }

      case "run-scheduled": {
        await runScheduledBackups();
        return NextResponse.json({
          success: true,
          message: "Scheduled backups executed",
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[DR API] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/disaster-recovery
 *
 * Update disaster recovery resources
 *
 * Body:
 * - action: "schedule" | "acknowledge-alert"
 * - id: resource ID
 * - updates: update data
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id } = body;

    switch (action) {
      case "schedule": {
        if (!id) {
          return NextResponse.json(
            { success: false, error: "Schedule ID required" },
            { status: 400 }
          );
        }
        const { updates } = body;
        const schedule = await updateBackupSchedule(id, updates);
        if (!schedule) {
          return NextResponse.json(
            { success: false, error: "Schedule not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: schedule,
          message: "Schedule updated",
        });
      }

      case "acknowledge-alert": {
        if (!id) {
          return NextResponse.json({ success: false, error: "Alert ID required" }, { status: 400 });
        }
        const result = await acknowledgeAlert(id);
        if (!result) {
          return NextResponse.json({ success: false, error: "Alert not found" }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          message: "Alert acknowledged",
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[DR API] PATCH error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/disaster-recovery
 *
 * Delete disaster recovery resources
 *
 * Query params:
 * - action: "schedule"
 * - id: resource ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    switch (action) {
      case "schedule": {
        if (!id) {
          return NextResponse.json(
            { success: false, error: "Schedule ID required" },
            { status: 400 }
          );
        }
        const result = await deleteBackupSchedule(id);
        if (!result) {
          return NextResponse.json(
            { success: false, error: "Failed to delete schedule" },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          message: "Schedule deleted",
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[DR API] DELETE error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
