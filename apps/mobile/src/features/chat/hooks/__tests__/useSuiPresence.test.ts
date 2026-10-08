import { act, renderHook } from '@testing-library/react-native';
import { useSuiPresence } from '../useSuiPresence';
import type { ChatMessage } from '../../types/chat';

type Props = Parameters<typeof useSuiPresence>[0];
const base: Props = { draft: '', overlayVisible: false, waitingPhase: null };
const warmTimers = () =>
  jest
    .mocked(setTimeout)
    .mock.calls.flatMap(([, delay], index) =>
      delay === 600 ? [jest.mocked(setTimeout).mock.results[index].value] : [],
    );
const assistant = (content = '', extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'a1',
  role: 'assistant',
  content,
  createdAt: 0,
  streaming: true,
  ...extra,
});

describe('useSuiPresence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    jest.spyOn(global, 'setTimeout');
    jest.spyOn(global, 'clearTimeout');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each<[Partial<Props>, string, string | null]>([
    [{}, 'resting', null],
    [{ draft: '  ' }, 'resting', null],
    [{ draft: 'Hola' }, 'listening', null],
    [{ draft: 'Hola', waitingPhase: 'thinking' }, 'thinking', 'chat.thinking'],
    [{ draft: 'Hola', waitingPhase: 'remembering' }, 'reading', 'chat.remembering'],
    [{ streamingMessage: assistant('Hola'), waitingPhase: 'remembering' }, 'speaking', null],
    [{ streamingMessage: assistant('Hola', { error: true }) }, 'concern', 'chat.presence.concern'],
    [
      { streamingMessage: assistant('Hola'), overlayVisible: true },
      'concern',
      'chat.presence.concern',
    ],
    [
      { lastAssistant: assistant('Hola', { error: true, streaming: false }) },
      'concern',
      'chat.presence.concern',
    ],
  ])('respeta precedencia %j → %s', async (props, presence, label) => {
    const { result } = await renderHook(() => useSuiPresence({ ...base, ...props }));
    expect(result.current.presence).toBe(presence);
    expect(result.current.label).toBe(label);
    if (presence !== 'speaking') expect(result.current.speakSignal).toBe(0);
  });

  it('sólo texto nuevo dispara señal; límite exacto de 110 ms, sin cola de timers', async () => {
    const { result, rerender } = await renderHook((props: Props) => useSuiPresence(props), {
      initialProps: base,
    });
    const chunk = async (content: string) =>
      rerender({ ...base, streamingMessage: assistant(content) });
    await chunk('H');
    expect(result.current.speakSignal).toBe(1);
    await act(async () => jest.advanceTimersByTime(109));
    await chunk('Ho');
    expect(result.current.speakSignal).toBe(1);
    await act(async () => jest.advanceTimersByTime(1));
    await chunk('Hol');
    expect(result.current.speakSignal).toBe(2);
    await act(async () => jest.advanceTimersByTime(110));
    await chunk('Hol');
    expect(result.current.speakSignal).toBe(2);
    await chunk('Hola');
    expect(result.current.speakSignal).toBe(3);
    expect(warmTimers()).toHaveLength(0);
  });

  it.each(['', 'borrador'])(
    'fin o cancelación → warm una vez, luego estado de borrador %s',
    async (draft) => {
      const initialProps = { ...base, draft, streamingMessage: assistant('Hola') };
      const { result, rerender, unmount } = await renderHook(
        (props: Props) => useSuiPresence(props),
        { initialProps },
      );
      await rerender({ ...base, draft, lastAssistant: assistant('Hola', { streaming: false }) });
      expect(result.current.presence).toBe('warm');
      const signal = result.current.speakSignal;
      await act(async () => jest.advanceTimersByTime(599));
      expect(result.current.presence).toBe('warm');
      await act(async () => jest.advanceTimersByTime(1));
      expect(result.current.presence).toBe(draft ? 'listening' : 'resting');
      expect(result.current.speakSignal).toBe(signal);
      await rerender({ ...base, draft, lastAssistant: assistant('Hola', { streaming: false }) });
      expect(result.current.presence).not.toBe('warm');
      await unmount();
      expect(clearTimeout).toHaveBeenCalledWith(warmTimers()[0]);
    },
  );

  it('error no celebra; limpiar hilo no celebra; remontar no revive speaking ni warm', async () => {
    const { result, rerender, unmount } = await renderHook(
      (props: Props) => useSuiPresence(props),
      { initialProps: { ...base, streamingMessage: assistant('Hola') } },
    );
    await rerender({
      ...base,
      lastAssistant: assistant('Hola', { streaming: false, error: true }),
    });
    expect(result.current.presence).toBe('concern');
    expect(warmTimers()).toHaveLength(0);
    await rerender({ ...base, streamingMessage: assistant('Nuevo', { id: 'a2' }) });
    await rerender(base);
    expect(result.current.presence).toBe('resting');
    await unmount();
    const remounted = await renderHook(() =>
      useSuiPresence({ ...base, lastAssistant: assistant('Hola', { streaming: false }) }),
    );
    expect(remounted.result.current.presence).toBe('resting');
  });

  it('nuevo stream o crisis interrumpe warm; desmontar cancela timer', async () => {
    const { result, rerender, unmount } = await renderHook(
      (props: Props) => useSuiPresence(props),
      { initialProps: { ...base, streamingMessage: assistant('Hola') } },
    );
    const finished = assistant('Hola', { streaming: false });
    await rerender({ ...base, lastAssistant: finished });
    expect(result.current.presence).toBe('warm');
    await rerender({ ...base, lastAssistant: finished, overlayVisible: true });
    expect(result.current.presence).toBe('concern');
    expect(clearTimeout).toHaveBeenCalledWith(warmTimers()[0]);
    await rerender({ ...base, streamingMessage: assistant('Más', { id: 'a2' }) });
    expect(result.current.presence).toBe('speaking');
    await rerender({ ...base, lastAssistant: assistant('Más', { id: 'a2', streaming: false }) });
    expect(result.current.presence).toBe('warm');
    await unmount();
    expect(clearTimeout).toHaveBeenCalledWith(warmTimers().at(-1));
  });

  it('crisis frena señales; volver al mismo texto no dispara rebote atrasado', async () => {
    const streamingMessage = assistant('Hola');
    const { result, rerender } = await renderHook((props: Props) => useSuiPresence(props), {
      initialProps: { ...base, streamingMessage },
    });
    expect(result.current.speakSignal).toBe(1);
    await act(async () => jest.advanceTimersByTime(110));
    await rerender({ ...base, overlayVisible: true, streamingMessage: assistant('Hola otra vez') });
    expect(result.current.presence).toBe('concern');
    expect(result.current.speakSignal).toBe(1);
    await rerender({ ...base, streamingMessage: assistant('Hola otra vez') });
    expect(result.current.speakSignal).toBe(1);
    await rerender({ ...base, streamingMessage: assistant('Hola otra vez.') });
    expect(result.current.speakSignal).toBe(2);
  });

  it('nuevo stream respeta límite global; espera vacía no dispara señales', async () => {
    const { result, rerender } = await renderHook((props: Props) => useSuiPresence(props), {
      initialProps: { ...base, streamingMessage: assistant('Hola') },
    });
    await rerender({ ...base, lastAssistant: assistant('Hola', { streaming: false }) });
    await rerender({
      ...base,
      streamingMessage: assistant('', { id: 'a2' }),
      waitingPhase: 'thinking',
    });
    expect(result.current.presence).toBe('thinking');
    expect(result.current.speakSignal).toBe(1);
    await rerender({ ...base, streamingMessage: assistant('Nuevo', { id: 'a2' }) });
    expect(result.current.speakSignal).toBe(1);
    await act(async () => jest.advanceTimersByTime(110));
    await rerender({ ...base, streamingMessage: assistant('Nuevo texto', { id: 'a2' }) });
    expect(result.current.speakSignal).toBe(2);
  });
});
