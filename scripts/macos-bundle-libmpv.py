#!/usr/bin/env python3
"""Bundle Homebrew libmpv, the thumbnail mpv CLI and their macOS dependencies.

The prepare command runs before `tauri build`. It recursively collects the
dynamic libraries reachable from libmpv and the mpv CLI, rewrites their install
names to use the application Frameworks directory, stages the CLI as a sidecar,
and writes a small Tauri overlay config
whose minimumSystemVersion is raised to the highest minos in that closure. A
closure that raises it past HIGHEST_ALLOWED_MINIMUM_MAJOR fails the build
instead, because that is Homebrew moving its bottle to a newer macOS and
stranding every Mac below the new floor.

The finalize command runs through Tauri's beforeBundleCommand after the Harbor
binary has been linked. It rewrites the binary's Homebrew load commands, drops
any repeated LC_RPATH, and runs verify-app's Mach-O and minimum-OS checks over
the binary and the staged libraries against the floor prepare computed, so a
local build cannot ship what CI would reject. The Info.plist and signature
checks stay in verify-app, because neither exists yet at this point.

The verify-app command is a CI guard: a macOS artifact must not contain any
absolute non-system dependency, must ship every @rpath dependency, must not
repeat an LC_RPATH or a linked dylib, must not carry a Mach-O built for a newer
macOS than its Info.plist advertises, and must not advertise a floor above
HIGHEST_ALLOWED_MINIMUM_MAJOR.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import sys
from typing import Iterable

from macos_macho import (
    brew_prefixes,
    dylib_loads,
    expand_special,
    is_system,
    minimum_os,
    normalize_rpaths,
    resolve_load,
    rpaths,
    run,
    sidecars,
    verify_macho,
    verify_minimum_os,
    version_text,
    version_tuple,
)


HIGHEST_ALLOWED_MINIMUM_MAJOR = 15


def declared_minimum(root: Path) -> tuple[int, int, int]:
    config = json.loads((root / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
    value = config.get("bundle", {}).get("macOS", {}).get("minimumSystemVersion")
    return version_tuple(str(value)) if value else (0, 0, 0)


def bundle_minimum(root: Path, libraries: Iterable[Path]) -> tuple[tuple[int, int, int], str]:
    minimum = declared_minimum(root)
    raised_by = ""
    for library in sorted(libraries):
        value = minimum_os(library)
        if value is not None and value > minimum:
            minimum, raised_by = value, library.name
    return minimum, raised_by


def verify_supported_minimum(minimum: tuple[int, int, int], source: str) -> None:
    if minimum[0] <= HIGHEST_ALLOWED_MINIMUM_MAJOR:
        return
    raise RuntimeError(
        f"{source} puts the floor at macOS {version_text(minimum)}, above the macOS "
        f"{HIGHEST_ALLOWED_MINIMUM_MAJOR} ceiling this build accepts. Homebrew has moved its mpv "
        "bottle to a newer macOS, so every Mac below the new floor would get a dyld abort at "
        "launch. Build mpv against an older SDK, or raise HIGHEST_ALLOWED_MINIMUM_MAJOR as a "
        "deliberate decision to drop those Macs"
    )


def find_libmpv() -> Path:
    libdir = Path(run("pkg-config", "--variable=libdir", "mpv").strip())
    candidates = [
        candidate
        for candidate in sorted(libdir.glob("libmpv.*.dylib"))
        if re.fullmatch(r"libmpv\.\d+\.dylib", candidate.name)
    ]
    if not candidates:
        candidates = sorted(libdir.glob("libmpv.dylib"))
    if not candidates:
        raise RuntimeError(f"libmpv was not found under {libdir}")
    # Prefer the ABI-named symlink that the linker records over the fully
    # versioned Cellar filename to keep the executable load name stable.
    return candidates[-1]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_mpv() -> Path:
    prefix = Path(run("pkg-config", "--variable=prefix", "mpv").strip())
    binary = prefix / "bin" / "mpv"
    if not binary.is_file():
        raise RuntimeError(f"The thumbnail mpv executable was not found at {binary}")
    return binary.resolve()


def collect(
    start: Path, destination: Path, executables: Iterable[Path] = ()
) -> dict[Path, Path]:
    prefixes = brew_prefixes()
    queue = [(start.resolve(), start.name, start)]
    for executable in executables:
        for load in dylib_loads(executable):
            if not is_system(load):
                dependency = resolve_load(load, executable, executable, prefixes)
                queue.append((dependency, Path(load).name, executable))
    collected: dict[Path, Path] = {}
    names: dict[str, Path] = {}
    contexts: dict[Path, Path] = {}

    while queue:
        source, target_name, executable = queue.pop(0)
        source = source.resolve()
        if source in collected:
            continue
        existing = names.get(target_name)
        if existing and sha256(existing) != sha256(source):
            raise RuntimeError(
                f"Two different libraries share the name {target_name}: {existing} and {source}"
            )
        names[target_name] = source
        target = destination / target_name
        shutil.copy2(source, target)
        target.chmod(target.stat().st_mode | 0o200)
        collected[source] = target
        contexts[source] = executable

        for load in dylib_loads(source):
            if is_system(load):
                continue
            dependency = resolve_load(load, source, executable, prefixes)
            if dependency not in collected:
                queue.append((dependency, Path(load).name, executable))

    # Rewrite only after collection, so every replacement is guaranteed to exist.
    for source, target in collected.items():
        run("install_name_tool", "-id", f"@rpath/{target.name}", str(target), capture=False)
        for load in dylib_loads(source):
            if is_system(load):
                continue
            dependency = resolve_load(load, source, contexts[source], prefixes)
            replacement = collected.get(dependency)
            if replacement is None:
                raise RuntimeError(f"Dependency was not collected: {dependency}")
            if load != f"@rpath/{replacement.name}":
                run(
                    "install_name_tool",
                    "-change",
                    load,
                    f"@rpath/{replacement.name}",
                    str(target),
                    capture=False,
                )
        normalize_rpaths(target)

    return collected


def stage_mpv(source: Path, target: Path, libraries: dict[Path, Path], triple: str) -> None:
    architecture = {"aarch64-apple-darwin": "arm64", "x86_64-apple-darwin": "x86_64"}[triple]
    run("lipo", str(source), "-verify_arch", architecture)
    for library in libraries.values():
        run("lipo", str(library), "-verify_arch", architecture)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    target.chmod(target.stat().st_mode | 0o700)
    prefixes = brew_prefixes()
    for load in dylib_loads(source):
        if is_system(load):
            continue
        dependency = resolve_load(load, source, source, prefixes)
        replacement = libraries.get(dependency)
        if replacement is None:
            raise RuntimeError(f"mpv requires an unbundled dependency: {dependency}")
        run(
            "install_name_tool", "-change", load, f"@rpath/{replacement.name}",
            str(target), capture=False,
        )
    normalize_rpaths(target)
    for value in rpaths(target):
        run("install_name_tool", "-delete_rpath", value, str(target), capture=False)
    run("install_name_tool", "-add_rpath", "@executable_path/../Frameworks", str(target), capture=False)


def write_config(
    config_path: Path,
    frameworks: Iterable[Path],
    minimum: str,
    external_bins: Iterable[str],
    triple: str,
) -> None:
    identity = os.environ.get("APPLE_SIGNING_IDENTITY") or os.environ.get("APPLE_CERTIFICATE")
    config = {
        "build": {
            "beforeBundleCommand": f"python3 scripts/macos-bundle-libmpv.py finalize --target {triple}"
        },
        "bundle": {
            "externalBin": list(dict.fromkeys([*external_bins, "binaries/mpv"])),
            "macOS": {
                "frameworks": [str(path.resolve()) for path in sorted(frameworks)],
                "minimumSystemVersion": minimum,
                "signingIdentity": None if identity else "-",
            },
        },
    }
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def release_binary(root: Path, triple: str) -> Path:
    target_root = Path(os.environ.get("CARGO_TARGET_DIR", root / "src-tauri" / "target"))
    candidate = target_root / triple / "release" / "harbor"
    if candidate.is_file():
        return candidate.resolve()
    # Local native builds deliberately omit --target to reuse the warm cache.
    # Never fall back to a different target directory; finalize verifies lipo.
    native = target_root / "release" / "harbor"
    if native.is_file():
        return native.resolve()
    raise RuntimeError(f"Could not locate {candidate}; build with --target {triple}")


def rewrite_executable(binary: Path, frameworks_dir: Path) -> None:
    available = {path.name: path for path in frameworks_dir.glob("*.dylib")}
    for load in dylib_loads(binary):
        if is_system(load):
            continue
        name = Path(load).name
        if name not in available:
            raise RuntimeError(f"Harbor requires {load}, but {name} was not bundled")
        replacement = f"@rpath/{name}"
        if load != replacement:
            run(
                "install_name_tool",
                "-change",
                load,
                replacement,
                str(binary),
                capture=False,
            )


def advertised_minimum(app: Path) -> tuple[int, int, int]:
    plist = app / "Contents" / "Info.plist"
    value = plistlib.loads(plist.read_bytes()).get("LSMinimumSystemVersion")
    if not value:
        raise RuntimeError(f"{plist} declares no LSMinimumSystemVersion")
    return version_tuple(str(value))


def verify_closure(
    executable: Path,
    frameworks_dir: Path,
    advertised: tuple[int, int, int],
    shipped: Iterable[Path] = (),
) -> list[Path]:
    shipped = list(shipped)
    verify_macho(executable, frameworks_dir)
    libraries = sorted(frameworks_dir.glob("*.dylib"))
    for library in libraries:
        verify_macho(library, frameworks_dir, executable)
    for binary in shipped:
        verify_macho(binary, frameworks_dir)
    verify_minimum_os([executable, *libraries, *shipped], advertised)
    return libraries


def prepare(args: argparse.Namespace) -> None:
    root = Path(__file__).resolve().parents[1]
    destination = args.frameworks.resolve()
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    source = find_libmpv()
    mpv = find_mpv()
    collected = collect(source, destination, [mpv])
    staged_mpv = root / "src-tauri" / "binaries" / f"mpv-{args.target}"
    stage_mpv(mpv, staged_mpv, collected, args.target)
    minimum, raised_by = bundle_minimum(root, [*collected.values(), staged_mpv])
    verify_supported_minimum(minimum, raised_by or "the collected library closure")
    base = json.loads((root / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
    write_config(
        args.config.resolve(), collected.values(), version_text(minimum),
        base["bundle"].get("externalBin", []), args.target,
    )
    print(
        f"[macos-bundle] collected {len(collected)} dynamic libraries from {source.resolve()} "
        f"into {destination}; staged thumbnail helper {staged_mpv}"
    )
    if raised_by:
        print(f"[macos-bundle] {raised_by} raises minimumSystemVersion to {version_text(minimum)}")


def finalize(args: argparse.Namespace) -> None:
    if sys.platform != "darwin":
        return
    root = Path(__file__).resolve().parents[1]
    frameworks_dir = Path(os.environ["HARBOR_MACOS_FRAMEWORKS_DIR"]).resolve()
    binary = release_binary(root, args.target)
    architecture = {"aarch64-apple-darwin": "arm64", "x86_64-apple-darwin": "x86_64"}[args.target]
    run("lipo", str(binary), "-verify_arch", architecture)
    mpv = root / "src-tauri" / "binaries" / f"mpv-{args.target}"
    if not mpv.is_file():
        raise RuntimeError(f"The staged thumbnail mpv executable is missing: {mpv}")
    rewrite_executable(binary, frameworks_dir)
    normalize_rpaths(binary)
    advertised, _ = bundle_minimum(root, [*frameworks_dir.glob("*.dylib"), mpv])
    verify_supported_minimum(advertised, "the staged library closure")
    verify_closure(binary, frameworks_dir, advertised, [mpv])
    verify_macho(mpv, frameworks_dir)
    print(f"[macos-bundle] finalized {binary} for macOS {version_text(advertised)} or newer")


def verify_app(args: argparse.Namespace) -> None:
    app = args.app.resolve()
    executable = app / "Contents" / "MacOS" / "harbor"
    frameworks_dir = app / "Contents" / "Frameworks"
    if not executable.is_file():
        raise RuntimeError(f"Harbor executable is missing from {app}")
    if not frameworks_dir.is_dir():
        raise RuntimeError(f"Frameworks directory is missing from {app}")
    if not any(frameworks_dir.glob("libmpv*.dylib")):
        raise RuntimeError(f"libmpv is missing from {frameworks_dir}")
    mpv = executable.parent / "mpv"
    if not mpv.is_file():
        raise RuntimeError(f"The thumbnail mpv executable is missing from {mpv.parent}")
    shipped = sidecars(executable)
    advertised = advertised_minimum(app)
    verify_supported_minimum(advertised, f"the {app.name} Info.plist")
    libraries = verify_closure(executable, frameworks_dir, advertised, shipped)
    architecture = {"aarch64-apple-darwin": "arm64", "x86_64-apple-darwin": "x86_64"}[args.target]
    for binary in [executable, *libraries, *shipped]:
        run("lipo", str(binary), "-verify_arch", architecture)
    verify_macho(mpv, frameworks_dir)
    for binary in [executable, mpv]:
        searched = [
            expand_special(value, binary, binary).resolve() for value in rpaths(binary)
        ]
        if frameworks_dir.resolve() not in searched:
            raise RuntimeError(f"{binary} carries no LC_RPATH that reaches {frameworks_dir}")
    run("codesign", "--verify", "--deep", "--strict", str(app), capture=False)
    run(str(mpv), "--no-config", "--version")
    summary = (
        f"{len(libraries)} bundled libraries, {len(shipped)} sidecar executables, "
        f"macOS {version_text(advertised)} or newer"
    )
    print(f"[macos-bundle] verified {app} with {summary}")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    commands = result.add_subparsers(dest="command", required=True)
    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("--frameworks", type=Path, required=True)
    prepare_parser.add_argument("--config", type=Path, required=True)
    targets = ("aarch64-apple-darwin", "x86_64-apple-darwin")
    prepare_parser.add_argument("--target", choices=targets, required=True)
    prepare_parser.set_defaults(handler=prepare)
    finalize_parser = commands.add_parser("finalize")
    finalize_parser.add_argument("--target", choices=targets, required=True)
    finalize_parser.set_defaults(handler=finalize)
    verify_parser = commands.add_parser("verify-app")
    verify_parser.add_argument("--app", type=Path, required=True)
    verify_parser.add_argument("--target", choices=targets, required=True)
    verify_parser.set_defaults(handler=verify_app)
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        args.handler(args)
    except (RuntimeError, subprocess.CalledProcessError, KeyError) as error:
        print(f"[macos-bundle] error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
