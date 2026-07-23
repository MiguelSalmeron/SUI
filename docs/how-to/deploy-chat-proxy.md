# Despliegue del Proxy de Chat Seguro (Firebase Cloud Functions v2) ⚡🔑

Para evitar que tu API Key de OpenRouter quede expuesta dentro del código empaquetado de tu aplicación móvil (vulnerabilidad que permitiría que cualquiera te robe saldo o acceda a tu cuenta), SUI-2 implementa un proxy seguro utilizando **Firebase Cloud Functions v2**.

Esta guía cubre el paso a paso para configurar de forma segura la API Key en la nube, compilar el proxy de NodeJS e inicializar su endpoint de streaming.

---

## 📋 Requisitos de Infraestructura

1.  **OpenRouter:** Registra una cuenta en [OpenRouter.ai](https://openrouter.ai/) y genera una clave de API (`sk-or-...`). Puedes cargarle un saldo mínimo para desarrollo ($1–$2 de saldo de prueba).
2.  **Plan de Firebase:** Tu proyecto de Firebase debe estar bajo el plan **Blaze** (pago por consumo).
    *   *¿Por qué?* Google exige el plan Blaze para habilitar la ejecución de Cloud Functions v2 porque corren sobre Cloud Run.
    *   *Tranquilidad:* El plan Blaze tiene una capa gratuita extremadamente generosa de 2 millones de ejecuciones de funciones al mes. No gastarás nada durante la etapa de desarrollo de este MVP.

---

## 💻 Paso 1: Configurar el CLI de Firebase

1.  Instala de forma global la suite de herramientas CLI de Firebase si aún no lo has hecho:
    ```bash
    npm install -g firebase-tools
    ```
2.  Inicia sesión con tu cuenta de Google (debe ser la misma con la que creaste tu consola en Firebase):
    ```bash
    firebase login
    ```
3.  Vincúlate al proyecto. Desde la raíz de tu proyecto móvil SUI-2 (donde se encuentra el archivo `firebase.json`):
    ```bash
    firebase use --add
    ```
    Selecciona la ID del proyecto de Firebase que inicializaste en el paso anterior y asígnale un alias sencillo como `default` o `development`.

---

## 🔒 Paso 2: Inyección de Secretos en Secret Manager de GCP

Para que la Cloud Function pueda consumir OpenRouter sin versionar la clave de API en el código fuente, debemos inyectarla de forma encriptada en el administrador de secretos de Google Cloud Platform (Secret Manager) de tu proyecto:

```bash
firebase functions:secrets:set OPENROUTER_API_KEY
```

La consola te solicitará que pegues tu API key. Escribe tu clave secreta de OpenRouter (ej. `sk-or-v1-xxxxxx...`) y presiona Enter.

---

## 🏗️ Paso 3: Configuración y Compilación del Servidor

1.  Asegúrate de que tus dependencias de la carpeta del servidor estén correctamente instaladas:
    ```bash
    cd functions
    npm install
    ```
2.  (Opcional) Si deseas cambiar el modelo por defecto (`openai/gpt-4o-mini`), puedes crear un archivo `.env` en la subcarpeta `functions/` y ajustar la variable de entorno:
    ```env
    OPENROUTER_MODEL=anthropic/claude-3-haiku
    CHAT_MIN_INSTANCES=0
    ```
    *(Mantener `CHAT_MIN_INSTANCES` en `0` para desarrollo evita cargos de cómputo inactivo; en producción se puede subir a `1` para eliminar la latencia del primer arranque en frío).*

3.  Regresa a la raíz o ejecuta la compilación de TypeScript desde el subdirectorio:
    ```bash
    npm run build
    ```

---

## 🚀 Paso 4: Despliegue en la Nube

Una vez compilado TypeScript a JavaScript, dispara el despliegue automático del proxy a los servidores de Firebase:

```bash
# Ejecutar desde la raíz del proyecto SUI
firebase deploy --only functions
```

La consola procesará el empaquetado, configurará el Secret Manager de GCP y creará el microservicio de streaming. Al finalizar (puede demorar de 1 a 2 minutos), la terminal imprimirá un bloque con el estado del despliegue y una URL de endpoint de la función.

*Ejemplo de salida de consola:*
```bash
✔  deploy complete!

Project Console: https://console.firebase.google.com/project/tu-proyecto/overview
Function URL (chatProxy): https://chatproxy-xxxxxxxxxx-uc.a.run.app
```

---

## 📱 Paso 5: Enlazar la App Móvil con el Proxy de Chat

1.  Copia la URL provista por el CLI en el paso anterior (ej. `https://chatproxy-xxxxxxxxxx-uc.a.run.app`).
2.  Abre el archivo `.env` en la raíz de tu aplicación móvil.
3.  Actualiza la variable del proxy pegando la URL:
    ```env
    EXPO_PUBLIC_CHAT_PROXY_URL=https://chatproxy-xxxxxxxxxx-uc.a.run.app
    ```
4.  Reinicia tu servidor de Expo (`npx expo start`) o recarga la aplicación en tu celular para asegurar que se rehidraten las variables de entorno de Expo.

---

## 🔬 Verificación de Funcionamiento

1.  Abre la app, navega a la pestaña de **Overview (Inicio)** y presiona el botón de acción flotante **"Hablar con SUI"**.
2.  Escribe cualquier saludo empático.
3.  Si la app responde en menos de 3 segundos con efecto máquina de escribir, tu conexión **App Móvil (Zustand + SSE) ➔ Firebase (JWT Auth Proxy) ➔ OpenRouter** está 100% activa e integrada.
