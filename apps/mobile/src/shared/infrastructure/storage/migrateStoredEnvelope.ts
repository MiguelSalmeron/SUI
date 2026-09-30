import AsyncStorage from '@react-native-async-storage/async-storage';
import { runStorageTask } from './storageTasks';

export const migrateStoredEnvelope = async <T>({
  sourceKey,
  targetKey,
  parse,
  merge,
}: {
  sourceKey: string;
  targetKey: string;
  parse: (raw: string) => T | null;
  merge: (source: T, target: T) => T;
}): Promise<void> => {
  if (sourceKey === targetKey) return;
  await runStorageTask([sourceKey, targetKey], async () => {
    const sourceRaw = await AsyncStorage.getItem(sourceKey);
    if (sourceRaw === null) return;
    const source = parse(sourceRaw);
    if (!source) throw new Error('Invalid migration source');
    const targetRaw = await AsyncStorage.getItem(targetKey);
    const target = targetRaw === null ? null : parse(targetRaw);
    if (targetRaw !== null && !target) throw new Error('Invalid migration target');
    const expected = JSON.stringify(target ? merge(source, target) : source);
    if (!parse(expected)) throw new Error('Invalid migration result');
    await AsyncStorage.setItem(targetKey, expected);
    const stored = await AsyncStorage.getItem(targetKey);
    if (stored !== expected || !parse(stored)) throw new Error('Migration verification failed');
    if ((await AsyncStorage.getItem(sourceKey)) !== sourceRaw)
      throw new Error('Migration source changed');
    await AsyncStorage.removeItem(sourceKey);
  });
};
