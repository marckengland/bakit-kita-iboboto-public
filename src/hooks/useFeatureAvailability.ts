/**
 * Hook for checking feature availability during graceful degradation
 *
 * Validates: Requirement 44.7
 * THE System SHALL gracefully degrade non-critical features under extreme load
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { DEGRADABLE_FEATURES } from "@/lib/monitoring-service";

interface FeatureAvailability {
  available: boolean;
  loading: boolean;
  error: string | null;
  message?: string;
}

interface DegradationState {
  enabled: boolean;
  degradedFeatures: string[];
}

/**
 * Hook to check if a specific feature is available
 */
export function useFeatureAvailability(feature: string): FeatureAvailability {
  const [state, setState] = useState<FeatureAvailability>({
    available: true,
    loading: true,
    error: null,
  });

  const checkAvailability = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/monitoring?view=degradation");
      const data = await response.json();

      if (data.success) {
        const degradationState = data.data as DegradationState;
        const isDegraded =
          degradationState.enabled && degradationState.degradedFeatures.includes(feature);

        setState({
          available: !isDegraded,
          loading: false,
          error: null,
          message: isDegraded
            ? "This feature is temporarily unavailable due to high system load."
            : undefined,
        });
      } else {
        setState({
          available: true, // Default to available if check fails
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error("Failed to check feature availability:", error);
      setState({
        available: true, // Default to available if check fails
        loading: false,
        error: "Failed to check feature availability",
      });
    }
  }, [feature]);

  useEffect(() => {
    checkAvailability();

    // Re-check every 30 seconds
    const interval = setInterval(checkAvailability, 30000);
    return () => clearInterval(interval);
  }, [checkAvailability]);

  return state;
}

/**
 * Hook to get all degraded features
 */
export function useDegradedFeatures(): {
  degradedFeatures: string[];
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{
    degradedFeatures: string[];
    loading: boolean;
    error: string | null;
  }>({
    degradedFeatures: [],
    loading: true,
    error: null,
  });

  const fetchDegradedFeatures = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/monitoring?view=degradation");
      const data = await response.json();

      if (data.success) {
        const degradationState = data.data as DegradationState;
        setState({
          degradedFeatures: degradationState.enabled ? degradationState.degradedFeatures : [],
          loading: false,
          error: null,
        });
      } else {
        setState({
          degradedFeatures: [],
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error("Failed to fetch degraded features:", error);
      setState({
        degradedFeatures: [],
        loading: false,
        error: "Failed to fetch degraded features",
      });
    }
  }, []);

  useEffect(() => {
    fetchDegradedFeatures();

    // Re-check every 30 seconds
    const interval = setInterval(fetchDegradedFeatures, 30000);
    return () => clearInterval(interval);
  }, [fetchDegradedFeatures]);

  return state;
}

/**
 * Check if a feature is available (utility function for non-React contexts)
 */
export async function checkFeatureAvailable(feature: string): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/monitoring?view=degradation");
    const data = await response.json();

    if (data.success) {
      const degradationState = data.data as DegradationState;
      return !(degradationState.enabled && degradationState.degradedFeatures.includes(feature));
    }
    return true;
  } catch {
    return true; // Default to available if check fails
  }
}

// Export feature constants for convenience
export { DEGRADABLE_FEATURES };

export default {
  useFeatureAvailability,
  useDegradedFeatures,
  checkFeatureAvailable,
  DEGRADABLE_FEATURES,
};
