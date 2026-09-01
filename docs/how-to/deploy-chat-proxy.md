# Desplegar el proxy de chat

El proxy `chatProxy` valida Firebase Auth, limita solicitudes por UID y retransmite respuestas de Azure OpenAI como SSE. La clave de Azure permanece en Secret Manager.

## Requisitos

- Proyecto Firebase en plan compatible con Cloud Functions v2.
- Firebase CLI autenticado.
- Recurso Azure OpenAI con un deployment compatible.
- Anonymous Authentication habilitado en Firebase.

## 1. Seleccionar proyecto Firebase

Desde la raíz del repositorio:

```bash
firebase login
firebase use --add
```

## 2. Configurar secreto

```bash
firebase functions:secrets:set AZURE_OPENAI_API_KEY
```

Pega la clave únicamente cuando Firebase CLI la solicite. No la guardes en `.env`, documentación, historial del shell ni variables `EXPO_PUBLIC_*`.

## 3. Configurar parámetros

Crea un archivo local de entorno de Functions, usando `apps/functions/.env.example` como plantilla:

```env
AZURE_MODEL=gpt-5-mini
CHAT_MIN_INSTANCES=0
```

`CHAT_MIN_INSTANCES=0` evita cómputo inactivo durante desarrollo. Evalúa `1` en producción solo si el cold start incumple el objetivo de latencia y el costo es aceptable.

## 4. Compilar

```bash
npm install
npm install
npm run functions:build
```

## 5. Desplegar

```bash
firebase deploy --only functions
```

Firebase mostrará la URL HTTPS de `chatProxy`.

## 6. Configurar cliente

En el `.env` local de la aplicación:

```env
EXPO_PUBLIC_CHAT_PROXY_URL=https://chatproxy-xxxxxxxxxx-uc.a.run.app
```

Reinicia Expo CLI después del cambio.

## 7. Verificar

1. Entra desde Bienvenida con cuenta o modo local para crear/restaurar sesión Firebase.
2. Abre el chat.
3. Envía un mensaje no sensible.
4. Confirma respuesta progresiva por SSE.
5. Revisa logs sin registrar tokens ni contenido sensible:

```bash
firebase functions:log --only chatProxy
```

Flujo esperado:

```text
Aplicación → Firebase ID token → chatProxy → Azure OpenAI → SSE normalizado → aplicación
```

## Errores comunes

- `401`: falta sesión o token válido.
- `429`: límite por UID alcanzado; respeta `Retry-After`.
- `502`: Azure rechazó la solicitud o no respondió correctamente.
- `504`: timeout del proveedor.
- Sin URL en cliente: configura `EXPO_PUBLIC_CHAT_PROXY_URL` y reinicia Metro.

## Rollback

Revierte mediante control de versiones a una revisión verificada. No restaures backups locales ni cambies de proveedor sin una ADR y pruebas del contrato SSE.
