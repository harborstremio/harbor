# Bundled typefaces

Both are subset to woff2 from the Google Fonts CDN and shipped locally so the installer
never reaches the network to render text.

## Plus Jakarta Sans

Copyright 2020 The Plus Jakarta Sans Project Authors, https://github.com/tokotype/PlusJakartaSans
SIL Open Font License 1.1, full text in `OFL-PlusJakartaSans.txt`.

Files: `jakarta-00.woff2` .. `jakarta-03.woff2` (latin, latin-ext, vietnamese, cyrillic-ext).

Note: this family has no base Cyrillic block (U+0400-045F) and no Arabic. Russian and Arabic
strings fall back to Segoe UI through `--font-sans`. That is deliberate, not a missing subset.

## JetBrains Mono

Copyright 2020 The JetBrains Mono Project Authors, https://github.com/JetBrains/JetBrainsMono
SIL Open Font License 1.1, full text in `OFL-JetBrainsMono.txt`.

Files: `jetbrains-00.woff2` .. `jetbrains-05.woff2`.

## Fraunces

Copyright 2020 The Fraunces Project Authors, https://github.com/undercasetype/Fraunces
SIL Open Font License 1.1, full text in `OFL-Fraunces.txt`.

Files: `fraunces-00.woff2` .. `fraunces-02.woff2`.

Used only for the Harbor wordmark on the boot screen, matching the app sidebar, which renders
live text rather than an SVG: "Harb", an "o" rotated 7deg, then "r".

## Regenerating

`@font-face` rules live in `ui/styles/fonts.css` and point at these files with their original
`unicode-range` values preserved. If you re-download, keep the ranges: dropping them makes the
browser pull every subset for any string.
