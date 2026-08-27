use std::path::PathBuf;

fn main() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    // Branch on the *target* OS, not the host. In a build script `cfg!(target_os)`
    // reflects the machine running the build, which breaks cross-compilation
    // (e.g. Linux -> Windows would take the Linux branch and fail to find libmpv).
    // `CARGO_CFG_TARGET_OS` is the platform we're actually building for.
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    if target_os == "windows" {
        let libmpv = manifest.join("libmpv");
        if libmpv.join("mpv.lib").exists() {
            println!("cargo:rustc-link-search=native={}", libmpv.display());
            println!(
                "cargo:rerun-if-changed={}",
                libmpv.join("mpv.lib").display()
            );
        }
        if !libmpv.join("libmpv-2.dll").exists() {
            println!("cargo:warning=libmpv-2.dll not found in src-tauri/libmpv. Run `pnpm run setup:libmpv` to fetch it (needed to run and bundle Harbor on Windows).");
        }
    }

    if target_os == "macos" {
        let mut prefixes: Vec<String> = Vec::new();
        if let Ok(p) = std::env::var("HOMEBREW_PREFIX") {
            if !p.is_empty() {
                prefixes.push(p);
            }
        }
        for p in ["/opt/homebrew", "/usr/local", "/opt/local"] {
            prefixes.push(p.to_string());
        }
        for prefix in &prefixes {
            for sub in ["lib", "opt/mpv/lib", "opt/libmpv/lib"] {
                let dir = std::path::Path::new(prefix).join(sub);
                if dir.exists() {
                    println!("cargo:rustc-link-search=native={}", dir.display());
                }
            }
        }
        println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Frameworks");
        println!("cargo:rustc-link-arg=-Wl,-rpath,@loader_path/../Frameworks");
    }

    if target_os == "linux" {
        let mut found = false;
        if let Ok(out) = std::process::Command::new("pkg-config")
            .args(["--variable=libdir", "mpv"])
            .output()
        {
            if out.status.success() {
                let dir = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !dir.is_empty() && std::path::Path::new(&dir).exists() {
                    println!("cargo:rustc-link-search=native={}", dir);
                    found = true;
                }
            }
        }
        if !found {
            for dir in [
                "/usr/lib/x86_64-linux-gnu",
                "/usr/lib/aarch64-linux-gnu",
                "/usr/lib",
                "/usr/lib64",
                "/usr/local/lib",
            ] {
                let p = std::path::Path::new(dir);
                if p.join("libmpv.so").exists()
                    || p.join("libmpv.so.2").exists()
                    || p.join("libmpv.so.1").exists()
                {
                    println!("cargo:rustc-link-search=native={}", dir);
                    found = true;
                    break;
                }
            }
        }
        if !found {
            panic!("libmpv not found. Install it: apt install libmpv-dev (Debian/Ubuntu), dnf install mpv-libs-devel (Fedora), or pacman -S mpv (Arch).");
        }
        println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN");
        println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN/lib");
        println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN/../lib");
    }

    let _ = manifest;
    tauri_build::build()
}
