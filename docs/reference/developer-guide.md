# Guía del desarrollador

## Requisitos

- Node.js compatible con Expo SDK 56.
- npm.
- Android Studio o un dispositivo con Expo Go para desarrollo móvil.
- Firebase CLI para emuladores y despliegues.
- EAS CLI para builds administrados.

## Comandos

| Comando | Uso |
|---|---|
| `npm start` | Iniciar Expo |
| `npm run android` | Ejecutar build Android local |
| `npm run ios` | Ejecutar build iOS local |
| `npm run web` | Ejecutar versión web |
| `npm run export:web` | Exportar web a `dist` |
| `npm run typecheck` | Validar TypeScript móvil |
| `npm test` | Ejecutar tests unitarios |
| `npm run functions:build` | Compilar Cloud Functions |
| `npm run functions:test` | Compilar y probar Cloud Functions |
| `npm run check` | Ejecutar todas las verificaciones |

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
import { useChatStore } from '@/features/chat/store/useChatStore';
```

Dentro de un mismo módulo se permiten imports relativos cortos. Evita barrels globales y rutas profundas hacia detalles privados de otra funcionalidad.

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
4. Expón el mínimo necesario a `src/application`.
5. No muevas código a `shared` hasta que sea realmente utilizado por varias funcionalidades.
6. Ejecuta `npm run check`.

## Persistencia

- Onboarding: Zustand persistido en AsyncStorage.
- Chat: AsyncStorage con TTL de 48 horas; no se sincroniza a Firestore.
- Productividad: AsyncStorage para carga inmediata y Firestore para respaldo.
- Google Calendar: token en memoria y eventos en caché local.

Consulta [API, persistencia y tema](api-and-theme.md) para claves y estructuras.

## Cloud Functions

`functions/src/index.ts` registra `chatProxy`. La lógica interna está separada bajo `functions/src/chat`.

Antes de desplegar:

```bash
npm run functions:build
firebase deploy --only functions
```

La clave `AZURE_OPENAI_API_KEY` debe existir en Secret Manager. Consulta [despliegue del proxy](../how-to/deploy-chat-proxy.md).

## Builds Android

### EAS

```bash
eas build --platform android --profile preview
```

### Gradle local

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

`patch-package` conserva el ajuste del plugin Gradle durante `npm install`.

## Criterios para pull requests

- Sin secretos ni artefactos generados.
- Sin cambios de comportamiento ocultos dentro de movimientos estructurales.
- Imports y documentación actualizados.
- Tests nuevos para reglas de negocio nuevas.
- `npm run check` aprobado.

## Documentación

Actualiza el tipo correcto:

- Tutorial: aprendizaje guiado.
- How-to: tarea concreta.
- Reference: datos exactos y contratos.
- Explanation: decisiones y conceptos.
- ADR: decisión arquitectónica con consecuencias.
