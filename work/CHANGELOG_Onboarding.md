# Changelog — Módulo de Onboarding (SUI)

**Fecha:** 2026-06-18
**Alcance:** Implementación de las 4 fases del plan `work/SUI_Onboarding_Plan.md`
(registro conversacional sin fricción, local-first, tunneling y alta anónima de Firebase).

> Nota de transparencia: este changelog lista **únicamente** los archivos creados/modificados
> por la implementación del onboarding. El árbol de trabajo tenía otros cambios sin commitear
> ajenos a esta tarea (p. ej. `src/components/chat/`, `src/screens/ChatScreen.tsx`, `functions/`,
> el grueso del diff de `HomeScreen.tsx`) que **no** se incluyen aquí.

---

## 🆕 Archivos creados (8 archivos · 1.008 líneas)

| Archivo | Líneas | Descripción |
|---|---:|---|
| `src/types/onboarding.ts` | 99 | Tipos, máquina de pasos (`STEP_ORDER`), catálogo de 8 objetivos de bienestar y esquemas Zod (`nameSchema`, `careerSchema`, `birthYearSchema`). |
| `src/store/useOnboardingStore.ts` | 131 | Store Zustand con middleware `persist` sobre AsyncStorage (Guardián de Estado). Acciones de captura, máquina de estados y `markComplete`. |
| `src/services/onboardingAuth.ts` | 30 | `signInAnon()`: alta anónima de Firebase que nunca lanza; marca `syncPending` si falla (offline). |
| `src/services/homeStorage.ts` | 51 | Clave compartida `sui-home-state-v4`, tipos del tablero y `seedOnboardingGoals()` (idempotente). |
| `src/components/onboarding/ChatBubble.tsx` | 87 | Burbuja de chat (bot/usuario) con avatar. |
| `src/components/onboarding/TypingIndicator.tsx` | 79 | Indicador "escribiendo…" animado (3 puntos). |
| `src/components/onboarding/ChatComposer.tsx` | 121 | Input de texto validado con `react-hook-form` + `zodResolver`. |
| `src/screens/OnboardingScreen.tsx` | 410 | Pantalla conductora: reconstruye el transcript desde el estado, renderiza el control por paso y dispara el cierre (siembra + auth). |
| **Total** | **1.008** | |

## ✏️ Archivos modificados (integración · ~60 líneas netas)

| Archivo | Cambio | Aprox. líneas |
|---|---|---:|
| `App.tsx` | Hook `useRetryPendingAuth`: reintenta el alta anónima al rehidratar si quedó `syncPending`. | +27 |
| `src/navigation/AppNavigator.tsx` | Gate reescrito: conmuta por `onboardingComplete` + `hydrated` (Tunneling) en vez de por `user`. | ~30 (reescrito) |
| `src/screens/HomeScreen.tsx` | Reemplaza el `const HOME_STATE_KEY` local por import desde `services/homeStorage.ts` (fuente única). | ~ +1 / -3 |
| `app.json` | Añade `android.package = "com.sui.app"` (requerido por prebuild). | +1 |

## 📚 Documentación actualizada

| Archivo | Cambio |
|---|---|
| `README.md` | Onboarding como primer contacto, Anonymous Auth, Zustand+persist, nota de habilitar Anonymous. |
| `GUIA-DESARROLLADOR.md` | Árbol de carpetas actualizado, sección "Flujo de Onboarding", y build local de APK vía Gradle + nota foojay. |
| `work/PENDIENTES_Onboarding.md` | (creado antes) Tareas externas: Firebase, reglas Firestore, patch-package, deuda técnica. |
| `work/CHANGELOG_Onboarding.md` | Este documento. |

## 🔧 Fix de entorno (fuera del código de la app)

| Archivo | Cambio | Persistencia |
|---|---|---|
| `node_modules/@react-native/gradle-plugin/settings.gradle.kts` | `foojay-resolver-convention` `0.5.0` → `1.0.0` (resuelve error `IBM_SEMERU` con Gradle 9.3.1). | ✅ Blindado con `patch-package`: `patches/@react-native+gradle-plugin+0.85.3.patch` + `postinstall`. Sobrevive a `npm install`. |

> Cambios adicionales para el blindaje (2026-06-18): `package.json` (devDep `patch-package@^8.0.1`
> + script `postinstall`) y nuevo archivo `patches/@react-native+gradle-plugin+0.85.3.patch`.

---

## 📊 Resumen cuantitativo

- **Código nuevo del feature:** 1.008 líneas (8 archivos).
- **Edición de integración:** ~60 líneas netas (4 archivos).
- **Total aportado por el onboarding:** **≈ 1.070 líneas** de código.
- **Archivos nuevos de código:** 8 · **Archivos de código tocados:** 12.

## ✅ Verificación realizada

- `npx tsc --noEmit` → sin errores.
- `npx expo export --platform android` → bundle OK (1005 módulos).
- `./gradlew assembleRelease` → **BUILD SUCCESSFUL** (APK 74 MB).
- `adb install -r` → **Success**; app lanzada y corriendo en dispositivo (`com.sui.app`).
