/**
 * Legislative Process Component
 *
 * Visual guide explaining how a bill becomes a law in the Philippines.
 * Requirements: 32.3, 32.6, 32.7
 */

"use client";

import { useState } from "react";

interface ProcessStep {
  number: number;
  title: string;
  titleFil: string;
  description: string;
  descriptionFil: string;
  details: string[];
  chamber?: "house" | "senate" | "both";
}

const legislativeSteps: ProcessStep[] = [
  {
    number: 1,
    title: "Bill Filing",
    titleFil: "Paghahain ng Panukalang Batas",
    description:
      "A bill is filed by a member of Congress (Senator or Representative). Bills can originate from either chamber, except for appropriation, revenue, and tariff bills which must originate from the House.",
    descriptionFil:
      "Ang panukalang batas ay inihahain ng isang miyembro ng Kongreso. Ang mga panukalang batas ay maaaring magmula sa alinmang kapulungan, maliban sa mga panukalang batas sa appropriation, revenue, at tariff na dapat magmula sa Kapulungan.",
    details: [
      "Bill is assigned a number (e.g., HB 1234 or SB 1234)",
      "Referred to appropriate committee based on subject matter",
      "Multiple authors can co-sponsor a bill",
    ],
    chamber: "both",
  },
  {
    number: 2,
    title: "Committee Deliberation",
    titleFil: "Deliberasyon sa Komite",
    description:
      "The bill is studied by the relevant committee. Public hearings may be conducted to gather input from stakeholders and experts.",
    descriptionFil:
      "Ang panukalang batas ay pinag-aaralan ng kaukulang komite. Maaaring magsagawa ng public hearings upang kumuha ng input mula sa mga stakeholder at eksperto.",
    details: [
      "Committee reviews the bill's merits and implications",
      "Public hearings allow citizen participation",
      "Committee may amend, consolidate, or substitute the bill",
      "Committee report is prepared recommending approval or rejection",
    ],
    chamber: "both",
  },
  {
    number: 3,
    title: "First Reading",
    titleFil: "Unang Pagbasa",
    description:
      "The bill's number, title, and authors are read on the floor. The bill is then referred to the appropriate committee if not yet done.",
    descriptionFil:
      "Ang numero, pamagat, at mga may-akda ng panukalang batas ay binabasa sa plenaryo. Ang panukalang batas ay ipinapadala sa kaukulang komite kung hindi pa nagawa.",
    details: [
      "Formal introduction of the bill to the chamber",
      "No debate occurs at this stage",
      "Bill is calendared for committee action",
    ],
    chamber: "both",
  },
  {
    number: 4,
    title: "Second Reading",
    titleFil: "Ikalawang Pagbasa",
    description:
      "The bill is debated on the floor. Amendments may be proposed and voted upon. This is the most critical stage where the bill's content is thoroughly examined.",
    descriptionFil:
      "Ang panukalang batas ay pinagdedebatehan sa plenaryo. Maaaring magmungkahi ng mga susog at iboto. Ito ang pinakamahalagang yugto kung saan masusing sinusuri ang nilalaman ng panukalang batas.",
    details: [
      "Sponsorship speech explains the bill's purpose",
      "Period of debate allows questions and interpellations",
      "Period of amendments allows changes to the bill",
      "Voting on amendments occurs",
    ],
    chamber: "both",
  },
  {
    number: 5,
    title: "Third Reading",
    titleFil: "Ikatlong Pagbasa",
    description:
      "The final version of the bill is voted upon. No amendments are allowed at this stage. A majority vote is needed for approval.",
    descriptionFil:
      "Ang huling bersyon ng panukalang batas ay ibinoboto. Walang mga susog na pinapayagan sa yugtong ito. Kailangan ng majority vote para sa pag-apruba.",
    details: [
      "Copies of the final bill are distributed to members",
      "Roll call vote is conducted",
      "If approved, bill is transmitted to the other chamber",
      "If rejected, the bill is archived",
    ],
    chamber: "both",
  },
  {
    number: 6,
    title: "Transmittal to Other Chamber",
    titleFil: "Pagpapadala sa Kabilang Kapulungan",
    description:
      "The approved bill is sent to the other chamber (Senate to House or House to Senate) where it undergoes the same process.",
    descriptionFil:
      "Ang inaprubahang panukalang batas ay ipinapadala sa kabilang kapulungan kung saan ito dadaan sa parehong proseso.",
    details: [
      "The other chamber may approve, amend, or reject the bill",
      "If approved without amendments, it proceeds to enrollment",
      "If amended, it returns to the originating chamber",
    ],
    chamber: "both",
  },
  {
    number: 7,
    title: "Bicameral Conference Committee",
    titleFil: "Bicameral Conference Committee",
    description:
      "If the two chambers pass different versions, a conference committee reconciles the differences. The committee is composed of members from both chambers.",
    descriptionFil:
      "Kung ang dalawang kapulungan ay nagpasa ng magkaibang bersyon, isang conference committee ang nagkakasundo sa mga pagkakaiba. Ang komite ay binubuo ng mga miyembro mula sa parehong kapulungan.",
    details: [
      "Committee resolves conflicting provisions",
      "Produces a consolidated version acceptable to both chambers",
      "Both chambers must ratify the conference committee report",
    ],
    chamber: "both",
  },
  {
    number: 8,
    title: "Enrollment",
    titleFil: "Enrollment",
    description:
      "The final bill is printed in its final form and signed by the Senate President and House Speaker, certifying its passage.",
    descriptionFil:
      "Ang huling panukalang batas ay inilimbag sa huling anyo nito at nilagdaan ng Senate President at House Speaker, na nagpapatunay ng pagpasa nito.",
    details: [
      "Bill is prepared in final enrolled form",
      "Signed by presiding officers of both chambers",
      "Transmitted to the President",
    ],
    chamber: "both",
  },
  {
    number: 9,
    title: "Presidential Action",
    titleFil: "Aksyon ng Pangulo",
    description:
      "The President has 30 days to act on the bill. The President may sign it into law, veto it, or allow it to lapse into law without signature.",
    descriptionFil:
      "Ang Pangulo ay may 30 araw upang kumilos sa panukalang batas. Maaaring lagdaan ito ng Pangulo bilang batas, i-veto ito, o hayaang maging batas nang walang lagda.",
    details: [
      "Sign: Bill becomes law immediately",
      "Veto: Bill is returned to Congress with objections",
      "Inaction: Bill becomes law after 30 days (lapse into law)",
      "Line-item veto allowed for appropriation bills",
    ],
  },
  {
    number: 10,
    title: "Veto Override (if applicable)",
    titleFil: "Pag-override ng Veto (kung naaangkop)",
    description:
      "If the President vetoes the bill, Congress may override the veto with a two-thirds vote of all members of both chambers voting separately.",
    descriptionFil:
      "Kung i-veto ng Pangulo ang panukalang batas, maaaring i-override ng Kongreso ang veto sa pamamagitan ng dalawang-katlong boto ng lahat ng miyembro ng parehong kapulungan na bumoboto nang hiwalay.",
    details: [
      "Requires 2/3 vote in both Senate and House",
      "Each chamber votes separately",
      "If successful, bill becomes law despite veto",
      "Rarely successful in Philippine history",
    ],
    chamber: "both",
  },
];

export function LegislativeProcess() {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="card">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
          How a Bill Becomes a Law
        </h2>
        <p className="mt-1 text-sm text-neutral-500">Paano Nagiging Batas ang Panukalang Batas</p>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          The legislative process in the Philippines involves multiple stages of deliberation,
          debate, and voting. A bill must pass through both chambers of Congress and receive
          presidential approval before becoming a law.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Ang proseso ng paggawa ng batas sa Pilipinas ay may maraming yugto ng deliberasyon,
          debate, at pagboto. Ang panukalang batas ay dapat dumaan sa parehong kapulungan ng
          Kongreso at makatanggap ng pag-apruba ng Pangulo bago maging batas.
        </p>
      </div>

      {/* Visual Process Flow */}
      <div className="card">
        <h3 className="mb-6 text-lg font-semibold text-neutral-900 dark:text-white">
          Legislative Process Flow
        </h3>

        {/* Process Steps */}
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute top-0 left-6 h-full w-0.5 bg-neutral-200 md:left-1/2 md:-translate-x-1/2 dark:bg-neutral-700" />

          <div className="space-y-6">
            {legislativeSteps.map((step, index) => (
              <div
                key={step.number}
                className={`relative flex items-start gap-4 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Step Number Circle */}
                <div
                  className={`relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-4 ${
                    selectedStep === step.number
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
                  } md:absolute md:left-1/2 md:-translate-x-1/2`}
                >
                  <span className="font-bold">{step.number}</span>
                </div>

                {/* Step Content */}
                <button
                  onClick={() => setSelectedStep(selectedStep === step.number ? null : step.number)}
                  className={`flex-1 rounded-xl border-2 p-4 text-left transition-all md:w-[calc(50%-3rem)] ${
                    index % 2 === 0 ? "md:mr-auto md:pr-8" : "md:ml-auto md:pl-8"
                  } ${
                    selectedStep === step.number
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-neutral-900 dark:text-white">{step.title}</h4>
                    {step.chamber && <ChamberBadge chamber={step.chamber} />}
                  </div>
                  <p className="text-xs text-neutral-500">{step.titleFil}</p>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {step.description}
                  </p>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Step Details */}
      {selectedStep && (
        <div className="card animate-fade-in">
          {legislativeSteps
            .filter((s) => s.number === selectedStep)
            .map((step) => (
              <div key={step.number}>
                <div className="flex items-center gap-3">
                  <div className="bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full text-white">
                    <span className="font-bold">{step.number}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="text-sm text-neutral-500">{step.titleFil}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-neutral-600 dark:text-neutral-400">{step.description}</p>
                    <p className="mt-2 text-sm text-neutral-500">{step.descriptionFil}</p>
                  </div>

                  <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
                    <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Key Points:
                    </p>
                    <ul className="space-y-2">
                      {step.details.map((detail, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400"
                        >
                          <ArrowIcon className="text-primary-500 mt-0.5 h-4 w-4 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Quick Reference */}
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
          Quick Reference
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickRefCard
            title="Quorum"
            value="Majority of members"
            description="Required to conduct business"
          />
          <QuickRefCard
            title="Approval Vote"
            value="Majority present"
            description="To pass a bill on 3rd reading"
          />
          <QuickRefCard
            title="Veto Override"
            value="2/3 of all members"
            description="To override presidential veto"
          />
          <QuickRefCard
            title="Presidential Action"
            value="30 days"
            description="Time to sign, veto, or let lapse"
          />
        </div>
      </div>

      {/* Types of Bills */}
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
          Types of Legislative Measures
        </h3>
        <p className="text-sm text-neutral-500">Mga Uri ng Panukalang Batas</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <BillTypeCard
            type="Bill"
            typeFil="Panukalang Batas"
            description="A proposed law that, if passed, becomes a Republic Act"
            example="House Bill No. 1234, Senate Bill No. 5678"
          />
          <BillTypeCard
            type="Resolution"
            typeFil="Resolusyon"
            description="Expresses the sense of Congress but does not have the force of law"
            example="House Resolution, Senate Resolution"
          />
          <BillTypeCard
            type="Joint Resolution"
            typeFil="Magkasamang Resolusyon"
            description="Requires approval of both chambers; may have force of law"
            example="Used for constitutional amendments"
          />
          <BillTypeCard
            type="Concurrent Resolution"
            typeFil="Sabay-sabay na Resolusyon"
            description="Requires approval of both chambers; no force of law"
            example="Used for joint sessions, rules"
          />
        </div>
      </div>
    </div>
  );
}

// Chamber Badge Component
function ChamberBadge({ chamber }: { chamber: "house" | "senate" | "both" }) {
  const labels = {
    house: "House",
    senate: "Senate",
    both: "Both Chambers",
  };

  return <span className="badge-primary text-xs">{labels[chamber]}</span>;
}

// Quick Reference Card Component
function QuickRefCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <p className="text-xs font-medium text-neutral-500">{title}</p>
      <p className="text-primary-500 mt-1 text-lg font-bold">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{description}</p>
    </div>
  );
}

// Bill Type Card Component
function BillTypeCard({
  type,
  typeFil,
  description,
  example,
}: {
  type: string;
  typeFil: string;
  description: string;
  example: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h4 className="font-semibold text-neutral-900 dark:text-white">{type}</h4>
      <p className="text-xs text-neutral-500">{typeFil}</p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      <p className="mt-2 text-xs text-neutral-400">Example: {example}</p>
    </div>
  );
}

// Arrow Icon Component
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}
