# Sui — Estado y cierre de jornada

- **Estado del proyecto:** listo para cierre de jornada; G0/G1/G2 integrados y verificados.
- **Actualizado:** lunes 5 de octubre de 2026.
- **Ámbito:** documento operativo de estado. No redefine producto ni alcance.
- **Fuentes canónicas:** [PRD](product/PRD.md) define producto, [sistema de diseño](product/DESIGN_SYSTEM.md) define interfaz, [arquitectura](explanation/architecture.md) define límites, [roadmap](roadmap.md) define gates.
- **Regla de la jornada:** solo documentación. Sin Wave 3, sin features nuevas, sin refactors, sin tocar persistencia/CAS/syncEpoch/schedulers, sin push y sin borrar stashes.

---

## 1. Estado al cierre

- `main` integrado con **G1 + G2**; árbol de trabajo limpio.
- Base estable `demo-o1` (G1). Cierre de G2 con tag local **`demo-o2` → `c953831`**.
- Todo local: **sin push** (`main` está 8 commits por delante de `origin/main`).
- Checks completos en verde, incluido `npm run check` de extremo a extremo (emulador Firestore incluido).
- Verificación real en **Android (G0)**: onboarding, persistencia local/reapertura, navegación, Pomodoro y Chat operativos; Engagement y Accountability permanecen ocultos en la build demo.
- Configuración sensible (EAS/OAuth/Sentry) **preservada en stashes**, intacta y sin aplicar.

## 2. Qué quedó implementado

### G0 — Verificación real en Android

- Onboarding completo OK.
- Persistencia local y reapertura OK.
- Navegación OK.
- Pomodoro OK.
- Chat OK.
- Engagement y Accountability ocultos OK.

### G1 — Base estable (`demo-o1` = `732db80`)

- **B1** (`b83b4bd`): guarda el objetivo de enfoque y un historial corto por día.
- **A1** (`25eace8`): plan del día determinístico (`buildDayPlan`) y completar sin deshacer.
- **E1** (`732db80`): explica el estado de los datos en Ajustes y agrega el aviso de regreso.
- Commits de soporte: contratos de enfoque (`bd6464a`), perfil demo aislado (`3df4bd5`), siembra diferida hasta tener uid (`89d4342`).

### G2 — Integración A2 + B2 (`demo-o2` = `c953831`)

**A2 (`706d2d9`) — autoridad visual de Home:**

- `TodayPlanCard` reemplaza la tarjeta antigua “SIGUIENTE”.
- Título “Tu plan de hoy”, apoyado en `buildDayPlan` real.
- Hasta 3 pasos según el modelo.
- Contexto por paso: título, “Paso de {meta}” / Meta / Hábito, `reasonKey`.
- Badges de vencimiento (`dueToday` / `dueTomorrow` / `dueSoon` / `overdue`).
- “Enfocar” en el primer paso; tocar un paso abre su edición.
- Empty state “Hoy no hay nada pendiente” + Nueva meta + Sesión libre.
- `ResumeNudge` conectado al primer paso.
- Empty state de primera vez sin datos conservado.

**B2 (`c953831`) — autoridad de lógica Focus/Pomodoro:**

- Módulo compartido `shared/focus/focusFlow.ts` (`sameFocusTarget`, `timelineItemToFocusTarget`, `nextFocusTarget`).
- Pomodoro recibe `FocusTarget` por `route.params.target`.
- Muestra el contexto del foco: título y meta madre (`resolveFocusTarget`), con fallback seguro para sesión libre o paso ausente.
- Target persistido en el store (sobrevive cerrar/reabrir).
- `completeSession` existente; **no** autocompleta el target.
- Completar es explícito con `completeFocusTarget` (“Marcar paso como listo”).
- Siguiente paso lógico (`nextFocusTarget`) o volver a Hoy.
- Protección contra doble completado (dominio idempotente).

### Resolución de conflictos (A2 + B2)

- `OverviewScreen.tsx`: se conservó **A2** (visual de Home). Los cambios de B2 en ese archivo pertenecían a la tarjeta “SIGUIENTE”, que no se restaura; el `FocusTarget` ya lo aporta `buildDayPlan`.
- `messages/home.ts`: auto-fusión coherente; paridad ES/EN exacta, sin claves duplicadas.
- Se retiró `OverviewFocusAction.test.tsx` (probaba la UI eliminada); su cobertura quedó en `OverviewScreen.test.tsx`.

## 3. Flujo principal actual

```text
Hoy
 → plan de hasta 3 pasos (buildDayPlan, sin reordenar ni duplicar scoring)
 → Enfocar (respeta sesión activa; conserva target persistido)
 → Pomodoro contextual (objetivo + meta madre)
 → terminar sesión (se registra en historial; NO autocompleta el paso)
 → “Marcar paso como listo” (completeFocusTarget, guarda contra doble toque)
 → siguiente paso (nextFocusTarget) / volver a Hoy
 → Hoy refleja el estado actualizado
```

## 4. Validaciones realizadas

Checks finales (todos PASS):

| Check                             | Resultado                        |
| --------------------------------- | -------------------------------- |
| mobile typecheck                  | PASS                             |
| mobile tests                      | **88 suites / 590 tests** PASS   |
| architecture                      | PASS (303 archivos, 12 features) |
| architecture:test                 | 12/12 PASS                       |
| lint (`--max-warnings=0`)         | PASS                             |
| dead-code (knip)                  | PASS                             |
| deps:check (expo install --check) | PASS                             |
| format                            | PASS                             |
| `git diff --check`                | PASS                             |
| `npm run check` completo          | PASS                             |
| Firestore rules (emulador)        | 5/5 PASS                         |
| sync emulator                     | 8/8 PASS                         |

- Casos obligatorios del flujo cubiertos por tests verdes: hábito, meta con hito, meta sin hito, calendario/sesión libre, sesión ya activa, target persistido tras reapertura, doble toque, plan vacío y ResumeNudge.
- Nota: en `@sui/functions` aparece 1 test **SKIP** (requiere emulador) con `fail 0`; ese caso se ejecuta aparte en `test:sync` (8/8 PASS).

## 5. Pendientes para mañana, por prioridad

1. **Google OAuth Android / producción.**
2. **Play App Signing SHA-1.**
3. Crear/verificar OAuth Android Client para la firma de Play.
4. **Restaurar de forma controlada** la configuración EAS/OAuth preservada.
5. Revisar los stashes antes de tocarlos:
   - `stash@{0}`: `eas.json` + `SENTRY_DISABLE_AUTO_UPLOAD`.
   - `stash@{1}`: `eas.json` + Google Web/Android IDs + Sentry.
   - **No borrar ni aplicar a ciegas.**
6. Preparar profile `production`.
7. Generar AAB para Play beta.
8. Probar login Google real.
9. Probar cloud sync / offline / reconnect.
10. Smoke test final.
11. Preparar datos y recorrido de demo del Hackathon.

## 6. Riesgos para el Hackathon

- **OAuth Android en producción sin cerrar:** bloquea login Google real y, con él, la demo de cuenta/cloud. Es el riesgo principal.
- **Cadena de firma Play (App Signing SHA-1 / OAuth Android Client):** si no coincide, el login falla en builds de Play aunque funcione en local.
- **Configuración EAS/OAuth en stashes:** restaurarla mal o aplicarla a ciegas puede romper la build demo o filtrar secretos. Debe hacerse de forma controlada y verificada.
- **Cloud sync/offline/reconnect sin probar aún:** el respaldo cloud es opcional en producto, pero resta confianza en la demo si se muestra.
- **Tiempo:** quedan dos días efectivos (martes/miércoles) antes del checklist del jueves; la demo y sus datos deben prepararse con antelación, no a último momento.
- **Sin push:** todo el avance está local; un cierre sin push es aceptable para la jornada, pero hay que decidir cuándo publicar.

## 7. Plan de martes

1. Resolver **Google OAuth Android / producción** y **Play App Signing SHA-1**.
2. Crear/verificar el **OAuth Android Client** para la firma de Play.
3. **Restaurar controladamente** EAS/OAuth desde los stashes, verificando cada cambio y sin borrarlos.
4. Preparar el profile `production` y generar el **AAB** para Play beta.
5. Probar **login Google real** en la build resultante.
6. Probar **cloud sync / offline / reconnect**.

## 8. Plan de miércoles

1. **Smoke test final** de la app (recorrido completo del flujo principal).
2. Preparar **datos y recorrido de demo** del Hackathon.
3. Ensayar la secuencia de demo: onboarding → Hoy → plan de hoy → Enfocar → Pomodoro contextual → marcar paso listo → siguiente paso.
4. Congelar la build/versión de demo y registrar su identificador.
5. Cierre de deuda no bloqueante si el tiempo lo permite (ver más abajo).

## 9. Checklist previo al jueves

- [ ] OAuth Android / producción operativo.
- [ ] SHA-1 de Play App Signing verificado.
- [ ] OAuth Android Client de firma Play creado/verificado.
- [ ] Config EAS/OAuth restaurada de forma controlada (stashes intactos).
- [ ] Profile `production` listo.
- [ ] AAB generado para Play beta.
- [ ] Login Google real probado.
- [ ] Cloud sync / offline / reconnect probado.
- [ ] Smoke test final en verde.
- [ ] Datos y recorrido de demo preparados.
- [ ] Decisión tomada sobre push/publicación.
- [ ] Deuda no bloqueante revisada (no obligatoria para la demo).
- [ ] Confirmado: sin Wave 3, sin features nuevas, sin refactors.

## 10. Git state

- **HEAD:** `c953831` — `feat(focus): conecta el plan de Hoy con sesiones y siguiente paso`.
- **Tags:**
  - `demo-baseline`
  - `demo-o1` → G1 (`732db80`)
  - `demo-o2` → G2 (`c953831`)
- **Stashes (intactos, no aplicar ni borrar a ciegas):**
  - `stash@{0}`: `On demo/a1-day-plan: pendiente A1: Sentry demo fuera de G1`
  - `stash@{1}`: `On main: pendiente: OAuth y Sentry demo fuera de G1`
- **Branches relevantes:**
  - `main` → `c953831` (8 commits por delante de `origin/main`)
  - `demo/a1-day-plan` → `25eace8` (worktree A1)
  - `demo/a2-today-flow` → `706d2d9` (worktree A2)
  - `demo/b1-pomodoro-store` → `b83b4bd` (worktree B1)
  - `demo/b2-focus-flow` → `c953831` (worktree B2)
  - `demo/e1-account-status` → `732db80` (worktree E1)
  - `respaldo/detached-d1da9be` → `2438343`
- **Remotos:** sin push.

## 11. Deuda no bloqueante

- `home.focus` posiblemente sin uso tras retirar la tarjeta antigua de Home.
- `timelineItemToFocusTarget` / `nextFocusTarget` permanecen en la API compartida, cubiertas principalmente por tests.
- Warning histórico de Jest por _open handles_: si reaparece, no bloquea mientras los tests estén verdes.

## 12. Noche del 5 al 6 de octubre (sin commit)

HEAD sigue en `c953831` (`demo-o2`). Encima hay trabajo local sin commitear. No está probado en el teléfono.

- **Wave 2.5:** el paso 2 ya no abre en `00:00`; una meta sin hitos no muestra "Marcar paso"; la celebración se ve sobre Pomodoro; el plan ya no copia los minutos globales de Pomodoro.
- **Rediseño visual** (plan en `product/REDISENO_VISUAL.md`, ese archivo describe el diseño, no el estado): barra flotante, tarjeta del plan, progreso, Pomodoro con anillo, bruma, halo más tenue y sombras más suaves.
- **Duración por paso:** la preferencia global (25) queda aparte. El paso usa su bloque (15, 25 o 50). "Duración para este paso" no cambia la preferencia. Para una demo corta, ese ajuste se hace después de Enfocar.
- **Chat, corte 1** (plan en `product/CHAT_CONVERSACION.md`): cápsula, espera honesta, burbuja, copiar, detener, reintentar, borrador en `sui-chat-draft-v1`. Dependencia nueva: `expo-clipboard`. Los tres huecos (carrera al detener, cursor al salir, háptico doble) quedaron corregidos. Tests del chat en verde. No se corrió `npm run check` de raíz después de esto.
- **`eas.json`:** tiene client IDs de Google y `SENTRY_DISABLE_AUTO_UPLOAD` en el perfil demo. No mezclarlo en el commit del producto. Ver ADR-0009.

Mañana: probar en Android el flujo Hoy, Enfocar, sesión, marcar, siguiente, y el chat. Si se ve bien, commitear en partes (producto, rediseño, chat). `eas.json` va aparte.

## 13. No hacer

- Wave 3.
- Features nuevas.
- Refactors.
- SQLite.
- Cambios de persistencia.
- CAS / `syncEpoch`.
- Schedulers.
- Push.
- Borrar stashes.
