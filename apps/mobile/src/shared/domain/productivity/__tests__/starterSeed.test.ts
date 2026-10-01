/**
 * Siembra de arranque del primer ingreso.
 *
 * Se prueba sobre el store real y no sobre un doble porque lo que importa acá
 * es la interacción entre el candado de `useIntroStore`, las marcas de ejemplo
 * y las validaciones de `addGoal`/`addHabit`. La persistencia y el sync van
 * mockeados: acá no hay disco ni nube.
 */

jest.mock('@/shared/infrastructure/firebase/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

import { useIntroStore } from '@/shared/account/useIntroStore';
import type { TranslationKey } from '@/shared/i18n/translations';
import { localDateKey } from '../model/homeStorage';
import { STARTER_KITS } from '../model/starterKits';
import { useProductivityStore } from '../store/useProductivityStore';

const resolve = (key: TranslationKey) => key;

const emptyState = () => ({
  goals: [],
  habits: [],
  streak: 0,
  lastCompletedDate: undefined,
  lastResetDate: undefined,
  weeklyHistory: [],
  totalXp: 0,
  seededGoalIds: [],
  seededHabitIds: [],
});

describe('seedStarterData', () => {
  beforeEach(() => {
    useProductivityStore.setState(emptyState());
    useIntroStore.setState({ starterSeededAt: null, seededIntention: null });
  });

  it('siembra la meta del kit meta con sus hitos pendientes', () => {
    useProductivityStore.getState().seedStarterData('goal', resolve);

    const { goals, habits } = useProductivityStore.getState();
    expect(goals).toHaveLength(1);
    expect(habits).toHaveLength(0);
    expect(goals[0].title).toBe('onboarding.seed.goalTitle');
    expect(goals[0].milestones).toHaveLength(3);
    expect(goals[0].milestones.every((milestone) => !milestone.completed)).toBe(true);
    expect(goals[0].completed).toBe(false);
    expect(goals[0].progress).toBe(0);
  });

  it('siembra el hábito del kit hábito con su hora', () => {
    useProductivityStore.getState().seedStarterData('habit', resolve);

    const { habits } = useProductivityStore.getState();
    expect(habits).toHaveLength(1);
    expect(habits[0].plannedTime).toBe('20:00');
    expect(habits[0].completed).toBe(false);
    expect(habits[0].streak).toBe(0);
  });

  it('nunca siembra progreso, racha ni historial', () => {
    useProductivityStore.getState().seedStarterData('explore', resolve);

    const state = useProductivityStore.getState();
    expect(state.goals.every((goal) => !goal.completed)).toBe(true);
    expect(state.habits.every((habit) => !habit.completed)).toBe(true);
    expect(state.habits.every((habit) => habit.streak === 0)).toBe(true);
    expect(state.totalXp).toBe(0);
    expect(state.weeklyHistory).toEqual([]);
    expect(state.streak).toBe(0);
  });

  it('apaga el espejo de Google en todo lo sembrado', () => {
    // El default de addGoal es mirrorToGoogle: true. Si la siembra no lo
    // fuerza, "Terminar mi proyecto personal" aparece en el calendario real.
    useProductivityStore.getState().seedStarterData('goal', resolve);

    expect(useProductivityStore.getState().goals[0].mirrorToGoogle).toBe(false);
  });

  it('marca lo sembrado y lo expone con isSeeded', () => {
    useProductivityStore.getState().seedStarterData('explore', resolve);

    const state = useProductivityStore.getState();
    expect(state.isSeeded(state.goals[0].id)).toBe(true);
    expect(state.isSeeded(state.habits[0].id)).toBe(true);
    expect(state.isSeeded('goal-inexistente')).toBe(false);
  });

  it('no siembra dos veces aunque se llame de nuevo', () => {
    useProductivityStore.getState().seedStarterData('goal', resolve);

    useProductivityStore.getState().seedStarterData('goal', resolve);

    expect(useProductivityStore.getState().goals).toHaveLength(1);
  });

  it('no siembra si el usuario ya tiene datos propios', () => {
    useProductivityStore.getState().addGoal({ title: 'Mi meta real', deadline: '2026-10-10' });

    useProductivityStore.getState().seedStarterData('goal', resolve);

    const { goals } = useProductivityStore.getState();
    expect(goals).toHaveLength(1);
    expect(goals[0].title).toBe('Mi meta real');
    expect(useIntroStore.getState().starterSeededAt).toBeNull();
  });

  it('el kit de agenda vence hoy para que la línea de tiempo lo muestre ya', () => {
    useProductivityStore.getState().seedStarterData('agenda', resolve);

    const { goals, habits } = useProductivityStore.getState();
    expect(goals[0].deadline).toBe(localDateKey());
    expect(habits[0].plannedTime).toBe('09:00');
  });

  it('el kit meta vence en una semana, no hoy', () => {
    useProductivityStore.getState().seedStarterData('goal', resolve);

    expect(useProductivityStore.getState().goals[0].deadline).not.toBe(localDateKey());
    expect(STARTER_KITS.goal.goals[0].deadlineOffsetDays).toBe(7);
  });

  it('la meta sembrada impacta hoy para que el timeline del día la muestre', () => {
    // Sin esto la meta existe en el store pero es invisible en Inicio: el
    // timeline sólo levanta metas que vencen hoy o lo impactan.
    useProductivityStore.getState().seedStarterData('goal', resolve);

    const goal = useProductivityStore.getState().goals[0];
    expect(goal.impactDays).toContain(localDateKey());
    expect(goal.impactDays).toContain(goal.deadline);
  });

  it('la meta de agenda impacta hoy sin duplicar el día', () => {
    useProductivityStore.getState().seedStarterData('agenda', resolve);

    const goal = useProductivityStore.getState().goals[0];
    expect(goal.deadline).toBe(localDateKey());
    expect(goal.impactDays).toEqual([localDateKey()]);
  });

  it('marca el sembrado en useIntroStore con la intención usada', () => {
    useProductivityStore.getState().seedStarterData('habit', resolve);

    expect(useIntroStore.getState().starterSeededAt).not.toBeNull();
    expect(useIntroStore.getState().seededIntention).toBe('habit');
  });

  it('no vincula hábito con meta para no sumar avance que el usuario no generó', () => {
    useProductivityStore.getState().seedStarterData('explore', resolve);

    expect(useProductivityStore.getState().habits[0].linkedGoalId).toBeNull();
  });
});

describe('dismissSeeded', () => {
  beforeEach(() => {
    useProductivityStore.setState(emptyState());
    useIntroStore.setState({ starterSeededAt: null, seededIntention: null });
  });

  it('borra el ejemplo y su marca', () => {
    useProductivityStore.getState().seedStarterData('goal', resolve);
    const id = useProductivityStore.getState().goals[0].id;

    useProductivityStore.getState().dismissSeeded(id);

    const state = useProductivityStore.getState();
    expect(state.goals).toHaveLength(0);
    expect(state.isSeeded(id)).toBe(false);
  });

  it('no vuelve a sembrar después de descartar', () => {
    useProductivityStore.getState().seedStarterData('goal', resolve);
    useProductivityStore.getState().dismissSeeded(useProductivityStore.getState().goals[0].id);

    useProductivityStore.getState().seedStarterData('goal', resolve);

    expect(useProductivityStore.getState().goals).toHaveLength(0);
  });

  it('no toca entidades que nunca fueron ejemplos', () => {
    const id = useProductivityStore.getState().addGoal({
      title: 'Ajena',
      deadline: '2026-10-10',
    });

    useProductivityStore.getState().dismissSeeded(id as string);

    expect(useProductivityStore.getState().goals).toHaveLength(1);
  });
});

describe('personalizeSeeded', () => {
  beforeEach(() => {
    useProductivityStore.setState(emptyState());
    useIntroStore.setState({ starterSeededAt: null, seededIntention: null });
  });

  it('quita la marca conservando el dato', () => {
    useProductivityStore.getState().seedStarterData('goal', resolve);
    const id = useProductivityStore.getState().goals[0].id;

    useProductivityStore.getState().personalizeSeeded(id);

    const state = useProductivityStore.getState();
    expect(state.isSeeded(id)).toBe(false);
    expect(state.goals).toHaveLength(1);
  });

  it('no toca entidades que nunca fueron ejemplos', () => {
    const id = useProductivityStore.getState().addGoal({
      title: 'Ajena',
      deadline: '2026-10-10',
    });
    expect(id).not.toBeNull();

    useProductivityStore.getState().personalizeSeeded(id as string);

    expect(useProductivityStore.getState().isSeeded(id as string)).toBe(false);
    expect(useProductivityStore.getState().goals).toHaveLength(1);
  });
});
