# Conectores fase 2 — qué sumar después de Google Calendar

- **Estado:** plan aprobado para decidir; no implementado
- **Tipo:** ranking con evidencia + arquitectura para los que sí se recomiendan
- **Alcance:** evaluar y priorizar conectores nuevos, y prepares el terreno para que
  agregar un segundo conector no bifurque la pantalla actual
- **Fuera de alcance:** escribir código de conectores, tocar OAuth de Calendar,
  rediseñar Conectores, cambiar sync v9 o el motor de espejo

## 1. CONTEXTO

Hoy hay un solo conector real: Google Calendar, con lectura de agenda y espejo de
metas y hábitos. El contrato `ConnectionProvider`
(`apps/mobile/src/features/connections/types.ts:16`) existe desde el principio
para permitir adaptadores futuros, y `docs/decisions/0006-external-connections.md:20`
dice que Outlook y Apple Calendar podrían usar el mismo contrato.

El pedido es sumar conectores con tres restricciones: **gratis**, **sin revisión
o aprobación de terceros**, y que **de verdad apporten uso**. Esta sección
contrasta la infra que ya existe contra esa triada, y descarta la mayoría de los
candidatos que se ocurren primero.

### 1.1 Restricción que nadie tiene anotada: Calendar sí requiere aprobación

`calendar.readonly` y `calendar.events` son scopes **sensitive** en la
clasificación de Google. Eso implica:

- Verificación de marca (2-3 días hábiles) **más** justificación por scope.
- **Video de demostración en YouTube, en inglés, mostrando el flujo completo del
  grant**. Es una tarea recurrente, no un trámite único.
- Timeline publicado: **10 días hábiles**.
- **Cap de 100 usuarios acumulativo** del proyecto mientras el uso de scopes
  sensitive no esté aprobado. Agotado, Google deshabilita el sign-in. El cap no
  se resetea.

Ningún scope de Calendar es *restricted*, así que no hay CASA ni recertificación
anual. El riesgo es el cap y el video, no el costo.

Implicación directa: **cualquier conector que agreguemos debe poder lanzarse sin
esperar a esa verificación**. Por eso la restricción real, más precisa que
«sin aprobación» en abstracto, es **no depender de scopes sensitive**: un plan que
no pase por el proceso de Google puede salir cuando queramos. Eso define el
ranking completo.

Fuentes: [verification requirements](https://support.google.com/cloud/answer/13464321),
[sensitive scopes](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification),
[cuándo no se requiere](https://support.google.com/cloud/answer/13464323).

### 1.2 Contrato insuficiente para una lista

`ConnectionProvider` no alcanza para renderizar una lista de conectores. Le
falta lo que `ConnectionsScreen` ya lee del hook de Google:

| Falta en el contrato | Dónde se usa hoy |
| --- | --- |
| `lastSyncedAt` | `ConnectionsScreen.tsx:81` |
| `error` | `ConnectionsScreen.tsx:93` |
| `platformHint` | `ConnectionsScreen.tsx:90` |
| `readOnly` / capacidades visibles | `connections.readOnly` ya existe en i18n sin uso |
| `connectAndSync` | `useGoogleCalendar.ts:380` |
| `clearError` | `useGoogleCalendar.ts:384` |

El hook resuelve esto con un cast (`useGoogleCalendar.ts:375`:
`as ConnectionProvider<GoogleEvent[]> & {...}`). Ese cast es exactamente lo que
se va a multiplicar con cada conector nuevo. Cualquier lista de conectores tiene
que empezar por formalizar el contrato, o el segundo adaptador nace con el mismo
parche.

### 1.3 La pantalla está cableada a Google

`ConnectionsScreen` importa `useGoogleCalendar` directo y tiene un solo bloque
JSX de tarjeta, un bloque de espejo y un botón de desconectar. No hay iteración,
ni registro de providers, ni estado compartido. Los switches de espejo viven
adentro del bloque de Google y leen `useSettingsStore`, así que sacarlos a una
tarjeta genérica exige decidir dónde queda ese store.

## 2. RANKING

Criterios, en orden de peso: cabe en el producto, no depende de aprobación,
costo cero, y esfuerzo bajo dado lo que ya existe.

### 2.1 Recomendados

#### A. Google Tasks — el más rentable

| | |
| --- | --- |
| Costo | Gratis. Cuota de cortesía **50.000 queries/día** por proyecto, ajustable. |
| Aprobación | **No.** `tasks` y `tasks.readonly` no figuran como sensitive ni restricted. |
| Registro | Self-serve en el mismo proyecto de Cloud que Calendar. |
| Plataforma | Servidor, o sea iOS, Android y web sin ramas. |

Por qué aporta: Calendar ya resuelve **cuándo**. Tasks resuelve **qué falta hacer**,
que es la otra mitad de una meta. El espejo actual escribe eventos con fecha;
una meta sin fecha ni horario no aparece en ningún lado. Tasks cubre metas sin fecha y
hábitos diarios sin horario, que hoy viven sólo dentro de Sui.

Reutiliza casi todo: mismo `ConnectionProvider`, mismo OAuth Authorization Code +
PKCE, mismo patrón de refresh token en servidor, misma cola de espejo. Lo nuevo
es un mapper, porque el modelo de datos es plano: `tasks.list` con `tasklists`,
`items` con `due.dateTime`, `status`, `title`, `notes`.

Detalles que hay que respetar:

- **No hay push.** La API es sólo polling. La estrategia es `updatedMin` más
  `showCompleted`, que es el mecanismo soportado.
- El refresh token vive en `users/{uid}/connections/tasks`, nunca en cliente.
- Un `tasklist` dedicado por usuario, mismo criterio que el calendario "Sui".

Riesgo: bajo. El riesgo real es de diseño — duplicar metas entre Calendar y
Tasks. Se resuelve con una sola fuente de verdad: **Sui manda, Google recibe**.
Tasks no importa de vuelta hacia Sui en v1.

#### B. Telegram Bot API — el canal del Accountability

| | |
| --- | --- |
| Costo | Gratis. Sin SLA. |
| Aprobación | **Ninguna.** Token con `/newbot` en `@BotFather`, instantáneo. |
| Límites | 1 msg/s en chat privado, 20/min en grupo, ~30/s broadcast. |
| Plataforma | Todas, porque es un bot que corre en nuestro servidor. |

Por qué aporta: `docs/product/ACCOUNTABILITY_PLAN.md` define el seguimiento duro
—"en progreso", "no pude", "reprogramar", "cerrar"— y hoy el MVP es local-only con
notificaciones del sistema operativo. Telegram da dos cosas que el SO no:

1. **Un canal que la persona ya abre todos los días**, sin depender de que
   permita notificaciones.
2. **Botones inline de check-in.** Responder "no pude" con un toque alimenta el
   ciclo de check-in que el plan declara incompleto en `2.2.5`, sin construir
   todavía el motor completo.

Se puede montar como **alcance opcional**, no como obligación: el
recordatorio nocturno local se queda como es, Telegram suma un segundo canal.

Riesgos: superficie de datos nueva en el servidor, y dependencia de un tercero
que puede cambiar terms. Se acota guardando sólo `chat_id` y el estado del
check-in, nunca el contenido.

#### C. Deep links y App Intents — captura, no integración

| | |
| --- | --- |
| Costo | Gratis. |
| Aprobación | **Ninguna.** App Shortcuts están disponibles desde que se instala la app. |
| Límite | 10 app shortcuts por app. |

Por qué aporta: ataca la métrica de `PRD.md:59` —primera acción útil en menos de
90 segundos— desde el otro lado. Hoy capturar una idea fuera de Sui exige abrir la
app, navegar a Metas y llenar el formulario. Un `sui://nueva-meta?title=...`
desde el share sheet de iOS o un App Intent "Guardar en Sui" lo deja en dos toques.

No es «conectar otra app» en el sentido de OAuth, pero es la acción de conector
con mejor retorno del proyecto y la que más usa la gente. Sugerimos
implementarla **antes** que B, porque es barata y desbloquea la métrica.

Detalle técnico: los custom URL schemes no se pueden reclamar de forma exclusiva
en iOS; conviene universal links con `assetlinks.json` en Android.

### 2.2 Descartados, con motivo

| Candidato | Por qué no |
| --- | --- |
| **Outlook / Microsoft Graph** | Self-serve y gratis, pero el gate real es el admin de cada empresa: si el tenant tiene *user consent* deshabilitado, cada cliente necesita aprobar la app. Eso es un problema de onboarding y soporte, no técnico. Además `Calendars.Read` es el equivalente del Calendar que ya arrastra verificación. |
| **Apple Calendar / Reminders (EventKit)** | Cero gate de Apple, pero **sólo iOS**, y Sui nace Android-first. Además desde iOS 17 Reminders no tiene write-only: o acceso completo o nada. Se deja para una fase iOS-first. |
| **Todoist** | Self-serve, gratis, bien resuelto. Pero duplica el dominio de metas de Sui. La regla de `VERSION_FINAL.md:215` aplica: conector que no aporta contexto estorba. |
| **Notion** | La documentación oficial se contradice sobre si la *public connection* pasa por review. Rate limit global de 3 req/s. Autorización por usuario y por workspace. No se puede afirmar que sea self-serve en producción. |
| **GitHub** | Confirmado self-serve y sin review, pero OAuth apps sólo actúan en nombre de un usuario: si se va de la organización, la integración se rompe. El caso de uso (abrir PR desde una tarea) no es el de Sui. |
| **Apple HealthKit** | Sin pre-aprobación, pero guideline **2.5.1**: un task manager que lee datos de fitness es uso marginal, y **5.1.1(ix)** exige entidad legal, no individuo, en campos regulados. Rechazo probable. |
| **Android Health Connect** | Contradecía el supuesto: **Google Play sí revisa el acceso**. La *health apps declaration* es obligatoria desde 2024 para todas las apps, y el acceso a health & fitness se somete a revisión. Además `expo-health-connect` está deprecado y archivado. |
| **Spotify** | La app arranca en development mode: **5 usuarios**, en allowlist, y requiere Premium del dueño. Extended quota exige **250.000 MAU** y review de hasta 6 semanas. Inalcanzable. |
| **WhatsApp Business** | Cloud API gratis hasta 1.000 conversaciones/mes, pero exige verificación de negocio. Y `HACKATHON_ENTREGABLES.md:311` ya lo trata como entregable de hackathon, no como parte de la app. |
| **Zapier** | El plan Free son 100 tasks/mes y **los webhooks no están en Free**. Son $19.99/mes desde el día uno. Si queremos webhooks, los hacemos nosotros: una Cloud Function es más simple que una dependencia de terceros. |
| **n8n** | Self-host es gratis, pero la licencia prohíbe exactamente lo que querríamos: exponer un editor de workflows a los usuarios finales. Como motor interno sí; como producto para la gente, no. |

## 3. DECISIÓN

**Se inician dos conectores, en este orden:**

1. **Deep links / App Intents** — barata, sin backend, ataca la métrica de 90 s.
   **No implementada en esta pasada.** Queda como trabajo pendiente.
2. **Google Tasks** — mismo contrato que Calendar, misma infra, sin verificación.
   **Implementado el 2026-10-07** (ver §12).

**Telegram queda aprobado como decisión de producto separada**, porque toca
Accountability y ese MVP es local-only por diseño (`ACCOUNTABILITY_PLAN.md`, §1).
Mezclarlo con conectores rompe la frontera que ese plan acaba de congelar.

**Los demás quedan en un documento de "no ahora"** con el motivo, para no
re-litigarlos en cada reunión.

## 4. ARQUITECTURA PARA EL SEGUNDO CONECTOR

Esto es lo que hay que hacer **antes** de escribir Tasks, o se hace dos veces.

### 4.1 Completar el contrato

Extender `ConnectionProvider` con lo que la UI ya consume hoy, y borrar el cast
de `useGoogleCalendar.ts:375`:

```ts
export interface ConnectionProvider<TData> {
  id: string;
  /** Nombre visible. La i18n resuelve por `id`, no por texto hardcodeado. */
  labelKey: TranslationKey;
  status: ConnectionStatus;
  connected: boolean;
  configured: boolean;
  capabilities: ConnectionCapabilities;
  /** Lo que esta UI necesita y el contrato no tenía. */
  lastSyncedAt: number | null;
  error: string | null;
  platformHint: string | null;
  data: TData;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sync: () => Promise<boolean>;
  clearError: () => void;
}
```

`readOnly` no va en el contrato: sale de `capabilities` (`read`, `write`,
`backgroundSync` ya lo modelan). La clave `connections.readOnly` se usa con
`capabilities.write === false`.

### 4.2 Registro de providers

Un `connections/registry.ts` que devuelve la lista ordenada de providers
disponibles. La pantalla itera; no conoce implementaciones.

```ts
export type ConnectionDefinition = {
  id: string;
  labelKey: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  /** Si el provider está configurado en este entorno. `configured: false` se oculta. */
  enabled: () => boolean;
  useProvider: () => ConnectionProvider<unknown>;
};
```

Regla de `enabled()`: **un provider no configurado no se renderiza**. No se
muestra apagado, no dice «próximamente». Es lo mismo que ya hace Calendar con
`configured` en `ConnectionsScreen.tsx:110`, y lo que el plan de Conectores ya
exigió en `ajustes-conectores.md:45`. La pantalla no promete lo que no existe.

La forma `{ labelKey, icon }` no es invento: ya existe en
`home/screens/OverviewScreen.tsx:44`. Se copia ese patrón para que el registro se
lea igual que el resto del código.

### 4.3 Tarjeta genérica

Extraer la tarjeta a `connections/components/ConnectionCard.tsx`. Las piezas que
se mueven tal cual: badge de estado, `syncing` en texto sin bloquear, `reauthHint`,
fecha de última sincronización, `error`, botón conectar/actualizar, desconectar.

Las que **no** se mueven y hay que decidir:

- **Los switches de espejo.** Hoy leen `useSettingsStore` y están dentro del bloque
  de Google. Con dos conectores, cada uno puede tener espejo o no. Propuesta: que
  el provider exponga sus preferencias de espejo y la tarjeta genérica las monte
  sobre los setters que ya existen. `useMirrorEffects` no se toca.
- **El subtítulo.** `connections.subtitle` hoy dice "Conectá Google Calendar sólo
  cuando lo necesités", en singular. Con dos conectores tiene que hablar en
  plural y dejar de nombrar uno: algo como «Conectá las apps que usás, sólo cuando
  las necesités.» Clave nueva, ES y EN.

### 4.4 i18n

Todo texto nuevo en ES y EN en `shared/i18n/messages/connections.ts`. Los
errores de Tasks reutilizan el patrón de `connections.error*` pero necesitan
claves propias: los de Google hablan de Google y de Calendar.

`TranslationKey` se deriva de `translations.es`
(`shared/i18n/translations.ts:102`), así que agregar una clave sólo en ES **no**
rompe el typecheck: la caza `i18n.test.ts`, que verifica que ES y EN tengan
claves idénticas. Por eso la regla es correr ese test, no confiar en el
compilador.

## 5. ARCHIVOS

Si se aprueba, para **Tasks + deep links**:

- `apps/mobile/src/features/connections/types.ts` — contrato completo (§4.1)
- `apps/mobile/src/features/connections/registry.ts` — nuevo
- `apps/mobile/src/features/connections/components/ConnectionCard.tsx` — nuevo
- `apps/mobile/src/features/connections/features/tasks/` — nuevo, si se mantiene
  `tasks` dentro de `connections` y no como `features/tasks` aparte
- `apps/mobile/src/features/calendar/hooks/useGoogleCalendar.ts` — quitar el cast
  de la línea 375
- `apps/mobile/src/features/settings/screens/ConnectionsScreen.tsx` — iterar
- `apps/mobile/src/features/settings/screens/__tests__/ConnectionsScreen.test.tsx`
- `apps/mobile/src/shared/i18n/messages/connections.ts`
- `apps/functions/src/connections/tasksApi.ts` — nuevo
- `apps/functions/src/connections/googleTasks.ts` — nuevo
- `apps/functions/src/connections/taskMirrorMapper.ts` — nuevo
- `apps/functions/src/index.ts` — exports
- `apps/functions/src/account/deleteAccount.ts` — revocar y borrar la conexión
- `docs/decisions/0006-external-connections.md` — registrar el conector nuevo
- `docs/product/PRD.md` §9 — §244 dice que Outlook y Apple están fuera de v1;
  Tasks entra, así que la sección cambia

No tocar: `features/calendar/services/**`, `calendarAuth.ts`, la cola de espejo,
`apps/mobile/src/shared/domain/productivity/**`, sync v9, `package.json`.

## 6. SEGURIDAD

Igual que Calendar, sin excepciones:

- Refresh token **sólo** en Firestore del backend. El cliente guarda eventos
  normalizados, nunca tokens.
- Allowlist de Client IDs en el backend. `tasksConnect` rechaza lo que no esté en
  la lista, igual que `googleCalendarConnect:258`.
- Secretos en Secret Manager, nunca en `defineString` con default.
- Desconectar revoca en el proveedor **y** borra la caché local.
- `deleteAccount` tiene que revocar Tasks igual que revoca Calendar hoy. Si se
  olvida, queda acceso granting tras la eliminación de la cuenta, y `PRD.md:233`
  lo exige explícitamente.
- Tasks es *no sensitive*, pero la pantalla de consentimiento de Google **sigue
  mostrando «app no verificada»** si el proyecto tiene Calendar sin verificar.
  No es culpa de Tasks, pero hay que saberlo antes de culpar a Tasks.

## 7. TESTS

`ConnectionsScreen` con registry mockeado:

- Con dos providers en el registro, se renderizan dos tarjetas.
- Con un provider no configurado, **no** se renderiza ninguna tarjeta y no hay
  texto de «próximamente» en el árbol.
- Los switches de espejo sólo aparecen con el provider que los declara.
- Los estados `connecting`, `syncing`, `reauthRequired` y la cola pendiente siguen
  comportándose como hoy.

Backend:

- `tasksConnect` rechaza client ID fuera de la allowlist.
- El refresh conserva el `refresh_token` previo cuando Google no devuelve uno.
- La escritura es idempotente por fingerprint, como el espejo de Calendar.
- `deleteAccount` revoca Tasks.

## 8. CRITERIOS DE ACEPTACIÓN

- El contrato `ConnectionProvider` no necesita casts para renderizarse.
- Agregar un provider es un archivo nuevo más una línea en el registro, sin tocar
  `ConnectionsScreen`.
- Un provider no configurado no aparece en pantalla.
- Deep links: una meta se crea desde fuera en dos toques, sin abrir el formulario.
- Tasks: una meta sin fecha aparece en el tasklist del usuario.
- `connections.subtitle` habla en plural y no nombra un solo proveedor.
- ES y EN completos para toda clave nueva.
- Cero dependencias nuevas.
- `npm run check` en verde, o si `test:rules` falla por falta de Java y
  emulador, se reporta y se deja constancia de qué sí corrió.

## 9. ROLLBACK

Cada parte es independiente. Deep links y el registro de providers se revierten
por diff. Tasks se revierte con un flag `PRODUCT_CONFIG`, el mismo mecanismo que
usa `engagementEnabled` en Ajustes. Borrar el documento `users/{uid}/connections/tasks`
deja el cliente en estado desconectado sin necesidad de migración: el cliente
trata documento inexistente como desconectado.

## 12. IMPLEMENTACIÓN 2026-10-07 (contrato + Tasks)

Se implementaron las secciones 4 (arquitectura), 5 (archivos), 6 (seguridad) y 7
(tests) para Tasks. Deep links queda pendiente.

Desvíos respecto al plan, con motivo:

- **Tasks es feature propio (`features/tasks/`), no carpeta dentro de
  `connections/`.** El barrel de `connections` exporta el hook y arrastraba
  firebase, Sentry y `expo-auth-session` a cualquier consumidor de la tarjeta
  (incluidos los tests). Separado, `connections/public` sigue liviano. El check
  de arquitectura lo confirma: 13 features en verde.
- **El registro vive en `features/settings/connectionRegistry.ts`, no en
  `features/connections/registry.ts`.** Un registro en `connections` que importe
  `calendar` cerraría el ciclo `calendar → connections → calendar` y el check
  fallaría con `feature cycle`. `settings` ya depende de ambos.
- **`connectAndSync` no entró al contrato.** `connect` de Calendar ya era esa
  función; no había dos formas de conectar, sólo un alias en el cast. Se eliminó
  el alias y `connect` es la única vía.
- **`capabilities.write` de Calendar pasó a `true`.** Decía `false` pero el
  espejo escribe eventos con `calendar.events`: el contrato contradecía el
  comportamiento real.
- **La cola de espejo y sus switches son de Calendar, no genéricos.** La primera
  versión de `ConnectionSection` le mostraba la cola de Calendar a todos los
  providers; un test lo cazó y se acotó con `hasMirror`.
- **`ConnectionApiError` y `androidReverseRedirectUri` se reexportan desde
  `calendar/public`.** Tasks los reutiliza sin importar servicios internos de
  Calendar, que el check de arquitectura prohíbe cruzar por fuera de `public`.
- **Mocks nuevos `__mocks__/expo-auth-session.js` y `expo-web-browser.js`.**
  Siguen la convención de los ocho mocks `expo-*` existentes: el paquete es ESM
  sin transpilar y ningún test ejercita OAuth real.

## 10. LO QUE ESTE PLAN NO RESUELVE

- El cap de 100 usuarios por `calendar.readonly`. Es independiente de Tasks y
  hay que atacarlo por separado: preparar el video de demo y pedir la
  verificación. Mientras tanto, cualquier lanzamiento público es un riesgo de
  corte de sign-in.
- El switch de espejo vive en `useSettingsStore`, no por conector. Si cada
  provider necesita preferencias propias, hace falta decidir si se generaliza el
  store o se deja por provider. §4.3 lo evita, no lo resuelve.
- Telegram toca Accountability y necesita su propio plan.

## 11. FUERA DE ALCANCE

- Cambiar OAuth, tokens, `googleCalendarConnect`, `googleCalendarSync` o el espejo.
- Escribir hacia calendarios externos más allá del espejo existente.
- Notificaciones por webhooks genéricos a URL del usuario. Es viable y sin
  aprobación, pero necesita allowlist anti-SSRF, secreto firmado y bloqueo de
  puertos privados. Es un conector entero, no una línea.
- Reordenar o rediseñar Ajustes: eso ya lo resuelve `ajustes-conectores.md`.
- Cualquier cambio en sync v9, el outbox o la persistencia local.
