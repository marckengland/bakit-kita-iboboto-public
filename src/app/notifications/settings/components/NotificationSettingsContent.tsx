/**
 * Notification Settings Content Component
 *
 * Allows users to configure notification preferences.
 * Requirements: 19.5, 19.6
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface NotificationPreferences {
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

export function NotificationSettingsContent() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/notifications/preferences");

      if (response.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch preferences");
      }

      const data = await response.json();
      setPreferences(data.preferences);
    } catch (err) {
      setError("Hindi ma-load ang settings");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) {
      return;
    }

    // Optimistic update
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error("Failed to update preference");
      }

      const data = await response.json();
      setPreferences(data.preferences);
      setSuccessMessage("Na-save ang changes");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      // Revert on error
      setPreferences((prev) => (prev ? { ...prev, [key]: !value } : null));
      setError("Hindi ma-save ang changes");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Requirement 19.6: Disable all notifications while preserving bookmarks
  const handleDisableAll = async () => {
    if (!preferences) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: false,
          inApp: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to disable notifications");
      }

      const data = await response.json();
      setPreferences(data.preferences);
      setSuccessMessage("Na-disable ang lahat ng notifications");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError("Hindi ma-disable ang notifications");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnableAll = async () => {
    if (!preferences) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: true,
          inApp: true,
          newControversy: true,
          newBill: true,
          billPassed: true,
          redFlag: true,
          electionReminder: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to enable notifications");
      }

      const data = await response.json();
      setPreferences(data.preferences);
      setSuccessMessage("Na-enable ang lahat ng notifications");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError("Hindi ma-enable ang notifications");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  if (error && !preferences) {
    return (
      <div className="card text-center">
        <p className="text-error-600 dark:text-error-400">{error}</p>
        <button onClick={fetchPreferences} className="btn-primary mt-4">
          Subukan muli
        </button>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="card text-center">
        <p className="text-neutral-600 dark:text-neutral-400">Hindi ka naka-login.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">
          Mag-login
        </Link>
      </div>
    );
  }

  const allDisabled = !preferences.email && !preferences.inApp;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Notification Settings
        </h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          I-configure kung paano ka makakatanggap ng updates tungkol sa mga pulitiko na
          sinusubaybayan mo.
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-4">
          <div className="text-success-700 dark:text-success-300 flex items-center gap-2">
            <CheckIcon className="h-5 w-5" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {error && preferences && (
        <div className="bg-error-50 dark:bg-error-900/20 rounded-lg p-4">
          <div className="text-error-700 dark:text-error-300 flex items-center gap-2">
            <AlertIcon className="h-5 w-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Delivery Channels - Requirement 19.5 */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
          Delivery Channels
        </h2>
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Piliin kung paano mo gustong makatanggap ng notifications.
        </p>

        <div className="space-y-4">
          <ToggleSetting
            label="In-App Notifications"
            description="Makatanggap ng notifications sa loob ng app"
            checked={preferences.inApp}
            onChange={(value) => updatePreference("inApp", value)}
            disabled={isSaving}
          />
          <ToggleSetting
            label="Email Notifications"
            description="Makatanggap ng notifications sa iyong email"
            checked={preferences.email}
            onChange={(value) => updatePreference("email", value)}
            disabled={isSaving}
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-700">
          {allDisabled ? (
            <button onClick={handleEnableAll} disabled={isSaving} className="btn-primary text-sm">
              Enable All Notifications
            </button>
          ) : (
            <button onClick={handleDisableAll} disabled={isSaving} className="btn-outline text-sm">
              Disable All Notifications
            </button>
          )}
        </div>
      </div>

      {/* Notification Types */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
          Notification Types
        </h2>
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Piliin kung anong uri ng updates ang gusto mong matanggap.
        </p>

        <div className="space-y-4">
          {/* Requirement 19.1: New controversy notifications */}
          <ToggleSetting
            label="Bagong Controversies"
            description="Kapag may bagong documented controversy o legal case ang bookmarked politician"
            checked={preferences.newControversy}
            onChange={(value) => updatePreference("newControversy", value)}
            disabled={isSaving || allDisabled}
            icon={<AlertTriangleIcon className="text-error-500 h-5 w-5" />}
          />

          {/* Requirement 19.2: Red flag notifications */}
          <ToggleSetting
            label="Red Flag Alerts"
            description="Kapag may bagong red flag indicators ang politician sa voting list mo"
            checked={preferences.redFlag}
            onChange={(value) => updatePreference("redFlag", value)}
            disabled={isSaving || allDisabled}
            icon={<FlagIcon className="text-warning-500 h-5 w-5" />}
          />

          {/* Requirement 19.3: New bill notifications */}
          <ToggleSetting
            label="Bagong Bills"
            description="Kapag nag-file ng bagong bill ang bookmarked politician"
            checked={preferences.newBill}
            onChange={(value) => updatePreference("newBill", value)}
            disabled={isSaving || allDisabled}
            icon={<DocumentIcon className="text-primary-500 h-5 w-5" />}
          />

          {/* Requirement 19.3: Bill passed notifications */}
          <ToggleSetting
            label="Naging Batas"
            description="Kapag naging batas ang bill ng bookmarked politician"
            checked={preferences.billPassed}
            onChange={(value) => updatePreference("billPassed", value)}
            disabled={isSaving || allDisabled}
            icon={<CheckCircleIcon className="text-success-500 h-5 w-5" />}
          />

          {/* Election reminders */}
          <ToggleSetting
            label="Election Reminders"
            description="Makatanggap ng reminders bago ang election day"
            checked={preferences.electionReminder}
            onChange={(value) => updatePreference("electionReminder", value)}
            disabled={isSaving || allDisabled}
            icon={<CalendarIcon className="text-accent-500 h-5 w-5" />}
          />
        </div>

        {allDisabled && (
          <div className="bg-warning-50 dark:bg-warning-900/20 mt-4 rounded-lg p-3">
            <p className="text-warning-700 dark:text-warning-300 text-sm">
              Naka-disable ang lahat ng notification channels. I-enable ang in-app o email
              notifications para makatanggap ng updates.
            </p>
          </div>
        )}
      </div>

      {/* Info Box - Requirement 19.6 */}
      <div className="rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
        <h3 className="font-medium text-neutral-900 dark:text-white">Tungkol sa Notifications</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Ang pag-disable ng notifications ay hindi maaapektuhan ang iyong bookmarks at voting list.
          Mananatili ang mga ito kahit i-off mo ang notifications.
        </p>
      </div>
    </div>
  );
}

// Toggle Setting Component
interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
  disabled,
  icon,
}: ToggleSettingProps) {
  return (
    <div className={`flex items-start gap-4 ${disabled ? "opacity-50" : ""}`}>
      {icon && <div className="flex-shrink-0 pt-0.5">{icon}</div>}
      <div className="min-w-0 flex-1">
        <label className="flex cursor-pointer items-center justify-between">
          <div>
            <p className="font-medium text-neutral-900 dark:text-white">{label}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`focus:ring-primary-500 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-offset-2 focus:outline-none ${
              checked ? "bg-primary-500" : "bg-neutral-200 dark:bg-neutral-700"
            } ${disabled ? "cursor-not-allowed" : ""}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                checked ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  );
}

// Settings Skeleton
function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
      <div className="card">
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
              <div className="h-6 w-11 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
              <div className="h-6 w-11 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Icon Components
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
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
