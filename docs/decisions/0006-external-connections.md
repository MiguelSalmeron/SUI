# ADR-0006: conexiones externas aisladas

- Estado: aceptado
- Fecha: 2026-08-27
- Enmienda: 2026-10-07 — segundo conector (Google Tasks) y contrato completo

## Contexto

Usar identidad Google como permiso de Calendar mezcla dos consentimientos. Guardar tokens OAuth en cliente expone credenciales renovables.

## Decisión

Autenticación y conexiones son flujos independientes. `Ajustes → Conexiones` aloja integraciones; Agenda sólo muestra CTA contextual.

`ConnectionProvider` define estado, capacidades, conexión, sincronización y desconexión. Google Calendar v1 lee la agenda y espeja metas/hábitos en el calendario primario del usuario (scope `calendar.events`).

OAuth usa Authorization Code + PKCE. Cliente recibe código temporal; backend intercambia y renueva tokens. Refresh token vive exclusivamente en almacenamiento servidor. Cliente guarda eventos normalizados, nunca tokens. Desconectar revoca acceso y borra caché.

## Enmienda 2026-10-07: Tasks y contrato completo

Google Tasks es el segundo adaptador del mismo contrato. Cada conexión OAuth es
un consentimiento separado con su propio documento en
`users/{uid}/connections/`: Calendar y Tasks no comparten tokens aunque usen el
mismo Client ID.

El contrato creció con lo que la tarjeta ya consumía (`labelKey`,
`lastSyncedAt`, `error`, `platformHint`, `clearError`); el cast de
`useGoogleCalendar` se eliminó. La pantalla itera un registro en vez de estar
cableada a un provider, y un provider no configurado no se renderiza.

Tasks no exige fecha: cubre metas y hábitos que Calendar no puede espejar. La
API no empuja cambios (sólo polling) y el espejo es unidireccional Sui → Tasks,
sin import inverso. Vive atrás del flag `googleTasksEnabled` hasta aprobar su
alcance en producción.

## Consecuencias

Onboarding y login no solicitan Calendar. Backend necesita allowlist de Client IDs, redirect URIs y secreto web. Outlook y Apple Calendar podrán implementar mismo contrato sin alterar pantallas consumidoras.

`deleteAccount` revoca cada conexión antes del borrado recursivo: después ya no
queda token con qué revocar en el proveedor.
