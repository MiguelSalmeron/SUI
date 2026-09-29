# Habilitar App Check nativo hasta `enforce`

Estado: planificado, no ejecutado. Bloqueado por trabajo externo (registro en Firebase
Console y rebuild nativo).

## Punto de partida

| Plataforma    | Token App Check hoy | Endpoints protegidos |
| ------------- | ------------------- | -------------------- |
| Web           | Sí (ReCaptcha v3)   | Sí                   |
| Android / iOS | **No**              | **No**               |

`verifyAppCheckHeader` cubre nueve endpoints: `chatProxy`, `deleteAccount`,
`syncProductivity` y las seis de Calendar (`googleCalendarConnect`, `googleCalendarStatus`,
`googleCalendarSync`, `googleCalendarDisconnect`, `googleMirrorUpsert`,
`googleMirrorDelete`). En móvil no recibe nunca un token, así que en la práctica sólo
protege tráfico web.

## Restricción que define el plan

El cliente usa el **SDK JS de Firebase** (`firebase`). Ese SDK sólo ofrece proveedores web
(`ReCaptchaV3Provider`, `ReCaptchaEnterpriseProvider`) y `CustomProvider`: **no tiene
proveedor nativo** (Play Integrity / App Attest). De ahí se derivan dos consecuencias.

**1. No se puede activar enforcement de App Check en Firestore ni en Auth.** Ese
enforcement es automático del SDK, y el SDK JS no puede adjuntar tokens en nativo:
activarlo en la consola dejaría a las apps nativas sin Firestore y sin Auth. La protección
real de Firestore son las reglas (`firestore.rules`, cierre por defecto), y debe seguir
siéndolo.

> El paso 4 de [production-rollout](production-rollout.md) decía "Activar enforcement en
> Firestore, Functions y Chat". Lo de Firestore es incorrecto con este cliente y ya está
> corregido.

**2. Para Cloud Functions sí es viable.** El token se envía a mano en la cabecera
`X-Firebase-AppCheck` y el servidor lo verifica, así que basta con **producirlo** en
nativo. No hace falta que el SDK lo adjunte por su cuenta.

## Fase 0 — mitigar sin rebuild, sin expulsar a los invitados

Hallazgo del análisis: `chatProxy` acepta cualquier ID token, **incluidas cuentas anónimas
y contraseñas sin verificar**, mientras `syncProductivity` ya las rechaza con 403.

Como `signInAnonymously` está disponible en el cliente y la API key es pública, un script
puede crear identificadores nuevos en bucle y obtener 30 llamadas nuevas a Azure por cada
uno: el límite por `uid` no acota el gasto.

Decisión tomada: **no** se bloquea el Chat a las cuentas anónimas, porque el invitado es
parte del producto. En su lugar se endureció el límite de peticiones.

- [x] Segundo cupo **por IP** en `chatProxy`: 30/hora por usuario **y** 120/hora por IP,
      sobre un hash de la IP.
- [ ] Habilitar la política TTL de Firestore sobre `rate_limits`. Los documentos ya llevan
      `expiresAt`; sin la política, la colección crece con cada IP distinta.
- [ ] Configurar presupuesto y alertas de facturación en GCP. Hoy no hay ninguna.

La IP se toma del **último** salto de `X-Forwarded-For`, el único que el cliente no puede
falsificar. Aun así el límite es de mejor esfuerzo: frena el abuso masivo desde un origen,
no a quien rota IPs, y no sustituye a App Check: un atacante que ejecute la app real sigue
pasando. App Check sí lo corta, porque no puede generar tokens de atestación.

## Fase 1 — Proveedores en Firebase Console

- [ ] Android: Play Integrity.
- [ ] iOS: App Attest, con DeviceCheck como respaldo.
- [ ] Web: ya configurado (reCAPTCHA v3).

## Fase 2 — Cliente nativo

- [ ] Instalar `@react-native-firebase/app` y `@react-native-firebase/app-check`.
- [ ] Proveer `google-services.json` y `GoogleService-Info.plist` (están en `.gitignore`)
      mediante EAS secrets.
- [ ] Inicializar el proveedor nativo y devolver el token desde `getAppCheckToken()`,
      quitando el corte `Platform.OS !== 'web'` de
      `shared/infrastructure/firebase/firebase.ts`.
- [ ] Rebuild nativo: un OTA no basta.

RNFirebase convive con el SDK JS, pero son dos SDKs. Aquí se usaría **sólo para obtener el
token**; el resto del cliente sigue en el SDK JS. Es el coste de la operación.

## Fase 3 — Observar antes de bloquear

- [ ] Desplegar el cliente y esperar adopción: los usuarios deben actualizar.
- [ ] Vigilar los logs de `App Check token missing` hasta que caigan a ~0.

## Fase 4 — Enforcement

- [ ] Poner `APP_CHECK_MODE=enforce` en `apps/functions/.env.xsui-nica` y desplegar
      Functions.

## Reversión

Volver a `monitor` y redesplegar. Es un parámetro, no requiere publicar cliente nuevo.

## Qué no cubre este plan

- Enforcement de App Check en Firestore y Auth: imposible con el SDK JS en nativo.
- Un atacante que ejecute la app real y cree cuentas legítimas.
