# Guía del Desarrollador - Sui-2 💻

Esta guía profundiza en la estructura técnica del proyecto y los procesos recomendados para desarrollo, testeo y compilación.

## 📂 Estructura Arquitectónica

```bash
/src
├── components/home/ # ComponentesUI especializados (Listas, Navbar, Pomodoro)
├── config/          # Instanciación de Firebase (auth, db)
├── context/         # AuthContext: Estado global del usuario autenticado
├── navigation/      # AppNavigator: Rutas protegidas vs públicas
├── screens/         # Pantallas principales (Home, Login, Register)
└── theme/           # theme.ts: Tokens globales de color y espaciado
```

## 🔄 Flujo de Datos y Estado
* **Autenticación (Nube):** Manejada 100% por Firebase Auth en `/context/AuthContext.tsx`. Controla si el usuario ve las pantallas de sesión o el dashboard.
* **Datos de Productividad (Local):** Los hábitos, metas y configuraciones del temporizador se guardan en el almacenamiento del dispositivo usando `AsyncStorage` (`sui-home-state-v4`). 
* *Nota de arquitectura:* Las mutaciones de estado de los ítems de productividad ocurren en `HomeScreen.tsx` y se hidratan en los componentes hijos mediante props.

## 🎨 Guía de Estilos (`theme.ts`)
Para mantener coherencia visual, **nunca uses códigos hexadecimales sueltos en los componentes**. Utiliza el objeto `COLORS` exportado de `theme.ts`:
* `COLORS.primary`: Botones principales, brand principal.
* `COLORS.secondary`: Acentos y estados activos alternativos.
* `COLORS.background`: Fondos generales de pantalla.

---

## 🐞 Workflow Avanzado de Pruebas y Depuración

El desarrollo móvil eficiente con Expo requiere entender cómo funciona el "Fast Refresh" y la depuración USB.

### Configuración para Depuración USB (Android)
1. Ve a **Ajustes > Acerca del teléfono**.
2. Toca 7 veces el **Número de compilación** para activar el modo de desarrollador.
3. Ve a las **Opciones de desarrollador** recién activadas.
4. Enciende **Depuración por USB**.
5. Conecta el teléfono y autoriza la huella RSA de la computadora.

### Uso y Logs (`console.log`)
Al correr `npx expo start --android` con el cable USB conectado:
* Los `console.log()`, `console.warn()` o errores de Javascript que ocurran en tu celular se imprimirán directamente **en la terminal de tu computadora**.
* Si la app lanza un error de pantalla roja en el teléfono, puedes recargar manualmente agitando el dispositivo para abrir el menú de desarrollo de Expo y seleccionando "Reload".

---

## 📦 Workflow de Producción (Generar Instalables con EAS)

Expo Application Services (EAS) se utiliza para empaquetar la app.

### 1. Configuración Inicial (Solo una vez)
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### 2. Generar el APK para compartir (.apk)
Por defecto, Android requiere formato `.aab` para la Play Store. Para generar un `.apk` directo que puedas compartir por WhatsApp/Drive:
```bash
eas build --platform android --profile preview
```
Al finalizar, EAS CLI arrojará un código QR y un enlace directo a la nube de Expo para descargar el archivo.

### 3. Generar para iOS
*Requiere cuenta de Apple Developer de pago ($99/año).*
```bash
eas build --platform ios
```