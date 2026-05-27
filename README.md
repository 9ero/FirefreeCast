# FireCast

Transmite la pestaña de tu navegador a un Fire TV mediante WebRTC — gratis, red local, sin suscripción.

Alternativa a AirScreen Premium. Funciona desde cualquier Chrome o Brave en la misma red WiFi.

## Cómo funciona

```
Navegador (Chrome/Brave)                  Fire TV / Android TV
┌──────────────────────┐                 ┌────────────────────────┐
│   Extensión FireCast │                 │    App FireCast Android│
│                      │  WebSocket      │                        │
│  tabCapture API      │────:8765───────►│  SignalingServer       │
│  RTCPeerConnection   │◄───────────────►│  WebRTCReceiver        │
│  (emisor)            │  WebRTC P2P     │  SurfaceViewRenderer   │
└──────────────────────┘  (vídeo+audio)  └────────────────────────┘
```

## Estructura del proyecto

```
firecast/
├── extension/               Extensión Chrome/Brave (Manifest V3)
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html       Interfaz: campo IP + botón Cast
│   │   └── popup.js        Captura → WebRTC → señalización (todo en uno, sin ES modules)
│   └── src/
│       ├── service_worker.js
│       ├── signaling-client.js   Cliente WebSocket hacia el TV
│       └── webrtc-sender.js      RTCPeerConnection emisor
│
└── android/                 App Android TV / Fire TV (Kotlin)
    └── app/src/main/java/dev/firecast/receiver/
        ├── MainActivity.kt
        ├── WebRTCReceiver.kt     RTCPeerConnection + SurfaceViewRenderer
        └── SignalingServer.kt    Servidor WebSocket en :8765
```

---

## Requisitos previos

| Herramienta | Versión | Notas |
|---|---|---|
| JDK | 17 | `sudo apt install openjdk-17-jdk` |
| Android SDK | 34 | Instalar con las herramientas de línea de comandos (ver abajo) |
| Chrome o Brave | Cualquier versión moderna | Para la extensión |
| Fire TV o Android TV | API 25+ | Dispositivo destino |

---

## Parte 1 — App Android

### Instalar Android SDK (solo la primera vez)

```bash
# 1. Descarga las herramientas de línea de comandos desde:
#    https://developer.android.com/studio#command-line-tools-only
#    Extrae el contenido en ~/Android/cmdline-tools/latest/

# 2. Añadir al ~/.bashrc
export ANDROID_HOME=$HOME/Android
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

source ~/.bashrc

# 3. Instalar componentes del SDK
yes | sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### Compilar

```bash
cd android
./gradlew assembleDebug
```

APK generado en: `android/app/build/outputs/apk/debug/app-debug.apk`

### Instalar en Fire TV real

```bash
# En el Fire TV: Ajustes → Mi Fire TV → Opciones de desarrollador
#   → Depuración ADB: ACTIVADO
#   → Aplicaciones de orígenes desconocidos: ACTIVADO

adb connect <ip-del-firetv>
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Instalar en emulador Android TV

```bash
# Crear emulador (solo la primera vez)
yes | sdkmanager "emulator" "system-images;android-31;android-tv;x86"
avdmanager create avd -n "FireTV_Test" -k "system-images;android-31;android-tv;x86" --device "tv_1080p"

# Iniciar el emulador (mantener esta terminal abierta)
emulator -avd FireTV_Test -no-snapshot-load

# En una segunda terminal — instalar y redirigir el puerto de señalización
adb install android/app/build/outputs/apk/debug/app-debug.apk
adb forward tcp:8765 tcp:8765
```

---

## Parte 2 — Extensión de Chrome

1. Abre `brave://extensions` (Brave) o `chrome://extensions` (Chrome)
2. Activa el interruptor **"Modo de desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar extensión sin empaquetar"**
4. Selecciona la carpeta `extension/` de este repositorio
5. El icono de FireCast aparece en la barra de herramientas del navegador

---

## Uso

1. Abre la app **FireCast** en el Fire TV (muestra una pantalla de espera)
2. Haz clic en el **icono de FireCast** en la barra de herramientas del navegador
3. Introduce la dirección IP:
   - Fire TV real: la IP local del TV (Ajustes → Mi Fire TV → Acerca de)
   - Emulador: `127.0.0.1` (el puerto está redirigido por ADB)
4. Haz clic en **"Iniciar Cast"**
5. La pestaña del navegador aparece en pantalla completa en el TV

Para detener: haz clic en el icono de FireCast → **"Detener Cast"**

---

## Solución de problemas

| Problema | Solución |
|---|---|
| La extensión muestra error inmediatamente | Clic derecho en el popup → Inspeccionar → revisar la pestaña Consola |
| "No se pudo capturar la pestaña" | Asegúrate de que hay una pestaña real activa (no la página de nueva pestaña) |
| La conexión expira | Verifica que `adb forward tcp:8765 tcp:8765` está activo |
| Pantalla negra en el TV | Revisa logcat: `adb logcat -s WebRTCReceiver:*` |
| Puerto 8765 no responde | Reinicia la app FireCast en el TV |

---

## Proyecto relacionado

[chrome-emulator](../chrome-emulator) — emulador experimental del protocolo Cast v2 (no requiere extensión de navegador, pero bloqueado por la autenticación de certificado de Google).
