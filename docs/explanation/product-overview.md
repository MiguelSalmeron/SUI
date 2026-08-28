# Visión del producto Sui

Sui organiza bienestar y productividad móvil con cuatro áreas operativas:

1. **Inicio:** siguiente acción, progreso diario y agenda.
2. **Metas:** resultados finitos con fecha e hitos.
3. **Hábitos:** acciones recurrentes, frecuencia y constancia.
4. **Agenda:** fechas de metas, hábitos y eventos externos opcionales.

Metas y Hábitos son dominios distintos. Una meta termina al alcanzar un resultado; un hábito repite una acción. Pueden vincularse, nunca fusionarse.

Progreso es pantalla secundaria desde Inicio. Acción central Sui abre Chat sin cambiar tab. Chat acompaña con respuestas breves; no sustituye atención clínica.

## Entrada

Flujo para usuario nuevo:

```text
Bienvenida visual → cuenta opcional → Inicio vacío guiado
```

Bienvenida usa isologo, `Cultiva tu vida`, consentimiento 16+ y enlaces legales. No solicita carrera, personalidad, cronotipo, fecha de nacimiento ni Calendar. Tampoco crea ejemplos, XP o metas sin confirmación.

Inicio vacío explica diferencia entre Meta y Hábito y ofrece dos acciones independientes. Sui detecta idioma del sistema entre ES/EN; Ajustes permite cambiarlo.

## Cuenta y datos

Sui funciona sin cuenta. Invitado guarda productividad local y advierte riesgo al desinstalar. Cuenta por correo, Google o Apple activa respaldo cloud. Correo debe verificarse antes de sincronizar.

Acceder a cuenta existente con datos locales exige decisión explícita: combinar, usar datos de cuenta o cancelar. Ninguna fuente se elimina antes de completar operación.

Productividad lee/escribe local primero. Outbox persistente sincroniza documentos por entidad cuando existe cuenta verificada. Chat permanece local 48 horas y no entra en Firestore.

## Conexiones

Google Calendar es permiso separado de Google Sign-In. Se solicita desde Ajustes o CTA contextual de Agenda. Integración v1 es sólo lectura; OAuth usa Authorization Code + PKCE y refresh token exclusivo del backend.

## Lanzamiento

Primera entrega: público 16+, ES/EN y países aprobados por configuración. Cada mercado requiere Términos, Privacidad y recursos de crisis verificados. Ambientes Firebase/EAS: development, staging y production.

Detalles: [arquitectura](architecture.md), [privacidad y crisis](privacy-and-crisis.md), [rollout productivo](../how-to/production-rollout.md).
