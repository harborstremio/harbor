#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import plistlib
from pathlib import Path
import re
import subprocess
import sys


APPLE_IDENTITY_VARS = ("APPLE_SIGNING_IDENTITY", "APPLE_CERTIFICATE")
CODE_DIRECTORY_FLAGS = re.compile(r"^CodeDirectory\b.*\bflags=0x[0-9a-f]+\(([^)]*)\)", re.MULTILINE)
TEAM_IDENTIFIER = re.compile(r"^TeamIdentifier=(.*)$", re.MULTILINE)
QUARANTINE_REMEDY = "xattr -dr com.apple.quarantine /Applications/Harbor.app"


def run(*args: str) -> str:
    result = subprocess.run(
        args,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    return result.stdout


def apple_identity_source() -> str:
    for name in APPLE_IDENTITY_VARS:
        if os.environ.get(name):
            return name
    return ""


def signature_flags(display: str) -> list[str]:
    match = CODE_DIRECTORY_FLAGS.search(display)
    if match is None:
        raise RuntimeError("codesign printed no CodeDirectory flags")
    return [flag for flag in match.group(1).split(",") if flag and flag != "none"]


def team_identifier(display: str) -> str:
    match = TEAM_IDENTIFIER.search(display)
    value = match.group(1).strip() if match else ""
    return "" if value in ("", "not set") else value


def verify(app: Path) -> None:
    display = run("codesign", "--display", "--verbose=4", str(app))
    flags = signature_flags(display)
    if "runtime" in flags:
        entitlements = run("codesign", "--display", "--entitlements", ":-", str(app))
        start = entitlements.find("<?xml")
        end = entitlements.find("</plist>", start)
        try:
            values = plistlib.loads(entitlements[start:end + len("</plist>")].encode())
        except (ValueError, plistlib.InvalidFileException) as error:
            raise RuntimeError(f"{app.name} has no readable signed entitlements") from error
        if values.get("com.apple.security.cs.disable-library-validation") is not True:
            raise RuntimeError(
                f"{app.name} enables hardened runtime without disable-library-validation; "
                "its bundled ad-hoc libraries can be rejected at launch. Re-sign with Entitlements.plist"
            )
    requested = apple_identity_source()
    if "adhoc" in flags:
        if requested:
            raise RuntimeError(
                f"{requested} is set for this build but {app.name} is ad-hoc signed, so Tauri never "
                "reached the certificate"
            )
        print(
            f"[macos-signature] {app.name} is ad-hoc signed ({','.join(flags)}). Gatekeeper reports "
            f"an unidentified developer, so the release notes must carry: {QUARANTINE_REMEDY}"
        )
        return
    if "runtime" not in flags:
        raise RuntimeError(
            f"{app.name} is signed without the hardened runtime, which notarisation requires"
        )
    team = team_identifier(display)
    if not team:
        raise RuntimeError(f"{app.name} has no team identifier, so this is not a Developer ID signature")
    run("xcrun", "stapler", "validate", str(app))
    run("spctl", "--assess", "--type", "exec", "-vv", str(app))
    print(f"[macos-signature] {app.name} is Developer ID signed for {team}, notarised and stapled")


def main() -> int:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("--app", type=Path, required=True)
    args = argument_parser.parse_args()
    if sys.platform != "darwin":
        print("[macos-signature] skipped, not macOS")
        return 0
    try:
        verify(args.app.resolve())
    except (RuntimeError, subprocess.CalledProcessError) as error:
        detail = getattr(error, "output", "") or ""
        print(f"[macos-signature] error: {error}", file=sys.stderr)
        if detail:
            print(detail.rstrip(), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
