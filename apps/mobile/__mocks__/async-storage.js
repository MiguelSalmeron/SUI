const store = new Map();

const AsyncStorageMock = {
  getItem: jest.fn(async (key) => {
    return store.has(key) ? store.get(key) : null;
  }),
  setItem: jest.fn(async (key, value) => {
    store.set(key, String(value));
  }),
  removeItem: jest.fn(async (key) => {
    store.delete(key);
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(store.keys())),
  multiGet: jest.fn(async (keys) => keys.map((key) => [key, store.get(key) ?? null])),
  multiSet: jest.fn(async (pairs) => {
    pairs.forEach(([key, value]) => store.set(key, String(value)));
  }),
  multiRemove: jest.fn(async (keys) => {
    keys.forEach((key) => store.delete(key));
  }),
  __reset: () => {
    store.clear();
    Object.values(AsyncStorageMock).forEach((value) => {
      if (typeof value === 'function' && value.mockClear) {
        value.mockClear();
      }
    });
  },
};

module.exports = AsyncStorageMock;
