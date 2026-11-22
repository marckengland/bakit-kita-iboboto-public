/**
 * Notifications Content Component
 *
 * Main content for the notifications page with filtering and management.
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  politicianId: string | null;
  politicianName: string | null;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

type NotificationFilter =
  | "all"
  | "unread"
  | "new_controversy"
  | "new_bill"
  | "bill_passed"
  | "red_flag"
  | "election_reminder";

export function NotificationsContent() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchNotifications = useCallback(
    async (reset = false) => {
      try {
        setIsLoading(true);
        const currentOffset = reset ? 0 : offset;

        let url = `/api/notifications?limit=20&offset=${currentOffset}`;
        if (filter === "unread") {
          url += "&unreadOnly=true";
        } else if (filter !== "all") {
          url += `&type=${filter}`;
        }

        const response = await fetch(url);

        if (response.status === 401) {
          router.push("/auth/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch notifications");
        }

        const data = await response.json();

        if (reset) {
          setNotifications(data.notifications);
          setOffset(20);
        } else {
          setNotifications((prev) => [...prev, ...data.notifications]);
          setOffset((prev) => prev + 20);
        }

        setUnreadCount(data.unreadCount);
        setHasMore(data.pagination.hasMore);
      } catch (err) {
        setError("Hindi ma-load ang notifications");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [filter, offset, router]
  );

  useEffect(() => {
    fetchNotifications(true);
  }, [filter]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const filterOptions: { value: NotificationFilter; label: string }[] = [
    { value: "all", label: "Lahat" },
    { value: "unread", label: "Hindi pa nabasa" },
    { value: "new_controversy", label: "Controversies" },
    { value: "new_bill", label: "Bagong Bills" },
    { value: "bill_passed", label: "Naging Batas" },
    { value: "red_flag", label: "Red Flags" },
    { value: "election_reminder", label: "Election Reminders" },
  ];

  if (error && notifications.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-error-600 dark:text-error-400">{error}</p>
        <button onClick={() => fetchNotifications(true)} className="btn-primary mt-4">
          Subukan muli
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Notifications</h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            {unreadCount > 0
              ? `May ${unreadCount} na hindi pa nababasang notification`
              : "Wala kang bagong notification"}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllAsRead} className="btn-outline">
              Mark all as read
            </button>
          )}
          <Link href="/notifications/settings" className="btn-outline flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === option.value
                ? "bg-primary-500 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="card overflow-hidden p-0">
        {isLoading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner className="text-primary-500 h-8 w-8" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {notifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="border-t border-neutral-100 p-4 text-center dark:border-neutral-700">
            <button
              onClick={() => fetchNotifications(false)}
              disabled={isLoading}
              className="btn-outline"
            >
              {isLoading ? <LoadingSpinner className="h-4 w-4" /> : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Notification List Item Component
interface NotificationListItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationListItem({ notification, onMarkAsRead, onDelete }: NotificationListItemProps) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_controversy":
        return <AlertTriangleIcon className="text-error-500 h-6 w-6" />;
      case "new_bill":
        return <DocumentIcon className="text-primary-500 h-6 w-6" />;
      case "bill_passed":
        return <CheckCircleIcon className="text-success-500 h-6 w-6" />;
      case "red_flag":
        return <FlagIcon className="text-warning-500 h-6 w-6" />;
      case "election_reminder":
        return <CalendarIcon className="text-accent-500 h-6 w-6" />;
      default:
        return <BellIcon className="h-6 w-6 text-neutral-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "new_controversy":
        return "Controversy";
      case "new_bill":
        return "Bagong Bill";
      case "bill_passed":
        return "Naging Batas";
      case "red_flag":
        return "Red Flag";
      case "election_reminder":
        return "Election Reminder";
      default:
        return "Notification";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fil-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <li
      className={`relative flex gap-4 p-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
        !notification.isRead ? "bg-primary-50/50 dark:bg-primary-900/10" : ""
      }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 pt-1">{getNotificationIcon(notification.type)}</div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {getTypeLabel(notification.type)}
              </span>
              {!notification.isRead && <span className="bg-primary-500 h-2 w-2 rounded-full" />}
            </div>
            <h3
              className={`mt-1 text-base ${!notification.isRead ? "font-semibold" : ""} text-neutral-900 dark:text-white`}
            >
              {notification.title}
            </h3>
            {notification.politicianName && (
              <p className="text-primary-600 dark:text-primary-400 mt-0.5 text-sm">
                {notification.politicianName}
              </p>
            )}
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {notification.message}
            </p>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              {formatDate(notification.createdAt)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {notification.link && (
              <Link
                href={notification.link}
                onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
                className="btn-outline px-3 py-1.5 text-sm"
              >
                View
              </Link>
            )}
            <button
              onClick={() => onDelete(notification.id)}
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
              aria-label="Delete notification"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

// Empty State Component
function EmptyState({ filter }: { filter: NotificationFilter }) {
  const getMessage = () => {
    switch (filter) {
      case "unread":
        return "Wala kang hindi pa nababasang notification.";
      case "new_controversy":
        return "Walang controversy notifications.";
      case "new_bill":
        return "Walang bagong bill notifications.";
      case "bill_passed":
        return "Walang bill passed notifications.";
      case "red_flag":
        return "Walang red flag notifications.";
      case "election_reminder":
        return "Walang election reminder notifications.";
      default:
        return "Wala ka pang notifications. Mag-bookmark ng mga pulitiko para makatanggap ng updates.";
    }
  };

  return (
    <div className="py-12 text-center">
      <BellOffIcon className="mx-auto h-16 w-16 text-neutral-300 dark:text-neutral-600" />
      <p className="mt-4 text-neutral-600 dark:text-neutral-400">{getMessage()}</p>
      {filter === "all" && (
        <Link href="/politicians" className="btn-primary mt-4 inline-block">
          Browse Politicians
        </Link>
      )}
    </div>
  );
}

// Icon Components
function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function BellOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31 8.964 8.964 0 002.3-5.542m3.155 6.852a3 3 0 005.667 1.97m1.965-2.277L21 21m-4.225-4.225a23.81 23.81 0 003.536-1.003A8.967 8.967 0 0118 9.75V9A6 6 0 006.53 6.53m10.245 10.245L6.53 6.53M3 3l3.53 3.53"
      />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
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
