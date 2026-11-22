/**
 * Unit Tests for Notification Service
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    notificationPreferences: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bookmark: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  isValidNotificationType,
  getPreferenceKey,
  shouldNotify,
  generateElectionReminderMessage,
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  getOrCreatePreferences,
  updatePreferences,
  triggerNotificationsForPolitician,
  scheduleElectionReminders,
  NotificationPreferences,
  NOTIFICATION_TYPES,
  DEFAULT_PREFERENCES,
} from "./notification.service";

describe("Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isValidNotificationType", () => {
    it("should return true for valid notification types", () => {
      for (const type of NOTIFICATION_TYPES) {
        expect(isValidNotificationType(type)).toBe(true);
      }
    });

    it("should return false for invalid notification types", () => {
      expect(isValidNotificationType("invalid")).toBe(false);
      expect(isValidNotificationType("")).toBe(false);
      expect(isValidNotificationType("NEW_CONTROVERSY")).toBe(false);
    });
  });

  describe("getPreferenceKey", () => {
    it("should map notification types to preference keys", () => {
      expect(getPreferenceKey("new_controversy")).toBe("newControversy");
      expect(getPreferenceKey("new_bill")).toBe("newBill");
      expect(getPreferenceKey("bill_passed")).toBe("billPassed");
      expect(getPreferenceKey("red_flag")).toBe("redFlag");
      expect(getPreferenceKey("election_reminder")).toBe("electionReminder");
    });
  });

  describe("shouldNotify", () => {
    const basePreferences: NotificationPreferences = {
      id: "pref-1",
      userId: "user-1",
      email: true,
      inApp: true,
      newControversy: true,
      newBill: true,
      billPassed: true,
      redFlag: true,
      electionReminder: true,
    };

    it("should return true when channel and type are enabled", () => {
      expect(shouldNotify(basePreferences, "new_controversy", "inApp")).toBe(true);
      expect(shouldNotify(basePreferences, "new_bill", "email")).toBe(true);
    });

    it("should return false when channel is disabled", () => {
      const prefs = { ...basePreferences, inApp: false };
      expect(shouldNotify(prefs, "new_controversy", "inApp")).toBe(false);
    });

    it("should return false when type is disabled", () => {
      const prefs = { ...basePreferences, newControversy: false };
      expect(shouldNotify(prefs, "new_controversy", "inApp")).toBe(false);
    });
  });

  describe("generateElectionReminderMessage", () => {
    it("should generate message for election day", () => {
      const message = generateElectionReminderMessage(0, "National");
      expect(message).toContain("Today");
      expect(message).toContain("National");
    });

    it("should generate message for day before election", () => {
      const message = generateElectionReminderMessage(1, "Local");
      expect(message).toContain("Tomorrow");
      expect(message).toContain("Local");
    });

    it("should generate message for multiple days before", () => {
      const message = generateElectionReminderMessage(7, "Barangay");
      expect(message).toContain("7 days");
      expect(message).toContain("Barangay");
    });
  });

  describe("createNotification", () => {
    it("should create notification successfully", async () => {
      const mockUser = { id: "user-1" };
      const mockNotification = {
        id: "notif-1",
        userId: "user-1",
        type: "new_controversy",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.notification.create).mockResolvedValue(mockNotification as any);

      const result = await createNotification({
        userId: "user-1",
        type: "new_controversy",
        title: "Test",
        message: "Test message",
      });

      expect(result.id).toBe("notif-1");
      expect(result.type).toBe("new_controversy");
    });

    it("should throw error for invalid notification type", async () => {
      await expect(
        createNotification({
          userId: "user-1",
          type: "invalid" as any,
          title: "Test",
          message: "Test message",
        })
      ).rejects.toThrow("Invalid notification type");
    });

    it("should throw error if user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        createNotification({
          userId: "user-1",
          type: "new_controversy",
          title: "Test",
          message: "Test message",
        })
      ).rejects.toThrow("User not found");
    });
  });

  describe("getNotifications", () => {
    it("should return notifications for user", async () => {
      const mockNotifications = [
        { id: "notif-1", userId: "user-1", type: "new_controversy", isRead: false },
        { id: "notif-2", userId: "user-1", type: "new_bill", isRead: true },
      ];

      vi.mocked(prisma.notification.findMany).mockResolvedValue(mockNotifications as any);

      const result = await getNotifications("user-1");

      expect(result).toHaveLength(2);
    });

    it("should filter unread only", async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

      await getNotifications("user-1", { unreadOnly: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: false }),
        })
      );
    });

    it("should filter by type", async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

      await getNotifications("user-1", { type: "new_bill" });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "new_bill" }),
        })
      );
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      const mockNotification = { id: "notif-1", isRead: false };
      const updatedNotification = { id: "notif-1", isRead: true };

      vi.mocked(prisma.notification.findUnique).mockResolvedValue(mockNotification as any);
      vi.mocked(prisma.notification.update).mockResolvedValue(updatedNotification as any);

      const result = await markAsRead("notif-1");

      expect(result.isRead).toBe(true);
    });

    it("should throw error if notification not found", async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

      await expect(markAsRead("notif-1")).rejects.toThrow("Notification not found");
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all notifications as read", async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 } as any);

      const result = await markAllAsRead("user-1");

      expect(result).toBe(5);
    });
  });

  describe("getUnreadCount", () => {
    it("should return unread count", async () => {
      vi.mocked(prisma.notification.count).mockResolvedValue(3);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(3);
    });
  });

  describe("deleteNotification", () => {
    it("should delete notification", async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValue({ id: "notif-1" } as any);
      vi.mocked(prisma.notification.delete).mockResolvedValue({} as any);

      const result = await deleteNotification("notif-1");

      expect(result).toBe(true);
    });

    it("should throw error if notification not found", async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

      await expect(deleteNotification("notif-1")).rejects.toThrow("Notification not found");
    });
  });

  describe("getOrCreatePreferences", () => {
    it("should return existing preferences", async () => {
      const mockPreferences = { id: "pref-1", userId: "user-1", ...DEFAULT_PREFERENCES };

      vi.mocked(prisma.notificationPreferences.findUnique).mockResolvedValue(
        mockPreferences as any
      );

      const result = await getOrCreatePreferences("user-1");

      expect(result.id).toBe("pref-1");
      expect(prisma.notificationPreferences.create).not.toHaveBeenCalled();
    });

    it("should create preferences if not exist", async () => {
      const mockPreferences = { id: "pref-1", userId: "user-1", ...DEFAULT_PREFERENCES };

      vi.mocked(prisma.notificationPreferences.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.notificationPreferences.create).mockResolvedValue(mockPreferences as any);

      const result = await getOrCreatePreferences("user-1");

      expect(result.id).toBe("pref-1");
      expect(prisma.notificationPreferences.create).toHaveBeenCalled();
    });
  });

  describe("updatePreferences", () => {
    it("should update preferences", async () => {
      const mockPreferences = { id: "pref-1", userId: "user-1", ...DEFAULT_PREFERENCES };
      const updatedPreferences = { ...mockPreferences, newControversy: false };

      vi.mocked(prisma.notificationPreferences.findUnique).mockResolvedValue(
        mockPreferences as any
      );
      vi.mocked(prisma.notificationPreferences.update).mockResolvedValue(updatedPreferences as any);

      const result = await updatePreferences("user-1", { newControversy: false });

      expect(result.newControversy).toBe(false);
    });
  });

  describe("triggerNotificationsForPolitician", () => {
    it("should create notifications for bookmarked users", async () => {
      const mockBookmarks = [
        {
          userId: "user-1",
          politicianId: "pol-1",
          User: {
            NotificationPreferences: {
              inApp: true,
              newControversy: true,
            },
          },
        },
        {
          userId: "user-2",
          politicianId: "pol-1",
          User: {
            NotificationPreferences: {
              inApp: true,
              newControversy: true,
            },
          },
        },
      ];

      vi.mocked(prisma.bookmark.findMany).mockResolvedValue(mockBookmarks as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(prisma.notification.create).mockResolvedValue({ id: "notif-1" } as any);

      const result = await triggerNotificationsForPolitician({
        type: "new_controversy",
        politicianId: "pol-1",
        politicianName: "Test Politician",
        entityId: "controversy-1",
        entityType: "controversy",
        title: "New Controversy",
        message: "A new controversy has been reported",
      });

      expect(result).toBe(2);
    });

    it("should skip users with disabled preferences", async () => {
      const mockBookmarks = [
        {
          userId: "user-1",
          politicianId: "pol-1",
          User: {
            NotificationPreferences: {
              inApp: false,
              newControversy: true,
            },
          },
        },
      ];

      vi.mocked(prisma.bookmark.findMany).mockResolvedValue(mockBookmarks as any);

      const result = await triggerNotificationsForPolitician({
        type: "new_controversy",
        politicianId: "pol-1",
        politicianName: "Test Politician",
        entityId: "controversy-1",
        entityType: "controversy",
        title: "New Controversy",
        message: "A new controversy has been reported",
      });

      expect(result).toBe(0);
    });
  });

  describe("scheduleElectionReminders", () => {
    it("should schedule reminders for future election", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 45);

      const reminders = scheduleElectionReminders(futureDate, "National");

      expect(reminders.length).toBeGreaterThan(0);
      expect(reminders[0]?.electionType).toBe("National");
    });

    it("should not schedule reminders for past election", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const reminders = scheduleElectionReminders(pastDate, "National");

      expect(reminders).toHaveLength(0);
    });
  });
});
