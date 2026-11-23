# Privacy information for the Senate guest pilot

Updated November 23, 2026. This document describes the current implementation and
its limits. The app serves visitor information at `/privacy`, linked from
`/contact`. Markdown files in `docs` are repository documentation, not app routes.

## Current availability

Private report delivery is unavailable for this pilot. The sender domain is not
ready, and successful delivery to the intended inbox has not been verified.
Keep `PRIVATE_CONTACT_ENABLED=false`. No response time is promised.

The public operator identity, privacy contact arrangements, access rules, retention
periods, and hosting-provider settings still need approval before public operation.
This document does not establish those decisions or claim legal compliance.

## Guest visits and browser storage

The pilot permits guest browsing. The language controls set a `NEXT_LOCALE` cookie
with a one-year maximum age. Theme, accessibility preferences, and guest saved
profile IDs use browser storage. Saved IDs can reveal political interests to
someone with access to that browser. Clearing this site's cookies and site data
removes the local preferences and saved IDs.

Page requests, searches, and chat requests reach the hosting infrastructure.
Hosting and network services can process IP addresses, URLs, browser information,
and timestamps. Searches in URLs can appear in browser history and infrastructure
logs. No claim of anonymous browsing or absent logs is made.

The visible chat uses `POST /api/chatbot/records`. It sends the question and any
selected profile to the app. That route reads reviewed records without a language
model call, conversation-database write, or query-text entry in its rate-limit
history. Production request budgets use shared Redis counters with hashed
identifiers. Optional per-client limits require a validated user or an explicitly
trusted IP header. Budget counters contain neither question text nor raw IP
addresses and expire within an hour. Non-production can retain the older
in-memory counters. Infrastructure logging remains a separate concern.

The production guest guard blocks account APIs, community reports, notifications,
server bookmarks and voting lists, scheduled jobs, and general-AI endpoints.
Ordinary feedback remains in the guest pilot. Changing the hosted scope requires
a new privacy review. No hosted configuration or delivery verification is claimed.

## Ordinary feedback is stored in the database

The footer's **Feedback** form submits to `POST /api/feedback`. When accepted, the
route stores the category, subject, description, any source URL, and attachments
in the application database. It appends the source URL to the description and
stores attachment names, media types, and file contents. The route accepts up to
five PNG, JPEG, GIF, or PDF attachments, at most 256 KiB each, within a 2 MiB
request body limit.

The feedback record also contains the anonymous flag, status, timestamps, and
browser user-agent information limited to 512 characters. Unless the anonymous
option is selected, it can contain a supplied email address, a user ID from a
validated session, and a client IP from an explicitly trusted header when that
operator setting is enabled. The route does not trust a submitted user ID.

The anonymous option suppresses email, user ID, and IP in the feedback record.
It does not remove the description, attachments, user-agent information, or
timestamps. Request budgets can still process client identifiers, and hosting
infrastructure can retain request metadata. Selecting the option does not promise
anonymity.

Saving feedback does not send a private email, publish a correction, or prove
that a reviewer has seen it. The production administration dashboard is disabled.
No automatic moderation or response time is promised. Database access, backup
access, retention, and deletion procedures for feedback still need owner approval.
Do not send sensitive reports or credentials through ordinary feedback.

## Private contact when enabled

The separate `/contact` form submits a category, message, optional profile or source URL, optional
reply email, and retry identifier. A reply email is optional. The route validates
the fields and sends report details through Resend to the configured private
maintainer inbox. It does not fetch submitted URLs, accept attachments, save
reports in the application database, or publish reports.

Redis stores a shared hourly send count rather than message text, reply addresses,
or reporter IPs. The contact route's application error logs use generic errors and
provider status codes, without report bodies or addresses. This does not describe
every hosting or provider log.

Resend, the receiving email provider, people with inbox access, and infrastructure
providers can process or retain copies or metadata under their settings. No
retention period or deletion deadline is approved here. A browser-storage reset
does not delete server logs, provider records, or inbox copies.

The form's availability check verifies configuration, not Redis health, a verified
sending domain, or inbox delivery. HTTP 202 means the sending provider accepted
the request and returned a receipt. It does not prove delivery, review, or a reply.
Keep delivery disabled until an authorized operational check confirms inbox
arrival. Do not use real private reports as test data.

## Privacy requests and corrections

When a verified private channel is available, identify the page and information
at issue and the change you request. Include only what is needed for review.
Do not send passwords, API keys, identity documents, or unnecessary information
about other people. Keep your draft while private delivery is unavailable.
General feedback is separate and is not a substitute for private reports.

Reports do not update records automatically. No automatic removal or response
deadline is promised. The [correction guide](CORRECTIONS.md) explains how to prepare
an evidence-based correction. The [contact setup guide](PRIVATE_CONTACT.md)
describes configuration and delivery checks.
