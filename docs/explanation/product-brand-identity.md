# Identidad visual de producto de Sui

## Propósito

Sui acompaña a organizar metas, hábitos y tiempo con calma, sin convertir la
productividad en presión. La identidad combina cuatro rasgos:

- **calma enfocada:** jerarquía clara, fondos tranquilos y poco ruido visual;
- **crecimiento:** hojas, brotes, caminos y ritmos como metáforas de avance;
- **acompañamiento:** voz cercana, concreta y sin optimismo forzado;
- **energía puntual:** naranja sólo para rachas, prioridades y celebraciones.

La reconstrucción digital parte del Manual de Identidad Visual. Esta guía
traduce sus reglas al producto móvil, incorpora contraste accesible y define el
comportamiento en modo oscuro.

## Nombre

El nombre visible siempre se escribe **Sui**. `SUI` queda reservado para
identificadores técnicos, nombres históricos del repositorio y constantes de
código como `SUI_BRAND`.

“Cultiva tu vida” aparece únicamente en bienvenida, cierre de onboarding y
celebraciones especiales. No funciona como subtítulo permanente.

## Marca

### Elementos

- **Isologo:** símbolo contenedor con el nombre Sui. Uso en acceso, onboarding,
  splash y superficies amplias.
- **Isotipo:** hoja con trazo interior y punto separado. Uso en iconos, favicon
  y acción central Sui.
- **Punto:** parte inseparable del isotipo. Nunca eliminar, acercar ni usar como
  elemento independiente.

Los vectores maestros viven en:

```text
assets/brand/sui-isologo.svg
assets/brand/sui-isotype.svg
```

Los PNG equivalentes sirven a React Native. No deben editarse directamente;
una actualización visual empieza en el vector y regenera derivados.

### Variantes

- `brand`: azul institucional sobre fondo claro o marino.
- `inverse`: blanco sobre fondo marino o superficie oscura.
- `monochrome`: un solo color semántico; destinada a contextos del sistema.

`SuiMark` implementa estas variantes con `variant`, `tone`, `size`,
`accessible` y `accessibilityLabel`.

### Protección y tamaños

`x` corresponde al diámetro del punto separado. Debe existir un área libre de
al menos `2x` alrededor de la marca. Ningún texto, borde, icono ni recorte entra
en ese espacio.

- Isologo: 48 dp mínimo en interfaz; 64 dp recomendado; 160 dp para presencia
  amplia.
- Isotipo: 20 dp mínimo; 24–32 dp en controles; 1024 px como maestro de icono.
- Iconos adaptativos: conservar la zona segura central configurada en activos;
  no añadir placa blanca, halo ni sombra.

### Usos incorrectos

- no escribir el nombre sin el contenedor para simular el logo;
- no girar, inclinar, deformar, recortar ni cambiar proporciones;
- no unir el punto al símbolo ni eliminarlo;
- no aplicar degradados, sombras o contornos;
- no colocar el azul institucional sobre fondos sin contraste suficiente;
- no usar dibujos expresivos como controles funcionales.

## Color

### Paleta institucional

| Rol | Valor | Uso |
| --- | --- | --- |
| Azul Sui | `#218ECE` | marca, ilustración y presencia institucional |
| Marino | `#0B132B` | base oscura, texto y contraste de marca |
| Blanco | `#FFFFFF` | superficies claras y variante inversa |
| Azul acción | `#1677A6` | botones y controles con texto blanco AA |
| Salvia | `#55796F` | hábitos, constancia y éxito |
| Naranja | `#E87536` | rachas, prioridad y celebración |

Azul Sui con blanco alcanza contraste para texto grande, no para texto normal.
Controles con texto blanco usan Azul acción. Naranja usa texto marino.

### Esquema claro

- fondo `#F6FAFC`;
- superficie principal `#FFFFFF`;
- contenedores azulados de baja saturación;
- texto principal marino;
- bordes discretos antes que sombras intensas.

### Esquema oscuro

- fondo `#0B132B`;
- superficies `#111C32`, `#16233D` y `#1C2C49`;
- azul claro `#62C4F2` para acciones;
- salvia clara `#AACDC1` para constancia;
- naranja claro `#FFB078` para energía puntual.

Componentes consumen pares semánticos del tema: `primary/onPrimary`,
`secondary/onSecondary`, `flame/onFlame` y equivalentes de contenedor. Hex
directos fuera del tema quedan limitados a activos de marca.

## Tipografía

Poppins forma toda la interfaz:

- Regular: cuerpo, descripciones y campos;
- Medium: énfasis leve;
- SemiBold: etiquetas, navegación y acciones secundarias;
- Bold: títulos, botones y métricas.

Fredoka One queda limitada a bienvenida, hitos, niveles y celebraciones. No se
usa en párrafos, navegación, formularios ni datos densos. League Spartan no se
usa dentro del producto.

Las familias se cargan localmente antes de ocultar el splash. Los tokens viven
en `src/shared/theme/brand.ts` y `src/shared/theme/theme.ts`.

## Lenguaje gráfico

`SuiDoodle` ofrece cuatro ilustraciones outline:

- `sprout`: comienzos, metas o estados sin contenido;
- `path`: proceso, avance y próximos pasos;
- `rhythm`: hábitos, constancia y seguimiento;
- `calendar`: agenda y fechas vacías.

Trazos redondeados, un solo color semántico y pocos puntos generan parentesco
con la hoja de marca. Se usan con moderación en onboarding, estados vacíos y
celebraciones. El patrón repetitivo del manual no entra en pantallas de trabajo.

## Voz

La voz es breve, directa y acompañante:

- describe situación antes de motivar;
- propone siguiente acción concreta;
- reconoce progreso sin exageración;
- evita culpa, urgencia artificial y promesas de bienestar;
- distingue metas finitas de hábitos repetibles.

Correcto: “Una mirada clara a lo que has construido.”

Incorrecto: “¡Eres imparable! ¡Completa todo ahora!”

## Accesibilidad

- texto normal: contraste mínimo `4.5:1`;
- texto grande y controles no textuales: mínimo `3:1`;
- marca decorativa: `accessible={false}`;
- marca como única identificación: `accessible` y etiqueta “Sui”;
- ilustraciones expresivas: fuera del árbol de accesibilidad;
- color acompañado por etiqueta, icono o estado.

La prueba `src/shared/theme/__tests__/brand.test.ts` protege colores, familias y
combinaciones de contraste principales.

## Activos derivados

| Superficie | Activo |
| --- | --- |
| iOS y Expo | `assets/icon.png` |
| Android foreground | `assets/android-icon-foreground.png` |
| Android background | `assets/android-icon-background.png` |
| Android monocromático | `assets/android-icon-monochrome.png` |
| Splash | `assets/splash-icon.png` |
| Web | `assets/favicon.png` |

La revisión de una actualización debe cubrir 320, 375 y 430 dp, temas claro y
oscuro, tamaño de texto grande, safe areas, carga fría de fuentes, icono,
splash, onboarding, encabezado y estados vacíos.
