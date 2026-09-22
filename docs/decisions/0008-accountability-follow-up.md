# ADR-0008: seguimiento personalizado y exigente de objetivos

- **Estado:** propuesta aceptada para planificación
- **Fecha:** 2026-09-01
- **Relacionado:** ADR-0001, ADR-0005, PRD, sistema de diseño

## Contexto

SUI ya gestiona metas, hábitos, hitos y recordatorios locales. Se propone añadir un sistema de responsabilidad personal que permita configurar personalidad, intensidad, horarios, check-ins y escalamiento cuando una acción se retrasa.

La aplicación también tiene un agente trabajando en la capa de datos. La decisión debe evitar que la nueva funcionalidad invada la persistencia o sync sin contrato, y debe conservar local-first, privacidad y los límites de la arquitectura existente.

## Decisiones

### 1. Accountability es un dominio/feature separado

La lógica de seguimiento se ubicará en `features/accountability`, con superficie pública propia. Las reglas de ciclo, escalamiento, copy y planificación no vivirán en pantallas de Metas, Hábitos ni Ajustes.

El dominio de productividad seguirá siendo propietario de metas y hábitos. Accountability sólo referencia sus IDs y solicita mutaciones mediante APIs públicas.

### 2. La infraestructura de notificaciones permanece genérica

`shared/infrastructure/notifications.ts` seguirá siendo la única capa que conoce `expo-notifications`. Accountability describirá planes y usará esa infraestructura; no se introducirán reglas de negocio en la capa compartida.

### 3. El seguimiento es opt-in y reversible

El perfil de accountability inicia desactivado. La activación es independiente del permiso técnico del sistema. El usuario puede pausar todo, pausar una meta, cambiar intensidad y cancelar cualquier ciclo.

### 4. El MVP será local-only dentro de local-first

El scheduling, los check-ins, la reconciliación y todo el estado de Accountability funcionarán localmente y sin red. El MVP usará una clave independiente `sui-accountability-v1`; no añadirá Accountability a productividad v9, al `summary`, al outbox ni a Firestore. La sincronización sólo se evaluará en una fase posterior, después de validar uso real.

### 5. El sistema no inferirá fracaso por ausencia de datos

La falta de respuesta se representa como `unknown` hasta que una reconciliación determine que la ventana expiró. No se afirmará que una persona no trabajó fuera de la aplicación.

### 6. El escalamiento tendrá límites

MVP usará un máximo por ciclo, un máximo diario, quiet hours, días de descanso y un horizonte acotado de scheduling. “Agresivo” significa directo y persistente dentro de estas reglas, no presión infinita ni comportamiento abusivo.

### 7. Se priorizan reglas deterministas sobre IA

La intensidad, el escalamiento, la selección de horarios y el copy MVP serán deterministas y auditables. No se usará IA para decidir castigos, intensidad o mensajes de presión. El contenido del chat no se persistirá ni se incorporará al dominio.

### 8. Ownership y persistencia del MVP quedan separados

El agente de datos conserva productividad v9, sus contratos, migraciones, sync, merge y eliminación cloud. Accountability conserva su feature, reglas, scheduler, check-ins, UI, tests y la clave local `sui-accountability-v1`. No se agregan colecciones Firestore ni se cambia productividad v9 para el MVP. Cualquier sincronización futura requiere una nueva decisión con contrato, merge, CAS, retención y eliminación.

## Consecuencias

### Positivas

- Menor riesgo de ciclos de dependencia.
- Scheduler testeable sin React ni Expo.
- Experiencia normal sin ruido para usuarios que no activan seguimiento.
- Reconciliación e idempotencia centralizadas.
- Posibilidad de apagar la función mediante feature flag.
- Integración futura con widgets, calendario y acciones nativas sin rehacer el modelo.

### Costes

- Se requiere un modelo temporal más complejo que el actual.
- La persistencia local independiente simplifica el MVP, pero deja la configuración sin respaldo multi-dispositivo inicialmente.
- La sincronización futura necesitará coordinación entre agentes.
- Las notificaciones locales no permiten garantizar detección de alertas ignoradas.
- El modo exigente exige revisión de copy, bienestar, permisos y pruebas reales en dispositivos.

## Fuera de esta decisión

- IA generativa para mensajes de presión.
- Push remoto como mecanismo principal.
- Competencia pública, castigos económicos o exposición social.
- Diagnóstico psicológico o personalización clínica.
- Nueva tab principal para accountability en MVP.

## Criterios para revisar la decisión

Revisar esta ADR si:

- la validación de uso demuestra que la falta de multi-dispositivo es un problema real;
- la sincronización excede los límites del sobre o requiere colecciones separadas;
- se decide soportar push remoto y cambia el modelo de privacidad;
- las pruebas de plataforma muestran que las acciones nativas no son viables;
- las métricas muestran fatiga o daño pese a los límites;
- el producto requiere un cambio de alcance que contradiga el PRD actual.
