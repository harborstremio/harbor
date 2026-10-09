"""Exercise the real bundling pipeline against a synthetic Mach-O toolchain."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import macos_macho as macho

spec = importlib.util.spec_from_file_location("mpv_bundle", SCRIPTS / "macos-bundle-libmpv.py")
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)
MAGIC = macho.MACHO_MAGIC[0]
TRIPLE = "aarch64-apple-darwin"


def read_binary(path):
    return json.loads(Path(path).read_bytes()[4:])


def write_binary(path, **values):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = dict(loads=["/usr/lib/libSystem.B.dylib"], rpaths=[], minos="12.0", arch="arm64")
    data.update(values)
    path.write_bytes(MAGIC + json.dumps(data).encode())
    return path


class MacMpvBundleTests(unittest.TestCase):
    def setUp(self):
        self.base = Path(os.environ.get("HARBOR_TEST_TMPDIR", tempfile.gettempdir())).resolve()
        self.temp = tempfile.TemporaryDirectory(prefix="macos-mpv-", dir=self.base)
        self.root = Path(self.temp.name).resolve()
        self.assertTrue(self.root.is_relative_to(self.base))
        self.prefix = self.root / "homebrew"
        self.frameworks = self.root / "staged-frameworks"
        self.config = self.root / "overlay.json"
        self.calls = []
        self.launch_failure = False
        self.library = write_binary(self.prefix / "lib/libmpv.2.dylib")
        self.extra = write_binary(self.prefix / "lib/libcli-only.dylib", loads=["@loader_path/libnested.dylib"])
        self.nested = write_binary(self.prefix / "lib/libnested.dylib")
        self.mpv = write_binary(self.prefix / "bin/mpv", loads=["@loader_path/../lib/libmpv.2.dylib", "@loader_path/../lib/libcli-only.dylib"],
                                rpaths=[str(self.prefix / "lib")], minos="14.0")
        config = self.root / "src-tauri/tauri.conf.json"
        config.parent.mkdir(parents=True)
        config.write_text(json.dumps({"bundle": {"macOS": {"minimumSystemVersion": "12.0"},
                          "externalBin": ["binaries/yt-dlp", "binaries/ffmpeg", "binaries/ffprobe"]}}))
        self.patches = [patch.object(bundle, "__file__", str(self.root / "scripts/macos-bundle-libmpv.py")),
                        patch.object(bundle, "run", self.run_tool), patch.object(macho, "run", self.run_tool),
                        patch.object(bundle, "brew_prefixes", lambda: [self.prefix]),
                        patch.dict(os.environ, {"APPLE_SIGNING_IDENTITY": "", "APPLE_CERTIFICATE": ""})]
        for replacement in self.patches:
            replacement.start()

    def tearDown(self):
        for replacement in reversed(self.patches):
            replacement.stop()
        self.assertTrue(self.root.is_relative_to(self.base))
        self.temp.cleanup()

    def run_tool(self, *args, capture=True):
        self.calls.append(args)
        command, *values = args
        if command == "pkg-config":
            return str(self.prefix / "lib" if values[0] == "--variable=libdir" else self.prefix)
        if command == "otool":
            flag, path = values
            data = read_binary(path)
            if flag == "-L":
                return f"{path}:\n" + "\n".join(f"\t{load} (compatibility version 1.0.0, current version 1.0.0)" for load in data["loads"])
            return "\n".join([*(f"cmd LC_RPATH\npath {value} (offset 12)" for value in data["rpaths"]),
                              f"cmd LC_BUILD_VERSION\nminos {data['minos']}"])
        if command == "lipo":
            path, verify, architecture = values
            self.assertEqual(verify, "-verify_arch")
            if read_binary(path)["arch"] != architecture:
                raise subprocess.CalledProcessError(1, args)
            return ""
        if command == "install_name_tool":
            flag, *parameters, path = values
            data = read_binary(path)
            if flag == "-change":
                old, new = parameters
                data["loads"] = [new if load == old else load for load in data["loads"]]
            elif flag == "-delete_rpath":
                data["rpaths"] = [value for value in data["rpaths"] if value != parameters[0]]
            elif flag == "-add_rpath":
                data["rpaths"].append(parameters[0])
            else:
                self.assertEqual(flag, "-id")
            write_binary(path, **data)
            return ""
        if command == "codesign":
            return ""
        if Path(command).name == "mpv" and values == ["--no-config", "--version"]:
            if self.launch_failure:
                raise subprocess.CalledProcessError(1, args)
            return "mpv fixture"
        self.fail(f"unexpected native command {args}")

    def prepare(self, target=TRIPLE):
        bundle.prepare(argparse.Namespace(frameworks=self.frameworks, config=self.config, target=target))
        return self.root / f"src-tauri/binaries/mpv-{target}"

    def app(self):
        staged = self.prepare()
        app = self.root / "Harbor.app"
        frameworks = app / "Contents/Frameworks"
        shutil.copytree(self.frameworks, frameworks)
        executable = write_binary(app / "Contents/MacOS/harbor", loads=["@rpath/libmpv.2.dylib"],
                                  rpaths=["@executable_path/../Frameworks"])
        mpv = executable.parent / "mpv"
        shutil.copy2(staged, mpv)
        import plistlib
        (app / "Contents/Info.plist").write_bytes(plistlib.dumps({"LSMinimumSystemVersion": "14.0"}))
        return app, mpv

    def test_prepare_bundles_cli_and_recursive_dependencies_without_modifying_homebrew(self):
        before = self.mpv.read_bytes()
        staged = self.prepare()
        self.assertEqual({path.name for path in self.frameworks.iterdir()},
                         {"libmpv.2.dylib", "libcli-only.dylib", "libnested.dylib"})
        self.assertEqual(read_binary(staged)["loads"], ["@rpath/libmpv.2.dylib", "@rpath/libcli-only.dylib"])
        self.assertEqual(read_binary(staged)["rpaths"], ["@executable_path/../Frameworks"])
        self.assertEqual(read_binary(self.frameworks / "libcli-only.dylib")["loads"], ["@rpath/libnested.dylib"])
        self.assertEqual(self.mpv.read_bytes(), before)
        config = json.loads(self.config.read_text())
        self.assertEqual(config["bundle"]["externalBin"],
                         ["binaries/yt-dlp", "binaries/ffmpeg", "binaries/ffprobe", "binaries/mpv"])
        self.assertEqual(config["bundle"]["macOS"]["minimumSystemVersion"], "14.0")
        self.assertIn(f"--target {TRIPLE}", config["build"]["beforeBundleCommand"])
        self.assertFalse(any(call[:2] == ("install_name_tool", "-id") and call[-1] == str(staged) for call in self.calls))

    def test_missing_cli_cannot_produce_a_library_only_package(self):
        self.mpv.unlink()
        with self.assertRaisesRegex(RuntimeError, "thumbnail mpv executable"):
            self.prepare()
        self.assertFalse(self.config.exists())

    def test_intel_build_stages_the_intel_helper_under_its_own_target(self):
        for path in (self.mpv, self.library, self.extra, self.nested):
            write_binary(path, **{**read_binary(path), "arch": "x86_64"})
        staged = self.prepare("x86_64-apple-darwin")
        self.assertEqual(staged.name, "mpv-x86_64-apple-darwin")
        self.assertEqual(read_binary(staged)["arch"], "x86_64")
        self.assertIn("--target x86_64-apple-darwin", json.loads(self.config.read_text())["build"]["beforeBundleCommand"])

    def test_wrong_architecture_in_cli_or_its_dependency_fails_preparation(self):
        for path in (self.mpv, self.nested):
            with self.subTest(path=path):
                original = read_binary(path)
                write_binary(path, **{**original, "arch": "x86_64"})
                with self.assertRaises(subprocess.CalledProcessError):
                    self.prepare()
                write_binary(path, **original)
        self.assertFalse(self.config.exists())

    def test_cli_cannot_raise_the_supported_macos_ceiling(self):
        write_binary(self.mpv, **{**read_binary(self.mpv), "minos": "26.0"})
        with self.assertRaisesRegex(RuntimeError, "above the macOS 15 ceiling"):
            self.prepare()
        self.assertFalse(self.config.exists())

    def test_unresolvable_cli_dependency_fails_preparation(self):
        self.nested.unlink()
        with self.assertRaisesRegex(RuntimeError, "Could not resolve"):
            self.prepare()

    def test_different_libraries_with_same_name_are_rejected(self):
        write_binary(self.prefix / "other/libmpv.2.dylib", minos="13.0")
        write_binary(self.mpv, **{**read_binary(self.mpv), "loads": ["@loader_path/../other/libmpv.2.dylib"]})
        with self.assertRaisesRegex(RuntimeError, "Two different libraries"):
            self.prepare()

    def test_finalized_bundle_keeps_the_cli_minimum_os(self):
        staged = self.prepare()
        executable = write_binary(self.root / "release/harbor", loads=[str(self.library)])
        with patch.object(bundle.sys, "platform", "darwin"), patch.object(bundle, "release_binary", return_value=executable), \
             patch.dict(os.environ, {"HARBOR_MACOS_FRAMEWORKS_DIR": str(self.frameworks)}):
            bundle.finalize(argparse.Namespace(target=TRIPLE))
        self.assertEqual(read_binary(staged)["minos"], "14.0")
        self.assertEqual(read_binary(executable)["loads"], ["@rpath/libmpv.2.dylib"])

    def test_verification_checks_signed_app_and_launches_bundled_helper(self):
        app, mpv = self.app()
        bundle.verify_app(argparse.Namespace(app=app, target=TRIPLE))
        self.assertIn(("codesign", "--verify", "--deep", "--strict", str(app)), self.calls)
        self.assertIn((str(mpv), "--no-config", "--version"), self.calls)

    def test_verification_rejects_missing_cli(self):
        app, mpv = self.app()
        mpv.unlink()
        with self.assertRaisesRegex(RuntimeError, "thumbnail mpv executable is missing"):
            bundle.verify_app(argparse.Namespace(app=app, target=TRIPLE))

    def test_verification_rejects_cli_homebrew_load_or_wrong_rpath(self):
        for change, message in (({"loads": ["/opt/homebrew/lib/libmpv.2.dylib"]}, "machine-local"),
                                ({"rpaths": ["@executable_path/elsewhere"]}, "no LC_RPATH"),
                                ({"minos": "15.0"}, "bundle advertises")):
            with self.subTest(change=change):
                app, mpv = self.app()
                write_binary(mpv, **{**read_binary(mpv), **change})
                with self.assertRaisesRegex(RuntimeError, message):
                    bundle.verify_app(argparse.Namespace(app=app, target=TRIPLE))
                self.assertTrue(app.resolve().is_relative_to(self.root))
                shutil.rmtree(app)

    def test_unloadable_cli_fails_the_bundle_check(self):
        app, _ = self.app()
        self.launch_failure = True
        with self.assertRaises(subprocess.CalledProcessError):
            bundle.verify_app(argparse.Namespace(app=app, target=TRIPLE))

    def test_release_selection_never_uses_another_target(self):
        other = write_binary(self.root / "src-tauri/target/x86_64-apple-darwin/release/harbor")
        with patch.dict(os.environ, {"CARGO_TARGET_DIR": str(self.root / "src-tauri/target")}):
            with self.assertRaisesRegex(RuntimeError, "Could not locate"):
                bundle.release_binary(self.root, TRIPLE)
            native = write_binary(self.root / "src-tauri/target/release/harbor")
            self.assertEqual(bundle.release_binary(self.root, TRIPLE), native)
            target = write_binary(self.root / f"src-tauri/target/{TRIPLE}/release/harbor")
            self.assertEqual(bundle.release_binary(self.root, TRIPLE), target)

    def test_verification_rejects_wrong_architecture_in_final_app(self):
        app, _ = self.app()
        binary = app / "Contents/MacOS/harbor"
        write_binary(binary, **{**read_binary(binary), "arch": "x86_64"})
        with self.assertRaises(subprocess.CalledProcessError):
            bundle.verify_app(argparse.Namespace(app=app, target=TRIPLE))

    def test_verification_checks_other_shipped_helpers(self):
        app, _ = self.app()
        write_binary(app / "Contents/MacOS/ffmpeg", loads=["/opt/homebrew/lib/libmissing.dylib"])
        with self.assertRaisesRegex(RuntimeError, "machine-local"):
            bundle.verify_app(argparse.Namespace(app=app, target=TRIPLE))

    def test_relative_dependencies_must_exist_inside_frameworks(self):
        app, _ = self.app()
        executable = app / "Contents/MacOS/harbor"
        frameworks = app / "Contents/Frameworks"
        for load, error in (("@loader_path/../Frameworks/missing.dylib", "unbundled"),
                            ("@rpath/subdir/libmpv.2.dylib", "unbundled"),
                            ("@rpath/../libmpv.2.dylib", "outside bundled"),
                            ("libmpv.2.dylib", "unsupported relative")):
            with self.subTest(load=load):
                write_binary(executable, loads=[load])
                with self.assertRaisesRegex(RuntimeError, error):
                    macho.verify_macho(executable, frameworks)
        write_binary(executable, loads=["@executable_path/../Frameworks/libmpv.2.dylib"])
        macho.verify_macho(executable, frameworks)


if __name__ == "__main__":
    unittest.main()
