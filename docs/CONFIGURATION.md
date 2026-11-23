# Configuration

Copy [`.env.example`](../.env.example) to a private `.env` file for local work.
The [README](../README.md#run-locally) covers installation. This reference explains
the supplied settings; it does not contain production credentials.

## Local services

| Service            | Compose service | Host port | Default use                                           |
| ------------------ | --------------- | --------- | ----------------------------------------------------- |
| PostgreSQL 16      | `postgres`      | `55434`   | Required database, `bakit_kita_iboboto_refreshed`     |
| Redis 7            | `redis`         | `56381`   | Disabled in local application settings until selected |
| Elasticsearch 8.17 | `elasticsearch` | `59202`   | Optional full-text search                             |

The Compose project is `bakit-kita-iboboto-refreshed-release`. It uses separate
container names, volumes, and loopback ports. Its named volumes retain data after
`docker compose down`. Adding `-v` deletes those volumes and their contents.
Use the supplied database credentials and unauthenticated Elasticsearch for local
development only.

## Core settings

| Variable            | Example or default                       | Effect                                                                                            |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Local PostgreSQL URL in the example file | Required by runtime clients and database commands                                                 |
| `ELASTICSEARCH_URL` | `http://localhost:59202`                 | Search index connection; the directory can fall back to name lookup                               |
| `REDIS_URL`         | `redis://localhost:56381`                | Cache and session connection; production sessions require an explicit working URL                 |
| `REDIS_DISABLED`    | `true`                                   | Disables Redis for local development and ordinary CI checks; production sessions reject this mode |

For the reviewed batch, use the fresh local database in the example file.
`npm run data:import` validates the files without opening a connection.
`npm run data:import -- --apply` uses `DATABASE_URL`. The disposable verifier
creates its own database and sets its own connection URL.
[Data guide](DATA.md#load-the-reviewed-senate-batch)

Keep connection strings and credentials out of issues and logs.
[Prisma connection settings](PRISMA.md#connection-settings)

## Optional features

| Variable                      | Default | What enabling it does                                                                              |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `PUBLIC_CASE_RECORDS_ENABLED` | `false` | Permits public reads of individually approved, unchanged case and context packets                  |
| `DATA_PIPELINE_ENABLED`       | `false` | Starts the in-process scheduler in the Node.js server runtime                                      |
| `AI_RESEARCH_ENABLED`         | `false` | Allows AI research calls that stage proposals for human review; a provider key is also needed      |
| `ADMIN_ENABLED`               | `false` | Allows unfinished admin routes only in development/test; production always denies them             |
| `CRON_SECRET`                 | Empty   | Authorizes scheduled routes; unset configuration returns 503 and invalid authorization returns 401 |

Keep these features disabled for the local Senate batch setup. The importer
reads the approved files directly. The scheduler and AI research use separate
inputs and can write to the configured database. The case flag permits reads
only for eligible records after individual review.
[Case review workflow](CASE_REVIEW.md)

## AI provider keys

The reviewed-record chat dock needs **no provider key**. It reads the local public
research projection. The separate general-AI endpoint and optional research
services use provider keys.

| Provider      | Server-only variable |
| ------------- | -------------------- |
| Google Gemini | `GOOGLE_AI_API_KEY`  |
| Anthropic     | `ANTHROPIC_API_KEY`  |
| OpenAI        | `OPENAI_API_KEY`     |
| DeepSeek      | `DEEPSEEK_API_KEY`   |
| OpenRouter    | `OPENROUTER_API_KEY` |

The example file leaves these empty. Provider configuration is held in process
memory and resets on restart. A configured general-AI provider can send submitted
questions to that provider; this is separate from the dock's record-reader path.
See [chat scope](CIVIC_WORKSPACE.md#reviewed-records-in-chat) before enabling it.

## Private contact

The local setup leaves the form disabled. The form uses the following server-only settings.

| Variable                  | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `PRIVATE_CONTACT_ENABLED` | Enable only after configuration and delivery checks           |
| `PRIVATE_CONTACT_ORIGIN`  | Exact permitted origin; HTTPS except for loopback development |
| `PRIVATE_CONTACT_FROM`    | Sender on a verified Resend domain                            |
| `PRIVATE_CONTACT_TO`      | Private receiving inbox                                       |
| `RESEND_API_KEY`          | Private sending key                                           |

A working Redis service is also required for its shared send budget. Follow the
[contact setup guide](PRIVATE_CONTACT.md) for limits and a real delivery check.
None of these values belongs in a `NEXT_PUBLIC_` variable.

## Before hosting

### Shared public request budgets

In production, `POST /api/chatbot/records`, its rate-status endpoint and
`POST /api/feedback` require explicit protected Redis configuration. Missing,
disabled, unavailable or malformed Redis state returns HTTP 503. There is no
production fallback to process-local counters. A status read does not consume a
reservation. A timed-out command can still execute later and consume a reservation.
Shared session reads, writes and revocations each have a separate three-second
deadline. A request with an optional session can therefore wait for session
validation and then the request budget; these are separate bounded operations.

| Route             | Global minute cap | Global hour cap | Optional per-client hour cap        |
| ----------------- | ----------------- | --------------- | ----------------------------------- |
| Reviewed chat     | 120               | 1,200           | 20 anonymous; 100 validated account |
| Ordinary feedback | 5                 | 20              | 5                                   |

These fixed windows use Redis time and reset at UTC minute/hour boundaries. A
boundary can permit two consecutive window budgets close together. A global
budget can be exhausted by one sender; configure and verify ingress abuse controls
on the eventual host. Limits bound accepted application work, not incoming bytes
before the server runs. The budget keys expire within an hour and contain no
question text. Client keys use hashed identifiers, which are not a promise of anonymity.

`PUBLIC_CLIENT_IP_HEADER` is empty by default. It can name
`x-vercel-forwarded-for`, `cf-connecting-ip` or `x-real-ip` only after you verify
that the ingress overwrites that header and direct origin access cannot bypass it.
Only one valid IP is accepted; comma-separated and malformed values are ignored.
Untrusted forwarded headers never create a production client bucket. Without a
trusted IP or a validated account, only global budgets apply. Ordinary feedback
likewise stores no client IP by default.

The production guest boundary closes account mutations, bookmarks, voting lists,
notifications, community reports, cron and general-AI routes. The read-only
`GET /api/auth/profile` session probe keeps its existing authentication checks.
No environment flag enables the closed routes in production; completing a future
account feature requires an explicit implementation and review.

Feedback accepts JSON up to 2 MiB and five PNG, JPEG, GIF or PDF attachments of
256 KiB each. The server checks declared type, base64 encoding and size; it does
not perform malware scanning or establish that an attachment's claims are true.
Chat JSON is limited to 16 KiB and its message remains limited to 2,000 characters.
Both readers impose a five-second body deadline. Invalid fields return 400,
oversized bodies 413, unsupported media types 415 and body deadlines 408.

Production admin and private mail remain disabled for this pilot. Read the
[operations runbook](OPERATIONS.md) for the hosted acceptance work.

Local defaults are not a hosting configuration. Resolve the current
[release blockers](RELEASE_REVIEW.md), use protected services and server secrets,
and verify sessions, reporting, backups, and deployment-specific controls. The
[security policy](../SECURITY.md) lists the unfinished production features.
