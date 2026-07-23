# Guía del Desarrollador - Sui-2 💻

Esta guía profundiza en la estructura técnica del proyecto y los procesos recomendados para desarrollo, testeo y mantenimiento. La aplicación ha sido construida enfocándose en estabilidad, separación de responsabilidades y persistencia híbrida.

## 📂 Estructura Arquitectónica

El proyecto está diseñado bajo un modelo modular que separa estrictamente la capa de vista de la capa de lógica de negocio y persistencia.

```bash
/src
├── components/chat/       # UI de asistencia emocional (ChatMessage, ChatInput, EmergencyOverlay).
├── components/home/       # Componentes UI especializados (Listas, Navbar, Pomodoro) sin estado complejo.
├── components/onboarding/ # UI conversacional del onboarding (ChatBubble, TypingIndicator, ChatComposer).
├── config/                # Instanciación de Firebase (Auth, Firestore).
├── context/               # AuthContext: Provee el estado global del usuario autenticado.
├── hooks/                 # Custom Hooks (useGoals, useHabits, usePomodoroEngine). Separan la lógica CRUD.
├── navigation/            # AppNavigator: gate por estado de onboarding (Tunneling) y rutas.
├── screens/               # Pantallas orquestadoras (Onboarding, Home, Login, Register, ChatScreen).
├── services/              # Integración externa (db.ts, onboardingAuth.ts, chatStream.ts, crisisConfig.ts).
├── store/                 # Stores Zustand (usePomodoroStore.ts, useOnboardingStore.ts, useChatStore.ts).
├── types/                 # Tipos y esquemas Zod compartidos (onboarding.ts, chat.ts).
└── theme/                 # theme.ts: Tokens globales de color y espaciado (Design System).
```

## 🔄 Flujo de Datos y Estado

El estado de la aplicación está rigurosamente segmentado para asegurar alto rendimiento y código predecible:

### 1. Autenticación y Formularios
* **Estado Auth:** Manejado 100% por Firebase Auth en `/context/AuthContext.tsx`. Detecta la sesión activa de forma automática.
* **Formularios (Login/Register):** Controlados mediante `react-hook-form` acoplado al validador estricto `Zod` (`@hookform/resolvers/zod`). Previene re-renderizados innecesarios y detiene al usuario antes de hacer requests inválidos a Firebase.

### 2. Persistencia Híbrida (Offline-First + Nube)
Los hábitos, metas y configuraciones del temporizador utilizan una estrategia de doble capa:
1.  **Carga Inmediata (AsyncStorage):** Al abrir la app, se lee inmediatamente el disco local (`sui-home-state-v4`).
2.  **Sincronización Transparente (Firestore):** Si hay sesión y red, `HomeScreen` descarga los datos desde `users/{uid}` en Firestore. Si difieren, gana la nube. Cualquier cambio en la UI se guarda simultáneamente en disco y en Firebase (`saveUserData` en `services/db.ts`).

### 3. El Motor del Pomodoro (Zustand + Timestamps + AppState)
El temporizador fue refactorizado para soportar la suspensión de hilos JS del sistema operativo móvil:
*   **Zustand:** Mantiene un estado global del Pomodoro fuera del árbol principal de React. Evita que la pantalla entera (`HomeScreen`) se vuelva a renderizar cada segundo.
*   **Timestamps Inmutables:** El temporizador **no resta segundos con `setInterval`**. Al iniciar, calcula un `targetEndTime` (`Date.now() + duración`).
*   **AppState Engine:** El custom hook `usePomodoroEngine` escucha transiciones nativas. Si el usuario minimiza la aplicación (Background) y regresa 10 minutos después (Active), el motor vuelve a calcular `targetEndTime - Date.now()`, reajustando la UI al tiempo correcto y matemático al instante.

## 🚪 Flujo de Onboarding (Registro sin fricción)

El primer contacto con la app es un **onboarding conversacional** que reemplaza el login
tradicional para evitar el abandono prematuro. No pide correo ni contraseña.

* **Gate de navegación (Tunneling):** `AppNavigator` ya **no** conmuta por `user`, sino por
  `onboardingComplete` del store `useOnboardingStore`. Mientras sea `false`, la única ruta
  disponible es `Onboarding` (con `gestureEnabled:false` para impedir el swipe-back). Las
  pantallas `Login`/`Register` quedan **dormidas** para una futura fase de "consolidar cuenta".
* **Guardián de Estado:** `useOnboardingStore` usa el middleware `persist` de Zustand sobre
  `AsyncStorage` (clave `sui-onboarding-v1`). Cada respuesta se persiste al instante, así que
  si la app se cierra a mitad del registro, retoma exactamente donde se dejó. El flag en memoria
  `hydrated` (vía `onRehydrateStorage`) evita parpadeos hasta terminar de rehidratar.
* **Máquina de estados:** los pasos viven en `STEP_ORDER` (`types/onboarding.ts`):
  `welcome → name → career → studyYear → birthYear → goals → submitting → done`.
  El transcript del chat se **reconstruye de forma determinista** desde el estado persistido,
  no se guarda como historial.
* **Captura validada:** los campos de texto usan `react-hook-form` + `Zod` mediante el
  componente reutilizable `ChatComposer` (esquemas `nameSchema`, `careerSchema`, `birthYearSchema`).
* **Alta anónima (Firebase):** al llegar a `submitting`, `services/onboardingAuth.ts` dispara
  `signInAnonymously()`. **Nunca lanza**: si falla (offline), completa igual en local y marca
  `syncPending = true`; `App.tsx` reintenta al reabrir la app.
* **Siembra de metas:** las 3 metas de bienestar elegidas se escriben en el estado del tablero
  (`services/homeStorage.ts`, clave compartida `sui-home-state-v4`) para que aparezcan en Home.

> ⚠️ Requiere habilitar **Anonymous** en Firebase Console → Authentication → Sign-in method.
> Ver `work/PENDIENTES_Onboarding.md` para el detalle de tareas externas.

## 🎨 Guía de Estilos (`theme.ts`)
Para mantener coherencia visual, **nunca uses códigos hexadecimales sueltos en los componentes**. Utiliza el objeto `COLORS` y `SPACING` exportado de `theme.ts`:
* `COLORS.primary`: Botones principales, brand principal.
* `COLORS.secondary`: Acentos y estados activos alternativos.
* `COLORS.background`: Fondos generales de pantalla.
* `SPACING.md`: Espaciado estándar (16px).

---

## 🐞 Workflow Avanzado de Pruebas y Depuración

El desarrollo móvil eficiente con Expo requiere entender cómo funciona el "Fast Refresh" y la depuración USB.

### Configuración para Depuración USB (Android)
1. Ve a **Ajustes > Acerca del teléfono**.
2. Toca 7 veces el **Número de compilación** para activar el modo de desarrollador.
3. Ve a las **Opciones de desarrollador** recién activadas.
4. Enciende **Depuración por USB**.
5. Conecta el teléfono y autoriza la huella RSA de la computadora.

### Uso y Logs (`console.log`)
Al correr `npx expo start --android` con el cable USB conectado:
* Los `console.log()`, `console.warn()` o errores de Javascript que ocurran en tu celular se imprimirán directamente **en la terminal de tu computadora**.
* Si la app lanza un error de pantalla roja en el teléfono, puedes recargar manualmente agitando el dispositivo para abrir el menú de desarrollo de Expo y seleccionando "Reload".

---

## 📦 Workflow de Producción (Generar Instalables con EAS)

Expo Application Services (EAS) se utiliza para empaquetar la app.

### 1. Configuración Inicial (Solo una vez)
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### 2. Generar el APK para compartir (.apk)
Por defecto, Android requiere formato `.aab` para la Play Store. Para generar un `.apk` directo que puedas compartir para pruebas o distribución manual:
```bash
eas build --platform android --profile preview
```
Al finalizar, EAS CLI arrojará un código QR y un enlace directo a la nube de Expo para descargar el archivo.

### 3. Generar para iOS
*Requiere cuenta de Apple Developer de pago ($99/año).*
```bash
eas build --platform ios
```

---

## 🤖 Chatbot de IA (Asistencia Emocional)

El módulo de Chatbot de IA se integra como un servicio conversacional de acompañamiento de salud mental para los estudiantes. Las claves de su diseño son:
- **Streaming de Respuestas (SSE):** Consume una Cloud Function `chatProxy` segura que actúa de puente entre la app móvil y OpenRouter para proteger las credenciales. Usa `react-native-sse` para evadir las limitaciones de stream nativo de Hermes en React Native.
- **Privacidad Local:** El historial conversacional no toca la base de datos Firestore; vive únicamente en `AsyncStorage` mediante un store Zustand persistente, y posee una caducidad estricta de 48 horas (`CHAT_TTL_MS = 172800000`) que se auto-limpia activamente.
- **Lógica de Protocolo de Crisis:** Antes de enviar el mensaje, el cliente utiliza detección de expresiones regulares (Regex) insensible a acentos para buscar señales de crisis inmediata. Si se detecta una coincidencia, se interrumpe el flujo y se lanza un modal interactivo (`EmergencyOverlay`) con botones de llamada rápida a líneas de auxilio locales.
- **Configuración Dinámica:** El diccionario de palabras críticas y contactos telefónicos se sincronizan desde el documento `app_config/crisis` en Firestore, permitiendo actualizaciones de emergencia en tiempo real sin requerir una compilación de la app.

Ver detalles exhaustivos de su funcionamiento y flujo de datos en `CHATBOT-IA.md`.

---

## 🔧 Build local de APK (sin EAS, vía Gradle)

Alternativa al build en la nube, útil para instalar directo por USB un APK autónomo
(JS empaquetado, no depende de Metro):

```bash
# 1. Generar el proyecto nativo (crea ./android)
npx expo prebuild --platform android

# 2. Compilar el APK release (firma debug por defecto)
cd android && ./gradlew assembleRelease

# 3. Instalar en el dispositivo conectado
adb install -r app/build/outputs/apk/release/app-release.apk
```
El APK queda en `android/app/build/outputs/apk/release/app-release.apk`.

> ⚠️ **Fix de toolchain requerido (RN 0.85 / Gradle 9.3.1):** el plugin
> `@react-native/gradle-plugin` pinea `foojay-resolver-convention 0.5.0`, que usa
> `JvmVendorSpec.IBM_SEMERU` (removido en Gradle 9) y rompe el build. Hay que subirlo a
> `1.0.0`. Como vive en `node_modules`, debe persistirse con `patch-package` para que no se
> pierda en el próximo `npm install`. Detalle en `work/PENDIENTES_Onboarding.md`.