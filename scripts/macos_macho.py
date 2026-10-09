#!/usr/bin/env python3
"""Mach-O reading and rewriting for the macOS bundling scripts.

otool prints one section per architecture slice, so the _sets readers return one
list per slice and a duplicate load command counts only within its own slice.
"""

from __future__ import annotations

from pathlib import Path
import re
import subprocess
from typing import Iterable


SYSTEM_PREFIXES = ("/System/Library/", "/usr/lib/")
LOAD_LINE = re.compile(r"^\s*(.+?)\s+\(compatibility version .+\)$")
ARCH_HEADER = re.compile(r"^.+ \(architecture .+\):$")
MIN_OS_FIELDS = {"LC_BUILD_VERSION": "minos", "LC_VERSION_MIN_MACOSX": "version"}
MACHO_MAGIC = (b"\xcf\xfa\xed\xfe", b"\xce\xfa\xed\xfe", b"\xca\xfe\xba\xbe", b"\xca\xfe\xba\xbf")


def run(*args: str, capture: bool = True) -> str:
    result = subprocess.run(
        args,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    return result.stdout if capture else ""


def otool_sections(flag: str, path: Path) -> list[list[str]]:
    sections: list[list[str]] = [[]]
    for line in run("otool", flag, str(path)).splitlines():
        if ARCH_HEADER.match(line) or line == f"{path}:":
            if sections[-1]:
                sections.append([])
            continue
        sections[-1].append(line)
    return sections


def load_sets(path: Path) -> list[list[str]]:
    return [
        [match.group(1) for line in section if (match := LOAD_LINE.match(line))]
        for section in otool_sections("-L", path)
    ]


def dylib_loads(path: Path) -> list[str]:
    seen: dict[str, None] = {}
    for loads in load_sets(path):
        for load in loads:
            seen[load] = None
    return list(seen)


def duplicates(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    repeated: dict[str, None] = {}
    for value in values:
        if value in seen:
            repeated[value] = None
        seen.add(value)
    return list(repeated)


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


def rpath_sets(path: Path) -> list[list[str]]:
    result: list[list[str]] = []
    for section in otool_sections("-l", path):
        values: list[str] = []
        in_rpath = False
        for line in section:
            stripped = line.strip()
            if stripped == "cmd LC_RPATH":
                in_rpath = True
            elif in_rpath and stripped.startswith("path "):
                values.append(stripped[5:].split(" (offset", 1)[0])
                in_rpath = False
        result.append(values)
    return result


def rpaths(path: Path) -> list[str]:
    seen: dict[str, None] = {}
    for values in rpath_sets(path):
        for value in values:
            seen[value] = None
    return list(seen)


def normalize_rpaths(path: Path) -> None:
    for _ in range(64):
        repeated = {value for values in rpath_sets(path) for value in duplicates(values)}
        if not repeated:
            return
        for value in sorted(repeated):
            run("install_name_tool", "-delete_rpath", value, str(path), capture=False)
    raise RuntimeError(f"Could not remove the duplicate LC_RPATH entries of {path}")


def version_tuple(value: str) -> tuple[int, int, int]:
    parts = [int(part) for part in re.findall(r"\d+", value)[:3]]
    parts += [0] * (3 - len(parts))
    return (parts[0], parts[1], parts[2])


def version_text(value: tuple[int, int, int]) -> str:
    if value[2]:
        return f"{value[0]}.{value[1]}.{value[2]}"
    return f"{value[0]}.{value[1]}"


def minimum_os(path: Path) -> tuple[int, int, int] | None:
    field = ""
    highest: tuple[int, int, int] | None = None
    for line in run("otool", "-l", str(path)).splitlines():
        stripped = line.strip()
        if stripped.startswith("cmd "):
            field = MIN_OS_FIELDS.get(stripped[4:], "")
        elif field and stripped.startswith(f"{field} "):
            value = version_tuple(stripped[len(field) + 1 :])
            if highest is None or value > highest:
                highest = value
            field = ""
    return highest


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


def reject_duplicates(path: Path, command: str, sections: list[list[str]]) -> None:
    for section in sections:
        repeated = duplicates(section)
        if repeated:
            raise RuntimeError(f"{path} carries a duplicate {command}: {', '.join(repeated)}")


def verify_macho(path: Path, frameworks_dir: Path, executable: Path | None = None) -> None:
    executable = executable or path
    sections = load_sets(path)
    for load in dict.fromkeys(load for section in sections for load in section):
        if is_system(load):
            continue
        if load.startswith("/"):
            raise RuntimeError(f"{path} still references a machine-local library: {load}")
        if load.startswith("@rpath/"):
            candidate = frameworks_dir / load[len("@rpath/"):]
        elif load.startswith(("@loader_path/", "@executable_path/")):
            candidate = expand_special(load, path, executable)
        else:
            raise RuntimeError(f"{path} carries an unsupported relative library: {load}")
        if not candidate.resolve().is_relative_to(frameworks_dir.resolve()):
            raise RuntimeError(f"{path} references a library outside bundled Frameworks: {load}")
        if not candidate.is_file():
            raise RuntimeError(f"{path} references an unbundled library: {load}")
    # dyld rejects these only when the Mach-O's own SDK is macOS 26+ (dyld Policy.cpp fall2025).
    reject_duplicates(path, "LC_LOAD_DYLIB", sections)
    reject_duplicates(path, "LC_RPATH", rpath_sets(path))


def is_macho(path: Path) -> bool:
    with path.open("rb") as handle:
        return handle.read(4) in MACHO_MAGIC


def sidecars(executable: Path) -> list[Path]:
    return sorted(
        item
        for item in executable.parent.iterdir()
        if item.is_file() and item.name != executable.name and is_macho(item)
    )


def verify_minimum_os(paths: Iterable[Path], advertised: tuple[int, int, int]) -> None:
    for path in paths:
        value = minimum_os(path)
        if value is not None and value > advertised:
            raise RuntimeError(
                f"{path.name} is built for macOS {version_text(value)} but the bundle advertises "
                f"macOS {version_text(advertised)}; macOS below {version_text(value)} refuses to "
                "load it"
            )
