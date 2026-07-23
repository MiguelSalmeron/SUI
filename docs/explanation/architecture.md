# Arquitectura de Software & Flujos de Datos 🏛️🔄

Este documento profundiza en los principios arquitectónicos, decisiones técnicas y flujos de datos que gobiernan el ecosistema de **SUI-2**. La aplicación móvil está construida sobre un modelo modular, priorizando la resiliencia offline (*offline-first*), la privacidad del usuario, y el control nativo del ciclo de vida del sistema operativo.

---

## 📂 Diseño de Carpetas (Separación de Conceptos)

El proyecto está diseñado bajo un modelo modular estricto que separa la interfaz visual de la lógica de negocio, control de estado y persistencia híbrida:

```bash
/src
├── components/            # UI modular pura sin estado complejo.
│   ├── chat/              # Componentes de interacción con la IA.
│   ├── home/              # Paneles del Dashboard, Pomodoro y Listas.
│   └── onboarding/        # Componentes del chat del onboarding conversacional.
├── config/                # Instanciación y exportación de Firebase.
├── context/               # AuthContext (Sesión activa e ID Token).
├── hooks/                 # Custom Hooks: separan el ciclo CRUD de las vistas (useGoals, useHabits).
├── navigation/            # AppNavigator (Enrutamiento por Tunneling de Onboarding).
├── screens/               # Pantallas controladoras y orquestadoras (Home, Onboarding, Chat, etc.).
├── services/              # Clientes de integración externa (SSE stream, Firestore, crisisConfig).
├── store/                 # Centrales de Zustand para gestión de estado de alto rendimiento.
├── types/                 # Tipos compartidos de TypeScript y validadores Zod.
└── theme/                 # theme.ts: Tokens de diseño unificados en Material Design v3.
```

---

## 🔄 Flujo de Datos Híbrido (Offline-First)

Para asegurar que el usuario experimente una carga instantánea (latencia cero) al abrir el Dashboard, la aplicación utiliza una **estrategia de sincronización transparente en dos capas**:

```mermaid
graph TD;
    A[Abrir App] --> B(Leer localmente: sui-home-state-v4)
    B --> C[Pintar UI al Instante - Zero Latency]
    C --> D{¿Hay sesión activa y conexión?}
    D -- Sí --> E[Descargar datos desde Cloud Firestore]
    E --> F{¿Difiere de la local?}
    F -- Sí (Gana la Nube) --> G[Sobrescribir AsyncStorage local y actualizar UI]
    F -- No --> H[No hacer nada]
    D -- No --> I[Seguir operando localmente offline]
    
    J[Modificación en UI] --> K[Actualizar Local AsyncStorage]
    K --> L{¿Sesión activa?}
    L -- Sí --> M[Sincronizar Firestore: setDoc merge: true]
    L -- No --> N[Dejar pendiente para próximo inicio]
```

*   **AsyncStorage (Capa de Presentación Inmediata):** Al cargar el componente `HomeScreen`, el estado se extrae de inmediato de la memoria del teléfono. Esto evita spinners de carga persistentes.
*   **Firestore Sync (Capa de Respaldo Transparente):** El backend en la nube se ejecuta de manera asíncrona. Si existe una diferencia horaria u operativa, los datos de Firestore reemplazan con suavidad a los locales. Cualquier actualización (ej. marcar una meta como completada) se escribe en ambas capas simultáneamente.

---

## 🍅 El Motor Resiliente del Pomodoro

Uno de los grandes desafíos al programar en React Native es la suspensión de hilos del sistema operativo: cuando el usuario minimiza la app o bloquea la pantalla, iOS y Android suspenden el motor de JavaScript, deteniendo cualquier temporizador basado en `setInterval` o `setTimeout`.

Para solucionar esto de manera matemática y precisa, SUI-2 adopta un **enfoque basado en timestamps inmutables en el futuro**:

### Diagrama de Flujo del Pomodoro

```mermaid
sequenceDiagram
    participant U as Usuario
    participant Z as Zustand (Store)
    participant E as Engine (usePomodoroEngine)
    participant OS as S.O. Móvil

    U->>Z: Iniciar Pomodoro (25 min)
    Z->>Z: Calcular targetEndTime = Date.now() + 25m
    Z->>Z: setRunning(true)
    Z->>E: Tick cada segundo (setInterval alternativo)
    U->>OS: Minimizar App (Fondo)
    Note over OS, Z: S.O. suspende Javascript. setInterval se CONGELA
    Note over OS, Z: Pasan 10 minutos reales en el mundo exterior...
    U->>OS: Abrir App (Volver al primer plano)
    OS->>E: Evento AppState transiciona a "active"
    E->>Z: Leer targetEndTime inmutable
    E->>E: Calcular segundos restantes = targetEndTime - Date.now()
    E->>Z: setPomodoroSeconds(restante)
    E->>Z: UI actualizada instantáneamente al tiempo real exacto
```

### Explicación del Algoritmo:
1.  **Inicio:** Al hacer clic en comenzar, calculamos un timestamp inmutable de finalización: `targetEndTime = Date.now() + segundos_restantes * 1000`. El flag `pomodoroRunning` pasa a ser `true`.
2.  **Suspensión:** Al pasar la aplicación a segundo plano (*background*), el hilo de render se detiene. El cronómetro se pausa visualmente.
3.  **Despertar:** Al abrir la aplicación nuevamente (*foreground*), el listener nativo `AppState` dispara una rutina de re-sincronización. El sistema compara el timestamp actual con el `targetEndTime`:
    *   Si `targetEndTime > Date.now()`, el temporizador continúa restando basándose en la diferencia real: `pomodoroSeconds = Math.round((targetEndTime - Date.now()) / 1000)`.
    *   Si `targetEndTime <= Date.now()`, el temporizador detecta que el bloque de trabajo finalizó durante la suspensión, dispara el fin de ciclo e incrementa la sesión (`pomodoroSessions = pomodoroSessions + 1`).

Gracias a esta arquitectura basada en Zustand, la lógica de conteo no renderiza todo el árbol de React en cada segundo transcurrido, optimizando el rendimiento de la batería y la CPU del dispositivo.

---

## 🗺️ Estructura de Navegación Desacoplada & Adaptabilidad (Safe Areas)

Para ofrecer una experiencia de usuario impecable (UX premium), similar a la de las aplicaciones nativas más robustas, la navegación de la aplicación principal ha sido refactorizada para desacoplarse del flujo general de ScrollView:

### 1. Desacoplamiento de la Barra de Navegación (`DashboardNavbar`)
Anteriormente, el selector de pestañas residía dentro de la vista principal con scroll. Esto causaba fatiga visual y obligaba al usuario a deslizarse hacia arriba para cambiar de sección. Ahora, `DashboardNavbar` es una capa flotante de posición fija al borde inferior de la pantalla. Esto garantiza que las secciones críticas (**Overview**, **Metas**, **Hábitos**, **Pomodoro**) estén siempre accesibles con un solo toque desde cualquier pantalla.

### 2. Integración de Insets de Safe Area (`react-native-safe-area-context`)
Diferentes terminales móviles tienen configuraciones físicas de pantalla muy distintas (por ejemplo, el "Notch" de iOS, los bordes curvos o los "Home Indicators" de deslizamiento nativo). 
*   **Ajuste Dinámico:** La aplicación utiliza `useSafeAreaInsets` de forma estratégica en el componente orquestador `HomeScreen` y el componente visual `DashboardNavbar`.
*   **Prevención de Solapamientos:** En lugar de forzar paddings fijos que se verían desproporcionados en terminales antiguos, el sistema calcula el padding inferior nativo sumándolo a la altura estándar de la barra de navegación:
    ```typescript
    const insets = useSafeAreaInsets();
    const dynamicBarHeight = NAV_BAR_HEIGHT + insets.bottom;
    ```
    Esto empuja suavemente el contenido de las listas y el botón de acción flotante (FAB) **"Hablar con SUI"** por encima de los límites físicos reales del dispositivo, garantizando que ningún botón o texto sea tapado por el indicador nativo del sistema operativo.

### 3. Iconografía Consistente con `@expo/vector-icons` (Feather)
Se ha integrado la suite `@expo/vector-icons` para proveer consistencia visual en toda la aplicación. SUI-2 adopta de manera estricta la familia de iconos **Feather** por su estilo minimalista, lineal, con grosores de trazo equilibrados (strokeWidth de 2) que encajan perfectamente con el minimalismo y sobriedad de Material Design v3.
