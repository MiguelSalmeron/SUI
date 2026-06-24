# SUI — Configuración de Firebase y APIs Pendientes

Esta guía contiene la lista de tareas para conectar tu aplicación móvil y el servidor con los servicios reales en la nube (Firebase y OpenRouter). Actualmente, la app utiliza credenciales de ejemplo y fallará al conectarse a la red.

---

## 📋 Lista de Tareas por Completar

### Paso 1: Configurar Proyecto en la Consola de Firebase
1. [ ] Ir a [Firebase Console](https://console.firebase.google.com/) y pulsar **Agregar proyecto** (nómbralo `sui-app` o como gustes).
2. [ ] Ir a **Build > Authentication** -> pestaña **Sign-in method** -> pulsar **Agregar nuevo proveedor** -> seleccionar **Anónimo** y activarlo.
3. [ ] Ir a **Build > Firestore Database** -> pulsar **Crear base de datos** -> seleccionar reglas en *modo de prueba* (para desarrollo) y elegir región cercana.

### Paso 2: Registrar la Web App y actualizar el archivo `.env` en Móvil
1. [ ] En la página de inicio del proyecto de Firebase, pulsar el ícono de web (`</>`) para registrar una app. Nómbrala `sui-web-client`.
2. [ ] Copiar las llaves provistas (apiKey, authDomain, projectId, etc.).
3. [ ] Abrir el archivo `.env` en la raíz de tu proyecto móvil SUI y reemplazar los valores de ejemplo por los tuyos:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=TU_API_KEY_REAL
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=TU_PROJECT_ID.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=TU_PROJECT_ID
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=TU_PROJECT_ID.firebasestorage.app
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=TU_MESSAGING_SENDER_ID
   EXPO_PUBLIC_FIREBASE_APP_ID=TU_APP_ID
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=TU_MEASUREMENT_ID
   ```

### Paso 3: Configurar el Servidor (Firebase Cloud Functions)
1. [ ] Obtener una API Key de [OpenRouter](https://openrouter.ai/) (para que la IA de SUI pueda responder).
2. [ ] En la terminal de tu computadora, asegúrate de tener instalado Firebase CLI globalmente:
   ```bash
   npm install -g firebase-tools
   ```
3. [ ] Iniciar sesión en la herramienta CLI:
   ```bash
   firebase login
   ```
4. [ ] Vincular el CLI con tu proyecto (ve a la carpeta raíz `/SIU` donde está `firebase.json`):
   ```bash
   firebase use --add
   ```
   *(Selecciona el ID del proyecto que creaste en el Paso 1)*.
5. [ ] Configurar de forma segura la API Key de OpenRouter dentro de Firebase Secret Manager:
   ```bash
   firebase functions:secrets:set OPENROUTER_API_KEY=tu_api_key_de_openrouter_aqui
   ```
6. [ ] (Opcional) Si quieres cambiar el modelo de IA o configurar instancias mínimas para evitar latencia, puedes definir variables en `functions/.env` o usar los valores predeterminados (usa `openai/gpt-4o-mini`).
7. [ ] Desplegar la función proxy a la nube:
   ```bash
   firebase deploy --only functions
   ```

### Paso 4: Vincular la App con la Cloud Function desplegada
1. [ ] Al finalizar el despliegue en el Paso 3, la terminal imprimirá una URL para `chatProxy`.
   *Ejemplo: `https://chatproxy-xxxxxxxxxx-uc.a.run.app`*
2. [ ] Copiar esa URL.
3. [ ] Pegarla en tu archivo `.env` de la aplicación móvil:
   ```env
   EXPO_PUBLIC_CHAT_PROXY_URL=https://tu_url_de_funcion_desplegada_aqui
   ```

---

## 🛠️ Comprobación de que todo funciona
* [ ] Abre la aplicación en tu celular sin cables.
* [ ] Completa el onboarding de SUI. Si pasa a la pantalla de "Inicio" sin dar alertas de error, el **Login Anónimo** funciona correctamente.
* [ ] Ve a la sección de hábitos, completa un hábito y recarga. Si se mantiene guardado, **Cloud Firestore** sincroniza bien.
* [ ] Ve al chat e inicia una conversación, o toca el botón **"Ver resumen del día 🌙"**. Si el bot te responde con empatía en pocos segundos, la **Cloud Function + OpenRouter** están 100% activos y enlazados.
