# Change the application

Use the separate PostgreSQL database for this copy. Fresh databases start empty
after migration. Import the bundled Senate batch to exercise the directory and
filing screens. Use synthetic data in a separate test database when a test needs
cases, additional profiles, or unusual database states.
[Local setup](../README.md#run-locally) · [Data guide](DATA.md)

## Find the relevant code

| Change                               | Start here                                                                                                                                                 | Read alongside it                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Homepage, language choice, chat dock | [`src/app/components`](../src/app/components), [`src/i18n`](../src/i18n)                                                                                   | [Workspace behavior](CIVIC_WORKSPACE.md)                           |
| Directory, profile, or comparison    | [`src/app/politicians`](../src/app/politicians), [`src/app/compare`](../src/app/compare), [`politician.service.ts`](../src/services/politician.service.ts) | [Architecture](ARCHITECTURE.md)                                    |
| Public cases, counts, or citations   | [`public-research.service.ts`](../src/services/public-research.service.ts), [`case-review.ts`](../src/lib/case-review.ts)                                  | [Case review](CASE_REVIEW.md)                                      |
| Reviewed chat                        | [`reviewed-chat.service.ts`](../src/services/reviewed-chat.service.ts), [`ReviewedChatAnswer.tsx`](../src/app/components/ReviewedChatAnswer.tsx)           | [API reference](API.md#reviewed-chat-requests)                     |
| Database schema or connection        | [`prisma`](../prisma), [`prisma-client.ts`](../src/lib/prisma-client.ts)                                                                                   | [Prisma](PRISMA.md)                                                |
| Reviewed Senate batch                | [Import script](../scripts/import-reviewed-batch.ts), [dataset reader](../src/lib/release-data.ts), [import transaction](../src/lib/release-import.ts)     | [Data guide](DATA.md#load-the-reviewed-senate-batch)               |
| Import, research, or scheduling      | [`src/services/scrapers`](../src/services/scrapers), [`data-pipeline.service.ts`](../src/services/data-pipeline.service.ts), [`scripts`](../scripts)       | [Data guide](DATA.md) and [script catalog](../scripts/README.md)   |
| Private contact                      | [`private-contact.ts`](../src/lib/private-contact.ts), [`src/app/contact`](../src/app/contact)                                                             | [Private contact](PRIVATE_CONTACT.md)                              |
| Offline data                         | [`public/sw.js`](../public/sw.js), [`offline-storage.ts`](../src/lib/offline-storage.ts)                                                                   | [Offline limits](CASE_REVIEW.md#caches-offline-views-and-rollback) |

## Make and verify a change

1. Find the route or page, its service, and the tests that exercise the behavior.
   Follow the [focused-test table](TESTING.md#choose-a-focused-check).
2. Add or correct the behavior without weakening existing assertions. Use synthetic
   examples for new tests. Keep source wording and approved case fields separate
   from UI labels. The tests for the Senate batch also check the approved files
   and their exact import contract.
3. Check callers when changing a response shape, filter, count, or source selection.
   Case eligibility must still be checked before pagination and after base-profile
   cache hits.
4. Update the relevant guide and its links from the [documentation index](README.md).
   Avoid copying the same setup into several files.
5. Run the [required checks](TESTING.md#run-the-full-local-checks). State what changed,
   how it was verified, and any remaining limit in your contribution.

Dependency changes need a deliberate review. Keep the lockfile and package-manager
version consistent. Database changes in an existing installation need an operator's
migration and backup procedure.

For changes to the reviewed batch path, run these checks from the project root.

```sh
npm test -- src/lib/release-data.test.ts src/lib/release-import.test.ts src/services/release-coverage.test.ts src/test/populated-ui.test.ts
npm run data:verify
```

The first command exercises the batch reader, loader, service coverage, and views.
The database verifier deploys migrations and tests import behavior in a PostgreSQL
container it creates and removes. Before publication, run the separate
[release-artifact checks](TESTING.md#verify-a-prepared-release-artifact) on a clean
export. They preserve the pinned test and dependency boundaries without requiring
you to remove local configuration from your working checkout.
[Script catalog](../scripts/README.md)

## Common setup problems

| Symptom                                      | Check                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Empty directory                              | Check that you applied the batch after migrating the database. [Data setup](DATA.md#load-the-reviewed-senate-batch) |
| Batch import refuses the destination         | Check `DATABASE_URL`. Apply accepts a fresh migrated database or an exact repeat.                                   |
| Connection refused                           | Start Compose PostgreSQL and compare its loopback port with your private `DATABASE_URL`.                            |
| Missing Prisma types                         | Run `npm run db:generate` after `npm ci` or a schema change.                                                        |
| Name search works but full-text search fails | Start Elasticsearch and review the index setup. It replaces the configured index.                                   |
| Cases are withheld                           | The flag starts false. Enabling it still requires individually approved packets.                                    |
| Reviewed chat has no matches                 | Enter just the name and check that an active profile exists. No provider key is needed for this path.               |
| Old general-AI POST returns 503              | That separate endpoint needs its selected provider key. It is not the dock's endpoint.                              |
| Contact controls are disabled                | Complete [private contact configuration](PRIVATE_CONTACT.md) and verify Redis and actual delivery.                  |
| Production sign-in fails with Redis disabled | Production sessions require an explicit working Redis service.                                                      |

## Keep internal work private

Public docs describe current contracts and limits. Keep implementation plans,
private review notes, counsel communications, account settings, and credentials
outside the repository. Never include a real database dump in a bug report.
See [contributing](../CONTRIBUTING.md) and [security reporting](../SECURITY.md).
