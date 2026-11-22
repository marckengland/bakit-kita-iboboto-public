/**
 * Evidence Upload Component
 *
 * Interface for uploading and managing evidence for community reports.
 * Requirement 28.1: Require supporting evidence (documents, links, photos)
 */

"use client";

import { useState, useRef } from "react";

export type EvidenceType = "document" | "link" | "image";

export interface Evidence {
  id: string;
  type: EvidenceType;
  url: string;
  description?: string;
  fileName?: string;
}

interface EvidenceUploadProps {
  evidence: Evidence[];
  onChange: (evidence: Evidence[]) => void;
  maxItems?: number;
}

export function EvidenceUpload({ evidence, onChange, maxItems = 5 }: EvidenceUploadProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvidence, setNewEvidence] = useState<Partial<Evidence>>({
    type: "link",
    url: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddEvidence = () => {
    setError(null);

    if (!newEvidence.url) {
      setError("URL is required");
      return;
    }

    // Validate URL
    try {
      new URL(newEvidence.url);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    const evidenceItem: Evidence = {
      id: `evidence-${Date.now()}`,
      type: newEvidence.type || "link",
      url: newEvidence.url,
      description: newEvidence.description,
      fileName: newEvidence.fileName,
    };

    onChange([...evidence, evidenceItem]);
    setNewEvidence({ type: "link", url: "", description: "" });
    setShowAddForm(false);
  };

  const handleRemoveEvidence = (id: string) => {
    onChange(evidence.filter((e) => e.id !== id));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // In a real implementation, this would upload to a storage service
    // For now, we'll create a placeholder URL
    const isImage = file.type.startsWith("image/");
    const type: EvidenceType = isImage ? "image" : "document";

    // Simulate file upload - in production, upload to S3/Cloudflare R2
    const placeholderUrl = `https://storage.example.com/uploads/${Date.now()}-${file.name}`;

    setNewEvidence({
      type,
      url: placeholderUrl,
      description: "",
      fileName: file.name,
    });
    setShowAddForm(true);
  };

  const getEvidenceIcon = (type: EvidenceType) => {
    switch (type) {
      case "document":
        return <DocumentIcon className="h-5 w-5" />;
      case "image":
        return <ImageIcon className="h-5 w-5" />;
      case "link":
      default:
        return <LinkIcon className="h-5 w-5" />;
    }
  };

  const getEvidenceTypeLabel = (type: EvidenceType) => {
    switch (type) {
      case "document":
        return "Document";
      case "image":
        return "Image";
      case "link":
      default:
        return "Link";
    }
  };

  return (
    <div className="space-y-4">
      {/* Evidence List */}
      {evidence.length > 0 && (
        <div className="space-y-2">
          {evidence.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-neutral-200 p-2 dark:bg-neutral-700">
                  {getEvidenceIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
                      {getEvidenceTypeLabel(item.type)}
                    </span>
                    {item.fileName && (
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {item.fileName}
                      </span>
                    )}
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 mt-1 block truncate text-sm hover:underline"
                  >
                    {item.url}
                  </a>
                  {item.description && (
                    <p className="mt-1 text-sm text-neutral-500">{item.description}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveEvidence(item.id)}
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-500 dark:hover:bg-neutral-700"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Evidence Form */}
      {showAddForm ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <h4 className="mb-4 font-medium text-neutral-900 dark:text-white">Add Evidence</h4>

          <div className="space-y-4">
            {/* Evidence Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Type
              </label>
              <div className="flex gap-2">
                {(["link", "document", "image"] as EvidenceType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewEvidence({ ...newEvidence, type })}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      newEvidence.type === type
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                    }`}
                  >
                    {getEvidenceIcon(type)}
                    {getEvidenceTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            {/* URL */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                URL *
              </label>
              <input
                type="url"
                value={newEvidence.url || ""}
                onChange={(e) => setNewEvidence({ ...newEvidence, url: e.target.value })}
                placeholder="https://..."
                className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
              {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Description (optional)
              </label>
              <input
                type="text"
                value={newEvidence.description || ""}
                onChange={(e) => setNewEvidence({ ...newEvidence, description: e.target.value })}
                placeholder="Brief description of this evidence"
                className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewEvidence({ type: "link", url: "", description: "" });
                  setError(null);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddEvidence}
                className="bg-primary-500 hover:bg-primary-600 rounded-lg px-4 py-2 text-sm font-medium text-white"
              >
                Add Evidence
              </button>
            </div>
          </div>
        </div>
      ) : (
        evidence.length < maxItems && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-800/50">
            <div className="mb-4 rounded-full bg-neutral-200 p-3 dark:bg-neutral-700">
              <PlusIcon className="h-6 w-6 text-neutral-500" />
            </div>
            <p className="mb-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
              Add supporting evidence from official sources
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
              >
                <LinkIcon className="h-4 w-4" />
                Add Link
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
              >
                <UploadIcon className="h-4 w-4" />
                Upload File
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="mt-3 text-xs text-neutral-500">
              Accepted: Images, PDF, DOC (max 5 items)
            </p>
          </div>
        )
      )}

      {evidence.length >= maxItems && (
        <p className="text-center text-sm text-neutral-500">
          Maximum {maxItems} evidence items reached
        </p>
      )}
    </div>
  );
}

// Icon Components
function DocumentIcon({ className }: { className?: string }) {
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
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
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
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
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
        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
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
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
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
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
