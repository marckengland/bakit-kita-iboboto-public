# Synthetic regression fixtures

The case-repair suite uses four invented proceedings, three synthetic actors,
and placeholder citations under `.test`. These fixtures describe no real person
or event. They are isolated test inputs, not profile data or a development seed.

## What the fixtures cover

| Definition         | Actor              | Behavior checked                                                                                                                   |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `syntheticTax`     | Synthetic Person A | Distinguish nonfiling from nonpayment, preserve unknown filing dates, recognize an old title, and repair only the selected record. |
| `syntheticLibel`   | Synthetic Person B | Keep the correct complainant, originating court, known filing date, and exact citation. Exclude an unrelated person.               |
| `syntheticPlunder` | Synthetic Person C | Keep an acquittal distinct from separate proceedings.                                                                              |
| `syntheticBribery` | Synthetic Person C | Keep a separate acquittal record with exact fictional reversal and reconsideration dates.                                          |

The descriptions, courts, case numbers, and dates are invented. Future dates
make the fixture timeline explicit; they do not describe expected real events.
`court_document` and `third_party_verified` are schema values exercised by the
tests. They do not certify the placeholder documents. No network request is needed.

The two integrity fixtures share three source definitions to check attribution
when different records cite the same documents. The tax and libel fixtures each
have two citations. Fixed retrieval dates, unscored confidence, and AI-processing
metadata are test values.

## Files and execution

| Purpose                       | File                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Definitions and repair helper | [`reviewed-controversies.ts`](../scripts/lib/reviewed-controversies.ts)                                                                                            |
| Seed compatibility            | [`add-controversies.ts`](../scripts/maintenance/add-controversies.ts), [`add-controversies-batch2.ts`](../scripts/maintenance/add-controversies-batch2.ts)         |
| Repair compatibility          | [`fix-bbm-controversy.ts`](../scripts/maintenance/fix-bbm-controversy.ts), [`fix-reviewed-controversies.ts`](../scripts/maintenance/fix-reviewed-controversies.ts) |
| Regression suite              | [`reviewed-controversies.test.ts`](../src/test/reviewed-controversies.test.ts)                                                                                     |
| Refusing database factory     | [`prisma-client.ts`](../scripts/regression/prisma-client.ts)                                                                                                       |

The legacy command filenames remain for compatibility. The database factory
always throws outside the test harness, including when a database URL is present.
Tests replace that boundary with a controlled double. Application code does not
import the fixture definitions. See the [execution diagram](../scripts/regression/README.md).

## Test integrity and reuse

The synthetic replacement preserves all 40 assertion calls and 14 executed tests
in the repair suite, including matchers, negations, record counts, parameterized
rows, ambiguity refusal, repeatability, and citation ownership. Expected identity
and date strings change together with their inputs. The other 97 test files stay
byte-identical to the preceding candidate.

The [integrity inventory](../publication/original-tests.json) retains original and
earlier revision hashes, plus the approved synthetic revisions. The
[source-only verifier](../scripts/verify-source-only.mjs) checks the revision
chain, exact test bytes, command inventory, and execution boundary.

These project-written synthetic fixtures use the project's [MIT license](../LICENSE).
They replace the historical case definitions and citations in this candidate.
Search aliases and reference tables elsewhere in the application still include
real public names; the entire project is not anonymous or wholly fictional.

The public suite reproduces correction behavior rather than exact historical
corrections. It does not establish facts, source reliability, privacy grounds, or
redistribution rights for future imported records. Those records need their own
[data review](DATA.md) and [case review](CASE_REVIEW.md). Remaining release work is
listed in [release status](RELEASE_REVIEW.md).
