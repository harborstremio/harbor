fn main() {
    let src = std::path::Path::new("upstream");
    let mut build = cc::Build::new();
    build.include(src).define("HAVE_FCNTL_H", "1");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        build
            .define("_CRT_SECURE_NO_WARNINGS", "1")
            .define("_CRT_NONSTDC_NO_WARNINGS", "1");
    } else {
        build
            .define("HAVE_UNISTD_H", "1")
            .define("HAVE_PTHREAD_H", "1")
            .define("_FILE_OFFSET_BITS", "64")
            .define("_POSIX_C_SOURCE", "200809L");
    }
    for name in [
        "default_blockinput.c",
        "ecma167.c",
        "udf_volume.c",
        "udf_fs.c",
        "udfread.c",
    ] {
        build.file(src.join(name));
    }
    println!("cargo:rerun-if-changed=upstream");
    build.compile("harbor_udfread");
}
