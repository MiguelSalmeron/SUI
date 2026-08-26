# ADR-0003: umbral para adoptar monorepo

- Estado: propuesta diferida
- Fecha: 2026-08-26

## Contexto

El repositorio contiene una aplicación móvil y Cloud Functions, pero todavía comparte un ciclo de entrega pequeño. Mover ambos proyectos bajo `apps` ahora incrementaría el riesgo sobre Expo, EAS, Firebase, variables de entorno y `patch-package` sin aportar aislamiento inmediato suficiente.

## Decisión

Mantener la aplicación móvil en la raíz y Functions en su carpeta actual.

Reevaluar un workspace con `apps/mobile`, `apps/functions` y paquetes compartidos cuando ocurra cualquiera de estos casos:

- Aparezca una tercera aplicación desplegable.
- Existan contratos compartidos versionados entre cliente y backend.
- Mobile y backend necesiten pipelines o calendarios de release independientes.
- La duplicación de tooling sea más costosa que la migración.

## Consecuencias

- Menor riesgo operativo inmediato.
- Posible duplicación temporal de dependencias.
- La estructura interna ya permite una migración posterior por etapas.
