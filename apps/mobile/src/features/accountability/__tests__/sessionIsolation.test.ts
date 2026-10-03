import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_ENVELOPE } from '../model/accountabilityTypes';
import {
  getAccountabilityStorageKey,
  writeAccountability,
  loadAccountability,
} from '../services/accountabilityRepository';
import { useAccountabilityStore } from '../store/useAccountabilityStore';

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

describe('aislamiento de sesiones de Accountability', () => {
  beforeEach(async () => {
    resetStorageMocks();
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    await useAccountabilityStore.getState().loadState(null);
  });
  afterEach(resetStorageMocks);

  it('carga tardía de A no cambia B ni guarda datos de A bajo B', async () => {
    const a = EMPTY_ENVELOPE(stamp);
    a.profile.personality = 'coach';
    const b = EMPTY_ENVELOPE(stamp);
    b.profile.personality = 'mentor';
    const slowA = deferred<string | null>();
    const slowB = deferred<string | null>();
    const read = originalRead;
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key) => {
      if (key === getAccountabilityStorageKey('a')) return slowA.promise;
      if (key === getAccountabilityStorageKey('b')) return slowB.promise;
      return read(key);
    });
    const first = useAccountabilityStore.getState().loadState('a');
    const second = useAccountabilityStore.getState().loadState('b');
    expect(useAccountabilityStore.getState().stateLoaded).toBe(false);
    slowB.resolve(JSON.stringify(b));
    await second;
    slowA.resolve(JSON.stringify(a));
    await first;
    expect(useAccountabilityStore.getState().profile.personality).toBe('mentor');
    await useAccountabilityStore.getState().updateProfile({ enabled: true });
    const saved = JSON.parse((await read(getAccountabilityStorageKey('b')))!);
    expect(saved.profile.personality).toBe('mentor');
    expect(await read(getAccountabilityStorageKey('a'))).toBeNull();
  });

  it('oculta cuenta anterior y rechaza escritura durante hidratación', async () => {
    const a = EMPTY_ENVELOPE(stamp);
    a.profile.enabled = true;
    await writeAccountability(a, 'a');
    await useAccountabilityStore.getState().loadState('a');
    const gate = deferred<string | null>();
    const read = originalRead;
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockImplementation((key) =>
        key === getAccountabilityStorageKey('b') ? gate.promise : read(key),
      );
    const loading = useAccountabilityStore.getState().loadState('b');
    expect(useAccountabilityStore.getState().profile.enabled).toBe(false);
    const result = await useAccountabilityStore.getState().updateProfile({ enabled: true });
    expect(result.outcome).toBe('storage_error');
    expect(await read(getAccountabilityStorageKey('b'))).toBeNull();
    gate.resolve(null);
    await loading;
  });

  it('logout durante carga invalida respuesta anterior', async () => {
    const gate = deferred<string | null>();
    const read = originalRead;
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockImplementation((key) =>
        key === getAccountabilityStorageKey('a') ? gate.promise : read(key),
      );
    const loading = useAccountabilityStore.getState().loadState('a');
    await useAccountabilityStore.getState().handleAuthUserChanged(null);
    const old = EMPTY_ENVELOPE(stamp);
    old.profile.enabled = true;
    gate.resolve(JSON.stringify(old));
    await loading;
    expect(useAccountabilityStore.getState().profile.enabled).toBe(false);
  });

  it('serializa guardados concurrentes y conserva cambios de ambos', async () => {
    await useAccountabilityStore.getState().loadState('a');
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
    const enabled = useAccountabilityStore.getState().updateProfile({ enabled: true });
    const changed = useAccountabilityStore.getState().updateProfile({ personality: 'coach' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(writes).toHaveBeenCalledTimes(1);
    gate.resolve();
    await Promise.all([enabled, changed]);
    const stored = await loadAccountability('a');
    expect(stored.profile.enabled).toBe(true);
    expect(stored.profile.personality).toBe('coach');
  });

  it('guardado iniciado en A conserva namespace aunque sesión pase a B', async () => {
    await useAccountabilityStore.getState().loadState('a');
    const gate = deferred<void>();
    const write = originalWrite;
    jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(async (key, value) => {
      await gate.promise;
      await write(key, value);
    });
    const save = useAccountabilityStore.getState().updateProfile({ enabled: true });
    await useAccountabilityStore.getState().loadState('b');
    gate.resolve();
    await save;
    expect((await loadAccountability('a')).profile.enabled).toBe(true);
    expect(await AsyncStorage.getItem(getAccountabilityStorageKey('b'))).toBeNull();
    expect(useAccountabilityStore.getState().profile.enabled).toBe(false);
  });
});
