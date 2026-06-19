# Plan de Implementación: Módulo de Registro y Configuración (Onboarding) - SUI

## Objetivo
Desarrollar un flujo de registro inicial (Onboarding) sin fricciones que actúe como el primer punto de contacto del "compañero preventivo". Capturará la identidad básica del estudiante (Nombre, Carrera, Año de estudio, Año de nacimiento) y configurará 3 objetivos de bienestar de forma guiada mediante una interfaz conversacional, eliminando la barrera del "login tradicional" para evitar el abandono prematuro.

## Alcance
**Incluido (IN Scope):**
- Autenticación anónima silenciosa (Firebase Anonymous Auth).
- Almacenamiento local persistente (Local-first) para datos de perfil y progreso del onboarding.
- Lógica de "Guardián de Estado" (retomar el registro donde se dejó si se cierra la app).
- Modo "Tunneling": Restricción de navegación (bloqueo) hasta completar los pasos obligatorios.
- UI conversacional (Chatbot interactivo básico pre-programado para el flujo de captura).
- Selección guiada de 3 objetivos predefinidos/recomendados por el sistema.

**Excluido (OUT of Scope - Para fases posteriores):**
- Inicio de sesión con correo/contraseña o Google/Apple (se pospone hasta que el usuario decida consolidar la cuenta).
- Procesamiento de Lenguaje Natural (NLP) avanzado en este flujo inicial (el bot será determinista/guiado en esta etapa para garantizar rapidez y evitar bloqueos por latencia de IA).
- Sincronización en tiempo real a la nube (solo se registrará el ID anónimo, los datos pesados se quedan en local por ahora).

## Arquitectura

- **Stack Tecnológico:**
  - **Frontend:** TypeScript + React Native (Expo SDK 56).
  - **Arquitectura UI:** Componentes Funcionales gestionando estado con `Zustand`.
  - **Validación de Formularios:** `react-hook-form` + `zod`.
  - **Persistencia Local:** `@react-native-async-storage/async-storage` para el estado del onboarding, perfil y metas.
  - **Enrutamiento:** `@react-navigation/native-stack`.
  - **Backend/Auth:** Firebase Authentication (Anonymous via Web SDK).

## Fases

1. **Fase 1: Configuración de Estado y Persistencia**
   - **Tareas:** Crear el store de `Zustand` (`useOnboardingStore`). Conectar el store con `AsyncStorage` (persist middleware) para actuar como "Guardián de Estado". Definir esquemas con `zod`.
2. **Fase 2: Motor de Enrutamiento (Tunneling)**
   - **Tareas:** Configurar `@react-navigation/native-stack`. Implementar lógica condicional: Si `isComplete: false` en Zustand, forzar el Stack de Onboarding.
3. **Fase 3: Interfaz Conversacional (Chatbot UI)**
   - **Tareas:** Desarrollar componentes de UI nativos (burbujas, selectores). Integrar `react-hook-form` para captura paso a paso.
4. **Fase 4: Integración Firebase Auth**
   - **Tareas:** Al guardar en AsyncStorage el último paso, disparar `signInAnonymously()`. Actualizar estado a completado.

## Riesgos y Mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Fricción por Tunneling** | Media | Alto | El diseño conversacional debe ser empático, explicando el *por qué* de los datos. |
| **Pérdida de Estado (App Kill)** | Alta | Medio | Persistir vía `persist` middleware de Zustand sobre `AsyncStorage` en cada cambio de estado. |
| **Falla de Firebase Auth Offline** | Media | Bajo | Marcar bandera local `sync_pending=true` y reintentar al detectar red. |