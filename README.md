# SUI

Aplicación multiplataforma de productividad y bienestar para estudiantes. Combina metas, hábitos, calendario, gamificación y acompañamiento conversacional con IA bajo un enfoque offline-first.

## Capacidades principales

- Panel diario con progreso, XP, niveles y rachas.
- Gestión de metas, hitos y hábitos.
- Agenda unificada con Google Calendar en modo de solo lectura.
- Onboarding conversacional con sesión anónima de Firebase.
- Chat de acompañamiento con streaming SSE, historial local de 48 horas y protocolo de crisis.
- Resumen nocturno y notificaciones locales.
- Temas claro, oscuro y del sistema.

## Stack

- Expo SDK 56, React Native 0.85 y React 19.
- TypeScript estricto.
- React Navigation 7.
- Zustand y AsyncStorage.
- Firebase Authentication, Firestore, Hosting y Cloud Functions v2.
- Azure OpenAI Foundry mediante proxy autenticado.
- Jest y Testing Library.

## Inicio rápido

```bash
npm install
cp .env.example .env
npm start
```

Configura las variables públicas de Firebase, Google OAuth y la URL del proxy en `.env`. Nunca guardes secretos del proveedor de IA en la aplicación móvil.

## Verificación

```bash
npm run check
```

El comando ejecuta el typecheck de la aplicación, los tests unitarios y la compilación de Cloud Functions.

Comandos individuales:

```bash
npm run typecheck
npm test
npm run functions:build
npm run functions:test
```

## Arquitectura

El código móvil usa módulos orientados por funcionalidad:

```text
src/
├── application/                 # Bootstrap y navegación
├── features/                    # Auth, onboarding, chat, home, goals, habits, calendar, settings
└── shared/                      # UI, tema, Firebase, preferencias y dominio compartido
```

Cloud Functions mantiene un punto de entrada pequeño y módulos separados para autenticación, validación, rate limiting, Azure y streaming SSE.

Reglas de dependencia:

1. `application` compone funcionalidades.
2. `features` puede depender de `shared`.
3. `shared` no depende de `features`.
4. Componentes privados permanecen dentro de su funcionalidad.
5. Tests unitarios se colocan junto al módulo probado.

No se usa Expo Router. `src/application` evita reservar una carpeta de rutas basada en archivos.

## Documentación

- [Índice de documentación](docs/README.md)
- [Primeros pasos](docs/tutorials/getting-started.md)
- [Arquitectura](docs/explanation/architecture.md)
- [Chatbot](docs/explanation/chatbot.md)
- [Guía del desarrollador](docs/reference/developer-guide.md)
- [Configuración de Firebase](docs/how-to/firebase-config.md)
- [Despliegue del proxy de chat](docs/how-to/deploy-chat-proxy.md)
- [Roadmap](docs/roadmap.md)

## Builds

```bash
eas build --platform android --profile preview
```

Exportación web:

```bash
npm run export:web
firebase deploy --only hosting
```

## Seguridad

- `.env`, secretos de Functions y artefactos generados están ignorados por Git.
- `AZURE_OPENAI_API_KEY` vive en Firebase Secret Manager.
- El proxy exige un Firebase ID token válido antes de consumir IA.
- El historial del chat no se almacena en Firestore.

## Licencia

Consulta [LICENSE](LICENSE).
