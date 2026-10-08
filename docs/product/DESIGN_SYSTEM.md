# Sistema de diseño de producto — Sui

- **Estado:** fuente canónica de UX/UI
- **Versión:** 2.2
- **Actualizado:** 22 de septiembre de 2026

## 1. Dirección

Sui combina:

- **calma enfocada:** fondos tranquilos, jerarquía fuerte, aire útil;
- **crecimiento:** hojas, brotes, caminos y ritmos;
- **acompañamiento:** voz concreta, cercana, sin culpa;
- **energía puntual:** naranja sólo para acción prioritaria, racha o celebración.

Calma no significa lentitud. Pantalla debe responder inmediatamente, mostrar
siguiente paso y evitar animaciones que bloqueen interacción.

## 2. Principios de interfaz

1. Una intención principal por pantalla o estado.
2. Jerarquía antes que decoración.
3. Datos locales antes que loaders de red.
4. Meta y Hábito siempre distinguibles por lenguaje, estructura e iconografía.
5. Contexto avanzado aparece bajo demanda.
6. Estado vacío enseña; nunca rellena con ejemplos falsos.
7. Color refuerza significado; nunca lo comunica solo.
8. Marca acompaña; no invade superficies de trabajo.

## 3. Navegación canónica

```text
Root stack
├── Welcome
├── Register / Login / ForgotPassword / MergeData
├── Home
│   └── Bottom tabs: Inicio · Metas · Hábitos · Agenda
├── Chat                  # acción central Sui
├── Progress              # desde Inicio
├── Settings              # desde avatar
└── Connections           # desde Ajustes
```

Barra inferior muestra cuatro rutas reales y acción central Sui. Acción Sui:

- usa isotipo;
- rol `button`, no `tab`;
- abre Chat sin cambiar selección anterior;
- no muestra badge.

Encabezado global: isologo Sui + avatar. Sin saludo, engranaje, badge de sync ni
contadores en navegación.

## 4. Flujo de entrada

### Bienvenida

Dos pasos, contenido centrado hasta 560dp y safe areas:

1. Bienvenida: marca compacta centrada, descripción breve,
   intención elegible y CTA `Empezar con esto`. Cuatro filas de ancho completo
   en ES/EN; descripción sólo en selección activa. Vista previa breve del kit
   real, editable o descartable. CTA palpita suavemente con pausas; se detiene
   al tocarlo, cambiar de pantalla o pasar a segundo plano. Con reducción de
   movimiento queda estático.
   Intención inicial `explore`, persistida al avanzar. Acceso secundario a login.
2. Cuenta: valor de sincronización, `Crear cuenta` primario, `Ya tengo cuenta`
   outline. Tarjeta visible `Probar sin cuenta`, colapsada por defecto. Al abrir,
   explica pérdida de datos al borrar datos, desinstalar o perder dispositivo;
   exige reconocimiento explícito antes de habilitar `Empezar sin cuenta`.
   Consentimiento 18+, Términos y Privacidad al final.

Mosaico representa Meta, Hábito, Agenda y Progreso sin datos reales; queda fuera
del lector de pantalla. Selección marcada con borde, color y check. Controles
de al menos 44dp, CTA de 52dp. Salida de paso 180ms, entrada 320ms, stagger
de 60–90ms. Reduce-motion elimina desplazamientos, escalas y esperas.

### Auth

- Scaffold compartido, logo real, título directo, error cercano al campo.
- Proveedor principal según contexto; alternativas visibles, no escondidas.
- Apple sólo cuando plataforma/config lo permiten.
- Opción local permanece visible antes de entrar, no dentro de formulario.
- Estado no verificado explica que datos siguen locales.

### Inicio vacío

Una tarjeta educativa contiene brote, diferencia Meta/Hábito y dos CTA
independientes. Después de crear primer elemento desaparece; no se reemplaza por
contenido simulado.

Mientras no exista Meta ni Hábito, ocultar Próxima acción, Progreso y Agenda.
Fecha, explicación y dos CTA constituyen estado completo.

## 5. Plantillas de pantalla

### Inicio

```text
Fecha + mensaje breve
Próxima acción
Progreso del día → Ver progreso
Racha / XP
Agenda cronológica
```

Sin productividad: guía inicial antes de tarjetas analíticas. Evento Calendar
pasado nunca aparece como próxima acción.

### Metas

- Tabs internas: Activas / Completadas.
- Tarjeta: importancia, título, fecha, progreso, resumen de hitos.
- Crear: nombre, horizonte, importancia, hitos opcionales.
- Completar/reabrir y eliminar viven en menú secundario; eliminar confirma.
- Tap en contenido principal abre edición. Hitos y menú mantienen acciones propias.
- Edición conserva identidad, progreso, hitos y estado. Fecha admite selección exacta;
  atajos 1/2/4 semanas sólo aceleran selección.

### Hábitos

- Tabs internas: Hoy / Mis hábitos.
- Tarjeta: acción, frecuencia, estado diario, racha, vínculo opcional.
- Completar es acción primaria de un toque.
- Proteger racha/eliminar viven en menú secundario.
- Tap en contenido principal abre edición; checkbox y menú no la disparan.
- Frecuencia específica usa selector lunes–domingo con mínimo un día.

### Agenda

- Mes lunes–domingo.
- Cambio de mes + volver a hoy.
- Indicadores discretos por fecha.
- Lista completa de fecha seleccionada.
- CTA `Conectar calendario` sólo sin conexión y cuando aporta contexto.
- Gestión/revocación vive en Ajustes → Conexiones.

### Progreso

- Nivel + XP.
- Insight semanal.
- Gráfica y métricas.
- Logros.
- Sin planificación ni navegación propia inferior.

### Ajustes

Secciones: Cuenta, Conexiones, Apariencia, Texto, Idioma, Notificaciones,
Privacidad/Datos. Estado cuenta usa uno de:

- `En la nube`;
- `Pendiente de sincronizar`;
- `Datos locales`;
- `Sin conexión`;
- `Error de sincronización`.

Tema, tamaño de texto e idioma usan modal con radios y selección actual visible.
Notificaciones inician desactivadas. Activación explica recordatorio local de 21:30,
después solicita permiso; denegación mantiene switch apagado. Inicio nunca abre prompt.

## 6. Marca

Nombre visible: **Sui**. `SUI` sólo para IDs técnicos o nombres históricos.

`Cultiva tu vida` sólo aparece en bienvenida y celebraciones especiales.

### Activos maestros

```text
assets/brand/sui-isologo.svg
assets/brand/sui-isotype.svg
```

- Isologo: acceso, bienvenida, splash, superficies amplias.
- Isotipo: iconos y acción central.
- Protección mínima: `2x`, donde `x` es diámetro del punto.
- Isologo mínimo 48 dp; recomendado 64 dp.
- Isotipo mínimo 20 dp; controles 24–32 dp.

Variantes `brand`, `inverse`, `monochrome`. Sin giro, deformación, sombra,
degradado, recorte, halo o placa blanca accidental.

`SuiMark` es única implementación de marca dentro de UI.

## 7. Color

| Rol         | Valor     | Uso                           |
| ----------- | --------- | ----------------------------- |
| Azul Sui    | `#218ECE` | marca e ilustración           |
| Marino      | `#0B132B` | fondo oscuro y texto          |
| Blanco      | `#FFFFFF` | superficies y marca inversa   |
| Azul acción | `#1677A6` | botones/selección con blanco  |
| Salvia      | `#55796F` | hábitos, constancia, éxito    |
| Naranja     | `#E87536` | racha, prioridad, celebración |

Claro: fondo `#F6FAFC`, superficies blancas/azuladas. Oscuro: fondo `#0B132B`,
superficies `#111C32`, `#16233D`, `#1C2C49`.

Usar tokens semánticos `primary/onPrimary`, `secondary/onSecondary`,
`flame/onFlame`, `surface*`, `error/onError`. Hex directo sólo en tema/activos.

## 8. Tipografía

Poppins 400/500/600/700 forma interfaz. Fredoka One sólo bienvenida, hitos,
niveles y celebración. Sin pesos sintéticos, `bold`, 800/900 ni League Spartan.

Tokens:

- Display: `displayLg`, `displayMd`, `displaySm`.
- Headline: `headlineLg`, `headlineMd`, `headlineSm`.
- Title: `titleLg`, `titleMd`, `titleSm`.
- Body: `bodyLg`, `bodyMd`, `bodySm`.
- Label: `labelLg`, `labelMd`, `labelSm`, `labelXs`.
- Expresivos: `brandDisplayLg`, `brandDisplayMd`, `brandDisplaySm`,
  `brandTitle`, `brandLabel`.

Componentes consumen `theme.type.*`. Sin `fontSize`, `lineHeight`, `fontWeight`
o `fontFamily` literales. Pequeño/Mediano/Grande escala `0.88/1/1.15`.

## 9. Espacio, forma y elevación

- Escala desde `SPACING`; evitar números aislados repetidos.
- Campo/control: radio medio.
- Tarjeta: radio grande.
- Pill/botón circular: radio completo.
- Bordes sutiles antes que sombras.
- Máximo una superficie protagonista por pantalla.
- Listas reservan `SCREEN_CONTENT_BOTTOM_PADDING`.
- Safe areas siempre desde `react-native-safe-area-context`.

## 10. Ilustración e iconos

`SuiDoodle`:

- `sprout`: inicio, meta, estado vacío;
- `path`: proceso y avance;
- `rhythm`: hábitos/constancia;
- `calendar`: fechas/agenda.

Doodles son expresivos, nunca controles. Ionicons permanece para acciones
funcionales reconocibles. Patrón repetitivo de marca no entra en pantallas de
trabajo.

## 11. Voz

- Describir estado antes de motivar.
- Proponer siguiente acción concreta.
- Reconocer progreso sin exagerar.
- Evitar culpa, mandato, urgencia artificial y optimismo forzado.
- Usar Meta para resultado finito; Hábito para repetición.

- Correcto: “Una mirada clara a lo que has construido.”
- Incorrecto: “¡Eres imparable! ¡Completa todo ahora!”

## 12. Estados

Cada superficie con datos remotos define:

- local/instantáneo;
- vacío;
- cargando no bloqueante;
- offline con datos disponibles;
- error recuperable;
- sincronizando;
- éxito breve.

Skeleton sólo para primera lectura real. Nunca ocultar datos locales por sync.
Errores explican impacto y siguiente acción.

### Familia de carga

Cinco familias; cada una tiene un solo indicador válido.

- **Bloqueo de arranque** → `SuiLoader` a pantalla completa (§13). Fuentes,
  hidratación de entrada y sesión. Nunca pantalla vacía.
- **Primera lectura de una superficie** → `Skeleton` con la forma real del
  contenido. Nunca spinner: el esqueleto conserva geometría y evita salto. Con
  reducción de movimiento, queda estático.
- **Lectura de fondo o sincronización** → sin indicador bloqueante. Datos
  locales a la vista y estado en texto.
- **Acción en curso** → indicador de 20 dp dentro del control que se activó,
  resto de controles deshabilitados. Nunca pantalla completa ni esqueleto.
- **Flujo conversacional** → indicador dentro del hilo, atado a su mensaje.

Se elige por lo que hizo el usuario: si acaba de tocar un control, indicador en
ese control; si está entrando, pantalla de carga; si espera contenido que no
pidió, esqueleto; si el trabajo no le exige esperar, estado en texto.
Un indicador por pantalla.

Prohibido: indicador hecho con glifo de fuente, pantalla vacía como estado de
carga y giro decorativo sin trabajo real detrás.

## 13. Pantalla de carga

Única superficie de marca a pantalla completa fuera de Bienvenida. Cubre trabajo
real de arranque, autenticación y cambio a Inicio; nunca aparece por decisión
estética. No reemplaza a `Skeleton`: el esqueleto pertenece a superficies con
datos remotos. Carga falsa sigue retirada: si el trabajo real dura 250 ms, se ve
250 ms.

### Anatomía

```text
Isologo      220 × 160 dp, centrado
Aire         mínimo 22 % de la altura; recomendado ≈ 0,3 ×
Indicador    arco de 20 dp, centrado en el eje del isologo
Estado       una línea, sólo a partir de 3 s
```

Isologo inmóvil: la marca nunca gira, se deforma ni se recorta. El indicador va
debajo y no orbitando, así el logo queda protagonista y quieto y el movimiento
no compite con el wordmark.

### Indicador

- Arco de 280° con separación de 80°, caja de 20 dp (la misma de la familia
  acción en curso), `stroke` 3 dp, extremos redondos, radio `(caja − stroke)/2`.
- Vuelta completa por `motion.indeterminate.rotate` (1,1 s actual), lineal,
  mientras dure la carga real. Los indicadores indeterminados tienen su propio
  token porque no son duraciones de transición.
- Color `colors.primary`, no azul de marca: el indicador comunica estado, así
  que usa token semántico y se resuelve por esquema. Claro `#1677A6` sobre
  `#F6FAFC` (4,7:1); oscuro `#62C4F2` sobre `#0B132B` (9,4:1), contra 5,1:1 del
  azul de marca, apagado a 22 dp.
- Geometría, nunca glifo de fuente: `Ionicons.ttf` se carga junto a Poppins, y un
  indicador basado en iconfont sería invisible justo en la pantalla que espera a
  que existan las fuentes.

### Continuidad con el splash nativo

El splash nativo mide ≈ 220 × 160 dp (`imageWidth 220`, `contain`, maestro
1024/745, fondo `#0B132B`). La pantalla de carga replica esa geometría para que
el fade de 350 ms entregue el isologo ya en su lugar: una sola pantalla que
cobra vida, no dos encadenadas.

### Tema

- Fondo del tema activo (`colors.background`).
- Isologo `brand` en ambos esquemas. El splash nativo ya muestra el azul sobre
  `#0B132B`, así que invertirlo a blanco en oscuro rompería la continuidad justo
  en el relevo que esta pantalla existe para proteger.
- El splash nativo usa la variante `dark` del plugin, que sigue al sistema
  operativo y no a la preferencia in-app. Un cruce entre ambos es aceptable; un
  salto no.
- Mientras la preferencia no hidrató, usar el mismo fallback que el tema, para
  que el fondo no cambie dos veces.

### Alcances

- Arranque: pantalla completa. Cubre fuentes (timeout 8 s), hidratación (timeout
  4 s) y alta anónima.
- Registro, Acceso y Recuperación: indicador de 20 dp dentro del botón ya
  pulsado, campos deshabilitados. Sin pantalla completa, que borraría el
  contexto de quien está a mitad de tarea.
- MergeData: indicador dentro del control pulsado, con el resto de la pantalla
  deshabilitada. Fusiona datos locales en la nube, pero lo inició el usuario.
- Bienvenida → Inicio: indicador chico centrado, sin isologo grande. Un isologo
  de 220 dp para 400 ms se lee como parpadeo.

### Estado y voz

- 0–1,5 s: sin texto.
- Desde 3 s: una línea que describe el estado. `Preparando tus datos locales`.
- Sin piso de duración ni espera decorativa.

Ambas compuertas tienen salida garantizada (fuentes a los 8 s con las del
sistema, hidratación de entrada a los 4 s), así que esta pantalla no sobrevive a
8 s ni expone estado de error propio: un fallo real lo maneja el límite de
errores de la aplicación.

### Accesibilidad

- Isologo identificador con etiqueta `Sui`; indicador decorativo, fuera del
  árbol accesible.
- La línea de estado anuncia con `accessibilityLiveRegion` en su propio
  `Text` (Android) y con anuncio explícito en iOS, para que el lector de
  pantalla no quede en silencio. La live region nunca va en un `View`
  contenedor: Android anuncia el nodo que cambió y un `View` sin texto propio
  no tiene qué anunciar. Nunca ambos mecanismos en la misma plataforma:
  duplicaría la línea.
- Con reducción de movimiento: indicador estático y estado por texto; sin giro
  lento ni pulso. `SuiLoader` y `Skeleton` comparten la preferencia vía
  `useReduceMotion`, para que la familia de carga sea coherente.

### Implementación

- `SuiLoader` expone sólo el arco y vive junto a `SuiMark`; la composición de
  pantalla completa vive junto al arranque. Ambos sin texto y sin dependencia de
  fuentes o i18n.
- La marca sale siempre de `SuiMark`. El SVG directo sería una segunda
  implementación de marca; a 220 dp con maestro de 1024 px hay 4,6× de densidad.

## 14. Responsive y accesibilidad

- Referencias: 320, 375, 430 dp; tablet; web.
- Contenido mantiene ancho legible en superficies grandes.
- Contenido principal usa máximo `SCREEN_MAX_CONTENT_WIDTH = 560` y se centra.
- Acciones envuelven texto; no dependen de altura fija.
- Objetivo táctil 44 dp; calendario puede usar 40 dp sólo a 320 dp.
- Texto normal `4.5:1`; texto grande/controles `3:1`.
- Roles/labels/states accesibles.
- Decoración fuera del árbol accesible.
- Logo decorativo no se anuncia; logo identificador usa etiqueta `Sui`.
- Color nunca único indicador.

## 15. Movimiento

- 150–300 ms para feedback/transición común.
- Celebración breve después de acción confirmada.
- Haptics sólo en cambio significativo.
- Respetar reducción de movimiento cuando plataforma exponga preferencia.
- Sin espera, autoplay decorativo largo ni loop distractor.

## 16. Componentes vigentes

Mantener:

- `SuiMark`, `SuiDoodle`, `ScreenIntro`, `Skeleton`;
- barra inferior personalizada;
- tokens semánticos y tipográficos;
- formularios de Meta/Hábito dentro de cada feature;
- `SelectionModal` para preferencias de opción única;
- `FlatList` para Inicio, Metas, Hábitos y lista diaria de Agenda;
- estados vacíos guiados;
- CTA Calendar contextual.

Retirado; no reintroducir:

- onboarding conversacional de nueve pasos;
- preguntas de perfil obligatorias y carga falsa;
- datos sembrados/bono inicial;
- logo `S` genérico;
- cinco tabs, tab Progreso, FAB y badges numéricos;
- saludo, engranaje y sync badge en header;
- conexión Calendar durante onboarding o permanente en header;
- refresh/access token Calendar en cliente;
- tamaños/pesos tipográficos literales;
- fotografías o datos personales en mosaico de bienvenida;
- patrón repetitivo dentro de superficies productivas.

## 17. Fuente de implementación

```text
src/shared/theme/theme.ts
src/shared/theme/typography.ts
src/shared/theme/brand.ts
src/shared/ui/SuiMark.tsx
src/shared/ui/SuiDoodle.tsx
src/application/navigation/TabNavigator.tsx
src/features/onboarding/screens/WelcomeScreen.tsx
```

Antes de aceptar cambio visual:

```bash
npm run check
npm run export:web
npx expo-doctor
```

Revisión manual completa usa matriz definida en [PRD](PRD.md#10-criterios-de-release).

### Editor de identidad

Fila de identidad en Ajustes abre sheet dentro de pantalla existente. Presenta
preview grande, cambiar/quitar foto, ocho colores, detalle cerrado y preview del
header. Targets mínimos de 44 dp; texto usa escala del tema. Procesamiento y
subida deshabilitan controles, con indicador y error inline anunciado. Foto
ilegible conserva label accesible y cae a emoji o inicial. Header mantiene
acción de abrir Ajustes. No hay nombre editable ni texto libre.
