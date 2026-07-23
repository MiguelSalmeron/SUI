# SUI: Tu compañero de productividad y bienestar 🚀

**SUI** (antes *Sui-2*) es una aplicación móvil híbrida orientada al bienestar personal y la productividad diaria de estudiantes universitarios. Ayuda al usuario a estructurar su día de manera eficiente integrando cinco ejes en un mismo flujo de trabajo, organizados como pestañas inferiores (Material Design 3):

1. **Inicio (Overview):** PANEL central con nivel/XP, racha, progreso diario, métricas rápidas y accesos directos.
2. **Metas:** Tareas puntuales del día (To-Do).
3. **Hábitos:** Acciones repetitivas para generar constancia.
4. **Pomodoro:** Bloques de trabajo y descanso enfocado, con "Modo Enfoque" (pantalla completa) que minimiza distracciones.
5. **Resumen (Summary):** Estadísticas semanales, gráfico de los últimos 7 días, logros e insight generado por la app.

Además incorpora:

- **Gamificación completa:** sistema de XP, niveles (de *Novato* a *Leyenda*), 6 logros desbloqueables y celebraciones con `CelebrationToast` + haptics (`expo-haptics`).
- **Chatbot IA (Asistencia Emocional):** un compañero preventivo en tiempo real (<3s de latencia) con historial temporal local de 48h, streaming por SSE y protocolo inteligente de derivación ante crisis. Detalle en `CHATBOT-IA.md`.
- **Resumen nocturno con IA:** notificación programada que abre un modal (`NightlyReportModal`) con un resumen empático del día.
- **Hub de Ajustes:** pantalla `SettingsScreen` con modo de tema (Claro / Oscuro / Sistema), tamaño de fuente, notificaciones y cierre de sesión.
- **Capa UX fluida:** splash screen nativa sincronizada con la inicialización, transiciones de pantalla consistentes en iOS y Android, header nativo con retorno claro en el chat y micro-animaciones (fade-in del tablero, escala del botón flotante, barra animada de la pestaña activa).

El primer contacto es un **onboarding conversacional sin fricción** (sin correo ni contraseña): captura un perfil básico, configura 3 objetivos de bienestar y crea una sesión anónima en segundo plano. Más detalle técnico en `GUIA-DESARROLLADOR.md`.

## 🛠 Tecnologías Principales y Stack

* **Framework:** [React Native](https://reactnative.dev/) a través de [Expo SDK 56](https://expo.dev/). Desarrollo multiplataforma con el mismo código base.
* **Lenguaje:** TypeScript estricto (sin `any`).
* **Backend y Autenticación:** [Firebase Auth](https://firebase.google.com/) con **Anonymous Auth** silenciosa en el onboarding; email/Google queda para una fase posterior de "consolidar cuenta".
* **Persistencia Híbrida (Offline-First + Nube):**
  * **Almacenamiento Local:** `AsyncStorage` para garantizar funcionamiento offline y carga inmediata de la interfaz (zero-latency).
  * **Sincronización en la Nube:** Cloud Firestore. Metas, hábitos, sesiones Pomodoro, racha, historial semanal y XP se respaldan automáticamente bajo `users/{uid}`. Si cambias de dispositivo, no pierdes nada.
* **Gestión de Estado:** [Zustand](https://zustand-demo.pmnd.rs/) con stores separados por dominio (`useHomeStore`, `usePomodoroStore`, `useOnboardingStore`, `useChatStore`, `useCelebrationStore`, `useSettingsStore`). El store de onboarding y ajustes usan el middleware `persist` sobre AsyncStorage.
* **Validación de Formularios:** `react-hook-form` + `Zod`. Esquemas estrictos para un registro y acceso sin errores.
* **Temporizador Resiliente:** Motor matemático basado en Timestamps y el ciclo de vida de la aplicación (`AppState`), garantizando que el Pomodoro calcule los tiempos con precisión absoluta incluso si envías la app a segundo plano.
* **Navegación y UX:** [React Navigation v7](https://reactnavigation.org/) — Native Stack en el nivel raíz (Onboarding / Home / Chat / Settings) y Bottom Tabs dentro de Home, con transiciones nativas consistentes. [`expo-splash-screen`](https://docs.expo.dev/versions/v56.0.0/sdk/splash-screen/) para una pantalla de carga nativa que se oculta (con *fade*) solo cuando Firebase Auth y el estado local terminan de cargar — sin destello blanco. Animaciones con la API nativa `Animated`.
* **Haptics y Notificaciones:** `expo-haptics` para feedback de celebraciones y `expo-notifications` para el resumen nocturno y recordatorios.

## 📦 Instalación y Configuración

1. **Clonar e instalar dependencias:**
   ```bash
   npm install
   ```
   > El `postinstall` ejecuta `patch-package` para persistir un fix de toolchain Gradle (ver `GUIA-DESARROLLADOR.md` → "Build local de APK").

2. **Configurar Firebase (app móvil):**
   Abre el archivo `.env` en la raíz del proyecto y reemplaza los valores de prueba con tus credenciales reales de la consola de Firebase:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=tu_api_key_aqui
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain_aqui
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id_aqui
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket_aqui
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id_aqui
   EXPO_PUBLIC_FIREBASE_APP_ID=tu_app_id_aqui
   EXPO_PUBLIC_CHAT_PROXY_URL=https://tu_chatproxy.a.run.app
   ```
   > **Importante:** habilita **Anonymous** en Firebase Console → *Authentication → Sign-in method*. Sin esto, el onboarding completa solo en local (sin sesión en la nube). Ver `CONFIGURACION-PENDIENTE.md` para el checklist completo.

## 📱 Cómo probar la aplicación (Testeo)

Tienes dos formas de probar la aplicación en tu celular durante el desarrollo.

### Checks automatizados

Antes de abrir un PR o desplegar, ejecuta:

```bash
npm run check
```

Este comando valida TypeScript estricto de la app, ejecuta los tests unitarios
críticos y compila las Cloud Functions. También puedes correr cada etapa por
separado:

```bash
npm run typecheck
npm test
npm run functions:build
```

La CI de GitHub replica estos mismos pasos en cada push a `main`/`master` y en
cada pull request.

### Método 1: Depuración por USB (Recomendado ⭐)
Es el método más rápido, estable y el que mejor rendimiento ofrece al desarrollar.
1. Conecta tu celular a la PC mediante cable USB.
2. Asegúrate de tener activada la **Depuración USB** en las opciones de desarrollador de tu celular.
3. Ejecuta el siguiente comando:
   ```bash
   npx expo start --android
   ```
4. La app se instalará e iniciará automáticamente en tu teléfono mediante Expo Go. Los cambios en el código se reflejarán al instante de guardar (Fast Refresh).

### Método 2: Mediante Wi-Fi (Expo Go)
Ideal si quieres mostrarle la app rápidamente a alguien en la misma habitación.
1. Descarga la app **Expo Go** en tu celular (desde Play Store o App Store).
2. Ejecuta el servidor:
   ```bash
   npx expo start
   ```
3. Escanea el código QR que aparece en tu terminal con la cámara de tu celular (o desde la app de Expo Go si usas Android). Ambos dispositivos deben estar en la **misma red Wi-Fi**.

## 🏗️ Generar APK para Producción

Existen dos rutas:

### A) Build en la nube con EAS
```bash
# Requiere tener instalado eas-cli globalmente
eas build --platform android --profile preview
```
Esto compilará tu aplicación en la nube de Expo y te devolverá un link de descarga. Para más detalles técnicos, revisa `GUIA-DESARROLLADOR.md`.

### B) Build local con Gradle (APK autónomo, sin Metro)
```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```
Detalle y fix de toolchain en `GUIA-DESARROLLADOR.md` → "Build local de APK".
