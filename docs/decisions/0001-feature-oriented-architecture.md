# ADR-0001: arquitectura orientada por funcionalidad

- Estado: aceptada
- Fecha: 2026-08-26

## Contexto

La organización anterior separaba pantallas, componentes, hooks, servicios, stores y tipos en carpetas globales. Cada cambio funcional requería recorrer múltiples ubicaciones y favorecía dependencias no controladas.

## Decisión

Organizar la aplicación en `application`, `features` y `shared`.

- `application`: bootstrap, providers y navegación.
- `features`: módulos funcionales autocontenidos.
- `shared`: diseño, infraestructura y dominio realmente compartido.

Los tests unitarios permanecen junto al módulo probado. Se prefieren imports directos mediante el alias `@/`.

## Consecuencias

- Mejor descubrimiento y propiedad del código.
- Menor impacto al modificar una funcionalidad.
- Necesidad de vigilar dependencias entre funcionalidades.
- El dominio de productividad compartido permanece en `shared/domain/productivity` mientras metas, hábitos, calendario y dashboard utilicen el mismo estado.
