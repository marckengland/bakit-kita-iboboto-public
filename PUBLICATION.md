# Publication scope

This public source version contains the application, the reviewed Senate starter batch, and the separate November 22 evidence refresh. The [source-publication record](publication/refreshed-publication.json) records the maintainer's authorization and the verified input archive. The update preserves the existing public history. All earlier local copies remain unchanged; no website deployment is authorized.

## What is included

| Included                                                              | Excluded                                                                               |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Application source, schema, and migrations                            | Original Git history, database, and bulk research collection                           |
| 24 dated Senate profiles and 45 selected filings                      | Unsupported cases, family links, dynasty labels, financial records, and vote totals    |
| Exact citations, field locators, source conflicts, and coverage notes | Private research, counsel packets, implementation plans, and operational handoffs      |
| Existing tests and isolated synthetic regression fixtures             | Private credentials, environment files, database dumps, and account data               |
| Licensed fonts, icons, and required notices                           | Installed dependencies, build outputs, and local verification artifacts in the archive |

The [main README](README.md) gives the setup steps. The database starts empty until the explicit reviewed-data import runs. Its default mode connects to no database. Apply mode accepts a fresh application database or an unchanged repeat of this batch; it never updates or deletes existing rows. Other schemas with tables and row-security configurations cause refusal.

The populated Compose project uses separate names, ports, and volumes. It does not reuse either earlier installation. Verification uses owned disposable databases only.

## Data and reuse

The [integrated dataset guide](public/data/senate-20/INDEX.md) links the records, sources, coverage, and integration approval. The eight files reviewed on November 18 are preserved unchanged, including their earlier proposal labels. `APPROVAL.json` records the later November 19 integration decision.

The profiles describe membership observed on July 28, 2025. Selected filings are proposals, not complete career totals, exclusive authorship claims, or a statement that a bill became law. Unknown office, term, session, status, and date fields remain unknown. Three filings remain excluded from the batch.

Structured facts and original summaries in the approved batch use CC0 1.0. Full source documents and portraits are not redistributed. Project code uses [MIT](LICENSE). Font and Heroicons notices remain in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `public/notices/`.

## Synthetic regression fixtures

The four invented case definitions remain isolated test inputs. Their people, proceedings, dates, and `.test` citations describe no real case. The fixture commands refuse live database access. Application code does not use them as profile data. See [fixture coverage](docs/FIXTURE_REUSE.md).

## Integrity records

| Record                                                     | Purpose                                                                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `publication/original-tests.json`                          | Original test hashes and the earlier reviewed fixture/formatting changes                                                                  |
| `publication/populated-release.json`                       | All 98 inherited test bytes, new tests, additive commands, and the bounded approved dependency revision                                   |
| `scripts/verify-source-only.mjs --populated-release`       | Preserves the original integrity checks and adds this candidate's authorized scope                                                        |
| `npm run data:verify`                                      | Approved bytes, fresh migrations, import, exact repeat, drift refusal, cross-schema refusal, and transaction rollback on owned PostgreSQL |
| `publication/source-files.sha256`                          | Exact archived source bytes, excluding the checksum file itself                                                                           |
| `publication/assets.json` and `publication/heroicons.json` | Asset and inline-icon provenance                                                                                                          |
| `publication/security-exceptions.json` and raw audit files | Current audits, dated risk history, and technical reassessment; no hosting or publication approval                                        |

After extracting the archive, run `shasum -a 256 -c publication/source-files.sha256` on macOS. Checksums detect changed bytes; they do not establish source truth or authorize publication. The [verification record](docs/OPEN_SOURCE.md) lists the checks that actually ran.

## Separate November 22 evidence version

This refreshed copy retains the original reviewed batch unchanged and adds the
[approved versioned refresh](public/data/senate-20-refresh-2026-11-22/INDEX.md).
Its [approval record](public/data/senate-20-refresh-2026-11-22/APPROVAL.json) covers
24 qualified elected terms, separate dated observations and 41 history entries
across 31 original bills. It does not establish current office or original-bill
current status or enactment. Fourteen bills have no approved additions.

[publication/senate-refresh.json](publication/senate-refresh.json) pins all 107
inherited test files, additive tests and the new data files. The earlier manifests
and their historical counts remain intact. These frozen integration records do
not record later publication decisions. The separate source-publication record
above covers this repository update, with deployment still excluded. Private
proposal packets, plans and source-document copies remain outside the release tree.

The portable `scripts/verify-senate-refresh-browser.ts` command retains the earlier
profile, citation, comparison, chat, export and stored-data conflict checks.
Readiness uses the installed Playwright runner with explicit deadlines and negative
controls. The Heroicons inventory records the refreshed ProfileHeader bytes while
preserving the unchanged SVG path and license notices. See the
[browser verification procedure](docs/TESTING.md#check-refreshed-records-in-a-browser).
