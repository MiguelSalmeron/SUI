import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_ENGAGEMENT_ENVELOPE } from '../model/engagementTypes';
import {
  getEngagementStorageKey,
  writeEngagement,
  loadEngagement,
} from '../services/engagementRepository';
import { useEngagementStore } from '../store/useEngagementStore';

const stamp = '2026-10-01T12:00:00.000Z';
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const originalRead = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const originalWrite = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
const originalRemove = jest.mocked(AsyncStorage.removeItem).getMockImplementation()!;
const resetStorageMocks = () => {
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(originalRead);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(originalWrite);
  jest.mocked(AsyncStorage.removeItem).mockReset().mockImplementation(originalRemove);
};

describe('aislamiento de sesiones de Engagement', () => {
  beforeEach(async () => {
    resetStorageMocks();
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    await useEngagementStore.getState().loadState(null);
  });
  afterEach(resetStorageMocks);

  it('carga tardía de A no cambia B ni guarda datos de A bajo B', async () => {
    const a = EMPTY_ENGAGEMENT_ENVELOPE(stamp);
    a.profile.cadence = 'steady';
    const b = EMPTY_ENGAGEMENT_ENVELOPE(stamp);
    b.profile.cadence = 'present';
    const slowA = deferred<string | null>();
    const slowB = deferred<string | null>();
    const read = originalRead;
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key) => {
      if (key === getEngagementStorageKey('a')) return slowA.promise;
      if (key === getEngagementStorageKey('b')) return slowB.promise;
      return read(key);
    });
    const first = useEngagementStore.getState().loadState('a');
    const second = useEngagementStore.getState().loadState('b');
    expect(useEngagementStore.getState().stateLoaded).toBe(false);
    slowB.resolve(JSON.stringify(b));
    await second;
    slowA.resolve(JSON.stringify(a));
    await first;
    expect(useEngagementStore.getState().profile.cadence).toBe('present');
    await useEngagementStore.getState().updateProfile({ enabled: true });
    const saved = JSON.parse((await read(getEngagementStorageKey('b')))!);
    expect(saved.profile.cadence).toBe('present');
    expect(await read(getEngagementStorageKey('a'))).toBeNull();
  });

  it('oculta cuenta anterior y rechaza escritura durante hidratación', async () => {
    const a = EMPTY_ENGAGEMENT_ENVELOPE(stamp);
    a.profile.enabled = true;
    await writeEngagement(a, 'a');
    await useEngagementStore.getState().loadState('a');
    const gate = deferred<string | null>();
    const read = originalRead;
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockImplementation((key) =>
        key === getEngagementStorageKey('b') ? gate.promise : read(key),
      );
    const loading = useEngagementStore.getState().loadState('b');
    expect(useEngagementStore.getState().profile.enabled).toBe(false);
    const result = await useEngagementStore.getState().updateProfile({ enabled: true });
    expect(result.outcome).toBe('storage_error');
    expect(await read(getEngagementStorageKey('b'))).toBeNull();
    gate.resolve(null);
    await loading;
  });

  it('logout durante carga invalida respuesta anterior', async () => {
    const gate = deferred<string | null>();
    const read = originalRead;
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockImplementation((key) =>
        key === getEngagementStorageKey('a') ? gate.promise : read(key),
      );
    const loading = useEngagementStore.getState().loadState('a');
    await useEngagementStore.getState().handleAuthUserChanged(null);
    const old = EMPTY_ENGAGEMENT_ENVELOPE(stamp);
    old.profile.enabled = true;
    gate.resolve(JSON.stringify(old));
    await loading;
    expect(useEngagementStore.getState().profile.enabled).toBe(false);
  });

  it('serializa guardados concurrentes y conserva cambios de ambos', async () => {
    await useEngagementStore.getState().loadState('a');
    const gate = deferred<void>();
    const write = originalWrite;
    let first = true;
    const writes = jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
      if (first) {
        first = false;
        await gate.promise;
      }
      await write(key, value);
    });
    const enabled = useEngagementStore.getState().updateProfile({ enabled: true });
    const changed = useEngagementStore.getState().updateProfile({ cadence: 'steady' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(writes).toHaveBeenCalledTimes(1);
    gate.resolve();
    await Promise.all([enabled, changed]);
    const stored = await loadEngagement('a');
    expect(stored.profile.enabled).toBe(true);
    expect(stored.profile.cadence).toBe('steady');
  });

  it('guardado iniciado en A conserva namespace aunque sesión pase a B', async () => {
    await useEngagementStore.getState().loadState('a');
    const gate = deferred<void>();
    const write = originalWrite;
    jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(async (key, value) => {
      await gate.promise;
      await write(key, value);
    });
    const save = useEngagementStore.getState().updateProfile({ enabled: true });
    await useEngagementStore.getState().loadState('b');
    gate.resolve();
    await save;
    expect((await loadEngagement('a')).profile.enabled).toBe(true);
    expect(await AsyncStorage.getItem(getEngagementStorageKey('b'))).toBeNull();
    expect(useEngagementStore.getState().profile.enabled).toBe(false);
  });
});
