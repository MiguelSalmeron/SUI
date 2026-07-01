# Especificaciones de Datos & Sistema de Diseño 📐🎨

Este documento de referencia detalla la estructura formal de las variables de entorno, claves de almacenamiento local, esquemas de documentos de base de datos y la especificación de los tokens visuales del sistema de diseño (Material Design v3) de **SUI-2**.

---

## 🔑 Variables de Entorno (.env)

La aplicación utiliza variables prefijadas con `EXPO_PUBLIC_` para que Metro las inyecte de manera segura en el bundle de desarrollo del cliente:

| Variable | Tipo | Propósito | Ejemplo / Formato |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | String | Llave pública de Firebase Web Client | `AIzaSyA1...` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | String | Servidor de Auth de tu consola | `sui-app.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | String | Identificador único de GCP | `sui-app` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`| String | Depósito de archivos de Firebase | `sui-app.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`| String | Remitente de mensajes cloud | `837482937402` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | String | Id única de la Web App registrada | `1:8374:web:abcd...` |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | String | ID de analíticas (opcional) | `G-XXXXXXXX` |
| `EXPO_PUBLIC_CHAT_PROXY_URL` | URI | Endpoint seguro del streaming SSE | `https://chatproxy-gcp.run.app`|

---

## 💾 Persistencia Local (AsyncStorage)

SUI-2 guarda tres estructuras clave en el disco físico del teléfono móvil para garantizar el funcionamiento sin conexión:

### 1. Estado del Onboarding (`sui-onboarding-v1`)
Controlado por `useOnboardingStore`. Determina el gate visual.
```json
{
  "state": {
    "step": "done",
    "profile": {
      "name": "Sofía",
      "career": "Ingeniería Civil",
      "studyYear": 3,
      "birthYear": 2004
    },
    "selectedGoals": ["sleep", "stress", "focus"],
    "syncPending": false,
    "anonUid": "Axb389ZlkPd... (Firebase UID)",
    "onboardingComplete": true
  },
  "version": 0
}
```

### 2. Historial de Chat (`sui-chat-v1`)
Controlado por `useChatStore`. Excluye estados efímeros de streaming y aplica un TTL estricto de 48 horas.
```json
{
  "state": {
    "messages": [
      {
        "id": "17185012-abcde",
        "role": "user",
        "content": "Me siento un poco estresada por los exámenes.",
        "createdAt": 1718501222405
      },
      {
        "id": "17185012-efghi",
        "role": "assistant",
        "content": "Es normal sentirse así, Sofía...",
        "createdAt": 1718501224800
      }
    ]
  },
  "version": 0
}
```

### 3. Estado del Tablero de Productividad (`sui-home-state-v4`)
Representa el tablero diario de metas y hábitos.
```json
{
  "goals": [
    { "id": "goal-1", "title": "Tomar 2L de agua", "completed": true }
  ],
  "habits": [
    { "id": "habit-1", "title": "Estudiar 1 Pomodoro", "completed": false }
  ],
  "pomodoroMinutes": 25,
  "pomodoroSessions": 2,
  "lastResetDate": "2026-06-18",
  "streakCount": 4,
  "lastCompletedDate": "2026-06-17"
}
```

---

## ☁️ Esquemas de Base de Datos (Cloud Firestore)

### Colección: `/users/{uid}`
Representa el respaldo de sincronización del tablero de cada estudiante.

```typescript
interface FirestoreUserDocument {
  /** Metas puntuales (To-Do) */
  goals: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
  /** Hábitos recurrentes */
  habits: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
  /** Parámetros y contador del Pomodoro */
  pomodoroMinutes: number;
  pomodoroSessions: number;
  /** Fecha local (YYYY-MM-DD) del último reseteo de checklist */
  lastResetDate?: string;
  /** Número de racha de días consecutivos cumpliendo metas/habits */
  streakCount?: number;
  /** Última fecha (YYYY-MM-DD) en la que el usuario incrementó la racha */
  lastCompletedDate?: string;
}
```

### Documento: `/app_config/crisis`
Controla los parámetros globales de la detección de crisis en el chat. Su estructura base es:

```json
{
  "version": 1,
  "title": "No estás solo/a",
  "message": "Lo que sientes importa y mereces ayuda ahora mismo...",
  "keywords": [
    "suicidio", "suicidarme", "quiero morir", "matarme", "autolesion"
  ],
  "contacts": [
    { "label": "Emergencias", "phone": "911" },
    { "label": "Cruz Roja", "phone": "128" }
  ]
}
```

---

## 🎨 Sistema de Diseño (Material Design v3)

SUI-2 adopta los esquemas semánticos y de accesibilidad de **Material Design v3** (MD3) de Google, facilitando una futura implementación del modo oscuro. Los tokens se definen en `src/theme/theme.ts`:

### 1. Colores MD3 (Light Scheme)

| Token | Valor Hex | Uso Semántico |
| :--- | :--- | :--- |
| `primary` | `#1A73E8` | Color semilla, elementos activos principales |
| `onPrimary` | `#FFFFFF` | Contenido sobre fondo primary |
| `primaryContainer` | `#D3E3FD` | Contenedores y botones destacados (ej. pill activo de Navbar) |
| `onPrimaryContainer` | `#0842A0` | Contenido sobre primaryContainer |
| `secondary` | `#4285F4` | Color de apoyo secundario |
| `onSecondary` | `#FFFFFF` | Contenido sobre fondo secondary |
| `secondaryContainer` | `#DBE7FF` | Contenedores alternativos (ej. botones secundarios) |
| `onSecondaryContainer` | `#0B3B8C` | Contenido sobre secondaryContainer |
| `tertiary` | `#3367D6` | Acentuaciones o llamadas a la acción terciarias |
| `onTertiary` | `#FFFFFF` | Contenido sobre fondo tertiary |
| `tertiaryContainer` | `#E3ECFF` | Contenedores terciarios suaves |
| `onTertiaryContainer` | `#102A6B` | Contenido sobre tertiaryContainer |
| `background` | `#F8FBFF` | Fondo general de la aplicación libre de destellos |
| `onBackground` | `#1A1C1E` | Texto sobre background |
| `surface` | `#FFFFFF` | Tarjetas, paneles flotantes y hojas de fondo |
| `onSurface` | `#1C1B1F` | Texto principal sobre superficies |
| `surfaceVariant` | `#E8F0FE` | Variaciones de superficie (ej. racha inactiva) |
| `onSurfaceVariant` | `#49454F` | Texto secundario y descriptivo |
| `surfaceContainer` | `#F1F6FE` | Contenedores de tarjetas de contenido intermedio |
| `surfaceContainerHigh`| `#ECF2FC` | Contenedores elevados |
| `outline` | `#CAC4D0` | Bordes activos y divisores visibles |
| `outlineVariant` | `#E1E3E6` | Bordes sutiles o separadores de bajo contraste |
| `error` | `#B3261E` | Indicaciones de error o advertencia crítica |
| `onError` | `#FFFFFF` | Contenido sobre error |
| `errorContainer` | `#F9DEDC` | Contenedores de alertas de error |
| `onErrorContainer` | `#410E0B` | Contenido sobre errorContainer |
| `success` | `#1E8E3E` | Estados de éxito o actividades completadas |
| `onSuccess` | `#FFFFFF` | Contenido sobre success |
| `scrim` | `rgba(0,0,0,0.32)`| Capa de sombreado (backdrop) de modales y diálogos |

---

### 2. Niveles de Elevación (Sombras por Capas)

Las sombras se computan matemáticamente para simular profundidad nativa sobre el lienzo móvil siguiendo la física de capas de MD3:

*   **`level0`:** `elevation: 0`, `shadowOpacity: 0` (Totalmente plano, ej. fondo general o elementos inactivos).
*   **`level1`:** `elevation: 1`, `shadowRadius: 3` (Sombra sutil, ej. tarjetas e inputs normales).
*   **`level2`:** `elevation: 3`, `shadowRadius: 6` (Profundidad media, ej. tarjetas de hábitos, barra de racha activa).
*   **`level3`:** `elevation: 6`, `shadowRadius: 10` (Ej. barra de navegación flotante activa).
*   **`level4`:** `elevation: 8`, `shadowRadius: 14` (Ej. hojas deslizantes bottom-sheets y modales).
*   **`level5`:** `elevation: 12`, `shadowRadius: 18` (Profundidad máxima, ej. menús flotantes superpuestos).

---

### 3. Radios de Esquina (Shapes)

*   **`xs`:** `4px` (Ej. indicadores compactos).
*   **`sm`:** `8px` (Ej. botones compactos, chips de objetivos).
*   **`md`:** `12px` (Ej. inputs de texto, checklist del dashboard).
*   **`lg`:** `16px` (Ej. tarjetas del Pomodoro, paneles flotantes de metas).
*   **`xl`:** `28px` (Ej. modales, bottom-sheets y bordes superiores de hojas deslizantes).
*   **`full`:** `9999px` (Círculo perfecto, ej. avatares, píldora de racha y botones flotantes).

---

### 4. Escala Tipográfica (Typography Scale)

Se define una escala proporcional y armonizada de tamaños de fuente, espaciado de letras y alturas de línea:

| Token | Tamaño (fontSize) | Altura (lineHeight) | Peso (fontWeight) | Propósito / Ejemplo |
| :--- | :--- | :--- | :--- | :--- |
| `displayLg` | `52px` | `60px` | `900` | Números gigantes (ej. cronómetro Pomodoro) |
| `displayMd` | `40px` | `48px` | `900` | Cronómetros secundarios o métricas principales |
| `headlineMd`| `28px` | `36px` | `800` | Títulos principales de pantallas |
| `headlineSm`| `24px` | `32px` | `800` | Títulos de secciones o modales |
| `titleLg` | `22px` | `28px` | `700` | Títulos destacados en tarjetas |
| `titleMd` | `16px` | `24px` | `700` | Títulos estándar de ítems en listas |
| `titleSm` | `14px` | `20px` | `700` | Títulos pequeños de widgets |
| `bodyLg` | `16px` | `24px` | `400` | Texto corrido de lectura larga |
| `bodyMd` | `14px` | `20px` | `400` | Texto secundario o descripciones base |
| `bodySm` | `12px` | `16px` | `400` | Notas de pie de página y metadatos |
| `labelLg` | `14px` | `20px` | `700` | Botones principales y acciones destacadas |
| `labelMd` | `12px` | `16px` | `700` | Texto en Navbar, chips o badges de racha |
| `labelSm` | `11px` | `16px` | `700` | Micro-indicadores o estados muy compactos |

---

### 5. Rejilla de Espaciado (Spacing)

SUI-2 utiliza una rejilla de espaciado estricta basada en incrementos de 4dp/8dp para estructurar márgenes y rellenos:

*   **`xs`:** `4px` (Espaciados ultra compactos, ej. gap entre íconos y textos).
*   **`sm`:** `8px` (Márgenes internos pequeños o gaps de listas).
*   **`md`:** `16px` (Relleno base de tarjetas e inputs, espaciado estándar).
*   **`lg`:** `24px` (Relleno de pantallas y secciones mayores).
*   **`xl`:** `32px` (Márgenes amplios de cabeceras y cierres de pantalla).

---

### 6. Garantía de Accesibilidad (Touch Targets de 48dp)

Siguiendo las pautas de accesibilidad para móviles de Apple e iOS/Android:
*   Todos los botones y áreas interactivas de SUI-2 (incluidos los destinos de `DashboardNavbar`, botones de acción rápida, modales y checkbox de checklists) garantizan una **altura o ancho mínimo interactivo de `48dp`** (`minHeight: 48` con `justifyContent: 'center'`).
*   Esto elimina la fatiga de pulsación errónea y asegura un uso óptimo para usuarios con problemas motores o en entornos con vibración.

---

### 7. Navegación e Insets Seguros

La barra inferior de navegación `DashboardNavbar` (`NAV_BAR_HEIGHT = 72`) se desacopla del flujo del ScrollView para permanecer fija. Incorpora:
*   **`useSafeAreaInsets()`:** Lectura nativa de los insets del dispositivo para añadir padding inferior de forma automática en terminales con "home indicators" (iPhone modernos) sin romper la consistencia visual en pantallas tradicionales de Android.
