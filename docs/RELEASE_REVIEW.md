# Release status

Updated November 22, 2026. This is a separate populated release candidate. The maintainer approved integration of the reviewed Senate batch. Public publication, deployment, and changes to existing databases remain unauthorized.

## Before publication

| Item                       | State                                                                                                                          | Next action                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewed data              | 24 dated profiles and 45 selected filings are integrated, with unknowns, citations, and source differences retained.           | Review the exact candidate and its [coverage](../public/data/senate-20/INDEX.md). Future batches need their own approval.                    |
| Dependency advisory        | The approved scoped Effect fix is installed and verified. Both fresh audits report zero findings. Picomatch remains withdrawn. | Keep the [raw reports and dated history](DEPENDENCY_SECURITY.md) visible. Refresh audits for the exact candidate before publication.         |
| Publication                | No new commit, push, public repository, or deployment was authorized or performed for this candidate.                          | Identify the exact archive and destination, then obtain publication authorization.                                                           |
| Private security reporting | The app contact form is disabled; Resend delivery was not verified.                                                            | Enable and verify GitHub private vulnerability reporting when creating a public repository. This does not require exposing an inbox address. |
| Hosted CI                  | The earlier private staging attempt stopped before running any step.                                                           | Run the updated workflow after publication is authorized; do not count it as passed beforehand.                                              |

The final documentation corrections are verified: the security summary reflects
the current audits, contributor checks run in a configured checkout, and the
license-documentation link resolves. The
[testing guide](TESTING.md#verify-a-prepared-release-artifact) defines the separate
clean-artifact procedure. The remaining publication steps are destination and
archive approval, private vulnerability reporting, and inspection of public CI.

The [verification record](OPEN_SOURCE.md) distinguishes local checks from hosted results. Publishing source and the approved fact files is separate from operating a public website.

## What remains unknown

The batch is a selected, dated Senate cohort. It does not establish current office, complete legislative output, enacted outcomes, cases, family relationships, dynasty classifications, financial records, elections, attendance, or votes. Missing values do not mean zero or clearance. The case reader remains withheld by default.

Three candidate filings remain out, and SBN-142 has no canonical filing date. The [source review notes](../public/data/senate-20/REVIEW_NOTES.md) explain these decisions. The rest of the original research has not been published, deleted, or declared false.

## Preserved preparation

The original repository and earlier source-only copy remain intact. All 98 inherited test files retain their exact bytes and assertions. The four synthetic case fixtures remain test-only; the real Senate batch is separate. Internal project plans, legal working papers, credentials, and database storage are outside the candidate.

Code remains MIT licensed. The approved structured facts and original summaries use CC0 1.0; linked source documents retain their own rights. Geist and Heroicons notices remain included. See [publication scope](../PUBLICATION.md).

## Before hosting

Keep background jobs, AI research, public case reads, administration, and private contact at their defaults until separately configured and reviewed. Hosting also needs authentication, abuse controls, private correction reporting, backups, retention choices, and operational checks. This integration does not enable them.
