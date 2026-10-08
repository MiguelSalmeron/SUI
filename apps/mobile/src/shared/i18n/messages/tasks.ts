/**
 * Copy de Google Tasks. Namespace aparte de `connections` a propósito: los
 * errores de Google hablar de Google y de Calendar no dice nada del conector
 * que falló, y un solo namespace terminaría mezclando ambos mensajes.
 */
export const tasks = {
  es: {
    'tasks.title': 'Google Tasks',
    'tasks.reauthRequired': 'La sesión de Google Tasks expiró. Volvé a conectar.',
    'tasks.errorConfig': 'Google Tasks no está configurado en este entorno.',
    'tasks.errorPreparing': 'Google Tasks aún se está preparando. Inténtalo en un momento.',
    'tasks.errorDenied': 'No se concedió acceso a Google Tasks.',
    'tasks.errorCode': 'Google no devolvió una autorización válida.',
    'tasks.errorSync': 'No se pudo actualizar Google Tasks.',
    'tasks.errorConnectConfig':
      'No se pudo autorizar con Google. La configuración OAuth del entorno está incompleta.',
    'tasks.errorPermission': 'Falta el permiso de Tasks. Volvé a conectar y aceptá el acceso.',
    'tasks.errorRateLimited': 'Google limitó las solicitudes. Inténtalo en unos minutos.',
    'tasks.errorGoogle': 'Google rechazó la solicitud. Inténtalo de nuevo.',
    'tasks.errorNetwork': 'Sin conexión con el servidor. Revisá tu red e intentá de nuevo.',
  },
  en: {
    'tasks.title': 'Google Tasks',
    'tasks.reauthRequired': 'Google Tasks session expired. Please reconnect.',
    'tasks.errorConfig': 'Google Tasks is not configured in this environment.',
    'tasks.errorPreparing': 'Google Tasks is still getting ready. Try again shortly.',
    'tasks.errorDenied': 'Google Tasks access was not granted.',
    'tasks.errorCode': 'Google did not return a valid authorization.',
    'tasks.errorSync': 'Google Tasks could not be refreshed.',
    'tasks.errorConnectConfig':
      'Google authorization failed. This environment OAuth configuration is incomplete.',
    'tasks.errorPermission': 'Tasks permission is missing. Reconnect and grant access.',
    'tasks.errorRateLimited': 'Google rate limited the request. Try again in a few minutes.',
    'tasks.errorGoogle': 'Google rejected the request. Try again.',
    'tasks.errorNetwork': 'No connection to the server. Check your network and try again.',
  },
} as const;
