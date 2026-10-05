jest.mock('@/shared/infrastructure/firebase/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));

import { useProductivityStore } from '@/shared/domain/productivity/public';
import { appEventBus } from '@/shared/events/appEventBus';
import type { FocusTarget } from '../focusTypes';
import { completeFocusTarget, resolveFocusTarget } from '../completeFocusTarget';

const milestoneTarget: FocusTarget = { kind: 'milestone', goalId: 'g1', milestoneId: 'm1' };
const habitTarget: FocusTarget = { kind: 'habit', habitId: 'h1' };
const goalTarget: FocusTarget = { kind: 'goal', goalId: 'g1' };

beforeEach(() => {
  useProductivityStore.setState({
    goals: [
      {
        id: 'g1',
        title: 'Preparar proyecto',
        deadline: '2026-10-04',
        progress: 0,
        completed: false,
        gravity: 'high',
        createdAt: '2026-10-01',
        milestones: [
          { id: 'm1', title: 'Definir alcance', completed: false },
          { id: 'm2', title: 'Entregar', completed: false },
        ],
      },
    ],
    habits: [
      {
        id: 'h1',
        title: 'Leer',
        frequency: 'daily',
        completed: false,
        streak: 0,
        createdAt: '2026-10-01',
      },
    ],
  });
});

afterEach(() => jest.restoreAllMocks());

it('doble completar hito cambia una sola vez; no completa meta ni segundo hito', () => {
  const listener = jest.fn();
  const off = appEventBus.on('productivity.milestoneCompleted', listener);
  try {
    expect(completeFocusTarget(milestoneTarget)).toBe('completed');
    expect(completeFocusTarget(milestoneTarget)).toBe('already_done');
    expect(useProductivityStore.getState().goals[0]).toMatchObject({
      completed: false,
      progress: 50,
      milestones: [{ completed: true }, { completed: false }],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    off();
  }
});

it('último hito completa meta con acción existente; repetir no reabre', () => {
  completeFocusTarget(milestoneTarget);
  const last: FocusTarget = { ...milestoneTarget, milestoneId: 'm2' };
  expect(completeFocusTarget(last)).toBe('completed');
  expect(completeFocusTarget(last)).toBe('already_done');
  expect(useProductivityStore.getState().goals[0]).toMatchObject({
    progress: 100,
    completed: true,
  });
});

it('doble completar hábito emite una vez y aumenta racha una vez', () => {
  const listener = jest.fn();
  const off = appEventBus.on('productivity.habitCompleted', listener);
  try {
    expect(completeFocusTarget(habitTarget)).toBe('completed');
    expect(completeFocusTarget(habitTarget)).toBe('already_done');
    expect(useProductivityStore.getState().habits[0]).toMatchObject({ completed: true, streak: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    off();
  }
});

it('lee estado actual después de completar desde otra pantalla', () => {
  expect(resolveFocusTarget(habitTarget).status).toBe('pending');
  useProductivityStore.getState().toggleHabit('h1');
  const state = useProductivityStore.getState();
  expect(completeFocusTarget(habitTarget)).toBe('already_done');
  expect(useProductivityStore.getState()).toBe(state);
});

it.each([true, false])('no completa meta entera, sin hitos: %s', (empty) => {
  if (empty)
    useProductivityStore.setState({
      goals: [{ ...useProductivityStore.getState().goals[0], milestones: [] }],
    });
  const state = useProductivityStore.getState();
  expect(completeFocusTarget(goalTarget)).toBe('not_completable');
  expect(useProductivityStore.getState()).toBe(state);
});

it('meta completada devuelve already_done aunque tenga hitos pendientes', () => {
  useProductivityStore.getState().toggleGoal('g1');
  const state = useProductivityStore.getState();
  expect(completeFocusTarget(goalTarget)).toBe('already_done');
  expect(completeFocusTarget(milestoneTarget)).toBe('already_done');
  expect(resolveFocusTarget(milestoneTarget).status).toBe('done');
  expect(useProductivityStore.getState()).toBe(state);
});

it.each<FocusTarget>([
  { kind: 'goal', goalId: 'ausente' },
  { kind: 'habit', habitId: 'ausente' },
  { kind: 'milestone', goalId: 'ausente', milestoneId: 'm1' },
  { kind: 'milestone', goalId: 'g1', milestoneId: 'ausente' },
])('devuelve missing sin efectos para %j', (target) => {
  const state = useProductivityStore.getState();
  expect(resolveFocusTarget(target)).toEqual({ status: 'missing' });
  expect(completeFocusTarget(target)).toBe('missing');
  expect(useProductivityStore.getState()).toBe(state);
});

it('detecta eliminación tras resolver objetivo', () => {
  expect(resolveFocusTarget(milestoneTarget).status).toBe('pending');
  useProductivityStore.getState().removeGoal('g1');
  expect(completeFocusTarget(milestoneTarget)).toBe('missing');
});

it('resolve devuelve títulos actuales sin mutar estado', () => {
  const state = useProductivityStore.getState();
  expect(resolveFocusTarget(milestoneTarget)).toEqual({
    status: 'pending',
    title: 'Definir alcance',
    parentTitle: 'Preparar proyecto',
  });
  expect(resolveFocusTarget(goalTarget)).toEqual({ status: 'pending', title: 'Preparar proyecto' });
  expect(resolveFocusTarget(habitTarget)).toEqual({ status: 'pending', title: 'Leer' });
  expect(useProductivityStore.getState()).toBe(state);
  useProductivityStore.setState({ habits: [{ ...state.habits[0], title: 'Leer un capítulo' }] });
  expect(resolveFocusTarget(habitTarget)).toEqual({ status: 'pending', title: 'Leer un capítulo' });
});

it('resolve reconoce hito y hábito completados', () => {
  completeFocusTarget(milestoneTarget);
  completeFocusTarget(habitTarget);
  expect(resolveFocusTarget(milestoneTarget)).toEqual({
    status: 'done',
    title: 'Definir alcance',
    parentTitle: 'Preparar proyecto',
  });
  expect(resolveFocusTarget(habitTarget)).toEqual({ status: 'done', title: 'Leer' });
});

it('rechaza hito de otra meta sin cambiar ninguna', () => {
  const first = useProductivityStore.getState().goals[0];
  useProductivityStore.setState({
    goals: [
      first,
      { ...first, id: 'g2', milestones: [{ id: 'otro', title: 'Otro', completed: false }] },
    ],
  });
  const state = useProductivityStore.getState();
  expect(completeFocusTarget({ kind: 'milestone', goalId: 'g2', milestoneId: 'm1' })).toBe(
    'missing',
  );
  expect(useProductivityStore.getState()).toBe(state);
});
