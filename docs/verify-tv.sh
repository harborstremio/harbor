#!/bin/sh
# Harbor TV acceptance run. One command from a reconnected device to a verdict.
#
#   ./verify-tv.sh debug     install and verify the debug apk
#   ./verify-tv.sh release   install and verify the release apk
#   ./verify-tv.sh           defaults to release, the shipping variant
#
# Every check prints PASS or FAIL with the evidence, and the script never
# claims a pass it did not observe. A device that is not reachable is a
# SKIP, never a pass.

VARIANT=${1:-release}
ROOT=D:/harbor-beta/android-native/app/build/outputs/apk
APK=$ROOT/$VARIANT/app-$VARIANT.apk
PKG=com.harbor.tv
ACT=$PKG/.MainActivity
FAILED=0

say() { printf '%-34s %s\n' "$1" "$2"; }
fail() { say "$1" "FAIL  $2"; FAILED=1; }

[ -f "$APK" ] || { echo "no apk at $APK"; exit 2; }
say "apk" "$(basename "$APK") $(stat -c '%s' "$APK") bytes"
say "md5" "$(md5sum "$APK" | cut -d' ' -f1)"

NEWER=$(find D:/harbor-beta/android-native/app/src -newer "$APK" -name '*.kt' | wc -l)
if [ "$NEWER" -eq 0 ]; then say "sources newer than apk" "PASS  0"; else fail "sources newer than apk" "$NEWER, apk is stale"; fi

adb connect 192.168.1.29:5555 >/dev/null 2>&1
sleep 2
if ! adb shell true >/dev/null 2>&1; then
  echo
  echo "device unreachable, everything below is SKIP not PASS"
  exit 3
fi
say "device" "reachable"

adb install -r "$APK" >/tmp/hv_install.txt 2>&1
grep -q Success /tmp/hv_install.txt && say "install" "PASS" || fail "install" "$(tail -1 /tmp/hv_install.txt)"

adb shell am force-stop $PKG >/dev/null 2>&1
adb logcat -c >/dev/null 2>&1
adb shell am start -n $ACT >/dev/null 2>&1

n=0
while [ $n -lt 30 ]; do
  adb logcat -d -s HarborBoot:I 2>/dev/null | grep -q bootline && break
  adb logcat -d 2>/dev/null | grep -q "FATAL EXCEPTION" && break
  sleep 2; n=$((n+1))
done
say "boot wait" "$((n*2))s"

F=$(adb logcat -d 2>/dev/null | grep -c "FATAL EXCEPTION")
if [ "$F" -eq 0 ]; then say "FATAL EXCEPTION" "PASS  0"; else fail "FATAL EXCEPTION" "$F"; adb logcat -d 2>/dev/null | grep -A6 "FATAL EXCEPTION" | head -14; fi

S=$(adb logcat -d 2>/dev/null | grep -ci "Reading a state that was created")
if [ "$S" -eq 0 ]; then say "snapshot crash class" "PASS  0"; else fail "snapshot crash class" "$S"; fi

BL=$(adb logcat -d -s HarborBoot:I 2>/dev/null | grep bootline | tail -1)
if [ -n "$BL" ]; then
  say "bootline" "$(echo "$BL" | grep -oE 'app=[0-9]+ .*preApp=[0-9]+' | cut -c1-90)"
else
  fail "bootline" "never printed, app may not have painted"
fi

say "tier" "$(adb logcat -d -s HarborTier:I 2>/dev/null | tail -1 | sed 's/.*HarborTier: //' | cut -c1-88)"

for T in HarborSimkl HarborAniList HarborDecode HarborSkip; do
  C=$(adb logcat -d -s $T:I 2>/dev/null | grep -c .)
  say "$T lines" "$C"
done

echo
if [ $FAILED -eq 0 ]; then echo "ALL CHECKS PASSED for $VARIANT"; else echo "SOME CHECKS FAILED for $VARIANT"; fi
echo
echo "Still needs a human, this script cannot answer any of them:"
echo "  1. switch the audio track on a remux, it must not end playback"
echo "  2. switch a subtitle track, and nudge the timing"
echo "  3. Settings, Anime tracking, scan the AniList QR"
echo "  4. play a Pluto channel, preview then fullscreen"
echo "  5. scroll a Home row to its end, pagination is still unverified"
exit $FAILED
