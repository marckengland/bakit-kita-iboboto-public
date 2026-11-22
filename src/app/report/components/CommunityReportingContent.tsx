/**
 * Community Reporting Content Component
 *
 * Main content component with tabs for submitting reports and viewing status.
 * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8
 */

"use client";

import { useState } from "react";
import { ReportSubmissionForm } from "./ReportSubmissionForm";
import { InaccuracyReportForm } from "./InaccuracyReportForm";
import { MyReportsSection } from "./MyReportsSection";

interface CommunityReportingContentProps {
  searchParams: {
    tab?: string;
    politicianId?: string;
  };
}

type Tab = "submit" | "inaccuracy" | "my-reports";

export function CommunityReportingContent({ searchParams }: CommunityReportingContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.tab as Tab) || "submit");

  const tabs = [
    {
      id: "submit" as const,
      label: "Submit Report",
      labelFil: "Mag-submit ng Ulat",
      icon: DocumentPlusIcon,
      description: "Report new information about a politician",
    },
    {
      id: "inaccuracy" as const,
      label: "Report Inaccuracy",
      labelFil: "Mag-ulat ng Mali",
      icon: ExclamationIcon,
      description: "Report incorrect data in existing profiles",
    },
    {
      id: "my-reports" as const,
      label: "My Reports",
      labelFil: "Aking mga Ulat",
      icon: ClipboardIcon,
      description: "View status of your submitted reports",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <div className="flex gap-3">
          <InfoIcon className="h-5 w-5 flex-shrink-0 text-blue-500" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Paano gumagana ang Community Reporting
            </p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Lahat ng ulat ay susuriin at i-verify bago i-publish. Kailangan ng supporting evidence
              mula sa official sources. Ang verified na ulat ay mamarkahan bilang
              &quot;Community-Sourced&quot; para makilala mula sa official data.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-500 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.labelFil}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "submit" && (
          <ReportSubmissionForm preselectedPoliticianId={searchParams.politicianId} />
        )}
        {activeTab === "inaccuracy" && (
          <InaccuracyReportForm preselectedPoliticianId={searchParams.politicianId} />
        )}
        {activeTab === "my-reports" && <MyReportsSection />}
      </div>
    </div>
  );
}

// Icon Components
function DocumentPlusIcon({ className }: { className?: string }) {
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
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function ExclamationIcon({ className }: { className?: string }) {
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
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
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
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
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
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  );
}
