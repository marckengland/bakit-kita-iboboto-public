/**
 * Government Structure Component
 *
 * Educational content explaining the structure of Philippine government.
 * Requirements: 32.1, 32.2, 32.6, 32.7
 */

"use client";

import { useState } from "react";

interface GovernmentBranch {
  id: string;
  name: string;
  nameFil: string;
  description: string;
  descriptionFil: string;
  positions: GovernmentPosition[];
}

interface GovernmentPosition {
  title: string;
  titleFil: string;
  description: string;
  descriptionFil: string;
  termLength: string;
  termLimit: string;
  qualifications: string[];
}

const branches: GovernmentBranch[] = [
  {
    id: "executive",
    name: "Executive Branch",
    nameFil: "Sangay Ehekutibo",
    description:
      "The Executive Branch enforces and implements laws. It is headed by the President, who serves as both head of state and head of government.",
    descriptionFil:
      "Ang Sangay Ehekutibo ang nagpapatupad ng mga batas. Pinamumunuan ito ng Pangulo, na siyang pinuno ng estado at gobyerno.",
    positions: [
      {
        title: "President",
        titleFil: "Pangulo",
        description:
          "The President is the head of state and government, commander-in-chief of the armed forces, and chief executive of the Republic.",
        descriptionFil:
          "Ang Pangulo ang pinuno ng estado at gobyerno, commander-in-chief ng sandatahang lakas, at punong ehekutibo ng Republika.",
        termLength: "6 years",
        termLimit: "1 term (no re-election)",
        qualifications: [
          "Natural-born Filipino citizen",
          "Registered voter",
          "Able to read and write",
          "At least 40 years old on election day",
          "Resident of the Philippines for at least 10 years before election",
        ],
      },
      {
        title: "Vice President",
        titleFil: "Pangalawang Pangulo",
        description:
          "The Vice President succeeds the President in case of death, permanent disability, removal, or resignation. May be appointed to a Cabinet position.",
        descriptionFil:
          "Ang Pangalawang Pangulo ang hahalili sa Pangulo kung sakaling mamatay, permanenteng maging may kapansanan, matanggal, o magbitiw. Maaaring italaga sa posisyon sa Gabinete.",
        termLength: "6 years",
        termLimit: "2 consecutive terms",
        qualifications: [
          "Natural-born Filipino citizen",
          "Registered voter",
          "Able to read and write",
          "At least 40 years old on election day",
          "Resident of the Philippines for at least 10 years before election",
        ],
      },
    ],
  },
  {
    id: "legislative",
    name: "Legislative Branch",
    nameFil: "Sangay Lehislatibo",
    description:
      "The Legislative Branch, also known as Congress, creates laws. It is bicameral, consisting of the Senate and the House of Representatives.",
    descriptionFil:
      "Ang Sangay Lehislatibo, na kilala rin bilang Kongreso, ang gumagawa ng mga batas. Ito ay bicameral, binubuo ng Senado at Kapulungan ng mga Kinatawan.",
    positions: [
      {
        title: "Senator",
        titleFil: "Senador",
        description:
          "Senators are elected at-large by the entire nation. The Senate has 24 members, with 12 elected every 3 years.",
        descriptionFil:
          "Ang mga Senador ay inihahalal ng buong bansa. Ang Senado ay may 24 na miyembro, kung saan 12 ang inihahalal tuwing 3 taon.",
        termLength: "6 years",
        termLimit: "2 consecutive terms",
        qualifications: [
          "Natural-born Filipino citizen",
          "Registered voter",
          "Able to read and write",
          "At least 35 years old on election day",
          "Resident of the Philippines for at least 2 years before election",
        ],
      },
      {
        title: "Congressman/Representative",
        titleFil: "Kongresista/Kinatawan",
        description:
          "Representatives are elected from legislative districts or through party-list system. The House has approximately 300 members.",
        descriptionFil:
          "Ang mga Kinatawan ay inihahalal mula sa mga distrito o sa pamamagitan ng party-list system. Ang Kapulungan ay may humigit-kumulang 300 miyembro.",
        termLength: "3 years",
        termLimit: "3 consecutive terms",
        qualifications: [
          "Natural-born Filipino citizen",
          "Registered voter",
          "Able to read and write",
          "At least 25 years old on election day",
          "Resident of the district for at least 1 year before election",
        ],
      },
    ],
  },
  {
    id: "judicial",
    name: "Judicial Branch",
    nameFil: "Sangay Hudisyal",
    description:
      "The Judicial Branch interprets laws and settles disputes. It is headed by the Supreme Court, the highest court in the land.",
    descriptionFil:
      "Ang Sangay Hudisyal ang nagpapakahulugan ng mga batas at naglulutas ng mga alitan. Pinamumunuan ito ng Korte Suprema, ang pinakamataas na hukuman sa bansa.",
    positions: [
      {
        title: "Chief Justice",
        titleFil: "Punong Mahistrado",
        description:
          "The Chief Justice heads the Supreme Court and the entire judiciary. Appointed by the President from a list prepared by the Judicial and Bar Council.",
        descriptionFil:
          "Ang Punong Mahistrado ang namumuno sa Korte Suprema at sa buong hudikatura. Itinatalaga ng Pangulo mula sa listahan na inihanda ng Judicial and Bar Council.",
        termLength: "Until age 70",
        termLimit: "Mandatory retirement at 70",
        qualifications: [
          "Natural-born Filipino citizen",
          "At least 40 years old",
          "At least 15 years as judge or practicing law",
          "Person of proven competence, integrity, probity, and independence",
        ],
      },
      {
        title: "Associate Justice",
        titleFil: "Kasamang Mahistrado",
        description:
          "Associate Justices serve on the Supreme Court alongside the Chief Justice. The Supreme Court has 14 Associate Justices.",
        descriptionFil:
          "Ang mga Kasamang Mahistrado ay naglilingkod sa Korte Suprema kasama ang Punong Mahistrado. Ang Korte Suprema ay may 14 na Kasamang Mahistrado.",
        termLength: "Until age 70",
        termLimit: "Mandatory retirement at 70",
        qualifications: [
          "Natural-born Filipino citizen",
          "At least 40 years old",
          "At least 15 years as judge or practicing law",
          "Person of proven competence, integrity, probity, and independence",
        ],
      },
    ],
  },
];

const localGovernmentLevels = [
  {
    level: "Provincial",
    levelFil: "Panlalawigan",
    positions: [
      { title: "Governor", titleFil: "Gobernador", termLimit: "3 consecutive terms" },
      { title: "Vice Governor", titleFil: "Bise Gobernador", termLimit: "3 consecutive terms" },
      {
        title: "Provincial Board Member",
        titleFil: "Kagawad Panlalawigan",
        termLimit: "3 consecutive terms",
      },
    ],
  },
  {
    level: "City/Municipal",
    levelFil: "Panglungsod/Pambayan",
    positions: [
      { title: "Mayor", titleFil: "Alkalde", termLimit: "3 consecutive terms" },
      { title: "Vice Mayor", titleFil: "Bise Alkalde", termLimit: "3 consecutive terms" },
      { title: "Councilor", titleFil: "Konsehal", termLimit: "3 consecutive terms" },
    ],
  },
  {
    level: "Barangay",
    levelFil: "Barangay",
    positions: [
      {
        title: "Barangay Captain",
        titleFil: "Kapitan ng Barangay",
        termLimit: "3 consecutive terms",
      },
      {
        title: "Barangay Kagawad",
        titleFil: "Kagawad ng Barangay",
        termLimit: "3 consecutive terms",
      },
      { title: "SK Chairman", titleFil: "Tagapangulo ng SK", termLimit: "2 consecutive terms" },
    ],
  },
];

export function GovernmentStructure() {
  const [expandedBranch, setExpandedBranch] = useState<string | null>("executive");
  const [showLocal, setShowLocal] = useState(false);

  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="card">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
          Structure of Philippine Government
        </h2>
        <p className="mt-1 text-sm text-neutral-500">Istruktura ng Gobyerno ng Pilipinas</p>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          The Philippine government is a democratic republic with three co-equal branches:
          Executive, Legislative, and Judicial. This system of separation of powers ensures checks
          and balances, preventing any single branch from becoming too powerful.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Ang gobyerno ng Pilipinas ay isang demokratikong republika na may tatlong magkakapantay na
          sangay: Ehekutibo, Lehislatibo, at Hudisyal. Ang sistemang ito ng paghihiwalay ng
          kapangyarihan ay nagtitiyak ng checks and balances.
        </p>
      </div>

      {/* Three Branches Diagram */}
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
          Three Branches of Government
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => setExpandedBranch(expandedBranch === branch.id ? null : branch.id)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                expandedBranch === branch.id
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                  : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <BranchIcon branch={branch.id} className="h-8 w-8" />
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">{branch.name}</p>
                  <p className="text-xs text-neutral-500">{branch.nameFil}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                {branch.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Expanded Branch Details */}
      {expandedBranch && (
        <div className="card animate-fade-in">
          {branches
            .filter((b) => b.id === expandedBranch)
            .map((branch) => (
              <div key={branch.id}>
                <div className="mb-6 flex items-center gap-3">
                  <BranchIcon branch={branch.id} className="text-primary-500 h-10 w-10" />
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                      {branch.name}
                    </h3>
                    <p className="text-sm text-neutral-500">{branch.nameFil}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {branch.positions.map((position, index) => (
                    <PositionCard key={index} position={position} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Local Government Section */}
      <div className="card">
        <button
          onClick={() => setShowLocal(!showLocal)}
          className="flex w-full items-center justify-between"
        >
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Local Government Units (LGUs)
            </h3>
            <p className="text-sm text-neutral-500">Mga Lokal na Pamahalaan</p>
          </div>
          <ChevronIcon
            className={`h-5 w-5 transition-transform ${showLocal ? "rotate-180" : ""}`}
          />
        </button>

        {showLocal && (
          <div className="animate-fade-in mt-6 space-y-6">
            <p className="text-neutral-600 dark:text-neutral-400">
              Local Government Units (LGUs) are the political subdivisions of the Philippines. They
              have their own elected officials and are responsible for local governance, public
              services, and community development.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {localGovernmentLevels.map((level) => (
                <div
                  key={level.level}
                  className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
                >
                  <h4 className="font-semibold text-neutral-900 dark:text-white">{level.level}</h4>
                  <p className="text-xs text-neutral-500">{level.levelFil}</p>
                  <ul className="mt-3 space-y-2">
                    {level.positions.map((pos) => (
                      <li key={pos.title} className="text-sm">
                        <span className="text-neutral-900 dark:text-white">{pos.title}</span>
                        <span className="text-neutral-500"> ({pos.titleFil})</span>
                        <p className="text-xs text-neutral-400">{pos.termLimit}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Constitutional Commissions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Constitutional Commissions
        </h3>
        <p className="text-sm text-neutral-500">Mga Komisyong Konstitusyonal</p>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          The Constitution also establishes independent constitutional commissions that operate
          independently from the three branches:
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <CommissionCard
            name="COMELEC"
            fullName="Commission on Elections"
            fullNameFil="Komisyon sa mga Eleksyon"
            description="Administers elections and enforces election laws"
          />
          <CommissionCard
            name="COA"
            fullName="Commission on Audit"
            fullNameFil="Komisyon sa Awdit"
            description="Audits government agencies and examines public funds"
          />
          <CommissionCard
            name="CSC"
            fullName="Civil Service Commission"
            fullNameFil="Komisyon sa Serbisyo Sibil"
            description="Manages the civil service and government employees"
          />
        </div>
      </div>
    </div>
  );
}

// Position Card Component
function PositionCard({ position }: { position: GovernmentPosition }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div>
          <h4 className="font-semibold text-neutral-900 dark:text-white">{position.title}</h4>
          <p className="text-sm text-neutral-500">{position.titleFil}</p>
        </div>
        <ChevronIcon className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="animate-fade-in mt-4 space-y-4">
          <div>
            <p className="text-neutral-600 dark:text-neutral-400">{position.description}</p>
            <p className="mt-1 text-sm text-neutral-500">{position.descriptionFil}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
              <p className="text-xs font-medium text-neutral-500">Term Length</p>
              <p className="font-semibold text-neutral-900 dark:text-white">
                {position.termLength}
              </p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
              <p className="text-xs font-medium text-neutral-500">Term Limit</p>
              <p className="font-semibold text-neutral-900 dark:text-white">{position.termLimit}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Qualifications:
            </p>
            <ul className="space-y-1">
              {position.qualifications.map((qual, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400"
                >
                  <CheckIcon className="text-success-500 mt-0.5 h-4 w-4 flex-shrink-0" />
                  {qual}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Commission Card Component
function CommissionCard({
  name,
  fullName,
  fullNameFil,
  description,
}: {
  name: string;
  fullName: string;
  fullNameFil: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <span className="badge-primary">{name}</span>
      <h4 className="mt-2 font-semibold text-neutral-900 dark:text-white">{fullName}</h4>
      <p className="text-xs text-neutral-500">{fullNameFil}</p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
    </div>
  );
}

// Icon Components
function BranchIcon({ branch, className }: { branch: string; className?: string }) {
  if (branch === "executive") {
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
  if (branch === "legislative") {
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
        d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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
