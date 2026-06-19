/**
 * Cliente de streaming (SSE) hacia la Cloud Function `chatProxy`.
 *
 * Hermes rompe el streaming nativo de `fetch()` en React Native, por eso se
 * usa `react-native-sse` (XHR-based) — mitigación del riesgo de streaming.
 *
 * La función proxy emite eventos SSE normalizados:
 *   data: {"content":"<delta>"}   (uno por chunk)
 *   data: [DONE]                  (fin del stream)
 */

import EventSource from 'react-native-sse';
import { auth } from '../config/firebase';
import { PromptMessage } from '../types/chat';

const PROXY_URL = process.env.EXPO_PUBLIC_CHAT_PROXY_URL;

export interface StreamHandlers {
  onChunk: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export interface StreamController {
  cancel: () => void;
}

/**
 * Inicia un stream de respuesta. Devuelve un controlador para cancelarlo
 * (p. ej. si el usuario abandona la pantalla).
 */
export const streamChat = async (
  payload: PromptMessage[],
  handlers: StreamHandlers
): Promise<StreamController> => {
  if (!PROXY_URL) {
    handlers.onError(
      'Falta configurar EXPO_PUBLIC_CHAT_PROXY_URL (URL del proxy de chat).'
    );
    return { cancel: () => undefined };
  }

  // Token de Firebase Auth: el proxy lo verifica antes de gastar tokens.
  let idToken: string;
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('no-auth');
    idToken = await user.getIdToken();
  } catch {
    handlers.onError('Sesión no válida. Reinicia la app e inténtalo de nuevo.');
    return { cancel: () => undefined };
  }

  const es = new EventSource(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ messages: payload }),
    // Una sola conexión: sin reconexión automática.
    pollingInterval: 0,
    timeout: 30000,
  });

  let finished = false;
  const finish = (fn: () => void) => {
    if (finished) return;
    finished = true;
    es.removeAllEventListeners();
    es.close();
    fn();
  };

  es.addEventListener('message', (event) => {
    const data = event.data;
    if (!data) return;

    if (data.trim() === '[DONE]') {
      finish(handlers.onDone);
      return;
    }

    try {
      const parsed = JSON.parse(data) as { content?: string; error?: string };
      if (parsed.error) {
        finish(() => handlers.onError('Se interrumpió la respuesta.'));
        return;
      }
      if (parsed.content) {
        handlers.onChunk(parsed.content);
      }
    } catch {
      // Línea parcial o comentario keep-alive: ignorar.
    }
  });

  es.addEventListener('error', (event) => {
    const msg =
      'message' in event && event.message
        ? event.message
        : 'No se pudo conectar con el asistente.';
    finish(() => handlers.onError(msg));
  });

  return {
    cancel: () => finish(() => undefined),
  };
};
