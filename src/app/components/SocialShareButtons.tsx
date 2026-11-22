/**
 * Social Share Buttons Component
 *
 * Reusable social sharing buttons for profiles, comparisons, and voting lists.
 * Requirements: 42.6
 */

"use client";

import { useState } from "react";
import { generateShareUrl, generateShareText, SocialPlatform } from "@/lib/share-utils";

interface SocialShareButtonsProps {
  type: "profile" | "comparison" | "voting-list";
  url: string;
  data: {
    politicianName?: string;
    politicianNames?: string[];
    electionYear?: number;
    count?: number;
  };
  variant?: "buttons" | "dropdown";
  className?: string;
}

export function SocialShareButtons({
  type,
  url,
  data,
  variant = "buttons",
  className = "",
}: SocialShareButtonsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const { title, description } = generateShareText(type, data);

  const handleShare = async (platform: SocialPlatform) => {
    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      return;
    }

    const shareUrl = generateShareUrl(platform, url, title, description);
    window.open(shareUrl, "_blank", "width=600,height=400,noopener,noreferrer");
    setShowDropdown(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  if (variant === "dropdown") {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="btn-outline flex items-center gap-2"
          aria-label="Share options"
        >
          <ShareIcon className="h-4 w-4" />
          Share
        </button>

        {showDropdown && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />

            {/* Dropdown menu */}
            <div className="absolute top-full right-0 z-20 mt-2 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
              {/* Native share (mobile) */}
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                >
                  <ShareIcon className="h-4 w-4 text-neutral-500" />
                  Share...
                </button>
              )}

              <button
                onClick={() => handleShare("facebook")}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <FacebookIcon className="h-4 w-4 text-[#1877F2]" />
                Facebook
              </button>

              <button
                onClick={() => handleShare("twitter")}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <TwitterIcon className="h-4 w-4 text-neutral-900 dark:text-white" />X (Twitter)
              </button>

              <button
                onClick={() => handleShare("linkedin")}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <LinkedInIcon className="h-4 w-4 text-[#0A66C2]" />
                LinkedIn
              </button>

              <hr className="my-1 border-neutral-200 dark:border-neutral-700" />

              <button
                onClick={() => handleShare("copy")}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                {copied ? (
                  <>
                    <CheckIcon className="text-success-500 h-4 w-4" />
                    <span className="text-success-600 dark:text-success-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-4 w-4 text-neutral-500" />
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Buttons variant
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => handleShare("facebook")}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1877F2] text-white transition-opacity hover:opacity-90"
        aria-label="Share on Facebook"
        title="Share on Facebook"
      >
        <FacebookIcon className="h-4 w-4" />
      </button>

      <button
        onClick={() => handleShare("twitter")}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-neutral-900"
        aria-label="Share on X (Twitter)"
        title="Share on X (Twitter)"
      >
        <TwitterIcon className="h-4 w-4" />
      </button>

      <button
        onClick={() => handleShare("linkedin")}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A66C2] text-white transition-opacity hover:opacity-90"
        aria-label="Share on LinkedIn"
        title="Share on LinkedIn"
      >
        <LinkedInIcon className="h-4 w-4" />
      </button>

      <button
        onClick={() => handleShare("copy")}
        className={`flex h-9 items-center gap-2 rounded-lg px-3 transition-colors ${
          copied
            ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        }`}
        aria-label="Copy link"
        title="Copy link"
      >
        {copied ? (
          <>
            <CheckIcon className="h-4 w-4" />
            <span className="text-sm">Copied!</span>
          </>
        ) : (
          <>
            <CopyIcon className="h-4 w-4" />
            <span className="text-sm">Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

// Icon Components
function ShareIcon({ className }: { className?: string }) {
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
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
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
