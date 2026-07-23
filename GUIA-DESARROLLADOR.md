# Guía del Desarrollador - Sui-2 💻

Esta guía profundiza en la estructura técnica del proyecto y los procesos recomendados para desarrollo, testeo y mantenimiento. La aplicación ha sido construida enfocándose en estabilidad, separación de responsabilidades y persistencia híbrida.

## 📂 Estructura Arquitectónica

El proyecto está diseñado bajo un modelo modular que separa estrictamente la capa de vista de la capa de lógica de negocio y persistencia.

```bash
/src
├── components/chat/       # UI de asistencia emocional (ChatMessage, ChatInput, EmergencyOverlay).
├── components/home/       # Componentes UI: DailyProgress, StreakBadge, LevelCard, AchievementGrid,
│                          #   WeeklyChart, CelebrationToast, NightlyReportModal, HomeListSection, PomodoroPanel.
├── components/onboarding/ # UI conversacional del onboarding (ChatBubble, TypingIndicator, ChatComposer).
├── config/                # Instanciación de Firebase (Auth, Firestore).
├── context/               # AuthContext: Provee el estado global del usuario autenticado.
├── hooks/                 # Custom Hooks (usePomodoroEngine). Separan la lógica del motor del timer.
├── navigation/            # AppNavigator (gate onboarding + Native Stack) y TabNavigator (Bottom Tabs de Home).
├── screens/               # Pantallas orquestadoras: OnboardingScreen, ChatScreen, SettingsScreen,
│                          #   LoginScreen, RegisterScreen (dormidas) y screens/tabs/ (Overview, Goals, Habits, Pomodoro, Summary).
├── services/              # Integración externa: db.ts, homeStorage.ts, gamification.ts, celebration.ts,
│                          #   notifications.ts, greeting.ts, reportPrompt.ts, chatStream.ts, chatPrompt.ts,
│                          #   crisisConfig.ts, crisisDetection.ts, onboardingAuth.ts.
├── store/                 # Stores Zustand por dominio: useHomeStore, usePomodoroStore, useOnboardingStore,
│                          #   useChatStore, useCelebrationStore, useSettingsStore.
├── types/                 # Tipos y esquemas Zod compartidos (onboarding.ts, chat.ts).
└── theme/                 # theme.ts: Design System M3 con ColorScheme claro/oscuro + ThemeController (light/dark/system).
```

## 🔄 Flujo de Datos y Estado

El estado de la aplicación está rigurosamente segmentado para asegurar alto rendimiento y código predecible:

### 1. Autenticación y Formularios
* **Estado Auth:** Manejado 100% por Firebase Auth en `/context/AuthContext.tsx`. Detecta la sesión activa de forma automática.
* **Formularios (Login/Register):** Controlados mediante `react-hook-form` acoplado al validador estricto `Zod` (`@hookform/resolvers/zod`). Previene re-renderizados innecesarios y detiene al usuario antes de hacer requests inválidos a Firebase.

### 2. Persistencia Híbrida (Offline-First + Nube)
Metas, hábitos, sesiones Pomodoro, racha, historial semanal y XP usan una estrategia de doble capa gestionada por `useHomeStore`:
1.  **Carga Inmediata (AsyncStorage):** Al abrir la app, se lee el disco local (clave `sui-home-state-v4`). Si el documento local tiene `lastResetDate` distinto al día actual, el estado de hoy se **reconstruye vacío** (`applyDailyReset`) y el día anterior se congela como `DailySnapshot` en `weeklyHistory`.
2.  **Sincronización Transparente (Firestore):** Si hay sesión y red, `loadState` descarga los datos desde `users/{uid}` (con timeout de 5s para no bloquear la UI). La nube wins en metas/hábitos; la última escritura wins en streak. Cualquier cambio en la UI dispara `saveState` (debounced 400ms), que escribe en disco y en Firebase de forma no bloqueante (`catch(() => undefined)` en fallo de red).
3.  **Reconciliación diaria:** cada vez que cambia el día, `upsertSnapshot` guarda un `DailySnapshot` del día previo (max 14 días) y `computeTotalXp` recalcula el XP total a partir del historial.

### 3. El Motor del Pomodoro (Zustand + Timestamps + AppState)
El temporizador fue refactorizado para soportar la suspensión de hilos JS del sistema operativo móvil:
*   **Zustand:** Mantiene un estado global del Pomodoro fuera del árbol principal de React. Evita que la pantalla entera (`HomeScreen`) se vuelva a renderizar cada segundo.
*   **Timestamps Inmutables:** El temporizador **no resta segundos con `setInterval`**. Al iniciar, calcula un `targetEndTime` (`Date.now() + duración`).
*   **AppState Engine:** El custom hook `usePomodoroEngine` escucha transiciones nativas. Si el usuario minimiza la aplicación (Background) y regresa 10 minutos después (Active), el motor vuelve a calcular `targetEndTime - Date.now()`, reajustando la UI al tiempo correcto y matemático al instante.

### 4. Gamificación y Celebraciones
Capa de motivación construida sobre `services/gamification.ts` y `services/celebration.ts`, sin librerías externas de animación:
*   **XP (Experiencia):** cada meta cumplida da **+10 XP**, cada hábito **+5 XP**, cada Pomodoro finalizado **+25 XP**. El XP total se deriva del `weeklyHistory` (`computeTotalXp`), así es determinista y reconciliable tras reset diarios.
*   **Niveles:** `calculateLevel(xp)` mapea el XP a 7 niveles con títulos — *Novato → Aprendiz → Constante → Enfocado → Disciplinado → Maestro → Leyenda*. El umbral del siguiente nivel escala linealmente (`level * 100`).
*   **Logros:** `getAchievements(ctx)` evalúa 6 logros (`first_goal`, `streak_3`, `streak_7`, `perfect_day`, `pomodoro_5`, `week_active`) a partir del estado actual + `weeklyHistory`. Se muestran en `AchievementGrid` en modo compacto (Overview) y completo (Summary).
*   **Celebraciones:** cada vez que el contador `dailyCompleted` sube, `TabNavigator` invoca `useCelebrationStore.trigger({ kind, subtitle })`. El store dispara haptics (`expo-haptics` — `Success` para perfect_day/pomodoro, `Medium` para goal/habit) y muestra `CelebrationToast` (animación spring translateY + fade, auto-hide 2200ms). El "Día perfecto" solo se celebra una vez por sesión (`perfectDayShown` ref).
*   **Estadísticas:** `WeeklyChart` dibuja barras de los últimos 7 días con `getCompletionRate`, coloreadas por umbral (≥80% success, ≥50% primary, resto secondary). `getWeeklyInsight` genera un mensaje textual adaptativo según promedio, pomodoros y días activos.

## 🚪 Flujo de Onboarding (Registro sin fricción)

El primer contacto con la app es un **onboarding conversacional** que reemplaza el login
tradicional para evitar el abandono prematuro. No pide correo ni contraseña.

* **Gate de navegación (Tunneling):** `AppNavigator` ya **no** conmuta por `user`, sino por
  `onboardingComplete` del store `useOnboardingStore`. Mientras sea `false`, la única ruta
  disponible es `Onboarding` (con `gestureEnabled:false` para impedir el swipe-back). Las
  pantallas `Login`/`Register` quedan **dormidas** para una futura fase de "consolidar cuenta".
  Mientras `loading` (Firebase Auth) o `!hydrated` (Zustand) siguen pendientes, `AppNavigator`
  **renderiza `null`** y deja visible el splash nativo (ver "Experiencia de Inicio").
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

## ✨ Experiencia de Inicio, Navegación y Animaciones (UX)

Capa de pulido visual construida solo con herramientas nativas (sin Lottie ni Reanimated):

### Splash screen nativa
* **(`expo-splash-screen`):** Configurado vía *config plugin* en `app.json`
  (método recomendado desde SDK 56; la clave legacy `"splash"` quedó obsoleta). Usa
  `assets/icon.png` (160px width, `resizeMode: contain`) sobre `backgroundColor: #0047AB`.
  * `App.tsx` llama `SplashScreen.preventAutoHideAsync()` y `SplashScreen.setOptions({ duration: 350, fade: true })`
    en **scope global** (sin `await`), según la recomendación oficial: dentro de un componente
    podría ejecutarse demasiado tarde.
  * `AppNavigator` llama `SplashScreen.hideAsync()` solo cuando `ready = hydrated && (!loading || authTimedOut)`.
    Hay dos timeouts de respaldo: 8s para Firebase Auth y 4s para la rehidratación de Zustand,
    para no quedar pegado en splash si un servicio externo no responde.
  * ⚠️ **El splash nativo no se replica completo en Expo Go** (limitación SDK 52+). Para verlo
    tal cual lo verá el usuario, prueba con un *development/release build* (`npx expo run:android`),
    no con Expo Go.

### Navegación: Native Stack + Bottom Tabs
* **Nivel raíz (`AppNavigator`):** un único `Stack.Navigator` conmuta por `onboardingComplete`.
  Si `!onboardingComplete` solo existe la ruta `Onboarding` (con `gestureEnabled:false` y `animation:'fade'`).
  Si `onboardingComplete`, montan Home (`TabNavigator`), Chat y Settings, con
  `animation: 'slide_from_right'` (280ms) homogéneo en iOS y Android.
* **Nivel Home (`TabNavigator`):** Bottom Tabs de 5 pantallas — Overview, Goals, Habits, Pomodoro, Summary.
  * Header compartido (`TabHeader`) con fecha, saludo (`buildGreeting`) y botón Settings.
  * `tabBarIcon` con badges numéricos en Goals/Habits cuando hay pendientes.
  * `animation: 'fade'` al cambiar de tab.
  * **FAB "Hablar con SUI"** flotante que abre el Chat, con escala `spring` (0.92) al presionar.
* **Header nativo del chat:** `ChatScreen` ya **no** dibuja un header manual. El Native Stack
  provee la flecha de retorno nativa (`headerBackTitle: 'Inicio'`); la acción "Limpiar" se inyecta
  con `navigation.setOptions({ headerRight })` en un `useLayoutEffect`.

## 🎨 Guía de Estilos y Tema (`theme.ts`)

El Design System sigue Material Design 3 con dos `ColorScheme` completos (claro y oscuro) y un `ThemeController` que persiste el modo elegido en AsyncStorage (`sui-theme-mode`):

* **Modos soportados:** `light` | `dark` | `system` (este último sigue a `Appearance`).
* **Acceso a colores:** `useAppTheme().colors` da el `ColorScheme` activo; **nunca uses códigos hex sueltos en componentes**.
* **Controller:** `useThemeController()` expone `mode`, `setMode(mode)`, `toggle()` y `followSystem()`.
* **Tokens clave:** `COLORS.primary` (brand), `COLORS.secondary` (acentos), `COLORS.background` (fondos de pantalla), `COLORS.surface` / `surfaceContainer` / `surfaceContainerHigh` (tarjetas M3), `COLORS.success` / `error` / `outlineVariant`, `SPACING.{xs|sm|md|lg|xl}` (`md`=16px estándar).

### Pantalla de Ajustes (`SettingsScreen` + `useSettingsStore`)
Hub de configuración del usuario, accesiblefrom el botón 🛠 del header. Persiste en AsyncStorage (`@sui/settings-v1`):
* **Apariencia:** Modo de tema (Claro/Oscuro/Sistema cíclico) y Tamaño de fuente (small/medium/large cíclico).
* **General:** toggles de Notificaciones (`expo-notifications` se inicializa en mount).
* **Cuenta:** Cerrar sesión (`signOut` de Firebase) con alerta de confirmación.
* > Nota: `notificationsEnabled`, `fontSize` y `language` son **stubs de UI** por ahora (escala global e i18n pendientes, ver roadmap en `RESUMEN-PROYECTO.md`).

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
- **Proveedor:** **Azure OpenAI Foundry** (modelo `gpt-5-mini`, reasoning effort low). Reemplazó a OpenRouter en jul 2026 (free tier agotado). Detalle completo en `CHATBOT-IA.md`.
- **Streaming de Respuestas (SSE):** Consume una Cloud Function `chatProxy` segura que actúa de puente entre la app móvil y Azure. La API Key vive en Firebase Secret Manager (`AZURE_OPENAI_API_KEY`) y **nunca** se incluye en el bundle móvil. Usa `react-native-sse` para evadir las limitaciones de stream nativo de Hermes en React Native.
- **Privacidad Local:** El historial conversacional no toca Firestore; vive únicamente en `AsyncStorage` (clave `sui-chat-v1`) mediante un store Zustand persistente, con caducidad estricta de 48 horas (`CHAT_TTL_MS = 172800000`) auto-limpieza activa.
- **Contexto Híbrido:** el perfil del onboarding (nombre, carrera, año de estudio, edad aprox., metas) se inyecta como *ficha emocional* en el `system prompt`; solo se envían los últimos 10 mensajes del historial (ventana deslizable).
- **Protocolo de Crisis:** antes de enviar el mensaje, el cliente detecta con Regex insensible a acentos señales de crisis inmediata. Si hay match, se lanza `EmergencyOverlay` con botones de llamada rápida a líneas de auxilio locales.
- **Configuración Dinámica:** el diccionario de palabras críticas y contactos telefónicos se sincronizan desde el documento Firestore `app_config/crisis`, con un `DEFAULT_CRISIS_CONFIG` offline como respaldo para que la seguridad nunca falle.

## 🌙 Resumen Nocturno con IA

`OverviewScreen` programa una notificación local a las 21:30 (`scheduleNightlyReport` en `services/notifications.ts`) que, al abrirse, lanza `NightlyReportModal` con un resumen empático del día generado por la misma Cloud Function `chatProxy` (prompt armado por `services/reportPrompt.ts` a partir de metas/hábitos pendientes y completados). La respuesta se reproduce en streaming dentro del modal, reutilizando el motor SSE del chatbot.

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