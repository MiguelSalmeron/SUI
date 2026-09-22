import { getMirrorPreferences, useSettingsStore } from '../useSettingsStore';

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
