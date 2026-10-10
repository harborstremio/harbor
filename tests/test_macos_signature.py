import importlib.util
import os
from pathlib import Path
import plistlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "macos_signature", Path(__file__).resolve().parents[1] / "scripts/macos-verify-signature.py"
)
signature = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signature)


class SignatureTests(unittest.TestCase):
    def verify(self, entitlements, flags="adhoc,runtime"):
        def run(*args):
            if "--entitlements" in args:
                return "Executable=/Applications/Harbor.app\n" + plistlib.dumps(entitlements).decode()
            return f"CodeDirectory v=20500 size=123 flags=0x10002({flags}) hashes=1\nTeamIdentifier=not set"
        with patch.object(signature, "run", run), patch.dict(os.environ, {
            "APPLE_SIGNING_IDENTITY": "", "APPLE_CERTIFICATE": ""
        }):
            signature.verify(Path("Harbor.app"))

    def test_stripped_or_false_entitlements_fail(self):
        for value in ({}, {"com.apple.security.cs.disable-library-validation": False}):
            with self.subTest(value=value), self.assertRaisesRegex(RuntimeError, "without disable-library-validation"):
                self.verify(value)

    def test_hardened_adhoc_bundle_preserves_library_entitlement(self):
        self.verify({"com.apple.security.cs.disable-library-validation": True})

    def test_non_hardened_adhoc_bundle_does_not_require_exception(self):
        self.verify({}, "adhoc")


if __name__ == "__main__":
    unittest.main()
