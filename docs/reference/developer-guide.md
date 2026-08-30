# Guía del desarrollador

## Requisitos

- Node.js `>=22.13 <25`, compatible con Expo SDK 57. `.nvmrc` fija `22.13.1`.
- npm.
- Android Studio o un dispositivo con Expo Go para desarrollo móvil.
- Firebase CLI para emuladores y despliegues.
- EAS CLI para builds administrados.

## Comandos

| Comando                     | Uso                                                     |
| --------------------------- | ------------------------------------------------------- |
| `npm start`                 | Iniciar Expo                                            |
| `npm run android`           | Ejecutar build Android local                            |
| `npm run ios`               | Ejecutar build iOS local                                |
| `npm run web`               | Ejecutar versión web                                    |
| `npm run export:web`        | Exportar web a `dist`                                   |
| `npm run lint`              | Ejecutar ESLint sin warnings                            |
| `npm run format:changed`    | Comprobar Prettier sólo en archivos cambiados           |
| `npm run architecture`      | Validar límites AST e impedir literales tipográficos    |
| `npm run architecture:test` | Probar violaciones arquitectónicas controladas          |
| `npm run dead-code`         | Detectar archivos, dependencias y unlisted con Knip     |
| `npm run deps:check`        | Validar versiones compatibles con Expo                  |
| `npm run audit:prod`        | Fallar por vulnerabilidades high/critical de producción |
| `npm run check:production`  | Validar variables obligatorias de release               |
| `npm run typecheck`         | Validar TypeScript móvil                                |
| `npm test`                  | Ejecutar tests unitarios                                |
| `npm run functions:build`   | Compilar Cloud Functions                                |
| `npm run functions:test`    | Compilar y probar Cloud Functions                       |
| `npm run test:sync`         | Probar convergencia v8 contra Firestore Emulator        |
| `npm run test:rules`        | Probar reglas y sync con Firestore Emulator             |
| `npm run check`             | Ejecutar todas las verificaciones                       |

## Convenciones de código

### Ubicación

- Composición global y navegación: `src/application`.
- Código específico de producto: `src/features/<feature>`.
- Código usado por varias funcionalidades: `src/shared`.
- Código exclusivo del backend: `functions/src`.

### Imports

Expo resuelve el alias `@/` mediante `tsconfig.json`.

```typescript
import { useAppTheme } from '@/shared/theme/theme';
import { ChatScreen } from '@/features/chat/public';
import type { RootStackParamList } from '@/shared/navigation/types';
```

Cada funcionalidad tiene `public.ts`. `application` y otras funcionalidades sólo
pueden consumir esa API pública. Dentro de la misma funcionalidad, usa imports
relativos. `shared` nunca importa funcionalidades o `application`.

Después de modificar aliases, reinicia Expo CLI.

### Componentes

- Pantallas: orquestación, navegación y composición.
- Componentes privados: dentro de la funcionalidad propietaria.
- Primitivas reutilizables sin lógica de negocio: `src/shared/ui`.
- Estilos: junto al componente cuando solo pertenecen a él.

### Estado y dominio

- Estado local de una funcionalidad: dentro de su módulo.
- Preferencias globales: `src/shared/preferences`.
- Productividad compartida por metas, hábitos y calendario: `src/shared/domain/productivity`.
- Integraciones externas compartidas: `src/shared/infrastructure`.

## Añadir una funcionalidad

1. Crea una carpeta bajo `src/features`.
2. Añade solo las subcarpetas necesarias: `screens`, `components`, `hooks`, `model`, `services`, `store`, `types`.
3. Coloca los tests junto al módulo probado en `__tests__`.
4. Crea `public.ts` y expón el mínimo necesario a consumidores externos.
5. No muevas código a `shared` hasta que sea realmente utilizado por varias funcionalidades.
6. Ejecuta `npm run check`.

## Persistencia

- Entrada/cuenta: Zustand persistido en AsyncStorage, sin perfil obligatorio.
- Chat: AsyncStorage con TTL de 48 horas; no se sincroniza a Firestore.
- Productividad: repositorio v8, respaldo v7 read-only, outbox y Firestore por entidad.
- Google Calendar: eventos normalizados en caché local; tokens sólo en backend.

Consulta [API, persistencia y tema](api-and-theme.md) para claves y estructuras.

## Cloud Functions

`functions/src/index.ts` registra Chat, conexiones Calendar y eliminación de cuenta. App Check inicia en monitor; producción migra a enforcement tras verificar clientes.

Cliente y CI usan Node 22. Functions conserva runtime Node 20; cambiar runtime de
deploy queda fuera de este hardening.

Antes de desplegar:

```bash
npm run functions:build
firebase deploy --only functions
```

La clave `AZURE_OPENAI_API_KEY` debe existir en Secret Manager. Consulta [despliegue del proxy](../how-to/deploy-chat-proxy.md).

## Builds Android

### EAS

```bash
eas build --platform android --profile staging
```

### Gradle local

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

## Criterios para pull requests

- Sin secretos ni artefactos generados.
- Sin cambios de comportamiento ocultos dentro de movimientos estructurales.
- Imports y documentación actualizados.
- Tests nuevos para reglas de negocio nuevas.
- `npm run check` aprobado.
- `npm run format:changed` aprobado contra base/head del PR.
- Sin imports profundos entre funcionalidades.

## Documentación

Actualiza el tipo correcto:

- Tutorial: aprendizaje guiado.
- How-to: tarea concreta.
- Reference: datos exactos y contratos.
- Explanation: decisiones y conceptos.
- ADR: decisión arquitectónica con consecuencias.

Producto y UI se actualizan sólo en [PRD](../product/PRD.md) y
[sistema de diseño](../product/DESIGN_SYSTEM.md); evita crear planes paralelos.
