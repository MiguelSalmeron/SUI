# Sui — Diseño funcional propuesto
## Hackathon Nicaragua 2026

## 1. Visión

Sui es un asistente personal de productividad que convierte lo que el usuario quiere lograr en lo que necesita hacer ahora.

Integra:

- Metas.
- Hábitos.
- Agenda.
- Google Calendar.
- Pomodoro.
- Progreso.
- Acompañamiento conversacional.
- Recordatorios y seguimiento.
- Personalización.

Principio central:

> Organiza lo importante, construye constancia y decide el siguiente paso con calma.

Sui funciona local-first. La cuenta y la nube son opcionales para respaldo y sincronización.

---

## 2. Experiencia principal

El flujo central debe sentirse así:

```text
Abrir Sui
↓
Ver qué importa hoy
↓
Elegir siguiente acción
↓
Trabajar con Modo Enfoque
↓
Completar meta o hábito
↓
Actualizar progreso
↓
Continuar con agenda o Sui Chat
```

La app debe priorizar acción y claridad, no mostrar grandes cantidades de información simultáneamente.

---

## 3. Inicio — “Hoy con Sui”

Inicio será el centro de decisión.

Contenido principal:

1. Fecha.
2. Próxima acción.
3. Pomodoro / Modo Enfoque.
4. Progreso del día.
5. Próximos elementos de agenda.
6. Hábitos de hoy.
7. Resumen compacto de progreso.

Ejemplo:

```text
Domingo, 4 de octubre

¿Qué importa hoy?

Preparar presentación del Hackathon
Meta: Sui MVP
25 min

[ Empezar enfoque ]

Progreso de hoy: 65%

Agenda
14:00 — Revisar demo
16:00 — Practicar pitch
```

Debe evitarse un muro de tarjetas.

---

## 4. Plan del día

Nueva función para ayudar al usuario a decidir qué hacer.

El usuario indica:

- Tiempo disponible:
  - 15 min
  - 30 min
  - 1 h
  - 2 h+
- Energía:
  - Baja
  - Normal
  - Alta
- Prioridad actual.

Sui utiliza metas, hábitos y agenda para proponer hasta 3 acciones.

Ejemplo:

```text
Hoy podrías:

1. Terminar documentación — 25 min
2. Practicar pitch — 25 min
3. Revisar presentación — 15 min
```

El usuario puede aceptar, modificar o ignorar la propuesta.

Principio:

> Sui propone. El usuario decide.

---

## 5. Modo Enfoque

El Pomodoro debe estar integrado con metas y hábitos.

Desde cualquier meta o hábito:

```text
Preparar pitch de Sui
Meta: Hackathon Nicaragua

25:00

[ Pausar ]
```

Al terminar:

```text
Sesión completada
+XP
25 minutos enfocado

[ Seguir 25 min ]
[ Marcar actividad completada ]
```

Duraciones configurables:

- 15 min
- 25 min
- 50 min
- Personalizado

---

## 6. Tu ritmo

Sui debe adaptar su acompañamiento al usuario.

### Modos

**Ligero**
- Pocas intervenciones.
- Recordatorios mínimos.

**Equilibrado**
- Seguimiento normal.
- Check-ins moderados.

**Sprint**
- Mayor seguimiento.
- Más recordatorios.
- Orientado a proyectos o periodos intensos.

### Configuración

- Duración predeterminada de enfoque.
- Hora habitual de inicio.
- Horario silencioso.
- Días activos.
- Objetivo diario.
- Recordatorios.
- Intensidad del acompañamiento.
- Tono de Sui:
  - Directo.
  - Cercano.
  - Muy breve.
- Módulos visibles en Inicio.

Principio:

> Sui se adapta a tu ritmo, no al revés.

---

## 7. Accountability / Check-ins

Sui puede hacer seguimiento a compromisos previamente definidos.

Ejemplo:

```text
Quedaste en terminar la presentación esta tarde.

¿Cómo vamos?

[ Ya la hice ]
[ Estoy trabajando ]
[ Mover para después ]
```

Si una actividad se aplaza repetidamente:

```text
Parece que esta meta está costando más de lo esperado.

[ Dividirla ]
[ Reprogramarla ]
[ Seguir igual ]
```

Debe acompañar sin castigar.

---

## 8. Progreso y revisión semanal

La sección Progreso debe mostrar información útil y visual.

Ejemplo:

```text
Tu semana

8 hábitos completados
6 sesiones de enfoque
165 minutos enfocado
3 días de racha
Meta principal: 74%
Día con más actividad: martes
```

Puede incluir observaciones simples:

> Esta semana avanzaste más cuando trabajaste en sesiones de 25 minutos.

No necesita análisis complejo con IA para el MVP.

---

## 9. Chat Sui

El chat no debe ser un chatbot genérico.

Debe orientarse directamente a productividad.

Acciones rápidas:

- Planear mi día.
- Dividir una meta.
- Ayúdame a empezar.
- Organizar esta tarde.
- Revisar mi semana.
- Priorizar mis pendientes.

Ejemplo:

```text
Usuario:
Tengo que terminar Sui antes del jueves y estoy atrasado.

Sui:
Vamos a reducirlo a algo manejable.

Podemos dividirlo en:
1. Funcionalidad crítica.
2. Demo.
3. Pitch.

¿Cuánto tiempo tienes hoy?
```

Mantener:

- Streaming SSE.
- Respuestas breves.
- Historial local.
- TTL de 48 h.
- Sin sincronización del chat.
- Protocolo de crisis antes de enviar.

---

## 10. Captura rápida

Botón rápido para crear:

- Meta.
- Hábito.
- Evento.

Templates opcionales:

### Proyecto

- Definir entregables.
- Construir.
- Revisar.
- Entregar.

### Examen

- Revisar temario.
- Estudiar.
- Resolver ejercicios.
- Repasar.

### Rutina

- Crear hábito.
- Seleccionar días.
- Definir recordatorio.

No requiere IA necesariamente.

---

## 11. Inicio configurable

El usuario puede decidir qué módulos aparecen.

Opciones:

- Próxima acción.
- Pomodoro.
- Hábitos.
- Agenda.
- Progreso.
- Racha.

Debe permitirse:

- Mostrar/ocultar.
- Subir/bajar módulos.

No se necesita un editor visual complejo.

---

## 12. Recuperación de constancia

Romper una racha no debe provocar una experiencia punitiva.

Ejemplo:

```text
Ayer no salió.

Tu progreso sigue aquí.

[ Retomar hoy ]
```

Mostrar:

- Racha actual.
- Mejor racha.
- Historial acumulado.

La constancia debe representarse como progreso continuo, no como perfección.

---

# 13. Pilares del producto

## Organizar
Metas, hitos, hábitos y agenda.

## Decidir
Próxima acción y Plan del día.

## Enfocarse
Pomodoro contextual.

## Mantener constancia
Rachas, XP, recordatorios y accountability.

## Adaptarse
Tu ritmo, horarios y personalización.

## Entender progreso
Resumen diario y revisión semanal.

## Acompañar
Chat Sui contextual.

## Funcionar sin depender de internet
Arquitectura local-first, invitado y sincronización opcional.

---

# 14. Prioridad de implementación inmediata

## P0 — Crítico para la demo

1. Rediseñar Inicio.
2. Integrar Pomodoro con metas y hábitos.
3. Completar metas/hábitos en un toque.
4. Mejorar Agenda.
5. Chat con acciones contextuales.

## P1 — Alto impacto

6. Plan del día.
7. Tu ritmo: Ligero / Equilibrado / Sprint.
8. Revisión semanal.
9. Captura rápida.
10. Activar/pulir Accountability.

## P2 — Pulido

11. Inicio configurable.
12. Estados local/cloud claros.
13. Estados vacíos y carga.
14. Accesibilidad.
15. ES/EN.
16. Logout, exportación y eliminación sin residuos.

---

# 15. No implementar ahora

Dejar explícitamente como futuro:

- Outlook Calendar.
- Apple Calendar.
- Escritura automática a calendarios externos.
- Sincronización cloud de Pomodoro.
- Sincronización cloud del chat.
- Sincronización de Accountability.
- RBAC y panel de roles.
- Red social.
- IA completamente autónoma creando y modificando tareas.
- Widgets nativos complejos.

---

# 16. Restricción de arquitectura

No modificar innecesariamente:

- Productividad v9.
- Estrategia local-first.
- Sync CAS.
- Auth.
- Modelo de datos estable.
- Firestore.
- Backend actual.

Las nuevas funciones deben construirse principalmente reutilizando:

- Metas.
- Hábitos.
- Agenda.
- Pomodoro.
- Progreso.
- Accountability.
- Engagement.
- Chat.

Objetivo: aumentar significativamente la calidad percibida sin introducir riesgos estructurales antes de la final.

---

# 17. Objetivo para la final

La demo debe conseguir que Sui se perciba como un producto coherente, no como una colección de features.

Recorrido ideal:

```text
Inicio
→ Siguiente acción
→ Modo Enfoque
→ Completar
→ Progreso
→ Agenda
→ Chat Sui
```

El usuario debe poder entender en menos de un minuto:

1. Qué tiene que hacer.
2. Por qué importa.
3. Cómo empezar.
4. Cómo mantener constancia.
5. Cuánto está avanzando.

Ese es el núcleo de Sui para Hackathon Nicaragua 2026.