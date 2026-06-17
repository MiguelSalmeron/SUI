# Resumen del Proyecto - Sui-2 📊

## 🎯 ¿Qué es y cuál es el propósito?
**Sui-2** es una aplicación orientada al bienestar personal y la productividad diaria. Ayuda al usuario a estructurar su día de manera eficiente integrando tres elementos fundamentales en un único flujo de trabajo:
1. **Metas:** Tareas puntuales del día (To-Do).
2. **Hábitos:** Acciones repetitivas para generar constancia.
3. **Pomodoro:** Bloques de trabajo y descanso enfocado, con una interfaz que minimiza distracciones mediante su "Modo Enfoque" (Pantalla completa).

## 🛠 Justificación del Stack Tecnológico

* **React Native + Expo SDK 56:** 
  * *¿Por qué?* Permite iteración rápida, desarrollo multiplataforma simultáneo (Android e iOS con el mismo código base) y no requiere lidiar con código nativo complejo. Es ideal para un MVP de productividad donde el diseño de UI es crucial.
* **Firebase (Authentication):**
  * *¿Por qué?* Proporciona un sistema de gestión de identidades robusto y seguro "out of the box", acelerando enormemente la implementación del login y el registro con validaciones automáticas.
* **AsyncStorage (Persistencia Local):**
  * *¿Por qué?* Actualmente garantiza un funcionamiento inmediato (zero-latency) y modo offline total, ya que guarda toda la data en el almacenamiento nativo del celular.

## 📈 Estado Actual y Limitaciones (Technical Debt)

La aplicación es un **MVP funcional**. Sin embargo, la estrategia de producto actual tiene ciertos compromisos:
1. **Temporizador Pomodoro:** La lógica de conteo del Pomodoro vive en la capa de Javascript de React Native. Si el usuario minimiza la aplicación por mucho tiempo o apaga la pantalla de su iOS/Android, el sistema operativo puede pausar el Javascript, deteniendo el contador.
2. **Aislamiento de Datos:** Al usar almacenamiento exclusivamente local, el usuario no cuenta con un "backup" de su progreso en la nube. Perder/Desinstalar la aplicación equivale a perder todo el registro de sus metas y configuración.

## 🗺️ Roadmap Sugerido (Próximos Pasos)

1. **Migración a Cloud Firestore:** Sincronizar el estado del dashboard (metas, hábitos) vinculando cada documento al `uid` del usuario de Firebase Auth.
2. **Background Execution:** Implementar módulos nativos (`expo-background-task` / `expo-notifications`) para asegurar que el temporizador Pomodoro pueda seguir corriendo e inclusive lanzar notificaciones cuando la sesión termine, aunque la app esté en segundo plano.
3. **Gestor de Estado Global:** Refactorizar `HomeScreen.tsx` para extraer la lógica a un Provider (`ProductivityContext`) o utilizar Zustand, para tener un código más escalable.