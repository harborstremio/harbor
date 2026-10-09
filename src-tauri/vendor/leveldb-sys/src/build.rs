use std::{
    env,
    path::{Path, PathBuf},
};

#[cfg(feature = "snappy")]
const SNAPPY_VERSION: &'static str = "1.1.7";
const LEVELDB_VERSION: &'static str = "1.22";
/// Directory name within `$OUT_DIR` where the static libraries should be built.
const LIBDIR: &'static str = "lib";

#[cfg(feature = "snappy")]
fn build_snappy() -> PathBuf {
    println!("[snappy] Building");

    let outdir = env::var("OUT_DIR").unwrap();
    let libdir = Path::new(&outdir).join(LIBDIR);

    let dest_prefix =
        cmake::Config::new(Path::new("deps").join(format!("snappy-{}", SNAPPY_VERSION)))
            .define("BUILD_SHARED_LIBS", "OFF")
            .define("CMAKE_POLICY_VERSION_MINIMUM", "3.10")
            .define("SNAPPY_BUILD_TESTS", "OFF")
            .define("HAVE_LIBZ", "OFF")
            .define("CMAKE_INSTALL_LIBDIR", &libdir)
            .build();

    assert_eq!(
        dest_prefix.join(LIBDIR),
        libdir,
        "CMake should build Snappy in provided LIBDIR"
    );
    println!("cargo:rustc-link-search=native={}", libdir.display());
    println!("cargo:rustc-link-lib=static=snappy");

    dest_prefix
}

fn build_leveldb(snappy_prefix: Option<PathBuf>) {
    println!("[leveldb] Building");

    let outdir = env::var("OUT_DIR").unwrap();
    let libdir = Path::new(&outdir).join(LIBDIR);

    let mut config =
        cmake::Config::new(Path::new("deps").join(format!("leveldb-{}", LEVELDB_VERSION)));
    config
        .define("CMAKE_POLICY_VERSION_MINIMUM", "3.10")
        .define("LEVELDB_BUILD_TESTS", "OFF")
        .define("LEVELDB_BUILD_BENCHMARKS", "OFF")
        .define("CMAKE_INSTALL_LIBDIR", &libdir);
    if let Some(snappy_prefix) = snappy_prefix {
        #[cfg(target_env = "msvc")]
        let ldflags = format!("/LIBPATH:{}", snappy_prefix.join(LIBDIR).display());
        #[cfg(not(target_env = "msvc"))]
        let ldflags = format!("-L{}", snappy_prefix.join(LIBDIR).display());
    
        env::set_var(
            "LDFLAGS",
            ldflags
        );

        config
            .define("HAVE_SNAPPY", "ON")
            .cflag(format!("-I{}", snappy_prefix.join("include").display()))
            .cxxflag(format!("-I{}", snappy_prefix.join("include").display()));
    } else {
        config.define("HAVE_SNAPPY", "OFF");
    }
    let dest_prefix = config.build();

    assert_eq!(
        dest_prefix.join(LIBDIR),
        libdir,
        "CMake should build LevelDB in provided LIBDIR"
    );
    println!("cargo:rustc-link-search=native={}", libdir.display());
    println!("cargo:rustc-link-lib=static=leveldb");
}

fn main() {
    println!("[build] Started");
    println!("cargo:rerun-if-env-changed=CMAKE");
    // VS Build Tools can provide CMake without putting it on PATH. Keep an
    // explicitly selected toolchain, and resolve the installed tool otherwise.
    if cfg!(windows) && env::var_os("CMAKE").is_none()
        && std::process::Command::new("cmake").arg("--version")
            .stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).status().is_err()
    {
        if let Some(base) = env::var_os("ProgramFiles(x86)") {
            let finder = Path::new(&base).join("Microsoft Visual Studio/Installer/vswhere.exe");
            if let Ok(output) = std::process::Command::new(finder)
                .args(["-latest", "-prerelease", "-products", "*", "-property", "installationPath"]).output()
            {
                if output.status.success() {
                    let installation = String::from_utf8_lossy(&output.stdout);
                    let cmake = Path::new(installation.trim())
                        .join("Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe");
                    if cmake.is_file() { env::set_var("CMAKE", cmake); }
                }
            }
        }
    }

    // If we have the appropriate feature, then we build snappy.
    #[cfg(feature = "snappy")]
    let snappy_prefix = Some(build_snappy());
    #[cfg(not(feature = "snappy"))]
    let snappy_prefix: Option<PathBuf> = None;

    // Build LevelDB
    build_leveldb(snappy_prefix);

    // Link to the standard C++ library
    let target = env::var("TARGET").unwrap();
    if target.contains("apple") || target.contains("freebsd") {
        println!("cargo:rustc-link-lib=c++");
    } else if target.contains("gnu") || target.contains("netbsd") || target.contains("openbsd") {
        println!("cargo:rustc-link-lib=stdc++");
    } else if target.contains("musl") {
        // We want to link to libstdc++ *statically*. This requires that the user passes the right
        // search path to rustc via `-Lstatic=/path/to/libstdc++`.
        println!("cargo:rustc-link-lib=static=stdc++");
    }

    println!("[build] Finished");
}
