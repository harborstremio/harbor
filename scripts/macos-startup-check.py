#!/usr/bin/env python3
"""Catch early launch/dyld failures in a packaged app on a macOS build runner.

Surviving the observation period is a startup check, not a UI/playback test.
Logs remain in --output. Only the process group started here is stopped.
"""
import argparse
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile


def probe(command, output: Path, seconds: float, env: dict) -> None:
    output.mkdir(parents=True, exist_ok=True)
    with (output / "stdout.log").open("wb") as stdout, (output / "stderr.log").open("wb") as stderr:
        process = subprocess.Popen(command, env=env, cwd=output, stdin=subprocess.DEVNULL,
                                   stdout=stdout, stderr=stderr, start_new_session=os.name != "nt")
        try:
            try:
                status = process.wait(timeout=seconds)
            except subprocess.TimeoutExpired:
                print(f"[macos-startup] process survived {seconds:g}s; UI and playback are not tested")
            else:
                raise RuntimeError(f"Harbor exited during startup (status {status}); see {output / 'stderr.log'}")
        finally:
            if os.name != "nt":
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            elif process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                if os.name != "nt":
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                process.wait(timeout=5)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seconds", type=float, default=20)
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("The packaged app startup check requires macOS")
    if not 1 <= args.seconds <= 120:
        parser.error("--seconds must be between 1 and 120")
    binary = args.app.resolve() / "Contents/MacOS/harbor"
    if not binary.is_file():
        parser.error(f"Missing executable: {binary}")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="profile-", dir=output) as home:
        temp = Path(home) / "tmp"
        temp.mkdir()
        env = {**os.environ, "HOME": home, "CFFIXED_USER_HOME": home, "TMPDIR": str(temp)}
        # Do not let the build machine's dyld search paths mask missing libraries.
        env = {key: value for key, value in env.items() if not key.startswith("DYLD_")}
        try:
            probe([str(binary)], output, args.seconds, env)
        except (RuntimeError, OSError) as error:
            print(f"[macos-startup] {error}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
