# Completar configuración cloud

Código soporta development, staging y production. Consolas y credenciales siguen siendo trabajo externo.

Autentica CLI y vincula proyecto EAS antes de crear ambientes:

```bash
eas login
eas init
```

## Firebase por ambiente

1. Crear proyecto independiente.
2. Activar Auth: Anonymous, Email/Password, Google; Apple para iOS.
3. Registrar apps web, Android `com.sui.app` e iOS `com.sui.app`.
4. Crear Firestore.
5. Copiar variables públicas de `apps/mobile/.env.example` al ambiente EAS correspondiente.
6. Publicar plantillas de verificación y recuperación ES/EN.

Perfil EAS `staging` consume ambiente EAS `preview`; `EXPO_PUBLIC_APP_ENV`
continúa usando valor `staging` dentro de aplicación.

Anonymous permite Chat técnico; `firestore.rules` niega productividad anónima.

## Backend

Configurar parámetros desde `apps/functions/.env.example`. Guardar secretos:

```bash
firebase functions:secrets:set AZURE_OPENAI_API_KEY
firebase functions:secrets:set GOOGLE_OAUTH_WEB_CLIENT_SECRET
```

Compilar, probar, desplegar:

```bash
npm run check
firebase deploy --only firestore:rules,functions
```

## Google identidad

### 1. Pantalla de consentimiento de OAuth (Google Cloud Console)
- Tipo de usuario: Externo (o Interno si es Workspace).
- Scopes mínimos obligatorios: `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`.
- Estado de publicación: En desarrollo ("Testing"), añadir los correos de prueba en "Test users" para que Google no bloquee el login. Para producción, pasar a "In production".

### 2. Credenciales OAuth 2.0 (Google Cloud Console)

#### A. Cliente Web (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) — **Obligatorio para Web y base de tokens**:
- **Orígenes de JavaScript autorizados:**
  - Localhost: `http://localhost:8081` (o el puerto activo de Metro/Vite).
  - Web desplegada: `https://<tu-proyecto>.web.app`, `https://<tu-proyecto>.firebaseapp.com` o dominio personalizado (ej. `https://app.sui.com`).
- **URIs de redireccionamiento autorizados:**
  - Localhost: `http://localhost:8081` y `http://localhost:8081/`.
  - Web desplegada: `https://<tu-proyecto>.web.app/` y el handler de Firebase `https://<tu-proyecto>.firebaseapp.com/__/auth/handler`.

#### B. Cliente Android (`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`) — **Para APK compilada**:
- Tipo de aplicación: **Android**.
- Nombre del paquete: `com.sui.app` (coincidente con `android.package` en `app.json`).
- **Huella digital SHA-1** (muy importante; si difiere del certificado del APK instalado, Google dará `Error 400: redirect_uri_mismatch`):
  - *Build local (debug):* Obtener con `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android` (SHA-1 por defecto: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` o el que genere tu entorno).
  - *Build EAS (staging/production):* Ejecutar `eas credentials -p android` y copiar la huella SHA-1 del Keystore administrado.
  - *Google Play Store (si aplica):* Copiar el SHA-1 de "Firma de apps de Google Play" en Play Console.
- **Deep Linking y Redirección en la APK:**
  - `expo-auth-session` redirige a `com.sui.app:/oauthredirect`.
  - `apps/mobile/app.json` declara `"scheme": ["sui", "com.sui.app"]` y `AndroidManifest.xml` cuenta con el `intent-filter` para `com.sui.app` para que el navegador del móvil devuelva el control a la app tras autorizar la cuenta.
  - En la app, el código de autorización se intercambia con PKCE contra el endpoint de Google para obtener el `id_token` final.

#### C. Cliente iOS (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`):
- Tipo de aplicación: **iOS**.
- ID de paquete: `com.sui.app`.
- Configurar el valor en `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

### 3. Firebase Console (Autenticación)
- **Dominios autorizados:** Ve a **Authentication > Ajustes > Dominios autorizados** y agrega el dominio de la web desplegada. `localhost` viene incluido por defecto.
- **Client IDs adicionales:** Si los Client IDs de Google Cloud se crearon en un proyecto de GCP independiente al de Firebase, agrégalos en **Authentication > Sign-in method > Google > Configuración del SDK web > "Permitir IDs de cliente adicionales"**.
- Cargar las variables en `.env` o en EAS Secrets:
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

## Google Calendar

Calendar no comparte consentimiento con login.

1. Activar Google Calendar API.
2. Añadir `calendar.readonly`.
3. Registrar redirects por ambiente.
4. Poner todos Client IDs en `GOOGLE_OAUTH_CLIENT_IDS`.
5. Poner Web Client ID en `GOOGLE_OAUTH_WEB_CLIENT_ID`.
6. Guardar Web Client Secret sólo en Functions.
7. Configurar `EXPO_PUBLIC_CONNECTIONS_API_URL`.

Probar conexión, cancelación, refresh, revocación, caché offline y desconexión.

## Sync productividad

Desplegar `syncProductivity` en staging y configurar su URL base en
`EXPO_PUBLIC_SYNC_API_URL`. Desplegar después reglas que niegan escritura
productiva directa. Verificar CAS, pull incremental, tombstones y epoch con dos
dispositivos antes de distribuir cliente v9.

## App Check

Configurar reCAPTCHA Enterprise, Play Integrity y App Attest/DeviceCheck. Mantener `APP_CHECK_MODE=monitor` hasta observar staging estable; luego habilitar enforcement y cambiar a `enforce`.

Cliente actual inicializa App Check web. Proveedores nativos deben integrarse y
validarse antes de enforcement Android/iOS.

## Observabilidad

- Configurar `EXPO_PUBLIC_SENTRY_DSN` por ambiente.
- Configurar organización, proyecto y token de source maps en EAS, nunca Git.
- Verificar que eventos no incluyan usuario, request, contenido Chat o tokens.

## Crisis y legal

- Publicar URLs HTTPS de Términos y Privacidad.
- Definir `EXPO_PUBLIC_POLICY_VERSION`.
- Añadir país a `EXPO_PUBLIC_APPROVED_MARKETS` sólo tras revisión.
- Crear `app_config/crisis/regions/{COUNTRY}-{locale}` ES/EN.

## Validar

```bash
EXPO_PUBLIC_APP_ENV=production npm run check:production
npm run check
npm run export:web
eas build --platform android --profile staging
eas build --platform ios --profile staging
```

Matriz completa: [preparar lanzamiento](production-rollout.md).
