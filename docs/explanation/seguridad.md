# Seguridad

Modelo de seguridad de SUI: cliente Expo/React Native (móvil y build web) sobre
Firebase (Auth, Firestore, Functions, Hosting). El repositorio es **público**, así
que este documento asume que todo lo versionado es visible.

## Superficie de ataque

- **Cliente** (`apps/mobile`): no contiene credenciales secretas.
- **Cloud Functions** (`apps/functions`): `chatProxy` es un endpoint HTTP que consume
  Azure OpenAI y por tanto tiene coste; también expone conexiones, sync y eliminación.
- **Firestore**: lectura y escritura desde cliente controladas por reglas.

## 1. Secretos y configuración

- Sólo se versionan plantillas `*.env.example`. `.env` y `.env.<proyecto>` están en
  `.gitignore` sin excepciones.
- Los secretos reales se declaran con `firebase functions:secrets:set` y se consumen
  con `defineSecret`: `AZURE_OPENAI_API_KEY`, `GOOGLE_OAUTH_WEB_CLIENT_SECRET`.
- Los parámetros **no** secretos (modelo, orígenes permitidos, modo de App Check) se
  fijan con `firebase functions:params` o en `apps/functions/.env.<proyecto>` local.
- `scripts/check-functions-config.mjs` corre como `predeploy`, exige los client IDs y
  nunca imprime valores.

Ver [ADR-0009](../decisions/0009-config-no-versionada-y-secretos.md).

## 2. Qué es público por diseño

Las variables `EXPO_PUBLIC_*` — incluida `EXPO_PUBLIC_FIREBASE_API_KEY` — se copian al
bundle de la aplicación. En Firebase la API key del proyecto **es un identificador
público**, no un secreto: su protección real son las reglas de Firestore, App Check y
Auth. Ocultarla no aporta seguridad y sólo rompe la configuración.

## 3. Firestore

`firestore.rules` cierra por defecto: el último bloque es
`match /{document=**} { allow read, write: if false }`.

- El cliente no escribe: todas las mutaciones pasan por Cloud Functions.
- `isRegisteredOwner(uid)` exige sesión activa, `uid` coincidente, proveedor distinto de
  `anonymous` y, con proveedor `password`, correo verificado.
- `connections/*`, `mirror/*` y `rate_limits/*` no permiten lectura ni escritura desde
  el cliente; sólo Functions.
- `app_config/crisis` y sus regiones son de lectura pública.

Las reglas se verifican con la Emulator Suite (`npm run test:rules`).

## 4. App Check

`apps/functions/src/http/appCheck.ts` lee `APP_CHECK_MODE`:

- `off`: no valida nada.
- `monitor`: registra el fallo y deja pasar.
- `enforce`: rechaza tokens ausentes o inválidos con 401.

Protege nueve endpoints: `chatProxy`, `deleteAccount`, `syncProductivity` y las seis
funciones de Calendar.

**Cobertura actual: sólo web.** El cliente inicializa App Check únicamente en web, con
ReCaptcha v3 (`shared/infrastructure/firebase/firebase.ts`). En Android/iOS
`getAppCheckToken()` devuelve `''` y la cabecera no se envía; no hay paquetes nativos de
App Check instalados. Por eso **pasar a `enforce` hoy dejaría sin servicio a las apps
nativas**: hay que integrar App Check nativo (Play Integrity / App Attest), registrar cada
plataforma en la consola y desplegar antes de activarlo.

## 5. CORS

`chatProxy` se declara con `cors: false` y aplica `setCorsHeaders`
(`apps/functions/src/http/cors.ts`): sólo emite `Access-Control-Allow-Origin` si el
`Origin` está en la allowlist de `ALLOWED_ORIGINS`. Las peticiones móviles sin cabecera
`Origin` siguen siendo válidas.

## 6. Rate limiting y coste

`checkRateLimit` se ejecuta antes de invocar Azure y responde 429 con `Retry-After`. Aplica
dos cupos sobre una ventana de 60 minutos:

- **Por usuario:** 30 peticiones (`RATE_LIMIT_MAX_REQUESTS`).
- **Por IP:** 120 peticiones (`RATE_LIMIT_MAX_REQUESTS_PER_IP`).

El cupo por IP existe porque el `uid` no acota nada por sí solo: crear una cuenta anónima
es gratuito, así que farmear identificadores renueva el cupo de 30 indefinidamente.

**De dónde sale la IP.** Se toma el **último** salto de `X-Forwarded-For`, que es el único
fiable: el orquestador de Cloud Run añade al final la IP que él ve, y todo lo anterior lo
pudo escribir el solicitante. Leer el primer salto (lo intuitivo) regalaría el límite —
basta enviar un valor inventado para obtener un cubo nuevo en cada petición. `request.ip`
no sirve de respaldo porque en Cloud Run es la dirección compartida del proxy.

**Privacidad.** La clave del cubo es un hash de la IP: la IP en claro no llega a Firestore
ni a los logs. Es un pseudónimo, no anonimización — el espacio IPv4 es enumerable, así que
con el hash a la vista podría recuperarse por fuerza bruta.

**Purga.** Los cubos por IP crecen con cada IP distinta que ve el servicio. Cada documento
lleva un campo `expiresAt`; falta habilitar la política TTL de Firestore sobre
`rate_limits` para que se purguen solos.

Aun así el límite por IP es de mejor esfuerzo: frena el abuso masivo desde un origen, no a
quien rota IPs. El control que sí lo corta es App Check, ver
[habilitar App Check nativo](../how-to/habilitar-app-check-nativo.md).

`minInstances` es configurable (`CHAT_MIN_INSTANCES`). Conviene fijar `maxInstances` como
cota de gasto ante abuso.

## 7. Cabeceras del hosting web

`firebase.json` define las cabeceras de seguridad del build web: `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y `Strict-Transport-Security`.
Se pueden comprobar con `curl -I https://xsui.web.app`.

## 8. Repositorio público

- GitHub _secret scanning_ y _push protection_ están activos: bloquean un secreto antes
  del push.
- En un repositorio público gratuito, _non-provider patterns_ y _validity checks_ **no
  están disponibles**: forman parte de GitHub Secret Protection, de pago. Esa laguna la
  cubre `gitleaks` como paso de CI, configurado en `.gitleaks.toml`.
- `gitleaks` marca la API key de Firebase como `gcp-api-key`. Es un falso positivo por
  diseño (ver §2) y está exceptuado por ruta en `.gitleaks.toml`.
- No se versionan artefactos de firma (`*.jks`, `*.keystore`, `*.p8`, `*.p12`,
  `google-services.json`, `GoogleService-Info.plist`).
- Ante una fuga: **revocar y rotar la credencial en el proveedor**. Reescribir el
  historial no neutraliza un secreto ya expuesto.

## 9. Protocolo ante incidentes

1. **Reducir exposición:** desactivar la ruta o aislar el servicio afectado.
2. **Preservar evidencia:** respaldar logs y estado sin sobrescribirlos.
3. **Rotar credenciales:** cambiarlas directamente en el proveedor.
4. **Recuperar validado:** restaurar en un entorno aislado y verificar antes de reabrir.
