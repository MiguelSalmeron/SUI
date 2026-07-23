# Módulo de Chatbot IA (Asistencia Emocional) — SUI 🤖💬

Este módulo implementa un asistente conversacional inteligente que actúa como un **"compañero preventivo"** de bienestar y salud mental para estudiantes universitarios. Está diseñado bajo principios de **privacidad local-first, respuesta en tiempo real (< 3s) y derivación inmediata ante emergencias**.

---

## 🏗️ Arquitectura del Sistema

El flujo de datos se divide en tres capas para garantizar seguridad de claves y optimización de recursos:

```
[ Cliente (React Native / Expo) ]
  │
  │  1. Genera token de autenticación (Firebase ID Token)
  │  2. Detecta palabras críticas localmente con Regex
  │  3. Envía mensajes usando SSE (Server-Sent Events)
  ▼
[ Proxy Seguro (Firebase Cloud Functions v2) ]
  │
  │  1. Valida el token del usuario (Firebase Auth)
  │  2. Extrae la API Key desde Secret Manager (AZURE_OPENAI_API_KEY)
  │  3. Consume Azure OpenAI Foundry con stream habilitado
  ▼
[ Azure Foundry OpenAI — gpt-5-mini ]
```

---

## 🔌 Backend: Azure OpenAI Foundry

El chatbot ahora opera con Azure Foundry (no OpenRouter) para mayor control de costos y privacidad.

| Parámetro | Valor |
|---|---|
| **Proveedor** | Azure OpenAI (Foundry) |
| **Recurso** | `Raiz` (Cognitive Services, account `raiz`) |
| **Proyecto** | `Raiz-lifeplants` |
| **Subscription** | Azure for Students (`f576c748-d40a-4561-8198-6c063d80c811`) |
| **Modelo** | `gpt-5-mini` (GPT-5, reasoning enabled, reasoning_effort=low) |
| **Endpoint** | `https://raiz.services.ai.azure.com/openai/v1/chat/completions` |
| **Secret** | `AZURE_OPENAI_API_KEY` en Secret Manager (global) |
| **Param** | `AZURE_MODEL=gpt-5-mini` en `.env.xsui-nica` |

### Cambio de OpenRouter a Azure (historial)
- **Antes (jun 2026):** OpenRouter API con modelo `nvidia/nemotron-3-ultra-550b-a55b:free`
- **Ahora (jul 2026):** Azure Foundry con `gpt-5-mini`
- **Razón:** OpenRouter free tier agotó cuota y modelos gratuitos inestables. Azure for Students ofrece $100 USD de crédito para modelos OpenAI.
- **Rollback:** Si Azure falla, restaurar backup de `index.ts` con OpenRouter.

### Rollback
```bash
# Restaurar backups
cp functions/src/index.ts.azure-backup-20260714-175318 functions/src/index.ts
cp functions/.env.xsui-nica.azure-backup-20260714-180208 functions/.env.xsui-nica
# Re-deploy a OpenRouter (requiere OPENROUTER_API_KEY en Secret Manager)
firebase deploy --only functions
```

### Nota sobre cuota
Azure for Students tiene cuota limitada por modelo. Actualmente:
- `gpt-5-mini`: 500 TPM (450 disponibles tras deploy)
- `gpt-5.6-sol`: 0 TPM (requiere solicitud de aumento de cuota en Azure Portal → `Usage + quotas`)

---

## 🔒 Privacidad Local-First y Auto-limpieza

Por confidencialidad de datos sensibles:
- **Sin base de datos en la nube:** El historial de conversaciones vive **exclusivamente** en el dispositivo del usuario.
- **Persistencia Temporal:** Se utiliza Zustand acoplado con `AsyncStorage` (clave `sui-chat-v1`).
- **Auto-limpieza (48h TTL):** Al iniciar la aplicación y cada vez que se envía un mensaje, el sistema elimina automáticamente cualquier mensaje con más de 48 horas de antigüedad (`CHAT_TTL_MS = 172800000`).

---

## 🧠 Contexto Híbrido y "Ficha Emocional"

Para dar respuestas personalizadas y empáticas sin inflar costos de tokens:
1. **Ficha Emocional:** El sistema mapea el perfil de onboarding (Nombre, carrera, año de estudio, edad aproximada y metas de bienestar seleccionadas) y lo inyecta como `system prompt` en cada llamada.
2. **Ventana Deslizable:** Solo se envían los últimos **10 mensajes** (`CONTEXT_WINDOW`) del historial para conservar contexto inmediato sin saturar la memoria del modelo.

---

## ⚠️ Protocolo de Intervención (Detección de Crisis)

La salud mental del estudiante es prioridad absoluta. El sistema cuenta con lógica dinámica para detectar crisis grave (ideaciones suicidas, autolesión) de forma inmediata:

### 1. Validación en Cliente (Regex)
Antes de despachar cualquier mensaje al proxy de IA, el cliente analiza el texto libre usando expresiones regulares con límites de palabra (`\b`). Si encuentra coincidencia con palabras de alarma como *"suicidio"*, *"autolesion"*, *"matarme"*, etc., se interrumpe o complementa el flujo visual mostrando el `EmergencyOverlay`.

### 2. Diccionario Dinámico de Emergencia
- **Originalmente:** Firebase Remote Config (limitado a Web en el SDK JS estándar).
- **Implementación Actual (Pragmática):** Colección Firestore **`app_config/crisis`**. Permite cambiar palabras clave y números de teléfono en tiempo real desde la consola de Firebase sin requerir una nueva versión de la app.
- **Respaldo Offline:** Si el usuario no tiene conexión de red al iniciar la app, el sistema utiliza un diccionario pre-empaquetado (`DEFAULT_CRISIS_CONFIG`) para garantizar que la seguridad **nunca** falle.

### 3. Emergency Overlay
Un modal que se superpone a la conversación, detalla un mensaje de apoyo cálido y muestra botones de acción rápida para realizar llamadas telefónicas directas (ej. Cruz Roja, Emergencias 911) usando la API de enlace nativo del dispositivo (`Linking`).

---

## ⚡ Motor de Streaming (SSE) en React Native

Debido a que el motor Hermes de React Native rompe el flujo de streams tradicional de `fetch()`, el cliente se conecta mediante **`react-native-sse`** (basado en XMLHttpRequest).

- **Efecto Máquina de Escribir:** Los chunks se reciben continuamente del proxy y se concatenan en tiempo real en el store Zustand, logrando que el texto fluya de forma fluida y con un retardo imperceptible (< 100ms de latencia de red).
- **Controlador de Cancelación:** Si el usuario sale de la pantalla o cancela la conversación, el flujo de eventos se cierra de inmediato en el servidor para evitar consumo innecesario de tokens.

---

## ⚙️ Guía de Configuración

### Variables de entorno (Cloud Functions)
| Variable | Archivo | Descripción |
|---|---|---|
| `AZURE_MODEL` | `functions/.env.xsui-nica` | Modelo Azure a usar (default: `gpt-5-mini`) |
| `CHAT_MIN_INSTANCES` | `functions/.env.xsui-nica` | Instancias mínimas cold start (default: 0) |
| `AZURE_OPENAI_API_KEY` | Secret Manager (global) | Key del recurso `Raiz` en Azure Foundry |

### Secrets
```bash
# Verificar secret actual
firebase functions:secrets:access AZURE_OPENAI_API_KEY

# Actualizar secret (si Azure renueva la key)
printf "NUEVA_KEY_AQUI" | firebase functions:secrets:set AZURE_OPENAI_API_KEY
```

### Deploy
```bash
cd "/home/sma/Documentos/Proyectos_Desarrollo/SIU"
npm --prefix functions run build        # compilar TS
firebase deploy --only functions        # deploy a xsui-nica
```

### Monitoreo
```bash
# Logs recientes
firebase functions:log --only chatProxy -n 50

# Console web
# https://console.firebase.google.com/project/xsui-nica/functions
```
