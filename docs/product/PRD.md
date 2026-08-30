# PRD — Sui

- **Estado:** fuente canónica de producto
- **Versión:** 1.0
- **Actualizado:** 28 de agosto de 2026

## 1. Visión

Sui ayuda a convertir intención en acción diaria sin transformar productividad
en presión. Une metas, hábitos, agenda y acompañamiento conversacional en una
experiencia móvil clara, local-first y preparada para respaldo cloud opcional.

Promesa:

> Organiza lo importante, construye constancia y decide siguiente paso con
> calma.

Principios:

1. **Calma enfocada:** jerarquía clara, poco ruido, cero urgencia artificial.
2. **Acción inmediata:** dato local primero; ninguna pantalla espera red.
3. **Dominios claros:** Meta y Hábito pueden relacionarse, nunca confundirse.
4. **Cuenta opcional:** producto útil sin registro; cloud aporta respaldo.
5. **Confianza explícita:** permisos, fusiones y eliminaciones requieren contexto.
6. **Escala por configuración:** idiomas, mercados, crisis y conexiones crecen
   sin bifurcar producto.

## 2. Público y mercado

- Personas de 16 años o más.
- Lanzamiento inicial en español e inglés.
- Teléfono como superficie principal; tablet y web como superficies adaptadas.
- Publicación gradual sólo en países con Términos, Privacidad y recursos de
  crisis verificados.

Sui no diagnostica, trata ni sustituye atención profesional. Chat ofrece
acompañamiento breve y orientación general.

## 3. Problema

Herramientas separadas obligan a mantener metas, repeticiones y fechas en
lugares distintos. Otras soluciones añaden presión mediante rachas, exceso de
métricas o configuración inicial extensa. Sui debe ofrecer estructura suficiente
para actuar hoy sin exigir que usuario modele toda su vida antes de empezar.

## 4. Resultados esperados

### Usuario

- Entender diferencia entre Meta y Hábito.
- Crear primer elemento sin ejemplos impuestos.
- Ver siguiente acción y carga del día.
- Trabajar offline con respuesta inmediata.
- Activar respaldo sin perder datos locales.
- Conectar servicios externos sólo cuando aporten valor.

### Producto

- Tiempo hasta primera acción útil menor a 90 segundos.
- Inicio local útil en máximo 1.5 segundos.
- Cero pérdida silenciosa durante auth, sync o fusión.
- Cero escritura de productividad invitada en Firestore.
- Expansión ES/EN y nuevos mercados mediante config versionada.

Métricas nunca incluyen contenido de Chat, títulos de metas/hábitos, correo,
tokens ni cuerpos HTTP.

## 5. Arquitectura de información

```text
Bienvenida
├── Crear cuenta
├── Ya tengo cuenta
└── Continuar sin cuenta
    ↓
Inicio · Metas · [Sui] · Hábitos · Agenda
  │       │                 │        └── Conectar Calendar, contextual
  │       └── Meta finita    └── Acción recurrente
  ├── Progreso
  └── Avatar → Ajustes → Cuenta · Conexiones · Preferencias
```

Cuatro tabs reales: `Overview`, `Goals`, `Habits`, `Calendar`. Acción central
Sui abre Chat en stack y conserva tab anterior. Progreso es detalle secundario
desde Inicio.

## 6. Requisitos funcionales

### 6.1 Entrada

- Bienvenida visual breve con isologo principal, `Cultiva tu vida` y mosaico
  abstracto de capacidades.
- Confirmación “Tengo al menos 16 años”. Guardar versión/fecha de política; no
  guardar edad.
- Acciones: crear cuenta, acceder, continuar local.
- Términos y Privacidad configurables por ambiente/mercado.
- Sin preguntas de carrera, personalidad, cronotipo u objetivos obligatorios.
- Sin carga simulada, premios iniciales, metas o hábitos sembrados.

### 6.2 Inicio vacío

- Explicar Meta = resultado finito; Hábito = acción recurrente.
- Mostrar CTA independientes: `Crear primera meta` y `Añadir primer hábito`.
- No crear datos antes de confirmación.

### 6.3 Metas

- Crear, editar, completar/reabrir y eliminar con confirmación.
- Fecha, progreso, importancia e hitos.
- Separar activas/completadas.
- Vínculo opcional desde Hábito sin mezclar modelos.

### 6.4 Hábitos

- Crear, editar, completar diario, proteger racha y eliminar.
- Frecuencia semanal y racha.
- Contextos `Hoy` y `Mis hábitos`.
- Vínculo opcional con Meta.

### 6.5 Agenda

- Mes lunes–domingo, selección de fecha, indicadores discretos.
- Unificar metas, hábitos y eventos externos normalizados.
- Crear entrega para fecha seleccionada.
- Google Calendar sólo lectura; conexión contextual o desde Ajustes.

### 6.6 Progreso

- Nivel, XP, racha, insight semanal, gráfica, métricas y logros.
- Pantalla secundaria; no ocupa tab.
- Gamificación reconoce avance; no bloquea funciones ni castiga inactividad.

### 6.7 Chat Sui

- Pantalla completa, respuestas breves, streaming SSE.
- Historial local con TTL de 48 horas; nunca sincronizado.
- Protocolo de crisis por país/idioma.
- Sin contenido conversacional en logs o telemetría.

### 6.8 Cuenta y auth

- Modos: `local` y `registered`.
- Proveedores: correo/contraseña, Google, Apple iOS.
- Verificación de correo antes de sync.
- Recuperación/cambio de contraseña.
- Exportación, logout y eliminación completa.
- Logout limpia caché autenticada y crea espacio invitado separado.

### 6.9 Fusión

Con datos locales + cuenta existente:

1. `Combinar` — recomendada.
2. `Usar datos de la cuenta` — confirmación explícita.
3. `Cancelar` — mantiene estado local.

Ninguna fuente se elimina antes de completar operación.

### 6.10 Conexiones

- Identidad Google separada de permiso Google Calendar.
- OAuth Authorization Code + PKCE.
- Refresh token exclusivo de backend.
- Caché local sólo con eventos normalizados.
- Desconectar revoca acceso y elimina caché.
- Contrato `ConnectionProvider` permite futuros adaptadores.

## 7. Datos y sincronización

- Lectura/escritura local inmediata.
- Storage versionado con migraciones idempotentes.
- Outbox persistente e IDs estables.
- Metadata por entidad: versión servidor, dispositivo, timestamps, fingerprint,
  mutation ID y tombstone.
- Operaciones idempotentes.
- Primer commit CAS válido en servidor gana; mutación stale recibe estado autoritativo.
- Tombstones permanecen 90 días; compactación incrementa `syncEpoch` y fuerza bootstrap.
- Cambio pendiente local nunca se sobrescribe silenciosamente.
- Invitado técnico puede usar Chat/APIs autorizadas, no escribir productividad
  en Firestore.

Colecciones cloud:

```text
users/{uid}
users/{uid}/goals/{goalId}
users/{uid}/habits/{habitId}
users/{uid}/snapshots/{date}
users/{uid}/connections/{provider}  # backend-only
```

## 8. Requisitos no funcionales

### Rendimiento

- UI local útil ≤1.5 s.
- Tabs con carga diferida.
- Listas/calendario memoizados donde aporte valor.
- Ninguna espera artificial.

### Accesibilidad

- Texto normal AA `4.5:1`; texto grande/controles `3:1`.
- Tamaño táctil 44 dp objetivo.
- Roles, etiquetas y estados accesibles.
- Pequeño/Mediano/Grande + escala nativa sin truncar acciones.
- Matriz 320/375/430 dp, tablet, web, claro/oscuro.

### Seguridad y privacidad

- Firebase Auth + reglas por propietario.
- Cuenta password no verificada permanece local.
- CORS allowlist, rate limits y App Check gradual.
- Secretos sólo backend/Secret Manager.
- Sentry sin PII ni cuerpos HTTP.
- Eliminación de cuenta recursiva y revocación de conexiones.

### Operación global

- Ambientes `development`, `staging`, `production` aislados.
- ES/EN completo: UI, errores, fechas, correo y legal.
- Mercado activado sólo por allowlist revisada.
- Crisis config versionada por `{country}-{locale}`.

## 9. Fuera de alcance v1

- Outlook y Apple Calendar.
- Escritura hacia calendarios externos.
- Sincronizar historial de Chat.
- Red social, equipos, feed o competencia pública.
- Menores de 16 años o consentimiento parental.
- Diagnóstico clínico o intervención de emergencia automatizada.
- IA creando productividad sin confirmación.

## 10. Criterios de release

- `npm run check`, `npm run export:web`, `expo-doctor` sin fallos.
- Auth/fusión probados en dispositivo real.
- Sync probado entre dos dispositivos, offline, reconexión y tombstones.
- Reglas Emulator Suite niegan invitado, acceso cruzado y documentos inválidos.
- Calendar probado: conectar, renovar, revocar, desconectar, caché offline.
- Legal ES/EN publicado; recursos de crisis verificados.
- App Check monitor validado antes de enforcement.
- Builds EAS staging Android/iOS aprobados.
- Rollout gradual con crash/auth/sync health estable.

## 11. Fuentes relacionadas

- [Sistema de diseño](DESIGN_SYSTEM.md)
- [Arquitectura](../explanation/architecture.md)
- [Privacidad y crisis](../explanation/privacy-and-crisis.md)
- [Rollout productivo](../how-to/production-rollout.md)
- [Roadmap](../roadmap.md)
