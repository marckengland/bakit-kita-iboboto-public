# Script catalog

Database setup and data import run as separate commands. Check the destination
before running an import, migration, or index replacement.
[Local setup](../README.md#run-locally)

## Working tools

| Command                                                      | Purpose                                                     | Data or file effect                                                                                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run clean`                                              | Remove generated build and cache files                      | Removes local generated files; no database rows                                                                                                        |
| `npm run dev:start:windows`                                  | Start the Windows development environment                   | Starts all Compose services, applies existing migrations, generates Prisma, and runs the dev server on its default port                                |
| `npm run es:setup`                                           | Rebuild search from local profile records                   | Replaces the configured Elasticsearch politician index                                                                                                 |
| `npm run scrape:politicians`                                 | Fetch names from BetterGov                                  | Adds names to the configured development database; no complete-profile guarantee                                                                       |
| `npm run data:import`                                        | Validate the reviewed Senate batch and show the import plan | Reads and checks the approved local files. Opens no database connection.                                                                               |
| `npm run data:import -- --apply`                             | Import the reviewed Senate batch                            | Writes one transaction to a fresh migrated database. Returns `unchanged` for an exact repeat and refuses other populated destinations.                 |
| `npm run data:verify`                                        | Test migrations and import behavior                         | Creates and removes its own PostgreSQL container. Tests import, repeat import, refusals, drift detection, and rollback.                                |
| `node scripts/verify-source-only.mjs --populated-release`    | Check release files and pinned tests                        | Checks the original test and dependency assertions alongside populated data and script paths.                                                          |
| `node --import tsx scripts/verify-senate-refresh-browser.ts` | Verify the refreshed records in a browser                   | Creates and removes its own PostgreSQL container and localhost server, checks citations and stored-data conflicts, and tests desktop and mobile views. |
| `npx --no-install tsx scripts/verify-senate-refresh.ts`      | Check the approved Senate refresh                           | Checks the sealed batch, qualified terms, dated bill events, citations and retained unknowns without opening a database.                               |
| `npx --no-install tsx scripts/verify-case-review.ts`         | Check database and public-reader behavior                   | Creates and removes its own disposable PostgreSQL container and app/browser processes                                                                  |
| `npx --no-install tsx scripts/generate-pwa-icons.ts`         | Render project icons                                        | Replaces icon files in this copy; exact historical raster output is not guaranteed                                                                     |

Run `verify-source-only.mjs` in a clean prepared publication copy. Follow the
[release-artifact procedure](../docs/TESTING.md#verify-a-prepared-release-artifact)
for its setup and checksum checks. Normal contributor commands are in the
[testing guide](../docs/TESTING.md#run-the-full-local-checks).

The Windows helper uses the default dev port, unlike the README's explicit port
3001 command. Use the README procedure to import the data after initializing
the database. Database write tools use the configured `DATABASE_URL`. All disposable database verification tools create their own PostgreSQL destinations.

## Database commands

The following verifiers accept no external database or Redis destination. They
create uniquely owned containers, run their checks, and remove those containers.

| Command                                              | Proof                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `node --import tsx scripts/verify-backup-restore.ts` | Real PostgreSQL dump/restore, all-row equality, citations, refusal controls and cleanup.         |
| `node --import tsx scripts/verify-request-budget.ts` | Two production processes sharing actual Redis budgets, concurrency, expiry, outages and cleanup. |

Production browser verification now supplies its own disposable Redis as well as
PostgreSQL. No existing services or live reporting configuration are used.
[Operations and recovery](../docs/OPERATIONS.md)

| Command               | Use                                                            |
| --------------------- | -------------------------------------------------------------- |
| `npm run db:generate` | Regenerate Prisma types after installation or a schema change  |
| `npm run db:deploy`   | Apply existing migrations to the configured database           |
| `npm run db:migrate`  | Create/apply a migration during development                    |
| `npm run db:push`     | Push schema state directly during deliberate development work  |
| `npm run db:studio`   | Inspect and edit the configured database through Prisma Studio |

The last four commands can affect an existing database or expose an editing
interface. Use the [Prisma guide](../docs/PRISMA.md) and an operator-approved
procedure. They are not substitutes for the disposable integration verifier.

## Compatibility paths

| Paths                                                                | Current role                                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `politicians:update`, `politicians:families`, `senate:import`        | Preserved command names; refuse execution because their reviewed private inputs are absent |
| Accuracy, source-backfill, and URL-repair paths under `maintenance/` | Refuse execution with a research-review message; no retained bulk writer or mapping        |
| Four synthetic case seed/repair modules                              | Test-only entry points whose database factory always throws outside the test harness       |

These paths remain because tests or existing command interfaces refer to them.
They are not working dataset importers or live repair tools. The
[regression boundary](regression/README.md) explains the four fixture commands and
how their assertions are preserved.

## Before adding a script

Use synthetic fixtures for tests and the shared database client factory for a
real development tool. Give the command a clear destination and write effect,
close its client on exit, and document it here. A new public script also needs a
reviewed update to the explicit inventory in `verify-source-only.mjs`.

[Data setup](../docs/DATA.md) · [Testing](../docs/TESTING.md) ·
[Asset provenance](../docs/ASSET_PROVENANCE.md)
