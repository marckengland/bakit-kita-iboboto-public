/**
 * Civic Education Content Component
 *
 * Main content component for civic education section with tabs for different topics.
 * Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7
 */

"use client";

import { useState } from "react";
import { GovernmentStructure } from "./GovernmentStructure";
import { LegislativeProcess } from "./LegislativeProcess";
import { ElectionProcess } from "./ElectionProcess";
import { PoliticalGlossary } from "./PoliticalGlossary";

interface CivicEducationContentProps {
  searchParams: {
    section?: string;
    term?: string;
  };
}

type Section = "structure" | "legislative" | "election" | "glossary";

export function CivicEducationContent({ searchParams }: CivicEducationContentProps) {
  const [activeSection, setActiveSection] = useState<Section>(
    (searchParams.section as Section) || "structure"
  );

  const sections = [
    {
      id: "structure" as const,
      label: "Government Structure",
      labelFil: "Istruktura ng Gobyerno",
      icon: BuildingIcon,
      description: "Learn about the branches and levels of Philippine government",
    },
    {
      id: "legislative" as const,
      label: "Legislative Process",
      labelFil: "Proseso ng Paggawa ng Batas",
      icon: DocumentIcon,
      description: "Understand how a bill becomes a law",
    },
    {
      id: "election" as const,
      label: "Election Process",
      labelFil: "Proseso ng Eleksyon",
      icon: BallotIcon,
      description: "Know your voter requirements and election procedures",
    },
    {
      id: "glossary" as const,
      label: "Political Glossary",
      labelFil: "Talasalitaan",
      icon: BookIcon,
      description: "Political and legal terms in Filipino and English",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`card text-left transition-all ${
                isActive
                  ? "border-primary-500 ring-primary-500/20 ring-2"
                  : "hover:border-neutral-300 dark:hover:border-neutral-600"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    isActive
                      ? "bg-primary-500 text-white"
                      : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-semibold ${
                      isActive ? "text-primary-500" : "text-neutral-900 dark:text-white"
                    }`}
                  >
                    {section.label}
                  </p>
                  <p className="text-xs text-neutral-500">{section.labelFil}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="animate-fade-in">
        {activeSection === "structure" && <GovernmentStructure />}
        {activeSection === "legislative" && <LegislativeProcess />}
        {activeSection === "election" && <ElectionProcess />}
        {activeSection === "glossary" && <PoliticalGlossary searchTerm={searchParams.term} />}
      </div>
    </div>
  );
}

// Icon Components
function BuildingIcon({ className }: { className?: string }) {
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
        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
      />
    </svg>
  );
}

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
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function BallotIcon({ className }: { className?: string }) {
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

function BookIcon({ className }: { className?: string }) {
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
