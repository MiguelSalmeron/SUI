import AsyncStorage from '@react-native-async-storage/async-storage';

// Clave única del estado del tablero (compartida con HomeScreen).
export const HOME_STATE_KEY = 'sui-home-state-v4';

export interface HomeListItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface HomeState {
  goals: HomeListItem[];
  habits: HomeListItem[];
  pomodoroMinutes: number;
  pomodoroSessions: number;
}

const makeItem = (title: string, index: number): HomeListItem => ({
  id: `onboarding-${index}-${title.toLowerCase().replace(/\s+/g, '-')}`,
  title,
  completed: false,
});

/**
 * Siembra las metas elegidas en el onboarding dentro del estado local del
 * tablero, para que la selección guiada tenga efecto visible en Home.
 * Es idempotente: no duplica si ya existen metas guardadas.
 */
export const seedOnboardingGoals = async (goalLabels: string[]): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(HOME_STATE_KEY);
    const existing: Partial<HomeState> = raw ? JSON.parse(raw) : {};

    // Si el usuario ya tiene metas, no sobrescribimos su trabajo.
    if (existing.goals && existing.goals.length > 0) {
      return;
    }

    const merged: HomeState = {
      goals: goalLabels.map(makeItem),
      habits: existing.habits ?? [],
      pomodoroMinutes: existing.pomodoroMinutes ?? 25,
      pomodoroSessions: existing.pomodoroSessions ?? 0,
    };

    await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn('No se pudieron sembrar las metas del onboarding:', error);
  }
};
