# Plan de largo plazo — SUI Accountability

- **Estado:** propuesta aprobada para planificación; no implementado
- **Tipo:** plan de producto, arquitectura y ejecución
- **Ámbito:** seguimiento personalizado de metas, hábitos y acciones
- **Dependencias:** dominio de productividad, notificaciones locales, preferencias, i18n y navegación
- **No incluye:** cambios de código ni migraciones ejecutadas en esta fase

## 1. Resumen ejecutivo

SUI evolucionará de un organizador de metas a un sistema de **responsabilidad personal configurable**. La aplicación no sólo recordará una meta: convertirá una intención en un compromiso concreto, definirá cuándo debe revisarse, comprobará el resultado, detectará retrasos y propondrá una decisión clara: avanzar, reducir, reprogramar o cerrar.

La presión será **voluntaria, explícita y personalizada**. SUI puede ser directo e insistente con el plan, pero nunca humillará, amenazará ni atacará a la persona.

> **Principio rector:** SUI debe ser duro con el plan y respetuoso con la persona.

La primera versión será completamente local-first y offline: **Accountability no se sincronizará en el MVP**. La nube sólo se evaluará después de validar uso, con una segunda fase limitada a configuración y compromisos activos. El historial del chat seguirá fuera de este dominio.

---

## 2. Auditoría de la arquitectura actual

### 2.1 Fortalezas aprovechables

1. **Arquitectura por features con límites claros.** Las funcionalidades externas publican `public.ts`; `shared` no depende de `features`.
2. **Dominio de productividad ya centralizado.** Metas, hábitos, hitos, rachas, XP, snapshots y sincronización viven en `shared/domain/productivity`, que es el lugar correcto para reglas transversales.
3. **Persistencia local-first madura.** El sobre v9 ya contempla migraciones, outbox, metadatos, tombstones, cursores, epoch y rebase.
4. **Cloud Function como único writer.** El modelo CAS e idempotente es adecuado para futuras entidades de accountability.
5. **Infraestructura de notificaciones aislada.** `shared/infrastructure/notifications.ts` es la única capa que toca `expo-notifications`; esto debe conservarse.
6. **Permisos y privacidad bien planteados.** El permiso se solicita sólo tras acción explícita y las notificaciones actuales son locales.
7. **i18n ES/EN y sistema visual existentes.** La función puede crecer sin introducir textos o estilos paralelos.
8. **Bus de eventos tipado.** Las finalizaciones de metas, hábitos e hitos ya tienen eventos; puede convertirse en fuente de hechos de seguimiento sin mutar estado desde efectos.
9. **Pruebas existentes.** Ya hay cobertura para almacenamiento, sincronización, arquitectura, notificaciones, metas, hábitos y preferencias.

### 2.2 Huecos relevantes

1. **La meta no tiene todavía una acción siguiente estructurada.** Hoy una meta tiene título, fecha, progreso e hitos; no tiene compromiso de ejecución, duración estimada ni ventana horaria.
2. **El hábito no tiene horario ni zona horaria de responsabilidad.** Tiene frecuencia y racha, pero no una hora o ventana en la cual SUI pueda hacer seguimiento contextual.
3. **No existe un modelo de perfil de seguimiento.** Falta personalidad, intensidad, motivadores, límites, horario protegido y consentimiento específico.
4. **La notificación actual es sólo diaria/nocturna o de fecha única.** No existe un reconciliador de agenda de seguimiento, deduplicación por política ni escalamiento.
5. **El contrato accionable está incompleto en comportamiento.** Hay tipos de payload para notificaciones accionables, pero aún no hay motor de planificación, acciones registrables ni política de seguridad.
6. **No hay ciclo de check-in.** El usuario puede completar una entidad, pero no responder `en progreso`, `no pude`, `reprogramar` o `cerrar` de forma estructurada.
7. **No se distingue incumplimiento de ausencia de datos.** Un sistema agresivo no puede asumir que no registrar equivale a no trabajar.
8. **No hay historial de decisiones de seguimiento.** Sin hechos inmutables no se puede explicar por qué SUI notificó, ajustar el algoritmo ni auditar duplicados.
9. **La reconciliación sólo cubre el recordatorio nocturno.** Hace falta una reconciliación general al arranque, al volver a foreground, al cambiar idioma/zona horaria y después de editar una meta.
10. **La sincronización actual sólo conoce goal/habit/snapshot/summary.** Accountability requerirá ampliar contratos de forma compatible y con migración idempotente.
11. **No existe una estrategia explícita de límites del sistema operativo.** Las notificaciones locales no garantizan ejecución exacta, orden, volumen ilimitado ni detección de una alerta ignorada.

### 2.3 Cambios detectados durante la auditoría

Al iniciar esta planificación ya había modificaciones no relacionadas en:

- `apps/mobile/src/application/navigation/TabNavigator.tsx`
- `apps/mobile/src/shared/domain/productivity/store/useProductivityStore.ts`

No se modifican ni se absorben en este plan. La implementación de accountability debe integrarse mediante APIs públicas y no sobrescribir trabajo paralelo del agente que está trabajando en datos.

### 2.4 Verificación de arquitectura realizada

- `npm run architecture` pasa correctamente.
- Resultado observado: `Architecture check passed (157 source files, 10 features).`
- Este plan mantiene la regla de no crear dependencias desde `shared` hacia `features` o `application`.

---

## 3. Decisiones de producto no negociables

### 3.1 Presión opt-in

El seguimiento intensivo estará desactivado por defecto. Se activa mediante un consentimiento explícito, separado del permiso técnico de notificaciones.

El usuario podrá configurar:

- personalidad de SUI;
- intensidad global;
- intensidad por objetivo;
- horarios permitidos y protegidos;
- máximo de avisos por día;
- días de descanso;
- canales permitidos;
- qué acciones puede sugerir SUI;
- temas o tonos que debe evitar.

### 3.2 Directo, no abusivo

Permitido:

- mensajes breves y firmes;
- mostrar el retraso real;
- exigir una decisión de estado;
- recordar el compromiso que el usuario aceptó;
- proponer una versión mínima o una reprogramación concreta.

Prohibido:

- insultos, humillación o amenazas;
- afirmar que el usuario es flojo, inútil o un fracaso;
- presión infinita o notificaciones sin límite;
- usar crisis, salud mental, relaciones o datos sensibles para provocar culpa;
- enviar presión durante horas protegidas;
- fingir que SUI sabe si la persona trabajó fuera de la aplicación.

### 3.3 El sistema nunca debe bloquear al usuario

Un check-in ignorado no bloquea la aplicación. Un incumplimiento no elimina progreso, rachas, datos ni acceso. La consecuencia máxima en MVP es una revisión o reprogramación solicitada.

### 3.4 No confundir recordatorio con evidencia

SUI debe distinguir:

- `scheduled`: seguimiento planificado;
- `delivered`: el sistema reportó entrega cuando la plataforma lo permita;
- `opened`: usuario tocó la alerta;
- `responded`: usuario registró una decisión;
- `overdue`: pasó la ventana objetivo sin check-in;
- `unknown`: no se puede inferir si el usuario trabajó;
- `completed`: el usuario registró la acción o entidad como completada.

Nunca se debe comunicar `overdue` como certeza de que la persona no hizo nada.

---

## 4. Modelo conceptual de la experiencia

### 4.1 Contrato de responsabilidad

Al crear o activar seguimiento para una meta, SUI debe pedir sólo lo necesario:

```text
Meta: resultado finito
Próxima acción: primera acción observable
Frecuencia: una vez, días concretos o repetición
Ventana: cuándo se espera intentar la acción
Duración: estimación opcional
Intensidad: suave, firme, exigente o personalizada
Regla de retraso: qué hacer si no hay respuesta
Límites: cuándo no notificar
``` 

Ejemplo:

```text
Resultado: publicar mi portafolio
Próxima acción: ordenar imágenes de los proyectos
Ventana: lunes, miércoles y viernes a las 19:00
Duración mínima: 20 minutos
Intensidad: exigente
Si me retraso: recordarme una vez y pedirme reprogramar
``` 

### 4.2 Ciclo de seguimiento

1. **Definir:** convertir la meta en resultado, próxima acción y fecha.
2. **Preparar:** detectar obstáculos y definir una versión mínima.
3. **Programar:** calcular ventanas y avisos respetando límites.
4. **Recordar:** enviar una alerta contextual antes o durante la ventana.
5. **Confirmar:** pedir una respuesta accionable.
6. **Escalar:** si no hay respuesta, usar la siguiente intervención permitida.
7. **Resolver:** completar, continuar, reducir, reprogramar, pausar o cerrar.
8. **Aprender:** revisar qué horario, intensidad y formato funcionaron.

### 4.3 Estados de seguimiento

```text
inactive
→ configured
→ scheduled
→ due
→ acknowledged
→ in_progress
→ completed

configured/scheduled/due
→ overdue
→ rescheduled | reduced | paused | abandoned

overdue
→ unknown  # si no hay datos suficientes; no equivale a fracaso
``` 

Un objetivo puede tener varios ciclos. El historial de ciclos no se sobrescribe.

---

## 5. Arquitectura objetivo

### 5.1 Ubicación de módulos

La propuesta respeta la arquitectura existente:

```text
apps/mobile/src/
├── features/
│   └── accountability/
│       ├── public.ts
│       ├── model/
│       │   ├── accountabilityTypes.ts
│       │   ├── commitmentRules.ts
│       │   ├── escalationPolicy.ts
│       │   ├── notificationCopy.ts
│       │   └── followUpFacts.ts
│       ├── services/
│       │   ├── accountabilityScheduler.ts
│       │   ├── accountabilityReconciler.ts
│       │   ├── notificationActions.ts
│       │   └── accountabilityTelemetry.ts
│       ├── store/
│       │   └── useAccountabilityStore.ts
│       ├── components/
│       │   ├── AccountabilitySetup.tsx
│       │   ├── CheckInSheet.tsx
│       │   ├── IntensitySelector.tsx
│       │   └── AccountabilitySummaryCard.tsx
│       ├── screens/
│       │   └── AccountabilitySettingsScreen.tsx
│       └── __tests__/
└── shared/
    ├── domain/productivity/
    │   └── public.ts              # sólo si se requieren tipos/reglas compartidas
    └── infrastructure/
        └── notifications.ts       # primitivas, no reglas de producto
```

**Regla:** `shared/infrastructure/notifications.ts` agenda y cancela primitivas; `features/accountability` decide qué y cuándo. La infraestructura no conoce metas, tono, rachas ni políticas.

### 5.2 Responsabilidad de cada capa

| Capa | Responsabilidad | No debe hacer |
| --- | --- | --- |
| Contratos | Tipos serializables, validación, compatibilidad | Decidir tono o UX |
| Dominio | Reglas puras de estados, ventanas y escalamiento | Acceder a React o Expo |
| Store | Estado observable local y acciones | Llamar directamente a `expo-notifications` |
| Scheduler | Traducir planes a alertas locales | Inventar reglas de negocio |
| Reconciler | Reparar agenda después de cambios/arranque | Solicitar permiso automáticamente |
| UI | Configuración y check-ins | Alterar outbox manualmente |
| Persistencia | Guardar sobre versionado y migraciones | Inferir incumplimiento desde la ausencia |
| Sync | Replicar datos permitidos | Sincronizar chat o contenido sensible |
| Telemetría | Métricas agregadas sin PII | Enviar títulos, cuerpos o mensajes |

### 5.3 Estado local independiente

Accountability no debe vivir dentro de `useSettingsStore`, porque esa store contiene preferencias simples, ni dentro de la pantalla de Metas. Debe tener un store/servicio propio y persistencia versionada.

La relación recomendada es:

```text
Goal/Habit existente
       ↓ referencia estable por ID
Accountability commitment
       ↓ genera
Follow-up plan + Follow-up facts
       ↓ produce
Scheduled local notifications
```

La eliminación de una meta o hábito debe cancelar sus alertas y eliminar su compromiso, ciclos y hechos locales asociados en el MVP. Nunca debe dejar notificaciones huérfanas ni compromisos `orphaned` persistentes.

---

## 6. Modelo de datos propuesto

Los nombres son una propuesta de contrato para coordinar con el agente de datos. No deben implementarse sin acordar la versión de migración.

### 6.1 Perfil de seguimiento

```ts
type AccountabilityIntensity = 'soft' | 'firm' | 'demanding' | 'custom';
type AccountabilityPersonality =
  | 'coach'
  | 'direct'
  | 'partner'
  | 'mentor'
  | 'minimal';

type AccountabilityProfile = {
  schemaVersion: 1;
  enabled: boolean;
  defaultIntensity: AccountabilityIntensity;
  personality: AccountabilityPersonality;
  maxNotificationsPerDay: number;
  quietHours: { startMinute: number; endMinute: number };
  restDays: number[];
  allowEscalation: boolean;
  allowNotificationActions: boolean;
  weeklyDigestEnabled: boolean;
  updatedAt: string;
};
```

El perfil no debe guardar diagnósticos, rasgos psicológicos ni contenido libre sensible. Las preferencias libres de tono deben tener longitud máxima y lista de categorías evitables.

### 6.2 Compromiso por objetivo o hábito

```ts
type AccountabilityCommitment = {
  id: string;
  subjectType: 'goal' | 'habit';
  subjectId: string;
  enabled: boolean;
  intensity?: AccountabilityIntensity;
  nextAction?: string;
  minimumAction?: string;
  durationMinutes?: number;
  timezone: string;
  schedule: ScheduleRule;
  deadline?: string;
  escalation: EscalationRule;
  createdAt: string;
  updatedAt: string;
};
```

El `nextAction` puede ser texto visible al usuario, pero no debe permitir que el motor ejecute comandos arbitrarios. En una fase posterior se puede modelar como acción estructurada.

### 6.3 Ciclos y hechos

```ts
type FollowUpCycle = {
  id: string;
  commitmentId: string;
  scheduledFor: string;
  windowStart: string;
  windowEnd: string;
  status: CycleStatus;
  attemptCount: number;
  completedAt?: string;
  resolvedAt?: string;
  resolution?: 'completed' | 'continued' | 'reduced' | 'rescheduled' | 'paused' | 'abandoned';
};

type FollowUpFact = {
  id: string;
  cycleId: string;
  kind: 'scheduled' | 'opened' | 'check_in' | 'snoozed' | 'completed' | 'rescheduled' | 'paused';
  occurredAt: string;
  source: 'app' | 'notification' | 'system_reconcile';
  value?: string;
};
```

Los hechos deben ser pequeños y compactables. El objetivo no es guardar cada render ni construir un sistema de vigilancia, sino poder explicar decisiones y calcular métricas locales.

### 6.4 Decisión de datos para el MVP

**Todo el estado de Accountability será local en la primera versión.** Se guardará en una clave independiente, `sui-accountability-v1`, y no se añadirá a `sui-productivity-v9`, al `summary`, al outbox ni a Firestore.

Datos locales del MVP:

- perfil: personalidad, intensidad, motivadores, límites, quiet hours y días de descanso;
- compromisos activos vinculados por ID a metas/hábitos;
- próxima acción y versión mínima;
- ciclos abiertos y estado de resolución;
- check-ins, reprogramaciones, pausas y hechos mínimos de auditoría;
- zona horaria usada para calcular ventanas;
- IDs de notificaciones programadas y última reconciliación.

No se sincronizarán en MVP:

- configuraciones de Accountability;
- compromisos;
- ciclos ni check-ins;
- historial de notificaciones;
- alertas programadas del dispositivo.

Las metas, hábitos, hitos y progreso siguen usando su persistencia y sincronización actuales. Accountability sólo mantiene referencias estables a sus IDs.

### 6.5 Versionado y migración

Accountability tendrá un sobre y una migración propios:

```text
sui-accountability-v1
v1 → v2 → v3
```

No se implementará `productivity-v10` para introducir esta funcionalidad y no se migrará productividad v9 al nuevo modelo. La migración de Accountability debe ser consecutiva, pura, idempotente, tolerante a corrupción y probada con fixtures. La primera versión puede comenzar con un estado vacío si la clave no existe.

### 6.6 Sincronización futura, merge y CAS

El MVP no tiene merge ni CAS para Accountability porque no hay datos cloud. Esta decisión reduce riesgo y permite validar la hipótesis de producto antes de tocar el trabajo paralelo de persistencia.

Si el uso justifica multi-dispositivo, una fase posterior sincronizará sólo:

- perfil global y límites;
- compromisos activos;
- próxima acción y horario;
- estado de pausa/activación.

Los hechos detallados, aperturas, alertas programadas y la mayor parte del historial seguirán siendo locales al principio. La futura sincronización reutilizará IDs estables, `mutationId`, CAS, rebase y tombstones existentes. Regla de merge propuesta:

- compromisos distintos se combinan;
- cambios del mismo compromiso reciben estado autoritativo mediante CAS;
- una pausa o cierre explícito invalida una programación antigua;
- hechos históricos se deduplican por ID y no se mezclan como simples arrays;
- cada dispositivo agenda sus propias alertas; nunca se sincronizan notificaciones.

No se crearán colecciones Firestore ni se cambiarán contratos de productividad hasta que exista una decisión separada con pruebas de volumen, conflictos, eliminación y compatibilidad.

---

## 7. Motor de notificaciones

### 7.1 Capacidades reales de la plataforma

La primera versión debe aceptar estas limitaciones:

1. Las alertas locales dependen del sistema operativo y pueden retrasarse o ser suprimidas.
2. No se puede saber de forma confiable que una notificación fue ignorada.
3. En background no se debe asumir que JS ejecutará un escalamiento arbitrario.
4. Programar una alerta no equivale a entrega garantizada.
5. Cambiar hora, zona, idioma o configuración exige cancelar y reconciliar.
6. Las alertas futuras deben programarse con un horizonte acotado, por ejemplo 7 días, y renovarse al abrir o volver a foreground.

Por ello, “agresivo” en MVP significa **persistente al volver a la aplicación y bien escalonado**, no una promesa de presión infinita en segundo plano.

### 7.2 Scheduler

Entrada:

- perfil de accountability;
- compromisos activos;
- ciclos abiertos;
- hora local y zona horaria;
- permiso vigente;
- notificaciones actualmente programadas.

Salida:

- plan determinista de alertas;
- cancelaciones necesarias;
- mapa de identificadores estables;
- explicación de cada alerta.

Identificador recomendado:

```text
sui-accountability:{commitmentId}:{cycleId}:{stage}
```

Reprogramar debe ser idempotente. Nunca debe crear duplicados para el mismo ciclo y etapa.

### 7.3 Etapas de escalamiento

Configuración inicial sugerida:

| Etapa | Momento | Acción |
| --- | --- | --- |
| `prepare` | 15–30 min antes | Recordar la próxima acción |
| `due` | inicio de ventana | Pedir empezar o elegir alternativa |
| `check_in` | después de la ventana | Pedir estado explícito |
| `overdue` | una sola vez | Ofrecer versión mínima o reprogramar |
| `review` | cierre diario/semanal | Mostrar patrón, no reproche |

Límites MVP:

- máximo 3 intervenciones por ciclo;
- máximo configurable de avisos por día, valor inicial 4;
- no más de una alerta de escalamiento durante una hora;
- respetar `quietHours` y días de descanso;
- si el usuario pulsa `pause`, detener el ciclo, no seguir insistiendo;
- si el usuario responde dos veces que no puede, bajar automáticamente a revisión.

### 7.4 Acciones de notificación

Acciones iniciales recomendadas:

- `START_NOW`;
- `COMPLETE`;
- `SNOOZE_15M`;
- `DO_MINIMUM`;
- `RESCHEDULE`;
- `PAUSE`;
- `OPEN_APP`.

`COMPLETE` sólo debe completar una acción claramente identificada y validada. Nunca debe marcar una meta completa si el usuario sólo indicó que abrió la alerta.

Las acciones en background deben considerarse fase posterior si la compatibilidad Expo/iOS/Android no es estable. En MVP, tocar la alerta puede abrir un check-in contextual dentro de la aplicación.

### 7.5 Reconciliación

Ejecutar reconciliación:

- después de hidratar persistencia;
- al entrar a `Home`;
- al volver a foreground;
- después de crear, editar, completar, pausar o eliminar una meta/hábito;
- después de cambiar idioma, zona horaria, intensidad o quiet hours;
- después de detectar cambio de permiso;
- después de sincronizar nube;
- después de migrar datos.

La reconciliación debe:

1. cargar estado local;
2. descartar referencias inválidas;
3. cerrar o marcar ciclos vencidos según reloj local;
4. cancelar identificadores antiguos;
5. programar sólo el horizonte permitido;
6. registrar conteos agregados;
7. no solicitar permisos;
8. no bloquear el render de la app.

---

## 8. UX y navegación propuesta

### 8.1 Entrada mínima en la meta

La creación actual de meta no debe convertirse de golpe en un cuestionario largo. Propuesta:

- MVP: después de guardar la meta, ofrecer `Activar seguimiento` como CTA opcional.
- Setup: próxima acción, horario, intensidad y límite.
- Avanzado: duración, versión mínima, obstáculos y días de descanso.

El flujo normal de metas sigue siendo rápido y usable sin accountability.

### 8.2 Superficies

1. **Meta/Hábito:** estado de seguimiento y próxima revisión.
2. **Check-in sheet:** botones de respuesta rápida y opción de nota breve local.
3. **Ajustes → Seguimiento:** perfil global, personalidad, intensidad, límites y pausa.
4. **Inicio:** una sola tarjeta de próxima acción, no un muro de alertas.
5. **Progreso:** métricas de cumplimiento y patrones agregados.
6. **Resumen semanal:** qué funcionó, qué se pospuso y qué conviene cambiar.

No se recomienda una nueva tab principal en la primera etapa. La función debe integrarse en Metas, Hábitos, Inicio y Ajustes.

### 8.3 Copy por personalidad

La lógica de negocio debe producir una intención estructurada y `notificationCopy.ts` resolverla a claves i18n.

Ejemplo de intención:

```text
kind: overdue
subject: portfolio
action: reschedule_or_minimum
intensity: demanding
```

Nunca construir mensajes concatenando títulos sin sanitización ni enviar contenido libre a telemetría.

### 8.4 Ejemplos de tono

**Suave:** “Tu sesión sigue pendiente. ¿Quieres hacer una versión breve?”

**Firme:** “La ventana de esta meta terminó. Elige una acción: completar, reducir o reprogramar.”

**Exigente:** “No dejes esta meta sin decisión. Empieza 20 minutos ahora o fija una hora concreta para retomarla.”

**Prohibido:** “Otra vez fallaste. Nunca terminas nada.”

---

## 9. Privacidad, seguridad y bienestar

1. Todo seguimiento local debe funcionar sin enviar títulos ni horarios a un servidor.
2. Las notificaciones pueden mostrar contenido privado en pantalla; el usuario debe poder elegir `título genérico` para pantalla bloqueada.
3. El perfil debe excluir salud, diagnósticos, trauma, adicciones y atributos protegidos.
4. No usar modelos de IA para decidir intensidad o castigo en MVP.
5. No usar chat para generar mensajes de presión automáticamente en MVP.
6. Los títulos de metas no entran en telemetría, logs ni crash reports.
7. Exportación y eliminación deben incluir compromisos, ciclos y preferencias.
8. Logout debe separar el espacio de accountability autenticado del espacio invitado igual que productividad.
9. Las reglas Firestore deben negar escritura cliente directa y validar propietario mediante la Function existente.
10. La eliminación de cuenta debe purgar subcolecciones nuevas y cachés locales.
11. Si se detecta lenguaje de crisis en una interacción de check-in, el flujo debe ceder al protocolo existente de crisis; no intentar motivar agresivamente.

---

## 10. Roadmap por fases

### Fase 0 — Contrato y spike técnico

**Objetivo:** cerrar decisiones con el agente que trabaja persistencia y comprobar límites de Expo.

Entregables:

- contrato de tipos acordado;
- decisión de persistencia y versionado;
- matriz de capacidades Android/iOS/Web;
- prueba de scheduling idempotente, cancelación y foreground;
- política de límites y copy revisada;
- ADR actualizada.

Gate:

- ningún cambio de UI dependiente de campos aún no versionados;
- `npm run architecture` pasa;
- no se modifica trabajo paralelo sin acuerdo.

### Fase 1 — Modelo local y reglas puras

**Objetivo:** persistir perfil, compromisos y ciclos sin notificar todavía.

Entregables:

- tipos y validadores;
- sobre local separado `sui-accountability-v1` y migración propia;
- store local separado;
- reglas de ciclo y escalamiento puras;
- asociación y limpieza de metas/hábitos eliminados;
- tests de fechas, zona horaria, límites, idempotencia y reinicio.

Gate:

- una instalación sin clave crea estado vacío válido;
- migrar/reintentar no duplica ciclos ni hechos;
- invitado y cuenta registrada funcionan localmente;
- no se generan mutaciones ni escrituras cloud de Accountability.

### Fase 2 — Scheduler y reconciliador local

**Objetivo:** convertir ciclos en notificaciones locales fiables dentro de las limitaciones del sistema.

Entregables:

- scheduler con IDs estables;
- canales separados para accountability;
- horizonte configurable;
- cancelación por edición/completado/eliminación;
- reconciliación en arranque/foreground;
- detección de permiso sin prompt automático;
- pruebas Android/iOS/Web y zonas horarias representativas.

Gate:

- scheduling repetido produce el mismo conjunto de IDs;
- no hay duplicados ni alertas de metas eliminadas;
- cambios de idioma no mezclan textos antiguos sin reconciliación;
- errores de Expo no rompen la app.

### Fase 3 — Check-ins y activación opt-in

**Objetivo:** cerrar el ciclo con una respuesta del usuario.

Entregables:

- setup mínimo desde Meta/Hábito;
- check-in sheet;
- respuestas `completado`, `en progreso`, `mínimo`, `reprogramar`, `pausar`;
- pantalla de Ajustes de seguimiento;
- textos ES/EN y accesibilidad;
- eventos de dominio para cambios de ciclo.

Gate:

- una notificación no modifica datos sin confirmación;
- reprogramar exige fecha/hora válida;
- completar registra hecho y actualiza entidad sólo por la ruta de dominio;
- la presión se puede apagar desde cualquier superficie.

### Fase 4 — Escalamiento exigente y revisión

**Objetivo:** habilitar el valor diferencial sin saturación.

Entregables:

- intensidades y personalidades;
- escalamiento máximo de tres etapas;
- versión mínima de acción;
- resumen diario/semanal;
- patrones locales de horario y reprogramación;
- controles de pausa y días protegidos.

Gate:

- límites respetados bajo simulación de muchas metas;
- no hay mensajes abusivos en catálogo de copy;
- el sistema trata ausencia de registro como `unknown` antes de `overdue` cuando corresponda;
- usuarios pueden cambiar intensidad sin perder historial.

### Fase 5 — Validación de sincronización y multi-dispositivo (sólo si se justifica)

**Objetivo:** decidir, con datos reales de uso, si vale la pena respaldar una parte mínima del estado sin romper local-first.

Precondiciones:

- señales de uso suficientes;
- tasa de respuesta y retención aceptables;
- problemas multi-dispositivo confirmados por usuarios;
- contrato y ownership aprobados de nuevo.

Entregables posibles:

- extensión de contratos y validadores;
- migración cloud compatible;
- CAS/rebase/tombstones para perfil y compromisos activos;
- fusión local/cloud explícita;
- eliminación de cuenta y exportación completas;
- pruebas con dos dispositivos y cambios concurrentes.

Gate:

- no se inicia por calendario: requiere decisión explícita;
- offline → online conserva ciclos pendientes;
- primer commit válido gana sin pérdida silenciosa;
- duplicados/replays son idempotentes;
- un dispositivo no recrea notificaciones de otro sin deduplicación local.

### Fase 6 — Acciones nativas y optimización

**Objetivo:** reducir fricción después de demostrar valor.

Posibles entregables:

- categorías y acciones nativas de notificación;
- widgets con próxima acción;
- integración de calendario para bloquear conflictos;
- sugerencias de horarios basadas en datos agregados locales;
- modo crisis de recuperación de meta atrasada;
- feature flag y rollout gradual.

No construir esta fase antes de validar retención, respuesta a check-ins y tasa de silenciamiento.

---

## 11. Criterios de aceptación globales

### Producto

- El usuario entiende qué se va a seguir y puede cancelar antes de activar.
- Cada alerta tiene una acción concreta.
- Cada incumplimiento ofrece resolver, no sólo reprochar.
- La intensidad es configurable globalmente y por compromiso.
- El usuario puede pausar todo o una meta.

### Técnica

- Local-first: ninguna pantalla espera nube ni permiso.
- Scheduler idempotente y reconciliable.
- IDs estables y cancelación completa.
- Migraciones puras, consecutivas e idempotentes.
- Contratos estrictos con límites de tamaño.
- No hay dependencias arquitectónicas prohibidas.
- Tests de dominio, persistencia, scheduler, permisos, i18n y navegación.

### Privacidad

- Chat permanece con TTL local actual.
- Títulos, cuerpos y horarios no llegan a telemetría.
- Notificaciones genéricas disponibles para pantalla bloqueada.
- Cuenta, exportación, logout y eliminación cubren todo el nuevo estado.

### Bienestar

- No hay culpa, humillación ni amenazas.
- Máximos de frecuencia y horas protegidas se cumplen incluso en modo exigente.
- Ante señales de crisis se prioriza el protocolo de crisis ya existente.
- No se presenta la ausencia de datos como fracaso cierto.

---

## 12. Estrategia de pruebas

### Unitarias

- transiciones de ciclo;
- reglas de intensidad;
- cálculo de ventanas y DST;
- quiet hours que cruzan medianoche;
- días de descanso;
- máximo diario;
- backoff/escalamiento;
- IDs deterministas;
- copy por locale/personality/intensity;
- validadores y migraciones.

### Persistencia local MVP

- ausencia de `sui-accountability-v1` crea estado válido;
- migración repetida v1 → v2 cuando exista;
- corrupción/fallback sin romper productividad;
- ciclos y hechos no se duplican al reintentar;
- logout/login conserva o separa el espacio según la política de cuenta;
- eliminación completa de la clave, alertas y exportación.

### Sync futuro condicionado

- outbox y rebase sólo cuando se apruebe Fase 5;
- merge local/cloud;
- tombstone y purga;
- dos dispositivos y conflictos concurrentes.

### Integración móvil

- permiso granted/denied/blocked;
- scheduling Android con canal;
- iOS sin canal Android;
- toque de alerta y deep link al check-in;
- cambio de idioma;
- cambio de zona horaria;
- app cold start y foreground;
- edición/eliminación mientras hay alertas pendientes.

### E2E/UAT

1. Crear una meta sin activar seguimiento: no se agenda nada.
2. Activar seguimiento y verificar una alerta única.
3. Reabrir la app varias veces: no aparecen duplicados.
4. Completar antes de la alerta: se cancela el resto del ciclo.
5. Reprogramar: la hora anterior desaparece.
6. Pausar: no hay escalamiento.
7. Superar límite diario: se difiere o se omite de forma explicable.
8. Entrar en quiet hours: no se notifica.
9. Eliminar meta: no queda alerta huérfana.
10. Trabajar offline, luego sincronizar: no se pierde el estado.
11. Cambiar idioma: nuevas alertas usan idioma actual.
12. Activar modo exigente: el copy sigue siendo respetuoso.

---

## 13. Observabilidad y métricas

Las métricas deben ser agregadas y sin contenido de usuario:

- `accountability.enabled`;
- `accountability.commitment_created`;
- `accountability.notification_scheduled`;
- `accountability.notification_opened`;
- `accountability.check_in_submitted`;
- `accountability.cycle_completed`;
- `accountability.cycle_rescheduled`;
- `accountability.cycle_paused`;
- `accountability.limit_reached`;
- `accountability.reconcile_error`;
- `accountability.notification_permission_state`.

Propiedades permitidas:

- intensidad;
- personalidad;
- plataforma;
- locale;
- estado de permiso;
- etapa;
- resultado agregado;
- duración;
- cantidad, no contenido.

Métricas de éxito:

- porcentaje de compromisos que reciben respuesta;
- tiempo entre alerta y check-in;
- completados versus reprogramados;
- tasa de pausa o desactivación;
- alertas canceladas correctamente;
- notificaciones por usuario/día;
- retención del modo activo;
- tasa de silenciamiento/desinstalación como señal negativa.

No optimizar por cantidad de notificaciones enviadas. El objetivo es aumentar decisiones y acciones útiles.

---

## 14. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Fatiga por alertas | Alto | límites, quiet hours, opt-in, máximo por ciclo |
| Prometer detección de ignoradas | Alto | estado `unknown`, reconciliación explícita |
| Complejidad de migración | Alto | spike, migración separada, contrato con agente de datos |
| Duplicados en reintentos | Alto | IDs deterministas, pruebas de idempotencia |
| Zona horaria/DST | Alto | almacenar timezone, probar cambios y fechas locales |
| Datos sensibles en lock screen | Alto | títulos genéricos opcionales |
| Conflicto con trabajo paralelo | Alto | tocar sólo APIs acordadas, no modificar persistencia ajena sin coordinación |
| Exceso de configuración | Medio | setup mínimo; avanzado bajo demanda |
| Personalidad inconsistente | Medio | intención estructurada + catálogo i18n |
| Presión dañina | Alto | revisión de copy, controles, no usar IA generativa en MVP |
| Límites de Expo/OS | Alto | horizonte, reconciliación y pruebas reales |
| Crecimiento de hechos | Medio | retención, compactación y resumen semanal |

---

## 15. Coordinación y ownership congelados

Para avanzar sin bloquear al equipo:

1. **Accountability MVP es local-only.** No requiere cambios al sync ni a contratos cloud.
2. **Almacenamiento:** clave independiente `sui-accountability-v1`, con migración propia.
3. **Agente de datos:** mantiene `shared/domain/productivity`, productividad v9, sync, merge y eliminación cloud.
4. **Agente de Accountability:** mantiene `features/accountability`, reglas, scheduler, reconciliador, check-ins, UI, tests y persistencia de su clave local.
5. **Infraestructura compartida:** `shared/infrastructure/notifications.ts` sólo expone primitivas genéricas.
6. **Metas/hábitos:** Accountability sólo referencia IDs y usa APIs públicas; no duplica ni modifica sus modelos.
7. **Eliminación:** la feature cancela alertas y elimina su estado local; Settings/Auth debe invocar su limpieza durante logout, borrado y exportación.
8. **Sync futuro:** requiere una nueva propuesta, contrato, pruebas y ownership antes de tocar Firestore.

Ningún agente debe editar silenciosamente los contratos, migraciones o stores propiedad del otro. Si una integración requiere cambiar una API pública, primero se acuerda la interfaz mínima y el fixture de prueba.

---

## 16. Orden recomendado de ejecución

```text
0. Congelar contrato y ownership (decidido)
1. Reglas puras y fixtures
2. Persistencia/migración local independiente
3. Scheduler/reconciliador
4. Setup y check-ins
5. Escalamiento y resumen
6. Validar producto y decidir si merece sync
7. Sync/multi-dispositivo sólo si se aprueba
8. Acciones nativas y optimización
```

No empezar por la pantalla de notificaciones. El riesgo principal está en el modelo temporal, la idempotencia, la reconciliación y la coordinación con persistencia.

---

## 17. Definición de terminado de la iniciativa

La iniciativa sólo se considera sólida cuando:

- el modo normal sigue siendo limpio y sin presión;
- el modo exigente es voluntario y reversible;
- una meta puede activarse, seguirse, resolverse, pausarse y eliminarse sin residuos;
- el comportamiento offline es correcto;
- los datos migran localmente sin pérdidas;
- la sincronización sólo existe después de una decisión y validación separadas;
- los límites se prueban en dispositivo real;
- la app explica el estado real sin fingir certeza;
- las métricas demuestran acciones útiles y no sólo más alertas;
- seguridad, privacidad, accesibilidad, i18n y crisis están cubiertas;
- el rollout puede apagarse con feature flag sin migración destructiva.
