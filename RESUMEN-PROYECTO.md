# Resumen del Proyecto - SUI 📊

## 🎯 ¿Qué es y cuál es el propósito?
**SUI** es una aplicación orientada al bienestar personal y la productividad diaria de estudiantes universitarios. Ayuda al usuario a estructurar su día integrando cinco ejes en un único flujo de trabajo, organizados como pestañas inferiores (Material Design 3):
1. **Inicio (Overview):** panel central con nivel/XP, racha, progreso diario y accesos rápidos.
2. **Metas:** tareas puntuales del día (To-Do).
3. **Hábitos:** acciones repetitivas para generar constancia.
4. **Pomodoro:** bloques de trabajo y descanso enfocado, con "Modo Enfoque" (pantalla completa).
5. **Resumen (Summary):** estadísticas semanales, gráfico de los últimos 7 días, logros e insight.

Complementa el flujo con un **chatbot de asistencia emocional**, un **resumen nocturno con IA** y un sistema de **gamificación** (XP, niveles, logros, celebraciones).

## 🛠 Justificación del Stack Tecnológico

* **React Native + Expo SDK 56:**
  * *¿Por qué?* Iteración rápida, desarrollo multiplataforma simultáneo (Android e iOS con el mismo código base) y sin código nativo complejo. Ideal para un MVP de productividad donde el diseño de UI es crucial.
* **Firebase (Authentication + Firestore):**
  * *¿Por qué?* Gestión de identidades robusta "out of the box" (Anonymous Auth silenciosa en el onboarding) y sincronización en la nube transparente. Cada documento `users/{uid}` respalda metas, hábitos, Pomodoro, racha, historial semanal y XP.
* **AsyncStorage (Persistencia Local):**
  * *¿Por qué?* Garantiza funcionamiento inmediato (zero-latency) y modo offline total. La app lee el disco local primero y reconcilia con Firestore en segundo plano.
* **Zustand (Gestión de Estado):**
  * *¿Por qué?* Stores pequeños por dominio sin el boilerplate de Redux. Aísla el Pomodoro del árbol de React para que la pantalla no se re-renderice cada segundo.
* **Azure Foundry (gpt-5-mini):**
  * *¿Por qué?* Crédito de Azure for Students ($100 USD) con modelos OpenAI estables. Reemplazó a OpenRouter (free tier agotado). Detalle en `CHATBOT-IA.md`.

## 📈 Estado Actual

La aplicación ha superado la fase de MVP y entrega un producto funcional con sincronización en la nube activa:
1. **Sincronización Firestore:** ✅ Implementada. Metas, hábitos, sesiones Pomodoro, racha, historial semanal y XP se respaldan en `users/{uid}` con reconciliación local-gana-nube (o nube-gana-local según timestamps).
2. **Gamificación:** ✅ Implementada. XP por meta (10), hábito (5) y pomodoro (25); 7 niveles (Novato → Leyenda); 6 logros desbloqueables; `CelebrationToast` + haptics en cada acción.
3. **Dark Mode:** ✅ Implementado. Tres modos (Claro / Oscuro / Sistema) en `SettingsScreen` con persistencia y tokens Material Design 3.
4. **Navegación por tabs:** ✅ Implementada. Bottom Tabs con 5 pantallas + Native Stack para Chat y Settings.
5. **Resumen nocturno con IA:** ✅ Implementado. Notificación programada que abre `NightlyReportModal` con resumen empático del día.
6. **Temporizador Pomodoro resiliente:** ✅ Motor basado en `targetEndTime` (timestamps) + `AppState` para sobrevivir suspensiones de JS en segundo plano.
7. **Asistencia Emocional (Chatbot IA):** ✅ Operativo con Azure Foundry `gpt-5-mini`, streaming SSE, historial local 48h con TTL auto-limpieza, y protocolo de crisis con `EmergencyOverlay`.

## 🗺️ Roadmap Sugerido (Próximos Pasos)

1. **Consolidación de cuenta:** promover la sesión anónima a login email/Google para recuperación跨-dispositivo verificable.
2. **Notificaciones inteligentes:** pasar los stubs de `useSettingsStore` (notificaciones, tamaño de fuente, idioma) a lógica real; el escalado de fuente global y la internacionalización (i18n) son los siguientes pasos.
3. **Background Execution avanzado:** `expo-background-task` para notificaciones de Pomodoro más confiables cuando la app lleve mucho tiempo cerrada.
4. **Expansión de logros:** más logros y "misiones diarias" nuevas para sostener el engagement a 30+ días.
5. **Métricas de bienestar:** integrar preguntas simples de estado de ánimo en el resumen nocturno para correlacionar productividad y bienestar.
