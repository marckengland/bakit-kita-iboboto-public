# Release status

## November 23 launch preparation

The public source remains separate from a hosted launch. The owner requested
completion of local launch work, chose a hosting plan without paid resources,
and confirmed that Resend delivery must remain disabled.

The production guest boundary now closes unsupported account mutations,
community reports, notifications, bookmarks, voting lists, cron and general-AI
routes. The authenticated session probe remains. Record chat and feedback have
shared Redis budgets, bounded JSON reads and fail-closed behavior. Feedback
account attribution uses a validated session; attachment size/type/encoding
checks match the upload hints. Shared session commands have bounded deadlines.

The app serves `/privacy`, linked from `/contact`. The
[privacy information](PRIVACY.md), [correction guide](CORRECTIONS.md), and
[operations runbook](OPERATIONS.md) describe actual behavior, unapproved operator
decisions and hosted acceptance limits. Private delivery is still unavailable.

New disposable verifiers test actual cross-process Redis limits and a real
PostgreSQL dump/restore. Existing case and Senate browser checks keep their
assertions and now own their required Redis service. All 111 inherited test
files, dependencies, approved datasets and migrations remain unchanged.
[Launch integrity record](../publication/launch-preparation.json)

Before public traffic, select and approve infrastructure and spending, verify
hosted backups/restore and ingress controls, finish a monitored private reporting
route and operator-approved privacy arrangements, then authorize and verify a
hosted candidate. No hosted resources, real mail delivery or site deployment are
approved or claimed by this preparation. Public CI results are available in
[GitHub Actions](https://github.com/marckengland/bakit-kita-iboboto-public/actions).

The dated November 22 source and verification record below remains as history.

Updated November 22, 2026. This source version includes the approved Senate
evidence refresh. The maintainer authorized the public repository update in the
[publication record](../publication/refreshed-publication.json). Every earlier
local copy remains unchanged. Source publication does not authorize deployment or
changes to an existing database.

| Item               | State                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Base data          | The sealed 24-profile, 45-filing batch is retained unchanged.                                                                    |
| New evidence       | Qualified elected terms, 24 separate dated membership observations and 41 dated history entries for 31 bills are integrated.     |
| Held additions     | Fourteen bills receive no new history. Unverified current offices, original-bill current statuses and enactments remain unknown. |
| Tests              | All 107 inherited test files retain their original bytes and assertions. New coverage is additive.                               |
| Public publication | Authorized for this repository update. Frozen integration approvals retain their earlier scope.                                  |
| Deployment         | Not authorized. Local verification is not proof of hosted readiness.                                                             |

Read the [refresh scope and sources](../public/data/senate-20-refresh-2026-11-22/INDEX.md),
[data workflow](DATA.md) and [verification procedure](TESTING.md#verify-the-senate-refresh).
Integration approval does not turn a scheduled elected term into actual tenure or
a substitute's enactment into enactment of its original bill.

## Before hosting

A public site still needs a protected database, backups and a tested restore,
monitoring, suitable abuse controls, a working private correction route and
public-facing privacy information. The Resend form remains disabled and delivery
unverified. Production administration and identity verification remain unavailable.
Cases and background research stay at their safe defaults. See the
[security policy](../SECURITY.md) and [configuration reference](CONFIGURATION.md).

The data remains incomplete. Current office and complete legislative histories
need further source review. Cases, family relationships, finances, elections,
attendance totals, recorded votes and impact ratings are not established by this
refresh. Missing values are not zero or clearance.

Code remains MIT licensed. Approved structured facts and original wording use
CC0 1.0. Source documents retain their own rights; source PDFs and private review
packets are excluded. Required font and icon notices remain included.

## Local verification of this copy

Checked November 22, 2026 with Node.js 22.23.5 and npm 11.21.2.

| Check                                           | Result                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                 | Passed: lint with zero warnings, typecheck and 2,170 tests in 111 files.                                                                                                             |
| `npm run build`                                 | Passed. Next.js still warns about the existing custom static-asset Cache-Control header.                                                                                             |
| `npm run format:check` and `npm run docs:check` | Passed.                                                                                                                                                                              |
| Release integrity and Senate refresh verifiers  | Passed: all 107 inherited test files, the sealed batch, 24 qualified terms, 31 histories and 41 events.                                                                              |
| `npm run data:verify`                           | Passed on an owned disposable PostgreSQL database: import, exact repeat, refusals and rollback.                                                                                      |
| `scripts/verify-case-review.ts`                 | Passed: schema, ownership, transactions, HTTP, reviewed chat, offline invalidation and feature rollback.                                                                             |
| Refreshed-record API and browser checks         | Passed against a separate disposable database and a localhost production server: profiles, bill modal, comparison, chat, export citations and withholding after stored data changes. |
| `npm audit --json`                              | Zero findings. Dependencies and the lockfile are unchanged.                                                                                                                          |

The browser check also tested horizontal reflow at a 390-pixel viewport with
125% CSS zoom. This is not verification of native browser zoom, all devices or
assistive technology. Early browser runs timed out; the passing check waits for
specific records and interactions rather than requiring background navigation
requests to stop. It keeps the same content and citation checks.

New tests cover cached timestamps, stale author names, modified stored records,
noninteractive profile cards, export source-access notes and mixed availability.
No existing test assertion was changed. The original repository, earlier copies,
their archives and the published baseline were checked against saved hashes.

No hosted CI, live reporting email, production database or deployment was tested
for this version. Private delivery remains unverified, and no additional data
outside the approved refresh was imported. See the hosting requirements above.

## Release-record and browser-check corrections

The Heroicons inventory now pins the current ProfileHeader component bytes and
SVG line. Its prior digest is retained in the record. The icon path and both
license files are unchanged. The source verifier now rejects stale component,
path, line or license metadata. The publication introduction and script catalog
also describe the refreshed copy and its verification commands.

The private Puppeteer helper intermittently timed out while its failure snapshot
contained the expected term text. Small and instrumented navigation probes did
not isolate a specific upstream defect. This correction replaces that private
verification path with the existing Playwright runner and publishes a portable
`verify-senate-refresh-browser.ts` command. It keeps all earlier API, citation,
stored-data conflict and UI assertions. It uses the same installed Chrome and a
30-second maximum for readiness. No dependency or application behavior changed.

The new checker includes missing-label, changed-label and navigation controls.
A no-op readiness check failed those controls before implementation. The corrected
check passes them and reports success only after its owned database, browser and
server are removed. CI now runs the same portable browser command. The earlier
failed private runs remain in the maintainer's evidence, not in the archive.

All 111 current test files remain byte-identical, including the 107 inherited
files. Approved research files, package versions, the lockfile and migrations are
unchanged. The correction approval covered preparation only; the later source
publication decision is recorded separately above. Deployment remains excluded.
Local results below do not establish hosted CI success or live Resend delivery.

The final verifier checks the complete law identifier in the visible history or
chat region and the exact term label in the profile or comparison evidence.
A separate ownership check confirms the randomly named database and its marker
before migrations. Caller dotenv files cannot replace the target. SIGINT and
SIGTERM use the same idempotent cleanup as normal completion, and success is
recorded only after cleanup. The direct Node entrypoint avoids an extra launcher
process in the signal path. SIGKILL remains outside process-level cleanup.

| Correction check   | Recorded result                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test integrity     | All 111 test files are byte-identical. All 28 assertions from the earlier private browser command remain in the portable command.                                         |
| Readiness controls | Missing, changed and similar-looking labels fail. Evidence in an unrelated region cannot satisfy the check. The original DOM text assertion and 30-second maximum remain. |
| Database isolation | The complete verifier passed with a conflicting dotenv file, override mode and a synthetic vault key. The connected database identity was checked before migration.       |
| Cleanup            | An already-signalled child is handled. SIGINT and SIGTERM exit unsuccessfully and remove the verifier's own container.                                                    |
| Full browser flow  | Three consecutive fresh-database runs passed, followed by another complete run after the review corrections. No failed run was retried into a pass.                       |
| Project checks     | All 2,170 tests, typecheck, zero-warning lint, build, formatting, both existing disposable-database verifiers and the new browser command passed.                         |
| Dependency audits  | Full and production audits both reported zero findings. Package and lock bytes are unchanged.                                                                             |

The new verifier and asset checks received an independent review. Its material
findings were reproduced and corrected with focused failure and success checks.
The original private Puppeteer failures remain historical evidence; these results
do not claim that its underlying implementation was patched.

## Public CI

Check the [public CI runs](https://github.com/marckengland/bakit-kita-iboboto-public/actions/workflows/ci.yml)
for the exact repository commit. A local result is not a result from GitHub's
runner. The workflow checks source integrity, both data versions, tests, lint,
typecheck, build, and disposable database and browser behavior. It contains no
site deployment step.
