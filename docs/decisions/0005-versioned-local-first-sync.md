# ADR-0005: repositorio local-first versionado

- Estado: aceptado
- Fecha: 2026-08-27
- Actualizado: 2026-08-30

## Contexto

Persistir directamente desde store UI no cubre migraciones, reintentos, múltiples dispositivos ni eliminaciones offline. La UI tampoco debe esperar red.

## Decisión

AsyncStorage conserva un sobre versionado con datos, metadata, outbox y `deviceId`. Toda mutación actualiza UI primero, persiste localmente y encola operación idempotente.

Firestore usa documentos por entidad:

```text
users/{uid}
users/{uid}/goals/{goalId}
users/{uid}/habits/{habitId}
users/{uid}/snapshots/{date}
```

Cloud Function es único writer productivo. Cada documento lleva metadata v2:
`serverRevision`, `serverUpdatedAt`, `originDeviceId`, `fingerprint` y
`lastMutationId`. Mutación declara `baseServerRevision`; backend acepta sólo si
coincide con versión actual e incrementa versión. Primer commit válido gana.
Duplicado inmediato es replay; mutación vieja o base incorrecta es stale y recibe
estado autoritativo. Política también aplica al resumen de racha, fechas y XP.

Endpoint procesa máximo 50 mutaciones distintas en transacción agrupada. Después
hace pull incremental de `goals`, `habits` y `snapshots`, máximo 100 cambios por
colección/página. Cursor preciso combina timestamp y document ID; páginas comparten
upper bound. Sobre local se escribe sólo al completar pull. Outbox conserva
mutaciones ante fallo/respuesta perdida y cambios creados durante vuelo se
superponen al delta autoritativo.

Eliminaciones crean tombstones con retención de 90 días. Compactación oportunista
por usuario incrementa `syncEpoch`; cliente con epoch distinto hace bootstrap antes
de push. Storage v8 migra a v9 después de validación y queda como respaldo de solo
lectura; después se intentan v7 y v6. Mutaciones v8 pendientes hacen bootstrap y
un único rebase. Cloud conserva rutas por subcolección.

## Consecuencias

Lectura y escritura local permanecen inmediatas sin red. Estado observable:
`local`, `pending`, `syncing`, `synced`, `offline`, `error`. Firestore Rules niega
escritura productiva cliente; owner verificado conserva lectura. Cambios futuros de
esquema requieren migración idempotente y prueba de conservación.

Migraciones locales son saltos puros consecutivos (`v6→v7→v8→v9`). Fixtures
históricos prueban cada salto, cadena completa, fallback ante corrupción e
idempotencia actual.

Backend recibe `SyncProvider`. Engine conserva reglas CAS, epoch y paginación;
adapter Firestore traduce transacciones y timestamps. Provider en memoria ejecuta
suite principal sin emulador; Emulator Suite valida integración Firestore.
