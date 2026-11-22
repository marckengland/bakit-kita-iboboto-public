# Transfer an authorized development database

This source copy includes schema and migrations, not a database. Start empty
unless you have explicit authority to use and transfer another database.

Use a new database and separate credentials. Do not reuse an original installation's
configuration or point verification scripts at it. The source-only Compose default
is `bakit_kita_iboboto_source_only` on loopback port `55432`.

1. Identify which records you are authorized to transfer and which sources and
   reuse conditions apply to them.
2. Create and verify a private backup using your database operator's procedure.
3. Restore only into a separate development database. Check schema compatibility
   before applying pending migrations.
4. Check row counts, identities, dates, decimals, links, and source attribution.
5. Keep `PUBLIC_CASE_RECORDS_ENABLED=false` while records need review. A copied
   legacy status or source confidence does not make a record publishable.
6. Rebuild the local search index only after reviewing the transferred records.

Never publish a full application dump. Exclude account records, conversations,
messages, feedback, reports, API credentials, and private voting lists from any
separately approved dataset export. Review evidence and rights at record level.

The [case-review integration verifier](scripts/verify-case-review.ts) accepts no
external database URL. It tests migrations only in its own disposable PostgreSQL
container. The regression compatibility commands are not transfer or repair tools.
