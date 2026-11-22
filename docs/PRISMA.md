# Database client and migrations

The project pins `prisma`, `@prisma/client`, and `@prisma/adapter-pg` to 7.10.1. The upgrade replaces Prisma 6's database engine with the PostgreSQL driver adapter. It does not change the data models or add SQL migrations.

The [upstream upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) describes the library changes. These notes cover this repository's choices.

Use the locked dependencies and regenerate the client with `npm run db:generate`. A change to the Prisma version or generator needs its own dependency and compatibility review.

## Update an existing development copy

Use npm 11.21.2 as described in the [local setup](../README.md#run-locally).

1. Stop the app and any running data scripts.
2. Install the locked dependencies and regenerate the client.

   ```sh
   npm ci
   npm run db:generate
   ```

3. Review your private `DATABASE_URL` against the connection settings below. Do not paste credentials into an issue or command history.
4. Restart the app and check the profiles or scripts you use.

This client upgrade needs no database reset, import replay, or new migration. Apply any separately pending application migrations through the normal deployment procedure. A fresh setup still follows the [README](../README.md#run-locally).

Prisma 7 no longer generates the client automatically after `migrate dev` or `db push`. Run `npm run db:generate` after changing the schema.

## Connection settings

The CLI reads the URL from [`prisma.config.ts`](../prisma.config.ts). Runtime clients read `DATABASE_URL` through [`createPrismaClient`](../src/lib/prisma-client.ts). A missing or malformed URL fails before the driver can use ambient PostgreSQL defaults.

| Setting                                 | Default   | Configuration                                  |
| --------------------------------------- | --------- | ---------------------------------------------- |
| Schema                                  | `public`  | URL parameter `schema`                         |
| Maximum connections per client          | 10        | Positive integer `connection_limit`            |
| Connection and pool-acquisition timeout | 5 seconds | Positive integer `connect_timeout`, in seconds |
| Idle connection lifetime                | 5 minutes | Set in the shared factory                      |

These are explicit driver settings, not Prisma 6's automatic pool sizing. Review connection capacity before running many processes. The app shares one client per process; each command-line script owns its own client and pool.

Remove the old `pool_timeout` URL parameter before starting the upgraded app. The PostgreSQL driver uses a shared connection/acquisition timeout, so the factory rejects that parameter rather than silently ignore it. Use `connect_timeout` to set the shared deadline. Zero and invalid values are rejected.

The factory preserves standard PostgreSQL URL options, including TLS settings and `application_name`. It sets `search_path` to the selected schema so unqualified raw SQL and ORM calls use the same schema. Schema names with spaces or backslashes were verified. Names containing double quotes are rejected before connecting because Prisma 7.10.1 generates invalid ORM SQL for them.

TLS certificate validation stays with the PostgreSQL driver. Configure the correct certificates for a hosted database; the factory does not disable validation.

## Application and script clients

Application code uses the singleton exported by [`src/lib/prisma.ts`](../src/lib/prisma.ts). New standalone tools use the script wrapper:

```ts
import { createPrismaClient } from "./lib/prisma-client";

const prisma = createPrismaClient();
try {
  // Query the development database.
} finally {
  await prisma.$disconnect();
}
```

That import is relative to a file directly under `scripts/`. Nested scripts use the corresponding relative path. [`scripts/lib/prisma-client.ts`](../scripts/lib/prisma-client.ts) loads dotenv and calls the same factory as the application. Existing scripts retain their individual disconnect lifetimes.

The `prisma-client-js` generator remains in use so existing `@prisma/client` imports and test mocks keep working. Prisma 7 supports it but deprecates it. Moving to the newer generator is a separate change that will require updating import paths.

## Verification and rollback

Run `npm run db:generate` after a clean install, then run the normal checks and
build. The factory tests cover connection settings, schema quoting, timeouts and
failure handling. The [case-review verifier](../scripts/verify-case-review.ts)
exercises the current migrations and application boundaries in its own disposable
PostgreSQL container.

This copy retains only the tools listed in the [script catalog](../scripts/README.md).
Synthetic regression commands use a separate factory that refuses standalone
database access. Original research scripts and data are excluded.

Keep a reviewed application and matching lockfile before any later client upgrade.
A dependency rollback and an application schema rollback are separate operations.
The case feature's safe visibility rollback is the default-off mode described in
[the review guide](CASE_REVIEW.md#caches-offline-views-and-rollback). Do not drop
source or event tables to undo a display change.

Hosted TLS, production load, real imports, and PowerShell execution are not verified
by this preparation. Read [the verification record](OPEN_SOURCE.md) for checks run
on this candidate.

## Incomplete records in the populated copy

Migration `20261119090000_allow_unknown_filing_fields` makes bill filing dates, legislative status, session, and source confidence nullable. It adds `introduced_by` for the original filed-document introducer. These values must not be replaced with defaults just to complete an import.

Dated Senate membership stays in the reviewed batch context. The loader creates no Position rows because the batch does not establish term dates or present office. The new migration was tested only on owned disposable databases. Applying it to an existing installation needs a separate operator decision.
