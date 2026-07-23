# SUI — Configuración de Firebase y Azure Foundry Pendientes

Esta guía contiene el checklist para conectar la aplicación móvil y el servidor (Cloud Functions) con los servicios reales en la nube. Hasta completarla, la app usa credenciales de ejemplo y fallará al contactar la red.

> **Nota** (jul 2026): el chatbot migró de OpenRouter a **Azure OpenAI Foundry** (modelo `gpt-5-mini`) vía Azure for Students. Esta guía refleja el stack actual. Si en algún momento quieres reverter a OpenRouter, en `CHATBOT-IA.md` → "Rollback" está el procedimiento.

---

## 📋 Lista de Tareas por Completar

### Paso 1: Configurar el proyecto en Firebase Console
1. [ ] Ir a [Firebase Console](https://console.firebase.google.com/) y pulsar **Agregar proyecto** (nómbralo como gustes; el alias interno del repo es `xsui-nica`).
2. [ ] Ir a **Build > Authentication** → pestaña **Sign-in method** → pulsar **Agregar nuevo proveedor** → seleccionar **Anónimo** y activarlo. Sin esto el onboarding solo completa en local.
3. [ ] Ir a **Build > Firestore Database** → pulsar **Crear base de datos** → seleccionar reglas en *modo de prueba* (para desarrollo) y elegir región cercana. Las reglas en producción viven en `firestore.rules` del repo.
4. [ ] Crear el documento `app_config/crisis` con el diccionario de palabras críticas y los números de emergencia locales. Si no existe, el cliente usa `DEFAULT_CRISIS_CONFIG` como respaldo.

### Paso 2: Registrar la Web App y actualizar `.env` del móvil
1. [ ] En la página de inicio del proyecto de Firebase, pulsar el ícono web (`</>`) para registrar una app.
2. [ ] Copiar las llaves provistas (apiKey, authDomain, projectId, etc.).
3. [ ] Abrir el archivo `.env` en la raíz del proyecto móvil SUI y reemplazar los valores de ejemplo por los tuyos:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=TU_API_KEY_REAL
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=TU_PROJECT_ID.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=TU_PROJECT_ID
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=TU_PROJECT_ID.firebasestorage.app
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=TU_MESSAGING_SENDER_ID
   EXPO_PUBLIC_FIREBASE_APP_ID=TU_APP_ID
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=TU_MEASUREMENT_ID
   EXPO_PUBLIC_CHAT_PROXY_URL=https://tu_chatproxy.a.run.app
   ```

### Paso 3: Configurar Azure OpenAI Foundry
1. [ ] Crear un recurso **Azure OpenAI** (Cognitive Services) en el portal. El recurso actual del proyecto es `Raiz` (subscripción Azure for Students, proyecto `Raiz-lifeplants`).
2. [ ] Desplegar el modelo `gpt-5-mini` desde *Azure AI Foundry → Deployments*. Verificar la cuota TPM en *Usage + quotas* (actualmente 500 TPM → ~450 disponibles tras deploy).
3. [ ] Copiar la API Key del deployment (Azure Portal → recurso → *Keys and Endpoint*).

### Paso 4: Configurar el servidor (Firebase Cloud Functions)
1. [ ] Instalar Firebase CLI globalmente si no está:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. [ ] Vincular el CLI con tu proyecto (desde la raíz `/SIU` donde está `firebase.json`):
   ```bash
   firebase use --add
   ```
   *(Selecciona el ID del proyecto del Paso 1. El alias por defecto del repo es `xsui-nica`.)*
3. [ ] Guardar la API Key de Azure en Firebase Secret Manager (global, no se incluye en el bundle móvil):
   ```bash
   printf "TU_AZURE_OPENAI_API_KEY" | firebase functions:secrets:set AZURE_OPENAI_API_KEY
   firebase functions:secrets:access AZURE_OPENAI_API_KEY   # verificar
   ```
4. [ ] Configurar variables opcionales del runtime en `functions/.env.xsui-nica`:
   ```env
   AZURE_MODEL=gpt-5-mini
   CHAT_MIN_INSTANCES=0
   ```
5. [ ] Desplegar la función proxy:
   ```bash
   npm --prefix functions run build
   firebase deploy --only functions
   ```

### Paso 5: Vincular la app con la Cloud Function desplegada
1. [ ] Al finalizar el despliegue en el Paso 4, la terminal imprimirá una URL para `chatProxy`.
   *Ejemplo: `https://chatproxy-xxxxxxxxxx-uc.a.run.app`*
2. [ ] Copiar esa URL.
3. [ ] Pegarla en el `.env` de la app móvil como `EXPO_PUBLIC_CHAT_PROXY_URL` (ver Paso 2).

---

## 🛠️ Comprobación de que todo funciona
* [ ] Abre la app en tu celular sin cables.
* [ ] Completa el onboarding. Si pasa a la pantalla de **Inicio** sin alertas de error, el **Login Anónimo** funciona.
* [ ] Ve a la pestaña **Hábitos**, completa uno y recarga. Si se mantiene guardado al reabrir la app, **Cloud Firestore** sincroniza bien.
* [ ] Toca el botón flotante **"Hablar con SUI"** y envía un mensaje. Si el bot responde con empatía en pocos segundos (streaming visible), la **Cloud Function + Azure Foundry** están 100% activos.
* [ ] Espera a las 21:30 (o abre manualmente desde *Inicio → "Resumen nocturno con IA"*). Si aparece el modal con el resumen del día en streaming, el **Resumen Nocturno** está activo.
