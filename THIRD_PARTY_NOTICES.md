# Third-party notices

The project MIT license applies to original project code and documentation.
Bundled fonts and inline Heroicons retain their separate notices below.

## Geist and Geist Mono

`src/app/fonts/GeistVF.woff` and `src/app/fonts/GeistMonoVF.woff` identify as version 1.200, corresponding to the upstream Geist 1.2.0 release.

Copyright (c) 2023 Vercel, in collaboration with basement.studio.

These fonts use the SIL Open Font License, Version 1.1. The complete, unmodified upstream copyright and license notice is in [public/notices/geist-OFL.txt](public/notices/geist-OFL.txt). Next.js also serves this file at `/notices/geist-OFL.txt`, so it accompanies the fonts in a hosted copy.

Upstream: [Geist 1.2.0 license](https://github.com/vercel/geist-font/blob/1.2.0/LICENSE.txt).

Preserve this notice and the complete font license when redistributing the fonts. This notice does not grant rights to imported records, photographs, or article text. See the [data licensing notes](PUBLICATION.md#data-and-reuse) for those materials. Package dependencies retain their own licenses and notices.

## Inline Heroicons

Some inline SVG paths match icons from Heroicons. The complete, unmodified
upstream MIT notices are included separately:

- Heroicons v1: Copyright (c) 2020 Refactoring UI Inc. See
  [the bundled notice](public/notices/heroicons-v1-MIT.txt) and
  [upstream v1.0.6](https://github.com/tailwindlabs/heroicons/blob/v1.0.6/LICENSE).
- Heroicons v2: Copyright (c) Tailwind Labs, Inc. See
  [the bundled notice](public/notices/heroicons-v2-MIT.txt) and
  [upstream v2.2.0](https://github.com/tailwindlabs/heroicons/blob/v2.2.0/LICENSE).

Preserve both notices when redistributing the copied icon material. Next.js
serves them at `/notices/heroicons-v1-MIT.txt` and
`/notices/heroicons-v2-MIT.txt`. No Heroicons package was added; the existing SVG
paths remain unchanged.

The [asset review](docs/ASSET_PROVENANCE.md#inline-heroicons) and
[match inventory](publication/heroicons.json) record 238 exact v1 path matches
across 63 components and two v2 path matches across two components. These are
path occurrences, not counts of unique or complete icons. The comparison tags
identify the checked upstream material, not necessarily the first release copied.

## Project artwork

The maintainer confirmed redistribution rights to the application icons and
project code. The [asset record](docs/ASSET_PROVENANCE.md) documents the retained
PNG hashes, favicon construction, and font provenance. This attestation does not
grant rights to third-party research or article expression.

## Synthetic regression material

The four case-repair definitions and their citations are invented, project-written
test inputs. They use the project MIT license. The [fixture guide](docs/FIXTURE_REUSE.md)
explains their scope and the retained regression checks.

This source candidate excludes the earlier historical case definitions and linked
article citations. The project license does not grant rights to third-party
research, article expression, or a future imported dataset. See the
[publication record](PUBLICATION.md#synthetic-regression-fixtures).
