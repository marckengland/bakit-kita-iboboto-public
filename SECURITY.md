# Security policy

## Private security reports

On the public project repository, open **Security → Advisories → Report a
vulnerability** to submit a private report when that feature is enabled. Describe
the affected version, reproduction steps, and impact. Do not put credentials,
private records, or exploitation details in a public issue.

The maintainer must enable and verify
[GitHub private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
as part of the public source release. If the reporting button is absent, the
private route is unavailable; do not substitute a public issue containing
sensitive details.

The application's `/contact` form is a separate Resend integration. It starts
disabled, and live delivery remains unverified. Keep it disabled until its sender,
private receiver, and delivery checks are complete. A working Resend installation
is not required to distribute the source code. Read the
[contact setup guide](docs/PRIVATE_CONTACT.md) before enabling a hosted form.

## Current limits

Production admin routes are disabled. Development admin controls are unfinished
and do not provide production authentication. Production rejects mock identity
verification until a real provider is integrated.

Production sessions require an explicit, working Redis service and do not fall
back to process memory. Scheduled endpoints require the shared cron authorization
check. Background data work and AI research default to false.

Public case reads separately default off. Approved records must still match their
review fingerprints. Offline views withhold case details until a fresh online
check. Read the [review workflow](docs/CASE_REVIEW.md).

The Compose services are development services on loopback addresses, with public
example credentials and Elasticsearch authentication disabled. Use a protected
configuration for hosting. This copy uses separate local service names, ports, and volumes.

The synthetic regression entry points cannot obtain a live database client.
Their placeholder citations require no network access; see the
[fixture guide](docs/FIXTURE_REUSE.md).

## Source release and hosting

Before source release, verify the exact candidate, secrets scan, dependency
advisories, and applicable licenses. Enable private vulnerability reporting when
the repository becomes public. Run the existing CI workflow on that public
candidate and report its actual result. A successful private CI run is not a
prerequisite, and no hosted CI success is claimed by this candidate.

Before hosting, separately verify deployment settings, authentication, abuse
controls, backups, and any configured contact route. Local passing checks do not
prove production security. Read [the publication record](PUBLICATION.md) and
[release status](docs/RELEASE_REVIEW.md) for the scope and remaining work.

The November 22, 2026 full and production npm audits report zero findings after
the approved scoped update to Effect 3.22.1. The
[dependency review](docs/DEPENDENCY_SECURITY.md) links the current raw reports and
the earlier failures.

GitHub [withdrew the picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
on November 18. The earlier source-release exception and its original December 2
expiry remain historical evidence, not a current advisory finding. Withdrawal did
not change the installed matcher code. Keep glob patterns in trusted code and
configuration, and reassess new advisories before release.

Keep full database backups private. Application accounts, conversations, feedback,
reports, API credentials, and personal voting lists do not belong in a public
dataset. This copy includes no original database or Git history.

See the [configuration reference](docs/CONFIGURATION.md) for safe defaults and
[testing guide](docs/TESTING.md) for the boundaries covered by local checks.
