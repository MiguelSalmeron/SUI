# Sui-2: Tu compañero de productividad 🚀

**Sui-2** es una aplicación móvil híbrida orientada al bienestar personal y la productividad diaria. Ayuda al usuario a estructurar su día de manera eficiente integrando tres elementos fundamentales en un único flujo de trabajo:
1. **Metas:** Tareas puntuales del día (To-Do).
2. **Hábitos:** Acciones repetitivas para generar constancia.
3. **Pomodoro:** Bloques de trabajo y descanso enfocado, con una interfaz que minimiza distracciones mediante su "Modo Enfoque" (Pantalla completa).
4. **Chatbot IA (Asistencia Emocional):** Un compañero preventivo en tiempo real (<3s de latencia) con historial temporal local de 48h, streaming por SSE y protocolo inteligente de derivación ante crisis.

Además incorpora una **capa de experiencia (UX) fluida**: pantalla de carga (splash screen) nativa sincronizada con la inicialización, transiciones de pantalla consistentes en iOS y Android, header nativo con retorno claro en el chat y micro-animaciones (fade-in del tablero, escala del botón flotante).

El primer contacto es un **onboarding conversacional sin fricción** (sin correo ni contraseña): captura un perfil básico, configura 3 objetivos de bienestar y crea una sesión anónima en segundo plano. Más detalle técnico en `GUIA-DESARROLLADOR.md`. Ver funcionamiento detallado del asistente en `CHATBOT-IA.md`.

## 🛠 Tecnologías Principales y Stack

* **Framework:** [React Native](https://reactnative.dev/) a través de [Expo SDK 56](https://expo.dev/). Desarrollo multiplataforma con el mismo código base.
* **Lenguaje:** TypeScript
* **Backend y Autenticación:** [Firebase Auth](https://firebase.google.com/) para gestión de identidades. El onboarding usa **Anonymous Auth** (silenciosa); el login email/Google queda para una fase posterior de "consolidar cuenta".
* **Persistencia Híbrida:** 
  * **Almacenamiento Local:** `AsyncStorage` para garantizar funcionamiento offline y carga inmediata de la interfaz (zero-latency).
  * **Sincronización en la Nube:** Cloud Firestore. Todos tus progresos (metas, hábitos, sesiones) se respaldan automáticamente bajo tu usuario. Si cambias de dispositivo, no pierdes nada.
* **Gestión de Estado:** [Zustand](https://zustand-demo.pmnd.rs/) para el temporizador Pomodoro y el estado del onboarding (este último con el middleware `persist` sobre AsyncStorage como "Guardián de Estado").
* **Validación de Formularios:** `react-hook-form` + `Zod`. Esquemas estrictos para un registro y acceso sin errores.
* **Temporizador Resiliente:** Motor matemático basado en Timestamps y el ciclo de vida de la aplicación (`AppState`), garantizando que el Pomodoro calcule los tiempos con precisión absoluta incluso si envías la app a segundo plano.
* **Navegación y UX:** [React Navigation v7](https://reactnavigation.org/) (Native Stack) con transiciones nativas consistentes, y [`expo-splash-screen`](https://docs.expo.dev/versions/v56.0.0/sdk/splash-screen/) para una pantalla de carga nativa que se oculta (con *fade*) solo cuando Firebase Auth y el estado local terminan de cargar — sin destello blanco. Animaciones con la API nativa `Animated`.

## 📦 Instalación y Configuración

1. **Clonar e instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar Firebase:**
   Abre el archivo `.env` en la raíz del proyecto y reemplaza los valores de prueba con tus credenciales reales de la consola de Firebase:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=tu_api_key_aqui
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain_aqui
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id_aqui
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket_aqui
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id_aqui
   EXPO_PUBLIC_FIREBASE_APP_ID=tu_app_id_aqui
   ```

   > **Importante:** habilita **Anonymous** en Firebase Console → *Authentication → Sign-in method*. Sin esto, el onboarding completa solo en local (sin sesión en la nube). Ver `work/PENDIENTES_Onboarding.md`.

## 📱 Cómo probar la aplicación (Testeo)

Tienes dos formas de probar la aplicación en tu celular durante el desarrollo:

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

Si deseas compartir la app como un instalable `.apk` para Android sin usar Expo Go:
```bash
# Requiere tener instalado eas-cli globalmente
eas build --platform android --profile preview
```
Esto compilará tu aplicación en la nube de Expo y te devolverá un link de descarga. Para más detalles técnicos, revisa la `GUIA-DESARROLLADOR.md`.