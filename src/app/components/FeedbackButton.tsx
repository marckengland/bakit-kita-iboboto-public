/**
 * Feedback Button Component
 *
 * A floating feedback button accessible from all pages.
 * Allows users to submit bug reports, feature suggestions, data corrections, and general feedback.
 * Supports file attachments and anonymous submissions.
 *
 * Requirements: 43.1, 43.2, 43.3, 43.4, 43.6
 */

"use client";

import { useState, useRef } from "react";

// ============================================
// Types
// ============================================

type FeedbackCategory =
  | "bug_report"
  | "feature_suggestion"
  | "data_correction"
  | "general_feedback";

interface FeedbackAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

interface FeedbackFormData {
  category: FeedbackCategory;
  subject: string;
  description: string;
  sourceUrl: string;
  attachments: FeedbackAttachment[];
  isAnonymous: boolean;
  email?: string;
}

interface FeedbackButtonProps {
  className?: string;
  variant?: "floating" | "inline";
}

// ============================================
// Constants
// ============================================

const CATEGORIES: { value: FeedbackCategory; label: string; description: string }[] = [
  { value: "bug_report", label: "Bug Report", description: "Report a problem or error" },
  {
    value: "feature_suggestion",
    label: "Feature Suggestion",
    description: "Suggest a new feature",
  },
  { value: "data_correction", label: "Data Correction", description: "Report incorrect data" },
  { value: "general_feedback", label: "General Feedback", description: "Share your thoughts" },
];

const MAX_FILE_SIZE = 256 * 1024;
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/gif", "application/pdf"];

// ============================================
// Main Component
// ============================================

export function FeedbackButton({ className = "", variant = "floating" }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<FeedbackFormData>({
    category: "general_feedback",
    subject: "",
    description: "",
    sourceUrl: "",
    attachments: [],
    isAnonymous: false,
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setFileError(null);
    const newAttachments: FeedbackAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) {
        continue;
      }
      if (formData.attachments.length + newAttachments.length >= 5) {
        setFileError("Attach up to five files.");
        break;
      }

      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setFileError(`File type not allowed: ${file.name}. Use PNG, JPEG, GIF, or PDF.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File too large: ${file.name}. Maximum size is 256 KiB.`);
        continue;
      }

      // Convert to base64
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
      });
    }

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments],
    }));

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitResult(null);

    // Validation
    if (!formData.subject.trim()) {
      setSubmitResult({ success: false, message: "Please enter a subject" });
      return;
    }

    if (formData.description.trim().length < 10) {
      setSubmitResult({
        success: false,
        message: "Please provide a description (at least 10 characters)",
      });
      return;
    }

    if (!formData.isAnonymous && formData.email && !isValidEmail(formData.email)) {
      setSubmitResult({ success: false, message: "Please enter a valid email address" });
      return;
    }

    if (formData.category === "data_correction" && !formData.sourceUrl.trim()) {
      setSubmitResult({
        success: false,
        message: "Please provide a source URL for data corrections",
      });
      return;
    }

    if (formData.category === "data_correction" && formData.sourceUrl.trim()) {
      try {
        new URL(formData.sourceUrl);
      } catch {
        setSubmitResult({
          success: false,
          message: "Please enter a valid URL (e.g. https://www.rappler.com/...)",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.category,
          subject: formData.subject,
          description: formData.description,
          sourceUrl: formData.category === "data_correction" ? formData.sourceUrl : undefined,
          attachments: formData.attachments.map((a) => ({
            name: a.name,
            type: a.type,
            dataUrl: a.dataUrl,
          })),
          isAnonymous: formData.isAnonymous,
          email: formData.isAnonymous ? undefined : formData.email,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitResult({
          success: true,
          message: data.message || "Thank you for your feedback!",
        });
        // Reset form
        setFormData({
          category: "general_feedback",
          subject: "",
          description: "",
          sourceUrl: "",
          attachments: [],
          isAnonymous: false,
          email: "",
        });
      } else {
        setSubmitResult({
          success: false,
          message: data.error || "Failed to submit feedback",
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

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`${variant === "inline" ? "inline-flex min-h-11 items-center gap-2 text-sm text-neutral-600 underline dark:text-neutral-400" : "fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-amber-600"} ${className}`}
        aria-label="Open feedback form"
      >
        <FeedbackIcon className="h-5 w-5" />
        <span className={variant === "inline" ? "" : "hidden font-medium sm:inline"}>Feedback</span>
      </button>

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Send Feedback</h2>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSubmitResult(null);
                }}
                className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close feedback form"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {submitResult?.success ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">Thank You!</h3>
                  <p className="mb-6 text-gray-600">{submitResult.message}</p>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setSubmitResult(null);
                    }}
                    className="rounded-lg bg-amber-500 px-6 py-2 text-white transition-colors hover:bg-amber-600"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Category Selection */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, category: cat.value }))}
                          className={`rounded-lg border-2 p-3 text-left transition-all ${
                            formData.category === cat.value
                              ? "border-amber-500 bg-amber-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="text-sm font-medium text-gray-900">{cat.label}</div>
                          <div className="text-xs text-gray-500">{cat.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      htmlFor="feedback-subject"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="feedback-subject"
                      type="text"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, subject: e.target.value }))
                      }
                      placeholder="Brief summary of your feedback"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-all outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                      maxLength={100}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      htmlFor="feedback-description"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="feedback-description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder={
                        formData.category === "data_correction"
                          ? "What data is incorrect? Please specify the politician, the field, and the correct information..."
                          : "Please provide details about your feedback..."
                      }
                      rows={4}
                      className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 transition-all outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                      maxLength={2000}
                    />
                    <div className="mt-1 text-right text-xs text-gray-500">
                      {formData.description.length}/2000
                    </div>
                  </div>

                  {/* Source URL - only for data corrections */}
                  {formData.category === "data_correction" && (
                    <div>
                      <label
                        htmlFor="feedback-source-url"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Source URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="feedback-source-url"
                        type="url"
                        value={formData.sourceUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, sourceUrl: e.target.value }))
                        }
                        placeholder="https://www.rappler.com/... or official government source"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-all outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Provide a link to a credible source (e.g. Rappler, Inquirer, PhilStar, GMA
                        News, COMELEC, Senate, House of Representatives)
                      </p>
                    </div>
                  )}

                  {/* File Attachments */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Attachments (optional)
                    </label>
                    <div className="space-y-2">
                      {formData.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg bg-gray-50 p-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <AttachmentIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                            <span className="truncate text-sm text-gray-700">
                              {attachment.name}
                            </span>
                            <span className="flex-shrink-0 text-xs text-gray-500">
                              ({formatFileSize(attachment.size)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="p-1 text-gray-400 transition-colors hover:text-red-500"
                            aria-label={`Remove ${attachment.name}`}
                          >
                            <CloseIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileChange}
                        accept={ALLOWED_FILE_TYPES.join(",")}
                        multiple
                        className="hidden"
                        id="feedback-file-input"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 transition-colors hover:border-amber-400 hover:text-amber-600"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <PlusIcon className="h-4 w-4" />
                          Add screenshot or file (PNG, JPEG, GIF, PDF - max 5MB)
                        </span>
                      </button>
                      {fileError && <p className="text-sm text-red-600">{fileError}</p>}
                    </div>
                  </div>

                  {/* Anonymous Option */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="feedback-anonymous"
                      checked={formData.isAnonymous}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          isAnonymous: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <label htmlFor="feedback-anonymous" className="text-sm text-gray-600">
                      Submit anonymously (we won&apos;t be able to follow up with you)
                    </label>
                  </div>

                  {/* Email (if not anonymous) */}
                  {!formData.isAnonymous && (
                    <div>
                      <label
                        htmlFor="feedback-email"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Email (optional)
                      </label>
                      <input
                        id="feedback-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="your@email.com"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-all outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Provide your email if you&apos;d like us to follow up
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {submitResult && !submitResult.success && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">{submitResult.message}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-3 font-medium text-white transition-colors hover:bg-amber-600 disabled:bg-amber-300"
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner className="h-5 w-5" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <SendIcon className="h-5 w-5" />
                        Submit Feedback
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// Icons
// ============================================

function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

function AttachmentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
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
