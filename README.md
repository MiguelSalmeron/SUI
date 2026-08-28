# Sui

Aplicación móvil de productividad y acompañamiento. Organiza metas finitas,
hábitos recurrentes, agenda y progreso con funcionamiento local-first, cuenta
opcional y respaldo cloud.

## Producto actual

- Bienvenida visual breve: cuenta, acceso o modo local.
- Inicio vacío guiado; cero datos sembrados.
- Metas y Hábitos separados, vinculables opcionalmente.
- Navegación: Inicio · Metas · Sui · Hábitos · Agenda.
- Chat local con TTL de 48 horas y protocolo de crisis por mercado/idioma.
- Cuenta por correo, Google y Apple iOS; verificación antes de sync.
- Repositorio local-first v7, outbox, tombstones y fusión explícita.
- Google Calendar opcional, sólo lectura, OAuth Code + PKCE.
- ES/EN, claro/oscuro, escala tipográfica y diseño móvil accesible.

- Fuente de producto: [PRD](docs/product/PRD.md).
- Fuente visual: [sistema de diseño](docs/product/DESIGN_SYSTEM.md).

## Stack

- Expo SDK 57, React Native 0.86, React 19, TypeScript.
- React Navigation 7.
- Zustand + AsyncStorage.
- Firebase Auth, Firestore, App Check y Cloud Functions v2.
- Azure OpenAI mediante proxy SSE autenticado.
- Jest, Firebase Emulator Suite y EAS.

## Desarrollo

```bash
npm install
cp .env.example .env
npm run web
```

Variables `EXPO_PUBLIC_*` pueden entrar en bundle; nunca contienen secretos.
Consulta [configuración cloud](docs/how-to/complete-cloud-configuration.md).

## Calidad

```bash
npm run check
npm run export:web
npx expo-doctor
```

`npm run check` valida arquitectura, config productiva, TypeScript, unit tests,
Functions y reglas Firestore.

## Arquitectura

```text
src/
├── application/        # bootstrap y navegación
├── features/           # auth, onboarding, home, goals, habits, calendar, chat
└── shared/             # tema, UI, i18n, cuenta, repositorio, Firebase

functions/src/
├── account/            # eliminación completa
├── chat/               # proxy, validación, rate limit, SSE
├── connections/        # OAuth Calendar backend-only
└── http/               # CORS y App Check
```

Reglas: `application` compone; `features` depende de `shared`; `shared` nunca
depende de `features`. React Navigation permanece; no Expo Router.

## Ambientes

`development`, `staging`, `production` usan Firebase/EAS/OAuth separados.

```bash
eas build --platform android --profile staging
eas build --platform ios --profile staging
```

Release requiere legal ES/EN, mercado aprobado, crisis config, App Check,
observabilidad y matriz real. Consulta [rollout](docs/how-to/production-rollout.md).

## Documentación

- [Índice](docs/README.md)
- [PRD](docs/product/PRD.md)
- [Sistema de diseño](docs/product/DESIGN_SYSTEM.md)
- [Arquitectura](docs/explanation/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Guía de desarrollo](docs/reference/developer-guide.md)

## Seguridad

- Productividad invitada permanece local.
- Password sin verificar no sincroniza.
- Refresh tokens Calendar viven sólo en backend.
- Chat no entra en Firestore ni telemetría.
- Secretos viven en Secret Manager/EAS, nunca cliente o Git.

## Licencia

Consulta [LICENSE](LICENSE).
