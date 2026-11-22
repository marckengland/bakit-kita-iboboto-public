/**
 * Login Form Component
 *
 * Provides authentication method selection and verification flow.
 * Requirements: 16.1, 16.2, 16.6
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VerificationMethod } from "@/services/auth.service";

type AuthStep = "select" | "verify" | "success" | "error";

interface FormState {
  step: AuthStep;
  method: VerificationMethod | null;
  documentNumber: string;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    step: "select",
    method: null,
    documentNumber: "",
    isLoading: false,
    error: null,
  });

  const handleMethodSelect = (method: VerificationMethod) => {
    setState((prev) => ({
      ...prev,
      method,
      step: "verify",
      error: null,
    }));
  };

  const handleBack = () => {
    setState((prev) => ({
      ...prev,
      step: "select",
      method: null,
      documentNumber: "",
      error: null,
    }));
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setState((prev) => ({
      ...prev,
      documentNumber: value,
      error: null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!state.method || !state.documentNumber) {
      setState((prev) => ({
        ...prev,
        error: "Mangyaring punan ang lahat ng fields",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: state.method,
          documentNumber: state.documentNumber,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setState((prev) => ({ ...prev, step: "success", isLoading: false }));
        // Redirect after short delay
        setTimeout(() => {
          router.push("/auth/profile");
        }, 2000);
      } else {
        // Requirement 16.6: Display clear error message and allow retry
        setState((prev) => ({
          ...prev,
          step: "error",
          isLoading: false,
          error: data.error || "Nabigo ang verification. Subukan muli.",
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        step: "error",
        isLoading: false,
        error: "May problema sa connection. Subukan muli.",
      }));
    }
  };

  const handleRetry = () => {
    setState((prev) => ({
      ...prev,
      step: "verify",
      error: null,
    }));
  };

  // Render based on current step
  switch (state.step) {
    case "select":
      return <MethodSelection onSelect={handleMethodSelect} />;
    case "verify":
      return (
        <VerificationForm
          method={state.method!}
          documentNumber={state.documentNumber}
          isLoading={state.isLoading}
          error={state.error}
          onBack={handleBack}
          onChange={handleDocumentChange}
          onSubmit={handleSubmit}
        />
      );
    case "success":
      return <SuccessMessage />;
    case "error":
      return (
        <ErrorMessage
          error={state.error || "Unknown error"}
          onRetry={handleRetry}
          onBack={handleBack}
        />
      );
  }
}

// Method Selection Component
interface MethodSelectionProps {
  onSelect: (method: VerificationMethod) => void;
}

function MethodSelection({ onSelect }: MethodSelectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
        Pumili ng paraan ng verification
      </p>

      {/* National ID Option - Requirement 16.1 */}
      <button
        onClick={() => onSelect("national_id")}
        className="group hover:border-primary-500 hover:bg-primary-50 dark:hover:border-primary-500 dark:hover:bg-primary-900/20 flex w-full items-center gap-4 rounded-xl border-2 border-neutral-200 p-4 text-left transition-all dark:border-neutral-700"
      >
        <div className="bg-primary-100 text-primary-600 group-hover:bg-primary-500 dark:bg-primary-900 dark:text-primary-400 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl transition-colors group-hover:text-white">
          <NationalIdIcon className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-white">Philippine National ID</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            PhilSys ID (Philippine Identification System)
          </p>
        </div>
        <ChevronRightIcon className="group-hover:text-primary-500 ml-auto h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
      </button>

      {/* Passport Option - Requirement 16.1 */}
      <button
        onClick={() => onSelect("passport")}
        className="group hover:border-primary-500 hover:bg-primary-50 dark:hover:border-primary-500 dark:hover:bg-primary-900/20 flex w-full items-center gap-4 rounded-xl border-2 border-neutral-200 p-4 text-left transition-all dark:border-neutral-700"
      >
        <div className="bg-secondary-100 text-secondary-600 group-hover:bg-secondary-500 dark:bg-secondary-900 dark:text-secondary-400 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl transition-colors group-hover:text-white">
          <PassportIcon className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-white">Philippine Passport</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            DFA-issued Philippine Passport
          </p>
        </div>
        <ChevronRightIcon className="group-hover:text-primary-500 ml-auto h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
}

// Verification Form Component
interface VerificationFormProps {
  method: VerificationMethod;
  documentNumber: string;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function VerificationForm({
  method,
  documentNumber,
  isLoading,
  error,
  onBack,
  onChange,
  onSubmit,
}: VerificationFormProps) {
  const isNationalId = method === "national_id";
  const placeholder = isNationalId ? "XXXX-XXXX-XXXX" : "XX1234567";
  const label = isNationalId ? "National ID Number" : "Passport Number";
  const hint = isNationalId
    ? "Ilagay ang 12-digit PhilSys ID number"
    : "Ilagay ang passport number (hal. AA1234567)";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        className="hover:text-primary-500 flex items-center gap-1 text-sm text-neutral-500"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Bumalik
      </button>

      {/* Method Indicator */}
      <div className="flex items-center gap-3 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
        {isNationalId ? (
          <NationalIdIcon className="text-primary-500 h-6 w-6" />
        ) : (
          <PassportIcon className="text-secondary-500 h-6 w-6" />
        )}
        <span className="font-medium text-neutral-900 dark:text-white">
          {isNationalId ? "Philippine National ID" : "Philippine Passport"}
        </span>
      </div>

      {/* Document Number Input */}
      <div>
        <label
          htmlFor="documentNumber"
          className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          {label}
        </label>
        <input
          id="documentNumber"
          type="text"
          value={documentNumber}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={20}
          className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder-neutral-400 transition-colors focus:ring-2 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
          aria-describedby="documentHint"
          required
        />
        <p id="documentHint" className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || documentNumber.length < 8}
        className="btn-primary w-full py-3 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner className="h-5 w-5" />
            Verifying...
          </span>
        ) : (
          "I-verify ang Identity"
        )}
      </button>

      {/* Privacy Notice */}
      <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        Hindi namin iniimbak ang iyong ID number. Ginagamit lang ito para sa one-time verification.
      </p>
    </form>
  );
}

// Success Message Component
function SuccessMessage() {
  return (
    <div className="py-8 text-center">
      <div className="bg-success-100 dark:bg-success-900/30 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <CheckIcon className="text-success-600 dark:text-success-400 h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
        Matagumpay na Na-verify!
      </h2>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Ang iyong identity ay na-verify na. Ire-redirect ka sa iyong profile...
      </p>
      <div className="mt-4">
        <LoadingSpinner className="text-primary-500 mx-auto h-6 w-6" />
      </div>
    </div>
  );
}

// Error Message Component - Requirement 16.6
interface ErrorMessageProps {
  error: string;
  onRetry: () => void;
  onBack: () => void;
}

function ErrorMessage({ error, onRetry, onBack }: ErrorMessageProps) {
  return (
    <div className="py-8 text-center">
      <div className="bg-error-100 dark:bg-error-900/30 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <XIcon className="text-error-600 dark:text-error-400 h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
        Nabigo ang Verification
      </h2>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">{error}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button onClick={onRetry} className="btn-primary">
          Subukan Muli
        </button>
        <button onClick={onBack} className="btn-outline">
          Pumili ng Ibang Paraan
        </button>
      </div>
    </div>
  );
}

// Icon Components
function NationalIdIcon({ className }: { className?: string }) {
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
        d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
      />
    </svg>
  );
}

function PassportIcon({ className }: { className?: string }) {
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
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
