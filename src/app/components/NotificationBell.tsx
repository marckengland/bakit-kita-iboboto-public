/**
 * Notification Bell Component
 *
 * Displays a notification bell icon with unread count badge and dropdown.
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = "" }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check authentication and fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/notifications?limit=5");

      if (response.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <BellIcon className="h-6 w-6" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="bg-error-500 absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg sm:w-96 dark:border-neutral-700 dark:bg-neutral-800">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner className="text-primary-500 h-6 w-6" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <BellOffIcon className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  Walang notifications
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onClose={() => setIsOpen(false)}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 block text-center text-sm font-medium"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Notification Item Component
interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onClose: () => void;
}

function NotificationItem({ notification, onMarkAsRead, onClose }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    onClose();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_controversy":
        return <AlertTriangleIcon className="text-error-500 h-5 w-5" />;
      case "new_bill":
        return <DocumentIcon className="text-primary-500 h-5 w-5" />;
      case "bill_passed":
        return <CheckCircleIcon className="text-success-500 h-5 w-5" />;
      case "red_flag":
        return <FlagIcon className="text-warning-500 h-5 w-5" />;
      case "election_reminder":
        return <CalendarIcon className="text-accent-500 h-5 w-5" />;
      default:
        return <BellIcon className="h-5 w-5 text-neutral-500" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "Just now";
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString("fil-PH", { month: "short", day: "numeric" });
  };

  const content = (
    <div
      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/50 ${
        !notification.isRead ? "bg-primary-50/50 dark:bg-primary-900/10" : ""
      }`}
    >
      <div className="flex-shrink-0 pt-0.5">{getNotificationIcon(notification.type)}</div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${!notification.isRead ? "font-semibold" : ""} text-neutral-900 dark:text-white`}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {formatTime(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && (
        <div className="flex-shrink-0">
          <span className="bg-primary-500 h-2 w-2 rounded-full" />
        </div>
      )}
    </div>
  );

  if (notification.link) {
    return (
      <li>
        <Link href={notification.link} onClick={handleClick}>
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button onClick={handleClick} className="w-full text-left">
        {content}
      </button>
    </li>
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
