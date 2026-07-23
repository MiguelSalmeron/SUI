# Guía de Configuración: Firebase & Firestore 📁🔥

Esta guía cubre el proceso detallado para conectar tu aplicación móvil SUI-2 con los servicios de Firebase en la nube. El correcto seguimiento de estos pasos habilitará el **registro anónimo en segundo plano**, la **sincronización automática de metas y hábitos** y el **diccionario dinámico del protocolo de crisis**.

---

## 🏗️ Paso 1: Inicialización del Proyecto en Firebase

1.  Ve a la consola web de [Firebase Console](https://console.firebase.google.com/).
2.  Pulsa en **"Agregar proyecto"** y asígnale un nombre representativo (ej. `SUI-App`).
3.  Desactiva o activa Google Analytics según tu preferencia (no es obligatorio para desarrollo) y crea el proyecto.

---

## 🔒 Paso 2: Habilitación de la Autenticación Anónima

SUI-2 utiliza un flujo de onboarding sin fricción basado en inicios de sesión silenciosos y anónimos. Para habilitarlo:

1.  En el menú lateral de tu consola de Firebase, navega a **Build (Construcción) > Authentication**.
2.  Haz clic en la pestaña **Sign-in method (Método de inicio de sesión)**.
3.  Pulsa en **"Agregar nuevo proveedor"** y selecciona **Anónimo (Anonymous)**.
4.  Activa el interruptor y pulsa en **"Guardar"**.

> ⚠️ **Importante:** Si omites este paso, el onboarding de la aplicación móvil fallará al intentar registrar el usuario con `auth/operation-not-allowed`, limitando la sincronización en la nube.

---

## 🗄️ Paso 3: Configuración de la Base de Datos Cloud Firestore

1.  En el menú lateral, ve a **Build > Firestore Database**.
2.  Haz clic en **"Crear base de datos"**.
3.  Elige la ubicación física del servidor más cercana a tus usuarios (ej. `us-central1`).
4.  Selecciona iniciar en **Modo de Prueba** (para facilitar el desarrollo inicial) o **Modo de Producción**.
5.  Haz clic en **"Habilitar"**.

### Reglas de Seguridad de Firestore (Crítico)
Para que tus datos estén blindados y ningún usuario pueda leer ni escribir en el progreso de otro, navega a la pestaña **Rules (Reglas)** de Firestore y reemplaza las reglas existentes con el siguiente esquema de restricción granular:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Cada usuario solo puede leer y escribir sus propios documentos
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    
    // Reglas para el diccionario dinámico del protocolo de crisis
    match /app_config/crisis {
      allow read: if request.auth != null;
      allow write: if false; // Modificable únicamente desde la consola de administración
    }
  }
}
```
Haz clic en **"Publicar"** para guardar los cambios.

---

## 🚨 Paso 4: Creación del Diccionario de Crisis en Firestore

Para evitar recompilar la aplicación móvil cada vez que desees cambiar un número telefónico o agregar palabras de alarma en el protocolo preventivo de salud mental, SUI-2 sincroniza esta configuración en tiempo real desde Firestore:

1.  En la consola de Firestore, haz clic en **"Iniciar colección"**.
2.  En el campo de ID de colección, ingresa: `app_config` y haz clic en Siguiente.
3.  En el campo de ID de documento, ingresa exactamente: `crisis`.
4.  Agrega los siguientes campos con sus correspondientes tipos y valores (puedes tomar como plantilla el archivo de referencia [docs/reference/crisis_config.json](../reference/api-and-theme.md)):
    *   `version` (Number): `1`
    *   `title` (String): `No estás solo/a`
    *   `message` (String): `Lo que sientes importa y mereces ayuda ahora mismo. Hablar con alguien puede aliviar el peso. Por favor contacta a una línea de apoyo o a una persona de confianza de inmediato.`
    *   `keywords` (Array of Strings):
        *   `suicidio`, `suicidarme`, `quiero morir`, `me quiero morir`, `matarme`, `quitarme la vida`, `acabar con todo`, `no quiero vivir`, `no quiero seguir`, `hacerme dano`, `lastimarme`, `autolesion`, `cortarme` (puedes añadir más).
    *   `contacts` (Array of Objects):
        *   Objeto 0: `label` (String) = `Emergencias`, `phone` (String) = `911`
        *   Objeto 1: `label` (String) = `Cruz Roja`, `phone` (String) = `128`

---

## 🔑 Paso 5: Registro de la App Web y Configuración del Móvil

Para obtener las llaves de acceso de tu servidor de Firebase y colocarlas en el celular:

1.  En la página de inicio del proyecto en Firebase Console, haz clic en el ícono de Web (`</>`).
2.  Registra la app con el nombre `sui-web-client` (no es necesario activar Firebase Hosting).
3.  Firebase te mostrará un bloque de código JSON con tu `firebaseConfig`. Copia estos valores.
4.  Abre tu archivo `.env` en la raíz de tu proyecto móvil SUI-2 y actualízalo:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=tu_apiKey_de_firebase
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_authDomain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu_projectId
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storageBucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messagingSenderId
EXPO_PUBLIC_FIREBASE_APP_ID=tu_appId
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=tu_measurementId
```

---

### 🎉 Siguientes Pasos
¡Tu base de datos Firebase y autenticación silenciosa están listas!
*   *Siguiente paso:* Despliega el Proxy Seguro de la IA en la nube leyendo la guía [Despliegue de Firebase Cloud Functions & Proxy de Chat](deploy-chat-proxy.md).
