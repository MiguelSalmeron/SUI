# Roadmap operativo

Checklist **humano** (consolas Firebase / Google Cloud). El código de la app ya está en el repo.

**Estado código (repo):** listo — `googleAuth` + `useGoogleAuth` + Settings «Vincular» + Onboarding «Continuar con Google» + tests.  
**Estado consola:** pendiente hasta marcar los ítems abajo.  
**No incluido en este push:** `firebase deploy` (hosting). Cuando tengas Client IDs, exporta web y despliega tú.

Marca cada ítem al completarlo.

---

## 0. Ya hecho en código (no tocar consola)

- [x] `expo-auth-session` / `expo-web-browser` / `expo-crypto`
- [x] `src/features/auth/services/googleAuth.ts` — link anónimo o `signInWithCredential`
- [x] `src/features/auth/hooks/useGoogleAuth.ts` — id_token + anti doble-tap + fallback clientId
- [x] Settings: Vincular / badge Google / modales
- [x] Onboarding welcome: Continuar con Google + `GoogleSignInButton`
- [x] `.env.example` con `EXPO_PUBLIC_GOOGLE_*`
- [x] Scheme deep link `sui` en `app.json`
- [x] Tests unitarios `googleAuth`

---

## 1. Firebase Authentication — proveedor Google

- [ ] Abre [Firebase Console](https://console.firebase.google.com/) → proyecto SUI (`xsui-nica` / el que uses).
- [ ] **Build → Authentication → Sign-in method**.
- [ ] Habilita el proveedor **Google**.
- [ ] Guarda el **correo de soporte** del proyecto si te lo pide.
- [ ] Confirma que **Anonymous** sigue habilitado (onboarding sin fricción).

## 2. Google Cloud — OAuth consent + Client IDs

- [ ] Misma cuenta Cloud vinculada a Firebase: [Credentials](https://console.cloud.google.com/apis/credentials).
- [ ] **OAuth consent screen** (External/Internal): app `SUI`, email soporte, scopes `email` / `profile` / `openid`.
- [ ] **OAuth client → Web application** (`SUI Web`):
  - Origins: `http://localhost:8081`, `http://localhost:19006`, `https://xsui.web.app`, auth domain Firebase.
  - Redirect URIs: los que Expo Auth Session muestre al probar (PWA origin + `https://auth.expo.io/...` si Expo Go).
- [ ] Copia **Web Client ID** → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (`.env` + EAS secrets).

## 3. Android (APK / EAS)

- [ ] SHA-1 / SHA-256 debug:
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
  ```
- [ ] Firebase → app Android `com.sui.app` → **Add fingerprint**.
- [ ] OAuth client **Android** (`com.sui.app` + SHA-1).
- [ ] `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` en `.env` / EAS.
- [ ] Sin Android Client ID la app cae al Web Client (fallback). **Producción APK: Client Android + SHA obligatorios.**
- [ ] Release: SHA de **Play App Signing**.
- [ ] (Opcional) `google-services.json` actualizado.

## 4. iOS (cuando compiles iOS)

- [ ] OAuth client **iOS** + Bundle ID (`app.json` / Xcode).
- [ ] `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- [ ] URL scheme invertido del client iOS si Google lo pide.

## 5. Dominios autorizados (Auth)

- [ ] Firebase → Authentication → **Settings → Authorized domains**.
- [ ] Incluir: `localhost`, `xsui.web.app`, `*.firebaseapp.com` del proyecto.

## 6. Variables de entorno

Plantilla: [`.env.example`](../.env.example)

- [ ] Rellenar en `.env` local:
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=`
  - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=`
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=`
- [ ] EAS / CI: mismos secrets + **rebuild** (`EXPO_PUBLIC_*` = build time).
- [ ] Reiniciar Metro tras cambiar `.env`.
- [ ] (Cuando quieras PWA en prod) `npm run export:web` y `firebase deploy --only hosting` — **manual, no automatizado en este push**.

## 7. Pruebas manuales

- [ ] Web: anónimo → Ajustes → **Vincular con Google** → mismo UID en `users/{uid}`.
- [ ] Logout → **Continuar con Google** → Home con datos nube.
- [ ] Conflicto (Google ya usado): mensaje claro, sin crash; path = cerrar sesión + Continuar con Google.
- [ ] Cancelar popup OAuth: sin modal de error rojo.
- [ ] Android APK con Client ID + SHA: vincular / continuar.
- [ ] Dark PWA: sin raya blanca; iconos Ionicons OK.

## Notas

- Deep link scheme: `sui` (`app.json`).
- No subas Client Secrets; basta Client ID público para id_token.
- `googleSync.ts` (calendario demo) ≠ este OAuth de identidad.
- Repo: https://github.com/MiguelSalmeron/SUI
