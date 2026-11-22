# Dependency review

The approved November 22, 2026 fix updates Effect from 3.20.0 to 3.22.1 through
one scoped override. Both unfiltered audits now exit 0 with zero findings.

| Check                         | Current result                                     | Evidence                                                                 |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm audit --json`            | Exit 0; zero findings                              | [Full report](../publication/dependency-audit.json)                      |
| `npm audit --omit=dev --json` | Exit 0; zero findings                              | [Production report](../publication/dependency-audit-production.json)     |
| Effect advisory               | Installed 3.22.1 is the upstream patched version   | [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw) |
| Dependency scope              | Only the Effect package entry changed              | [Approved revision](../publication/populated-release.json)               |
| Picomatch advisory            | Withdrawn November 18; installed matcher unchanged | [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) |

## Effect fix and compatibility

`@prisma/config` 7.10.1 pins Effect 3.20.0. The maintainer approved the exact npm
override `@prisma/config@7.10.1` → `effect: 3.22.1`. Prisma, its client and adapter,
all other package versions, and both existing overrides remain unchanged.

The [upstream patch](https://github.com/Effect-TS/effect/pull/6761) replaces costly
matching for TemplateLiteral decoding when all spans are plain strings. Capturing
parsers and other span types retain separate regex behavior. This update fixes
the reported advisory; it does not establish that all regex usage is safe.

The scoped override bypasses the parent's exact pin. Local verification covers a
clean npm 11.21.2 install, Prisma generation and schema validation, all 2,140 tests,
typecheck, lint, production build, and both disposable-database verifiers. A bounded
package probe checked supported and rejected inputs and the reported slow pattern.
No live application exploit was demonstrated. All 107 tests remain byte-identical.

The integrity verifier keeps the original baseline hashes, checks the exact new
override, and pins the approved replacement lock hash in code. Unrelated dependency
edits still fail, including a lock edit with its release-record hash updated.
Review this override when the Prisma/config parent changes. Prefer a suitable
upstream parent release when available. Do not broaden the override to Effect 4 or
use the forced Prisma 6 downgrade suggested by the earlier audit.

## Audit history

The [pre-fix full report](../publication/dependency-audit-2026-11-22-before-effect.json)
and [pre-fix production report](../publication/dependency-audit-production-2026-11-22-before-effect.json)
retain the three high-severity entries through Effect, @prisma/config, and Prisma.
They represented one advisory. No risk exception was used for that finding.

The [November 19 full audit](../publication/dependency-audit-2026-11-19.json) and
[production audit](../publication/dependency-audit-production-2026-11-19.json)
reported zero findings before the registry exposed the Effect advisory. The
current reports supersede them for the updated candidate.

## Earlier source-only decision

On November 18, the registry still reported 51 high-severity package entries in the full audit and two in the production audit, tracing to this advisory. The maintainer accepted a limited source-release exception expiring at 00:00 on December 2, 2026, Asia/Manila. That was not a fix or hosting approval.

The earlier reports remain unchanged in [the dated full audit](../publication/dependency-audit-2026-11-18.json) and [dated production audit](../publication/dependency-audit-production-2026-11-18.json). The original acceptance, its scope, and expiry remain in the machine-readable record as history. The populated copy does not need an exception for this withdrawn advisory, and no expiry has been extended.

Earlier bounded probes demonstrated slow matching for adversarial patterns. Withdrawal does not change the installed matcher code. This integration reads fixed approved filenames, and the review found no new public request path for defining filesystem patterns.

## Refresh the evidence

Run both audit commands against the unchanged lockfile before the next release decision. Record the command exit codes and keep the raw results. Do not filter severity, suppress an advisory, or install a proposed fix without a separately approved dependency change. Any new advisory needs its own assessment.
