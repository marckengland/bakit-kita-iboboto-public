/**
 * Education Section Component
 *
 * Displays education history for a politician.
 */

"use client";

type EducationLevel =
  | "elementary"
  | "high_school"
  | "vocational"
  | "bachelors"
  | "masters"
  | "doctorate"
  | "law"
  | "medicine"
  | "other";

interface EducationRecord {
  id: string;
  institution: string;
  degree: string | null;
  field: string | null;
  level: EducationLevel;
  yearStart: number | null;
  yearEnd: number | null;
  isCompleted: boolean;
}

interface EducationSectionProps {
  education: EducationRecord[];
}

const levelLabels: Record<EducationLevel, string> = {
  elementary: "Elementary",
  high_school: "High School",
  vocational: "Vocational",
  bachelors: "Bachelor's Degree",
  masters: "Master's Degree",
  doctorate: "Doctorate",
  law: "Law Degree",
  medicine: "Medical Degree",
  other: "Other",
};

const levelOrder: EducationLevel[] = [
  "doctorate",
  "medicine",
  "law",
  "masters",
  "bachelors",
  "vocational",
  "high_school",
  "elementary",
  "other",
];

export function EducationSection({ education }: EducationSectionProps) {
  if (!education || education.length === 0) {
    return null;
  }

  const sorted = [...education].sort(
    (a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)
  );

  return (
    <div className="card">
      <h2 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-white">Education</h2>

      <div className="space-y-4">
        {sorted.map((edu) => (
          <div
            key={edu.id}
            className="flex items-start gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
          >
            <div className="bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-neutral-900 dark:text-white">{edu.institution}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {edu.degree || levelLabels[edu.level]}
                {edu.field ? ` in ${edu.field}` : ""}
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
                {(edu.yearStart || edu.yearEnd) && (
                  <span>
                    {edu.yearStart || "?"} – {edu.yearEnd || "Present"}
                  </span>
                )}
                {!edu.isCompleted && (
                  <span className="bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-400 rounded px-1.5 py-0.5 text-xs">
                    Incomplete
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {levelLabels[edu.level]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
