import { applyUserPreferences, getMirrorPreferences, useSettingsStore } from '../useSettingsStore';

describe('useSettingsStore mirror prefs', () => {
  beforeEach(() => {
    useSettingsStore.setState({ mirrorGoalsEnabled: true, mirrorHabitsEnabled: false });
  });

  it('defaults: metas on, hábitos off', () => {
    const state = useSettingsStore.getState();
    expect(state.mirrorGoalsEnabled).toBe(true);
    expect(state.mirrorHabitsEnabled).toBe(false);
    expect(getMirrorPreferences()).toEqual({ goalsEnabled: true, habitsEnabled: false });
  });

  it('setters actualizan y se reflejan en prefs', () => {
    useSettingsStore.getState().setMirrorGoalsEnabled(false);
    useSettingsStore.getState().setMirrorHabitsEnabled(true);
    expect(getMirrorPreferences()).toEqual({ goalsEnabled: false, habitsEnabled: true });
  });
});

describe('applyUserPreferences respeta la apariencia local', () => {
  beforeEach(() => {
    // Base explícita del dispositivo: claro + español, como deja Ajustes.
    useSettingsStore.setState({
      theme: 'light',
      language: 'es',
      fontSize: 'medium',
      notificationsEnabled: false,
    });
  });

  it('no pisa el tema local con el valor stale del sobre', () => {
    applyUserPreferences({ schemaVersion: 1, theme: 'dark' });
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('no pisa el idioma local con el valor stale del sobre', () => {
    applyUserPreferences({ schemaVersion: 1, language: 'en' });
    expect(useSettingsStore.getState().language).toBe('es');
  });

  it('sí aplica el resto del sobre (fontSize y notificaciones)', () => {
    // Acá el sobre trae de todo: lo de apariencia se ignora, el resto entra.
    applyUserPreferences({
      schemaVersion: 1,
      theme: 'dark',
      language: 'en',
      fontSize: 'large',
      notificationsEnabled: true,
    });
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('light');
    expect(state.language).toBe('es');
    expect(state.fontSize).toBe('large');
    expect(state.notificationsEnabled).toBe(true);
  });
});
