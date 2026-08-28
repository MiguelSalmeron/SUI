# ADR-0005: repositorio local-first versionado

- Estado: aceptado
- Fecha: 2026-08-27

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

Cada documento lleva `schemaVersion`, `updatedAt`, `serverUpdatedAt`, `revision`, `deviceId`, `deletedAt` y `lastMutationId`. Eliminaciones usan tombstones. Transacciones ignoran `mutationId` ya aplicado.

Reconciliación v1 usa último commit por entidad. Tombstone posterior gana. Outbox local pendiente no se descarta silenciosamente. Fusión entre invitado y cuenta siempre requiere elección.

Storage v6 migra a v7 sin borrar metas, hábitos, rachas o historial. Cloud legado se importa una vez a subcolecciones. No existen seeds para usuarios nuevos.

## Consecuencias

Lectura y escritura permanecen inmediatas sin red. Estado observable: `local`, `pending`, `syncing`, `synced`, `offline`, `error`. Cambios futuros de esquema requieren migración idempotente y prueba de conservación.
