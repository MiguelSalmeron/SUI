# Plan de Implementación: Módulo de Chatbot IA (Asistencia Emocional) - SUI

## Objetivo
Desarrollar un asistente conversacional inteligente que actúe como un "compañero preventivo" para estudiantes universitarios. Debe responder en menos de 3 segundos con respuestas empáticas, asegurar la privacidad mediante un historial temporal local (auto-limpiable) y contar con un protocolo de emergencia directo para crisis de salud mental.

## Alcance
**Incluido (IN Scope):**
- Conexión segura a la IA (OpenRouter) mediante un proxy serverless (Firebase Cloud Functions v2).
- Respuestas generadas en tiempo real usando Streaming (Server-Sent Events) hacia React Native.
- Historial de chat persistido localmente (`AsyncStorage` + `Zustand`) con caducidad de 48 horas.
- Lógica híbrida de contexto: Inyección de "Ficha de Estado Emocional" + últimos 8-10 mensajes en cada prompt.
- Detección de palabras clave críticas y protocolo de derivación inmediata (Emergency Overlay) administrado dinámicamente vía Firebase Remote Config.
- Interfaz gráfica minimalista estilo Gemini/GPT (sin burbujas, tipografía diferenciada).

**Excluido (OUT of Scope - Para fases posteriores):**
- Entrenamiento fino (Fine-tuning) de modelos propios.
- Sincronización del historial de chat en la nube (la base de datos se mantiene estrictamente en el dispositivo).
- Procesamiento de voz a texto.

## Arquitectura (Stack Expo / React Native + Firebase)

- **Frontend (Expo SDK 56):**
  - **Estado:** `Zustand` (`useChatStore`) con middleware `persist` gestionando la "Ficha de Estado Emocional" y los mensajes de las últimas 48h.
  - **UI/Streaming:** Flujo de texto continuo en `React Native` consumiendo SSE (requerirá polyfills como `react-native-sse` debido a limitaciones de Hermes/Fetch en RN).
- **Backend / Infraestructura (Firebase Blaze Plan):**
  - **Proxy Seguro:** `Firebase Cloud Functions v2` (Node.js) actuando como intermediario entre la app móvil y OpenRouter. Esta función almacena la API Key de forma segura y maneja el stream de respuesta.
  - **Configuración Dinámica:** `Firebase Remote Config` alojará el diccionario de palabras críticas (JSON) para que la app las descargue al iniciar.

## Tareas Preparatorias (Responsabilidad del Usuario)
1. **Cuenta OpenRouter:** Crear cuenta, obtener API Key y (opcionalmente) cargar saldo mínimo.
2. **Consola Firebase:**
   - Crear proyecto "SUI" (si no existe del módulo Onboarding).
   - Actualizar a Plan Blaze (requiere tarjeta para habilitar Cloud Functions; cuota gratuita muy holgada).
   - Inicializar Remote Config y pegar el JSON del diccionario de crisis que se proveerá en la fase de desarrollo.

## Fases de Desarrollo (A ejecutar por la IA)

1. **Fase 1: Infraestructura Cloud (Firebase Proxy)**
   - **Tareas:** Inicializar entorno de Firebase Functions localmente. Escribir la función v2 `chatProxy` en TypeScript. Integrar el SDK oficial u HTTP estándar para consumir OpenRouter y retornar un stream HTTPS. Manejar CORS y validación de tokens.
2. **Fase 2: Gestión de Estado y Contexto Híbrido (RN/Zustand)**
   - **Tareas:** Crear `useChatStore`. Implementar la persistencia con caducidad de 48h. Desarrollar la lógica que extrae los últimos N mensajes y la "Ficha Emocional" para estructurar el Payload del Prompt.
3. **Fase 3: Protocolo de Intervención (Remote Config & UI)**
   - **Tareas:** Conectar SDK de Firebase Remote Config. Implementar la validación Regex en cliente *antes* del envío. Desarrollar la UI de `EmergencyOverlay` con botones interactivos (llamada directa).
4. **Fase 4: Motor de Streaming en Cliente y Diseño Visual**
   - **Tareas:** Configurar el cliente SSE en React Native (`react-native-sse`). Diseñar la pantalla de chat con alineación sutil y prefijos (estilo GPT). Implementar el efecto "máquina de escribir" que concatena los chunks recibidos de la función proxy. Manejo robusto de errores de red.

## Riesgos y Mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Incompatibilidad Streaming en React Native** | Alta | Alto | El motor Hermes a veces rompe los streams nativos `fetch()`. Mitigación: Usar la librería robusta `react-native-sse` o polyfills específicos probados en Expo. |
| **Exceso de Costos/Tokens (OpenRouter)** | Media | Medio | Limitar drásticamente la inyección de historial a los últimos 8 mensajes + ficha de estado. Imponer un límite de caracteres en el input del usuario. |
| **Latencia Cold Start de Functions v2** | Media | Medio | Configurar la función con `minInstances: 1` si la latencia es crítica en pruebas, o precargar la función de forma asíncrona al abrir la app. |
