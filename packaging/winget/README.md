# WinGet packaging

Harbor on the [Windows Package Manager](https://github.com/microsoft/winget-pkgs), so Windows users
can install and update with:

```powershell
winget install HarborStremio.Harbor
winget upgrade HarborStremio.Harbor
```

## What is here

| File                                     | Purpose                                 |
| ---------------------------------------- | --------------------------------------- |
| `HarborStremio.Harbor.yaml`              | Version manifest                        |
| `HarborStremio.Harbor.installer.yaml`    | Installer manifest (x64 NSIS, per-user) |
| `HarborStremio.Harbor.locale.en-US.yaml` | Store listing metadata                  |

These are the **bootstrap** manifests, used once to create the package. After that,
[`.github/workflows/winget.yml`](../../.github/workflows/winget.yml) submits every new stable release
automatically and these files are only a reference.

## Why `HarborStremio.Harbor` and not `site.harbor.Harbor`

WinGet package identifiers are `Publisher.Package`, not reverse-DNS. `site.harbor.Harbor` is
technically schema-valid, but it files the package under `manifests/s/site/harbor/Harbor/` with a
publisher segment reading as "site". `HarborStremio.Harbor` matches the GitHub organisation and lands
at `manifests/h/HarborStremio/Harbor/`. The Flatpak app ID stays `site.harbor.Harbor`; the two
ecosystems have different conventions and are not expected to match.

## Setup — one-time, maintainers only

The workflow cannot run until these exist. Steps 1 and 2 require organisation access.

1. **Fork `microsoft/winget-pkgs` into the `harborstremio` organisation.** The action pushes its
   branch there before opening the upstream PR. If the fork lives under a different account, change
   `fork-user:` in the workflow to match.
2. **Add the `WINGET_TOKEN` secret.** A _classic_ personal access token with the `public_repo` scope,
   stored as a repository secret on `harborstremio/harbor`. Fine-grained tokens do not work with the
   action's fork-and-PR flow.
3. **Submit the first version by hand.** `winget-releaser` deliberately fails if the package is not
   already in `winget-pkgs` — its first step checks the manifest directory and exits if it 404s. Use
   the files in this directory:

   ```powershell
   winget validate --manifest packaging\winget
   # then open a PR against microsoft/winget-pkgs adding them under
   # manifests/h/HarborStremio/Harbor/0.9.21/
   ```

   [`komac`](https://github.com/russellbanks/Komac) or `wingetcreate` will do the fork-and-PR for you.

Once the package exists upstream, publishing a stable GitHub Release is all that is needed — the
workflow does the rest.

## How the workflow behaves

- Triggers on `release: released`, which fires only for non-draft, **non-prerelease** publishes.
  Pre-releases are ignored with no extra conditions.
- Skips silently on forks (`if: github.repository == 'harborstremio/harbor'`), so this file being
  merged cannot turn anyone's fork CI red.
- Derives `PackageVersion` from the tag itself rather than trusting the action's default. Tag naming
  has drifted over time (`V0.9.21` with a capital V, `v.0.8.3-beta` with a stray dot), and the default
  only strips a lowercase `v`.
- Skips with a warning, rather than failing, if a release has no `_x64-setup.exe` asset.
- `workflow_dispatch` with a `tag` input re-runs a submission manually.

## Known limitations

- **Stable only.** The beta channel (0.9.11x) is distributed through
  `https://harbor.site/updates/latest.json` and is never published as a GitHub Release, so there is no
  artifact for a manifest to reference. Publishing beta to WinGet would require cutting beta GitHub
  Releases first.
- **x64 only.** No ARM64 Windows asset has ever been attached to a release.
- **Installers are unsigned.** No code-signing secret exists in any workflow. WinGet accepts unsigned
  installers, but SmartScreen warnings and occasional antivirus false positives during validation are
  expected.
- **Harbor's in-app updater is unaware of WinGet.** A user who installs through WinGet will still be
  offered in-app updates, the same as a direct `.exe` install. On Linux this is already handled by
  `isLinuxDesktop()` deferring to the package manager; an equivalent WinGet check does not exist and
  is out of scope here.

## Updating these files

They only need refreshing if the bootstrap PR has not been merged yet. To point them at a newer
release, update `PackageVersion`, `InstallerUrl`, `ReleaseDate`, `ReleaseNotesUrl` and the hash:

```powershell
winget hash Harbor_<version>_x64-setup.exe
```
