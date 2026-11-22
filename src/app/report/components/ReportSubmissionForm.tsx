/**
 * Report Submission Form Component
 *
 * Form for submitting new community reports about politicians.
 * Requirements: 28.1, 28.2
 */

"use client";

import { useState } from "react";
import { PoliticianSearchSelect } from "./PoliticianSearchSelect";
import { EvidenceUpload, Evidence } from "./EvidenceUpload";

type ReportType = "new_info" | "correction" | "controversy";

interface ReportSubmissionFormProps {
  preselectedPoliticianId?: string;
}

export function ReportSubmissionForm({ preselectedPoliticianId }: ReportSubmissionFormProps) {
  const [politicianId, setPoliticianId] = useState(preselectedPoliticianId || "");
  const [reportType, setReportType] = useState<ReportType>("new_info");
  const [content, setContent] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const reportTypes = [
    {
      id: "new_info" as const,
      label: "New Information",
      labelFil: "Bagong Impormasyon",
      description: "Share new verified information about a politician",
    },
    {
      id: "controversy" as const,
      label: "Controversy",
      labelFil: "Kontrobersya",
      description: "Report a documented controversy or issue",
    },
    {
      id: "correction" as const,
      label: "Correction",
      labelFil: "Pagwawasto",
      description: "Suggest a correction to existing data",
    },
  ];

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

    if (content.trim().length < 10) {
      setSubmitResult({
        success: false,
        message: "Report content must be at least 10 characters",
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
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          politicianId,
          reportType,
          content,
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
          message: data.message || "Report submitted successfully!",
        });
        // Reset form
        setPoliticianId("");
        setReportType("new_info");
        setContent("");
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
            placeholder="Maghanap ng pulitiko..."
          />
        </div>

        {/* Report Type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Uri ng Ulat *
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {reportTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setReportType(type.id)}
                className={`rounded-lg border p-4 text-left transition-all ${
                  reportType === type.id
                    ? "border-primary-500 bg-primary-50 ring-primary-500/20 dark:bg-primary-950 ring-2"
                    : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                }`}
              >
                <p
                  className={`font-medium ${
                    reportType === type.id
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-neutral-900 dark:text-white"
                  }`}
                >
                  {type.label}
                </p>
                <p className="text-xs text-neutral-500">{type.labelFil}</p>
                <p className="mt-1 text-xs text-neutral-500">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Report Content */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Detalye ng Ulat *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ilarawan ang impormasyon na gusto mong i-report. Maging specific at factual..."
            rows={5}
            className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {content.length}/1000 characters (minimum 10)
          </p>
        </div>

        {/* Evidence Upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Supporting Evidence *
          </label>
          <p className="mb-3 text-sm text-neutral-500">
            Provide links to official sources, documents, or images that support your report. At
            least one piece of evidence is required.
          </p>
          <EvidenceUpload evidence={evidence} onChange={setEvidence} />
        </div>

        {/* Guidelines */}
        <div className="rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
          <h4 className="mb-2 font-medium text-neutral-900 dark:text-white">
            Mga Gabay sa Pag-submit
          </h4>
          <ul className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              Use official sources (government websites, court records, news outlets)
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              Be factual and objective - avoid opinions or speculation
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              Include dates and specific details when available
            </li>
            <li className="flex items-start gap-2">
              <XIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              Do not submit unverified rumors or hearsay
            </li>
          </ul>
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
            "Submit Report"
          )}
        </button>

        <p className="text-center text-xs text-neutral-500">
          Your report will be reviewed and verified before publishing. You will be notified of the
          verification result.
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
