#!/bin/sh
# Harbor TV measurement harness. Run from anywhere with adb on PATH.
#
#   ./measure-tv.sh boot [n]     cold-boot appCreate, n times (default 6)
#   ./measure-tv.sh mem  [n]     idle-Home PSS and Graphics, n times (default 3)
#   ./measure-tv.sh scroll       guided before/after over a FIXED nav path
#
# Why it always repeats: on this box a single graphics or scratch reading carries no
# information. Measured variance across identical idle launches is 44 to 67 percent.
# Six separate times in one night a single reading showed a win that vanished on repeat.

PKG=com.harbor.tv
ACT=$PKG/.MainActivity

stats() {  # reads numbers on stdin, prints n / mean / min / max / spread
  awk '{v[n++]=$1; s+=$1; if(n==1||$1<lo)lo=$1; if(n==1||$1>hi)hi=$1}
       END{ if(!n){print "  no readings"; exit}
            m=s/n; printf "  n=%d  mean=%.0f  min=%.0f  max=%.0f  spread=%.1f%%\n", n, m, lo, hi, (hi-lo)*100/m
            if((hi-lo)*100/m > 15) print "  WARNING: spread over 15%. Do not report a difference smaller than this." }'
}

boot() {
  N=${1:-6}; echo "cold boot appCreate, $N runs"; i=0
  while [ $i -lt $N ]; do
    adb shell "am force-stop $PKG" >/dev/null 2>&1; sleep 2
    adb shell "logcat -c" >/dev/null 2>&1
    adb shell "am start -n $ACT" >/dev/null 2>&1; sleep 16
    L=$(adb shell "logcat -d -s HarborBoot" 2>/dev/null)
    v=$(echo "$L" | grep -oE 'appCreate=[0-9]+' | head -1 | tr -dc 0-9)
    f=$(adb shell "logcat -d -b crash,main" 2>/dev/null | grep -c 'FATAL EXCEPTION' | tr -dc 0-9)
    echo "  run $((i+1)): appCreate=${v:-no-cold-line} ms   FATAL=${f:-?}"
    echo "$L" | grep -oE 'bootline .*' | head -1 | tr ' ' '\n' \
      | grep -E '^(app|home|rowReady|paint|feed|artTotal|majflt|memAvailMb)=' | tr '\n' ' '
    echo
    echo "$v" >> /tmp/htv_boot; i=$((i+1))
  done
  echo "appCreate ms:"; cat /tmp/htv_boot | grep . | stats; rm -f /tmp/htv_boot
  adb shell "am force-stop $PKG" >/dev/null 2>&1
}

mem() {
  N=${1:-3}; echo "idle-Home PSS and Graphics, $N runs"; i=0
  while [ $i -lt $N ]; do
    adb shell "am force-stop $PKG" >/dev/null 2>&1; sleep 2
    adb shell "am start -n $ACT" >/dev/null 2>&1; sleep 42
    m=$(adb shell "dumpsys meminfo $PKG" 2>/dev/null)
    g=$(echo "$m" | grep -oE 'Graphics: *[0-9]+' | grep -oE '[0-9]+' | head -1)
    p=$(echo "$m" | grep -oE 'TOTAL PSS: *[0-9]+' | grep -oE '[0-9]+' | head -1)
    echo "  run $((i+1)): Graphics=${g:-?} kB  PSS=${p:-?} kB"
    echo "$g" >> /tmp/htv_gfx; echo "$p" >> /tmp/htv_pss; i=$((i+1))
  done
  echo "Graphics kB:"; cat /tmp/htv_gfx | grep . | stats
  echo "TOTAL PSS kB:"; cat /tmp/htv_pss | grep . | stats
  rm -f /tmp/htv_gfx /tmp/htv_pss
  adb shell "am force-stop $PKG" >/dev/null 2>&1
}

scroll() {
  cat <<'PATH'
The scratch pool is a session HIGH-WATER MARK that HWUI never purges while foreground.
So a before/after only means anything if you walk the SAME path in the SAME order both times.

THE FIXED PATH, walk exactly this:
  1. wait for Home to finish painting
  2. DOWN twice
  3. RIGHT five times
  4. OK to open a detail page, wait for art
  5. BACK
PATH
  printf "\npress enter when the app is open on Home and you are ready to start> "; read _
  adb shell "am force-stop $PKG" >/dev/null 2>&1; sleep 2
  adb shell "am start -n $ACT" >/dev/null 2>&1; sleep 12
  adb shell "dumpsys gfxinfo $PKG reset" >/dev/null 2>&1
  printf "walk the path now, then press enter> "; read _
  echo "--- GPU caches ---"
  adb shell "dumpsys gfxinfo $PKG" 2>/dev/null | sed -n '/GPU Caches/,/Total GPU/p'
  echo "--- frame timing ---"
  adb shell "dumpsys gfxinfo $PKG" 2>/dev/null | grep -E 'Total frames|Janky|50th|90th|95th|99th'
  echo "--- memory ---"
  adb shell "dumpsys meminfo $PKG" 2>/dev/null | grep -E 'TOTAL PSS|^ *Graphics:'
  echo
  echo "Run this on BOTH builds walking the SAME path. A difference smaller than the"
  echo "spread you get from repeating one build on itself is not a result."
}

case "$1" in
  boot) boot "$2" ;;
  mem) mem "$2" ;;
  scroll) scroll ;;
  *) sed -n '2,12p' "$0" ;;
esac
