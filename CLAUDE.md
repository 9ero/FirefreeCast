# FireCast — Claude Context

## Project summary
WebRTC-based tab casting from Chrome/Brave to Fire TV / Android TV.
Two components: a Chrome extension (sender) and an Android app (receiver).
Companion project: `../chrome-emulator` (Cast v2 emulator, different approach).

## Status
**Working** — tested successfully on Android TV emulator (API 31, x86).
Not yet tested on real Fire TV hardware.

## Component overview

### extension/ — Chrome/Brave MV3 Extension
- `popup/popup.js` — all logic inlined (no ES modules — caused silent failures in Brave)
- Uses `chrome.tabCapture.capture()` → `RTCPeerConnection` → WebSocket signaling
- No async/await in extension context (uses `.then()/.catch()` — more reliable)
- Saves last-used IP to `chrome.storage.local`

### android/ — Kotlin Android TV App
- `SignalingServer.kt` — WebSocket server on port **8765** (Java-WebSocket library)
- `WebRTCReceiver.kt` — `RTCPeerConnection` receiver + `SurfaceViewRenderer` fullscreen
- `MainActivity.kt` — wires everything, hides status text when stream starts

## Key technical decisions (avoid revisiting)
| Decision | Reason |
|---|---|
| No ES modules in popup | Silent import failures in Brave MV3 |
| `io.getstream:stream-webrtc-android:1.3.10` | `io.github.webrtc-sdk:android:114.x` doesn't exist on Maven Central |
| `androidx.leanback:leanback:1.0.0` | 1.2.0 requires AGP 8.6.0+, we use 8.2.2 |
| AppCompat theme + programmatic fullscreen | Leanback theme adds unnecessary complexity |
| `android.useAndroidX=true` in gradle.properties | Required, was missing initially |

## Build commands
```bash
cd android
export ANDROID_HOME=$HOME/Android  # SDK at ~/Android/
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

## Emulator setup (already configured on this machine)
```bash
source ~/.bashrc  # loads ANDROID_HOME, PATH
emulator -avd FireTV_Test -no-snapshot-load   # AVD name: FireTV_Test
adb install android/app/build/outputs/apk/debug/app-debug.apk
adb forward tcp:8765 tcp:8765                  # critical for emulator
# Extension IP: 127.0.0.1
```

## Ports used
- **8765** — WebSocket signaling (Android server ← Chrome client)

## Next steps
1. Test on real Fire TV (IP from Settings → My Fire TV → About)
2. Publish extension to Chrome Web Store ($5 one-time developer fee)
3. Phase 2: mDNS auto-discovery to avoid manual IP entry
4. Phase 2: D-pad navigation support in the receiver UI
