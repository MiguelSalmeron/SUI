# Roadmap operativo de Sui

Alcance: [PRD](product/PRD.md). UX/UI: [sistema de diseño](product/DESIGN_SYSTEM.md).

## Completado en código

- [x] Bienvenida breve con cuenta opcional y consentimiento 16+.
- [x] Inicio vacío guiado; nuevos usuarios sin datos de ejemplo.
- [x] i18n ES/EN persistido.
- [x] Auth correo, Google, Apple iOS e invitado técnico.
- [x] Recuperación de contraseña y verificación por correo.
- [x] Fusión explícita de datos locales/cloud.
- [x] Repositorio local-first v9, outbox, CAS servidor y tombstones de 90 días.
- [x] Sync batch por Cloud Function, pull incremental y compactación por epoch.
- [x] Centro de Conexiones y Google Calendar PKCE sólo lectura.
- [x] Exportación, logout y eliminación completa.
- [x] Reglas Firestore con pruebas Emulator Suite.
- [x] Perfiles EAS, CORS, App Check web/monitor y telemetría privada en código.
- [x] Edición contextual de Metas/Hábitos con fecha exacta y frecuencia semanal.
- [x] Permiso de notificaciones contextual, recordatorio local y reconciliación sin prompt.
- [x] Preferencias con radios, contenido responsive y targets accesibles.
- [x] Sugerencias de Chat controladas y listas principales virtualizadas.

## Bloqueos externos antes de staging

- [ ] Publicar Términos y Privacidad ES/EN.
- [ ] Crear Firebase/EAS development, staging y production.
- [ ] Configurar Auth, dominios, SHA release y Apple capability.
- [ ] Configurar OAuth Calendar, redirects y secret backend.
- [ ] Configurar App Check web/Android/iOS.
- [ ] Configurar DSN Sentry y revisar retención.
- [ ] Cargar crisis config por país/idioma con revisión legal.
- [ ] Desplegar Function v9, reglas/índices y luego cliente v9 en staging.

## Validación release

- [ ] Matriz 320/375/430 dp, tablet/web, temas, texto grande, ES/EN.
- [ ] Auth y fusión en dispositivos reales.
- [ ] Sync con dos dispositivos, offline, duplicados y borrados.
- [ ] Calendar: renovar, revocar, desconectar y caché offline.
- [ ] App Check en monitor; luego enforcement.
- [ ] Builds EAS staging Android/iOS.
- [ ] Rollout gradual por mercado aprobado.

Checklist detallado: [preparar lanzamiento](how-to/production-rollout.md).
