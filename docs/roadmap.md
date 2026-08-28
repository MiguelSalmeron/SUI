# Roadmap operativo de Sui

Alcance: [PRD](product/PRD.md). UX/UI: [sistema de diseño](product/DESIGN_SYSTEM.md).

## Completado en código

- [x] Bienvenida breve con cuenta opcional y consentimiento 16+.
- [x] Inicio vacío guiado; nuevos usuarios sin seeds.
- [x] i18n ES/EN persistido.
- [x] Auth correo, Google, Apple iOS e invitado técnico.
- [x] Recuperación de contraseña y verificación por correo.
- [x] Fusión explícita de datos locales/cloud.
- [x] Repositorio local-first v7, outbox, metadata y tombstones.
- [x] Firestore por entidad y migración cloud legado.
- [x] Centro de Conexiones y Google Calendar PKCE sólo lectura.
- [x] Exportación, logout y eliminación completa.
- [x] Reglas Firestore con pruebas Emulator Suite.
- [x] Ambientes EAS, CORS, App Check monitor y telemetría privada.

## Bloqueos externos antes de staging

- [ ] Publicar Términos y Privacidad ES/EN.
- [ ] Crear Firebase/EAS development, staging y production.
- [ ] Configurar Auth, dominios, SHA release y Apple capability.
- [ ] Configurar OAuth Calendar, redirects y secret backend.
- [ ] Configurar App Check web/Android/iOS.
- [ ] Configurar DSN Sentry y revisar retención.
- [ ] Cargar crisis config por país/idioma con revisión legal.
- [ ] Desplegar reglas y Functions en staging.

## Validación release

- [ ] Matriz 320/375/430 dp, tablet/web, temas, texto grande, ES/EN.
- [ ] Auth y fusión en dispositivos reales.
- [ ] Sync con dos dispositivos, offline, duplicados y borrados.
- [ ] Calendar: renovar, revocar, desconectar y caché offline.
- [ ] App Check en monitor; luego enforcement.
- [ ] Builds EAS staging Android/iOS.
- [ ] Rollout gradual por mercado aprobado.

Checklist detallado: [preparar lanzamiento](how-to/production-rollout.md).
