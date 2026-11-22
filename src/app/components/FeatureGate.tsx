"use client";

/**
 * Feature Gate Component
 * Wraps features that can be gracefully degraded under high load
 *
 * Validates: Requirement 44.7
 * THE System SHALL gracefully degrade non-critical features under extreme load
 */

import { ReactNode } from "react";
import { useFeatureAvailability, DEGRADABLE_FEATURES } from "@/hooks/useFeatureAvailability";

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showLoading?: boolean;
}

/**
 * Component wrapper that shows fallback when feature is degraded
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showLoading = false,
}: FeatureGateProps) {
  const { available, loading } = useFeatureAvailability(feature);

  if (loading) {
    if (showLoading) {
      return (
        <div className="animate-pulse rounded-lg bg-gray-100 p-4">
          <div className="h-4 w-3/4 rounded bg-gray-200"></div>
        </div>
      );
    }
    return null;
  }

  if (!available) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
        <p className="font-medium">Feature Temporarily Unavailable</p>
        <p className="mt-1 text-sm">
          This feature is temporarily disabled due to high system load. Please try again later.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Pre-configured feature gates for common degradable features
 */
export function AIChatbotGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature={DEGRADABLE_FEATURES.AI_CHATBOT} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export function AutocompleteGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature={DEGRADABLE_FEATURES.AUTOCOMPLETE} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export function ComparisonToolGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature={DEGRADABLE_FEATURES.COMPARISON_TOOL} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export function PDFExportGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature={DEGRADABLE_FEATURES.PDF_EXPORT} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export function NotificationsGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature={DEGRADABLE_FEATURES.REAL_TIME_NOTIFICATIONS} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export function FamilyNetworkGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature={DEGRADABLE_FEATURES.FAMILY_NETWORK_VISUALIZATION} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export function SentimentAnalysisGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature={DEGRADABLE_FEATURES.SENTIMENT_ANALYSIS} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export function SocialSharingGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature={DEGRADABLE_FEATURES.SOCIAL_SHARING} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

export { DEGRADABLE_FEATURES };

export default FeatureGate;
