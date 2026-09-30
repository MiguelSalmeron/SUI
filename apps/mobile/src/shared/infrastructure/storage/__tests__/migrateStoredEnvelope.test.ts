import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateStoredEnvelope } from '../migrateStoredEnvelope';
import { runStorageTask } from '../storageTasks';

const parse = (raw: string): { ids: string[] } | null => {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value.ids) ? value : null;
  } catch {
    return null;
  }
};
const migrate = () =>
  migrateStoredEnvelope({
    sourceKey: 'source',
    targetKey: 'target',
    parse,
    merge: (source, target) => ({ ids: [...new Set([...source.ids, ...target.ids])] }),
  });
const sourceRaw = JSON.stringify({ ids: ['a'] });

const originalRead = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const originalWrite = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
const originalRemove = jest.mocked(AsyncStorage.removeItem).getMockImplementation()!;
const resetStorageMocks = () => {
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(originalRead);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(originalWrite);
  jest.mocked(AsyncStorage.removeItem).mockReset().mockImplementation(originalRemove);
};

describe('migración verificada de sobres', () => {
  beforeEach(async () => {
    resetStorageMocks();
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    await AsyncStorage.setItem('source', sourceRaw);
  });
  afterEach(resetStorageMocks);

  it('verifica copia antes de limpiar origen', async () => {
    await migrate();
    expect(await AsyncStorage.getItem('target')).toBe(sourceRaw);
    expect(await AsyncStorage.getItem('source')).toBeNull();
  });

  it.each(['source', 'target'])('conserva ambas claves si %s es inválido', async (key) => {
    await AsyncStorage.setItem(key, '{invalid');
    await expect(migrate()).rejects.toThrow('Invalid migration');
    expect(await AsyncStorage.getItem('source')).not.toBeNull();
    if (key === 'target') expect(await AsyncStorage.getItem('target')).toBe('{invalid');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('no limpia origen cuando la escritura falla', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Disco lleno'));
    await expect(migrate()).rejects.toThrow('Disco lleno');
    expect(await AsyncStorage.getItem('source')).toBe(sourceRaw);
  });

  it('conserva origen si destino escrito no coincide', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockResolvedValueOnce();
    await expect(migrate()).rejects.toThrow('Migration verification failed');
    expect(await AsyncStorage.getItem('source')).toBe(sourceRaw);
  });

  it('conserva origen si falla lectura de verificación', async () => {
    const read = originalRead;
    let reads = 0;
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      if (key === 'target' && ++reads === 2) throw new Error('Lectura fallida');
      return read(key);
    });
    await expect(migrate()).rejects.toThrow('Lectura fallida');
    expect(await read('source')).toBe(sourceRaw);
  });

  it('no borra origen actualizado durante migración', async () => {
    const write = originalWrite;
    jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
      await write(key, value);
      if (key === 'target') await write('source', JSON.stringify({ ids: ['b'] }));
    });
    await expect(migrate()).rejects.toThrow('Migration source changed');
    expect(await AsyncStorage.getItem('source')).toContain('b');
  });

  it('reintento tras fallo de limpieza no duplica datos', async () => {
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('Limpieza fallida'));
    await expect(migrate()).rejects.toThrow('Limpieza fallida');
    expect(await AsyncStorage.getItem('source')).toBe(sourceRaw);
    await migrate();
    expect(parse((await AsyncStorage.getItem('target'))!)).toEqual({ ids: ['a'] });
    expect(await AsyncStorage.getItem('source')).toBeNull();
  });

  it('UID idéntico no lee ni borra', async () => {
    await migrateStoredEnvelope({
      sourceKey: 'source',
      targetKey: 'source',
      parse,
      merge: (s) => s,
    });
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('espera escritura anterior sin bloquear otro namespace', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = runStorageTask(['target'], async () => {
      await gate;
      await AsyncStorage.setItem('target', JSON.stringify({ ids: ['b'] }));
    });
    const migration = migrate();
    await runStorageTask(['other'], async () => {
      await AsyncStorage.setItem('other', 'ok');
    });
    expect(await AsyncStorage.getItem('source')).toBe(sourceRaw);
    release();
    await first;
    await migration;
    expect(parse((await AsyncStorage.getItem('target'))!)).toEqual({ ids: ['a', 'b'] });
  });
});
