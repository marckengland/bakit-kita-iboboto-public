/**
 * Inaccuracy Report Form Component
 *
 * Form for reporting inaccuracies in existing politician data.
 * Requirement 28.6: Allow users to report inaccuracies for review
 */

"use client";

import { useState } from "react";
import { PoliticianSearchSelect } from "./PoliticianSearchSelect";
import { EvidenceUpload, Evidence } from "./EvidenceUpload";

interface InaccuracyReportFormProps {
  preselectedPoliticianId?: string;
}

const dataFields = [
  { value: "fullName", label: "Full Name" },
  { value: "birthday", label: "Birthday" },
  { value: "birthplace", label: "Birthplace" },
  { value: "education", label: "Educational Background" },
  { value: "currentPosition", label: "Current Position" },
  { value: "party", label: "Political Party" },
  { value: "electionHistory", label: "Election History" },
  { value: "saln", label: "SALN Data" },
  { value: "bills", label: "Bills/Legislation" },
  { value: "projects", label: "Projects/Programs" },
  { value: "other", label: "Other" },
];

export function InaccuracyReportForm({ preselectedPoliticianId }: InaccuracyReportFormProps) {
  const [politicianId, setPoliticianId] = useState(preselectedPoliticianId || "");
  const [dataField, setDataField] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitResult(null);

    // Validation
    if (!politicianId) {
      setSubmitResult({
        success: false,
        message: "Please select a politician",
      });
      return;
    }

    if (!dataField) {
      setSubmitResult({
        success: false,
        message: "Please select the data field with the inaccuracy",
      });
      return;
    }

    if (!currentValue.trim()) {
      setSubmitResult({
        success: false,
        message: "Please enter the current (incorrect) value",
      });
      return;
    }

    if (!suggestedValue.trim()) {
      setSubmitResult({
        success: false,
        message: "Please enter the correct value",
      });
      return;
    }

    if (reason.trim().length < 10) {
      setSubmitResult({
        success: false,
        message: "Please provide a reason (at least 10 characters)",
      });
      return;
    }

    if (evidence.length === 0) {
      setSubmitResult({
        success: false,
        message: "At least one piece of evidence is required",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/reports/inaccuracy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          politicianId,
          dataField,
          currentValue,
          suggestedValue,
          reason,
          evidence: evidence.map((e) => ({
            type: e.type,
            url: e.url,
            description: e.description,
          })),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitResult({
          success: true,
          message: data.message || "Inaccuracy report submitted successfully!",
        });
        // Reset form
        setPoliticianId("");
        setDataField("");
        setCurrentValue("");
        setSuggestedValue("");
        setReason("");
        setEvidence([]);
      } else {
        setSubmitResult({
          success: false,
          message: data.error || "Failed to submit report",
        });
      }
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitResult({
        success: false,
        message: "An error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success/Error Message */}
      {submitResult && (
        <div
          className={`rounded-lg p-4 ${
            submitResult.success
              ? "border border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
              : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {submitResult.success ? (
              <CheckCircleIcon className="h-5 w-5" />
            ) : (
              <XCircleIcon className="h-5 w-5" />
            )}
            <p className="font-medium">{submitResult.message}</p>
          </div>
        </div>
      )}

      <div className="card space-y-6">
        {/* Politician Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Pulitiko *
          </label>
          <PoliticianSearchSelect
            value={politicianId}
            onChange={(id) => {
              setPoliticianId(id);
            }}
            placeholder="Maghanap ng pulitiko na may maling data..."
          />
        </div>

        {/* Data Field Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Data Field na may Mali *
          </label>
          <select
            value={dataField}
            onChange={(e) => setDataField(e.target.value)}
            className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          >
            <option value="">Pumili ng field...</option>
            {dataFields.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </div>

        {/* Current Value */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Kasalukuyang Value (Mali) *
          </label>
          <input
            type="text"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder="Ano ang maling data na nakikita mo?"
            className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>

        {/* Suggested Value */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Tamang Value *
          </label>
          <input
            type="text"
            value={suggestedValue}
            onChange={(e) => setSuggestedValue(e.target.value)}
            placeholder="Ano ang dapat na tamang data?"
            className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>

        {/* Reason */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Dahilan ng Pagwawasto *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ipaliwanag kung bakit mali ang kasalukuyang data at kung saan mo nakuha ang tamang impormasyon..."
            rows={4}
            className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {reason.length}/500 characters (minimum 10)
          </p>
        </div>

        {/* Evidence Upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Supporting Evidence *
          </label>
          <p className="mb-3 text-sm text-neutral-500">
            Provide official sources that prove the correct value. This is required for
            verification.
          </p>
          <EvidenceUpload evidence={evidence} onChange={setEvidence} />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary-500 hover:bg-primary-600 w-full rounded-lg py-3 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner className="h-5 w-5" />
              Submitting...
            </span>
          ) : (
            "Submit Inaccuracy Report"
          )}
        </button>

        <p className="text-center text-xs text-neutral-500">
          Your correction will be verified against official sources before any changes are made.
        </p>
      </div>
    </form>
  );
}

// Icon Components
function CheckCircleIcon({ className }: { className?: string }) {
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
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
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
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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
