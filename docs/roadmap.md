# Roadmap operativo de Sui

Alcance: [PRD](product/PRD.md). UX/UI: [sistema de diseño](product/DESIGN_SYSTEM.md).
Evaluación externa: [entregables del Hackathon](product/HACKATHON_ENTREGABLES.md).

## Completado en código

- [x] Bienvenida breve con cuenta opcional y confirmación 18+.
- [x] Flujo de onboarding modular (FTUX) con intención declarada, animaciones nativas a 60fps y spotlight guiado contextual.
- [x] Remediación de estabilidad: navegación hardware Android, blindaje Google Calendar local, clasificación offline precisa y escalado Cloud Function a 512MiB.
- [x] Inicio vacío guiado; nuevos usuarios sin datos de ejemplo.
- [x] Siembra de arranque según la intención elegida: el usuario entra a Inicio con
      una meta o un hábito de ejemplo (nunca historial, nunca espejo a Google),
      vista previa literal antes de confirmar y aviso con _Personalizar_ o
      _Descartar_. Medido con `onboarding.first_action`.
- [x] i18n ES/EN persistido.
- [x] Auth correo, Google, Apple iOS e invitado técnico.
- [x] Recuperación de contraseña y verificación por correo.
- [x] Fusión explícita de datos locales/cloud.
- [x] Repositorio local-first v9, outbox, CAS servidor y tombstones de 90 días.
- [x] Sync batch por Cloud Function, pull incremental y compactación por epoch.
- [x] Centro de Conexiones y Google Calendar PKCE (lectura + espejo de metas/hábitos con `calendar.events`).
- [x] Exportación, logout y eliminación completa.
- [x] Reglas Firestore con pruebas Emulator Suite.
- [x] Perfiles EAS, CORS, App Check web/monitor y telemetría privada en código.
- [x] Edición contextual de Metas/Hábitos con fecha exacta y frecuencia semanal.
- [x] Permiso de notificaciones contextual, recordatorio local y reconciliación sin prompt.
- [x] Preferencias con radios, contenido responsive y targets accesibles.
- [x] Sugerencias de Chat controladas y listas principales virtualizadas.

## Próxima iniciativa de producto: Accountability

Plan completo: [seguimiento personalizado y exigente](product/ACCOUNTABILITY_PLAN.md).
Decisión arquitectónica: [ADR-0008](decisions/0008-accountability-follow-up.md).

Estado: planificación aprobada; no implementado. El MVP será local-only y no
modificará productividad v9, el outbox ni la sincronización Firebase.

Decisiones congeladas:

- [x] Estado de Accountability en `sui-accountability-v1` independiente.
- [x] Sin sincronización cloud en el MVP.
- [x] Ownership separado del agente de datos.
- [x] Sync futuro sólo después de validar uso real.

Gates iniciales:

- [x] Definir contrato local y fixtures de migración.
- [ ] Ejecutar spike de scheduling Android/iOS/Web.
- [x] Validar límites de frecuencia, quiet hours y copy ES/EN.
- [x] Integrar limpieza con logout, eliminación y exportación.
- [x] Activar sólo detrás de `EXPO_PUBLIC_ACCOUNTABILITY_ENABLED` hasta completar UAT.

## Deuda técnica conocida

- [ ] `expo-system-ui`: añadido a `package.json` (lo exige `userInterfaceStyle: automatic`),
      pero requiere rebuild nativo; `android/` es prebuilt y está gitignored.
- [ ] `deps:check` ya fallaba en `main` con 14 paquetes Expo desactualizados (`expo`,
      `@expo/ui`, `@expo/metro-runtime`, `expo-notifications`, `expo-web-browser`…). No lo
      introdujo el refactor; abordar en un PR aparte con rebuild y prueba en dispositivo.
- [ ] Archivos grandes pendientes de partir: `OverviewScreen.tsx`, `useProductivityStore.ts`,
      `productivityRepository.ts`, `theme.ts`.
- [ ] `NightlyReportModal.tsx` está sin referencias y se conserva como WIP; knip lo ignora
      de forma explícita mientras siga en uso.

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
