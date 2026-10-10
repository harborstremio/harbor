import importlib.util
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

scripts = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location("resign", scripts / "macos-resign-adhoc.py")
resign = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resign)


class ResignTests(unittest.TestCase):
    def test_library_signing_error_stops_before_signing_app(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app = root / "Harbor.app"
            binary = app / "Contents/MacOS/harbor"
            library = app / "Contents/Frameworks/libmpv.2.dylib"
            for path in (binary, library):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"fixture")
            entitlements = root / "Entitlements.plist"
            entitlements.write_bytes(plistlib.dumps({"com.apple.security.cs.disable-library-validation": True}))
            with patch.dict(os.environ, {"APPLE_SIGNING_IDENTITY": "", "APPLE_CERTIFICATE": ""}), \
                 patch.object(resign, "run", side_effect=subprocess.CalledProcessError(1, "codesign")) as run:
                with self.assertRaises(subprocess.CalledProcessError):
                    resign.resign(app, entitlements)
                self.assertEqual(run.call_count, 1)
                self.assertEqual(run.call_args.args[-1], str(library))

    def test_invalid_entitlements_cannot_mutate_signatures(self):
        with tempfile.TemporaryDirectory() as directory:
            entitlements = Path(directory) / "Entitlements.plist"
            entitlements.write_bytes(plistlib.dumps({}))
            with patch.dict(os.environ, {"APPLE_SIGNING_IDENTITY": "", "APPLE_CERTIFICATE": ""}), \
                 patch.object(resign, "run") as run:
                with self.assertRaisesRegex(RuntimeError, "disable-library-validation"):
                    resign.resign(Path(directory) / "Harbor.app", entitlements)
                run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
