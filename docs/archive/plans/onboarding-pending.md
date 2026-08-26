# Pendientes del Módulo Onboarding — Tareas externas / manuales

> Estado al 2026-06-18: código de las 4 fases implementado, typecheck + bundle en verde,
> APK release compilado e instalado en dispositivo (`com.sui.app`). Lo que sigue son
> tareas que **no se pueden resolver solo con código** o que quedaron como deuda técnica.

---

## 🔴 Bloqueantes para que funcione la sincronización en la nube

### 1. Habilitar Anonymous Auth en Firebase Console
- **Dónde:** Firebase Console → tu proyecto → **Authentication** → **Sign-in method** → **Anonymous** → *Enable*.
- **Por qué:** `signInAnonymously()` (Fase 4) falla con `auth/operation-not-allowed` si no está habilitado.
- **Síntoma si falta:** el onboarding **completa igual** en modo local-first, pero queda
  `syncPending = true` y `anonUid = null` (no hay usuario en la nube).
- **Archivo relacionado:** `src/services/onboardingAuth.ts`.

### 2. Reglas de seguridad de Firestore
- **Dónde:** Firebase Console → **Firestore Database** → **Rules**.
- **Por qué:** el guardado del tablero escribe en `users/{uid}` (`src/services/db.ts`).
  Con reglas en modo bloqueado, `saveUserData`/`loadUserData` fallan silenciosamente.
- **Regla mínima sugerida (cada usuario solo su documento):**
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{uid} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
  ```

### 3. Variables de entorno `EXPO_PUBLIC_FIREBASE_*`
- **Estado:** ✅ ya presentes en `.env` y cargadas en el build actual.
- **Ojo:** `.env` está en `.gitignore`. Si alguien clona el repo, debe recrearlo
  con las claves del Firebase web app (ver `src/config/firebase.ts`).

---

## 🟠 Deuda técnica del entorno

### 4. ✅ RESUELTO — Fix de Gradle (foojay) blindado con `patch-package`
- **Qué se cambió:** `@react-native/gradle-plugin/settings.gradle.kts`
  `foojay-resolver-convention` de `0.5.0` → `1.0.0`
  (la 0.5.0 usa `JvmVendorSpec.IBM_SEMERU`, removido en Gradle 9.3.1 que trae RN 0.85).
- **Solución aplicada (2026-06-18):**
  - Patch generado: `patches/@react-native+gradle-plugin+0.85.3.patch` (solo la línea de foojay).
  - `package.json`: devDependency `patch-package@^8.0.1` + script `"postinstall": "patch-package"`.
  - Verificado: tras un `npm install` completo, el `postinstall` reaplica el patch y la línea
    queda en `1.0.0`. El fix ya **sobrevive** a `npm install` / `npm ci`.
- **Acción pendiente (commit):** versionar `patches/@react-native+gradle-plugin+0.85.3.patch`
  y `package.json`. El directorio `patches/` NO está en `.gitignore`. Sin commitear el patch,
  el fix no se propaga a otras máquinas/CI.

### 5. Persistencia de la sesión de Firebase Auth en React Native
- **Síntoma:** `src/config/firebase.ts` usa `getAuth(app)`. En RN, sin
  `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`,
  la sesión anónima **no sobrevive** al cierre de la app (cada reinicio → `currentUser = null`).
- **Impacto actual:** bajo. El gate de onboarding es nuestro store local, así que NO se
  repite el onboarding. Pero la sync con Firestore se salta tras reiniciar (queda local).
- **Acción:** migrar a `initializeAuth` con persistencia de AsyncStorage (afecta a todo el
  proyecto, no solo onboarding → coordinar).

---

## 🟡 Mejoras / fuera de alcance de esta fase (futuro)

### 6. Consolidación de cuenta (login tradicional)
- Las pantallas `LoginScreen` / `RegisterScreen` quedaron **dormidas** (no enrutadas).
- Plan: cuando el usuario quiera "consolidar" su cuenta anónima, usar
  `linkWithCredential` (email/Google) sobre el usuario anónimo para no perder datos.
- Estaba marcado OUT of scope en el plan original.

### 7. Reintento de auth al "detectar red"
- Implementado de forma aproximada: se reintenta **al abrir la app** si `syncPending`
  (`useRetryPendingAuth` en `App.tsx`).
- Mejora real: instalar `@react-native-community/netinfo` y reintentar al recuperar
  conexión en tiempo real (requiere dependencia nueva → no se agregó por alcance).

### 8. Persistir el perfil del onboarding en la nube
- Hoy `nombre / carrera / año / año de nacimiento` se guardan **solo local** (store Zustand).
- Falta: subir el perfil a Firestore (p. ej. `users/{uid}/profile`) cuando hay UID.

---

## ✅ Resumen de qué SÍ quedó funcionando
- Flujo conversacional completo (5 capturas + selección de 3 objetivos).
- Tunneling (no se puede salir hasta completar).
- Guardián de Estado (retoma donde se dejó si se cierra la app) — local.
- Alta anónima disparada al finalizar (depende del punto 1 para llegar a la nube).
- Siembra de las 3 metas elegidas en el tablero Home.
- APK release autónomo instalado en el dispositivo.

## 🚀 Flujo de desarrollo recomendado (sin esperar builds)
- Iteración rápida: `npx expo start --web` (instantáneo, hot-reload).
- En dispositivo con hot-reload: dev build + `npx expo start` (JS por USB, sin recompilar).
- Build nativo (`assembleRelease`) solo para la versión autónoma del teléfono.
