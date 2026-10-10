# Path and classpath conventions differ between Git Bash on Windows and a POSIX shell.
# Sourced by the build tooling so one script serves both.
if command -v cygpath >/dev/null 2>&1; then
  CPSEP=';'
  hostpath() { cygpath -w "$1"; }
else
  CPSEP=':'
  hostpath() { printf '%s' "$1"; }
fi

# JAVA_HOME is set on the Windows box but not on a stock macOS runner, where java is on PATH.
JBIN=${JAVA_HOME:+$JAVA_HOME/bin/}

# Joins existing paths into one classpath, skipping globs that matched nothing.
cp_join() {
  _out=""
  for _j in "$@"; do
    [ -e "$_j" ] || continue
    if [ -n "$_out" ]; then _out="$_out$CPSEP"; fi
    _out="$_out$(hostpath "$_j")"
  done
  printf '%s' "$_out"
}
