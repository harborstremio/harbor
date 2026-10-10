import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "startup", Path(__file__).resolve().parents[1] / "scripts/macos-startup-check.py"
)
startup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(startup)


class StartupTests(unittest.TestCase):
    def test_early_exit_fails_and_keeps_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with self.assertRaisesRegex(RuntimeError, "status 42"):
                startup.probe([sys.executable, "-c", "import sys; print('dyld fixture', file=sys.stderr); sys.exit(42)"],
                              output, 10, dict(os.environ))
            self.assertIn("dyld fixture", (output / "stderr.log").read_text())

    def test_clean_immediate_exit_is_not_a_startup_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "status 0"):
                startup.probe([sys.executable, "-c", "pass"], Path(directory), 10, dict(os.environ))

    def test_surviving_process_is_stopped(self):
        with tempfile.TemporaryDirectory() as directory:
            startup.probe([sys.executable, "-c", "import time; time.sleep(30)"],
                          Path(directory), 0.3, dict(os.environ))


if __name__ == "__main__":
    unittest.main()
