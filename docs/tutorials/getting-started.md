# Guía de Inicio Rápido (Getting Started) 🚀

¡Bienvenido al desarrollo de **SUI-2**! Esta guía te llevará paso a paso desde la clonación del repositorio hasta la ejecución de la aplicación en tu propio dispositivo de desarrollo, asegurando que todo funcione con un flujo impecable.

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado lo siguiente en tu máquina de desarrollo:

*   **Node.js** (Versión 20 recomendada LTS).
*   **npm** (Viene con Node.js) o tu gestor de paquetes favorito.
*   **Firebase CLI** (Instalación global: `npm install -g firebase-tools`).
*   **EAS CLI** (Instalación global para compilar APKs: `npm install -g eas-cli`).
*   **Expo Go** en tu dispositivo físico (Android o iOS) o emulador configurado.

---

## 🛠️ Paso 1: Clonación e Instalación de Dependencias

1.  **Clona el repositorio** en tu máquina local:
    ```bash
    git clone <url-del-repositorio>
    cd SIU
    ```

2.  **Instala las dependencias del proyecto**:
    ```bash
    npm install
    ```

    > 💡 **Nota de robustez:** El script `postinstall` ejecutará automáticamente `patch-package` para aplicar el fix de toolchain en `@react-native/gradle-plugin` (resuelve incompatibilidad de Gradle 9 con la JVM). Si ves que se ejecuta `patch-package` en tu terminal, ¡está funcionando perfectamente!

---

## 🔑 Paso 2: Variables de Entorno Locales

La aplicación utiliza variables de entorno mediante archivos `.env` (el cual está protegido en `.gitignore` para no subir credenciales al repositorio público).

1.  Crea un archivo llamado `.env` en la raíz del proyecto.
2.  Agrega el siguiente contenido base (reemplaza los marcadores con tus llaves reales de Firebase):

```env
# Configuración del Cliente Web de Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=tu_api_key_real
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=tu_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=tu_measurement_id

# Endpoint del Proxy del Chat de IA (SSE Cloud Function)
# Deja esto vacío hasta completar la guía de "Despliegue del Proxy de Chat"
EXPO_PUBLIC_CHAT_PROXY_URL=https://chatproxy-xxxxxxxxxx-uc.a.run.app
```

---

## 📱 Paso 3: Ejecución de la Aplicación en Desarrollo

Tienes dos metodologías principales para interactuar y programar con tu app de forma inmediata usando Fast Refresh:

### Método A: Depuración por USB (Altamente Recomendado ⭐)
Es el método más rápido, robusto y eficiente en el día a día.

1.  Conecta tu celular a la PC mediante cable USB.
2.  Habilita las **Opciones de Desarrollador** en tu teléfono (tocando 7 veces "Número de compilación" en Ajustes > Acerca del teléfono).
3.  Enciende la opción **Depuración por USB**.
4.  Inicia la app ejecutando en tu terminal:
    ```bash
    npx expo start --android
    ```
5.  La aplicación se instalará e iniciará sola en tu teléfono vía Expo Go. Los `console.log()` del celular se imprimirán directamente en la consola de tu computadora.

### Método B: Conexión por Wi-Fi (Expo Go)
Ideal para pruebas rápidas de interfaz o demostraciones.

1.  Asegúrate de que tu computadora y tu celular estén conectados a la **misma red Wi-Fi**.
2.  Abre la aplicación **Expo Go** en tu celular.
3.  Inicia el servidor local:
    ```bash
    npx expo start
    ```
4.  Escanea el código QR que se imprime en tu terminal con la cámara de tu celular (o con el lector de Expo Go si usas Android).

---

## 🐛 Menú de Desarrollo y Depuración

*   **Recargar Código (Reload):** Guarda tu archivo de código y el Fast Refresh actualizará la UI al instante. Si hay un bloqueo, agita el dispositivo y pulsa **"Reload"** en el menú flotante de Expo.
*   **Ver Logs de Consola:** Cualquier log o advertencia nativa de JS aparecerá en la terminal donde corre el comando `npx expo start`.

---

## 🏗️ Paso 4: Compilación local de un APK (Alternativa Release)

Si deseas probar la aplicación de forma totalmente autónoma en tu celular Android sin depender del servidor Metro o de Expo Go, puedes realizar un compilado nativo debug/release local:

1.  **Precompila el entorno nativo** (genera la carpeta nativa `/android` temporal):
    ```bash
    npx expo prebuild --platform android
    ```
2.  **Compila el instalable APK** usando el wrapper nativo de Gradle:
    ```bash
    cd android && ./gradlew assembleRelease
    ```
3.  El archivo generado quedará listo para ser transferido o instalado por USB en:
    `android/app/build/outputs/apk/release/app-release.apk`
4.  **Instala directamente vía USB usando ADB**:
    ```bash
    adb install -r app/build/outputs/apk/release/app-release.apk
    ```

---

### 🎉 ¡Listo!
Has inicializado con éxito tu entorno de desarrollo para SUI-2.
*   *Siguiente paso recomendado:* Visita la guía [Configuración del Entorno de Firebase](../how-to/firebase-config.md) para sincronizar tu base de datos y dar de alta el Onboarding Conversacional en la nube.
