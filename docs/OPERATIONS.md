# Operate a reviewed-data installation

Use this runbook to prepare hosting, import the approved batch, and rehearse recovery.
Deployment and hosted resource creation need separate authorization. No provider,
paid plan, region, recovery target, or retention period is approved by this guide.
Keep Resend delivery disabled until the sender and delivery checks are ready.

## Prepare the hosting and database plan

1. Propose a Node.js host with a persistent PostgreSQL service. Use the repository's
   [Node.js and npm versions](../README.md#run-locally) and PostgreSQL 16, matching
   the disposable verifier. Build with `npm run build` and run with `npm run start`.
   A host must run the server routes described in the [architecture](ARCHITECTURE.md).
2. Record the proposed provider, region, budget ceiling, database owner, and incident
   contact privately. Check connection limits and the application's pool settings
   against the selected database. Read [Prisma connection settings](PRISMA.md#connection-settings).
3. Plan separate staging and production databases with separate credentials. Require
   encrypted connections, restricted network access, server-only secrets, and a
   backup destination separate from the database. Keep credentials out of source,
   shell history, build output, and incident evidence.
4. Keep `PUBLIC_CASE_RECORDS_ENABLED=false`, `DATA_PIPELINE_ENABLED=false`,
   `AI_RESEARCH_ENABLED=false`, `ADMIN_ENABLED=false`, and `PRIVATE_CONTACT_ENABLED=false`.
   Production record chat, ordinary feedback and sessions require protected Redis with `REDIS_DISABLED=false` and an
   explicit `REDIS_URL`. Read the [configuration reference](CONFIGURATION.md).
5. Decide whether full-text search is needed at launch. If you omit Elasticsearch,
   check the narrower directory name lookup and the search-unavailable response.
   The reviewed-record chat needs no AI provider key.
6. Submit the concrete hosting plan for authorization before creating resources or
   deploying. Record the approved backup schedule, retention, access owners,
   recovery point objective, and recovery time objective before hosted acceptance.

A managed database reduces database administration but makes recovery depend on
that provider's export, restore, and access controls. The local proof below does
not test those controls. Verify them on the selected service before launch.

## Verify and import the approved batch

1. Run the repository checks from the project root.

   ```sh
   npm run check
   npm run format:check
   npm run docs:check
   npm run build
   npm run data:verify
   node --import tsx scripts/verify-backup-restore.ts
   ```

   Use the [browser verification procedure](TESTING.md#verify-the-senate-refresh)
   to check the built application against its own disposable database.

2. Run `npm run data:import` to validate the approved files and inspect the dry run.
   This command does not connect to a database.
3. After database creation is authorized, verify its private connection settings and
   identity. Use a fresh, empty target for this release. Run `npm run db:deploy`,
   then `npm run data:import -- --apply` with that target configured privately.
4. Confirm 24 profiles, 45 filings, and 460 field citations. An exact repeat of
   `npm run data:import -- --apply` returns `unchanged`. Do not clear a refusal by
   deleting existing data. Investigate the target and its contents instead.
5. Keep scheduled terms, current offices, original-bill enactments, and missing
   values distinct. Follow the [data guide](DATA.md#load-the-reviewed-senate-batch)
   and the [refresh coverage](../public/data/senate-20-refresh-2026-11-22/INDEX.md).

## Prove a local dump and restore

Run this command with Docker available and locked dependencies already installed.
It accepts no arguments and never uses a caller's `DATABASE_URL`.

```sh
node --import tsx scripts/verify-backup-restore.ts
```

The verifier creates one uniquely named PostgreSQL 16 container, checks its labels,
and checks database ownership comments before migration and restore. The source
contains the approved batch plus a synthetic user record. PostgreSQL's `pg_dump`
creates a custom-format archive inside the disposable container. `pg_restore`
restores that archive into a second, empty database in the same container.

The proof compares every row in every user table, including migration records,
all citation fields, and the synthetic metadata. It also checks citation and
introducer links. Negative controls reject a wrong owner, a populated restore
target, and an altered restored citation. Success prints JSON with
`action: "backup-restore-verified"` only after cleanup. The source remains unchanged.

The archive is temporary and disappears with the container. This command is a
rehearsal, not a backup of an installation. Normal completion, SIGINT, SIGTERM,
and SIGHUP remove only the matching owned container. If the process receives
SIGKILL or the machine stops, inspect the `bkib-backup-*` container's
`bkib-verification-owner` label before removing that individual container.
Never use broad container or volume cleanup commands.

## Back up and accept a hosted restore

After a hosting plan is approved, use the selected database operator's backup
procedure. Keep full application backups private because they can contain user
records, conversations, reports, and private lists. Follow the
[authorized transfer guide](../DATA-MIGRATION-GUIDE.md).

1. Create an encrypted backup before an import, migration, or release that changes
   stored data. Record the application revision, PostgreSQL version, migration
   state, creation time, size, and integrity digest in private evidence.
2. Configure the approved scheduled backups and retention. Check backup failures
   and the age of the newest successful backup. A completed export is not proof
   that the backup can be restored.
3. Restore into a separate, empty staging database. Verify its identity before any
   write. Do not point a restore at the serving database.
4. Compare the approved records, citations, row counts, schema, and unrelated
   private records with the authorized source. Check the site's profile,
   comparison, reviewed chat, and export flows against the restored database.
5. Record the measured data-loss window and restore duration. Compare them with
   the approved recovery targets. Restrict or remove the staging copy under the
   approved retention policy.

Hosted backup scheduling, encryption, retention, access checks, and this acceptance
restore remain pending until an actual service is selected and authorized.

## Monitor the hosted application

Before opening traffic, assign an incident contact and choose protected monitoring.
The application has no dedicated public health endpoint. Do not use the unfinished
production admin monitoring route as a readiness check.

1. Check the public homepage and a reviewed profile API from outside the host.
   Check response status and expected record content. Use the public profile ID
   from the [approved dataset](../public/data/senate-20/data.json).
2. Check directory lookup, a two-person comparison, `SBN 142` in reviewed-record
   chat, and the profile HTML export. Confirm that citations remain visible and
   withheld case reads remain withheld.
3. Test database and Redis unavailability in staging. Confirm the actual response
   and recovery after the service returns. Record alerts for server errors,
   sustained latency, connection exhaustion, backup failure, and stale backups.
4. Review logs for accidental personal data or connection strings. Record a
   scrubbed incident timeline rather than request bodies or private reports.

Proposed initial alert targets are five minutes of persistent failed probes and
one missed scheduled backup. These are planning suggestions, not implemented or
approved monitoring. Set thresholds after staging measurements and an owner review.

## Recover from a failed release

1. Keep the incident evidence private. Identify whether the failure affects code,
   configuration, stored data, or more than one of them. Pause affected writers.
2. For a code-only failure, select the last verified artifact and its compatible
   configuration. Confirm that the current schema supports that artifact before
   switching traffic. Recheck the public flows above.
3. For damaged stored data, restore a verified backup into a separate database.
   Measure the data-loss window and validate records and citations before any
   authorized traffic switch. Keep the failed database for investigation under
   the approved retention policy.
4. Use a reviewed forward migration when schema repair is required. The repository
   does not supply automatic down migrations. Do not use `prisma migrate reset`,
   `prisma db push`, or volume deletion as a production rollback.
5. If separately approved case records need withdrawal, follow the
   [case review rollback procedure](CASE_REVIEW.md). Keep private reporting disabled
   until its [sender, Redis, and delivery checks](PRIVATE_CONTACT.md) pass.

Deployment acceptance, provider-specific rollback, hosted restore timings, live
alerts, and real Resend delivery are not verified by the local checks.
