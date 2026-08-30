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

Cada documento lleva `schemaVersion`, `updatedAt`, `serverUpdatedAt`, `revision`, `deviceId`, `deletedAt`, `fingerprint` y `lastMutationId`. Eliminaciones usan tombstones. Transacciones ignoran `mutationId` ya aplicado.

Reconciliación v8 es determinista por entidad: gana mayor `revision`; empate gana
`deviceId` lexicográficamente mayor. `updatedAt` del cliente no decide. Misma
versión y fingerprint es replay; misma versión con fingerprint distinto es
colisión técnica y conserva remoto. Política también aplica al resumen, que
sincroniza racha, fechas, historial derivado y XP.

Sync procesa snapshot de outbox, elimina sólo mutationIds confirmados y siempre
hace pull autoritativo después del push. Mutaciones creadas durante vuelo quedan
pendientes y se superponen al pull. Fusión entre invitado y cuenta siempre
requiere elección.

Storage v7 migra a v8 después de validación y queda como respaldo de solo lectura;
si no existe, se migra v6. Cloud conserva rutas por subcolección. No existen seeds
para usuarios nuevos.

## Consecuencias

Lectura y escritura permanecen inmediatas sin red. Estado observable: `local`, `pending`, `syncing`, `synced`, `offline`, `error`. Cambios futuros de esquema requieren migración idempotente y prueba de conservación.
