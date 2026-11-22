/**
 * Profile Content Component
 *
 * Displays user profile information, verification status, and settings.
 * Requirements: 16.2, 16.3, 16.4
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  isVerified: boolean;
  verificationMethod: "national_id" | "passport" | null;
  verifiedAt: string | null;
  language: string;
  createdAt: string;
  lastLoginAt: string | null;
}

type ProfileTab = "overview" | "features" | "settings";

export function ProfileContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/auth/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
      } else if (response.status === 401) {
        router.push("/auth/login");
      } else {
        setError("Hindi ma-load ang profile");
      }
    } catch {
      setError("May problema sa connection");
    } finally {
      setIsLoading(false);
    }
  };

  // Requirement 16.4: Clear session while preserving locally stored preferences
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // Local storage preferences are preserved (bookmarks, etc.)
      router.push("/");
    } catch {
      setError("Hindi ma-logout. Subukan muli.");
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error && !profile) {
    return (
      <div className="card text-center">
        <p className="text-error-600 dark:text-error-400">{error}</p>
        <button onClick={() => router.push("/auth/login")} className="btn-primary mt-4">
          Mag-login
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card text-center">
        <p className="text-neutral-600 dark:text-neutral-400">Hindi ka naka-login.</p>
        <button onClick={() => router.push("/auth/login")} className="btn-primary mt-4">
          Mag-login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="card">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="bg-primary-100 dark:bg-primary-900 flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full">
            <UserIcon className="text-primary-600 dark:text-primary-400 h-10 w-10" />
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Aking Profile</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {profile.isVerified ? (
                <span className="badge-success flex items-center gap-1">
                  <CheckIcon className="h-3 w-3" />
                  Verified
                </span>
              ) : (
                <span className="badge-warning flex items-center gap-1">
                  <AlertIcon className="h-3 w-3" />
                  Hindi pa verified
                </span>
              )}
              {profile.verificationMethod && (
                <span className="badge-primary">
                  {profile.verificationMethod === "national_id" ? "National ID" : "Passport"}
                </span>
              )}
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="btn-outline flex items-center gap-2"
          >
            {isLoggingOut ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : (
              <LogoutIcon className="h-4 w-4" />
            )}
            Mag-logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="-mb-px flex gap-6">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={activeTab === "features"} onClick={() => setActiveTab("features")}>
            Features
          </TabButton>
          <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>
            Settings
          </TabButton>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab profile={profile} />}
      {activeTab === "features" && <FeaturesTab isVerified={profile.isVerified} />}
      {activeTab === "settings" && <SettingsTab profile={profile} />}
    </div>
  );
}

// Tab Button Component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary-500 text-primary-600 dark:text-primary-400"
          : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

// Overview Tab
function OverviewTab({ profile }: { profile: UserProfile }) {
  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
        Account Information
      </h2>
      <dl className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:gap-4">
          <dt className="text-sm font-medium text-neutral-500 sm:w-40 dark:text-neutral-400">
            Account ID
          </dt>
          <dd className="text-sm text-neutral-900 dark:text-white">{profile.id.slice(0, 8)}...</dd>
        </div>
        <div className="flex flex-col sm:flex-row sm:gap-4">
          <dt className="text-sm font-medium text-neutral-500 sm:w-40 dark:text-neutral-400">
            Verification Status
          </dt>
          <dd className="text-sm text-neutral-900 dark:text-white">
            {profile.isVerified ? "Verified" : "Not Verified"}
          </dd>
        </div>
        {profile.verificationMethod && (
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="text-sm font-medium text-neutral-500 sm:w-40 dark:text-neutral-400">
              Verification Method
            </dt>
            <dd className="text-sm text-neutral-900 dark:text-white">
              {profile.verificationMethod === "national_id"
                ? "Philippine National ID"
                : "Philippine Passport"}
            </dd>
          </div>
        )}
        {profile.verifiedAt && (
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="text-sm font-medium text-neutral-500 sm:w-40 dark:text-neutral-400">
              Verified On
            </dt>
            <dd className="text-sm text-neutral-900 dark:text-white">
              {new Date(profile.verifiedAt).toLocaleDateString("fil-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </dd>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:gap-4">
          <dt className="text-sm font-medium text-neutral-500 sm:w-40 dark:text-neutral-400">
            Member Since
          </dt>
          <dd className="text-sm text-neutral-900 dark:text-white">
            {new Date(profile.createdAt).toLocaleDateString("fil-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </dd>
        </div>
        {profile.lastLoginAt && (
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="text-sm font-medium text-neutral-500 sm:w-40 dark:text-neutral-400">
              Last Login
            </dt>
            <dd className="text-sm text-neutral-900 dark:text-white">
              {new Date(profile.lastLoginAt).toLocaleDateString("fil-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// Features Tab - Requirement 16.3
function FeaturesTab({ isVerified }: { isVerified: boolean }) {
  const features = [
    {
      name: "Bookmarks",
      description: "I-save ang mga pulitiko na gusto mong i-track",
      icon: BookmarkIcon,
      enabled: isVerified,
      href: "/bookmarks",
    },
    {
      name: "Voting List",
      description: "Gumawa ng listahan ng mga kandidato na iboboto mo",
      icon: ListIcon,
      enabled: isVerified,
      href: "/voting-list",
    },
    {
      name: "Notifications",
      description: "Makatanggap ng updates tungkol sa mga pulitiko na sinusubaybayan mo",
      icon: BellIcon,
      enabled: isVerified,
      href: "/notifications",
    },
  ];

  return (
    <div className="space-y-4">
      {!isVerified && (
        <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertIcon className="text-warning-500 h-5 w-5 flex-shrink-0" />
            <div className="text-warning-700 dark:text-warning-300 text-sm">
              <p className="font-medium">Kailangan mo munang mag-verify</p>
              <p className="mt-1">
                Para ma-access ang mga personalized features, kailangan mo munang i-verify ang iyong
                identity.
              </p>
              <a
                href="/auth/login"
                className="text-warning-800 dark:text-warning-200 mt-2 inline-block font-medium underline hover:no-underline"
              >
                Mag-verify ngayon →
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.name}
            className={`card transition-all ${
              feature.enabled
                ? "hover:border-primary-200 hover:shadow-soft dark:hover:border-primary-800 cursor-pointer"
                : "opacity-60"
            }`}
          >
            {feature.enabled ? (
              <a href={feature.href} className="block">
                <FeatureContent feature={feature} />
              </a>
            ) : (
              <FeatureContent feature={feature} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureContent({
  feature,
}: {
  feature: {
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    enabled: boolean;
  };
}) {
  const Icon = feature.icon;
  return (
    <>
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${
          feature.enabled
            ? "bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400"
            : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-neutral-900 dark:text-white">{feature.name}</h3>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{feature.description}</p>
      {!feature.enabled && (
        <span className="mt-2 inline-block text-xs text-neutral-400">
          Kailangan ng verification
        </span>
      )}
    </>
  );
}

// Settings Tab
function SettingsTab({ profile }: { profile: UserProfile }) {
  const [language, setLanguage] = useState(profile.language);
  const [isSaving, setIsSaving] = useState(false);

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage);
    setIsSaving(true);
    try {
      await fetch("/api/auth/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLanguage }),
      });
    } catch {
      // Revert on error
      setLanguage(profile.language);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">Preferences</h2>

        <div className="space-y-6">
          {/* Language Setting */}
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Language / Wika
            </label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isSaving}
              className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-900 focus:ring-2 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
            >
              <option value="en">English</option>
              <option value="fil">Filipino (Tagalog)</option>
              <option value="ceb">Cebuano</option>
              <option value="ilo">Ilocano</option>
              <option value="hil">Hiligaynon</option>
            </select>
          </div>

          {/* Data Privacy Notice */}
          <div className="rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
            <h3 className="font-medium text-neutral-900 dark:text-white">Data Privacy</h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Hindi namin iniimbak ang iyong National ID o Passport number. Ang verification status
              lang ang naka-save sa iyong account.
            </p>
          </div>
        </div>
      </div>

      {/* Notification Settings - Requirements 19.5, 19.6 */}
      {profile.isVerified && <NotificationSettingsSection />}
    </div>
  );
}

// Notification Settings Section Component
function NotificationSettingsSection() {
  const [preferences, setPreferences] = useState<{
    email: boolean;
    inApp: boolean;
    newControversy: boolean;
    newBill: boolean;
    billPassed: boolean;
    redFlag: boolean;
    electionReminder: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch("/api/notifications/preferences");
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: string, value: boolean) => {
    if (!preferences) {
      return;
    }

    setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));
    setIsSaving(true);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      // Revert on error
      setPreferences((prev) => (prev ? { ...prev, [key]: !value } : null));
      console.error("Error updating preference:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="h-6 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!preferences) {
    return null;
  }

  const allDisabled = !preferences.email && !preferences.inApp;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Notification Settings
        </h2>
        <a
          href="/notifications/settings"
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-sm"
        >
          View all settings →
        </a>
      </div>

      <div className="space-y-4">
        {/* Quick toggles for main channels */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-neutral-900 dark:text-white">In-App Notifications</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Makatanggap ng notifications sa app
            </p>
          </div>
          <ToggleSwitch
            checked={preferences.inApp}
            onChange={(value) => updatePreference("inApp", value)}
            disabled={isSaving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-neutral-900 dark:text-white">Email Notifications</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Makatanggap ng notifications sa email
            </p>
          </div>
          <ToggleSwitch
            checked={preferences.email}
            onChange={(value) => updatePreference("email", value)}
            disabled={isSaving}
          />
        </div>

        {allDisabled && (
          <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-3">
            <p className="text-warning-700 dark:text-warning-300 text-sm">
              Naka-disable ang notifications. Hindi ka makakatanggap ng updates tungkol sa mga
              pulitiko na sinusubaybayan mo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Toggle Switch Component
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`focus:ring-primary-500 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-offset-2 focus:outline-none ${
        checked ? "bg-primary-500" : "bg-neutral-200 dark:bg-neutral-700"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Profile Skeleton
function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Icon Components
function UserIcon({ className }: { className?: string }) {
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
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}

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

function LogoutIcon({ className }: { className?: string }) {
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
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
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
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
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
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

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
