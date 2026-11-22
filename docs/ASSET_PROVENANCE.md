# Asset provenance

Reviewed November 16, 2026. The maintainer confirmed ownership or redistribution
permission for the project code, retained fixture wording, and icon artwork.
This records that attestation; Git history alone cannot establish ownership.

The [asset inventory](../publication/assets.json) records file hashes and the
checks below. This review did not alter the original repository or its history.

## Application icons

All eight retained `public/icons/icon-*.png` files match the bytes in their
introducing original commit. Their project SVG generator remains in
[scripts/generate-pwa-icons.ts](../scripts/generate-pwa-icons.ts). The SVG contains
project lettering and shapes, without an embedded external image or font file.

A fresh render with the current local font and rasterizer differs from the retained
PNGs. The generator is useful source material, but this review does not claim it
reproduces those binary files exactly. The maintainer's rights confirmation and
historical byte comparison are the recorded basis for retaining them.

The source copy's old starter-triangle favicon was replaced with an ICO container
of six existing project PNGs: 72, 96, 128, 144, 152, and 192 pixels. Each frame
payload is byte-identical to its corresponding PNG. No pixels were redrawn. ICO
header dimensions, payload lengths, offsets, and decoded frame sizes were checked.
The served favicon also matched the 192-pixel PNG when decoded in Chromium.

To reproduce the favicon without rendering artwork, write an ICO header with type
1 and count 6, followed by six 16-byte directory entries in the size order above.
Each entry uses one plane and 32 bits per pixel, the PNG byte length, and its
absolute payload offset. Append the six PNG files unchanged. The inventory pins
the resulting container hash.

## Inline Heroicons

A later source review identified inline SVG paths matching Heroicons. These are
separate from the project PNG artwork and favicon described above. The
[inventory](../publication/heroicons.json) records 238 exact path matches against
v1.0.6 across 63 component files and two matches against v2.2.0 across two files.
Each occurrence records its line and path-value digest; each component has a
file digest. Counts describe path occurrences, not unique or complete icons.

The version tags identify the comparison material, not proof of the first release
copied. This exact-match inventory does not assign an origin to unmatched or
modified paths. It does not replace the maintainer's separate rights confirmation
for project-owned work.

The complete, unmodified notices are retained as
[Heroicons v1 MIT](../public/notices/heroicons-v1-MIT.txt) and
[Heroicons v2 MIT](../public/notices/heroicons-v2-MIT.txt). They preserve the
respective Refactoring UI Inc. and Tailwind Labs, Inc. copyright statements.
The asset record pins the notice SHA-256 values and upstream Git blob IDs.
Keep both notices with copied icon material. They also ship under `/notices/`
when the app is hosted. No component source, SVG path, dependency, or test changed
to add these notices.

The populated-copy integration refreshed component hashes and line locations on
November 19, 2026. The
inventory now records 238 v1 path occurrences and two v2 occurrences. Both
upstream notices, font files, project PNGs, and favicon remain byte-identical.

## Fonts

Both retained WOFF files identify as Geist version 1.200 and match their introducing
original commit. The complete bundled notice is byte-identical to the
[upstream Geist 1.2.0 OFL notice](https://github.com/vercel/geist-font/blob/1.2.0/LICENSE.txt).
Keep [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) and
[the full OFL text](../public/notices/geist-OFL.txt) with the font files.

## Scope

The existing MIT license applies to project-owned expression. Dependencies,
fonts, and upstream Heroicons retain their respective terms and notices. The confirmation does not license linked articles,
photographs, other publishers' expression, or a future research dataset. It also
does not establish privacy or editorial grounds for future imported records.

For the code/data license boundary, read [publication scope](../PUBLICATION.md).
The [documentation index](README.md) links the other contributor guides.
