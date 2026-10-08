# Identidad visual y avatar personalizable

- **Estado:** implementación aplicada; deploy y validación visual pendientes. Check global bloqueado por dependencias Expo previas
- **Tipo:** especificación funcional y técnica para Codex / agente futuro
- **Alcance:** identidad visual local-first con foto opcional, color de acento y fallback generado; sincronización de la foto para cuentas registradas
- **Fuera de alcance:** edición del nombre de Firebase Auth, biografías o texto libre, red social, avatares de terceros, edición avanzada de imagen, moderación automática y personalidades de Sui

## 1. CONTEXTO

Sui actualmente muestra una inicial dentro de `shared/ui/Avatar.tsx`. El header global ya tiene un botón de avatar (`TabNavigator.tsx`) y Ajustes ya tiene una fila de identidad (`SettingsScreen.tsx:408-414`), pero la fila no es editable.

La identidad debe sentirse propia sin convertir Sui en una red social. La foto es la opción principal, pero no puede ser un requisito: la app funciona en modo local y con usuario anónimo. Por eso el modelo combina una foto opcional con una identidad generada que siempre funciona.

Objetivos:

- Permitir seleccionar una foto desde la galería, recortarla cuadrada y verla antes de guardar.
- Mostrar la foto en el header y en la sección de identidad, con fallback seguro a inicial o identidad generada si carga falla.
- Permitir cambiar el color de acento y elegir un detalle visual sencillo (emoji o inicial).
- Guardar la identidad inmediatamente en el dispositivo.
- Para cuentas registradas, subir la foto a Firebase Storage y sincronizar sus metadatos mediante Cloud Function.
- Mantener intacta la regla del repo: el cliente no escribe documentos de Firestore directamente.
- Hacer que eliminar la cuenta elimine también la foto remota.

## 2. DECISIONES DE PRODUCTO

### 2.1 Pila de identidad

```text
Identidad
├── fuente principal: foto | generada
├── color de acento: paleta cerrada accesible
└── detalle: emoji opcional o inicial automática
```

- La foto real es la identidad principal cuando existe.
- Si no hay foto, se muestra la identidad generada: color + detalle.
- Si no hay detalle, se muestra la primera letra del nombre, como hoy.
- No se permite texto libre en esta primera versión. Esto evita convertir una preferencia visual en un perfil sensible y mantiene la pantalla rápida.
- La personalización es privada: no hay búsqueda, perfiles públicos ni exposición dentro del Chat.

### 2.2 Editor

La fila de identidad en Ajustes abre un **sheet modal**, no una ruta nueva. El sheet debe incluir:

1. Preview grande del avatar actual.
2. Acción `Cambiar foto`.
3. Acción `Quitar foto`, visible solamente cuando exista una foto.
4. Paleta de 8 colores con controles de mínimo 44 dp.
5. Selector corto de detalle: `ninguno`, `emoji` o `inicial`; si se elige emoji, mostrar una selección cerrada de emojis seguros y comunes.
6. Preview pequeño del header.
7. Estado de almacenamiento: en dispositivo / sincronizada, sin prometer nube cuando la cuenta no está disponible.

El sheet no debe exigir un botón global de guardar para color o detalle: esos cambios se aplican al tocar y se persisten localmente. La foto sí muestra estado ocupado durante procesamiento y subida; el resto de controles queda deshabilitado mientras esa operación corre.

### 2.3 Copy y accesibilidad

- El label del header sigue anunciando que el botón abre Ajustes.
- El avatar anuncia `Avatar de {nombre}`; no anuncia la URL ni el nombre del archivo.
- Una foto ilegible cae silenciosamente al fallback y anuncia el mismo label.
- Los errores de selección, procesamiento o subida aparecen cerca del control con `accessibilityLiveRegion="polite"`.
- Todos los controles interactivos cumplen 44 dp.
- Agregar claves ES/EN en `shared/i18n/messages/settings.ts`; la prueba de paridad de i18n debe continuar pasando.

## 3. MODELO Y PERSISTENCIA

Crear un contrato separado, no meter bytes ni URLs de imagen en `ProductivitySummary`:

```ts
export type AvatarSource = 'initial' | 'generated' | 'emoji' | 'photo';

export interface UserIdentity {
  schemaVersion: 1;
  avatarSource: AvatarSource;
  accentColor: string;
  detail?: string;
  photoPath?: string;
  photoUrl?: string;
  photoVersion?: number;
  updatedAt?: string;
}
```

Reglas del contrato:

- `accentColor` debe ser uno de los tokens cerrados del producto, nunca un hex arbitrario recibido del cliente.
- `detail` solo acepta valores del catálogo permitido; el backend debe validar longitud y catálogo.
- `photoPath` siempre tiene forma `users/{uid}/avatar/avatar.webp`; el backend no acepta rutas arbitrarias.
- `photoUrl` se trata como dato derivado de Storage y se reemplaza al subir una foto nueva.
- No guardar base64, blobs ni URI local en Firestore.

### 3.1 Estado local

Crear un store persistido en `apps/mobile/src/shared/identity/`, siguiendo el patrón de `shared/preferences/useSettingsStore.ts`:

- `identity`: fuente, color, detalle, URI local opcional, path/url remoto opcional y versión.
- `setAccentColor`, `setDetail`, `setLocalPhoto`, `clearPhoto`.
- `hydrate`/`reset` según el patrón existente de Zustand persistido.
- La URI local se usa inmediatamente y no se confunde con `photoUrl` remoto.
- Al cerrar sesión, limpiar la identidad de la sesión actual sin borrar necesariamente la preferencia de instalación; al cambiar de usuario, nunca mostrar la foto del usuario anterior.

El header debe leer la identidad desde un módulo compartido, no desde `features/settings`, para respetar las reglas de arquitectura y evitar un ciclo entre navegación, UI y Ajustes.

### 3.2 Nube

Para una cuenta registrada:

```text
users/{uid}
└── identity: UserIdentity
```

El cliente puede subir el archivo exclusivamente a su propia ruta de Storage, validada por `storage.rules`. La escritura del documento `users/{uid}.identity` se hace mediante `updateIdentity` en Cloud Functions, autenticada con Bearer + App Check. No abrir `allow write` en `firestore.rules`.

La foto debe sincronizarse después de que la subida termine. Si falla la actualización de metadatos, conservar la foto local y mostrar un error recuperable; no borrar la foto remota automáticamente sin confirmar que el reemplazo quedó consistente.

Al iniciar sesión en otro dispositivo, leer la identidad del documento del usuario y resolver la foto desde Storage. Si la URL guardada expiró o falla, regenerar una URL válida desde el cliente para la ruta validada o volver al fallback sin bloquear la app.

## 4. FOTO: FLUJO Y SEGURIDAD

### 4.1 Flujo móvil

1. `expo-image-picker` abre la galería; no pedir cámara en esta fase.
2. `expo-image-manipulator` normaliza orientación, recorta al centro cuadrado y exporta WebP/JPEG de máximo 512x512.
3. Rechazar archivos que excedan el límite antes de subirlos.
4. Para usuario local/anónimo: guardar la URI procesada en el almacenamiento local.
5. Para usuario registrado: subir a `users/{uid}/avatar/avatar.webp` y obtener la referencia remota.
6. Llamar `updateIdentity` para guardar solo metadatos validados.
7. Actualizar el store y el preview sin desmontar el header.

La app debe tolerar cancelación, permisos denegados, URI inexistente, formato no soportado, pérdida de red y reintento. Nunca enviar la imagen como JSON o base64 al endpoint.

### 4.2 Storage

Crear `storage.rules` en la raíz y declararlo en `firebase.json`. La regla debe:

- permitir lectura y escritura solo al dueño registrado de `users/{uid}/avatar/{file}`;
- rechazar usuarios anónimos y cuentas no verificadas con contraseña, usando la misma premisa de `isRegisteredOwner` de Firestore;
- aceptar únicamente `image/webp` y `image/jpeg`;
- limitar el archivo a 1 MiB;
- rechazar rutas distintas al archivo canónico;
- negar cualquier otra ruta por defecto.

Agregar pruebas con emulador para dueño válido, usuario cruzado, anónimo, no verificado, MIME incorrecto, tamaño excesivo y ruta no canónica. Actualizar el script de reglas para levantar Storage junto con Firestore.

### 4.3 Endpoint `updateIdentity`

Crear `apps/functions/src/profile/updateIdentity.ts`, exportarlo desde `apps/functions/src/index.ts` y seguir el patrón de `connections/googleCalendar.ts`:

- CORS permitido.
- `POST` únicamente.
- App Check.
- Bearer de Firebase Auth.
- Validación estricta del body.
- No aceptar `uid` desde el body.
- No aceptar `photoUrl` arbitrario desde el body.
- Validar `schemaVersion`, `avatarSource`, `accentColor`, `detail`, `photoPath` y `photoVersion`.
- Escribir con `merge: true` en `users/{uid}`.
- Responder con la identidad normalizada, sin secretos.

Si la operación es `clearPhoto`, el endpoint debe eliminar `identity.photoPath`, `identity.photoUrl` y `identity.photoVersion`. La eliminación del objeto de Storage debe ser idempotente y ocurrir antes o después de la actualización según el flujo elegido, pero nunca dejar una URL de otro usuario.

## 5. ELIMINACIÓN DE CUENTA Y PRIVACIDAD

Extender `apps/functions/src/account/deleteAccount.ts` para borrar `users/{uid}/avatar/avatar.webp` antes o durante `deleteAccount`. La operación debe tolerar que el archivo no exista. Mantener el borrado recursivo de Firestore y el borrado de Auth.

No registrar URLs, nombres de archivo ni contenido de imágenes en logs. No crear bucket público. Documentar que una URL de descarga no se comparte con otras personas y que el avatar no aparece en Chat ni en superficies públicas.

## 6. UI Y ARQUITECTURA

Modificar:

- `apps/mobile/src/shared/ui/Avatar.tsx`: aceptar `source`/URI opcional, fallback por error de carga, borde accesible y conservar la API de iniciales.
- `apps/mobile/src/application/navigation/TabNavigator.tsx`: obtener la identidad compartida y pasarla al `Avatar` sin mover lógica de persistencia al navegador.
- `apps/mobile/src/features/settings/screens/SettingsScreen.tsx`: volver navegable la fila de identidad y montar el sheet.
- Crear un componente de sheet dentro de la feature de settings o extraerlo a una feature profile solo si crece; respetar `public.ts` e imports permitidos.
- Crear la capa de infraestructura para Storage y el cliente HTTP de `updateIdentity` en ubicaciones permitidas por `scripts/check-architecture.mjs`.

Usar tokens existentes de `shared/theme/tokens.ts`, `theme.ts` y la familia de modales/sheets vigente. No agregar estilos tipográficos literales en TSX. No importar Firebase Storage desde una feature: el SDK solo puede vivir en `shared/infrastructure`.

## 7. FASES INTERNAS DE IMPLEMENTACIÓN

Aunque el resultado pertenece a un solo plan, implementar en este orden para reducir regresiones:

1. Contrato, store local, `Avatar` con foto/fallback y sheet con color/detalle.
2. Picker, manipulación, permisos, persistencia local y estados de error.
3. Storage rules, emulador y tests.
4. Upload remoto, endpoint `updateIdentity`, sincronización y lectura al iniciar sesión.
5. Borrado de cuenta, documentación, tests de pantalla y regresión del header.

No dejar una fase incompleta en una condición que rompa el build: cada fase debe compilar y sus imports deben estar usados.

## 8. DEFINICIÓN DE LISTO

- Una persona local puede elegir foto, color y detalle; al reiniciar la app ve su identidad.
- Una persona registrada puede subir una foto procesada de máximo 512x512 y verla en el header.
- La foto nunca se envía en JSON/base64.
- La identidad generada aparece cuando no hay foto o cuando la carga falla.
- Quitar foto vuelve al fallback sin borrar color ni detalle.
- La identidad de un usuario no aparece al cambiar de cuenta.
- Otra cuenta no puede leer ni escribir el archivo Storage.
- Firestore continúa sin escrituras directas del cliente.
- El borrado de cuenta elimina el documento, el archivo remoto y la cuenta Auth.
- Settings, Avatar, navegación, Storage rules, endpoint y contratos tienen tests apropiados.
- ES/EN mantienen paridad de claves.
- `npm run check` pasa; si el entorno no permite el emulador, reportar exactamente el gate que no corrió.

## 9. Resultado de implementación — 7 de octubre de 2026

Implementación aplicada, sin commit, push ni deploy. Trabajo previo y concurrente
conservado. Revisión independiente aprobó fuente (`ship`); no representa QA visual.

### Archivos creados

- `packages/contracts/src/profile.ts`, `packages/contracts/test/profile.test.js`.
- `apps/mobile/src/shared/identity/{useIdentityStore.ts,identitySync.ts,useIdentitySession.ts}`
  y tests de store, sync y sesión en `__tests__`.
- `apps/mobile/src/shared/infrastructure/profile/{identityApi.ts,localPhoto.ts}`
  y `__tests__/localPhoto.test.ts`.
- `apps/mobile/src/features/settings/components/IdentitySheet.tsx` y
  `__tests__/IdentitySheet.test.tsx`.
- `apps/mobile/src/shared/ui/__tests__/Avatar.test.tsx`.
- `apps/mobile/__mocks__/{expo-image-picker.js,expo-image-manipulator.js,expo-file-system.js}`.
- `apps/functions/src/profile/updateIdentity.ts`,
  `apps/functions/test/{updateIdentity.test.js,avatarAccountDeletion.test.js}`.
- `storage.rules`, `test/storage.rules.test.mjs`.

### Archivos modificados por este trabajo

- `packages/contracts/src/index.ts`.
- `apps/mobile/src/shared/ui/Avatar.tsx`, `shared/theme/tokens.ts`,
  `shared/i18n/messages/settings.ts`.
- `apps/mobile/src/application/App.tsx`, `application/navigation/TabNavigator.tsx`,
  `application/navigation/__tests__/MainTabBar.test.tsx`.
- `apps/mobile/src/features/settings/screens/SettingsScreen.tsx` y
  `screens/__tests__/SettingsScreen.test.tsx`.
- `apps/mobile/{app.json,package.json,jest.config.js}`, `package-lock.json`,
  `package.json`, `firebase.json`.
- `apps/functions/src/{index.ts,account/deleteAccount.ts}`.
- `docs/product/{PRD.md,DESIGN_SYSTEM.md}`, `docs/reference/api-and-theme.md`,
  `docs/explanation/seguridad.md` y este plan.

### Decisiones y ajustes

- Catálogo compartido: ocho nombres de color, ocho emojis; colores reales en tokens.
- Storage y HTTP agrupados en infraestructura `profile`, sin SDK en features.
- `expo-file-system` añadido para copiar foto nativa al directorio persistente.
  Web usa Blob en IndexedDB y referencia opaca; ningún base64 entra en store o nube.
- Metadata usa `mergeFields: ['identity']`: reemplaza mapa completo para quitar
  campos de foto, conserva otros campos de usuario. Semántica de merge solicitada.
- Cola serial y comprobaciones de owner/snapshot descartan respuestas viejas.
  Picker también captura dueño original. Header y sheet no presentan foto anterior.
- `photoPending` evita subir bytes de nuevo al tocar color/detalle; URL existente
  conserva token al actualizar solo metadata. Fallo remoto mantiene copia local.
- Al leer foto con misma versión se conserva archivo local; reemplazo remoto
  retira copia local obsoleta. Quitar foto y borrar cuenta conservan límites pedidos.

### Verificación registrada

- `npm run architecture`: aprobado. `npm run architecture:test`: 12/12 fuera del sandbox.
- `npm run lint`: aprobado; última ejecución de `check` también aprobó lint y Knip.
- `npm run typecheck`: aprobado en última ejecución. Fallos temporales durante
  cambios concurrentes de onboarding fueron resueltos por ese trabajo; no se editaron acá.
- `npm run test --workspace @sui/mobile`: 105 suites, 738 tests aprobados.
  Pruebas posteriores de sesión/header: 2 suites, 6 tests aprobados.
  Identidad/settings/header/i18n/picker: 8 suites, 36 tests aprobados antes de
  añadir los dos tests de sesión. Jest informa handles abiertos tras suite general.
- `npm run functions:build`: aprobado. `npm run functions:test`: aprobado.
  Endpoint/contrato: 7/7; borrado de avatar antes de Firestore/Auth: 1/1.
- `npm run test:rules`: Firestore + Storage, 12/12; sync v9, 8/8.
- `npm run export:web`: aprobado. Prettier sobre fuentes nuevas y modificadas
  de identidad aprobado; `git diff --check` sin errores.
- `npm run check`: detenido en `npm run deps:check` → `Found outdated dependencies`.
  Versiones ya presentes en HEAD: `@expo/ui@57.0.21`, `expo@57.0.26`,
  `expo-auth-session@57.0.13`, `expo-notifications@57.0.21`, `expo-updates@57.0.24`.
  Expo exige siguiente patch de cada una. No se actualizan dependencias ajenas al plan.

### Pendientes y límites

- Desplegar Storage rules y `updateIdentity`; verificar bucket, permisos y entorno.
  No hubo upload a producción ni prueba entre dos dispositivos reales.
- App Check nativo conserva integración actual; enforcement exige soporte nativo
  previo del repo. No se cambió auth ni política de App Check.
- Export web valida bundle; picker, IndexedDB, permisos y reinicio requieren QA
  navegador real. CUA no ofreció browsers/apps, ADB quedó bloqueado por sandbox.
- Contraste/render, lector de pantalla, crop/orientación y carga real de foto
  pendientes QA Android/iOS/web. No se declara validación visual ni release listo.
