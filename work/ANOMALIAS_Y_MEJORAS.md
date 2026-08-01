# 🔍 Auditoría — Anomalías Técnicas & Hoja de Ruta

> Proyecto SUI · Julio 2026
> Propósito: Consolidar hallazgos de seguridad, bugs en producción y áreas de mejora identificadas en auditoría de código.

---

## 🚨 Prioridad 1: Bot caído en APK producción

### Síntoma
Usuarios de APKs compiladas (release) no reciben respuesta del chatbot de IA. La app muestra error o el bot simplemente no responde.

### Diagnóstico

**✅ Cloud Function `chatProxy` está operativa:**
```
GET https://chatproxy-lfp3e2qxvq-uc.a.run.app → 405 (esperado, solo POST)
```
La función responde. No es caída del servidor ni error de deploy.

**❌ Causa raíz más probable: Variables de entorno no inyectadas en el bundle de producción.**

La cadena de dependencia:
```
.env (disco local del desarrollador)
  → EXPO_PUBLIC_CHAT_PROXY_URL
    → chatStream.ts:16 — const PROXY_URL = process.env.EXPO_PUBLIC_CHAT_PROXY_URL
      → streamChat() chequea !PROXY_URL → error "Falta configurar EXPO_PUBLIC_CHAT_PROXY_URL"
```

Expo SDK 56 inyecta `process.env.EXPO_PUBLIC_*` en el bundle JS **solo si el archivo `.env` está presente en la máquina que ejecuta el build**.

| Escenario de build | ¿Funciona? | Por qué |
|---|---|---|
| `expo start` (dev, local) | ✅ | Expo lee `.env` automáticamente |
| `expo run:android` (dev build, local) | ✅ | Expo lee `.env` automáticamente |
| `eas build` (build en nube) | ❌ | **No existe `eas.json`**. El servidor EAS no tiene las env vars |
| `cd android && ./gradlew assembleRelease` (build local standalone) | ❌ | Se salta el bundler de Expo → no hay reemplazo de `process.env.*` |

### Evidencia
1. **No existe `eas.json`** en la raíz del proyecto. La documentación (`GUIA-DESARROLLADOR.md:170`) indica `eas build --platform android --profile preview`, pero ese perfil no está definido en ninguna configuración.
2. `chatStream.ts:36-41` tiene manejo explícito del caso `!PROXY_URL` — muestra mensaje: *"Falta configurar EXPO_PUBLIC_CHAT_PROXY_URL"*.
3. Misma vulnerabilidad aplica a `EXPO_PUBLIC_FIREBASE_*` → Firebase sin configurar → `auth.currentUser === null` → error *"Sesión no válida"*.

### Solución

Crear `eas.json` en la raíz con las env vars en los perfiles de build:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_FIREBASE_API_KEY": "AIzaSyCGaNv9HPiUs7cbDD3TRN37rXDn2N-gy4g",
        "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "xsui-nica.firebaseapp.com",
        "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "xsui-nica",
        "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET": "xsui-nica.firebasestorage.app",
        "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "332610869067",
        "EXPO_PUBLIC_FIREBASE_APP_ID": "1:332610869067:web:0c4d76ded3ad584ce8bace",
        "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID": "G-NB5YPWELDZ",
        "EXPO_PUBLIC_CHAT_PROXY_URL": "https://chatproxy-lfp3e2qxvq-uc.a.run.app"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_FIREBASE_API_KEY": "AIzaSyCGaNv9HPiUs7cbDD3TRN37rXDn2N-gy4g",
        "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "xsui-nica.firebaseapp.com",
        "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "xsui-nica",
        "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET": "xsui-nica.firebasestorage.app",
        "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "332610869067",
        "EXPO_PUBLIC_FIREBASE_APP_ID": "1:332610869067:web:0c4d76ded3ad584ce8bace",
        "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID": "G-NB5YPWELDZ",
        "EXPO_PUBLIC_CHAT_PROXY_URL": "https://chatproxy-lfp3e2qxvq-uc.a.run.app"
      }
    }
  }
}
```

**Alternativa**: Usar EAS Secrets para no hardcodear credenciales en el archivo:
```bash
eas secret:create --name EXPO_PUBLIC_CHAT_PROXY_URL --value "https://chatproxy-lfp3e2qxvq-uc.a.run.app"
```

### Verificación
```bash
adb logcat | grep -i "chat\|proxy\|EXPO_PUBLIC\|Falta configurar"
```

---

## 🚨 Prioridad 2: Secrets en repo — Historial Git

### Hallazgo
Se verificó el historial completo de git (`git log --all -- .env functions/.env*`).

| Archivo | ¿En historial git? | Riesgo |
|---|---|---|
| `.env` (raíz) | **NO** — gitignored, nunca en historial ✅ | Bajo — solo en disco local |
| `functions/.env` | **NO** — pero **NO está en `.gitignore`** ⚠️ | Medio — riesgo futuro si alguien hace `git add -A` |
| `functions/.env.example` | **SÍ** — en HEAD | ✅ Solo contiene `OPENROUTER_MODEL` placeholder |
| `functions/.env.xsui-nica` | **SÍ** — en HEAD | ✅ Solo contiene `AZURE_MODEL=gpt-5-mini`, sin secretos |
| `functions/.env.xsui-nica.azure-backup-*` | **SÍ** — en HEAD | ✅ Solo modelo OpenRouter placeholder |
| `functions/index.ts.azure-backup-*` | **SÍ** — en HEAD | ✅ Código fuente, sin API keys |

**Conclusión: No hay credenciales live en el historial git.** Firebase API keys y Azure OpenAI key **no están comprometidas** por git.

### Acciones pendientes
1. Agregar `functions/.env` y `*.azure-backup*` al `.gitignore` de raíz para prevenir leaks futuros.
2. Limpiar archivos backup del repo: `functions/index.ts.azure-backup-*`, `functions/.env.xsui-nica.azure-backup-*`.
3. Confirmar que `.env` de raíz sigue en `.gitignore` (ya lo está).

---

## 🟡 Prioridad 3: Tipado `any` en código producción

### Hallazgo
El README declara "código sin `any`", pero hay **10 violaciones** en archivos de producción:

| Archivo | Línea | Uso de `any` |
|---|---|---|
| `LoginScreen.tsx` | 33, 48, 69 | `error: any`, `navigation: any` |
| `RegisterScreen.tsx` | 41, 56, 79 | `error: any`, `navigation: any` |
| `SettingsScreen.tsx` | 176 | `navigation: any` |
| `db.ts` | 6, 7 | `goals: any[]`, `habits: any[]` |
| `TabNavigator.tsx` | 91 | `useNavigation<any>()` |

### Impacto
- `db.ts` usa `any[]` cuando existen modelos `Goal` y `Habit` en `src/types/models.ts` — desaprovecha TypeScript.
- `navigation: any` en screens pierde autocompletado y type checking de rutas/params.

### Acción
Tipar correctamente:
- **Screens**: Usar `NativeStackNavigationProp<RootStackParamList>` desde `@react-navigation/native-stack`.
- **db.ts**: Reemplazar `any[]` con `Goal[]` / `Habit[]`.
- **Errores Firebase**: Usar `FirebaseError` de `firebase`.

---

## 🟡 Prioridad 4: Configuración stale

### Hallazgo
- `functions/.env.example` referencia `OPENROUTER_MODEL=openai/gpt-4o-mini` — obsoleto desde migración a Azure (jul 2026).
- Comentario en `functions/src/index.ts:5` dice "OpenRouter chat completions API" — la implementación real llama a Azure.
- Backups (`*.azure-backup-*`) en repo — contaminan el tree.

### Acción
- Actualizar `.env.example` con las variables Azure reales: `AZURE_MODEL=gpt-5-mini`, `CHAT_MIN_INSTANCES=0`.
- Corregir comentario en `index.ts:5` → "Azure OpenAI".
- Eliminar archivos backup del repo.

---

## 🟡 Prioridad 5: Rate limiting sin enforce server-side

### Hallazgo
Firestore tiene colección `rate_limits/{uid}` pero solo es lectura/escritura desde el cliente. La Cloud Function `chatProxy` **no valida rate limits** antes de llamar a Azure OpenAI.

### Acción
En `chatProxy` (`functions/src/index.ts`), antes de la llamada upstream:
1. Leer `rate_limits/{uid}` desde Admin SDK.
2. Si excede el límite, responder `429 Too Many Requests`.
3. Actualizar contador tras cada request exitoso.

---

## 🟢 Prioridad 6: Sin crash reporting

### Hallazgo
No hay Sentry ni Firebase Crashlytics. Los errores en producción son invisibles.

### Acción (opcional)
Integrar **Sentry** (`@sentry/react-native`) o **Firebase Crashlytics** para monitoreo de errores en producción.

---

## 🟢 Prioridad 7: Tests insuficientes

### Hallazgo
Solo 6 archivos de test (397 líneas total), todos en servicios puros:

| Archivo | Lines |
|---|---|
| `chatPrompt.test.ts` | 69 |
| `crisisDetection.test.ts` | 41 |
| `gamification.test.ts` | 95 |
| `homeStorage.test.ts` | 89 |
| `notifications.test.ts` | 83 |
| `PomodoroPanel.test.tsx` | 20 |

**Cero tests para**: stores Zustand (6), navegación, screens, AuthContext, chatStream, db service, Cloud Function.

### Acción
Priorizar tests para:
1. Stores (lógica de negocio más crítica)
2. `chatStream.ts` (punto de falla en producción)
3. Cloud Function `chatProxy` (tests de integración)

---

## 🟢 Prioridad 8: Nomenclatura inconsistente

### Hallazgo
El proyecto usa 4 nombres distintos según el contexto:

| Contexto | Nombre |
|---|---|
| Carpeta raíz | `SIU` |
| npm name | `sui` |
| README/docs | "SUI" (antes "Sui-2") |
| Firebase alias | `xsui-nica` |

### Acción
Estandarizar a **SUI** en todos lados. Renombrar carpeta raíz de `SIU` a `sui` si es factible.

---

## 📋 Resumen de acciones

| # | Prioridad | Tarea | Esfuerzo |
|---|---|---|---|
| 1 | 🔴 Crítico | Crear `eas.json` con env vars para builds producción | 15 min |
| 2 | 🔴 Crítico | Agregar `functions/.env` y `*.azure-backup*` a `.gitignore` | 5 min |
| 3 | 🔴 Crítico | Limpiar backups del repo (`git rm`) | 5 min |
| 4 | 🟡 Medio | Tipar `any` en screens + db.ts | 45 min |
| 5 | 🟡 Medio | Limpiar config stale (`.env.example`, comentarios) | 10 min |
| 6 | 🟡 Medio | Enforce rate limiting en `chatProxy` | 1-2 h |
| 7 | 🟢 Bajo | Integrar crash reporting (Sentry) | 2-3 h |
| 8 | 🟢 Bajo | Expandir cobertura de tests | 4-8 h |
| 9 | 🟢 Bajo | Estandarizar nomenclatura SUI | 30 min |

**Prioridad semanal sugerida:** 1 → 2+3 → 4 → 5
