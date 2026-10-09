# Prompt para Codex — Contrato de conectores + Google Tasks

Pegá este texto como instrucción. La especificación `docs/plans/conectores-fase-2.md`
manda sobre este prompt si algo se contradice. Ese plan es largo y tiene un ranking
completo: leé al menos las secciones 1.2, 1.3, 3, 4 y 6. Lo demás es contexto que
no aplica a este trabajo.

No implementes nada que el plan marque fuera de alcance. No hagas commit ni push.

---

## Qué tenés que lograr

Dos cosas, en este orden. La primera es la importante: sin ella, el segundo
conector nace con el mismo parche que hoy tiene Google.

**Parte 1 — el contrato y el registro.** Que `ConnectionsScreen` itere una lista de
providers en vez de estar cableada a Google.

**Parte 2 — Google Tasks.** El primer adaptador real que prueba que la parte 1
sirve.

## Parte 1: contrato y registro

`ConnectionProvider` hoy no alcanza para renderizar una lista. La pantalla ya lee
campos que el contrato no declara, y el hook lo resuelve con un cast:

`apps/mobile/src/features/calendar/hooks/useGoogleCalendar.ts:375`

```ts
) as ConnectionProvider<GoogleEvent[]> & {
```

Agregá al contrato lo que la UI ya consume, y **borrá ese cast**:

- `labelKey: TranslationKey` — la i18n resuelve por clave, no por texto fijo.
- `lastSyncedAt: number | null`
- `error: string | null`
- `platformHint: string | null`
- `clearError: () => void`

No agregues `readOnly`: `capabilities { read, write, backgroundSync }` ya lo
modelan. La clave `connections.readOnly` existe en i18n sin uso y se satisface con
`capabilities.write === false`.

`connectAndSync` que también aparece en el cast: decidí si entra al contrato o si
se implementa en la tarjeta genérica como `connect()` seguido de `sync()`. Si lo
dejás fuera del contrato, justificá por qué. No dejes dos formas de conectar.

Después creá `apps/mobile/src/features/connections/registry.ts` con la lista
ordenada de providers y un `enabled()` por provider. **Un provider no configurado
no se renderiza.** No se muestra apagado, no dice «próximamente», no ocupa fila.
Es la regla que ya aplica `configured` en `ConnectionsScreen.tsx:110` y que el plan
de Conectores exigía en `docs/plans/ajustes-conectores.md:45`.

Después extraé la tarjeta a
`apps/mobile/src/features/connections/components/ConnectionCard.tsx`. Se mueven tal
cual: badge de estado, `syncing` en texto sin bloquear, `reauthHint`, fecha de
última sincronización, `error`, botón conectar/actualizar, desconectar.

## Parte 2: Google Tasks

`docs/plans/conectores-fase-2.md` §2.1 A tiene el detalle del API. Lo esencial:

- Scope `https://www.googleapis.com/auth/tasks`. **No sensitive**, así que no
  dispara verificación de Google. Confirmá el candado en Cloud Console → Data
  Access antes de comprometerte.
- **Tasks no empuja nada.** Es sólo polling. Sincronizá con `updatedMin` más
  `showCompleted`.
- Refresh token sólo en Firestore, en `users/{uid}/connections/tasks`. El cliente
  guarda tareas normalizadas, nunca tokens. Nunca al revés.
- Allowlist de Client IDs en el backend, como en `googleCalendarConnect:258`.
- Un `tasklist` dedicado por usuario, mismo criterio que el calendario "Sui".
- **Sui manda, Tasks recibe.** En v1 Tasks no importa de vuelta hacia Sui.
- Idempotencia por fingerprint, como el espejo de Calendar.
- `apps/functions/src/account/deleteAccount.ts:41` revoca Calendar con
  `disconnectGoogleCalendarForUser`. **Tasks tiene que revocarse igual**, o queda
  acceso vivo después de que la persona borra su cuenta. `docs/product/PRD.md:233`
  lo exige.

## Archivos

**Tocar:**

- `apps/mobile/src/features/connections/types.ts` — contrato de la §4.1 del plan
- `apps/mobile/src/features/connections/registry.ts` — nuevo
- `apps/mobile/src/features/connections/components/ConnectionCard.tsx` — nuevo
- `apps/mobile/src/features/connections/public.ts` — el archivo existe y exporta
  sólo tipos; agregá lo que el registro necesite
- `apps/mobile/src/features/calendar/hooks/useGoogleCalendar.ts` — quitar el cast
  de la línea 375
- `apps/mobile/src/features/settings/screens/ConnectionsScreen.tsx` — iterar
- `apps/mobile/src/features/settings/screens/__tests__/ConnectionsScreen.test.tsx`
- `apps/mobile/src/shared/i18n/messages/connections.ts`
- `apps/functions/src/connections/tasksApi.ts` — nuevo
- `apps/functions/src/connections/googleTasks.ts` — nuevo
- `apps/functions/src/connections/taskMirrorMapper.ts` — nuevo
- `apps/functions/src/index.ts` — exports
- `apps/functions/src/account/deleteAccount.ts` — revocar Tasks
- `docs/decisions/0006-external-connections.md`
- `docs/product/PRD.md` §9 — la línea 244 dice que Outlook y Apple quedan fuera de
  v1; Tasks entra, así que la sección cambia
- `apps/mobile/src/shared/config/product.ts` — flag `tasksEnabled`, como §9 del
  plan pide para el rollback

**Leer antes de editar:** `ConnectionsScreen.tsx`, `useGoogleCalendar.ts`,
`features/calendar/services/googleSync.ts`, `apps/functions/src/connections/googleCalendar.ts`
y `googleApi.ts`, `messages/connections.ts`, `useMirrorEffects.ts`,
`useSettingsStore.ts`, `features/connections/types.ts`.

**No tocar:** `features/calendar/services/**`, `calendarAuth.ts`, la cola de espejo,
`shared/domain/productivity/**`, sync v9, el outbox, `package.json`.

## Hechos que condicionan el cambio

- **Este repo NO usa Expo Router.** Usa React Navigation. Si buscás un directorio
  `app/` para los deep links no lo vas a encontrar. El linking va en el
  `NavigationContainer` de `apps/mobile/src/application/navigation/AppNavigator.tsx`,
  que hoy no tiene prop `linking`.
- `scripts/check-architecture.mjs` define un feature como un directorio **directo**
  bajo `features/` (línea 161). Por lo tanto `features/connections/tasks/` **no es
  un feature**: no necesita `public.ts` propio, y `npm run architecture` sigue
  verde. Adentro de un feature los imports van por ruta relativa, nunca
  `@/features/...` (línea 210), porque el check rechaza imports de feature
  consigo mismo.
- Si decidís que Tasks sea feature de primer nivel (`features/tasks/`), entonces
  **sí** necesita `public.ts`, y `ConnectionsScreen` —que vive en
  `features/settings/`— tendría que importarlo por `@/features/tasks/public`.
  Recordá que `ConnectionsScreen` hoy importa Calendar justo así, y que el check
  arma un grafo de features y falla con `feature cycle` si Tasks dependiera de
  Calendar mientras Calendar dependiera de Tasks.
- `useMirrorEffects.ts` ya lee `useSettingsStore`. Los switches de espejo
  (`mirrorGoalsEnabled`, `mirrorHabitsEnabled`, en `@sui/settings-v1`, defaults:
  metas on, hábitos off) **no se mueven de store** en esta pasada. No cambies la
  forma persistida ni los defaults.
- La ruta de navegación se llama `Connections` y `CalendarScreen.tsx` navega ahí.
  No la renombres, no renombres `ConnectionsScreen.tsx`, no toques el export de
  `settings/public.ts`.
- `ScreenIntro` exige `title` y `subtitle`. No lo modifiques.
- `connections.subtitle` hoy dice «Conectá Google Calendar sólo cuando lo
  necesités», en singular y nombrando un solo proveedor. Con dos conectores tiene
  que hablar en plural y dejar de nombrar uno. Clave nueva, ES y EN.
- `TranslationKey` sale de `translations.es` (`shared/i18n/translations.ts:102`).
  Agregar una clave sólo en ES **no rompe el typecheck** — la caza
  `i18n.test.ts`, que verifica que ES y EN tengan claves idénticas. Corré ese test.
- El patrón `{ labelKey, icon }` ya existe en
  `features/home/screens/OverviewScreen.tsx:44`. Copialo, no inventes otro.
- `app.json:9` ya declara `"scheme": ["sui", "com.sui.app"]`. Los universal links
  de Android (`assetlinks.json`) son fuera de alcance.

## Definición de listo

- El contrato `ConnectionProvider` renderiza la tarjeta **sin casts**.
- Agregar un provider es un archivo nuevo más una línea en el registro, sin tocar
  `ConnectionsScreen`.
- Un provider con `enabled()` en falso no aparece en pantalla, y no queda texto de
  «próximamente» en el árbol de render.
- El texto de `connections.subtitle` no nombra un solo proveedor.
- Una meta sin fecha llega al tasklist del usuario.
- Borrar la cuenta revoca Tasks, igual que revoca Calendar.
- Tests de `ConnectionsScreen` actualizados a la UI de lista, y los de Calendar
  siguen verdes.
- ES y EN completos para toda clave nueva.
- Cero dependencias nuevas.
- `npm run architecture` en verde.

## Verificación

`npm run architecture` primero, porque el límite de features es lo que más fácil
se rompe acá. Después los tests del área desde `apps/mobile`:

```
cd apps/mobile && npx jest src/features/settings src/features/calendar
```

Si tocaste Functions: `npm run functions:build` y `npm run functions:test`.

Si podés, `npm run check`. Termina en `test:rules`, que pide Java y el emulador de
Firestore. Si falla por entorno, **no lo arregles**: reportá qué sí corrió
(architecture, lint, typecheck, tests del área).

Al terminar devolvé: archivos tocados, cómo resolviste `connectAndSync`, las
decisiones de copy, y el resultado de los tests. No abras PR.
