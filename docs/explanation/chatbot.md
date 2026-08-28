# Chatbot de acompañamiento

Sui ofrece acompañamiento conversacional preventivo. No sustituye atención médica, psicológica ni servicios de emergencia.

## Objetivos

- Proteger la clave del proveedor de IA.
- Mantener el historial sensible en el dispositivo.
- Mostrar respuestas progresivas mediante SSE.
- Detectar señales de crisis antes de enviar contenido al modelo.
- Limitar costo y abuso por usuario autenticado.

## Flujo

```text
Cliente Expo
  ├── detecta crisis localmente
  ├── crea ficha emocional y ventana de contexto
  ├── obtiene Firebase ID token
  └── abre SSE
        ↓
Firebase Function chatProxy
  ├── verifica bearer token
  ├── valida y recorta mensajes
  ├── aplica rate limit por UID
  ├── llama Azure OpenAI
  └── normaliza SSE
        ↓
Cliente actualiza mensaje en Zustand
```

## Cliente

El módulo vive bajo `src/features/chat`:

- `screens`: orquestación de conversación.
- `components`: mensaje, input y overlay de emergencia.
- `store`: historial temporal y estado de streaming.
- `services`: prompts, detección de crisis, configuración y transporte SSE.
- `types`: contratos internos.

`react-native-sse` proporciona transporte compatible con React Native. El cliente cierra la conexión al abandonar la pantalla o cancelar el flujo.

## Privacidad

- El historial usa AsyncStorage con clave `sui-chat-v1`.
- Mensajes con más de 48 horas se eliminan durante rehidratación y uso.
- El historial no se guarda en Firestore.
- Solo la ventana reciente necesaria se envía al backend.
- Tokens y secretos nunca se escriben en logs.

## Contexto

El prompt combina instrucciones de seguridad/voz, idioma activo, contexto
voluntario disponible y ventana conversacional reciente. Bienvenida no recopila
perfil psicológico, cronotipo, carrera ni objetivos obligatorios.

El backend limita cantidad y longitud de mensajes nuevamente. La validación del servidor no confía en los límites del cliente.

## Protocolo de crisis

Antes de abrir la conexión al proxy, el cliente compara el texto con una configuración de crisis.

- Fuente regional: `app_config/crisis/regions/{COUNTRY}-{locale}`.
- Fallback remoto: documento Firestore `app_config/crisis`.
- Fallback: `DEFAULT_CRISIS_CONFIG` incluido en la aplicación.
- Resultado positivo: se interrumpe el envío y se muestra `EmergencyOverlay`.

Los contactos deben revisarse por país y por especialistas responsables del producto.

## Backend

`functions/src/index.ts` solo compone el endpoint. Los módulos internos separan autenticación, configuración, rate limiting, validación, proveedor Azure y retransmisión SSE.

Límites actuales:

| Control | Valor |
|---|---:|
| Mensajes máximos | 12 |
| Caracteres por mensaje | 2000 |
| Tokens máximos de salida | 600 |
| Timeout upstream | 90 segundos |
| Requests por UID | 30 por 60 minutos |

Rate limit es fail-open ante fallos transitorios de Firestore. Antes de escala
masiva requiere monitorización de abuso y evaluación de fail-closed selectivo.

## Proveedor

El proveedor actual es Azure OpenAI Foundry con deployment configurable mediante `AZURE_MODEL`. La clave `AZURE_OPENAI_API_KEY` vive en Firebase Secret Manager.

El cliente conoce únicamente la URL del proxy mediante `EXPO_PUBLIC_CHAT_PROXY_URL`.

## Operación

- [Desplegar proxy](../how-to/deploy-chat-proxy.md)
- [Privacidad y crisis](privacy-and-crisis.md)
- [Referencia de API y almacenamiento](../reference/api-and-theme.md)
