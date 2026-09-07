#!/bin/bash
# Test aplikacji na emulatorze Androida (bez telefonu): tworzy AVD, uruchamia emulator bez okna,
# instaluje APK, robi zrzuty ekranu do katalogu test-out/. Uruchom w Git Bash: bash test-emulator.sh
set -e
export JAVA_HOME="C:\Users\48607\jdk\jdk-17.0.20.1+1"
export ANDROID_HOME="$LOCALAPPDATA\Android\Sdk"
S="$LOCALAPPDATA/Android/Sdk"
ADB="$S/platform-tools/adb.exe"
EMU="$S/emulator/emulator.exe"
AVD=ortus_test
OUT="$(dirname "$0")/test-out"; mkdir -p "$OUT"

if ! "$S/cmdline-tools/latest/bin/avdmanager.bat" list avd 2>/dev/null | grep -q "Name: $AVD"; then
  echo "tworzę AVD $AVD"
  echo no | "$S/cmdline-tools/latest/bin/avdmanager.bat" create avd -n "$AVD" -k "system-images;android-34;google_apis;x86_64" -d "pixel_6" >/dev/null
fi

"$ADB" start-server >/dev/null 2>&1
if ! "$ADB" devices | grep -q "emulator-"; then
  echo "uruchamiam emulator (bez okna)"
  "$EMU" -avd "$AVD" -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -accel on > "$OUT/emulator.log" 2>&1 &
  sleep 5
fi
echo "czekam na start systemu…"
"$ADB" wait-for-device
for i in $(seq 1 90); do
  b=$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  [ "$b" = "1" ] && break; sleep 2
done
echo "system gotowy po ~$((i*2)) s"
"$ADB" shell settings put global window_animation_scale 0 >/dev/null
"$ADB" shell settings put global transition_animation_scale 0 >/dev/null
"$ADB" shell settings put global animator_duration_scale 0 >/dev/null

APK="$(dirname "$0")/android/app/build/outputs/apk/debug/app-debug.apk"
echo "instaluję $APK"
"$ADB" install -r "$APK" | tail -1
"$ADB" shell am start -n pl.niekazmuliczyc.ortus/.MainActivity >/dev/null
sleep 8
shot(){ "$ADB" exec-out screencap -p > "$OUT/$1.png"; echo "zrzut: $1"; }
shot 01-start
echo "--- logcat (błędy WebView/Capacitor):"
"$ADB" logcat -d 2>/dev/null | grep -i "chromium.*error\|Capacitor.*error\|E/Capacitor\|Uncaught" | tail -8 || true
echo "gotowe: $OUT"
