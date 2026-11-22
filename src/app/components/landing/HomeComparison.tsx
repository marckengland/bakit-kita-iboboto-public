"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HomeProfileSearch, type HomeProfile } from "./HomeProfileSearch";

interface HomeComparisonProps {
  profiles: { id: string; fullName: string }[];
}

export function HomeComparison({ profiles }: HomeComparisonProps) {
  const t = useTranslations("home.research");
  const router = useRouter();
  const id = useId();
  const [first, setFirst] = useState<HomeProfile | null>(null);
  const [second, setSecond] = useState<HomeProfile | null>(null);
  const available = profiles.length >= 2;
  const valid = available && first !== null && second !== null && first.id !== second.id;

  return (
    <form
      aria-label={t("compareTitle")}
      className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-7 dark:border-neutral-700 dark:bg-neutral-900"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          router.push(`/compare?ids=${encodeURIComponent(`${first!.id},${second!.id}`)}`);
        }
      }}
    >
      <h2 className="text-2xl font-semibold tracking-tight">{t("compareTitle")}</h2>
      <p
        id={`${id}-hint`}
        className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400"
      >
        {t("comparePrompt")}
      </p>
      <fieldset disabled={!available} aria-describedby={`${id}-hint`} className="mt-6 space-y-4">
        <input type="hidden" name="first" value={first?.id ?? ""} />
        <input type="hidden" name="second" value={second?.id ?? ""} />
        <HomeProfileSearch
          label={t("firstPerson")}
          profiles={profiles}
          value={first}
          excludeId={second?.id}
          disabled={!available}
          onSelect={setFirst}
        />
        <HomeProfileSearch
          label={t("secondPerson")}
          profiles={profiles}
          value={second}
          excludeId={first?.id}
          disabled={!available}
          onSelect={setSecond}
        />
        <button
          type="submit"
          disabled={!valid}
          className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("compare")}
        </button>
      </fieldset>
      {!available && (
        <p className="mt-4 text-sm" role="status">
          {t("compareUnavailable")}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        {t("compareScope")}
      </p>
    </form>
  );
}
