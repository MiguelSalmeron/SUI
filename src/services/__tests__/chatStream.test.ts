import 'jest';

/**
 * Mock de `react-native-sse` (XHR-based SSE).
 * Cada instancia guarda sus listeners en `this._listeners`; la última queda
 * expuesta en `FakeEventSource.lastInstance` para que los tests disparen
 * eventos manualmente. `constructCount` rastorea cuántas instancias se crearon.
 */
jest.mock('react-native-sse', () => {
  let constructCount = 0;

  class FakeEventSource {
    static lastInstance: FakeEventSource | null = null;
    url: string;
    opts: unknown;
    _listeners: Record<string, (e: { data?: string; message?: string }) => void> = {};
    closed = false;

    constructor(url: string, opts: unknown) {
      constructCount += 1;
      this.url = url;
      this.opts = opts;
      FakeEventSource.lastInstance = this;
    }
    addEventListener(name: string, cb: (e: { data?: string; message?: string }) => void) {
      this._listeners[name] = cb;
    }
    removeAllEventListeners() {
      this._listeners = {};
    }
    close() {
      this.closed = true;
    }
  }

  return {
    __esModule: true,
    default: FakeEventSource,
    // Getters/etératest passthrough para los tests.
    __resetCount: () => {
      constructCount = 0;
    },
    __constructCount: () => constructCount,
    __setLastInstance: (i: FakeEventSource | null) => {
      FakeEventSource.lastInstance = i;
    },
  };
});

/**
 * Mock de `../config/firebase` (desde la perspectiva de chatStream.ts).
 * Evita cargar el firebase real (node-incompatible, initializeAuth...).
 * `auth.currentUser` se muta por test.
 */
jest.mock('../../config/firebase', () => ({
  __esModule: true,
  auth: { currentUser: null as null | { getIdToken: () => Promise<string> } },
  db: {},
}));

// La fuente importa `../config/firebase`; el mock lo resuelve para el módulo
// fuente. Para el test leemos el mismo módulo mockeado bajo su path.
import { auth } from '../../config/firebase';
import type { PromptMessage } from '../../types/chat';

type MessageEvent = { data?: string; message?: string };

interface ActiveInstance {
  _listeners: Record<string, (e: MessageEvent) => void>;
  closed: boolean;
}

const REAL_ENV = process.env.EXPO_PUBLIC_CHAT_PROXY_URL;

const makeHandlers = () => ({
  onChunk: jest.fn((_delta: string) => undefined),
  onDone: jest.fn(() => undefined),
  onError: jest.fn((_message: string) => undefined),
});

const PAYLOAD: PromptMessage[] = [{ role: 'user', content: 'hola' }];

/** Carga `chatStream` fresco capturando PROXY_URL al momento de importar. */
function loadChatStream(envValue: string | undefined) {
  if (envValue === undefined) {
    delete process.env.EXPO_PUBLIC_CHAT_PROXY_URL;
  } else {
    process.env.EXPO_PUBLIC_CHAT_PROXY_URL = envValue;
  }

  // jest.isolateModules da un registry fresco; el require interno carga el
  // módulo con el env ya establecido.
  let mod: typeof import('../chatStream') | null = null;
  jest.isolateModules(() => {
    mod = require('../chatStream');
  });
  return mod as unknown as typeof import('../chatStream');
}

function getActive(): ActiveInstance {
  const last = (require('react-native-sse') as { default: { lastInstance: ActiveInstance | null } })
    .default.lastInstance;
  if (!last) throw new Error('No se creó ningún EventSource');
  return last;
}

function resetMockCounters() {
  (require('react-native-sse') as { __resetCount: () => void }).__resetCount();
}
function setLastInstanceNull() {
  (require('react-native-sse') as {
    __setLastInstance: (i: ActiveInstance | null) => void;
  }).__setLastInstance(null);
}
function getConstructCount() {
  return (require('react-native-sse') as { __constructCount: () => number }).__constructCount();
}

// `auth` es el mismo objeto referenciado por el módulo fuente; mutar su
// currentUser aquí afecta la importación del mock dentro de chatStream.
const mockedAuth = auth as { currentUser: null | { getIdToken: () => Promise<string> } };

describe('chatStream', () => {
  beforeEach(() => {
    resetMockCounters();
    setLastInstanceNull();
    mockedAuth.currentUser = { getIdToken: () => Promise.resolve('id-token-123') };
    process.env.EXPO_PUBLIC_CHAT_PROXY_URL = 'http://test-proxy';
  });

  afterEach(() => {
    if (REAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_CHAT_PROXY_URL;
    } else {
      process.env.EXPO_PUBLIC_CHAT_PROXY_URL = REAL_ENV;
    }
  });

  it('sin PROXY_URL -> onError "Falta configurar..." y controller con cancel no-op', async () => {
    const chatStream = loadChatStream(undefined);
    const handlers = makeHandlers();
    const controller = await chatStream.streamChat(PAYLOAD, handlers);

    expect(handlers.onError).toHaveBeenCalledWith(
      'Falta configurar EXPO_PUBLIC_CHAT_PROXY_URL (URL del proxy de chat).'
    );
    expect(getConstructCount()).toBe(0);
    expect(handlers.onDone).not.toHaveBeenCalled();
    expect(() => controller.cancel()).not.toThrow();
  });

  it('sin auth.currentUser -> onError "Sesión no válida..." + controller no-op; EventSource NO se construye', async () => {
    mockedAuth.currentUser = null;
    const chatStream = loadChatStream('http://test-proxy');
    const handlers = makeHandlers();
    const controller = await chatStream.streamChat(PAYLOAD, handlers);

    expect(handlers.onError).toHaveBeenCalledWith(
      'Sesión no válida. Reinicia la app e inténtalo de nuevo.'
    );
    expect(getConstructCount()).toBe(0);
    expect(() => controller.cancel()).not.toThrow();
  });

  it('happy path: onChunk por cada {"content":"x"}, [DONE] -> onDone una vez, conexión cerrada', async () => {
    const chatStream = loadChatStream('http://test-proxy');
    const handlers = makeHandlers();
    await chatStream.streamChat(PAYLOAD, handlers);

    const es = getActive();
    const message = es._listeners['message'];

    message({ data: '{"content":"Hol"}' });
    message({ data: '{"content":"a"}' });
    expect(handlers.onChunk).toHaveBeenCalledTimes(2);
    expect(handlers.onChunk).toHaveBeenNthCalledWith(1, 'Hol');
    expect(handlers.onChunk).toHaveBeenNthCalledWith(2, 'a');

    message({ data: '[DONE]' });
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
    expect(es.closed).toBe(true);
  });

  it('objeto de error del servidor {"error":"..."} -> onError "Se interrumpió la respuesta." y no onDone tras finalizar', async () => {
    const chatStream = loadChatStream('http://test-proxy');
    const handlers = makeHandlers();
    await chatStream.streamChat(PAYLOAD, handlers);

    const es = getActive();
    const message = es._listeners['message'];

    message({ data: '{"error":"upstream boom"}' });
    expect(handlers.onError).toHaveBeenCalledWith('Se interrumpió la respuesta.');
    expect(es.closed).toBe(true);

    // Idempotente: [DONE] posterior no dispara onDone.
    message({ data: '[DONE]' });
    expect(handlers.onDone).not.toHaveBeenCalled();
  });

  it('línea JSON malformada -> ignorada (sin onChunk, sin onError), stream sigue abierto hasta [DONE]', async () => {
    const chatStream = loadChatStream('http://test-proxy');
    const handlers = makeHandlers();
    await chatStream.streamChat(PAYLOAD, handlers);

    const es = getActive();
    const message = es._listeners['message'];

    message({ data: '{not json' });
    expect(handlers.onChunk).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(es.closed).toBe(false);

    message({ data: '{"content":"ok"}' });
    expect(handlers.onChunk).toHaveBeenCalledTimes(1);
    message({ data: '[DONE]' });
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it('cancel() detiene el stream: tras cancel, [DONE] NO llama onDone (finish guard)', async () => {
    const chatStream = loadChatStream('http://test-proxy');
    const handlers = makeHandlers();
    const controller = await chatStream.streamChat(PAYLOAD, handlers);

    const es = getActive();
    const message = es._listeners['message'];

    controller.cancel();
    expect(es.closed).toBe(true);

    message({ data: '[DONE]' });
    expect(handlers.onDone).not.toHaveBeenCalled();
  });

  it("listener 'error' -> onError con event.message si existe, sino 'No se pudo conectar con el asistente.'", async () => {
    const chatStream = loadChatStream('http://test-proxy');
    const handlers = makeHandlers();
    await chatStream.streamChat(PAYLOAD, handlers);

    const es = getActive();
    const errorListener = es._listeners['error'];

    // Caso 1: event.message presente.
    errorListener({ message: 'timeout reached' });
    expect(handlers.onError).toHaveBeenCalledWith('timeout reached');

    // Idempotente tras error: un nuevo error no vuelve a llamar onError.
    handlers.onError.mockClear();
    errorListener({ message: 'second' });
    expect(handlers.onError).not.toHaveBeenCalled();

    // Caso 2: sin message -> fallback.
    const chatStream2 = loadChatStream('http://test-proxy');
    const handlers2 = makeHandlers();
    await chatStream2.streamChat(PAYLOAD, handlers2);
    const es2 = getActive();
    es2._listeners['error']({});
    expect(handlers2.onError).toHaveBeenCalledWith('No se pudo conectar con el asistente.');
  });

  it('[DONE] es idempotente: enviar [DONE] dos veces llama onDone exactamente una vez', async () => {
    const chatStream = loadChatStream('http://test-proxy');
    const handlers = makeHandlers();
    await chatStream.streamChat(PAYLOAD, handlers);

    const es = getActive();
    const message = es._listeners['message'];

    message({ data: '[DONE]' });
    message({ data: '[DONE]' });
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });
});
