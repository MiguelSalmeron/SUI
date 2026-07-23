# Sui-2: Tu compañero de productividad 🚀

Sui-2 es una aplicación móvil híbrida diseñada para gestionar el bienestar personal y la productividad. Combina un gestor de metas, seguimiento de hábitos y un temporizador Pomodoro en un solo dashboard limpio y fácil de usar.

## 🛠 Tecnologías Principales
* **Framework:** [React Native](https://reactnative.dev/) a través de [Expo SDK 56](https://expo.dev/)
* **Lenguaje:** TypeScript
* **Backend / Autenticación:** [Firebase Auth](https://firebase.google.com/)
* **Almacenamiento Local:** AsyncStorage

## 📦 Instalación y Configuración

1. **Clonar e instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar Firebase:**
   Crea un archivo `.env` en la raíz del proyecto y agrega tus credenciales de Firebase:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=tu_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=tu_app_id
   ```

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
Esto compilará tu aplicación en la nube de Expo y te devolverá un link de descarga. Para más detalles, revisa la `GUIA-DESARROLLADOR.md`.