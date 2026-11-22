import { useTranslations } from "next-intl";

const GOV_SOURCES = [
  { name: "COMELEC", abbr: "COMELEC" },
  { name: "Senate of the Philippines", abbr: "Senate" },
  { name: "House of Representatives", abbr: "House" },
  { name: "Department of Budget and Management", abbr: "DBM" },
  { name: "Commission on Audit", abbr: "COA" },
  { name: "Supreme Court", abbr: "Judiciary" },
  { name: "Office of the Ombudsman", abbr: "Ombudsman" },
];

const NEWS_SOURCES = [
  { name: "Rappler", abbr: "Rappler" },
  { name: "Philippine Daily Inquirer", abbr: "Inquirer" },
  { name: "PhilStar", abbr: "PhilStar" },
  { name: "GMA News", abbr: "GMA News" },
  { name: "ABS-CBN News", abbr: "ABS-CBN" },
  { name: "LawPhil", abbr: "LawPhil" },
  { name: "Philippine Center for Investigative Journalism", abbr: "PCIJ" },
  { name: "VERA Files", abbr: "VERA Files" },
];

export function TrustBadges() {
  const t = useTranslations("home");

  return (
    <div className="mx-auto mt-8 max-w-4xl text-center">
      {/* Government Sources */}
      <p className="mb-3 text-xs font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
        {t("trust.label")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {GOV_SOURCES.map((source) => (
          <span
            key={source.abbr}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
          >
            <span className="bg-success-500 h-1.5 w-1.5 rounded-full" aria-hidden="true"></span>
            {source.abbr}
          </span>
        ))}
      </div>

      {/* News & Research Sources */}
      <p className="mt-4 mb-3 text-xs font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
        {t("trust.verifiedLabel")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {NEWS_SOURCES.map((source) => (
          <span
            key={source.abbr}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-neutral-50/50 px-3 py-1.5 text-xs font-medium text-neutral-500 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-500"
          >
            <span className="bg-info-400 h-1.5 w-1.5 rounded-full" aria-hidden="true"></span>
            {source.abbr}
          </span>
        ))}
      </div>
    </div>
  );
}
