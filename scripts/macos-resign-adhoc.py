#!/usr/bin/env python3
"""Re-sign the local ad-hoc Mac bundle after replacing its library closure."""
import argparse
import importlib.util
import os
from pathlib import Path
import plistlib
import subprocess
import sys

from macos_macho import run, sidecars


def resign(app: Path, entitlements: Path) -> None:
    if os.environ.get("APPLE_SIGNING_IDENTITY") or os.environ.get("APPLE_CERTIFICATE"):
        raise RuntimeError("Use the Developer ID build pipeline when Apple signing credentials are configured")
    values = plistlib.loads(entitlements.read_bytes())
    if values.get("com.apple.security.cs.disable-library-validation") is not True:
        raise RuntimeError("Entitlements must enable disable-library-validation for bundled ad-hoc libraries")
    executable = app / "Contents/MacOS/harbor"
    frameworks = app / "Contents/Frameworks"
    libraries = sorted(frameworks.glob("*.dylib"))
    if not executable.is_file() or not any(path.name.startswith("libmpv.") for path in libraries):
        raise RuntimeError("A complete Harbor executable and bundled libmpv are required before signing")
    # No --deep signing: it can re-sign nested code with unintended entitlements.
    # Every command must succeed; never turn a codesign failure into a warning.
    for binary in [*libraries, *sidecars(executable)]:
        run("codesign", "--force", "--sign", "-", "--timestamp=none", str(binary))
    for binary in [executable, app]:
        run("codesign", "--force", "--sign", "-", "--options", "runtime",
            "--entitlements", str(entitlements), "--timestamp=none", str(binary))
    run("codesign", "--verify", "--deep", "--strict", str(app))
    spec = importlib.util.spec_from_file_location(
        "macos_signature", Path(__file__).with_name("macos-verify-signature.py")
    )
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    verifier.verify(app)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--entitlements", type=Path, required=True)
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("Re-signing requires macOS")
    try:
        resign(args.app.resolve(), args.entitlements.resolve())
    except (RuntimeError, OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"[macos-resign] {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
