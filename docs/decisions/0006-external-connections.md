# ADR-0006: conexiones externas aisladas

- Estado: aceptado
- Fecha: 2026-08-27

## Contexto

Usar identidad Google como permiso de Calendar mezcla dos consentimientos. Guardar tokens OAuth en cliente expone credenciales renovables.

## Decisión

Autenticación y conexiones son flujos independientes. `Ajustes → Conexiones` aloja integraciones; Agenda sólo muestra CTA contextual.

`ConnectionProvider` define estado, capacidades, conexión, sincronización y desconexión. Google Calendar v1 es sólo lectura.

OAuth usa Authorization Code + PKCE. Cliente recibe código temporal; backend intercambia y renueva tokens. Refresh token vive exclusivamente en almacenamiento servidor. Cliente guarda eventos normalizados, nunca tokens. Desconectar revoca acceso y borra caché.

## Consecuencias

Onboarding y login no solicitan Calendar. Backend necesita allowlist de Client IDs, redirect URIs y secreto web. Outlook y Apple Calendar podrán implementar mismo contrato sin alterar pantallas consumidoras.
