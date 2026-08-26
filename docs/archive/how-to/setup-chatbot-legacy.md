# Setup — Módulo Chatbot IA (SUI)

Pasos manuales para poner en marcha lo que ya quedó implementado en código.

## 1. OpenRouter
1. Crear cuenta en https://openrouter.ai y generar una API Key.
2. (Opcional) Cargar saldo mínimo.

## 2. Firebase (Plan Blaze)
1. Activar plan **Blaze** (requerido para Cloud Functions v2).
2. Habilitar **Authentication > Anónimo** (ya usado por el onboarding).

## 3. Cloud Function `chatProxy`
```bash
firebase login
firebase use <tu-project-id>          # crea .firebaserc

# Guardar el API key como secreto (NO va en el bundle):
firebase functions:secrets:set OPENROUTER_API_KEY

# (Opcional) parámetros no secretos:
cp functions/.env.example functions/.env   # ajustar OPENROUTER_MODEL si quieres

# Desplegar:
firebase deploy --only functions
```
Copiar la URL que imprime el deploy a `EXPO_PUBLIC_CHAT_PROXY_URL` en `.env`
(raíz del proyecto). Formato:
`https://<region>-<project-id>.cloudfunctions.net/chatProxy`

## 4. Diccionario de crisis (config dinámica)
> El SDK JS de Firebase no soporta Remote Config en React Native, así que se
> usa un documento de Firestore como fuente dinámica (con respaldo offline
> empaquetado en `src/services/crisisConfig.ts`).

1. En Firestore crear el documento **`app_config/crisis`**.
2. Pegar el contenido de `work/crisis_config.json` (ajustar `contacts` al país).
3. Regla de lectura mínima (Firestore Rules):
```
match /app_config/{doc} {
  allow read: if request.auth != null;
  allow write: if false; // solo desde consola/admin
}
```

## 5. Probar
```bash
npm start
```
- Pantalla Home → botón **"Hablar con SUI"**.
- El historial se guarda solo en el dispositivo y caduca a las 48h.
- Escribir una palabra del diccionario dispara el **EmergencyOverlay**.

## Archivos creados
- `functions/` — proxy seguro `chatProxy` (SSE streaming).
- `src/types/chat.ts`, `src/store/useChatStore.ts`, `src/services/chatPrompt.ts`
- `src/services/crisisConfig.ts`, `src/services/crisisDetection.ts`
- `src/services/chatStream.ts`
- `src/components/chat/*`, `src/screens/ChatScreen.tsx`
