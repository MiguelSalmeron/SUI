# ADR-0002: conservar React Navigation

- Estado: aceptada
- Fecha: 2026-08-26

## Contexto

La aplicación ya utiliza Native Stack y Bottom Tabs de React Navigation. Adoptar Expo Router durante una reorganización estructural mezclaría dos cambios de alto impacto sin necesidad funcional.

## Decisión

Conservar React Navigation. La composición vive en `src/application`; `src/app` queda libre para evitar que Expo la interprete como raíz de Expo Router.

## Consecuencias

- La reorganización no cambia el comportamiento de navegación.
- No existe una carpeta de rutas compatible con Expo Router.
- Una migración futura requerirá una decisión arquitectónica independiente.
