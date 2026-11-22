/**
 * Notification Service
 *
 * Handles notification creation, delivery, and preference management.
 *
 * **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 17.4, 17.6**
 */

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ============================================
// Types and Interfaces
// ============================================

export type NotificationType =
  | "new_controversy"
  | "new_bill"
  | "bill_passed"
  | "red_flag"
  | "election_reminder";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  politicianId: string | null;
  politicianName: string | null;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  email: boolean;
  inApp: boolean;
  newControversy: boolean;
  newBill: boolean;
  billPassed: boolean;
  redFlag: boolean;
  electionReminder: boolean;
}

export interface CreateNotificationRequest {
  userId: string;
  type: NotificationType;
  politicianId?: string;
  politicianName?: string;
  title: string;
  message: string;
  link?: string;
}

export interface NotificationTrigger {
  type: NotificationType;
  politicianId: string;
  politicianName: string;
  entityId: string;
  entityType: string;
  title: string;
  message: string;
  link?: string;
}

export interface ElectionReminder {
  electionDate: Date;
  electionType: string;
  daysUntil: number;
  message: string;
}

// ============================================
// Error Classes
// ============================================

export class NotificationError extends Error {
  constructor(
    message: string,
    public code:
      | "USER_NOT_FOUND"
      | "NOTIFICATION_NOT_FOUND"
      | "PREFERENCES_NOT_FOUND"
      | "INVALID_TYPE"
  ) {
    super(message);
    this.name = "NotificationError";
  }
}

// ============================================
// Constants
// ============================================

export const NOTIFICATION_TYPES: NotificationType[] = [
  "new_controversy",
  "new_bill",
  "bill_passed",
  "red_flag",
  "election_reminder",
];

export const ELECTION_REMINDER_DAYS = [30, 7, 1]; // Days before election to send reminders

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "id" | "userId"> = {
  email: true,
  inApp: true,
  newControversy: true,
  newBill: true,
  billPassed: true,
  redFlag: true,
  electionReminder: true,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Validate notification type
 */
export function isValidNotificationType(type: string): type is NotificationType {
  return NOTIFICATION_TYPES.includes(type as NotificationType);
}

/**
 * Get preference key for notification type
 */
export function getPreferenceKey(
  type: NotificationType
): keyof Omit<NotificationPreferences, "id" | "userId" | "email" | "inApp"> {
  const mapping: Record<
    NotificationType,
    keyof Omit<NotificationPreferences, "id" | "userId" | "email" | "inApp">
  > = {
    new_controversy: "newControversy",
    new_bill: "newBill",
    bill_passed: "billPassed",
    red_flag: "redFlag",
    election_reminder: "electionReminder",
  };
  return mapping[type];
}

/**
 * Check if user should receive notification based on preferences
 */
export function shouldNotify(
  preferences: NotificationPreferences,
  type: NotificationType,
  channel: "email" | "inApp"
): boolean {
  // Check if channel is enabled
  if (!preferences[channel]) {
    return false;
  }

  // Check if notification type is enabled
  const preferenceKey = getPreferenceKey(type);
  return preferences[preferenceKey];
}

/**
 * Generate election reminder message
 */
export function generateElectionReminderMessage(daysUntil: number, electionType: string): string {
  if (daysUntil === 0) {
    return `Today is ${electionType} Election Day! Don't forget to vote.`;
  } else if (daysUntil === 1) {
    return `Tomorrow is ${electionType} Election Day! Make sure you're ready to vote.`;
  } else {
    return `${daysUntil} days until ${electionType} Elections. Review your voting list!`;
  }
}

// ============================================
// Notification Operations
// ============================================

/**
 * Create a notification for a user
 */
export async function createNotification(
  request: CreateNotificationRequest
): Promise<Notification> {
  const { userId, type, politicianId, politicianName, title, message, link } = request;

  if (!isValidNotificationType(type)) {
    throw new NotificationError("Invalid notification type", "INVALID_TYPE");
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotificationError("User not found", "USER_NOT_FOUND");
  }

  const notification = await prisma.notification.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      type,
      politicianId: politicianId ?? null,
      politicianName: politicianName ?? null,
      title,
      message,
      link: link ?? null,
      isRead: false,
    },
  });

  return notification as Notification;
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean;
    type?: NotificationType;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Notification[]> {
  const { unreadOnly = false, type, limit = 50, offset = 0 } = options;

  const where: { userId: string; isRead?: boolean; type?: NotificationType } = { userId };

  if (unreadOnly) {
    where.isRead = false;
  }

  if (type) {
    where.type = type;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return notifications as Notification[];
}

/**
 * Mark notification as read for trusted internal callers.
 * HTTP handlers must use markAsReadForUser to enforce ownership.
 */
export async function markAsRead(notificationId: string): Promise<Notification> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotificationError("Notification not found", "NOTIFICATION_NOT_FOUND");
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return updated as Notification;
}

/**
 * Mark a notification as read only if it belongs to the authenticated user.
 * Ownership is part of the atomic update predicate to avoid check/write races.
 */
export async function markAsReadForUser(
  notificationId: string,
  userId: string
): Promise<Notification> {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new NotificationError("User is required", "USER_NOT_FOUND");
  }

  try {
    return (await prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true },
    })) as Notification;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotificationError("Notification not found", "NOTIFICATION_NOT_FOUND");
    }
    throw error;
  }
}

/**
 * Delete a notification only if it belongs to the authenticated user.
 */
export async function deleteNotificationForUser(
  notificationId: string,
  userId: string
): Promise<boolean> {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new NotificationError("User is required", "USER_NOT_FOUND");
  }

  try {
    await prisma.notification.delete({
      where: { id: notificationId, userId },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotificationError("Notification not found", "NOTIFICATION_NOT_FOUND");
    }
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return result.count;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

/**
 * Delete a notification for trusted internal callers.
 * HTTP handlers must use deleteNotificationForUser to enforce ownership.
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotificationError("Notification not found", "NOTIFICATION_NOT_FOUND");
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return true;
}

// ============================================
// Notification Preferences
// ============================================

/**
 * Get or create notification preferences for a user
 */
export async function getOrCreatePreferences(userId: string): Promise<NotificationPreferences> {
  let preferences = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });

  if (!preferences) {
    preferences = await prisma.notificationPreferences.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        updatedAt: new Date(),
        ...DEFAULT_PREFERENCES,
      },
    });
  }

  return preferences as NotificationPreferences;
}

/**
 * Update notification preferences
 */
export async function updatePreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, "id" | "userId">>
): Promise<NotificationPreferences> {
  // Ensure preferences exist
  await getOrCreatePreferences(userId);

  const preferences = await prisma.notificationPreferences.update({
    where: { userId },
    data: updates,
  });

  return preferences as NotificationPreferences;
}

// ============================================
// Notification Triggers
// ============================================

/**
 * Trigger notifications for bookmarked politician events
 */
export async function triggerNotificationsForPolitician(
  trigger: NotificationTrigger
): Promise<number> {
  // Find all users who bookmarked this politician
  const bookmarks = await prisma.bookmark.findMany({
    where: { politicianId: trigger.politicianId },
    include: {
      User: {
        include: {
          NotificationPreferences: true,
        },
      },
    },
  });

  let notificationCount = 0;

  for (const bookmark of bookmarks) {
    const preferences = bookmark.User.NotificationPreferences;

    // Check if user wants this type of notification
    if (preferences && shouldNotify(preferences, trigger.type, "inApp")) {
      await createNotification({
        userId: bookmark.userId,
        type: trigger.type,
        politicianId: trigger.politicianId,
        politicianName: trigger.politicianName,
        title: trigger.title,
        message: trigger.message,
        link: trigger.link,
      });
      notificationCount++;
    }
  }

  return notificationCount;
}

/**
 * Schedule election reminders
 */
export function scheduleElectionReminders(
  electionDate: Date,
  electionType: string
): ElectionReminder[] {
  const now = new Date();
  const reminders: ElectionReminder[] = [];

  for (const daysBeforeElection of ELECTION_REMINDER_DAYS) {
    const reminderDate = new Date(electionDate);
    reminderDate.setDate(reminderDate.getDate() - daysBeforeElection);

    if (reminderDate > now) {
      const daysUntil = Math.ceil((electionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      reminders.push({
        electionDate,
        electionType,
        daysUntil,
        message: generateElectionReminderMessage(daysBeforeElection, electionType),
      });
    }
  }

  return reminders;
}

/**
 * Send election reminders to all users with election reminder preference enabled
 */
export async function sendElectionReminders(
  electionType: string,
  daysUntil: number
): Promise<number> {
  // Find all users with election reminder enabled
  const preferences = await prisma.notificationPreferences.findMany({
    where: {
      electionReminder: true,
      inApp: true,
    },
  });

  const message = generateElectionReminderMessage(daysUntil, electionType);
  let notificationCount = 0;

  for (const pref of preferences) {
    await createNotification({
      userId: pref.userId,
      type: "election_reminder",
      title: `${electionType} Election Reminder`,
      message,
      link: "/elections",
    });
    notificationCount++;
  }

  return notificationCount;
}
