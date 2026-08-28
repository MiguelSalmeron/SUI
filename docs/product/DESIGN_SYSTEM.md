# Sistema de diseño de producto — Sui

- **Estado:** fuente canónica de UX/UI
- **Versión:** 2.0
- **Actualizado:** 28 de agosto de 2026

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

Orden:

1. mosaico abstracto superior;
2. isologo principal;
3. `Cultiva tu vida`;
4. descripción breve;
5. confirmación 16+;
6. `Crear cuenta`;
7. `Ya tengo cuenta`;
8. `Continuar sin cuenta`;
9. Términos y Privacidad.

Mosaico representa Meta, Hábito, Agenda y Progreso sin fotografías, nombres,
fechas ni ejemplos. Es decorativo y queda fuera de lector de pantalla.

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

### Hábitos

- Tabs internas: Hoy / Mis hábitos.
- Tarjeta: acción, frecuencia, estado diario, racha, vínculo opcional.
- Completar es acción primaria de un toque.
- Proteger racha/eliminar viven en menú secundario.

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

| Rol | Valor | Uso |
| --- | --- | --- |
| Azul Sui | `#218ECE` | marca e ilustración |
| Marino | `#0B132B` | fondo oscuro y texto |
| Blanco | `#FFFFFF` | superficies y marca inversa |
| Azul acción | `#1677A6` | botones/selección con blanco |
| Salvia | `#55796F` | hábitos, constancia, éxito |
| Naranja | `#E87536` | racha, prioridad, celebración |

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

## 13. Responsive y accesibilidad

- Referencias: 320, 375, 430 dp; tablet; web.
- Contenido mantiene ancho legible en superficies grandes.
- Acciones envuelven texto; no dependen de altura fija.
- Objetivo táctil 44 dp recomendado, 40 dp mínimo excepcional.
- Texto normal `4.5:1`; texto grande/controles `3:1`.
- Roles/labels/states accesibles.
- Decoración fuera del árbol accesible.
- Logo decorativo no se anuncia; logo identificador usa etiqueta `Sui`.
- Color nunca único indicador.

## 14. Movimiento

- 150–300 ms para feedback/transición común.
- Celebración breve después de acción confirmada.
- Haptics sólo en cambio significativo.
- Respetar reducción de movimiento cuando plataforma exponga preferencia.
- Sin espera, autoplay decorativo largo ni loop distractor.

## 15. Componentes vigentes

Mantener:

- `SuiMark`, `SuiDoodle`, `ScreenIntro`, `Skeleton`;
- barra inferior personalizada;
- tokens semánticos y tipográficos;
- formularios de Meta/Hábito dentro de cada feature;
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

## 16. Fuente de implementación

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
