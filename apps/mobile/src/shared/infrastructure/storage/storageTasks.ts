const pending = new Map<string, Promise<unknown>>();

export const runStorageTask = <T>(keys: string[], operation: () => Promise<T>): Promise<T> => {
  const uniqueKeys = [...new Set(keys)];
  const previous = uniqueKeys.map((key) => pending.get(key)?.catch(() => undefined));
  const task = Promise.all(previous).then(operation);
  for (const key of uniqueKeys) pending.set(key, task);
  const cleanup = () => {
    for (const key of uniqueKeys) {
      if (pending.get(key) === task) pending.delete(key);
    }
  };
  void task.then(cleanup, cleanup);
  return task;
};
