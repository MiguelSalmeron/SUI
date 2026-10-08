# Prompt para Codex — Identidad visual y avatar personalizable

Pegá este texto como instrucción. La especificación completa está en `docs/plans/identidad-avatar.md`; si algo contradice este prompt, detente y reportá la contradicción. No hagás commit ni push.

---

Implementá el plan `docs/plans/identidad-avatar.md` en este repo Sui. Leelo completo antes de editar. Antes de tocar código leé `AGENTS.md`, `docs/reference/developer-guide.md`, `docs/plans/identidad-avatar.md`, `apps/mobile/src/shared/ui/Avatar.tsx`, `apps/mobile/src/application/navigation/TabNavigator.tsx`, `apps/mobile/src/features/settings/screens/SettingsScreen.tsx`, `apps/mobile/src/shared/preferences/useSettingsStore.ts`, `firestore.rules`, `firebase.json`, `apps/functions/src/account/deleteAccount.ts` y `apps/functions/src/connections/googleCalendar.ts`.

## Objetivo

Agregar identidad visual personalizable con:

- foto real como identidad principal;
- fallback generado con color + emoji/inicial;
- editor en sheet dentro de Ajustes;
- persistencia local-first;
- foto remota para cuentas registradas mediante Firebase Storage;
- metadatos en `users/{uid}.identity` escritos exclusivamente por Cloud Function;
- borrado remoto al eliminar la cuenta.

## Reglas no negociables

- No abras `allow write` en `firestore.rules`.
- No metas base64/blob/URI local en Firestore, contratos de sync ni `ProductivitySummary`.
- No aceptes `uid`, `photoUrl` ni rutas arbitrarias desde el body del endpoint.
- No hagas público el bucket ni uses URLs externas pegadas por el usuario.
- No pidas permiso de cámara en esta iteración.
- No agregues biografía, texto libre, red social ni avatares públicos.
- No importes Firebase Storage desde una feature; respetá `scripts/check-architecture.mjs`.
- Todos los comentarios y docs nuevos van en español. Claves, identificadores y APIs no se traducen.
- Cada clave i18n nueva o modificada debe existir en ES y EN.
- No cambies el comportamiento del motor de productividad, sync v9, Auth ni Google Calendar.

## Archivos y zonas esperadas

Crear o modificar, según la implementación:

- `packages/contracts/src/profile.ts` y export correspondiente desde `packages/contracts/src/index.ts`.
- `apps/mobile/src/shared/identity/` para el store y tipos locales.
- `apps/mobile/src/shared/ui/Avatar.tsx`.
- `apps/mobile/src/shared/infrastructure/storage/` para el acceso permitido a Storage.
- `apps/mobile/src/shared/infrastructure/profile/` o equivalente permitido para la API HTTP de identidad.
- `apps/mobile/src/application/navigation/TabNavigator.tsx`.
- `apps/mobile/src/features/settings/screens/SettingsScreen.tsx` y componentes del sheet dentro de la feature.
- `apps/mobile/src/shared/i18n/messages/settings.ts`.
- `apps/mobile/package.json`, `apps/mobile/app.json` y mocks necesarios para `expo-image-picker` y `expo-image-manipulator`, usando versiones compatibles con Expo SDK 57.
- `storage.rules`, `firebase.json`, `test/storage.rules.test.mjs` y el script que ejecuta las pruebas de rules.
- `apps/functions/src/profile/updateIdentity.ts`, `apps/functions/src/index.ts` y `apps/functions/src/account/deleteAccount.ts`.
- Tests cercanos a `Avatar`, Settings, navegación, endpoint y rules.

No creés rutas nuevas de navegación. La fila actual de identidad abre el sheet.

## Comportamiento requerido

1. `Avatar` conserva fallback de inicial, acepta URI opcional y vuelve al fallback si `Image` dispara error.
2. El store separa `localPhotoUri` de `photoUrl`/`photoPath` remotos.
3. Color y detalle se aplican de inmediato y se persisten localmente.
4. Picker: galería, crop cuadrado, normalización de orientación, máximo 512x512, WebP/JPEG máximo 1 MiB.
5. Usuario local/anónimo: solo almacenamiento local.
6. Usuario registrado: upload a `users/{uid}/avatar/avatar.webp`, luego `POST updateIdentity` autenticado con Bearer + App Check.
7. El endpoint valida catálogo cerrado, esquema, path canónico y no acepta URL arbitraria.
8. Quitar foto elimina metadatos y el objeto remoto de forma idempotente, conservando color/detalle.
9. La identidad se limpia al cambiar de cuenta para evitar mostrar la foto anterior.
10. `deleteAccount` elimina el archivo Storage si existe, además de Firestore y Auth.

## Rules requeridas

En `storage.rules`, permitir únicamente al dueño registrado y verificado según la misma premisa de `firestore.rules`:

- path exacto `users/{uid}/avatar/avatar.webp`;
- lectura/escritura del propio usuario;
- MIME `image/webp` o `image/jpeg`;
- tamaño máximo 1 MiB;
- anónimo, no verificado y cross-user: denegados;
- default deny para todo lo demás.

Agregar tests para dueño válido, cross-user, anónimo, no verificado, MIME incorrecto, tamaño excedido y ruta incorrecta. Ajustar `firebase.json` y el comando de rules para Storage + Firestore, sin romper las pruebas actuales.

## UI y accesibilidad

- Sheet siguiendo `GoalFormModal.tsx`/`SelectionModal.tsx`.
- Preview grande, cambiar/quitar foto, ocho colores, detalle cerrado y preview de header.
- Targets mínimos de 44 dp.
- Busy en el control accionado; deshabilitar el resto durante procesamiento/subida.
- Error inline con `accessibilityLiveRegion="polite"`.
- Avatar con `accessibilityRole="image"` y label estable.
- No meter tipografías literales en estilos TSX.

## Tests y verificación

Actualizá tests sin borrar cobertura existente de logout, borrado, navegación o `Avatar`. Agregá casos para:

- inicial, foto válida y fallback después de error;
- abrir/cerrar sheet;
- cambiar color/detalle;
- cancelación y permiso denegado;
- subida exitosa, subida fallida y quitar foto;
- aislamiento entre cuentas;
- endpoint con body inválido, path/URL arbitrario y auth inválida;
- Storage rules.

Ejecutá, en este orden:

```bash
npm run architecture
npm run lint
npm run typecheck
npm run test --workspace @sui/mobile
npm run functions:build
npm run check
```

Si `npm run check` falla solo porque el entorno no tiene Java/emulador o configuración de Firebase, no cambiés reglas para ocultarlo: reportá el comando exacto y la causa. No dejés artefactos generados ni secretos.

Al terminar, devolvé:

1. archivos creados y modificados;
2. decisiones técnicas tomadas y cualquier desviación del plan;
3. resultado de cada comando de verificación;
4. riesgos pendientes, especialmente Storage/deploy y compatibilidad web.
