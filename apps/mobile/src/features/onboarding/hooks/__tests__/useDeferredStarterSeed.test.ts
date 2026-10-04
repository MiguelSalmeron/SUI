import { useEffect } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import { useIntroStore } from '../../store/useIntroStore';
import { useDeferredStarterSeed } from '../useDeferredStarterSeed';

jest.mock('@/shared/infrastructure/firebase/firebase', () => ({
  auth: { currentUser: null, authStateReady: jest.fn(async () => undefined) },
}));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

const initialState = useProductivityStore.getInitialState();
const seed = jest.fn(initialState.seedStarterData);
const save = jest.fn(initialState.saveState);
const setItem = jest.mocked(AsyncStorage.setItem);
const writeItem = setItem.getMockImplementation()!;
const userStorageKey = 'sui-productivity-v9:usuario';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
};

const pendingWrites: ReturnType<typeof deferred>[] = [];

const holdWrites = (count: number) => {
  const writes = Array.from({ length: count }, () => ({
    started: deferred(),
    release: deferred(),
    finished: deferred(),
    value: '',
  }));
  pendingWrites.push(...writes.map((write) => write.release));
  let index = 0;
  setItem.mockImplementation(async (key, value) => {
    const write = key === userStorageKey ? writes[index++] : undefined;
    if (write) {
      write.value = value;
      write.started.resolve();
      await write.release.promise;
    }
    await writeItem(key, value);
    write?.finished.resolve();
  });
  return writes;
};

const setAuthUser = (uid: string | null) => {
  Object.assign(auth, {
    currentUser: uid === null ? null : { uid, isAnonymous: true, providerData: [] },
  });
};

const useSession = (uid: string | null) => {
  const handleAuthUserChanged = useProductivityStore((state) => state.handleAuthUserChanged);
  useEffect(() => {
    handleAuthUserChanged(uid);
  }, [uid, handleAuthUserChanged]);
  useDeferredStarterSeed(uid);
};

beforeEach(async () => {
  jest.useFakeTimers();
  setAuthUser(null);
  setItem.mockImplementation(writeItem);
  await AsyncStorage.clear();
  await useProductivityStore.getState().clearState({ preserveStorage: true });
  useIntroStore.getState().resetIntro();
  useIntroStore.setState({ introComplete: true, userIntention: 'explore' });
  seed.mockClear();
  seed.mockImplementation(initialState.seedStarterData);
  save.mockReset();
  save.mockResolvedValue(undefined);
  useProductivityStore.setState({
    ...initialState,
    stateLoaded: true,
    seedStarterData: seed,
    saveState: save,
  });
});

afterEach(async () => {
  await cleanup();
  pendingWrites.splice(0).forEach((write) => write.resolve());
  await Promise.all(save.mock.results.map((result) => result.value));
  await Promise.all(save.mock.results.map((result) => result.value));
  setItem.mockImplementation(writeItem);
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('no siembra mientras stateLoaded es false', async () => {
  useProductivityStore.setState({ stateLoaded: false });
  await renderHook(() => useDeferredStarterSeed('usuario'));
  expect(seed).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it('sin uid nunca siembra, aunque pasen timers y technicalAuthPending cambie', async () => {
  await renderHook(() => useDeferredStarterSeed(null));
  await act(async () => {
    jest.advanceTimersByTime(60_000);
    useIntroStore.getState().setTechnicalAuthPending(true);
  });
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  expect(seed).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(useIntroStore.getState().starterSeededAt).toBeNull();
});

it.each(['goal', 'habit', 'agenda', 'explore'] as const)(
  'con uid y stateLoaded siembra una vez el kit %s',
  async (userIntention) => {
    useIntroStore.setState({ userIntention });
    await renderHook(() => useDeferredStarterSeed('usuario'));
    expect(seed).toHaveBeenCalledTimes(1);
    expect(seed).toHaveBeenCalledWith(userIntention, expect.any(Function));
    expect(save).toHaveBeenCalledTimes(1);
    expect(seed.mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[0]);
    expect(useIntroStore.getState().starterSeededAt).not.toBeNull();
  },
);

it('no siembra si starterSeededAt ya existe', async () => {
  useIntroStore.setState({ starterSeededAt: '2026-10-04T12:00:00.000Z' });
  await renderHook(() => useDeferredStarterSeed('usuario'));
  expect(seed).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it.each(['goal', 'habit'] as const)('no siembra si ya existe un dato de tipo %s', async (kind) => {
  if (kind === 'goal') {
    useProductivityStore.getState().addGoal({ title: 'Meta propia', deadline: '2026-10-10' });
  } else {
    useProductivityStore.getState().addHabit({ title: 'Hábito propio' });
  }
  const { goals, habits } = useProductivityStore.getState();
  await renderHook(() => useDeferredStarterSeed('usuario'));
  expect(seed).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(useProductivityStore.getState()).toMatchObject({ goals, habits });
});

it('el guard por ref evita repetir la siembra en re-renders aunque no se marque el store', async () => {
  seed.mockImplementation(() => undefined);
  const { rerender } = await renderHook<void, { uid: string | null }>(
    ({ uid }) => useDeferredStarterSeed(uid),
    { initialProps: { uid: 'usuario' } },
  );
  await rerender({ uid: null });
  await rerender({ uid: 'usuario' });
  await act(async () => {
    useIntroStore.setState({ userIntention: 'goal' });
  });
  expect(seed).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledTimes(1);
});

it.each([
  { introComplete: false, userIntention: 'goal' as const },
  { introComplete: true, userIntention: null },
])('espera intro completa e intención: %j', async (intro) => {
  useIntroStore.setState(intro);
  await renderHook(() => useDeferredStarterSeed('usuario'));
  expect(seed).not.toHaveBeenCalled();
  await act(async () => {
    useIntroStore.setState({ introComplete: true, userIntention: 'goal' });
  });
  expect(seed).toHaveBeenCalledTimes(1);
});

it('carga sin uid, recarga al llegar uid y conserva la siembra tras persistir y recargar otra vez', async () => {
  useProductivityStore.setState({ stateLoaded: false });
  save.mockImplementation(initialState.saveState);
  const reload = jest.fn(initialState.reloadState);
  useProductivityStore.setState({ reloadState: reload });
  await useProductivityStore.getState().loadState();
  const { rerender } = await renderHook<void, { uid: string | null }>(
    ({ uid }) => useSession(uid),
    { initialProps: { uid: null } },
  );
  expect(seed).not.toHaveBeenCalled();

  const [hydration, persistence] = holdWrites(2);
  setAuthUser('usuario');
  await rerender({ uid: 'usuario' });
  await hydration.started.promise;
  expect(reload).toHaveBeenCalledTimes(1);
  expect(useProductivityStore.getState().stateLoaded).toBe(false);
  expect(seed).not.toHaveBeenCalled();

  await act(async () => {
    hydration.release.resolve();
    await reload.mock.results[0].value;
  });
  await persistence.started.promise;
  expect(seed).toHaveBeenCalledTimes(1);
  const { goals, habits } = useProductivityStore.getState();
  expect(goals).toHaveLength(1);
  expect(habits).toHaveLength(1);

  await act(async () => {
    persistence.release.resolve();
    await persistence.finished.promise;
    await save.mock.results[0].value;
    await useProductivityStore.getState().reloadState();
  });
  expect(useProductivityStore.getState()).toMatchObject({ goals, habits, stateLoaded: true });
  expect(seed).toHaveBeenCalledTimes(1);
});

it('el guardado encolado conserva la siembra sin depender de await saveState()', async () => {
  setAuthUser('usuario');
  useProductivityStore.setState({ stateLoaded: false });
  await useProductivityStore.getState().loadState();
  save.mockImplementation(initialState.saveState);
  const [previous, queued] = holdWrites(2);
  const previousSave = useProductivityStore.getState().saveState();
  await previous.started.promise;

  await renderHook(() => useDeferredStarterSeed('usuario'));
  expect(seed).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledTimes(2);
  await save.mock.results[1].value;
  expect(JSON.parse((await AsyncStorage.getItem(userStorageKey))!).data.goals).toEqual([]);
  expect(queued.value).toBe('');
  const { goals, habits } = useProductivityStore.getState();

  await act(async () => {
    previous.release.resolve();
    await previousSave;
    await queued.started.promise;
  });
  expect(JSON.parse(queued.value).data).toMatchObject({ goals, habits });
  await act(async () => {
    queued.release.resolve();
    await queued.finished.promise;
    await save.mock.results[2].value;
    await useProductivityStore.getState().reloadState();
  });
  expect(useProductivityStore.getState()).toMatchObject({ goals, habits });
  expect(seed).toHaveBeenCalledTimes(1);
});
