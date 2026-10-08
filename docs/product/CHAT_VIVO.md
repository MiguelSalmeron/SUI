# Chat de Sui: presencia viva y conversación que actúa

- **Estado:** idea solidificada, corte 2 con prompt listo. No es fuente canónica.
- **Creado:** 7 de octubre de 2026.
- **Canónico vigente:** [Sistema de diseño](DESIGN_SYSTEM.md) y
  [Chat](../explanation/chatbot.md). Este documento no los reemplaza.
- **Antecesor:** [CHAT_CONVERSACION.md](CHAT_CONVERSACION.md), que describe el
  corte 1 y sigue vigente. Este documento empieza donde aquél se detuvo.

El corte 2 no toca el proxy, la ventana de contexto, el TTL de 48 horas ni el
tope de 1000 caracteres.

---

## 0. Activo sin dueño: `assets/suibot`

Hay tres archivos en `apps/mobile/assets/suibot/` que **ningún archivo del repo
referencia**. Están sin trackear en git.

| Archivo                                 | Tamaño  | Qué es                                                      |
| --------------------------------------- | ------- | ----------------------------------------------------------- |
| `bloub-capsule-attentif-bleu.svg`       | 5,8 kB  | Cara de Sui en cápsula, ojo izquierdo cerrado, 4 paths      |
| `bloub-capsule-attentif-bleu-anime.svg` | 16,7 kB | La misma cara con `@keyframes` embebidos: 2 bloques, 6 usos |
| `bloub-default-cycle.gif`               | 3,5 MB  | **1640 frames** de 320×320                                  |

Esto cambia el planteo de §1.2. La geometría de la cara no está limitada a lo
que dice `SuiAvatar`: hay un diseño nuevo, con **boca**, en un `viewBox` de
`-125 -125 250 250` y con los ojos como arcos
(`M-10.5 -11.5A10.5 10.5 0 0 1 0 -22L0 -22A10.5 10.5 0 0 1 10.5 -11.5L10.5 11.5A10.5 10.5 0 0 1 0 22`).

Tres consecuencias, y hay que decidir antes de implementar el corte 2:

1. **¿Es la cara nueva o es un experimento abandonado?** Si es la nueva, `SuiAvatar`
   queda con el diseño viejo y hay que reemplazar un componente que el tab bar
   y el chat ya usan. Si es un experimento, se borra y el corte 2 sigue con la
   geometría actual, como está escrito en §3.
2. **El GIF no es utilizable.** 1640 frames en un bucle son 27 s a 60 fps: es un
   `autoplay decorativo largo`, justo lo que §15 prohíbe, y 3,5 MB en el bundle.
   Como mucho sirve como referencia de movimiento, no como asset.
3. **El SVG animado tiene 2 `@keyframes` embebidos.** `react-native-svg` no los
   ejecuta en nativo. Habría que traducirlos a `Animated`, que es exactamente el
   trabajo del corte 2 — pero sólo tiene sentido si se adopta esta cara.

Mientras no se decida, el corte 2 se implementa sobre `SuiAvatar`. Si la cara
nueva entra antes, el corte 2 se ajusta, pero el **protocolo de estado de §3 no
cambia**: es independiente de la geometría de la cara.

---

## 1. Diagnóstico

Verificado contra el código el 7 de octubre de 2026.

### 1.1 La mascota existe y está encerrada

`shared/ui/SuiAnimatedMark.tsx` tiene respiración, halo, parpadeo, mirada
autónoma y guiño por señal. Consulta `useReduceMotion`, pausa con `AppState` y
marca sus loops con `isInteraction: false`. Es trabajo serio.

Vive en un solo lugar: el botón central del tab bar
(`application/navigation/TabNavigator.tsx:264`). Cuando el usuario entra al chat
—la pantalla donde más importa tener a Sui con él— la mascota desaparece y
queda un `SuiAvatar` de 32 dp estático dentro de la burbuja
(`features/chat/components/ChatMessage.tsx:101`).

La mascota está en el lobby pero no en la sala. Eso es lo contrario de lo que
se busca. Falta presencia, no movimiento.

### 1.2 La cara no tiene boca

`SuiAvatar` (`shared/ui/SuiMark.tsx:63-105`) dibuja un blob y dos ojos de tipo
cápsula vertical, en `viewBox="0 0 208 124"`, con los grupos de ojo en
`translate(86 53) rotate(-4)` y `translate(140 50) rotate(-4)`.

**No hay boca.** El único gesto de cara existente es `wink`, que sustituye el
ojo derecho por una línea horizontal `M-11 0 H11` de `strokeWidth 7`.

Consecuencia directa: toda la vocabulario de poses de este documento se
construye con geometría que ya existe —posición y escala de los ojos, y
transformaciones del cuerpo— **sin agregar trazados nuevos**. Agregar una boca
sería un cambio de marca y necesita su propio ADR y aprobación de diseño. Ver
§6.

### 1.3 Sui usa las metas sin que nadie lo sepa

`features/chat/screens/ChatScreen.tsx:256-275` inyecta en cada envío tu nombre,
hasta 3 metas con su porcentaje, hasta 3 hábitos con su racha, la hora del día y
la racha. Todo invisible: no hay forma de saber qué está mirando Sui ni de
apagarlo.

En una app cuyo primer principio es «Tú decides», ese es el punto más débil
del producto. Es el corte 3.

### 1.4 Chatarra de movimiento

- Hay dos sistemas de tokens. `shared/ui/motion/motionTokens.ts` tiene easings
  ejecutables y lo usan onboarding y la mascota. `MD3_MOTION`, en
  `shared/theme/tokens.ts:24-60`, expone 9 easings como cadenas CSS que React
  Native no puede ejecutar, y **ninguno se consume**: sólo se leen
  `indeterminate.rotate`, `indeterminate.shimmer` y `duration.short4`.
- `MD3_MOTION` además se publica dentro del objeto de tema
  (`shared/theme/theme.ts:60`, `shared/theme/appTheme.ts:38,51`), así que
  borrarlo no es un cambio local: es contrato de tema.
- Hay **un solo spring** en todo el repo, inline y sin token
  (`features/home/components/CelebrationToast.tsx:37-42`).
- `CelebrationToast` es el único componente animado que **no consulta
  `useReduceMotion`**. Es un bug de accesibilidad, no una preferencia.
- El cursor de streaming es un `Text` con `▍` literal dentro del flujo de
  texto (`ChatMessage.tsx:116`): parpadea por re-render, no por driver. Y es un
  glifo de fuente en un hilo que compite con `SuiLoader`, que el sistema de
  diseño prohíbe explícitamente por eso mismo (§13).

Esos cuatro últimos puntos son hygiene y van en su propio corte. El corte 2
arranca con lo que sí necesita la mascota.

---

## 2. Tesis

**La animación de Sui no es decorativa: es reactiva al estado.** La mascota no
está _animada_, está **atenta**. Cada señal del sistema —leyendo tus metas,
pensando, leyendo, escribiendo, esperando un corte, en crisis— tiene una expresión
distinta
de la cara.

Esto resuelve el pedido de «más animaciones» sin violar §15 del sistema de
diseño, que prohíbe el loop decorativo largo. No es más movimiento: es más
movimiento **con causa y con significado**.

### Tres reglas que sostienen la tesis

1. **La respiración se detiene cuando hay trabajo real.** Una criatura que se
   activa al pensar se siente viva; una que respira siempre se siente
   decorativa. El stillness comunica atención.
2. **Ningún gesto se dispara por token.** El SSE puede mandar decenas de chunks
   por segundo. Todo gesto se limita por tiempo, no por evento.
3. **La mirada sigue al campo de texto.** Es el detalle barato con mayor
   retorno emocional: cuando escribís, Sui te mira.

### Marco de clases de movimiento

Para que «más animaciones» sea defendible línea por línea contra el PRD, todo
movimiento nuevo se clasifica:

| Clase         | Definición                                    | Regla                                                                             |
| ------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| Reactiva      | Responde a un evento o cambio de estado       | Siempre permitida. Es la que hace que Sui se sienta vivo.                         |
| Anticipatoria | Comunica que algo va a pasar, menos de 500 ms | Permitida si la causa y el final son claros.                                      |
| Ambiental     | Loop sin causa, sólo por ciclo                | Prohibida en superficies de trabajo. Sólo la mascota en reposo y en primer plano. |

`SuiAnimatedMark` es hoy la única pieza ambiental del app y por eso lleva
`AppState`, `isInteraction: false` y el gate de `useReduceMotion`. Ese patrón se
extiende, no se inventa.

---

## 3. Protocolo de estado

Un solo tipo, derivado en la pantalla, pasado hacia abajo como props. `shared/`
no puede importar `features/` (`scripts/check-architecture.mjs:198`), así que la
derivación vive en el chat y la mascota se mantiene dumb.

```ts
type PresenceState =
  | 'resting' // sin nada pendiente
  | 'listening' // estás escribiendo
  | 'thinking' // esperando el primer chunk
  | 'reading' // leyendo tus metas
  | 'speaking' // llegó texto
  | 'warm' // terminó de hablar
  | 'concern'; // error o crisis
```

### Precedencia

Se evalúa en orden y gana la primera:

1. Overlay de crisis visible → `concern`.
2. El mensaje en streaming tiene `error` → `concern`.
3. Streaming con `content.length > 0` → `speaking`.
4. `waitingPhase === 'remembering'` → `reading`.
5. `waitingPhase === 'thinking'` → `thinking`.
6. El borrador tiene texto → `listening`.
7. En otro caso → `resting`.

`warm` no sale de la precedencia: es transitorio, lo dispara la finalización
del stream y dura 600 ms como máximo antes de volver a `listening` o `resting`.
No tiene temporizador propio en el estado; es una señal, igual que `winkSignal`
hoy.

### Tabla de estados

| Estado      | Pose      | Ojos                         | Cuerpo            | Halo           | Copy al lado              |
| ----------- | --------- | ---------------------------- | ----------------- | -------------- | ------------------------- |
| `resting`   | `idle`    | neutros, parpadeo 4–7 s      | respira 1800 ms   | 0.14           | —                         |
| `listening` | `listen`  | neutros, te miran            | respira más lento | 0.18           | `chat.presence.listening` |
| `thinking`  | `think`   | arriba, entrecerrados        | **quieto**        | apagado        | `chat.thinking`           |
| `reading`   | `read`    | abajo, barrido lateral lento | **quieto**        | apagado        | `chat.remembering`        |
| `speaking`  | `speak`   | neutros                      | rebote por chunk  | 0.20           | —                         |
| `warm`      | `warm`    | dos líneas finas, cerradas   | asienta           | destello breve | —                         |
| `concern`   | `concern` | bajos, sin parpadeo          | **quieto**        | apagado        | tinte `colors.error`      |

La columna de copy reutiliza `chat.thinking` y `chat.remembering` que ya
existen y ya se muestran dentro de la burbuja. **No se duplica el texto**: el
dock muestra el nombre de Sui y, sólo cuando hay estado real, el rótulo. El
`accessibilityLiveRegion` sigue siendo el `Text` de la burbuja
(`ChatMessage.tsx:109`), porque es el nodo que cambia.

### Poses, con la geometría que ya existe

Ninguna pose agrega un trazado. Todas salen de la posición y de la escala de los
dos grupos
de ojo y de transformaciones del cuerpo.

| Pose      | Cómo se construye                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `idle`    | Estado actual. Sin cambios.                                                                                       |
| `wink`    | Estado actual. Línea horizontal en el ojo derecho.                                                                |
| `think`   | `translateY` negativo en la capa de ojos más `scaleY` en 0.82 en ambos.                                           |
| `read`    | `translateY` positivo pequeño y `gazeX` en barrido lento, no el jitter autónomo.                                  |
| `listen`  | Ojos neutros, `breathe` a 1200 ms en lugar de 1800, cuerpo con leve `translateY`.                                 |
| `speak`   | Rebote `scaleY` 1 → 0.94 → 1 por señal, limitado a uno cada 110 ms.                                               |
| `warm`    | Ambos ojos a `scaleY` 0.12: dos líneas finas leen como ojos cerrados. Se distingue de `wink`, que es un solo ojo. |
| `concern` | Ojos con `translateY` positivo y sin parpadeo. La quietud del cuerpo es la señal principal.                       |

`warm` y `wink` se distinguen por construcción, no por color: `wink` sustituye
un ojo por un `Path` distinto, `warm` escala los dos.

---

## 4. El dock

Reemplaza el título nativo redundante «Sui» por Sui viva.

```
┌──────────────────────────────────────┐
│ ←  (‿‿)  Sui          habla tus      │  ← dock en headerLeft/headerTitle
│           40 dp   metas               │
├──────────────────────────────────────┤
```

### Decisiones

**Vive en el header nativo, no debajo.** `ChatScreen` ya es dueño de su header:
hace `navigation.setOptions` en `useLayoutEffect` (`ChatScreen.tsx:161-175`). Ampliar ese mismo efecto con `headerTitle` no toca `AppNavigator.tsx` ni el tab bar, y conserva la flecha de retorno nativa porque `headerLeft` queda sin tocar. Además evita duplicar el nombre, que hoy aparece dos veces si sólo se agrega una fila debajo.

**Avatar de 36 dp, no 58.** El header nativo mide 56 dp en iOS y 64 en Android. 58 no entra. 36 es legible y deja sitio para el rótulo.

**Rótulo sólo con estado real.** Sin `resting` ni `listening` el dock muestra sólo el nombre. El rótulo aparece para `thinking`, `reading`, `speaking` y `concern`.

**Las burbujas no se animan.** Siguen con `SuiAvatar` de 20 dp estático. Animar cada burbuja del hilo compite consigo misma y rompe la jerarquía: el dock es Sui, las burbujas son su voz.

### Riesgo conocido

Un header nativo con contenido propio tiene que verificar que a 320 dp de ancho
el nombre y el rótulo no se pisen. Si se pisan, el nombre cede: primero se
acorta el rótulo, luego se oculta. `SCREEN_MAX_CONTENT_WIDTH` no aplica acá
porque el header es de pantalla completa.

---

## 5. Movimiento: lo mínimo que el corte 2 necesita

El corte 2 no unifica los tokens —eso es su propio corte— pero sí necesita dos
primitivas que hoy no existen.

**Springs declarativos.** Hoy hay un spring inline en el repo. La presencia en
una interfaz es timing, no `timing()` lineal: el asentamiento de `warm` y el
rebote de `speak` son springs. Se agregan a `MOTION`:

```ts
springs: {
  settle: { speed: 12, bounciness: 6 }, //Asentamiento de `warm`
  bounce: { speed: 40, bounciness: 14 }, // Rebote de `speak`
}
```

`CelebrationToast` migra a `MOTION.springs.settle` en el mismo corte, porque su
`speed: 18, bounciness: 8` hardcodeado es exactamente el mismo gesto.

**Cursor de streaming real.** Sale del flujo de texto y pasa a ser su propio
componente con opacidad pulsante en native driver, `testID` propio y estático
con `useReduceMotion`. Es lo que permite que el cursor y la pose `speak`
signifiquen lo mismo.

**Fix de accesibilidad.** `CelebrationToast` consulta `useReduceMotion` y cae a
un `timing` de opacidad sin transform cuando la preferencia está activa. Es un
bug y va en este corte, no en el de hygiene: es la primera aplicación de la
regla que el corte 2 establece.

---

## 6. Fuera de alcance

| No entra                                        | Por qué                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una boca en `SuiAvatar`                         | Cambio de marca. Necesita ADR y aprobación de diseño (§1.2).                                                                                                                          |
| Migrar a Reanimated                             | Decisión del 7 de octubre: no ahora. Es un proyecto aparte con dependencia nueva y plugin de Babel; bloquearía todo lo demás. La limitación con Fabric existe pero el repo la tolera. |
| Mover a Sui por la pantalla (locomoción)        | Techo alto, riesgo alto de distraer. Requiere posiciones absolutas y transiciones de layout.                                                                                          |
| Avatar animado en cada burbuja                  | Compite consigo mismo en un hilo de 40 mensajes.                                                                                                                                      |
| Postura de reposo ambiental en el dock          | §15 prohíbe loop decorativo largo. `resting` ya tiene respiración de 1800 ms, que es ambiental y autorizada por ser la mascota. No se agrega una segunda.                             |
| Botón `[+]`, pulgar arriba/abajo, ver el prompt | Sin acción real. Coherente con [CHAT_CONVERSACION.md](CHAT_CONVERSACION.md) §5.                                                                                                       |
| Tono de personalidad                            | El `coach` actual incumple la voz del producto (§11).                                                                                                                                 |

---

## 7. Los cortes

| Corte | Nombre                       | Contenido                                                                                                                                                                                                 | Estado              |
| ----- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 2     | **Sui en el hilo**           | Dock reactivo, protocolo de 7 estados, 6 poses nuevas, cursor de streaming real, `MOTION.springs`, fix de `CelebrationToast`, i18n, tests.                                                                | Prompt listo en §10 |
| 3     | **Contexto y acciones**      | Toggle «estoy usando tus metas», chips post-respuesta, convertir a meta o hábito, separadores por día, sugerencias por hora.                                                                              | Especificado        |
| 4     | **Fundamento de movimiento** | Unificar `MD3_MOTION` y `MOTION`, `AppState` en `SuiLoader` y `Skeleton`, auto-scroll inteligente, tuning del `FlatList` del chat, tokens en los tres `100 ms` hardcodeados y los `280 ms` de navegación. | Especificado        |
| 5     | **Sui con voz propia**       | Tono Calma/Directo reescribiendo el prompt en inglés y tirando `coach`. Dictado.                                                                                                                          | Fuera               |

Los cortes 3 y 4 son independientes entre sí y se pueden reordenar. El corte 2
no depende de ninguno.

### Corrección factual a CHAT_CONVERSACION.md

Su §5 dice que convertir una respuesta a meta o hábito «Cruza features y toca
el store de productividad». **Eso no es correcto**, y es la razón por la que el
rasgo más valioso quedó aparcado.

`useProductivityStore` ya se importa en `ChatScreen.tsx:39` desde
`@/shared/domain/productivity/public`, y ese store expone `addGoal`
(`shared/domain/productivity/store/productivityState.ts:47`) y `addHabit`
(`:70`), ambos devolviendo el ID creado o `null`.

Como `@/shared/domain/productivity/public` está en `shared/` y no en
`features/`, llamarlo **no agrega ninguna arista al grafo de features**, y
`npm run architecture` no lo ve como import cruzado. Además hoy ya existe una
arista `features/home → features/chat`
(`features/home/components/NightlyReportModal.tsx:12`), así que **`chat → home`
sí sería un ciclo** y queda prohibido. Para crear desde el chat no hace falta
`goals` ni `habits`: el dominio compartido ya expone la escritura.

Consecuencia de diseño: `addGoal` exige `deadline`, así que el chip no puede
inventar una fecha. Propone un horizonte relativo con los atajos que ya usa la
pantalla de Meta (1, 2 o 4 semanas), lo dice en el texto del chip y deja
corregir después de crearla. `addHabit` sólo exige `title`, así que ese chip es
directo.

---

## 8. Criterios de aceptación del corte 2

1. En el chat, Sui es visible en el header y su cara cambia con el estado:
   reposo, escribiendo, pensando, leyendo, hablando y error son distinguibles.
2. El dock no pisa la flecha de retorno ni el botón de limpiar, ni a 320 dp.
3. Con reducir movimiento, el dock queda en estado estático, el cursor no
   pulsa y `CelebrationToast` no rebota.
4. Salir del chat y volver no deja la mascota en `speaking`: el estado se
   deriva del store, no de un temporizador.
5. `concern` aparece tanto por error de conexión como por crisis, y en crisis
   no hay loops corriendo.
6. Ninguna animación de `speak` se dispara más de una vez cada 110 ms.
7. La pantalla no compite con el scroll: mandar mensajes mientras Sui responde
   no lo jala hacia abajo.
8. Claro y oscuro.
9. `npm run check` en verde.

---

## 9. Archivos del corte 2

```text
apps/mobile/src/shared/ui/SuiMark.tsx              # + poses nuevas en SuiAvatar
apps/mobile/src/shared/ui/SuiAnimatedMark.tsx      # + pose controlada y speakSignal
apps/mobile/src/shared/ui/motion/motionTokens.ts   # + springs
apps/mobile/src/features/chat/hooks/useSuiPresence.ts        # nuevo
apps/mobile/src/features/chat/components/SuiDock.tsx          # nuevo
apps/mobile/src/features/chat/components/StreamingCursor.tsx # nuevo
apps/mobile/src/features/chat/components/ChatMessage.tsx     # cursor fuera del texto
apps/mobile/src/features/chat/screens/ChatScreen.tsx         # dock + presencia
apps/mobile/src/shared/i18n/messages/chat.ts      # + chat.presence.*
apps/mobile/src/features/home/components/CelebrationToast.tsx # fix reduce-motion
```

Tests nuevos: `useSuiPresence.test.ts`, `SuiAnimatedMark.test.tsx` (extender),
`SuiDock.test.tsx`.

`AppNavigator.tsx`, `TabNavigator.tsx`, el tema, el proxy, `chatStream.ts` y
`crisisDetection.ts` **no se tocan**.

---

## 10. Prompt para Codex (corte 2)

```text
Repo Sui (apps/mobile). Leé AGENTS.md, docs/product/CHAT_VIVO.md y
docs/product/CHAT_CONVERSACION.md. Implementá SÓLO el corte 2 de CHAT_VIVO.md:
"Sui en el hilo". Comentarios en español con voseo nica. Los textos nuevos de la
app van en i18n con el mismo tuteo que ya usa messages/chat.ts.

No toques AppNavigator.tsx, TabNavigator.tsx, el tema, el proxy, chatStream.ts,
crisisDetection.ts, CONTEXT_WINDOW, MAX_INPUT_CHARS ni el TTL. Sin dependencia
nueva. Sin commit.

Guardas del repo que tenés que respetar (miran `npm run architecture`):
- shared/ NO puede importar features/ ni application/. Por eso useSuiPresence
  vive en features/chat/hooks/ y le pasa props de estado a SuiAnimatedMark,
  que sigue sin saber nada del chat.
- Nada de fontSize / lineHeight / fontWeight / fontFamily literales en .tsx:
  usá theme.type.* y los estilos existentes como createStyles.
- Nada de tocar `shared/domain/productivity` en este corte.

1) Poses en SuiAvatar (shared/ui/SuiMark.tsx):
- Ampliá el tipo `pose` de 'idle' | 'wink' a 'idle' | 'wink' | 'think' | 'read'
  | 'listen' | 'speak' | 'warm' | 'concern'.
- IMPORTANTÍSIMO: la cara NO tiene boca y no debés agregar trazados. Construí
  cada pose con las capas de ojo que ya existen. La geometría actual es
  viewBox "0 0 208 124", ojos en translate(86 53) rotate(-4) y
  translate(140 50) rotate(-4), cápsula
  "M-10.5 -11.5 C-10.5 -25.5 10.5 -25.5 10.5 -11.5 V11.5 C10.5 25.5 -10.5 25.5 -10.5 11.5 Z".
  Las poses se construyen con transformaciones sobre esas capas, no con
  Paths nuevos:
  - think: capa de ojos con translateY negativo y scaleY 0.82.
  - read: capa de ojos con translateY positivo leve.
  - listen, speak, concern: ojos neutros; el cuerpo y el halo hacen el resto.
  - warm: ambos ojos a scaleY 0.12 (dos líneas finas = ojos cerrados).
    DISTINGUÍLO de wink, que sustituye un ojo por un Path distinto.
- El prop `layer` sigue igual: 'all' | 'body' | 'eyes'. Seguí partiendo el cuerpo
  y los ojos en capas separadas como hoy, porque SuiAnimatedMark anima la
  mirada y el parpadeo sobre capas distintas.
- accessible={false} y nada de animación acá: esto es geometría pura.

2) SuiAnimatedMark (shared/ui/SuiAnimatedMark.tsx):
- Sumá props `pose?: PresencePose` y `speakSignal?: number`, con los mismos
  defaults que hoy para no romper el tab bar: pose 'idle', speakSignal 0.
- Compose la pose con los valores que ya existen usando Animated.add /
  Animated.multiply, como ya hacés con el halo en la opacidad. No dupliques
  valores nuevos si un transform del cuerpo alcanza.
- El parpadeo y la mirada autónoma (el useEffect con jitter y los 6 targets)
  sólo corren con pose 'idle', 'listen' o 'speak'. Hoy ya se apagan con 'wink';
  generalizá esa condición en vez de sumar otro caso.
- En 'concern' apagá breathe y pulse: la quietud del cuerpo es la señal, y por
  eso el halo tiene que quedar en su valor bajo.
- speakSignal: cada cambio dispara UN rebote scaleY 1 → 0.94 → 1 con
  MOTION.springs.bounce, unos 180 ms. Detené la animación anterior antes de
  arrancar la nueva (`.stop()`) para que dos señales seguidas no encadenen.
  El limitador de 110 ms NO va acá: va en el hook, que es donde se sabe si hay
  texto nuevo de verdad.
- Con reduceMotion o app en background seguí cayendo al SuiAvatar estático.
- Nada de loops nuevos: las únicas animaciones ambientales son breathe, blink y
  gaze, y ya respectan AppState e isInteraction: false.

3) MOTION.springs (shared/ui/motion/motionTokens.ts):
- Sumá `springs: { settle: { speed: 12, bounciness: 6 }, bounce: { speed: 40,
  bounciness: 14 } }`. No toques durations, easings ni distances: en este corte
  no unificamos los tokens, eso es el corte 4.
- Migrá CelebrationToast (features/home/components/CelebrationToast.tsx) a
  MOTION.springs.settle y hacé que consulte useReduceMotion: con la preferencia
  activa, opacidad con timing y sin transform. Es el único componente animado
  del repo que no lo consultaba. Commentá por qué.

4) useSuiPresence (features/chat/hooks/useSuiPresence.ts, nuevo):
- Tipo PresenceState = 'resting' | 'listening' | 'thinking' | 'reading' |
  'speaking' | 'warm' | 'concern', más `type PresencePose` reexportando la unión
  de poses de SuiAvatar para no duplicar la lista.
- Precedencia exacta, en orden, gana la primera:
  1. overlayVisible → 'concern'
  2. el mensaje en streaming tiene error → 'concern'
  3. streaming con content.length > 0 → 'speaking'
  4. waitingPhase === 'remembering' → 'reading'
  5. waitingPhase === 'thinking' → 'thinking'
  6. draft.trim().length > 0 → 'listening'
  7. en otro caso → 'resting'
- Devolvé `{ presence, speakSignal, label }`. `label` es la clave i18n o null:
  null para resting, listening y speaking; 'chat.thinking' para thinking;
  'chat.remembering' para reading; y una clave nueva para concern.
- speakSignal: contador monotónico que sube como máximo una vez cada 110 ms,
  Y sólo mientras la presencia sea 'speaking'. Guardá el timestamp en un ref,
  no en estado. Si la última señal fue hace menos de 110 ms, no cuentes.
- El estado se deriva de props del store y del estado de pantalla. NADA de
  setTimeout para el estado: el temporizador es sólo el limitador.
- Después de que el stream termina o se corta, emití una sola señal de
  'warm' y volvé a 'listening' o 'resting' según el borrador. Si eso exige un
  temporizador de 600 ms, que sea explícito y nombrado, y que se limpie en el
  cleanup.

5) SuiDock (features/chat/components/SuiDock.tsx, nuevo):
- Header del chat, avatar de 36 dp (el header nativo mide 56 en iOS y 64 en
  Android: 58 NO entra) + nombre + rótulo de estado opcional.
- Se monta desde el `navigation.setOptions` que YA existe en ChatScreen, con
  `headerTitle`. NO toques headerLeft: la flecha de retorno la da el Stack.
- En `resting` y `listening` el rótulo es null y sólo va el nombre.
- A 320 dp el nombre y el rótulo no pueden pisarse: primero acortá el rótulo con
  numberOfLines={1} y ellipsis, y si hace falta ocultá el rótulo. Ningún
  hardcode de ancho.
- Accesibilidad: el rótulo va en su propio Text con
  accessibilityLiveRegion="polite" cuando hay cambio real, y la fila completa
  fuera del árbol si es puramente decorativa. Nunca el View contenedor.
- createStyles con theme.type.* y SPACING. Sin colores literales.

6) StreamingCursor (features/chat/components/StreamingCursor.tsx, nuevo):
- Cursor de 2 dp de ancho, alto de una línea, `colors.secondary`.
- Opacidad pulsante con Animated.loop en native driver, 600 ms por lado.
- Sale del flujo de texto: en ChatMessage.tsx:116 reemplazá el <Text>▍</Text>
  inline por este componente, después del Text del contenido. Hoy ese glifo de
  fuente parpadea por re-render y además choca con §13 del sistema de diseño,
  que prohíbe indicadores basados en glifo de fuente.
- Con reduceMotion: opacidad fija, sin loop. Accesibilidad: decorativo, fuera
  del árbol.
- Reemplazá también el cursor que usa el waitingText si lo hubiera: la frase de
  espera no lleva cursor.

7) ChatScreen (features/chat/screens/ChatScreen.tsx):
- Conectá useSuiPresence y pasá presence, speakSignal y label a SuiDock vía
  headerTitle, y pose/speakSignal al avatar de la burbuja que esté en streaming
  (ChatMessage.tsx:101). Las demás burbujas siguen con SuiAvatar estático.
- Si le pasás el dock al header, el título nativo 'Sui' de AppNavigator.tsx:85
  queda redundante: pasá headerTitle sólo desde acá y no dupliques el nombre.
- Memoizá el dock para que el header no se re-renderice en cada chunk: si el
  dock no depende del texto del mensaje, que un chunk no lo despierte.

8) i18n (shared/i18n/messages/chat.ts):
- Sumá las claves de presence que falten, en es y en el mismo registro. Nada
  de strings sueltos en el JSX: hoy ChatMessage.tsx:102 tiene el nombre "Sui"
  hardcodeado, y en este corte también lo es el nombre del dock. Si lo dejás
  literal, que sea por la misma razón de marca y con comentario; preferí
  reusar la clave que ya exista.
- La crisis y el thinking/remembering NO cambian de copy.

No hagas: boca nueva en la cara, Reanimated, locomoción, migrar MD3_MOTION,
auto-scroll inteligente, chips post-respuesta, toggle de contexto, convertir a
meta, tono de personalidad, botón [+], ni tocar el proxy.

Al final: npx prettier --write sólo sobre los archivos tocados y npm run check
en verde. Sin commit. Reportá archivos tocados, decisiones que tomaste fuera de
esto y cualquier cosa que en realidad bloquee el spec.
```

---

## 11. Nota de método

Este documento sigue la forma de
[CHAT_CONVERSACION.md](CHAT_CONVERSACION.md): diagnóstico verificado contra
código, cortes explícitos y un prompt por corte. Cuando un corte se implemente,
este documento pasa a describir lo implementado y el corte siguiente se
escribe como documento aparte, con la misma estructura.

Cosas que quedaron anotadas y no se pierden:

- El contexto de crisis no se rediseña. `EmergencyOverlay` sigue igual; lo único
  que cambia es que `concern` lo refleje en la cara de Sui.
- El `botPersonality` que hoy está fixeado en `calm`
  (`features/chat/services/chatPrompt.ts:34`) no se toca. Es el corte 5.
- La `auto-scroll inteligente` del corte 4 es independiente de la mascota y se
  puede hacer cuando el hilo dé evidencia de necesitarlo.
