let pending: Promise<unknown> = Promise.resolve();

export const runNotificationTask = <T>(operation: () => Promise<T>): Promise<T> => {
  const task = pending.catch(() => undefined).then(operation);
  pending = task;
  return task;
};
