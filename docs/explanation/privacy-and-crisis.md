# Privacidad local-first y protocolo de crisis

Sui trata conversación y productividad como datos con perfiles distintos.
Productividad puede respaldarse bajo cuenta verificada; Chat permanece local y
temporal.

## Chat local

- Historial vive en AsyncStorage bajo `sui-chat-v1`.
- TTL: 48 horas (`CHAT_TTL_MS`).
- Rehidratación/envío ejecutan `pruneExpired`.
- Historial nunca se escribe en Firestore.
- Sólo ventana reciente necesaria viaja al proxy.
- Logs y telemetría excluyen mensajes, prompts, headers, tokens y cuerpos HTTP.

```text
Abrir/enviar → calcular límite 48 h → filtrar → persistir local
```

TTL reduce retención; no equivale a cifrado de extremo a extremo. Seguridad del
almacenamiento depende también de plataforma/dispositivo.

## Productividad

- Invitado: datos sólo locales.
- Cuenta registrada/verificada: respaldo cloud opcional.
- Cuenta password no verificada: datos permanecen locales.
- Fusión exige elección; ninguna fuente se elimina antes de completar.
- Logout separa caché autenticada de espacio invitado.
- Eliminación de cuenta borra Auth, documentos/subcolecciones y conexiones.

## Detección de crisis

Detección ocurre en cliente antes de abrir SSE:

1. Normalizar texto: minúsculas, diacríticos y separadores.
2. Comparar términos/frases con fronteras robustas.
3. Si coincide, cancelar envío al modelo.
4. Mostrar `EmergencyOverlay` con apoyo y contactos.
5. Permitir llamada directa o cierre del overlay.

Detección por palabras no diagnostica ni garantiza identificar toda crisis. Es
una barrera preventiva, no servicio de emergencia.

## Configuración regional

Orden de carga:

```text
app_config/crisis/regions/{COUNTRY}-{locale}
→ app_config/crisis
→ DEFAULT_CRISIS_CONFIG empaquetado
```

Fallback local mantiene interfaz disponible offline. Ningún mercado se activa
sin validar idioma, teléfonos, disponibilidad y texto legal.

Respaldo Nicaragua:

- Policía Nacional: `118`.
- Bomberos: `115`.

Fuentes: [Policía Nacional, 118](https://www.policia.gob.ni/?p=145448) y
[Policía Nacional, 118/115](https://www.policia.gob.ni/?p=114378).

## Interfaz de emergencia

`EmergencyOverlay`:

- interrumpe request pendiente;
- explica que persona merece apoyo inmediato;
- ofrece contactos marcables;
- permite indicar número manual si `Linking` falla;
- aclara que Chat no reemplaza ayuda profesional/emergencias.

Contenido debe revisarse con especialistas antes de release. No prometer
respuesta, confidencialidad clínica ni cobertura donde no exista.

## Controles productivos

- CORS con allowlist.
- Firebase Auth obligatorio para proxy.
- App Check: monitor, medición, luego enforcement.
- Rate limit por UID.
- Secretos en Secret Manager.
- Sentry con `sendDefaultPii: false`, sin request/user/extra.
- Retención de logs revisada por ambiente.

Checklist completo: [rollout productivo](../how-to/production-rollout.md).
