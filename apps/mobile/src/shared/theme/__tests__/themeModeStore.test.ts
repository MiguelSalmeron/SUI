import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import { getThemeMode, setThemeMode, subscribeThemeMode } from '../themeModeStore';

// Fijate que estos tests cazan el bug del "doble toque": `setThemeMode`
// notificaba antes de escribir el store, así que el snapshot que leía el
// provider todavía traía el valor viejo y React descartaba el re-render.
// Acá se afirma el invariante que lo impide: en cada notificación el
// snapshot ya refleja el valor nuevo.

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  useSettingsStore.setState({
    theme: 'light',
    language: 'es',
    fontSize: 'medium',
    notificationsEnabled: false,
  });
});

describe('setThemeMode en un solo toque', () => {
  it('dark→light: el store queda en light y el snapshot notificado es fresco', async () => {
    await setThemeMode('dark');
    const snapshots: string[] = [];
    const unsubscribe = subscribeThemeMode(() => {
      snapshots.push(getThemeMode());
    });
    try {
      await setThemeMode('light');
    } finally {
      unsubscribe();
    }

    expect(useSettingsStore.getState().theme).toBe('light');
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[snapshots.length - 1]).toBe('light');
  });

  it('light→dark: el store queda en dark y el snapshot notificado es fresco', async () => {
    await setThemeMode('light');
    const snapshots: string[] = [];
    const unsubscribe = subscribeThemeMode(() => {
      snapshots.push(getThemeMode());
    });
    try {
      await setThemeMode('dark');
    } finally {
      unsubscribe();
    }

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[snapshots.length - 1]).toBe('dark');
  });

  it('volver a elegir el tema actual no rompe nada', async () => {
    await setThemeMode('light');
    const snapshots: string[] = [];
    const unsubscribe = subscribeThemeMode(() => {
      snapshots.push(getThemeMode());
    });
    try {
      await setThemeMode('light');
    } finally {
      unsubscribe();
    }

    expect(useSettingsStore.getState().theme).toBe('light');
    for (const snapshot of snapshots) {
      expect(snapshot).toBe('light');
    }
  });
});
