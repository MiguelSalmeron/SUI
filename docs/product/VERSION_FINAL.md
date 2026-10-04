# Sui — Descripción detallada y versión final

- **Estado:** complemento operativo del PRD, no lo reemplaza
- **Fuentes canónicas:** [PRD](PRD.md) define producto, [sistema de diseño](DESIGN_SYSTEM.md) define interfaz, [arquitectura](../explanation/architecture.md) define límites
- **Actualizado:** 4 de octubre de 2026
- **Propósito:** explicar la app a detalle, función por función y su porqué, para congelar la versión final sin prometer nada complejo

## 1. Qué es Sui y por qué existe

Sui ayuda a convertir intención en acción diaria sin convertir productividad en presión. Une metas, hábitos, agenda y acompañamiento conversacional en una experiencia móvil clara, local-first y con respaldo cloud opcional.

Promesa, según `PRD.md:15`:

> Organiza lo importante, construye constancia y decide siguiente paso con calma.

Principios que no se negocian, ver `PRD.md:20`:

1. Calma enfocada: jerarquía clara, poco ruido, cero urgencia artificial.
2. Acción inmediata: dato local primero, ninguna pantalla espera red.
3. Dominios claros: Meta y Hábito pueden relacionarse, nunca confundirse.
4. Cuenta opcional: producto útil sin registro, cloud aporta respaldo.
5. Confianza explícita: permisos, fusiones y eliminaciones piden contexto.
6. Escala por configuración: idiomas, mercados, crisis y conexiones crecen sin bifurcar producto.

Sui no diagnostica, no trata ni sustituye atención profesional. El chat da acompañamiento breve y orientación general.

## 2. Principio sin excusas: probar sin cuenta

La decisión más importante de producto es que podés probar Sui sin dar correo, sin crear cuenta y sin conexión. Así se quita toda excusa para no empezar.

Esto se sostiene con tres piezas en código:

- Entrada local en `apps/mobile/src/shared/account/useIntroStore.ts:96`: `accountMode: 'local'`, `syncEnabled: false`, `introComplete` no depende de Firebase. La puerta de `Home` se abre con hidratar `IntroState`, Firebase no bloquea la UI local.
- Alta anónima técnica para que el chat y las APIs autorizadas funcionen sin cuenta visible, ver `apps/mobile/src/features/auth/services/onboardingAuth.ts`.
- Productividad local inmediata en `apps/mobile/src/shared/domain/productivity/store/useProductivityStore.ts:21`: Zustand + AsyncStorage, la UI renderiza lo local y después intenta sync si hay sesión y red.

Local-first acá es secundario en el discurso pero importante en la arquitectura: no es el titular de marketing, es lo que permite cumplir “tiempo hasta primera acción útil menor a 90 segundos” y “inicio local útil en máximo 1.5 segundos”, ver `PRD.md:59`.

## 3. Mapa de la app: cómo queda la versión final

Navegación canónica, ver `docs/product/DESIGN_SYSTEM.md:30` y `apps/mobile/src/application/navigation/AppNavigator.tsx:54`:

```text
Root stack
├── Welcome
├── Register / Login / ForgotPassword / MergeData
├── Home
│   └── Bottom tabs: Inicio · Metas · Hábitos · Agenda
├── Chat                  # acción central Sui, isotipo, abre sin cambiar tab
├── Pomodoro              # pantalla raíz, se entra desde tarjeta en Inicio
├── Progress              # detalle secundario desde Inicio
├── Settings              # desde avatar
├── Connections           # desde Ajustes
└── AccountabilitySettings # sólo si EXPO_PUBLIC_ACCOUNTABILITY_ENABLED=true
```

Barra inferior real: cuatro rutas + botón central Sui. El botón central usa isotipo, rol `button` no `tab`, no muestra badge, conserva la tab anterior. Encabezado global: isologo Sui + avatar. Sin saludo, sin engranaje, sin badge de sync ni contadores en navegación.

Ancho máximo 560 dp centrado en tablet y web, safe areas siempre desde `react-native-safe-area-context`.

## 4. Funciones a detalle y su porqué

### 4.1 Bienvenida

Ubicación: `apps/mobile/src/features/onboarding/screens/WelcomeScreen.tsx:29`.

Dos pasos:

1. Bienvenida: marca compacta centrada, descripción breve, intención elegible (`explore` y otras según `starterKits`), vista previa breve del kit real editable o descartable, CTA `Empezar con esto` de 52 dp. CTA palpita suave con pausas, se detiene al tocar, cambiar de pantalla o pasar a segundo plano. Con reducción de movimiento queda estático.
2. Cuenta: valor de sincronización, `Crear cuenta` primario, `Ya tengo cuenta` outline, tarjeta colapsada `Probar sin cuenta`. Al abrir explica pérdida de datos al borrar datos, desinstalar o perder dispositivo y exige reconocimiento explícito antes de habilitar `Empezar sin cuenta`. Consentimiento 18+, Términos y Privacidad al final.

Porqué: sin preguntas de carrera, personalidad o cronotipo obligatorias, sin carga simulada ni metas sembradas a escondidas. La siembra de arranque según intención sólo crea una meta o un hábito de ejemplo, nunca historial, nunca espejo a Google, con aviso y acciones _Personalizar_ o _Descartar_. Así el primer ingreso no se siente vacío pero tampoco miente.

### 4.2 Inicio

Ubicación: `apps/mobile/src/features/home/screens/OverviewScreen.tsx:44`.

Contenido en orden:

```text
Fecha + mensaje breve
Próxima acción
Progreso del día → Ver progreso
Racha / XP
Agenda cronológica
Tarjeta Pomodoro
```

Si no hay Meta ni Hábito, sólo se muestra guía inicial con brote, diferencia Meta/Hábito y dos CTA independientes. Se ocultan próxima acción, progreso y agenda hasta crear el primer elemento. Fijate que esto evita el choque clásico de mala UX: mostrar gráficas en cero o loaders eternos cuando no hay nada que mostrar.

Porqué: una intención principal por pantalla. El usuario entiende en 10 segundos qué hacer hoy, sin modelar toda su vida antes de empezar.

### 4.3 Metas

Ubicación: `apps/mobile/src/features/goals/`.

- Tabs internas Activas / Completadas.
- Tarjeta: importancia, título, fecha, progreso, resumen de hitos.
- Crear: nombre, horizonte, importancia, hitos opcionales.
- Completar, reabrir y eliminar viven en menú secundario, eliminar confirma.
- Tap en contenido abre edición. Edición conserva ID, creación, progreso, hitos y completado. Cambio de fecha reemplaza fecha previa en agenda sin duplicarla.
- Vínculo opcional desde Hábito sin mezclar modelos.

Porqué: Meta es resultado finito con fecha. Si se mezcla con repetición, el usuario pierde la diferencia y abandona. Por eso lenguaje, estructura e iconografía siempre distinguen Meta de Hábito.

### 4.4 Hábitos

Ubicación: `apps/mobile/src/features/habits/`.

- Tabs internas Hoy / Mis hábitos.
- Tarjeta: acción, frecuencia, estado diario, racha, vínculo opcional a meta.
- Completar es acción primaria de un toque con haptic liviano.
- Proteger racha y eliminar viven en menú secundario.
- Selector semanal lunes a domingo, mínimo un día si la frecuencia es específica.
- Eliminar Meta desvincula hábitos relacionados sin borrarlos.

Porqué: Hábito es acción recurrente. Completar tiene que costar un toque, editar puede costar tres. Si completar cuesta lo mismo que editar, la constancia se cae.

### 4.5 Agenda

Ubicación: `apps/mobile/src/features/calendar/screens/CalendarScreen.tsx:29`.

- Mes lunes a domingo, empieza en 2 semanas por defecto y expande a mes bajo demanda para ir liviano en 320 dp.
- Cambio de mes + volver a hoy, indicadores discretos por fecha.
- Lista completa de fecha seleccionada con `FlatList`.
- Unifica metas, hábitos y eventos externos normalizados vía `buildUnifiedTimeline` en `apps/mobile/src/features/calendar/public.ts:3`.
- Crear entrega para fecha seleccionada con importancia fija `low`: la importancia se ajusta en Metas, no en la hoja rápida.
- CTA `Conectar calendario` sólo sin conexión y cuando aporta contexto. Gestión y revocación viven en Ajustes, Conexiones.

Porqué: agenda es lectura, no configuración. El usuario ve su día en un solo lugar sin salir de Sui.

### 4.6 Pomodoro: sí existe, hay que regresarlo bien

Estado real en código, no es promesa:

- Pantalla completa en `apps/mobile/src/features/pomodoro/screens/PomodoroScreen.tsx:32` con ruta raíz `Pomodoro` en `apps/mobile/src/application/navigation/AppNavigator.tsx:84`.
- Tarjeta de entrada en Inicio en `apps/mobile/src/features/pomodoro/components/PomodoroCard.tsx:27`, muestra estado vivo y sesiones de hoy, al tocar abre pantalla completa.
- Store persistido en `apps/mobile/src/features/pomodoro/store/usePomodoroStore.ts:69` con clave `@sui/pomodoro-v1`, duración 1 a 180 minutos, defecto 25, notificación al terminar apagada por defecto y opt-in explícito con permiso, estadísticas `sessions` y `focusMinutes` con rollover de medianoche, reconciliación por `targetEndTime` para background y reinicio.
- Motor en `apps/mobile/src/features/pomodoro/hooks/usePomodoroEngine.ts`, notificaciones en `apps/mobile/src/features/pomodoro/services/notifications.ts`.

Lo que falta para versión final:

1. Hacer visible la tarjeta en Inicio siempre, no sólo cuando hay productividad. Hoy queda abajo y se pierde si la lista crece.
2. Bloquear edición de minutos y notificaciones durante sesión en curso, con mensaje `lockedDuringSession`, ya existe en pantalla pero falta pulir copy ES/EN.
3. Añadir atajo desde Hábito y Meta: “enfocar 25 minutos en esto” que abre Pomodoro con contexto, sin acoplar stores. Sólo navegación con parámetro, nada de lógica cruzada.
4. Pomodoro es local, no se sincroniza. Aclararlo en Ajustes y en exportación para evitar choque de expectativa: mis sesiones no viajan entre dispositivos en v1.

Porqué: Pomodoro convierte intención en bloque de enfoque. Sin él, Sui organiza pero no ayuda a ejecutar. Con él mal integrado, estorba. Por eso entra como superficie de enfoque, no como quinta tab.

### 4.7 Progreso

Ubicación: `apps/mobile/src/features/home/screens/SummaryScreen.tsx`.

Nivel, XP, racha, insight semanal, gráfica, métricas y logros. Pantalla secundaria, no ocupa tab. Gamificación reconoce avance, no bloquea funciones ni castiga inactividad.

Porqué: progreso informa y motiva, nunca juzga. Si progreso castigara, Sui rompería su promesa de calma.

### 4.8 Chat Sui

Ubicación: `apps/mobile/src/features/chat/screens/ChatScreen.tsx:44`.

- Pantalla completa, respuestas breves, streaming SSE vía Cloud Function `chatProxy` hacia Azure OpenAI.
- Cliente detecta crisis antes del envío, pide Firebase ID token, abre SSE. Clave de Azure nunca va en el bundle móvil.
- Historial local con TTL 48 horas en AsyncStorage, nunca se sincroniza a Firestore, nunca va en logs o telemetría.
- Estado vacío ofrece sugerencias ES/EN. Tap rellena y enfoca input, nunca envía solo.
- Protocolo de crisis por país e idioma con config versionada por `{country}-{locale}`.

Porqué: acompañamiento para priorizar el día, dividir una meta o retomar un hábito. No es terapeuta ni reemplazo de emergencia. Por eso es breve, local y con protocolo explícito.

### 4.9 Cuenta, auth y fusión

Ubicación: `apps/mobile/src/features/auth/`, contexto en `apps/mobile/src/features/auth/context/AuthContext.tsx`, pantallas en `apps/mobile/src/features/auth/screens/`.

Modos en `apps/mobile/src/shared/account/useIntroStore.ts:9`: `local` y `registered`, con `syncEnabled` separado. Proveedores: correo y contraseña, Google, Apple en iOS. Verificación de correo antes de sync para password. Recuperación y cambio de contraseña, exportación, logout y eliminación completa.

Fusión en `apps/mobile/src/features/auth/screens/MergeDataScreen.tsx:19` cuando hay datos locales + cuenta existente:

1. `Combinar`, recomendada.
2. `Usar datos de la cuenta`, con confirmación explícita.
3. `Cancelar`, mantiene estado local y re-autentica anónimo.

Ninguna fuente se elimina antes de completar la operación. Logout limpia caché autenticada y crea espacio invitado separado. Cuenta password no verificada permanece local.

Porqué: la cuenta es para respaldar y moverse entre dispositivos, no para poder usar la app. Si pedir cuenta bloquea el primer uso, la mitad de la gente no prueba.

### 4.10 Ajustes

Ubicación: `apps/mobile/src/features/settings/screens/SettingsScreen.tsx:126`.

Secciones: Apariencia, General, Cuenta, Privacidad y Datos. Tema, tamaño de texto e idioma usan modal con radios y selección visible. Notificaciones inician apagadas, al activar explican recordatorio local 21:30 y después piden permiso. Si el sistema lo bloquea, ofrecen abrir ajustes del sistema. Inicio nunca abre prompt solo.

Estado de cuenta usa uno de cinco textos, ver `SettingsScreen.tsx:184`:

- `En la nube`
- `Pendiente de sincronizar`
- `Datos locales`
- `Sin conexión`
- `Error de sincronización`

Espejos a Calendar con switches `mirrorGoalsEnabled` y `mirrorHabitsEnabled`. Exportación incluye metas, hábitos, historial semanal y accountability local. Eliminar borra todo lo local y lo cloud según reglas.

### 4.11 Conexiones y conectores

Hoy existe un solo conector real: Google Calendar en lectura + espejo de metas y hábitos.

- Hook en `apps/mobile/src/features/calendar/hooks/useGoogleCalendar.ts`, sync y caché en `apps/mobile/src/features/calendar/services/googleSync.ts`, auth PKCE en `apps/mobile/src/features/calendar/services/calendarAuth.ts`.
- UI en `apps/mobile/src/features/settings/screens/ConnectionsScreen.tsx:19` con estados `connecting`, `syncing` en texto sin bloquear, `reauthRequired`, cola de espejo pendiente vía `getMirrorQueueLength`.
- Contrato extensible en `apps/mobile/src/features/connections/types.ts:16`: `ConnectionProvider` con `capabilities { read, write, backgroundSync }`, `connect`, `disconnect`, `sync`. Este contrato es lo que permite sumar futuros adaptadores sin bifurcar producto.

Identidad Google separada de permiso Calendar. OAuth Authorization Code + PKCE. Refresh token sólo en backend. Caché local sólo con eventos normalizados. Desconectar revoca acceso y borra caché.

Futuros conectores sin humo para versión final + 1:

- Outlook y Apple Calendar como lectura, mismo contrato, sólo si hay demanda real. Hoy están fuera de alcance v1, ver `PRD.md:243`.
- Escritura hacia calendarios externos queda fuera de v1 por riesgo de duplicados y permisos. Primero estabilizar espejo Sui hacia Google.
- WhatsApp, Instagram DM o Messenger para atención 24/7 son entregable de hackathon Sprint 3, no parte de la app. El chat in-app no se reutiliza como bot externo sin diseño propio.

Porqué: conector que no aporta contexto estorba. Por eso conexión es contextual o desde Ajustes, nunca durante onboarding ni fija en header.

### 4.12 Notificaciones y preferencias

- Recordatorio nocturno local 21:30, apagado por defecto, en `apps/mobile/src/features/settings/services/notifications.ts`.
- Pomodoro notifica sólo si el usuario lo activa explícitamente, ver `PomodoroScreen.tsx:122`.
- Accountability y engagement detrás de flags en `apps/mobile/src/shared/config/product.ts:12`: `EXPO_PUBLIC_ACCOUNTABILITY_ENABLED`, `EXPO_PUBLIC_ENGAGEMENT_ENABLED`. Reconciliación al hidratar, entrar a Home, volver a foreground, crear o editar meta, cambiar idioma, zona u horario. Nunca pide permiso sola, nunca bloquea render.

## 5. Local vs cloud: no es lo mismo ni mejor

Acá es donde más choques de mala UX aparecen. Hay que dejarlo explícito en UI y en este doc.

### 5.1 Qué vive dónde

| Dato | Local | Cloud | Porqué |
|---|---|---|---|
| Metas, hábitos, progreso, racha, XP | AsyncStorage v9 inmediato | Firestore `users/{uid}/goals`, `habits`, `snapshots` si cuenta verificada y sync activo | Local para abrir en 1.5 s, cloud para respaldo y mult dispositivo |
| Outbox y metadata | `mutationId`, versión servidor, timestamps, fingerprint, tombstone | Function valida CAS, primer commit válido gana | Evita pérdida silenciosa en auth, sync o fusión |
| Chat | AsyncStorage TTL 48 h | Nunca se sincroniza | Privacidad conversacional |
| Pomodoro | `@sui/pomodoro-v1` local | No se sincroniza en v1 | Sesiones son del dispositivo, no del respaldo |
| Accountability MVP | `sui-accountability-v1` local | No se sincroniza en MVP | Validar uso antes de tocar contratos cloud |
| Onboarding | `sui-onboarding-v3` local | No se sincroniza | Intención y consentimiento son de este aparato |
| Google Calendar | Caché normalizada local | Tokens sólo en backend | Cliente nunca guarda refresh token |
| Ajustes tema, texto, idioma | Local | No se sincroniza | Preferencia de este aparato |

Colecciones cloud según `PRD.md:199`:

```text
users/{uid}
users/{uid}/goals/{goalId}
users/{uid}/habits/{habitId}
users/{uid}/snapshots/{date}
users/{uid}/connections/{provider}  # backend-only
```

### 5.2 Reglas para evitar errores de diseño

1. Nunca ocultar datos locales por sync. Skeleton sólo en primera lectura real, después datos a la vista y estado en texto.
2. Cambio pendiente local nunca se sobrescribe en silencio. Si el servidor trae estado autoritativo, se aplica con rebase del outbox, ver `persistence/cloudMerge.ts`.
3. Invitado técnico puede usar chat y APIs autorizadas, no puede escribir productividad en Firestore. Las reglas lo niegan y hay pruebas en Emulator Suite.
4. Tombstones 90 días, compactación incrementa `syncEpoch` y fuerza bootstrap. Cliente nunca escribe productividad directo en Firestore, sólo vía Function batch.
5. Logout separa espacios: lo autenticado se limpia de caché, lo invitado arranca limpio con `resetIntroAndSeeds`. No mezclar sin pasar por `MergeData`.
6. Etiqueta de estado siempre visible en Ajustes, Cuenta. Si dice `Datos locales`, el usuario entiende que al borrar la app pierde todo. Si dice `En la nube`, entiende que puede cambiar de teléfono.

Copy sugerido para Ajustes, sin tecnicismos:

- Datos locales: “Todo está en este teléfono. Si lo borrás o lo perdés, se pierde. Creá cuenta para respaldar.”
- Pendiente: “Tenés cambios por subir. Conectate y abrí la app para respaldar.”
- En la nube: “Respaldado. Podés entrar desde otro teléfono con tu cuenta.”
- Sin conexión: “Estás offline. Podés seguir trabajando, se sube después.”
- Error: “No se pudo respaldar. Revisá conexión e intentá de nuevo, nada se borró.”

## 6. Diseño: qué mejorar en 5 días sin inventar

Dirección vigente en `DESIGN_SYSTEM.md:7`: calma enfocada, crecimiento con hojas y ritmos, acompañamiento sin culpa, naranja sólo para acción prioritaria, racha o celebración.

Tokens vigentes:

- Color: Azul Sui `#218ECE`, Marino `#0B132B`, Blanco `#FFFFFF`, Azul acción `#1677A6`, Salvia `#55796F`, Naranja `#E87536`. Claro fondo `#F6FAFC`, oscuro `#0B132B`. Usar tokens semánticos, hex directo sólo en tema.
- Tipo: Poppins 400/500/600/700 para interfaz, Fredoka One sólo bienvenida, hitos, niveles y celebración. Sin tamaños literales, todo desde `theme.type.*`, escala 0.88 / 1 / 1.15.
- Forma: campo radio medio, tarjeta radio grande, pill radio completo, bordes sutiles antes que sombras, máximo una protagonista por pantalla.
- Marca: `SuiMark` única implementación, isologo en acceso y splash, isotipo en acción central. `SuiDoodle` con `sprout`, `path`, `rhythm`, `calendar` para estados, nunca como control.
- Movimiento: 150 a 300 ms, celebración breve tras confirmar, haptics sólo en cambio significativo, respetar reducción de movimiento.

Mejoras concretas de versión final:

- Inicio: subir PomodoroCard después de próxima acción, no al fondo. Un toque abre `Pomodoro`, estado vivo sin motor montado recalculando desde `targetEndTime`.
- Metas y Hábitos: Virtualizar con `FlatList`, memoizar filas, mantener edición contextual sin convertir crear en cuestionario largo.
- Agenda: mantener 2 semanas por defecto, mes bajo demanda, fundido corto sólo ante acción real.
- Carga en 5 familias: arranque `SuiLoader` pantalla completa, primera lectura `Skeleton` con forma real, fondo sin indicador bloqueante, acción en curso indicador 20 dp en el control tocado, chat indicador dentro del hilo. Un indicador por pantalla.
- Accesibilidad: contraste AA 4.5:1, táctil 44 dp, roles y estados, decoración fuera del árbol, matriz 320/375/430, tablet, web, claro y oscuro, ES/EN, texto Grande sin truncar acciones.

## 7. Ideas evaluadas: qué es viable a producción en 5 días

Criterio para marcar viable: no rompe productividad v9 ni outbox, no pide backend nuevo ni OAuth nuevo, respeta tokens y las 5 familias de carga, funciona offline, trae ES/EN y accesibilidad, y se prueba con `npm run check` más prueba en aparato real. Todo lo demás queda como futuro, no se programa ahorita.

### 7.1 Viables: dejar en doc y programar

**V1. Pomodoro visible y digno**
Idea: subir `PomodoroCard` en Inicio justo después de próxima acción, no al fondo. Añadir atajo “Enfocar 25 min” desde Meta y Hábito que sólo navega a `Pomodoro`, sin acoplar stores. Pulir copy `lockedDuringSession` en ES/EN y aclarar en UI que sesiones son locales y no viajan entre aparatos.
Porqué: Pomodoro ya existe en `PomodoroScreen.tsx:32` y `usePomodoroStore.ts:69`, pero escondido no ayuda a ejecutar. Es el wow más barato: convierte organización en enfoque.
Toca: `OverviewScreen.tsx`, `PomodoroCard.tsx`, `AppNavigator.tsx:84`, i18n `pomodoro`.
Riesgo bajo, sólo navegación y orden visual.

**V2. Inicio con una sola protagonista**
Idea: jerarquía fija: fecha breve, próxima acción, Pomodoro, progreso del día, agenda de hoy. Una sola tarjeta protagonista, resto en superficie baja. Progreso y agenda se ocultan si no hay datos, como ya manda el PRD.
Porqué: evita muro de cards que compiten y el choque de mostrar gráficas en cero. Se siente 700% más limpia sin meter funciones nuevas.
Toca: `OverviewScreen.tsx:44`, tokens `SPACING`, `SCREEN_MAX_CONTENT_WIDTH`.
Riesgo bajo.

**V3. Aclarar local vs cloud sin tecnicismos**
Idea: en Ajustes, Cuenta, mostrar siempre una de las 5 etiquetas más una línea de consecuencia: qué pasa si borro la app, si cambio de teléfono o si estoy offline. Añadir aviso en `MergeData` con las 3 opciones y lo que cada una conserva. Ver sección 5.2 de este doc para copy.
Porqué: acá nace casi toda la mala UX. La gente cree que local es peor o que cloud es automático. Si se explica, no hay excusa para no probar y no hay reclamo por pérdida.
Toca: `SettingsScreen.tsx:184`, `MergeDataScreen.tsx:19`, i18n `settings`, `merge`.
Riesgo bajo, sólo copy y estados que ya existen.

**V4. Metas y Hábitos con completar en un toque**
Idea: mantener completar como acción primaria grande de 44 dp con haptic, edición en tap de contenido, menú secundario para proteger racha, reabrir y eliminar con confirmación. Añadir vínculo visible Hábito → Meta sin mezclar modelos.
Porqué: si completar cuesta lo mismo que editar, la constancia se cae. Es regla de producto, no decoración.
Toca: `GoalsScreen`, `HabitsScreen`, slices `goalSlice`, `habitSlice`.
Riesgo bajo.

**V5. Agenda legible en 320 dp**
Idea: mantener 2 semanas por defecto, mes bajo demanda, indicadores discretos, volver a hoy siempre visible, CTA conectar sólo si aporta contexto. Fundido corto sólo ante acción real, nada al montar.
Porqué: agenda es lectura rápida, no calendario contable. Así va liviana en teléfono chico y web.
Toca: `CalendarScreen.tsx:29`, `googleSync.ts`, `useMirrorEffects`.
Riesgo bajo.

**V6. Conexión Google que no miente**
Idea: en `ConnectionsScreen.tsx:19` dejar estado en texto: conectado, sincronizando, pendiente de espejo con conteo de `getMirrorQueueLength`, última sincronización con fecha, `reauthRequired` con botón reconectar. Botón reintentar espejo manual. Nada de spinner global.
Porqué: conector que esconde su estado se lee como bug. Mostrar cola y fecha da confianza sin prometer escritura externa.
Toca: `ConnectionsScreen`, `useGoogleCalendar`, `mirrorService`.
Riesgo medio bajo, sólo UI sobre APIs que ya existen.

**V7. Chat que acompaña sin estorbar**
Idea: mantener sugerencias que rellenan sin enviar, streaming con indicador dentro del hilo, TTL 48 h visible en vaciado, crisis primero. No guardar ni sincronizar historial.
Porqué: chat breve y local sostiene el principio de calma. Si se vuelve largo oengenérico, compite con Metas.
Toca: `ChatScreen.tsx:44`, `chatPrompt`, `crisisDetection`.
Riesgo bajo si no se toca el proxy.

**V8. Carga y vacíos coherentes**
Idea: aplicar las 5 familias al pie de la letra: arranque `SuiLoader`, primera lectura `Skeleton` con forma real, fondo sin bloqueo, acción en curso punto de 20 dp en el botón tocado, chat en el hilo. Vacíos con `SuiDoodle` que enseñan, nunca datos falsos.
Porqué: esto es lo que hace ver la app cara sin animaciones pesadas.
Toca: `SuiLoader`, `Skeleton`, `ScreenIntro`, cada pantalla con datos remotos.
Riesgo bajo.

**V9. Accesibilidad y ES/EN de cierre**
Idea: pasar matriz 320/375/430, tablet, web, claro y oscuro, texto Grande, lector de pantalla. Roles, etiquetas, contraste AA, decoración fuera del árbol. Verificar que cada clave nueva tenga ES y EN juntas.
Porqué: sin esto no hay producción ni Sprint 2 completo. Es entregable de accesibilidad de 3 páginas con evidencias reales.
Toca: i18n `shared/i18n/messages`, `theme.ts`, `typography.ts`.
Riesgo bajo, pero exige tiempo de prueba manual.

**V10. Exportar, salir y borrar sin residuos**
Idea: probar y pulir exportar con metas, hábitos, historial y accountability local, logout que separa espacios con `resetIntroAndSeeds` y borrado que purga caché Google, notificaciones y `clearLocalProductivity`.
Porqué: confianza explícita. Si esto falla, el usuario no vuelve.
Toca: `SettingsScreen.tsx:212`, `accountDeletion`, `clearAccountability`, `clearEngagement`.
Riesgo medio, exige prueba en aparato real.

### 7.2 No viables ahorita: quedan como futuro, no se programan

- Nuevo conector Outlook o Apple Calendar. Pide OAuth, redirects, secret backend y pruebas de renovar, revocar y caché. Mismo contrato `ConnectionProvider` lo permite, pero no cabe en 5 días sin meter riesgo a producción.
- Escritura hacia Google u otros calendarios. Riesgo de duplicados y permisos, fuera de alcance v1 según `PRD.md:243`.
- Sincronizar Pomodoro, chat o accountability. Pomodoro es `@sui/pomodoro-v1` local, chat es TTL 48 h local, accountability es `sui-accountability-v1` local-only por decisión. Cambiarlo pide migración, CAS y pruebas de dos aparatos.
- RBAC con panel de roles. Choca con cuenta única y `docs/decisions/0004-local-account-and-auth.md`. Es el entregable más caro del Sprint 3.
- IA que crea metas o hábitos sola, red social, equipos, rachas competitivas, diagnóstico o intervención automática. Fuera de alcance y contra principio de calma.
- Widgets, acciones nativas complejas de notificación o bloqueo de conflictos por calendario. Fase 6 de accountability, sólo tras validar retención.
- Landing, campaña 3 meses y mockups físicos. Son diseño y marketing, no código de la app. Se hacen en paralelo sin tocar `src`.

### 7.3 Orden para programar después de este doc

```text
1. V3 local vs cloud + V2 Inicio -> quita choques y da wow inmediato
2. V1 Pomodoro visible -> regresa función que ya existe
3. V4 completar en un toque + V5 agenda -> hábito diario fluido
4. V6 conexión honesta + V10 exportar/salir/borrar -> confianza
5. V7 chat + V8 carga/vacíos + V9 a11y/ES-EN -> cierre para producción
```

No empezar por conectores nuevos ni por sync. El riesgo está en modelo temporal, idempotencia y copy, no en pantallas.

## 8. Criterios para dar por cerrada la versión final

- `npm run check`, `npm run export:web`, `expo-doctor` sin fallos.
- Auth y fusión probados en aparato real con las tres opciones de `MergeData`.
- Sync probado entre dos aparatos, offline, reconexión y tombstones.
- Calendar probado: conectar, renovar, revocar, desconectar, caché offline.
- Legal ES/EN publicado, crisis por país verificada.
- App Check en monitor antes de enforcement.
- Builds EAS staging Android e iOS aprobados.
- Rollout gradual por mercado aprobado sólo donde hay Términos, Privacidad y crisis verificados.

## 9. Fuentes de implementación

```text
apps/mobile/src/application/navigation/AppNavigator.tsx
apps/mobile/src/application/navigation/TabNavigator.tsx
apps/mobile/src/features/onboarding/screens/WelcomeScreen.tsx
apps/mobile/src/features/home/screens/OverviewScreen.tsx
apps/mobile/src/features/pomodoro/screens/PomodoroScreen.tsx
apps/mobile/src/features/pomodoro/components/PomodoroCard.tsx
apps/mobile/src/features/pomodoro/store/usePomodoroStore.ts
apps/mobile/src/features/calendar/screens/CalendarScreen.tsx
apps/mobile/src/features/settings/screens/SettingsScreen.tsx
apps/mobile/src/features/settings/screens/ConnectionsScreen.tsx
apps/mobile/src/features/auth/screens/MergeDataScreen.tsx
apps/mobile/src/shared/account/useIntroStore.ts
apps/mobile/src/shared/domain/productivity/store/useProductivityStore.ts
apps/mobile/src/shared/domain/productivity/persistence/productivityRepository.ts
apps/mobile/src/shared/config/product.ts
```
