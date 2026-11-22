# Verification record

The results below describe the preceding populated candidate. This separate
November 22 refresh adds evidence and tests; its scope and release restrictions
are in [the current review](RELEASE_REVIEW.md). The final local check results
for this refresh are recorded there after verification.

These checks ran locally on the populated release copy on November 22, 2026, using Node.js 22.23.5 and npm 11.21.2. Neither existing copy was modified. Hosted CI has not run for this candidate.

| Check                         | Recorded result                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`               | Passed lint with zero warnings, typecheck, and 2,140 tests across 107 files                                                                                        |
| `npm run build`               | Passed the production build                                                                                                                                        |
| `npm run format:check`        | Passed                                                                                                                                                             |
| `npm run docs:check`          | Passed                                                                                                                                                             |
| `npm run data:verify`         | Passed approved bytes, fresh migrations, 24 profiles, 45 filings, unknown fields, exact repeat, drift refusal, other-schema refusal, and full transaction rollback |
| Existing case-review verifier | Passed schema ownership, gated transactions, HTTP, reviewed chat, browser offline, and rollback checks on its own disposable database                              |
| `npm audit --json`            | Exit 0, zero findings after the approved scoped Effect fix                                                                                                         |
| `npm audit --omit=dev --json` | Exit 0, zero findings after the approved scoped Effect fix                                                                                                         |

The [machine-readable candidate record](../publication/populated-verification.json) supplies the final integrity, browser, and archive results. A check is not passed if it was interrupted or skipped.

## Data and test integrity

The reviewed batch has 24 dated membership observations and 45 selected filings. Forty-four filing dates are populated; SBN-142 remains unknown. Three candidate filings stay out. The loader stores unknown bill statuses, sessions, and source confidence as null, and creates no invented Position terms. The verification import created 460 field citations.

All 98 inherited test files retain their exact bytes and assertions. Nine new files add 96 tests covering data integrity, unknowns, services, and rendering. The source-only baseline was 2,044 passing tests in 98 files. The populated inventory adds the new files while retaining the earlier hashes, fixture protections, and dependency checks.

The UI follow-up also preserved all 102 tests from the first populated candidate. It adds a comparison entry on the homepage, source-backed filing examples, exact profile-column counts, grouped footer controls, and short-window reflow.

The Senate chat follow-up adds 48 tests in four files. Of the 103 preceding
populated test files, 102 remain byte-identical. The homepage test has three
routine selector corrections for autocomplete in place of native options. Its
assertion calls, matchers, negation, disabled-submit behavior, and test count are
unchanged. The original 98 tests and frozen data remain byte-identical.

Browser checks covered a cited SBN-142 answer with its conflicting dates,
profile choice preserving a topic query, automatic case-gate separation,
unsupported Congress handling, autocomplete keyboard selection, duplicate
prevention, and selection invalidation after editing. Mobile and short-window
reflow were inspected; native browser zoom remains unverified. The existing
case verifier separately passed offline invalidation, close/reopen, and rollback.

The earlier November 19 record verified 745 original-repository files. Its temporary per-file baseline is no longer available for another comparison. A fresh November 22 snapshot of 1,018 original files, Git HEAD, index, and working-tree status was unchanged during final packaging. This task made no original-repository edits or Git mutations. The earlier source-only copy's 480 recorded files remain unchanged. Installed dependencies were copied with separate inodes before Prisma generation in the new copy. The approved scoped Effect fix is the sole dependency change. Its lock diff changes only Effect from 3.20.0 to 3.22.1; all direct versions and existing overrides remain unchanged.

## Documentation follow-up

The final documentation corrections update the security summary, repair the
license link, and separate normal contributor checks from
[clean release-artifact checks](TESTING.md#verify-a-prepared-release-artifact).
The contributor commands passed in a disposable checkout with Git metadata and
synthetic local configuration: all 2,140 tests, typecheck, lint, and source and
documentation formatting passed. The clean-export procedure passed installation,
the unchanged integrity verifier, and source-file checksums. The packaging guard
still rejects Git metadata and private environment files by default.

This follow-up changes documentation and release records only. All 107 test files,
executable source, dependencies, configuration, and approved data remain unchanged.
The build and database-verifier results above are from the preceding final
readiness check on the same runtime files; those checks were not repeated for
this documentation-only change.

## Dependency evidence

The maintainer approved one scoped Effect override on November 22. Clean installs
in the populated copy and a disposable folder passed with npm 11.21.2. Prisma
configuration, schema validation, client generation, both database verifiers, and
the full suite passed after installation. All 107 preceding tests are byte-identical.

The original dependency hashes remain in the record. The verifier accepts the
exact approved override and pins the new lock hash; negative checks reject
unrelated dependency and lock changes even when a release-record hash is updated.
Both current audits report zero findings. The [dependency guide](DEPENDENCY_SECURITY.md)
retains the pre-fix failures and earlier audit history. The picomatch advisory
remains withdrawn, and its historical exception expiry is unchanged.

## Limits

The data review checked specific fields against filed documents and separate Senate records; indexed official text was used where direct access failed. It did not establish that every source URL is currently downloadable, or reread every page of every document during integration.

Local verification does not establish hosted CI, public deployment, Resend delivery, production operations, or current office. The versioned API's authenticated HTTP access is covered by unit tests rather than a live account credential. The [release status](RELEASE_REVIEW.md) separates those pending decisions from the completed local checks.

No commit, push, public repository, deployment, existing-database migration, or publication was performed for this integration.
