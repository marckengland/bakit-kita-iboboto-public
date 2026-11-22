# Contributing

Start with the [README](README.md#run-locally), then use the
[documentation index](docs/README.md) to find the relevant subsystem. Read the
[release notes](docs/RELEASE_REVIEW.md) for current limits and the distinction
between source publication and hosting.

## Work on a change

Use a separate development database and synthetic examples. Follow the
[development guide](docs/DEVELOPMENT.md) to find the page, service, callers, and
tests. Keep a change focused and explain the behavior it fixes or adds.

| Change                        | Include                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| Application behavior          | Relevant tests, affected caller checks, and documentation              |
| API or data shape             | Updated consumers, missing-data behavior, and examples                 |
| Case/public-research behavior | Approval, fingerprint, citation, count, pagination, and offline checks |
| Script                        | Its destination, write effect, cleanup behavior, and catalog entry     |
| Dependency                    | A separately reviewed reason, lockfile change, and verification        |
| Documentation                 | Current source references, working local links, and accurate diagrams  |

Do not skip, weaken, or delete a test to make a change pass. The pinned inventory
records reviewed test bytes; changing it is a deliberate review, not a way around
a failing assertion. Use the [testing guide](docs/TESTING.md) for focused and full
commands. Report failures and checks that were not run.

## Propose data changes

Supply the exact source, identity match, event date or known date precision,
supporting passage, transformations, and reuse basis. A reachable URL, numeric
confidence, or successful import is not a completed review.

The compatibility fixtures are invented test inputs and cannot seed a live database.
Read the [fixture guide](docs/FIXTURE_REUSE.md) before changing them. New real-world
records need their own evidence and reuse review; follow [data setup](docs/DATA.md)
and [case review](docs/CASE_REVIEW.md).

## Keep private material out

Never include credentials, private environment files, database dumps, account
records, messages, reports, or voting lists. Keep internal implementation plans,
counsel communications, operational handoffs, and approval history outside the
public tree. Use the [security policy](SECURITY.md) for sensitive reports.
