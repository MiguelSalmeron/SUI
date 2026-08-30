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
5. Copiar variables públicas de `.env.example` al ambiente EAS correspondiente.
6. Publicar plantillas de verificación y recuperación ES/EN.

Perfil EAS `staging` consume ambiente EAS `preview`; `EXPO_PUBLIC_APP_ENV`
continúa usando valor `staging` dentro de aplicación.

Anonymous permite Chat técnico; `firestore.rules` niega productividad anónima.

## Backend

Configurar parámetros desde `functions/.env.example`. Guardar secretos:

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

- Consent screen: `openid`, `email`, `profile`.
- Web: dominios y redirects exactos.
- Android: package + SHA release/Play App Signing.
- iOS: bundle ID y URL scheme requerido.
- Cargar tres Client IDs públicos en EAS.

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
