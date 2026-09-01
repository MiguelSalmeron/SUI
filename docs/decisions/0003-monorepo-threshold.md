# ADR-0003: adoptar monorepo al cumplirse el umbral

- Estado: aceptado
- Fecha: 2026-08-26

## Contexto

El repositorio contiene aplicación móvil y Cloud Functions, pero todavía comparte un ciclo de entrega pequeño. Mover ambos proyectos bajo `apps` ahora incrementaría riesgo sobre Expo, EAS, Firebase, variables de entorno y configuración nativa sin aportar aislamiento suficiente.

## Decisión

El contrato sync v9 compartido cumple el umbral de contratos versionados. Adoptar npm workspaces con Turborepo:

```text
apps/mobile
apps/functions
packages/contracts
```

Los criterios que activaron la decisión fueron:

- Aparezca una tercera aplicación desplegable.
- Existan contratos compartidos versionados entre cliente y backend.
- Mobile y backend necesiten pipelines o calendarios de release independientes.
- La duplicación de tooling sea más costosa que la migración.

## Consecuencias

- Cliente y backend comparten DTOs y parsers runtime.
- Un lockfile raíz instala todos los workspaces.
- Turborepo ordena build, typecheck y tests según dependencias.
- Expo, EAS y Firebase conservan ciclos de despliegue independientes bajo `apps`.
