# Preparar un lanzamiento de Sui

## Alcance de primera entrega

- Público 16+.
- Español e inglés.
- Invitado local, correo/contraseña, Google; Apple en iOS.
- Productividad offline-first con respaldo opcional.
- Google Calendar sólo lectura, bajo solicitud explícita.
- Historial de Chat local con TTL de 48 horas.

## 1. Separar ambientes

Crear proyectos Firebase y credenciales OAuth independientes para `development`, `staging` y `production`. EAS obtiene variables desde ambientes, nunca desde valores versionados.

```bash
eas env:create --environment preview
eas env:create --environment production
```

Perfil `staging` de `eas.json` usa ambiente EAS `preview`; aplicación recibe
`EXPO_PUBLIC_APP_ENV=staging`.

Copiar variables descritas en `.env.example`. Para producción, `npm run check:production` exige Firebase, OAuth, URL de conexiones, legales HTTPS, mercado y DSN Sentry.

## 2. Configurar identidad

Activar Anonymous, Email/Password, Google y Apple. Registrar:

- Web: dominios autorizados y redirect URI exacto.
- Android: package release, SHA-1 y SHA-256 de firma.
- iOS: bundle ID, Sign in with Apple, Service ID y redirect.
- Plantillas de verificación y recuperación en ES/EN.

Verificar correo antes de habilitar sync. Auth anónimo sólo autoriza Chat y endpoints técnicos; reglas niegan escritura productiva.

## 3. Desplegar datos y backend

```bash
npm run check
firebase deploy --only firestore:rules
firebase deploy --only functions
```

Para cliente v8, desplegar y validar reglas primero. Sólo después distribuir build
v8 en staging. No habilitar cliente v8 contra reglas anteriores.

Configurar secretos y allowlists de `functions/.env.example`. Calendar requiere OAuth web secret sólo en backend. `ALLOWED_ORIGINS` debe enumerar dominios web reales.

Ejecutar Emulator Suite antes de cada cambio de reglas. Casos mínimos: propietario, usuario cruzado, invitado, campos inválidos y límites.

## 4. App Check

Configurar reCAPTCHA Enterprise para web, Play Integrity para Android y App Attest/DeviceCheck para iOS.

1. `APP_CHECK_MODE=monitor` en Functions.
2. Observar tráfico legítimo de staging.
3. Confirmar tokens en web y builds nativos.
4. Activar enforcement en Firestore, Functions y Chat.
5. Cambiar `APP_CHECK_MODE=enforce`.

No activar enforcement nativo hasta instalar proveedores nativos; cliente actual
inicializa proveedor web cuando existe
`EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`.

## 5. Privacidad y observabilidad

- Sentry sin PII, contenido Chat, headers, tokens o cuerpos HTTP.
- Métricas permitidas: arranque, resultado auth, sync, conexión, latencia y crash.
- Probar exportación, logout y eliminación completa.
- Verificar revocación Calendar y borrado de caché tras desconexión/eliminación.
- Revisar retención de logs backend; nunca registrar mensajes Chat.

## 6. Habilitar países

`EXPO_PUBLIC_COUNTRY_CODE` identifica mercado activo y debe pertenecer a
`EXPO_PUBLIC_APPROVED_MARKETS`. Publicar sólo mercados con recursos de crisis y
revisión legal aprobados. Config crisis vive por país/idioma en:

```text
app_config/crisis/regions/{COUNTRY}-{locale}
```

Respaldo Nicaragua usa Policía `118` y Bomberos `115`, confirmados en fuentes oficiales: [Policía Nacional, 118](https://www.policia.gob.ni/?p=145448) y [Policía Nacional, 118/115](https://www.policia.gob.ni/?p=114378).

## 7. Matriz release

- Bienvenida: 320/375/430 dp, tablet, web, claro/oscuro, texto grande, ES/EN.
- Invitado: arranque offline, CRUD local, cero documentos productivos Firestore.
- Auth: correo, verificación, recuperación, Google, Apple, cancelación, restauración.
- Fusión: combinar, usar nube, cancelar; sin eliminación previa.
- Sync: dos dispositivos, edición offline, reconexión, tombstone, replay, empate y clocks desalineados.
- Calendar: permiso incremental, renovación, revocación, caché offline.
- Seguridad: App Check, CORS, rate limits, reglas cruzadas.
- Rendimiento: UI local útil en máximo 1.5 s.

## 8. Builds y rollout

```bash
eas build --platform android --profile staging
eas build --platform ios --profile staging
eas build --platform all --profile production
```

Probar staging en dispositivos reales. Publicar por porcentaje pequeño, vigilar crashes/auth/sync, ampliar sólo con métricas estables. Cada país nuevo requiere configuración y revisión; no nueva arquitectura.
