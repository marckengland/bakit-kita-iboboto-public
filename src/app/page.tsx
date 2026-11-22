import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { prisma } from "@/lib/prisma";
import { HomeComparison } from "./components/landing/HomeComparison";
import { getHomeFilingExamples } from "@/lib/homepage-filings";
import { getReleasedProfile, releaseData } from "@/lib/release-data";
import {
  ReviewedMembership,
  formatReviewedDate,
} from "./politicians/components/ReviewedMembership";
import { getPublicResearchBatch } from "@/services/public-research.service";

export const dynamic = "force-dynamic";

async function getHomePageData() {
  try {
    const [count, profiles] = await Promise.all([
      prisma.politician.count({ where: { isActive: true } }),
      prisma.politician.findMany({
        where: { isActive: true },
        take: 24,
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fullName: true,
          updatedAt: true,
          Position: {
            where: { isCurrent: true },
            orderBy: { startDate: "desc" },
            take: 1,
            select: { title: true, jurisdiction: true },
          },
        },
      }),
    ]);
    let researchUnavailable = false;
    try {
      const research = await getPublicResearchBatch(profiles.map((profile) => profile.id));
      researchUnavailable = [...research.values()].some(
        (entry) => entry.availability === "unavailable"
      );
    } catch (error) {
      console.error("Homepage research availability check failed:", error);
      researchUnavailable = true;
    }
    return {
      available: true,
      count,
      profiles: profiles.map((profile) => ({
        ...profile,
        reviewedBatch: getReleasedProfile(profile.id, profile.fullName),
      })),
      researchUnavailable,
    };
  } catch (error) {
    console.error("Homepage profile lookup failed:", error);
    return { available: false, count: null, profiles: [], researchUnavailable: false };
  }
}

export default async function Home() {
  const t = await getTranslations("home.research");
  const data = await getHomePageData();
  const reviewedBatch = data.profiles.find((profile) => profile.reviewedBatch)?.reviewedBatch;
  const recentProfiles = data.profiles.slice(0, 6);
  const filingExamples = getHomeFilingExamples(data.profiles.map((profile) => profile.id));
  const comparisonProfiles = data.profiles
    .map(({ id, fullName }) => ({ id, fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const paths = [
    { href: "/politicians", title: t("browse"), description: t("browseHint") },
    { href: "/compare", title: t("compare"), description: t("compareHint") },
    { href: "/bookmarks", title: t("saved"), description: t("savedHint") },
  ];

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <Header showGetStarted={false} />
      <main className="container-wide pb-32">
        <section className="grid items-center gap-10 border-b border-neutral-200 py-10 sm:py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 dark:border-neutral-800">
          <div className="min-w-0">
            <p className="text-primary-600 dark:text-primary-400 mb-5 text-xs font-semibold tracking-widest uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="max-w-4xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl xl:text-6xl">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
              {t("intro")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/politicians" className="btn-primary">
                {t("browse")}
              </Link>
              <Link
                href="#data-coverage"
                className="inline-flex items-center px-4 py-3 text-sm font-medium underline underline-offset-4"
              >
                {t("coverageLink")}
              </Link>
            </div>
          </div>
          <HomeComparison profiles={comparisonProfiles} />
        </section>

        <nav
          aria-label={t("start")}
          className="flex flex-wrap gap-x-6 gap-y-3 border-b border-neutral-200 py-5 text-sm dark:border-neutral-800"
        >
          {paths.map((path) => (
            <Link
              key={path.href}
              href={path.href}
              className="hover:text-primary-600 dark:hover:text-primary-400 font-medium underline underline-offset-4"
            >
              {path.title}
            </Link>
          ))}
        </nav>

        {filingExamples.length > 0 && (
          <section className="py-10" aria-labelledby="filing-examples-title">
            <h2 id="filing-examples-title" className="text-2xl font-semibold tracking-tight">
              {t("filingExamples")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {t("filingExamplesHint")}
            </p>
            <ul className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {filingExamples.map((filing) => (
                <li
                  key={filing.id}
                  className="grid min-w-0 gap-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)] md:gap-8"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      SBN-{filing.billNumber} · 20th Congress
                    </p>
                    <h3 className="mt-2 text-lg leading-snug font-semibold">{filing.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {filing.summary}
                    </p>
                    <Link
                      href={`/politicians/${filing.introducedBy.profileId}#selected-filings`}
                      className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
                    >
                      {t("readFiling")}
                    </Link>
                  </div>
                  <div className="space-y-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    <p>
                      <span className="font-medium">{t("introducedBy")}:</span>{" "}
                      {filing.introducedBy.name}
                    </p>
                    <p>
                      <span className="font-medium">{t("filingDate")}:</span>{" "}
                      {filing.filingDate ? (
                        <time dateTime={filing.filingDate}>
                          {formatReviewedDate(filing.filingDate)}
                        </time>
                      ) : (
                        t("filingDateUnknown")
                      )}
                    </p>
                    {filing.sources[0] && (
                      <a
                        href={filing.sources[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block underline underline-offset-4"
                      >
                        {t("filedDocument")}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          id="data-coverage"
          className="grid gap-6 border-b border-neutral-200 py-10 md:grid-cols-[1fr_2fr] dark:border-neutral-800"
        >
          <h2 className="text-xl font-semibold">{t("coverage")}</h2>
          <div className="max-w-2xl space-y-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {data.researchUnavailable && <p role="status">{t("researchUnavailable")}</p>}
            <p>{t("coverageDefinition")}</p>
            <p>{t("coverageHint")}</p>
            <p>{t("missingHint")}</p>
            {reviewedBatch && (
              <p>
                This release covers {releaseData.cohort.members} profiles from the opening roster of
                the {reviewedBatch.congress}th Congress Senate, observed{" "}
                <time dateTime={reviewedBatch.observedOn}>
                  {formatReviewedDate(reviewedBatch.observedOn)}
                </time>
                . It includes {releaseData.selection.includedCount} selected Senate filings. Current
                office and career totals are unverified.
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
              {reviewedBatch && (
                <a
                  href={reviewedBatch.datasetUrl}
                  className="text-primary-600 dark:text-primary-400 font-medium underline underline-offset-4"
                >
                  Senate cohort dataset and review notes
                </a>
              )}
              <Link
                href="/learn"
                className="text-primary-600 dark:text-primary-400 font-medium underline underline-offset-4"
              >
                {t("method")}
              </Link>
              <Link
                href="/contact"
                className="text-primary-600 dark:text-primary-400 font-medium underline underline-offset-4"
              >
                {t("correction")}
              </Link>
              <a
                href="https://www.comelec.gov.ph/"
                className="text-primary-600 dark:text-primary-400 font-medium underline underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("electionLink")}
              </a>
            </div>
          </div>
        </section>

        <section className="py-10" aria-labelledby="recent-profiles-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="recent-profiles-title" className="text-2xl font-semibold tracking-tight">
                {t("recent")}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
                {t("updateHint")}
              </p>
            </div>
            {data.available && !reviewedBatch && (
              <p className="text-sm text-neutral-500">
                {t("profileCount", { count: data.count ?? 0 })}
              </p>
            )}
          </div>
          {!data.available ? (
            <p className="mt-6 rounded-xl bg-neutral-50 p-6 dark:bg-neutral-900" role="status">
              {t("unavailable")}
            </p>
          ) : data.profiles.length === 0 ? (
            <p className="mt-6 rounded-xl bg-neutral-50 p-6 dark:bg-neutral-900" role="status">
              {t("empty")}
            </p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentProfiles.map((profile) => (
                <li key={profile.id}>
                  <Link
                    href={`/politicians/${profile.id}`}
                    className="hover:border-primary-400 dark:hover:border-primary-500 block h-full rounded-xl border border-neutral-200 p-5 transition-colors dark:border-neutral-800"
                  >
                    <h3 className="mt-3 text-lg font-semibold">{profile.fullName}</h3>
                    {profile.reviewedBatch ? (
                      <ReviewedMembership
                        batch={profile.reviewedBatch}
                        className="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {profile.Position[0]?.title ?? t("officeUnknown")}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500">
                      {t("updated")}{" "}
                      <time dateTime={profile.updatedAt.toISOString()}>
                        {profile.updatedAt.toISOString().slice(0, 10)}
                      </time>
                    </p>
                    <span className="text-primary-600 dark:text-primary-400 mt-5 inline-block text-sm font-medium">
                      {t("readProfile")} <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
