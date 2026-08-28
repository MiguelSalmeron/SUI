# ADR-0004: cuenta local y autenticación opcional

- Estado: aceptado
- Fecha: 2026-08-27

## Contexto

Sui debe ser útil antes de pedir una cuenta. Forzar registro durante bienvenida aumenta fricción; mezclar datos anónimos y registrados sin decisión explícita crea riesgo de pérdida.

## Decisión

La entrada queda como bienvenida visual, consentimiento 16+ y tres rutas: crear cuenta, iniciar sesión o continuar sin cuenta.

- `local`: productividad sólo en almacenamiento del dispositivo. Firebase Auth anónimo puede habilitar APIs técnicas, pero reglas Firestore prohíben productividad anónima.
- `registered`: correo verificado, Google o Apple. Activa respaldo y sincronización.
- Correo nuevo se vincula a sesión anónima. Sin verificación, datos siguen locales.
- Google y Apple intentan vincular sesión anónima para conservar UID.
- Acceso a cuenta existente con datos locales abre decisión: combinar, usar nube o cancelar.
- Cerrar sesión limpia caché autenticada y crea espacio invitado separado.
- El consentimiento guarda versión de política y fecha, nunca edad o fecha de nacimiento.

## Consecuencias

Inicio funciona offline y sin cuenta. Fusión requiere UI, pruebas y operaciones no destructivas. Apple sólo aparece donde el proveedor nativo está disponible. Términos y Privacidad deben tener URL HTTPS antes de producción.
