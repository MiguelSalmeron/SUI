# Referencia de configuración, datos y tema

## Variables cliente

Plantilla canónica: `apps/mobile/.env.example`.

| Grupo          | Variables                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase       | `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`                                                                                                 |
| APIs           | `EXPO_PUBLIC_CHAT_PROXY_URL`, `EXPO_PUBLIC_CONNECTIONS_API_URL`, `EXPO_PUBLIC_SYNC_API_URL`                                                                         |
| OAuth          | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`                                                      |
| Producto       | `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_POLICY_VERSION`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_COUNTRY_CODE`, `EXPO_PUBLIC_APPROVED_MARKETS` |
| Observabilidad | `EXPO_PUBLIC_SENTRY_DSN`                                                                                                                                            |

Variables `EXPO_PUBLIC_*` forman parte del bundle: nunca contienen secretos. Azure key y Google web secret viven en Secret Manager.

## Persistencia local

| Clave                 | Contenido                                                         |
| --------------------- | ----------------------------------------------------------------- |
| `sui-onboarding-v3`   | clave histórica vigente; `IntroState` v4, cuenta y consentimiento |
| `sui-productivity-v9` | datos, metadata, outbox, cursores, epoch y `lastSyncedAt`         |
| `sui-productivity-v8` | respaldo legado de solo lectura                                   |
| `sui-productivity-v7` | segundo respaldo legado                                           |
| `sui-home-state-v6`   | segundo origen legado leído durante migración                     |
| `sui-chat-v1`         | conversación local con TTL 48 h                                   |
| `@sui/settings-v1`    | tema, tamaño de texto, idioma y preferencias                      |

## Firestore

```text
users/{uid}
├── goals/{goalId}
├── habits/{habitId}
├── snapshots/{date}
└── connections/{provider}  # backend solamente
```

Documento raíz v9 guarda resumen productivo y `syncControl` con epoch/fecha de
compactación. Cloud Function es único writer; reglas permiten lectura sólo al owner
verificado. Entidades usan siguiente sobre:

```typescript
type SyncedEntity<T> = {
  data: T | null;
  meta: {
    schemaVersion: 2;
    serverRevision: number;
    originDeviceId: string;
    clientUpdatedAt: string;
    deletedAt?: Timestamp;
    purgeAfter?: Timestamp;
    fingerprint: string;
    lastMutationId: string;
  };
  serverUpdatedAt: Timestamp;
};
```

Política común: `baseServerRevision` debe igualar `serverRevision`. Backend incrementa
versión; primer commit válido gana. `lastMutationId` vuelve retry idempotente.
Tombstones expiran tras 90 días; compactación incrementa epoch. Pull incremental
usa `{seconds, nanoseconds, documentId}` y upper bound estable.

Usuarios anónimos no pueden leer/escribir productividad. Config crisis pública vive en `app_config/crisis/regions/{COUNTRY}-{locale}` con fallback `app_config/crisis`.

## Tema

Marca: `#218ECE`; marino: `#0B132B`; acción accesible: `#1677A6`; salvia: `#55796F`; naranja: `#E87536`. `theme.ts` expone escalas claras/oscuras, spacing, radios y elevación.

Tipografía vive en `src/shared/theme/typography.ts`. Poppins 400/500/600/700 compone interfaz. Fredoka sólo bienvenida, niveles, logros y celebraciones. `theme.type.*` es único acceso desde componentes; literales tipográficos fallan `npm run architecture`.

Escala base:

- Display: `52/60`, `40/48`, `32/40`.
- Headline: `30/38`, `26/34`, `22/30`.
- Title: `20/28`, `16/24`, `14/20`.
- Body: `16/24`, `14/20`, `12/16`.
- Label: `14/20`, `12/16`, `11/16`, `10/14`.

Tamaños Pequeño/Mediano/Grande aplican factores `0.88`, `1`, `1.15` sin desactivar escalado nativo.

Navegación inferior expone cuatro rutas reales y una acción central Sui. `SCREEN_CONTENT_BOTTOM_PADDING` protege listas de barra y safe area.
