<div align="center">

![SUI Brand](apps/mobile/assets/brand/sui-isologo.svg)

# SUI

### Cultiva tu vida

Organiza metas, hábitos, agenda y acompañamiento en una sola app.
Modelo híbrido de datos. Sin presión innecesaria.

[![Version](https://img.shields.io/badge/version-1.0.0-0B132B?style=for-the-badge&labelColor=0B132B&color=218ECE)](#)
[![Platform](https://img.shields.io/badge/Android%20%7C%20iOS%20%7C%20Web-0B132B?style=for-the-badge&labelColor=0B132B&color=55796F)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-0B132B?style=for-the-badge&labelColor=0B132B&color=E87536)](LICENSE)

</div>

---

## ¿Qué es SUI?

SUI es una app móvil de productividad y acompañamiento personal. Su propuesta es clara: ayudar a transformar intención en acción diaria sin convertir la productividad en presión.

> **Organiza lo importante, construye constancia y decide tu siguiente paso con calma.**

SUI está pensada para personas de **18 años o más** que quieren organizar metas, hábitos y agenda en un solo lugar, con una experiencia **hibrida** donde los datos viven tanto en el dispositivo como en la nube de forma coordinada.

Lo más importante:

- **No es solo una lista de tareas.**
- **No es un coach genérico.**
- **No depende de que estés conectado todo el tiempo.**

SUI funciona como un espacio propio: datos locales disponibles al instante y sincronización con la nube cuando el usuario lo activa.

---

## ¿Cómo está construida su arquitectura?

SUI está diseñada con una arquitectura **mobile-first** y un modelo de datos **híbrido**, pensada para que la experiencia sea útil desde el primer segundo, sin importar el estado de la conexión.

### Principios que guían la app

1. **Modelo híbrido.**
   Datos locales y nube en pie de igualdad. El usuario decide cuándo sincronizar.
2. **Cuenta opcional.**
   Se puede empezar sin registro y activar sincronización después.
3. **Experiencia continua.**
   Lecturas, escrituras y navegación deben sentirse inmediatas.
4. **Dominios claros.**
   Metas, hábitos, agenda y chat conviven, pero no se mezclan de forma confusa.
5. **Seguridad y confianza.**
   La app está pensada para manejar datos personales con cuidado y transparencia.

### Bloques principales de la app

#### 1. Datos híbridos

SUI guarda datos en el dispositivo y los sincroniza con la nube cuando el usuario lo decide.

Esto significa:

- las pantallas funcionan sin red,
- la sincronización mantiene todo al día en múltiples dispositivos,
- el usuario conserva control sobre sus datos.

#### 2. Productividad

SUI separa con claridad:

- **Metas**, que son resultados finitos,
- **Hábitos**, que son acciones recurrentes,
- **Agenda**, que representa el tiempo y los eventos.

Además, ofrece un circuito de **progreso** con:

- nivel,
- XP,
- racha,
- gráfica semanal,
- logros,
- reporte nocturno.

La gamificación está pensada para reconocer avance, **no para castigar**.

#### 3. Acompañamiento conversacional

SUI incluye un chat orientativo:

- respuestas breves,
- streaming,
- historial local con expiración,
- protocolo de crisis por país o idioma.

El chat **no reemplaza atención profesional ni servicio de emergencia**, pero sirve como acompañamiento de uso general.

#### 4. Sincronización

Cuando el usuario lo activa, SUI sincroniza datos con la nube mediante:

- outbox local,
- pull incremental,
- reconciliación de conflictos,
- compactación por epoch,
- estado autoritativo del servidor.

#### 5. Seguridad y operación

El backend y la app están pensados para:

- authentication,
- validación,
- límites de uso,
- eliminación de cuenta,
- conexiones externas controladas.

---

## ¿Qué tecnologías usa SUI?

SUI combina un stack moderno de apps móviles con servicios cloud para sincronización, autenticación, conexiones y asistencia conversacional.

### Stack móvil

- **React Native** + **Expo** — base mobile-first multiplataforma
- **TypeScript** — fiabilidad y mantenibilidad
- **React 19** — interfaz declarativa moderna
- **React Navigation** — navegación móvil madura
- **Zustand** — estado ligero y predecible
- **AsyncStorage** — persistencia local
- **Firebase JS SDK** — auth, storage y reglas
- **expo-notifications** — notificaciones push
- **expo-font** — tipografía personalizada
- **expo-localization** — i18n ES/EN
- **expo-secure-store** — almacenamiento seguro
- **react-native-svg** — gráficos e iconografía
- **react-native-sse** — streaming en tiempo real
- **Sentry** — observabilidad y monitoreo de errores

### Plataformas objetivo

- **Android** — adaptive icon, splash screen, status bar configurada
- **iOS** — Apple Sign-In, tablet soportado
- **Web** — superficie adaptada para escritorio

### Backend y servicios

- **Firebase Auth** — correo, Google, Apple iOS, invitado
- **Firestore** — base de datos con reglas por propietario
- **Firebase App Check** — protección de endpoints
- **Cloud Functions v2** — backend en Node.js 20
- **Google Calendar API** — solo lectura, OAuth PKCE
- **Azure OpenAI** — chat vía proxy backend con SSE
- **CORS controlado** — allowlist de orígenes
- **Rate limiting** — protección por usuario
- **Secret Manager** — credenciales fuera del cliente

### Herramientas de calidad y distribución

- **EAS** — builds y distribución para Android/iOS
- **Jest** — testing unitario
- **Firebase Emulator Suite** — desarrollo local
- **ESLint** + **Prettier** — código consistente
- **Knip** — detección de código muerto
- **GitHub Actions** — CI automático

> React Native + Expo + TypeScript en cliente. Firebase en servicios. Cloud Functions para sincronización, calendarización, seguridad y chat.

---

## Características

### Productividad real sin ruido

SUI está pensada para mostrar siguiente acción y carga del día sin saturar.

### Metas y hábitos separados

No es lo mismo una meta finita que un hábito recurrente. SUI mantiene ambos dominios con claridad.

### Agenda unificada

Puedes ver metas, hábitos y eventos externos en una sola vista de calendario.

### Chat con límites claros

Acompañamiento conversacional breve, con:

- streaming en tiempo real,
- historial local expirable,
- protocolo de crisis por país o idioma.

### Conexiones externas opcionales

Google Calendar es un ejemplo de integración pensada como complemento, no como requisito.

### Progreso visible

SUI muestra:

- nivel y XP,
- racha diaria,
- gráfica de los últimos 7 días,
- logros desbloqueables,
- reporte nocturno con IA.

### Modelo híbrido de datos

Los datos viven tanto en el dispositivo como en la nube. El usuario controla cuándo sincronizar.

### Fusión de datos

Cuando se conecta una cuenta, SUI permite:

- combinar datos locales y de la cuenta,
- usar solo los datos de la cuenta,
- o cancelar el proceso.

Nada se elimina automáticamente.

### Privacidad y seguridad

SUI aplica:

- autenticación por usuario,
- reglas de acceso en backend,
- validación de datos,
- eliminación completa de cuenta,
- conexiones con secrets solo en servidor.

---

## Captura de pantalla de la app

<div align="center">

> _[Insertar aquí captura real de la app: inicio, metas, hábitos, agenda o chat]_

</div>

---

## Configuración automática de Android

SUI incluye configuración nativa para Android enfocada en que la app se vea y se sienta lista desde la primera instalación.

- **Adaptive icon** con primer plano, fondo y versión monocromática
- **Status bar** configurada con color y estilo coherentes
- **Splash screen** con imagen y color de marca
- **Package** `com.sui.app`
- **Portrait** como orientación por defecto
- **Expo autolinking** para dependencias nativas

> SUI no solo es funcionalmente una app; también llega con la capa de configuración nativa necesaria para comportarse como app real en Android.

---

## Contribuciones

SUI tiene una estructura orientada a producto y calidad. Acepta contribuciones responsables.

### Recomendaciones

- mantener la separación entre dominios de producto,
- no mezclar UI con lógica de sincronización,
- respetar la arquitectura feature-first,
- proponer cambios pequeños y enfocados,
- probar en móvil antes de proponer cambios visuales amplios,
- describir claramente el problema que se resuelve.

### Buenas prácticas

- una tarea por PR,
- descripción clara del cambio,
- evidencia de prueba cuando aplique,
- respeto por el modelo híbrido de datos,
- cuidado con datos sensibles y permisos.

---

## Recopilación de datos y privacidad

SUI está pensada con un enfoque de **privacidad por diseño**.

### Principio central

> El producto debe ser útil antes de pedir cuenta, y la nube solo debe aportar valor cuando el usuario lo elige.

### Esto implica en la práctica

- modo local sin cuenta obligatoria,
- chat con historial local expirable,
- eliminación completa de cuenta,
- conexiones externas opcionales,
- secretos y credenciales fuera del cliente,
- reglas y validación en backend.

### Lo que SUI no incluye

- rastreo oculto,
- telemetría con contenido sensible,
- sincronización automática del chat como contenido persistente,
- recopilación innecesaria para funcionar.

> SUI no es un servicio de emergencia ni un reemplazo de atención profesional.

El protocolo de crisis está pensado para orientación y derivación, no para diagnóstico ni intervención automatizada.

Si se publica en tiendas, la política de privacidad y los términos deben estar disponibles y claros.

---

## Descargo de responsabilidad

SUI es una herramienta de productividad y acompañamiento de uso general.

**No está diseñada para:**

- diagnosticar,
- tratar,
- curar,
- prevenir ninguna condición médica o psicológica,
- sustituir atención profesional,
- actuar como sistema de emergencia.

Las funciones de chat son **orientativas** y están limitadas por un protocolo de crisis por país o idioma.

El usuario es responsable de:

- su uso de la app,
- sus decisiones personales,
- buscar atención profesional cuando la necesite,
- interpretar la información de forma adecuada.

SUI puede fallar, quedar offline, requerir mantenimiento o no cubrir todos los casos posibles.

> **Ante situaciones de riesgo, contacta servicios de emergencia o profesionales competentes.**

---

## Licencia y directrices

### Licencia

Consulta el archivo [LICENSE](LICENSE) del proyecto.

### Directrices de uso

SUI es una app real con responsabilidad sobre:

- privacidad,
- datos personales,
- integridad del usuario,
- uso responsable de IA,
- publicación en tiendas.

Usa la app de forma legal y responsable. No la depender como único recurso en emergencias. Respeta los límites del chat, los términos y la privacidad de otros usuarios.

---

## Agradecimiento

SUI se apoya en un ecosistema técnico sólido y en herramientas que hacen posible una app moderna, estable y mantenible.

- **React Native / Expo** — base mobile-first multiplataforma
- **Firebase** — autenticación, storage, reglas y Cloud Functions
- **TypeScript** — fiabilidad y mantenibilidad
- **Zustand** — simplicidad de estado
- **React Navigation** — navegación móvil madura
- **Sentry** — observabilidad
- **Google Calendar API** — conexión externa opcional
- **Azure OpenAI** — asistencia conversacional vía backend
- Toda la comunidad open-source que sostiene herramientas fundamentales para apps actuales

---

<div align="center">

**SUI** — Cultiva tu vida

</div>
