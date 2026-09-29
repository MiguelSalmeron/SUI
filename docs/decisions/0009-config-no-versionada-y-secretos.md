# ADR-0009: configuración no versionada y gestión de secretos

- **Estado:** aceptada
- **Fecha:** 2026-09-28
- **Relacionado:** ADR-0001, ADR-0003, ADR-0006, [Arquitectura](../explanation/architecture.md) (regla 11)

## Contexto

El repositorio es **público**. ADR-0006 aisló las integraciones externas y la regla 11
confinó el SDK de Firebase a `shared/infrastructure`. Los secretos reales ya se gestionan
como _Firebase secrets_ (`AZURE_OPENAI_API_KEY`, `GOOGLE_OAUTH_WEB_CLIENT_SECRET`), no en
archivos.

Sin embargo, `apps/functions/.env.xsui-nica` estaba **versionado** (con una negación
explícita `!` en `.gitignore`). Su contenido no tenía secretos: IDs de cliente OAuth
(identificadores públicos que también viajan en la app), el modelo de Azure, los orígenes
permitidos y el modo de App Check. Aun así, versionar un `.env.*` es una trampa: basta
que alguien añada un valor sensible para publicarlo, y una vez commiteado queda **permanente
en el historial**.

El gate de predeploy `scripts/check-functions-config.mjs` lee ese archivo en local para
validar parámetros no secretos, por lo que su ausencia en el repositorio (pero su presencia
en el disco del desarrollador) debe ser un caso soportado.

## Decisiones

### 1. Sólo se versionan plantillas `.env.example`

`.env` y `.env.<proyecto>` quedan ignorados sin excepciones. La regla vive en `.gitignore`
(`apps/functions/.env`, `apps/functions/.env.*`, `apps/mobile/.env*`) y sólo se exceptúa
`!*.env.example`.

### 2. La configuración no secreta de Functions es local por proyecto

Cada desarrollador mantiene su `apps/functions/.env.<proyecto>` (por ejemplo
`.env.xsui-nica`) creado a partir de `.env.example`. En el proyecto activo, los mismos
parámetros se fijan con `firebase functions:params`.

### 3. Los secretos nunca tocan archivos versionados

Se declaran con `firebase functions:secrets:set` y se consumen con `defineSecret`. Ningún
`.env`, ADR, test o script debe contener su valor.

### 4. El gate de predeploy valida en local y no revela valores

`scripts/check-functions-config.mjs` corre como `predeploy`, exige `GOOGLE_OAUTH_CLIENT_IDS`
y `GOOGLE_OAUTH_WEB_CLIENT_ID`, y contrasta la allowlist con los client IDs del móvil. Si
falta el archivo local, **falla con un mensaje accionable**: es el comportamiento deseado,
no un bug. El script sólo imprime claves, nunca valores.

### 5. El repositorio se apoya en el escaneo de secretos de GitHub y en gitleaks

_Secret scanning_ y _push protection_ quedan activos como red de seguridad de repositorio,
para bloquear un secreto **antes** de que entre. Es la única capa que actúa antes del push;
un job de CI sólo puede reaccionar después.

En un repositorio público gratuito, _non-provider patterns_ y _validity checks_ forman
parte de GitHub Secret Protection (de pago) y no están disponibles. Esa laguna se cubre
con `gitleaks` como paso de CI, configurado en `.gitleaks.toml`.

## Consecuencias

### Positivas

- Ningún `.env.*` público puede filtrar un secreto futuro.
- El repositorio no aparenta exponer credenciales, lo que reduce el riesgo de abuso.
- El flujo local de deploy sigue funcionando sin cambios para quien ya tiene el archivo.

### Costes

- Un clon nuevo no puede desplegar Functions hasta crear `apps/functions/.env.xsui-nica`
  desde `.env.example`; el error del predeploy es explícito.
- La configuración por entorno vive fuera de Git, así que su recuperación depende de
  `firebase functions:params` y de los _Firebase secrets_.

### Estado del historial

El historial anterior al monorepo contiene `functions/.env.xsui-nica` y
`functions/.env.xsui-nica.azure-backup-*`, **verificados sin secretos** (los mismos valores
públicos). No se reescribe el historial: no hay credencial que rotar.

## Fuera de esta decisión

- Reescribir el historial con `git filter-repo`. Sólo se justificaría ante un secreto real
  ya publicado, y aun así la prioridad sería revocar y rotar en el proveedor.
- Rotar credenciales: no aplica mientras no exista una fuga real.

## Criterios para revisar la decisión

Revisar esta ADR si:

- aparece un secreto real en el historial o en un commit (entonces: revocar, rotar y evaluar
  la reescritura);
- el equipo decide volver a versionar configuración por entorno (exigiría justificar por qué
  no puede vivir en `firebase functions:params`);
- el proceso de deploy se automatiza en CI y necesita los parámetros sin intervención local.
