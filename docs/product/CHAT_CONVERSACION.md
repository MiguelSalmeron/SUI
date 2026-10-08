# Chat de Sui: de buzón a conversación

- **Estado:** idea solidificada y prompt del corte 1 listo. No es fuente canónica.
- **Creado:** 6 de octubre de 2026.
- **Canónico vigente:** [Sistema de diseño](DESIGN_SYSTEM.md) y
  [Chat](../explanation/chatbot.md). Este documento no los reemplaza.

El corte 1 se implementa con el prompt de la sección 7. El rediseño visual de
Hoy y Pomodoro sigue sin commitear: ese prompt no puede tocarlo.

---

## 1. Decisión

El chat deja de ser un formulario (escribís, esperás, leés) y pasa a ser una
conversación con tres reglas:

1. **Una intención:** conversar. La cápsula de escritura siempre está a la vista.
2. **Nunca un silencio muerto:** si hay espera real, se dice qué está pasando.
   Si la respuesta llega rápido, no se inventa una espera.
3. **La respuesta sirve:** se puede copiar, detener y reintentar. Convertirla
   en meta o hábito queda para después.

No se copia la interfaz de ChatGPT. Se toma el control (detener, reintentar,
copiar) y se deja la calma de Sui.

## 2. Qué no se toca

Verificado en `apps/mobile/src/features/chat`:

- Historial sólo en el dispositivo, clave `sui-chat-v1`, borrado a las 48 h.
- `detectCrisis` corre en el cliente antes de abrir el SSE. `EmergencyOverlay`
  no se rediseña.
- Streaming por `react-native-sse`. `cancel()` ya existe en el controlador y
  se llama al salir de la pantalla. La UI todavía no lo ofrece.
- Ventana de 10 mensajes, tope de 1000 caracteres y límite de salida del
  proxy. No se suben por verse más lindo.
- Un solo indicador de carga en el hilo, atado al mensaje
  ([sistema de diseño](DESIGN_SYSTEM.md) §12). Si la espera real dura menos de
  600 ms, se ve el texto y no una fase de "pensando".

## 3. Diagnóstico que sí es cierto

- `ChatInput` es una fila con borde superior, campo de radio 20 y botón
  circular aparte. Con `busy`, el campo queda `editable={false}`: no se puede
  seguir escribiendo.
- `ChatMessage` no tiene burbuja, hora ni acciones. Si `content` está vacío y
  hay streaming, muestra `SuiLoader`. Si ya llegan chunks, muestra el texto y
  un cursor `▍`. El fallo es el texto `chat.failed`, sin reintento.
- Los 4 chips de sugerencia sólo existen cuando `messages.length === 0`.
- `EmotionalProfile.botPersonality` existe y `buildSystemPrompt` lo usa en
  español (`calm`, `direct`, `coach`). `buildEmotionalProfile` lo fija siempre
  en `calm` y la pantalla no lo deja elegir. El prompt en inglés ignora el
  tono. El tono `coach` del prompt actual ("entusiasta y gamificado", rachas,
  XP) choca con la voz del sistema de diseño. No se ofrece hasta reescribirlo.
- No hay `expo-clipboard` ni `expo-speech`. `expo-haptics` sí está.
  `ConfirmModal` ya existe en `shared/ui`.

## 4. Corte 1, cuando se implemente

Es el único corte que cambia la percepción. Tres piezas, en este orden.

### Cápsula

Reemplaza `ChatInput`. No se agrega el botón `[+]`: hoy no hay nada que
adjuntar y un botón vacío miente.

- Cápsula con radio completo, fondo `surfaceContainerHigh`, borde de 1 dp
  `outlineVariant`. Sin sombra: el sistema de diseño pide borde antes que
  sombra, y el chat no entra en la capa "foco" del rediseño de Hoy.
- El campo sigue creciendo hasta `maxHeight` 120 y no se bloquea mientras Sui
  responde.
- Sin texto, enviar apagado. Con texto, enviar en `primary`. Mientras hay
  streaming, ese mismo botón pasa a detener y llama a `controller.cancel()`.
  El texto ya recibido se conserva.
- Contador con las claves de i18n: gris hasta 949, `flame` desde 950. No se
  usa rojo de error para un límite de longitud.
- El borrador sobrevive a salir de la pantalla. Clave aparte,
  `sui-chat-draft-v1`, no dentro de `sui-chat-v1`. Si hay crisis, el borrador
  no se borra: el overlay se muestra y el texto sigue ahí.
- `keyboardShouldPersistTaps="handled"` se mantiene. Sin autoenfoque al abrir.

### Espera honesta

Estado de pantalla, no persistido. No es una fase del backend.

- Menos de 600 ms hasta el primer chunk: no hay texto de espera. Aparece el
  streaming.
- Si pasa de 600 ms y todavía no hay chunk: "Pensando…".
- Si pasa de 1,2 s y hay metas activas: "Tomo en cuenta tus metas…". No se
  listan los títulos en esa línea.
- Con el primer chunk, esa línea desaparece y queda el cursor.
- Con reducir movimiento: texto quieto, sin puntos animados.
- El aviso va en un `Text` con `accessibilityLiveRegion="polite"`, no en el
  `View` padre.

### Burbuja y tres acciones

- Vos, a la derecha, fondo `primaryContainer`. Sui, a la izquierda, fondo
  `surfaceContainerLow`, borde `outlineVariant`, `SuiMark` de 20 dp.
- Hora relativa en `labelXs`. Sin markdown, sin pulgar, sin menú de tres
  puntos.
- Acciones sólo en el último mensaje de Sui, con toque mínimo de 44 dp:
  copiar, reintentar, y detener mientras llega el stream.
- Copiar exige agregar `expo-clipboard`. Es la única dependencia nueva de
  este corte. Si no se aprueba, el corte sale sin copiar y con detener más
  reintentar.
- Reintentar reutiliza el último texto enviado. No duplica el mensaje del
  usuario. El error distingue, en el copy, corte de red y límite del proxy
  sólo si el cliente ya recibe esos dos errores por separado. Si hoy ambos
  caen en `onError` igual, el copy es uno solo: "Se cortó la conexión. Tu
  mensaje está a salvo." Más "Reintentar".
- El hilo reserva espacio abajo para que la cápsula no tape el último mensaje.

### Archivos probables del corte 1

- `components/ChatInput.tsx` (pasa a ser la cápsula; se puede renombrar).
- `components/ChatMessage.tsx`.
- `screens/ChatScreen.tsx` (timer de espera, cancelar, reintentar, padding).
- `store/useChatStore.ts` (último texto enviado; el borrador puede vivir en
  una clave propia y no en el historial).
- `shared/i18n/messages/chat.ts`.
- Tests de `ChatInput`, `ChatMessage` y `chatStream`.

No se crean ocho componentes nuevos para el corte 1.

## 5. Qué queda fuera

| Después | Qué es                                                                                                                                                                      | Por qué no ahora                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Corte 2 | Pasar una respuesta a meta o hábito, editar el último mensaje, markdown mínimo (negrita y listas, sin librería), línea "Tengo presentes tus metas" con opción de no usarlas | Cruza features y toca el store de productividad |
| Corte 2 | Tono Calma / Directo, si el prompt en inglés también lo respeta y se reescribe `coach`                                                                                      | El `coach` actual no cumple la voz del producto |
| Corte 2 | `ConfirmModal` en vez de `Alert` al limpiar                                                                                                                                 | Mejora real, no cambia la percepción del hilo   |
| Corte 3 | Voz, dictado, separadores por día, búsqueda, hilos, sugerencias según la hora                                                                                               | Dependencias, permisos y más superficie         |
| No      | Botón `[+]`, pulgar arriba/abajo, mostrar el system prompt, subir historial o feedback a la nube                                                                            | No hay acción real o rompe la privacidad        |

Los chips de seguimiento después de cada respuesta no entran al corte 1. El
estado vacío sí puede ganar el doodle `sprout` y el saludo con nombre, porque
es local y no llama al modelo. Si el tiempo aprieta, se cae sin afectar la
cápsula.

## 6. Criterio de aceptación del corte 1

1. Se puede seguir escribiendo mientras Sui responde, y el mismo botón detiene
   el stream sin borrar lo ya escrito.
2. Una espera real de más de 600 ms muestra una sola línea. Una respuesta
   rápida no muestra "Pensando…".
3. El último mensaje de Sui se puede reintentar. Copiar funciona sólo si
   `expo-clipboard` quedó aprobado.
4. Un texto de crisis abre el overlay y no se envía. El borrador sigue en la
   cápsula.
5. Salir y volver conserva el borrador y no el streaming a medias.
6. Claro y oscuro, y con reducir movimiento activado.
7. `npm run check` en verde. Sin cambiar el proxy, la ventana de contexto ni
   el tope de 1000 caracteres.

## 7. Prompt para Codex (corte 1)

```text
Repo Sui (apps/mobile). Leé AGENTS.md y docs/product/CHAT_CONVERSACION.md. Implementá sólo el corte 1 de ese documento. Comentarios en español con voseo nica. Los textos nuevos de la app van en i18n, en el mismo tuteo que ya usa messages/chat.ts (no en voseo).

NO toques archivos fuera de features/chat, shared/i18n/messages/chat.ts, el mock de tests que haga falta y package.json al instalar expo-clipboard. Está prohibido modificar el rediseño visual ya aplicado (Hoy, Pomodoro, TabNavigator, tema, eas.json) y el proxy. Sin commit.

1) Cápsula en components/ChatInput.tsx (no crees ChatComposer ni un botón [+]):
- Una sola cápsula: radio completo, fondo surfaceContainerHigh, borde 1 de outlineVariant, sin sombra. El TextInput sigue multiline con maxHeight 120 y placeholder existente. editable siempre true.
- Enviar: apagado (surfaceContainerHighest) si no hay texto. Con texto, fondo primary e ícono onPrimary. Durante streaming el mismo botón es detener (accesibilidad chat.stop) y llama a onStop. No borres el texto ya recibido.
- El campo sólo se vacía cuando el envío fue aceptado. Si detectCrisis dispara el overlay, el texto sigue en la cápsula. Hoy ChatInput hace onChangeText('') después de onSend: mové ese vaciado a ChatScreen, después de pasar la crisis.
- Contador {count}/1000 en labelXs. Color onSurfaceVariant hasta 949 y flame desde 950.
- Borrador en AsyncStorage con clave sui-chat-draft-v1, aparte de sui-chat-v1. Al abrir el chat, rehidratar. Al aceptar un envío, borrar. Al salir a media escritura, conservar.

2) Espera honesta, estado local en ChatScreen, sin persistir:
- Si el primer chunk llega antes de 600 ms, no muestres frase de espera.
- Si a los 600 ms el mensaje de Sui sigue vacío: chat.thinking ("Pensando…" / "Thinking…").
- Si a los 1200 ms sigue vacío y hay al menos una meta activa: chat.remembering ("Tomo en cuenta tus metas…" / "Taking your goals into account…"). No listes títulos.
- Al primer chunk, ocultá la frase y dejá el cursor ▍ que ya existe.
- La frase va en un Text con accessibilityLiveRegion="polite". Sin puntos animados. useReduceMotion no hace falta si no hay animación.

3) Burbuja en ChatMessage.tsx, sin componentes nuevos:
- Usuario a la derecha, fondo primaryContainer, texto onPrimaryContainer, maxWidth 82%.
- Sui a la izquierda, fondo surfaceContainerLow, borde outlineVariant, SuiMark 20. Hora local HH:mm en labelXs, a partir de createdAt. Sin markdown, sin 👍, sin menú.
- Acciones sólo en el último mensaje de Sui, toque mínimo 44: Copiar, Reintentar, y Detener mientras streaming. Copiar usa expo-clipboard (npx expo install expo-clipboard). Tras copiar, el botón muestra chat.copied un momento. Haptics.impactAsync(Light) sólo al copiar y al detener, con catch.
- Reintentar no vuelve a llamar addUserMessage. Guardá en el store el último texto aceptado (no persistido en sui-chat-v1). Reintentar borra la respuesta fallida o incompleta de Sui y vuelve a abrir el stream con el historial que ya incluye ese mensaje de usuario.
- Si onError, el copy visible es chat.connectionLost ("Se cortó la conexión. Tu mensaje está a salvo." / "The connection dropped. Your message is safe.") más Reintentar. No inventes un error distinto para el límite del proxy: hoy onError no los separa.
- FlatList con keyboardShouldPersistTaps="handled" y paddingBottom suficiente para que la cápsula no tape el último mensaje.

4) Al detener: controllerRef.cancel() y finalizeAssistant, conservando el texto parcial. Al desmontar la pantalla se sigue cancelando como hoy.

No hagas: botón [+], chips después de cada respuesta, doodle, tono de personalidad, markdown, voz, editar mensaje, convertir en meta o hábito, ConfirmModal, ni cambiar detectCrisis, CONTEXT_WINDOW o MAX_INPUT_CHARS.

Al final: npx prettier --write sólo sobre los archivos tocados, y npm run check en verde. Sin commit. Reportá archivos, si instalaste expo-clipboard y cualquier decisión fuera de esto.
```
