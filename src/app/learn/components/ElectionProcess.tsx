/**
 * Election Process Component
 *
 * Educational content explaining the election process and voter requirements.
 * Requirements: 32.5, 32.6, 32.7
 */

"use client";

import { useState } from "react";

interface VoterRequirement {
  title: string;
  titleFil: string;
  description: string;
  descriptionFil: string;
}

const voterRequirements: VoterRequirement[] = [
  {
    title: "Filipino Citizenship",
    titleFil: "Pagkamamamayang Pilipino",
    description: "Must be a citizen of the Philippines",
    descriptionFil: "Dapat ay mamamayan ng Pilipinas",
  },
  {
    title: "Age Requirement",
    titleFil: "Kinakailangang Edad",
    description: "Must be at least 18 years old on election day",
    descriptionFil: "Dapat ay hindi bababa sa 18 taong gulang sa araw ng eleksyon",
  },
  {
    title: "Residency",
    titleFil: "Paninirahan",
    description:
      "Must have resided in the Philippines for at least 1 year and in the place of registration for at least 6 months",
    descriptionFil:
      "Dapat ay naninirahan sa Pilipinas ng hindi bababa sa 1 taon at sa lugar ng pagpaparehistro ng hindi bababa sa 6 na buwan",
  },
  {
    title: "Not Disqualified",
    titleFil: "Hindi Diskwalipikado",
    description:
      "Must not be disqualified by law (e.g., not sentenced to imprisonment of 1 year or more, not declared insane)",
    descriptionFil:
      "Hindi dapat diskwalipikado ng batas (hal., hindi nasentensyahan ng pagkakakulong ng 1 taon o higit pa, hindi idineklara na baliw)",
  },
];

interface ElectionType {
  name: string;
  nameFil: string;
  frequency: string;
  positions: string[];
  description: string;
}

const electionTypes: ElectionType[] = [
  {
    name: "National Elections",
    nameFil: "Pambansang Eleksyon",
    frequency: "Every 6 years (synchronized with local)",
    positions: ["President", "Vice President", "Senators (12 of 24)"],
    description: "Elects national leaders who serve the entire country",
  },
  {
    name: "Local Elections",
    nameFil: "Lokal na Eleksyon",
    frequency: "Every 3 years",
    positions: ["Governors", "Mayors", "Councilors", "Representatives"],
    description: "Elects local government officials for provinces, cities, and municipalities",
  },
  {
    name: "Barangay Elections",
    nameFil: "Eleksyon sa Barangay",
    frequency: "Every 3 years",
    positions: ["Barangay Captain", "Barangay Kagawad", "SK Chairman", "SK Kagawad"],
    description: "Elects officials for the smallest administrative division",
  },
];

interface ElectionTimeline {
  phase: string;
  phaseFil: string;
  timing: string;
  description: string;
}

const electionTimeline: ElectionTimeline[] = [
  {
    phase: "Voter Registration",
    phaseFil: "Pagpaparehistro ng Botante",
    timing: "Continuous, with deadline before election",
    description: "Register at your local COMELEC office or during satellite registration",
  },
  {
    phase: "Filing of Candidacy",
    phaseFil: "Paghahain ng Kandidatura",
    timing: "October before election year",
    description: "Candidates file their Certificate of Candidacy (COC) with COMELEC",
  },
  {
    phase: "Campaign Period",
    phaseFil: "Panahon ng Kampanya",
    timing: "90 days for national, 45 days for local",
    description: "Official period when candidates can campaign and advertise",
  },
  {
    phase: "Election Day",
    phaseFil: "Araw ng Eleksyon",
    timing: "Second Monday of May",
    description: "Voters cast their ballots at designated polling precincts",
  },
  {
    phase: "Canvassing",
    phaseFil: "Pag-canvass",
    timing: "After election day",
    description: "Votes are counted and results are proclaimed",
  },
  {
    phase: "Proclamation",
    phaseFil: "Proklamasyon",
    timing: "After canvassing",
    description: "Winning candidates are officially declared",
  },
];

export function ElectionProcess() {
  const [activeTab, setActiveTab] = useState<"requirements" | "types" | "timeline" | "voting">(
    "requirements"
  );

  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="card">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
          Philippine Election Process
        </h2>
        <p className="mt-1 text-sm text-neutral-500">Proseso ng Eleksyon sa Pilipinas</p>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Elections in the Philippines are administered by the Commission on Elections (COMELEC).
          Understanding the election process helps you exercise your right to vote effectively.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Ang mga eleksyon sa Pilipinas ay pinamamahalaan ng Commission on Elections (COMELEC). Ang
          pag-unawa sa proseso ng eleksyon ay tumutulong sa iyo na gamitin ang iyong karapatang
          bumoto nang epektibo.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            id: "requirements" as const,
            label: "Voter Requirements",
            labelFil: "Mga Kinakailangan",
          },
          { id: "types" as const, label: "Election Types", labelFil: "Mga Uri ng Eleksyon" },
          { id: "timeline" as const, label: "Election Timeline", labelFil: "Timeline ng Eleksyon" },
          { id: "voting" as const, label: "How to Vote", labelFil: "Paano Bumoto" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary-500 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            <span>{tab.label}</span>
            <span className="ml-1 text-xs opacity-75">({tab.labelFil})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "requirements" && <VoterRequirementsSection />}
        {activeTab === "types" && <ElectionTypesSection />}
        {activeTab === "timeline" && <ElectionTimelineSection />}
        {activeTab === "voting" && <HowToVoteSection />}
      </div>
    </div>
  );
}

// Voter Requirements Section
function VoterRequirementsSection() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Who Can Vote?</h3>
        <p className="text-sm text-neutral-500">Sino ang Maaaring Bumoto?</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {voterRequirements.map((req, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
            >
              <div className="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                <CheckIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 dark:text-white">{req.title}</h4>
                <p className="text-xs text-neutral-500">{req.titleFil}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {req.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Registration Info */}
      <div className="card bg-primary-50 dark:bg-primary-900/20">
        <div className="flex items-start gap-4">
          <InfoIcon className="text-primary-500 h-6 w-6 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white">
              How to Register as a Voter
            </h4>
            <p className="text-sm text-neutral-500">Paano Magparehistro bilang Botante</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <li>1. Visit your local COMELEC office or satellite registration site</li>
              <li>2. Bring valid ID and proof of residence</li>
              <li>3. Fill out the voter registration form</li>
              <li>4. Have your biometrics captured (photo, fingerprints, signature)</li>
              <li>5. Wait for your voter&apos;s ID or check your registration status online</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Election Types Section
function ElectionTypesSection() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Types of Elections
        </h3>
        <p className="text-sm text-neutral-500">Mga Uri ng Eleksyon</p>

        <div className="mt-6 space-y-4">
          {electionTypes.map((type, index) => (
            <div
              key={index}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-neutral-900 dark:text-white">{type.name}</h4>
                  <p className="text-xs text-neutral-500">{type.nameFil}</p>
                </div>
                <span className="badge-primary">{type.frequency}</span>
              </div>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {type.description}
              </p>
              <div className="mt-3">
                <p className="text-xs font-medium text-neutral-500">Positions Elected:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {type.positions.map((pos, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    >
                      {pos}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Synchronized Elections Note */}
      <div className="card">
        <h4 className="font-semibold text-neutral-900 dark:text-white">Synchronized Elections</h4>
        <p className="text-sm text-neutral-500">Sabay-sabay na Eleksyon</p>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Since 1992, national and local elections have been synchronized and held on the second
          Monday of May every three years. This means you vote for national and local positions on
          the same day.
        </p>
      </div>
    </div>
  );
}

// Election Timeline Section
function ElectionTimelineSection() {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Election Timeline</h3>
      <p className="text-sm text-neutral-500">Timeline ng Eleksyon</p>

      <div className="relative mt-6">
        {/* Timeline Line */}
        <div className="absolute top-0 left-4 h-full w-0.5 bg-neutral-200 dark:bg-neutral-700" />

        <div className="space-y-6">
          {electionTimeline.map((item, index) => (
            <div key={index} className="relative flex gap-4 pl-10">
              {/* Timeline Dot */}
              <div className="border-primary-500 absolute top-1 left-2 h-4 w-4 rounded-full border-2 bg-white dark:bg-neutral-900" />

              <div className="flex-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-900 dark:text-white">{item.phase}</h4>
                    <p className="text-xs text-neutral-500">{item.phaseFil}</p>
                  </div>
                  <span className="text-primary-500 text-xs">{item.timing}</span>
                </div>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// How to Vote Section
function HowToVoteSection() {
  const votingSteps = [
    {
      step: 1,
      title: "Find Your Precinct",
      titleFil: "Hanapin ang Iyong Presinto",
      description:
        "Check your voter registration to find your assigned polling precinct. You can verify this on the COMELEC website or through their hotline.",
    },
    {
      step: 2,
      title: "Bring Valid ID",
      titleFil: "Magdala ng Valid na ID",
      description:
        "Bring your voter's ID or any valid government-issued ID. You may also use your biometrics for verification.",
    },
    {
      step: 3,
      title: "Go to Your Precinct",
      titleFil: "Pumunta sa Iyong Presinto",
      description:
        "On election day, go to your assigned precinct. Voting hours are typically from 6:00 AM to 7:00 PM.",
    },
    {
      step: 4,
      title: "Get Your Ballot",
      titleFil: "Kunin ang Iyong Balota",
      description:
        "Present your ID to the Board of Election Inspectors (BEI). They will verify your identity and give you your ballot.",
    },
    {
      step: 5,
      title: "Fill Out Your Ballot",
      titleFil: "Sagutan ang Iyong Balota",
      description:
        "Go to the voting booth and shade the ovals next to your chosen candidates. Use the provided marking pen.",
    },
    {
      step: 6,
      title: "Feed Your Ballot",
      titleFil: "Ipasok ang Iyong Balota",
      description:
        "Insert your completed ballot into the Vote Counting Machine (VCM). Wait for the confirmation that your vote was recorded.",
    },
    {
      step: 7,
      title: "Get Your Receipt",
      titleFil: "Kunin ang Iyong Resibo",
      description:
        "The VCM will print a receipt showing your votes were counted. Check it before leaving.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Step-by-Step Voting Guide
        </h3>
        <p className="text-sm text-neutral-500">Gabay sa Pagboto</p>

        <div className="mt-6 space-y-4">
          {votingSteps.map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
            >
              <div className="bg-primary-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white">
                <span className="font-bold">{item.step}</span>
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 dark:text-white">{item.title}</h4>
                <p className="text-xs text-neutral-500">{item.titleFil}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Important Reminders */}
      <div className="card bg-warning-50 dark:bg-warning-900/20">
        <div className="flex items-start gap-4">
          <WarningIcon className="text-warning-500 h-6 w-6 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white">Important Reminders</h4>
            <p className="text-sm text-neutral-500">Mahahalagang Paalala</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <li>• Vote buying and selling is illegal and punishable by law</li>
              <li>• Taking photos of your ballot is prohibited</li>
              <li>• Campaigning within 30 meters of polling precincts is not allowed</li>
              <li>• Liquor ban is in effect 24 hours before and after election day</li>
              <li>• Gun ban is in effect during the election period</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon Components
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

function WarningIcon({ className }: { className?: string }) {
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
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}
