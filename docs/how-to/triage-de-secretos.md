# Triagear hallazgos de secretos

El paso **Scan for secrets** de CI ejecuta `gitleaks` y falla el job si encuentra algo.
Esta guía explica qué cubre, cómo decidir si un hallazgo es real y cómo exceptuarlo sin
abrir un agujero.

## Qué cubre cada capa

| Capa                     | Cobertura                                                              | Coste                  |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------- |
| GitHub _secret scanning_ | Patrones de proveedores conocidos                                      | Gratis en repo público |
| GitHub _push protection_ | Bloquea el push ante un secreto                                        | Gratis en repo público |
| `gitleaks` (CI)          | Patrones por defecto: claves de proveedor, claves privadas y genéricos | Gratis                 |

**No disponible en el plan gratuito:** _non-provider patterns_ y _validity checks_ forman
parte de **GitHub Secret Protection** (de pago). No hay nada que activar y **no aparece
ningún toggle** en _Settings → Advanced Security_: no lo busques. Esa laguna la cubre
`gitleaks`.

> **Diagnóstico a recordar.** El `PATCH` del API `security_and_analysis` devuelve **HTTP
> 200 aunque la función no esté disponible**, y el valor no cambia. Un 200 sin cambio
> significa "esta función no existe en tu plan", **no** un problema de permisos del token.
> Verifica siempre leyendo el estado de vuelta, no el código de respuesta.

## Reproducir en local

```bash
gitleaks detect --source . --config .gitleaks.toml --redact
```

`--redact` evita volcar el valor al terminal. Salida `no leaks found` = limpio.

## Decidir si el hallazgo es real

1. **¿El valor concede acceso a algo?** Clave de servicio, token con permisos, contraseña,
   cadena de conexión → es real.
2. **¿Es un identificador público?** API key de Firebase, Client ID de OAuth, project ID →
   **no** es un secreto.
3. **Ante la duda, trátalo como real.**

### Falsos positivos conocidos

| Valor                         | Regla de gitleaks | Por qué no es un secreto                                                                |
| ----------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| API key de Firebase (`AIza…`) | `gcp-api-key`     | Pública por diseño: viaja en el bundle. Ver [Seguridad](../explanation/seguridad.md) §2 |

Aun así, la API key **sí** exige una revisión aparte: comprueba en Google Cloud Console →
APIs y servicios → Credenciales que tenga **restricciones de API** (solo las que la app
usa) y **restricciones de aplicación** (referrers HTTP en web, paquete + SHA-1 en Android,
bundle ID en iOS). Una key sin restringir puede usarse contra otras APIs habilitadas.

## Si el secreto es real

1. **Revocar y rotar primero** en el proveedor. Es lo urgente; el resto puede esperar.
2. Reescribir el historial **no** neutraliza un secreto ya expuesto.
3. Solo después, decidir si hace falta limpiar el historial.

## Añadir una excepción

En `.gitleaks.toml`. Dos reglas que no se negocian:

- **Acotada:** usa `paths` (o el valor exacto). Nunca exceptúes una regla entera.
- **Justificada:** el campo `description` debe explicar por qué.

Detalles de sintaxis verificados con gitleaks **8.21.2**:

- `[extend] useDefault = true` es obligatorio. Sin él, tu archivo **reemplaza** las reglas
  integradas en lugar de extenderlas y no se detectaría nada.
- La sección que aplica es `[allowlist]` (**singular**). `[[allowlists]]` se ignora en
  silencio, aunque aparezca en documentación más reciente.

```toml
[extend]
useDefault = true

[allowlist]
description = "API key de Firebase en un documento de trabajo ya retirado"
paths = ['''work/ANOMALIAS_Y_MEJORAS\.md''']
```

## Verificar que la excepción no es demasiado amplia

Una excepción mal acotada silencia el patrón en todo el repositorio. Comprueba los dos
sentidos: que el repositorio pase **y** que un secreto equivalente en otra ruta siga
detectándose.
