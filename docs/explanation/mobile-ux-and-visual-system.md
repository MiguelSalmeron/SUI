# UX móvil y sistema visual

## Objetivo

Sui está diseñada primero para teléfonos. La experiencia busca transmitir calma
y acompañamiento sin introducir pausas artificiales, animaciones largas ni
pasos innecesarios. Los acentos energéticos aparecen únicamente cuando ayudan
a actuar o reconocer un avance.

La dirección visual se resume en tres principios:

1. **Calma modesta:** fondos naturales, superficies discretas y jerarquía sin
   decoración excesiva.
2. **Respuesta inmediata:** las acciones frecuentes están a un toque y la
   interfaz no añade esperas deliberadas.
3. **Energía con propósito:** naranja para rachas, prioridades y celebraciones;
   nunca como color dominante de navegación.

## Arquitectura de información

La navegación inferior prioriza cuatro destinos operativos. Metas y Hábitos
permanecen separados porque representan modelos distintos, aunque puedan
relacionarse.

| Pestaña | Pregunta que responde | Responsabilidad |
| --- | --- | --- |
| Inicio | ¿Qué hago ahora? | Próxima actividad, avance y agenda de hoy |
| Metas | ¿Qué quiero terminar? | Resultados finitos, fechas, progreso e hitos |
| Hábitos | ¿Qué quiero repetir? | Frecuencia, cumplimiento diario, racha y vínculos |
| Agenda | ¿Cuándo ocurre? | Calendario mensual y actividades por fecha |

La acción central **Sui** se inserta entre Metas y Hábitos. Abre el Chat como
pantalla completa del stack y no cambia la pestaña seleccionada. **Progreso**
es una pantalla secundaria: se abre desde la tarjeta «Progreso del día» de
Inicio y Back regresa al mismo contexto.

El encabezado global se limita a la marca Sui y el avatar. El avatar abre
Ajustes, donde la sección Cuenta informa si los datos están «En la nube»,
«Pendientes de sincronizar» o permanecen como «Datos locales».

### Relación entre metas y hábitos

- Una meta tiene fecha límite, porcentaje de avance e hitos.
- Un hábito tiene frecuencia, estado diario y racha.
- Un hábito puede impulsar una meta, pero no se convierte en una meta.
- Inicio y Agenda pueden reunir ambos modelos para ejecutar o consultar el día.
- La administración siempre permanece en sus pestañas independientes.

## Jerarquía de las pantallas

### Inicio

Inicio está limitado al día actual para no duplicar la función de Agenda. El
orden visual es:

1. fecha y mensaje breve;
2. próxima actividad;
3. progreso del día, racha y XP, con acceso al detalle de Progreso;
4. agenda cronológica.

Los eventos pasados de Google Calendar no se presentan como la próxima
actividad. Metas y hábitos pendientes sí permanecen accionables hasta que se
completan.

### Metas

Las metas se dividen en **Activas** y **Completadas**. La lista presenta
importancia, fecha, avance y un resumen de hitos. Los hitos se expanden bajo
demanda para evitar tarjetas permanentemente densas.

Crear una meta exige decisiones visibles:

- nombre del resultado;
- horizonte de fecha;
- importancia normal o prioritaria.

Eliminar y completar/reabrir se encuentran en un menú secundario. La
eliminación siempre requiere confirmación.

### Hábitos

Hábitos ofrece dos contextos:

- **Hoy:** ejecución de las repeticiones correspondientes al día;
- **Mis hábitos:** administración de todas las rutinas.

El formulario solicita acción, frecuencia y vínculo opcional con una meta. Las
acciones de proteger racha y eliminar están en el menú secundario; completar
permanece como la acción principal de un toque.

### Agenda

Agenda usa una cuadrícula mensual real alineada de lunes a domingo. Permite:

- cambiar de mes;
- volver rápidamente a hoy;
- identificar eventos y metas mediante indicadores discretos;
- consultar todas las actividades de la fecha seleccionada;
- crear una entrega directamente en esa fecha;
- conectar Google Calendar en modo de solo lectura.

La conexión externa se muestra en una fila compacta para no desplazar el
calendario fuera del primer viewport.

### Progreso

Progreso concentra nivel, XP, insight semanal, gráfica, métricas y logros. No
incluye acciones de planificación ni ocupa una pestaña inferior. Las
superficies sustituyen los grandes bloques saturados para mantener la lectura
tranquila.

## Sistema visual

Los tokens viven en `src/shared/theme/theme.ts` y deben consumirse mediante
`useAppTheme()`.

### Color

- **Marca — azul Sui `#218ECE`:** isologo, isotipo e ilustración.
- **Primary — azul acción `#1677A6`:** navegación, selección y acciones con
  texto blanco accesible.
- **Secondary — salvia `#55796F`:** hábitos, constancia y acompañamiento.
- **Flame — naranja `#E87536`:** rachas, prioridad y celebraciones; usa texto
  marino.
- **Background/surfaces:** blanco, azulados suaves y marino para reducir fatiga
  sin perder separación entre elementos.

Existe un esquema oscuro equivalente. Los componentes deben usar pares
semánticos (`primary/onPrimary`, `flame/onFlame`, etc.) para conservar
contraste en ambos esquemas.

### Tipografía

Poppins Regular, Medium, SemiBold y Bold forman la interfaz. Fredoka One queda
reservada para bienvenida, hitos, niveles y celebraciones. Las pantallas usan:

- `headlineSm` para títulos de primer nivel;
- `titleLg`, `titleMd` y `titleSm` para jerarquía interna;
- `bodyMd` y `bodySm` para descripción y metadatos;
- `labelLg`, `labelMd` y `labelSm` para acciones y estados.

El ajuste de tamaño de texto continúa aplicándose desde `useSettingsStore`. La
guía completa de marca vive en
[`product-brand-identity.md`](product-brand-identity.md).

### Formas y superficies

- radios medianos para campos y controles;
- radios grandes para tarjetas;
- radio completo para pills, indicadores y botones circulares;
- bordes sutiles antes que sombras intensas;
- una tarjeta protagonista por pantalla como máximo.

`ScreenIntro` define el encabezado estándar de las pantallas principales. Los
formularios específicos permanecen dentro de cada funcionalidad:

```text
src/shared/ui/ScreenIntro.tsx
src/features/goals/components/GoalFormModal.tsx
src/features/habits/components/HabitFormModal.tsx
```

## Reglas de interacción móvil

- Objetivos táctiles principales de al menos 40–44 dp.
- Etiquetas e iconos visibles en las cuatro pestañas inferiores.
- La acción central Sui tiene rol de botón; los destinos inferiores tienen rol
  de pestaña y exponen su estado seleccionado.
- El contenido usa un padding inferior compartido para no quedar oculto por la
  barra ni por el safe area del dispositivo.
- Acciones destructivas fuera del flujo principal y con confirmación.
- Estados vacíos con una acción siguiente clara.
- Una acción primaria por formulario.
- Listas verticales como patrón principal; desplazamiento horizontal sólo para
  selecciones compactas.
- Feedback háptico y celebraciones después de completar, nunca antes.
- Sin animaciones que retrasen la disponibilidad de una acción.

## Rendimiento

- Cálculos de listas y calendarios se memoizan cuando dependen de estado.
- Los estilos compartidos por render se memoizan según los tokens del tema.
- La navegación conserva carga diferida de pestañas.
- Google Calendar continúa leyendo caché local antes de sincronizar.
- No se añadieron dependencias visuales ni fuentes remotas.

## Accesibilidad

- Los controles interactivos incluyen rol y etiqueta accesible.
- Los filtros exponen estado seleccionado.
- Los checkboxes exponen estado marcado.
- El color no es el único indicador de selección o finalización.
- Claro y oscuro usan tokens `on*` específicos para contraste.

## Verificación

Antes de integrar cambios visuales se debe ejecutar:

```bash
npm run check
npm run export:web
```

La revisión final debe completarse también en un teléfono o emulador Android y,
cuando haya disponibilidad, en un dispositivo iOS para validar safe areas,
teclado, tamaño de texto y objetivos táctiles.
