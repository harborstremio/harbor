#!/bin/bash
# Build Harbor's complete macOS libmpv dependency closure from source.
#
# Homebrew bottles are compiled for the runner that produced them. Bundling
# those bottles made Harbor's advertised macOS 11 application silently depend
# on newer libc++ symbols. IINA's dependency builder consistently passes the
# deployment target to Autotools, CMake, Meson, FFmpeg, LuaJIT, and Swift, which
# makes it a suitable source-build foundation for a portable Harbor release.
set -euo pipefail

readonly IINA_DEPS_COMMIT="88dcec553645b14a9089c2c58be3252f69f3c12b"
readonly IINA_DEPS_REPOSITORY="https://github.com/iina/deps-buildscripts.git"
readonly MACOS_MINIMUM_VERSION="11.0"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

usage() {
    echo "Usage: $0 --arch <arm64|x86_64> --work-dir <directory>" >&2
}

arch=""
work_dir=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        --arch)
            arch="${2:-}"
            shift 2
            ;;
        --work-dir)
            work_dir="${2:-}"
            shift 2
            ;;
        *)
            usage
            exit 2
            ;;
    esac
done

if [ "$arch" != "arm64" ] && [ "$arch" != "x86_64" ]; then
    usage
    exit 2
fi
if [ -z "$work_dir" ]; then
    usage
    exit 2
fi

work_dir="$(mkdir -p "$work_dir" && cd "$work_dir" && pwd)"
source_dir="$work_dir/deps-buildscripts"
marker="$work_dir/.harbor-macos-deps-${arch}"
expected_marker="${IINA_DEPS_COMMIT} macos-${MACOS_MINIMUM_VERSION} ${arch} tools-v1"
lib_dir="$source_dir/install/$arch/lib"
output_dir="$source_dir/output/$arch"

if [ -f "$marker" ] \
    && [ "$(cat "$marker")" = "$expected_marker" ] \
    && [ -f "$lib_dir/libmpv.dylib" ] \
    && [ -x "$source_dir/install/$arch/bin/ffmpeg" ] \
    && [ -x "$source_dir/install/$arch/bin/ffprobe" ] \
    && find "$output_dir" -maxdepth 1 -name 'libmpv*.dylib' -print -quit | grep -q .; then
    echo "[macos-deps] using cached macOS ${MACOS_MINIMUM_VERSION} libraries for ${arch}"
else
    rm -f "$marker"
    if [ ! -d "$source_dir/.git" ]; then
        rm -rf "$source_dir"
        git init --quiet "$source_dir"
        git -C "$source_dir" remote add origin "$IINA_DEPS_REPOSITORY"
    fi

    # Fetch only the reviewed revision. The detached checkout ensures a branch
    # or tag moving upstream cannot alter a release build unexpectedly.
    git -C "$source_dir" fetch --quiet --depth 1 origin "$IINA_DEPS_COMMIT"
    git -C "$source_dir" checkout --quiet --detach FETCH_HEAD
    actual_commit="$(git -C "$source_dir" rev-parse HEAD)"
    if [ "$actual_commit" != "$IINA_DEPS_COMMIT" ]; then
        echo "[macos-deps] expected $IINA_DEPS_COMMIT but checked out $actual_commit" >&2
        exit 1
    fi

    # SourceForge's certificate chain is currently invalid on Apple's and
    # Homebrew's curl. Use established HTTPS mirrors for the exact same,
    # checksum-pinned archives; the upstream SHA-256 values remain unchanged.
    sed -i '' \
        's#^FREETYPE_URL=.*#FREETYPE_URL="https://download.savannah.gnu.org/releases/freetype/freetype-${FREETYPE_VERSION}.tar.xz"#' \
        "$source_dir/versions.env"
    sed -i '' \
        's#https://downloads.sourceforge.net/project/bs2b/libbs2b/${LIBBS2B_VERSION}/#https://distfiles.macports.org/libbs2b/#' \
        "$source_dir/versions.env"
    sed -i '' \
        's#^LIBSOXR_URL=.*#LIBSOXR_URL="https://deb.debian.org/debian/pool/main/libs/libsoxr/libsoxr_${LIBSOXR_VERSION}.orig.tar.xz"#' \
        "$source_dir/versions.env"
    sed -i '' \
        's#^LIBUDFREAD_URL=.*#LIBUDFREAD_URL="https://ftp.osuosl.org/pub/videolan/libudfread/libudfread-${LIBUDFREAD_VERSION}.tar.xz"#' \
        "$source_dir/versions.env"
    sed -i '' \
        's#^LIBBLURAY_URL=.*#LIBBLURAY_URL="https://artfiles.org/videolan.org/libbluray/${LIBBLURAY_VERSION}/libbluray-${LIBBLURAY_VERSION}.tar.xz"#' \
        "$source_dir/versions.env"
    sed -i '' \
        's#https://downloads.sourceforge.net/project/lcms/lcms/${LITTLE_CMS2_VERSION}/#https://github.com/mm2/Little-CMS/releases/download/lcms${LITTLE_CMS2_VERSION}/#' \
        "$source_dir/versions.env"

    # soxr 0.1.3's SIMD probe predates Apple Silicon and incorrectly enables
    # code paths that only define their ARM intrinsics for 32-bit __arm__.
    # Keep its scalar resampler enabled and disable only the broken optional
    # SIMD engines; mpv still receives the same public libsoxr API.
    if ! grep -q -- '-DWITH_CR32S=OFF' "$source_dir/buildscripts/build-libsoxr.sh"; then
        sed -i '' \
            's#-DWITH_LSR_BINDINGS=OFF#-DWITH_LSR_BINDINGS=OFF -DWITH_CR32S=OFF -DWITH_CR64S=OFF -DWITH_PFFFT=OFF#' \
            "$source_dir/buildscripts/build-libsoxr.sh"
    fi

    # Harbor uses the ffmpeg and ffprobe executables for casting, subtitle
    # extraction, and media inspection. Build them against the same macOS 11
    # libraries as libmpv instead of downloading macOS 12-only sidecars.
    if ! grep -q -- '--enable-ffmpeg' "$source_dir/buildscripts/build-ffmpeg.sh"; then
        patch -d "$source_dir" -p1 \
            < "$SCRIPT_DIR/macos-patches/deps-buildscripts/001-build-ffmpeg-tools.patch"
    fi

    # Apple's SDK keeps locale_t/newlocale declarations in xlocale.h. Install
    # this narrowly scoped source patch into IINA's normal patch pipeline.
    mkdir -p "$source_dir/patches/fontconfig"
    cp "$SCRIPT_DIR/macos-patches/fontconfig/001-include-xlocale-on-macos.patch" \
        "$source_dir/patches/fontconfig/"

    MACOSX_DEPLOYMENT_TARGET="$MACOS_MINIMUM_VERSION" \
        "$source_dir/build.sh" "$arch"
    "$source_dir/fix-install-names.sh" "$arch"
    printf '%s\n' "$expected_marker" > "$marker"
fi

echo "HARBOR_MACOS_LIB_DIR=$lib_dir"
echo "HARBOR_MACOS_DYLIB_DIR=$output_dir"
