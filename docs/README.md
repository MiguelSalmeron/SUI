# Documentación de Sui

## Fuentes canónicas

- [PRD](product/PRD.md): visión, alcance, requisitos y criterios de release.
- [Sistema de diseño](product/DESIGN_SYSTEM.md): UX, UI, marca, componentes y
  patrones vigentes.
- [Arquitectura](explanation/architecture.md): límites técnicos y flujos.
- [Roadmap](roadmap.md): estado y próximos gates.

Si documento contradice estas fuentes, PRD define producto; sistema de diseño
define interfaz; ADR más reciente define decisión técnica.

## Empezar

- [Primeros pasos](tutorials/getting-started.md)
- [Guía del desarrollador](reference/developer-guide.md)
- [API, persistencia y tema](reference/api-and-theme.md)

## Operación

- [Completar configuración cloud](how-to/complete-cloud-configuration.md)
- [Desplegar proxy de Chat](how-to/deploy-chat-proxy.md)
- [Preparar lanzamiento](how-to/production-rollout.md)

## Seguridad y comportamiento

- [Chat](explanation/chatbot.md)
- [Privacidad y crisis](explanation/privacy-and-crisis.md)
- [Ejemplo crisis config](reference/examples/crisis-config.json)

## Decisiones

- [ADR-0001: arquitectura por feature](decisions/0001-feature-oriented-architecture.md)
- [ADR-0002: React Navigation](decisions/0002-keep-react-navigation.md)
- [ADR-0003: umbral monorepo](decisions/0003-monorepo-threshold.md)
- [ADR-0004: cuenta local y auth opcional](decisions/0004-local-account-and-auth.md)
- [ADR-0005: local-first versionado](decisions/0005-versioned-local-first-sync.md)
- [ADR-0006: conexiones aisladas](decisions/0006-external-connections.md)

Material descartado no se conserva en árbol activo. Git mantiene historial.
