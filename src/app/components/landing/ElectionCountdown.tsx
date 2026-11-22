"use client";

import { useTranslations } from "next-intl";

export function ElectionCountdown() {
  const t = useTranslations("home.research");
  return (
    <a
      href="https://www.comelec.gov.ph/"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 inline-block text-sm underline underline-offset-4"
    >
      {t("electionLink")}
    </a>
  );
}
