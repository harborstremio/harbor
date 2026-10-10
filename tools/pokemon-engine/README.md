# Pokémon engine build

This separately licensed, offline helper is bundled with the desktop app. It is
built from the immutable PKForge, PKHeX and AutoMod revisions in `upstream.json`.
The build refuses modified source trees or revisions that do not match that file.

## Prerequisites

- Node.js 24, Git (including submodule support), and .NET SDK **10.0.401**.
- Network access to the pinned GitHub repositories and NuGet during the build.
- A new source directory, or an existing clean checkout with matching submodules.

From the repository root, build the Windows x64 bundle with:

```sh
node tools/pokemon-engine/build.mjs --fetch-source /path/to/pokemon-source --output src-tauri/resources/pokemon-engine --artifacts /path/to/pokemon-build --rid win-x64
```

Use `--source` instead of `--fetch-source` for an existing checkout. Use `--dotnet`
to select a portable SDK executable. Other supported runtime identifiers are
`linux-x64`, `linux-arm64`, `osx-x64` and `osx-arm64`. Without `--rid`, the builder
uses the current operating system and architecture.

The output includes the self-contained executable, its .NET runtime dependencies,
and `engine.json` with the protocol, source revision and executable SHA-256.
Keep the entire output directory when packaging; the executable alone is not the
complete runtime. No separate .NET installation is required on the target device.

## Corresponding source and license

The helper is GPL-3.0-or-later; see `LICENSE`. The `sources/` directory contains ZIP
archives of all three pinned upstream repositories, plus this wrapper's source,
project file, build script, revision lock, license and README. Keep these files in
the distributed bundle. To rebuild from the ZIP files, extract `pkforge.zip` as
the source root, `pkhex.zip` into its `external/PKHeX` directory and `automod.zip`
into `external/PKHeX-Plugins`, then run:

```sh
dotnet publish sources/Harbor.PokemonEngine.csproj -p:PKForgeRoot=/path/to/extracted/pkforge -r win-x64 --self-contained true --source https://api.nuget.org/v3/index.json -o rebuilt-engine
```

For an offline protocol smoke check, send `{"op":"version"}` on stdin and close
stdin. The response must report protocol `1` and the pinned PKForge revision.
This check does not open user saves or contact a playback provider.
