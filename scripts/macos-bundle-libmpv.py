#!/usr/bin/env python3
"""Bundle Homebrew libmpv and its non-system dependencies for macOS.

The prepare command runs before `tauri build`. It recursively collects the
dynamic libraries reachable from libmpv, rewrites their install names to use
the application Frameworks directory, and writes a small Tauri overlay config.

The finalize command runs through Tauri's beforeBundleCommand after the Harbor
binary has been linked. It rewrites the binary's Homebrew load commands.

The verify-app command is a CI guard: a macOS artifact must not contain any
absolute Homebrew/MacPorts dependency and must ship every @rpath dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Iterable


SYSTEM_PREFIXES = ("/System/Library/", "/usr/lib/")
LOAD_LINE = re.compile(r"^\s*(.+?)\s+\(compatibility version .+\)$")


def run(*args: str, capture: bool = True) -> str:
    result = subprocess.run(
        args,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    return result.stdout if capture else ""


def dylib_loads(path: Path) -> list[str]:
    lines = run("otool", "-L", str(path)).splitlines()[1:]
    loads: list[str] = []
    for line in lines:
        match = LOAD_LINE.match(line)
        if match:
            loads.append(match.group(1))
    return loads


def is_system(load: str) -> bool:
    return load.startswith(SYSTEM_PREFIXES)


def brew_prefixes() -> list[Path]:
    prefixes: list[Path] = []
    try:
        prefixes.append(Path(run("brew", "--prefix").strip()))
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    for candidate in (Path("/opt/homebrew"), Path("/usr/local"), Path("/opt/local")):
        if candidate.exists() and candidate not in prefixes:
            prefixes.append(candidate)
    return prefixes


def rpaths(path: Path) -> list[str]:
    output = run("otool", "-l", str(path)).splitlines()
    values: list[str] = []
    in_rpath = False
    for line in output:
        stripped = line.strip()
        if stripped == "cmd LC_RPATH":
            in_rpath = True
        elif in_rpath and stripped.startswith("path "):
            values.append(stripped[5:].split(" (offset", 1)[0])
            in_rpath = False
    return values


def expand_special(value: str, loader: Path, executable: Path) -> Path:
    return Path(
        value.replace("@loader_path", str(loader.parent)).replace(
            "@executable_path", str(executable.parent)
        )
    )


def resolve_load(load: str, loader: Path, executable: Path, prefixes: Iterable[Path]) -> Path:
    if load.startswith("/"):
        candidate = Path(load)
        if candidate.exists():
            return candidate.resolve()
    elif load.startswith("@loader_path") or load.startswith("@executable_path"):
        candidate = expand_special(load, loader, executable)
        if candidate.exists():
            return candidate.resolve()
    elif load.startswith("@rpath/"):
        suffix = load[len("@rpath/") :]
        for value in rpaths(loader):
            candidate = expand_special(value, loader, executable) / suffix
            if candidate.exists():
                return candidate.resolve()
        for directory in (loader.parent, *(prefix / "lib" for prefix in prefixes)):
            candidate = directory / suffix
            if candidate.exists():
                return candidate.resolve()
    raise RuntimeError(f"Could not resolve non-system dependency {load!r} loaded by {loader}")


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


def collect(start: Path, destination: Path) -> dict[Path, Path]:
    prefixes = brew_prefixes()
    queue = [(start.resolve(), start.name)]
    collected: dict[Path, Path] = {}
    names: dict[str, Path] = {}

    while queue:
        source, target_name = queue.pop(0)
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

        for load in dylib_loads(source):
            if is_system(load):
                continue
            dependency = resolve_load(load, source, start, prefixes)
            if dependency not in collected:
                queue.append((dependency, Path(load).name))

    # Rewrite only after collection, so every replacement is guaranteed to exist.
    for source, target in collected.items():
        run("install_name_tool", "-id", f"@rpath/{target.name}", str(target), capture=False)
        for load in dylib_loads(source):
            if is_system(load):
                continue
            dependency = resolve_load(load, source, start, prefixes)
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

    return collected


def write_config(config_path: Path, frameworks: Iterable[Path]) -> None:
    config = {
        "build": {
            "beforeBundleCommand": "python3 scripts/macos-bundle-libmpv.py finalize"
        },
        "bundle": {
            "macOS": {"frameworks": [str(path.resolve()) for path in sorted(frameworks)]}
        },
    }
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def release_binary(root: Path) -> Path:
    target_root = Path(os.environ.get("CARGO_TARGET_DIR", root / "src-tauri" / "target"))
    arch = os.environ.get("TAURI_ENV_ARCH", "")
    triples = {
        "aarch64": "aarch64-apple-darwin",
        "x86_64": "x86_64-apple-darwin",
    }
    candidates: list[Path] = []
    if arch in triples:
        candidates.append(target_root / triples[arch] / "release" / "harbor")
    candidates.append(target_root / "release" / "harbor")
    candidates.extend(target_root.glob("*-apple-darwin/release/harbor"))
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    raise RuntimeError(f"Could not locate the compiled Harbor binary below {target_root}")


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


def verify_macho(path: Path, frameworks_dir: Path) -> None:
    available = {item.name for item in frameworks_dir.glob("*.dylib")}
    for load in dylib_loads(path):
        if is_system(load):
            continue
        if load.startswith(("/opt/homebrew/", "/usr/local/", "/opt/local/")):
            raise RuntimeError(f"{path} still references a machine-local library: {load}")
        if load.startswith("@rpath/") and Path(load).name not in available:
            raise RuntimeError(f"{path} references an unbundled library: {load}")


def prepare(args: argparse.Namespace) -> None:
    destination = args.frameworks.resolve()
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    collected = collect(find_libmpv(), destination)
    write_config(args.config.resolve(), collected.values())
    print(f"[macos-bundle] collected {len(collected)} dynamic libraries in {destination}")


def finalize(args: argparse.Namespace) -> None:
    if sys.platform != "darwin":
        return
    root = Path(__file__).resolve().parents[1]
    frameworks_dir = Path(os.environ["HARBOR_MACOS_FRAMEWORKS_DIR"]).resolve()
    binary = release_binary(root)
    rewrite_executable(binary, frameworks_dir)
    verify_macho(binary, frameworks_dir)
    for library in frameworks_dir.glob("*.dylib"):
        verify_macho(library, frameworks_dir)
    print(f"[macos-bundle] finalized {binary}")


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
    verify_macho(executable, frameworks_dir)
    libraries = list(frameworks_dir.glob("*.dylib"))
    for library in libraries:
        verify_macho(library, frameworks_dir)
    run("codesign", "--verify", "--deep", "--strict", str(app), capture=False)
    print(f"[macos-bundle] verified {app} with {len(libraries)} bundled libraries")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    commands = result.add_subparsers(dest="command", required=True)
    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("--frameworks", type=Path, required=True)
    prepare_parser.add_argument("--config", type=Path, required=True)
    prepare_parser.set_defaults(handler=prepare)
    finalize_parser = commands.add_parser("finalize")
    finalize_parser.set_defaults(handler=finalize)
    verify_parser = commands.add_parser("verify-app")
    verify_parser.add_argument("--app", type=Path, required=True)
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
