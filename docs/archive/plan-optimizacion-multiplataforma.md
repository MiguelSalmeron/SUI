# Plan estructurado de optimización multiplataforma — SUI

**Estado:** Plan propuesto, pendiente de ejecución  
**Prioridad:** Rendimiento → UX multiplataforma → Estabilidad → Producción  
**Alcance:** Android, iOS y Web/PWA  
**Principio:** medir primero, cambiar poco, validar después

---

## 1. Objetivo

Hacer que SUI sea más rápida, fluida, consistente y resistente en Android, iOS y Web sin perder:

- funcionamiento offline-first;
- privacidad local del historial del chat;
- sincronización con Firebase;
- navegación y tema Material Design 3;
- integración confiable con Google Calendar y agenda unificada;
- protocolo de detección de crisis.

El plan prioriza cambios verificables. No se añadirán dependencias ni se reescribirá la arquitectura completa salvo que una medición demuestre que es necesario.

---

## 2. Hallazgos de la revisión del código

| Prioridad | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| P1 | La conexión real necesita validación manual con Google Cloud. | Ya existe `useGoogleCalendar` + `fetchGoogleCalendarEvents` con `calendar.readonly`, pero requiere API habilitada, Client IDs y consentimiento OAuth reales. | Sin esa configuración externa no se puede completar el enlace en un dispositivo. |
| P1 | Calendar/Radar ya tiene el flujo base de conexión, actualización y desconexión. | `CalendarScreen.tsx` muestra estado, caché, errores y acciones; falta probar permisos y refresh en cada plataforma. | El riesgo actual es de configuración OAuth y pruebas manuales, no de ausencia de UI. |
| P2 | El modelo de eventos ya fue normalizado para Calendar. | `GoogleEvent` incluye `calendarId`, `startAt/endAt`, zona horaria, `allDay`, `source` y fecha/hora de presentación. | Queda validar casos reales de zona horaria, paginación y eventos recurrentes. |
| P1 | La hidratación espera la nube antes de publicar el estado local. | `useHomeStore.loadState()` lee AsyncStorage, pero espera `loadUserData()` hasta 5 s antes de hacer `set()`. | Contradice el objetivo offline-first y retrasa la primera pantalla. |
| P2 | Quedan referencias históricas de Pomodoro fuera del código activo. | Se eliminaron las pantallas, store, engine, panel, notificaciones y cálculos de gamificación; falta revisar documentos de trabajo antiguos. | Evita que una funcionalidad eliminada vuelva a aparecer en mantenimiento o roadmap. |
| P1 | El streaming del chat actualiza el store y hace scroll por cada fragmento. | `ChatScreen.tsx` llama `appendChunk()` y `scrollToEnd()` en cada `onChunk`. | Puede provocar renders y operaciones de layout excesivas durante respuestas largas. |
| P1 | Tres pantallas renderizan listas con `ScrollView` + `.map()`. | `GoalsScreen.tsx`, `HabitsScreen.tsx`, `CalendarScreen.tsx`. | Escala mal si crece el número de metas, hábitos o elementos del calendario. |
| P1 | Cada guardado serializa y sube el documento completo del usuario. | `useHomeStore.saveState()` usa `JSON.stringify()` y `setDoc()` con todos los arrays. | Más I/O local, tráfico y riesgo de pisar cambios si la cola crece. |
| P1 | El tamaño de fuente no está centralizado. | `theme.ts` escala `theme.type`, pero muchas pantallas usan `fontSize` numérico directo. | La opción “Grande” no afecta de forma consistente toda la aplicación. |
| P2 | Hay controles con áreas táctiles menores que el objetivo documentado de 48 dp. | Acciones de eliminar/congelar en `GoalsScreen.tsx` y `HabitsScreen.tsx`, entre otros. | Peor accesibilidad y más errores de pulsación. |
| P2 | El layout Web/tablet aún usa navegación inferior y dimensiones fijas. | `TabNavigator.tsx`, `NAV_BAR_HEIGHT`, estilos de tabs y FAB. | La experiencia no se adapta bien a pantallas anchas. |
| P2 | El teclado Android no tiene un comportamiento específico en Chat. | `ChatScreen.tsx`: `KeyboardAvoidingView` solo configura `padding` en iOS; Android usa la configuración global `pan`. | Riesgo de que el campo o el botón de envío queden ocultos. |
| P2 | El calendario usa un ancho porcentual fijo combinado con `gap`. | `CalendarScreen.tsx`: `width: '12.8%'` y `gap: 6`. | Puede producir desbordamiento en algunos anchos. |
| P2 | La CI valida TypeScript, tests y Functions, pero no lint, export Web ni build release. | `.github/workflows/ci.yml`. | Errores de plataforma o de empaquetado pueden aparecer tarde. |
| P2 | La documentación tiene referencias antiguas. | Varias páginas hablan de `SUI-2`, `sui-home-state-v4` o componentes que ya no coinciden exactamente con el código actual (`v6`, `TabNavigator`). | Dificulta mantenimiento, onboarding y auditoría. |
| P3 | Las reglas de Firestore permiten leer/escribir el documento de usuario completo sin validación de forma o tamaño. | `firestore.rules`. | La autorización por UID es correcta como base, pero faltan límites y validaciones adicionales. |
| P3 | El rate limit de `chatProxy` es fail-open y CORS permite `*`. | `functions/src/index.ts`. | Mejora futura de control de abuso y exposición del endpoint Web. |

---

## 3. Puerta de calidad previa: contrato de Google Calendar

Aunque el orden general sea 1 → 2 → 3 → 4, estas tareas se ejecutan primero porque definen el contrato de la funcionalidad que sustituye al Pomodoro.

### CAL-01 — Definir el flujo de conexión

**Archivos principales:**

- `src/services/googleSync.ts`
- `src/services/googleAuth.ts`
- `src/hooks/useGoogleAuth.ts`
- `src/screens/tabs/CalendarScreen.tsx`
- `src/types/models.ts`

**Decisiones:**

1. Separar autenticación de identidad Firebase y autorización para leer Google Calendar. Tener un usuario autenticado con Google no implica automáticamente disponer de un token con scopes de Calendar.
2. Empezar con permiso de solo lectura, salvo que el producto requiera crear o editar eventos.
3. Definir el comportamiento por plataforma: Web, Android, iOS y Expo Go/build de producción.
4. Guardar tokens de forma segura y nunca en AsyncStorage sin protección si la integración los requiere.
5. Mostrar claramente conectar, conectado, sincronizando, desconectado, permiso denegado y error.

**Aceptación:**

- El usuario entiende qué permiso concede y por qué.
- Cancelar el consentimiento no genera un error bloqueante.
- La app funciona sin Google Calendar usando datos locales.
- Desconectar elimina credenciales/cache asociadas sin borrar metas ni hábitos SUI.

### CAL-02 — Sustituir eventos demo por una fuente real y controlada

**Acciones:**

1. Eliminar la siembra automática de `DEMO_GOOGLE_EVENTS` en producción.
2. Mantener datos mock solo bajo una ruta de desarrollo/test explícita.
3. Crear un repositorio de calendario con `connect`, `disconnect`, `refresh`, `loadCache` y `syncStatus`.
4. Guardar `lastSyncedAt`, rango sincronizado y origen de los datos.
5. Definir un rango inicial razonable, por ejemplo eventos cercanos a la fecha actual, sin descargar calendarios ilimitados.
6. Manejar paginación, expiración de token, revocación, red lenta y respuesta vacía.

**Aceptación:**

- Los eventos visibles proceden de la cuenta conectada o de la caché identificada como tal.
- El usuario puede reintentar la sincronización.
- La última caché sigue disponible offline con una etiqueta de fecha.
- Nunca se confunden eventos demo con eventos reales.

### CAL-03 — Normalizar eventos y agenda unificada

Ampliar el modelo `GoogleEvent` para contemplar, como mínimo:

- `id` y `calendarId`;
- título y descripción opcional;
- inicio y fin con zona horaria;
- `allDay`;
- ubicación;
- color/origen opcional;
- `source: 'google' | 'mock'`.

Actualizar `buildUnifiedTimeline()` para:

- ordenar por timestamp y no por texto `AM/PM`;
- respetar zona horaria local;
- distinguir eventos de Google de metas/hábitos SUI;
- evitar duplicados al refrescar;
- tratar correctamente eventos de día completo y de varias horas.

### CAL-04 — Pruebas del calendario

Cubrir:

- conexión aceptada, cancelada y denegada;
- token caducado o revocado;
- sincronización con red y sin red;
- cache vacía y cache antigua;
- paginación;
- zona horaria y cambio de horario;
- evento de día completo;
- mezcla Google + metas + hábitos;
- logout y desconexión.

---

## 4. Fase 0 — Medición y guardrails

**Objetivo:** establecer una línea base antes de optimizar.

### Tareas

- Crear una pequeña utilidad de medición solo para desarrollo:
  - inicio de app;
  - tiempo hasta auth lista;
  - tiempo hasta Zustand hidratado;
  - tiempo hasta primera pantalla interactiva;
  - duración de carga local y nube;
  - latencia hasta primer chunk del chat.
- Registrar en modo desarrollo, sin datos personales ni texto del chatbot.
- Usar React DevTools/Profiler y pruebas en un Android económico, un iPhone y Web.
- Documentar baseline en una tabla de rendimiento.
- Mantener el cambio de `tsconfig.json` que incluye `App.tsx`.

### Presupuesto inicial propuesto

Estos son objetivos de trabajo, no mediciones actuales:

| Métrica | Objetivo inicial |
|---|---:|
| Primera UI útil con datos locales | ≤ 1,5 s en dispositivo de prueba |
| Bloqueo por red durante arranque | 0 s después de publicar el estado local |
| Actualizaciones de UI del streaming | ≤ 10 por segundo |
| Frames lentos durante scroll | 0 bloqueos repetidos perceptibles |
| Peticiones de guardado duplicadas | 0 durante una ráfaga de cambios |
| Sincronización Google Calendar | Estado visible y recuperable ante red lenta/offline |
| Primer token del chat | Mantener el objetivo existente de < 3 s cuando el backend responda |

### Salida

- Informe breve `docs/performance-baseline.md`.
- Lista de mediciones reproducibles.
- Decisión de qué optimizaciones se mantienen, descartan o reordenan.

---

## 5. Fase 1 — Rendimiento

### PERF-01 — Estado local primero, nube después

**Problema:** `loadState()` bloquea la publicación del estado local mientras espera Firestore.

**Diseño propuesto:**

1. Leer y validar AsyncStorage.
2. Aplicar reset diario local.
3. Publicar el estado local y marcar la UI como disponible.
4. Cargar Firestore en segundo plano.
5. Reconciliar con una política explícita.
6. Guardar el resultado local y remoto sin bloquear la navegación.

**Decisión necesaria antes de implementar:**

- Para cambios pendientes locales, usar `updatedAt`/versión por documento o una cola de operaciones.
- No mantener la política implícita “la nube siempre gana” si puede borrar una modificación offline reciente.
- Exponer un estado de sincronización: `idle`, `syncing`, `synced`, `offline`, `error`.

**Criterio:** con red lenta o caída, el usuario puede ver y editar el tablero local sin esperar 5 s.

### PERF-02 — Repositorio único de persistencia

Crear una capa pequeña, por ejemplo `src/services/homeRepository.ts`, que centralice:

- lectura local;
- validación/migración;
- lectura remota;
- reconciliación;
- guardado local;
- guardado remoto;
- estado de sync.

El store debe coordinar estado de UI, no conocer todos los detalles de AsyncStorage y Firestore.

**Criterio:** una sola política de persistencia y tests unitarios independientes de React.

### PERF-03 — Streaming del chat por lotes

**Problema:** cada chunk produce una mutación de array, render de `FlatList` y scroll.

**Propuesta:**

- Acumular chunks en un buffer/ref.
- Vaciar el buffer con una frecuencia limitada, por ejemplo cada 50–100 ms o en `requestAnimationFrame`.
- Hacer scroll como máximo una vez por flush y solo si el usuario está cerca del final.
- Cancelar y limpiar el flush al desmontar o terminar el stream.
- Mantener `ChatMessage` memoizado.

**Criterio:** la respuesta sigue apareciendo progresivamente, pero el número de actualizaciones no crece con cada fragmento SSE.

### PERF-04 — Virtualización de listas

Migrar de forma incremental:

1. `HabitsScreen` → `FlatList` de hábitos.
2. `GoalsScreen` → `FlatList` de metas, con hitos dentro de cada tarjeta.
3. `CalendarScreen` → `FlatList`/estructura de grid estable si el calendario crece.
4. Evaluar timeline de `OverviewScreen` si deja de ser pequeño.

Crear filas memoizadas, `keyExtractor` estable y estados de lista vacía/cargando/error.

**No hacer aún:** ajustar `windowSize` a ciegas. Medir primero memoria y fluidez.

### PERF-05 — Guardado eficiente y observable

- Conservar el debounce actual como base, pero hacerlo explícito y testeable.
- Coalescer cambios durante una escritura en vuelo.
- Evitar guardar si el estado serializado no cambió.
- Exponer `syncPending`/`lastSyncedAt` en vez de inferir solo “Local/Nube”.
- En una segunda iteración, escribir solo dominios modificados si el modelo lo permite.

**Criterio:** una ráfaga de 10 cambios genera una sola escritura final o una secuencia mínima controlada.

### PERF-06 — Reducir trabajo de render

Revisar con Profiler:

- suscripciones a stores con selectores pequeños;
- callbacks creados en cada render de `TabNavigator`;
- estilos creados repetidamente (`headerStyles(colors)`, `badgeStyles(colors)`, etc.);
- componentes de tarjeta que puedan ser `React.memo`;
- cálculos repetidos de fechas, filtros y estadísticas.

No aplicar `useMemo`/`useCallback` de forma masiva sin una medición.

---

## 6. Fase 2 — UX multiplataforma

### UX-01 — Contenedor responsive común

Crear `src/components/layout/ResponsiveScreen.tsx` o equivalente con:

- `useWindowDimensions()`;
- ancho máximo para Web/tablet;
- padding horizontal adaptativo;
- variantes móvil/tablet/escritorio;
- fondo y safe area consistentes.

**Regla inicial:** móvil mantiene una columna; tablet puede usar dos; escritorio centra el contenido y evita estirarlo a todo el ancho.

### UX-02 — Navegación adaptativa

Evaluar por plataforma y ancho:

- móvil: bottom tabs actuales;
- tablet: bottom tabs o variante más compacta;
- escritorio Web: navegación lateral o barra superior si mejora el acceso.

Mantener los mismos nombres de rutas y accesibilidad. No duplicar pantallas por plataforma.

### UX-03 — Safe areas y FAB

Revisar `TabNavigator`, headers, modales y la pantalla Calendar/Radar:

- usar insets reales en top/bottom;
- evitar padding fijo duplicado;
- recalcular la posición del FAB con barra + inset;
- probar notch, home indicator, teclado y rotación;
- comprobar Web móvil.

### UX-04 — Teclado y formularios

Pantallas objetivo:

- `ChatScreen`;
- onboarding;
- login/registro;
- `PromptModal`;
- conexión y filtros de Calendar/Radar.

Acciones:

- configurar `KeyboardAvoidingView` por plataforma;
- revisar `softwareKeyboardLayoutMode` de `app.json`;
- hacer scroll al campo activo;
- cerrar teclado al pulsar fuera;
- conservar visible el botón principal;
- probar multiline y envío del chat en Android/iOS/Web.

### UX-05 — Tipografía y tamaño de fuente real

- Adoptar `theme.type` en títulos, labels, body y botones.
- Reemplazar gradualmente `fontSize` directos en pantallas y componentes.
- Definir límites para evitar overflow en botones, tabs y calendario.
- Probar `small`, `medium`, `large` en cada pantalla.

**Criterio:** cambiar el tamaño de fuente altera de forma consistente el texto sin cortar acciones ni romper layouts.

### UX-06 — Accesibilidad y touch targets

- Garantizar áreas interactivas de al menos 44–48 dp según plataforma.
- Añadir `accessibilityLabel`, `role`, `state` y `hint` donde falten.
- Añadir estado accesible al temporizador y progreso.
- Revisar contraste light/dark.
- No depender únicamente de color para urgencia, estrés, completado o sincronización.
- Probar TalkBack, VoiceOver y teclado en Web.

### UX-07 — Estados de interfaz

Crear componentes reutilizables:

- `LoadingState`;
- `EmptyState`;
- `ErrorState`;
- `OfflineBanner`;
- `SyncIndicator`;
- `RetryButton`.

Aplicarlos primero en Home, Metas, Hábitos, Chat y Resumen.

### UX-08 — Calendario estable

- Sustituir el ancho `12.8%` por una estrategia de siete columnas que tenga en cuenta el gap.
- Probar anchos pequeños, tablets y Web.
- Añadir labels accesibles a cada fecha.
- Mostrar claramente fecha seleccionada, hoy, actividad y nivel de carga.

---

## 7. Fase 3 — Estabilidad y calidad

### STAB-01 — Tests del motor y persistencia

Agregar pruebas para:

- Persistencia local: datos corruptos, migración, reset diario.
- Google Calendar: autorización, caché, refresh, paginación y zona horaria.
- Reconciliación local/nube: sin conexión, nube antigua, cambio local pendiente y conflicto.
- Cola de guardado: debounce y escritura en vuelo.
- Chat: batching de chunks, cancelación, timeout, error y TTL.
- Notificaciones: permisos denegados, reprogramación y cancelación.

### STAB-02 — Tests de UI críticos

Extender los tests actuales con:

- completar/eliminar una meta;
- completar/congelar un hábito;
- conexión, actualización y desconexión de Google Calendar;
- cambio de tema y tamaño de fuente;
- estados vacíos y de error;
- accesibilidad básica de acciones principales.

### STAB-03 — Errores tipados y recuperación

Definir categorías de error:

- `network`;
- `auth`;
- `firestore`;
- `validation`;
- `chat`;
- `notification`;
- `unknown`.

Cada error debe tener:

- mensaje para usuario;
- detalle técnico solo para logs;
- acción sugerida;
- posibilidad de reintento cuando corresponda.

### STAB-04 — Validación de datos

- Validar datos leídos de AsyncStorage antes de introducirlos en los stores.
- Validar documentos Firestore en la frontera.
- Añadir migraciones versionadas para `sui-home-state-v6`.
- Actualizar la documentación que aún menciona `v4`.

### STAB-05 — Ciclo de vida y limpieza

Auditar que se cancelen siempre:

- timers;
- listeners de `AppState`;
- suscripciones de Firestore;
- conexiones SSE;
- animaciones en background;
- callbacks pendientes al desmontar pantallas.

---

## 8. Fase 4 — Preparación para producción

### PROD-01 — CI reproducible

Ampliar `.github/workflows/ci.yml` de forma gradual:

1. `npm ci`.
2. Typecheck de app incluyendo `App.tsx`.
3. Tests.
4. Build de Functions.
5. Lint/format si se incorpora una herramienta aprobada.
6. Export Web en un job separado.
7. Validación de configuración sin exponer secretos.
8. Build release/EAS en workflow manual, no en cada PR.

### PROD-02 — Firebase y reglas

- Mantener aislamiento por UID.
- Revisar si el documento `/users/{uid}` necesita límites de tamaño y validación de campos.
- Revisar reglas de `rate_limits` para que el cliente no pueda manipular el rate limit usado por Functions.
- Probar reglas con Firebase Emulator.
- Verificar que la configuración de crisis sea pública solo en lectura y no contenga datos sensibles.

### PROD-03 — Cloud Function de chat

- Confirmar límites de coste y latencia.
- Evaluar rate limit fail-closed o un modo degradado explícito en lugar de fail-open.
- Restringir CORS cuando exista una lista de dominios Web válida.
- No registrar contenido sensible del chat.
- Añadir pruebas del payload, auth, rate limit, timeout y stream.
- Revisar que los logs no expongan secretos ni información innecesaria.

### PROD-04 — EAS, variables y builds

- Reemplazar placeholders `REPLACE_VIA_EAS_VARIABLE` mediante EAS Secrets/Variables.
- Verificar que Web, Android e iOS reciben la configuración correcta.
- Configurar Client IDs de Google por plataforma.
- Confirmar SHA-1/SHA-256 de debug y release.
- Revisar `google-service-account.json` y asegurar que nunca se versiona.
- Generar APK/AAB release real y probarlo sin Metro.

### PROD-05 — Observabilidad respetuosa con la privacidad

Medir sin almacenar texto sensible:

- versión de app;
- plataforma;
- tiempo de arranque;
- fallo de autenticación;
- fallo de sincronización;
- duración de petición de chat;
- primer chunk/timeout;
- fallo de notificación;
- crash nativo o JS.

La instrumentación debe poder desactivarse en desarrollo y no guardar mensajes del chat.

### PROD-06 — Matriz de pruebas manuales

| Plataforma | Dispositivo/entorno | Flujos mínimos |
|---|---|---|
| Android | gama baja + Android reciente | onboarding, offline, teclado, Google Calendar, notificaciones |
| iOS | iPhone con notch/home indicator | safe areas, teclado, background, permisos, deep link |
| Web móvil | Chrome/Safari | responsive, refresh, auth, chat, dark mode |
| Web escritorio | Chrome/Firefox/Safari | layout ancho, navegación, accesibilidad de teclado |
| Android release | APK/AAB real | Firebase, Google, notificaciones, actualización |

---

## 9. Dependencias y orden de ejecución

```text
CAL-01/CAL-02/CAL-03/CAL-04
    ↓
Fase 0: medición
    ↓
PERF-01 + PERF-02
    ↓
PERF-03 + PERF-04 + PERF-05 + PERF-06
    ↓
UX-01 + UX-02 + UX-03 + UX-04
    ↓
UX-05 + UX-06 + UX-07 + UX-08
    ↓
STAB-01 + STAB-02 + STAB-03 + STAB-04 + STAB-05
    ↓
PROD-01 + PROD-02 + PROD-03 + PROD-04 + PROD-05 + PROD-06
```

### Orden recomendado por iteraciones

#### Iteración A — Calendario y base confiable

- CAL-01 a CAL-04.
- Fase 0.
- Tests de conexión, caché, normalización y agenda unificada.

#### Iteración B — Primer rendimiento visible

- PERF-01, PERF-02.
- PERF-05.
- PERF-06.
- Comparar arranque, renders y escrituras con baseline.

#### Iteración C — Listas y chat

- PERF-03.
- PERF-04.
- PERF-06.
- Probar con datos artificiales grandes antes de cambiar parámetros de virtualización.

#### Iteración D — Experiencia móvil y Web

- UX-01 a UX-04.
- Matriz de safe areas y teclado.

#### Iteración E — Accesibilidad y consistencia visual

- UX-05 a UX-08.
- Pruebas de fuente, contraste y touch targets.

#### Iteración F — Confianza para release

- STAB-01 a STAB-05.
- PROD-01 a PROD-06.

---

## 10. Ciclo de trabajo para cada tarea

Cada tarea se ejecutará así:

1. **Reproducir:** capturar el comportamiento actual y el caso límite.
2. **Medir:** registrar la métrica relevante antes del cambio.
3. **Diseñar:** elegir la modificación mínima compatible con la arquitectura.
4. **Implementar:** modificar una superficie pequeña y mantener tipos estrictos.
5. **Probar:** añadir o actualizar tests del comportamiento.
6. **Verificar plataforma:** Android, iOS y Web cuando la tarea afecte UI/ciclo de vida.
7. **Comparar:** repetir la medición y confirmar que no empeoró otra métrica.
8. **Documentar:** actualizar arquitectura, persistencia o configuración si cambió el contrato.

No se considerará terminada una optimización solo porque “se siente más rápida”. Debe tener una medición, un test o una reproducción manual documentada.

---

## 11. Criterios de salida del plan

SUI estará lista para una primera release optimizada cuando:

- la primera UI local no dependa de una espera de Firestore;
- Google Calendar se conecte con consentimiento claro y tenga caché offline;
- la agenda unificada mezcle eventos de Google, metas y hábitos sin duplicados;
- listas y chat mantengan interacción fluida con datos grandes;
- teclado, safe areas y navegación funcionen en las tres plataformas;
- tamaño de fuente y accesibilidad sean coherentes;
- existan tests para sincronización, Google Calendar, chat y notificaciones;
- CI valide app, tests, Functions y export Web;
- Firebase Rules, EAS y variables estén verificadas en una build real;
- exista una matriz de pruebas manuales y un procedimiento de rollback;
- la documentación refleje `SUI`, las claves actuales y la arquitectura vigente.

---

## 12. Archivos que se tocarán probablemente

### Rendimiento y datos

- `src/store/useHomeStore.ts`
- `src/store/useChatStore.ts`
- `src/services/db.ts`
- `src/services/googleSync.ts`
- `src/services/homeStorage.ts`
- nuevo `src/services/homeRepository.ts` si se aprueba la separación
- nuevo repositorio/servicio de Google Calendar si se separa la autorización de identidad

### Pantallas y layout

- `src/screens/tabs/OverviewScreen.tsx`
- `src/screens/tabs/GoalsScreen.tsx`
- `src/screens/tabs/HabitsScreen.tsx`
- `src/screens/tabs/CalendarScreen.tsx`
- `src/screens/tabs/SummaryScreen.tsx`
- `src/screens/ChatScreen.tsx`
- `src/navigation/TabNavigator.tsx`
- `src/navigation/AppNavigator.tsx`
- `src/theme/theme.ts`
- nuevos componentes de layout/estado si se justifican

### Calidad y producción

- `src/**/__tests__/**`
- `functions/src/index.ts`
- `firestore.rules`
- `.github/workflows/ci.yml`
- `eas.json`
- `docs/explanation/*`
- `docs/reference/*`

---

## Decisiones que deben confirmarse durante la ejecución

1. **Autorización Calendar:** ¿solo lectura o también creación/edición de eventos?
2. **Credenciales:** ¿flujo OAuth independiente, proveedor Google existente o backend intermedio por plataforma?
3. **Reconciliación:** ¿última escritura por documento, por campo o cola de operaciones para datos SUI?
4. **Web:** ¿bottom tabs también en escritorio o navegación lateral?
5. **Observabilidad:** ¿qué proveedor se usará, si alguno, respetando la privacidad del chat?
6. **Soporte de orientación:** la configuración actual es portrait; decidir si tablets/rotación requieren soporte adicional.

Estas decisiones no bloquean la medición ni la limpieza del legado Pomodoro, pero sí deben resolverse antes de modificar el contrato de sincronización de Calendar.
