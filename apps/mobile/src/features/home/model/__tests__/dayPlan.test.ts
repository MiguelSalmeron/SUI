import { localDateKey } from '@/shared/domain/productivity/pure';
import { translations } from '@/shared/i18n/translations';
import type { Goal, Habit } from '@/shared/types/models';
import { buildDayPlan, type AvailableTime, type Energy } from '../dayPlan';

const now = new Date(2026, 9, 4, 10, 0);
const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  title: 'Preparar proyecto',
  deadline: '2026-10-20',
  progress: 0,
  milestones: [{ id: 'm1', title: 'Definir alcance', completed: false }],
  completed: false,
  gravity: 'low',
  createdAt: '2026-10-01',
  ...overrides,
});
const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  title: 'Leer',
  completed: false,
  frequency: 'daily',
  streak: 0,
  createdAt: '2026-10-01',
  ...overrides,
});
const plan = (overrides: Partial<Parameters<typeof buildDayPlan>[0]> = {}) =>
  buildDayPlan({ goals: [], habits: [], energy: 'normal', availableTime: null, now, ...overrides });
const deadlineIn = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};

it('devuelve vacío sin candidatos ni con fecha actual inválida', () => {
  expect(plan()).toEqual([]);
  expect(plan({ goals: [goal()], now: new Date(NaN) })).toEqual([]);
});

it('elige sólo primer hito pendiente; excluye metas terminadas e hitos agotados', () => {
  const goals = [
    goal({
      milestones: [
        { id: 'm0', title: 'Listo', completed: true },
        { id: 'm1', title: 'Ahora', completed: false },
        { id: 'm2', title: 'Después', completed: false },
      ],
    }),
    goal({ id: 'g2', completed: true }),
    goal({ id: 'g3', milestones: [{ id: 'm3', title: 'Listo', completed: true }] }),
  ];
  expect(plan({ goals })).toEqual([
    expect.objectContaining({
      id: 'milestone:g1:m1',
      title: 'Ahora',
      parentTitle: 'Preparar proyecto',
      target: { kind: 'milestone', goalId: 'g1', milestoneId: 'm1' },
    }),
  ]);
});

it('propone meta sin hitos como primer paso sin título padre', () => {
  expect(plan({ goals: [goal({ milestones: [] })] })).toEqual([
    {
      id: 'goal:g1',
      target: { kind: 'goal', goalId: 'g1' },
      title: 'Preparar proyecto',
      reasonKey: 'home.plan.reason.firstStep',
      blockMinutes: 25,
    },
  ]);
});

it('filtra hábitos completados y frecuencias semanales usando fecha recibida', () => {
  expect(
    plan({
      habits: [
        habit({ id: 'daily' }),
        habit({ id: 'sunday', frequency: ['sun'] }),
        habit({ id: 'monday', frequency: ['mon'] }),
        habit({ id: 'empty', frequency: [] }),
        habit({ id: 'done', completed: true }),
      ],
    }).map((step) => step.id),
  ).toEqual(['habit:daily', 'habit:sunday']);
});

it.each([
  [-1, 'overdue', undefined],
  [0, 'dueToday', undefined],
  [1, 'dueTomorrow', undefined],
  [2, 'dueSoon', { days: 2 }],
  [3, 'dueSoon', { days: 3 }],
  [7, 'dueSoon', { days: 7 }],
  [8, 'advanceGoal', undefined],
] as const)('aplica urgencia en límite %i días', (days, reason, params) => {
  const result = plan({ goals: [goal({ deadline: deadlineIn(days) })], habits: [habit()] });
  expect(result[days <= 2 ? 0 : 1].id).toBe('milestone:g1:m1');
  const step = result.find((item) => item.target.kind === 'milestone')!;
  expect(step.reasonKey).toBe(`home.plan.reason.${reason}`);
  expect(step.reasonParams).toEqual(params);
  if (params === undefined) expect(step).not.toHaveProperty('reasonParams');
});

it.each([
  [-1, 3, 'high', 'milestone:g1:m1'],
  [0, 1, 'high', 'milestone:g2:m1'],
  [1, 3, 'high', 'milestone:g1:m1'],
  [3, 8, 'high', 'milestone:g1:m1'],
  [8, 8, 'high', 'milestone:g2:m1'],
] as const)(
  'ordena urgencia %i frente a %i con gravedad %s',
  (first, second, gravity, expected) => {
    expect(
      plan({
        goals: [
          goal({ deadline: deadlineIn(first) }),
          goal({ id: 'g2', deadline: deadlineIn(second), gravity }),
        ],
      })[0].id,
    ).toBe(expected);
  },
);

it.each(['', 'inválida', '2026-02-30', '2026-13-01', '2026-1-04'])(
  'tolera fecha inválida %s sin urgencia ficticia',
  (deadline) => {
    const result = plan({ goals: [goal({ deadline })], habits: [habit()] });
    expect(result.map((step) => step.id)).toEqual(['habit:h1', 'milestone:g1:m1']);
    expect(result[1].reasonKey).toBe('home.plan.reason.advanceGoal');
  },
);

it.each([
  ['09:59', 'milestone:g1:m1'],
  ['10:00', 'habit:h1'],
  ['12:00', 'habit:h1'],
  ['12:01', 'milestone:g1:m1'],
  [undefined, 'milestone:g1:m1'],
  ['25:00', 'milestone:g1:m1'],
] as const)('prioriza hora %s con energía alta', (plannedTime, expected) => {
  const result = plan({
    energy: 'high',
    goals: [goal({ deadline: deadlineIn(3) })],
    habits: [habit({ plannedTime })],
  });
  expect(result[0].id).toBe(expected);
});

it('ordena hábitos por ventana, pasado y sin hora; conserva hora en motivo', () => {
  const result = plan({
    habits: [
      habit({ id: 'none' }),
      habit({ id: 'past', plannedTime: '09:00' }),
      habit({ id: 'soon', plannedTime: '12:00' }),
    ],
  });
  expect(result.map((step) => step.id)).toEqual(['habit:soon', 'habit:past', 'habit:none']);
  expect(result[0]).toMatchObject({
    reasonKey: 'home.plan.reason.habitAt',
    reasonParams: { time: '12:00' },
  });
  expect(result[2].reasonKey).toBe('home.plan.reason.habitToday');
});

it('energía cambia orden hábito/meta importante y duración', () => {
  const input = { goals: [goal({ gravity: 'high' })], habits: [habit()] };
  expect(plan({ ...input, energy: 'low' })[0]).toMatchObject({ id: 'habit:h1', blockMinutes: 15 });
  expect(plan(input)[0]).toMatchObject({ id: 'habit:h1', blockMinutes: 25 });
  expect(plan({ ...input, energy: 'high' })[0]).toMatchObject({
    id: 'milestone:g1:m1',
    blockMinutes: 50,
    reasonKey: 'home.plan.reason.important',
  });
});

it.each<Energy>(['low', 'normal', 'high'])('limita cantidad con energía %s', (energy) => {
  const habits = Array.from({ length: 5 }, (_, i) => habit({ id: `h${i}` }));
  const expected =
    energy === 'low' ? [2, 3, 3, 3] : energy === 'normal' ? [1, 2, 3, 3] : [1, 1, 2, 3];
  ([30, 60, 120, null] as AvailableTime[]).forEach((availableTime, i) => {
    expect(plan({ habits, energy, availableTime })).toHaveLength(expected[i]);
  });
});

it('desempata por fecha, hora, título e id independientemente del orden de entrada', () => {
  const goals = [
    goal({ id: 'g2', deadline: deadlineIn(2) }),
    goal({ id: 'g1', deadline: deadlineIn(1) }),
  ];
  expect(plan({ goals }).map((step) => step.id)).toEqual(['milestone:g1:m1', 'milestone:g2:m1']);
  const habits = [
    habit({ id: 'z', title: 'Z', plannedTime: '11:00' }),
    habit({ id: 'b', title: 'A', plannedTime: '10:00' }),
    habit({ id: 'a', title: 'A', plannedTime: '10:00' }),
  ];
  expect(plan({ habits }).map((step) => step.id)).toEqual(['habit:a', 'habit:b', 'habit:z']);
  expect(plan({ habits: [...habits].reverse() })).toEqual(plan({ habits }));
});

it('no muta entrada y repite resultado sin reloj global', () => {
  const goals = [goal()];
  Object.freeze(goals[0].milestones[0]);
  Object.freeze(goals[0].milestones);
  Object.freeze(goals[0]);
  Object.freeze(goals);
  const habits = [habit()];
  Object.freeze(habits[0]);
  Object.freeze(habits);
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('Reloj global prohibido');
  });
  try {
    expect(plan({ goals, habits })).toEqual(plan({ goals, habits }));
  } finally {
    clock.mockRestore();
  }
  expect(now).toEqual(new Date(2026, 9, 4, 10, 0));
});

it.each([new Date(2026, 9, 4, 0, 1), new Date(2026, 9, 4, 23, 59), new Date(2026, 2, 8, 23, 59)])(
  'usa fecha local cerca de medianoche y cambio horario: %s',
  (date) => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(plan({ now: date, goals: [goal({ deadline: localDateKey(date) })] })[0].reasonKey).toBe(
      'home.plan.reason.dueToday',
    );
    const nextDayStep = plan({ now: date, goals: [goal({ deadline: localDateKey(tomorrow) })] })[0];
    expect(nextDayStep.reasonKey).toBe('home.plan.reason.dueTomorrow');
    expect(nextDayStep).not.toHaveProperty('reasonParams');
  },
);

it('todos los motivos tienen traducción ES/EN con params coherentes', () => {
  const steps = [
    ...[-1, 0, 1, 2, 8].flatMap((days) => plan({ goals: [goal({ deadline: deadlineIn(days) })] })),
    ...plan({ goals: [goal({ gravity: 'high' })] }),
    ...plan({ goals: [goal({ milestones: [] })] }),
    ...plan({ habits: [habit(), habit({ id: 'timed', plannedTime: '11:00' })] }),
  ];
  expect(new Set(steps.map((step) => step.reasonKey)).size).toBe(9);
  for (const step of steps) {
    for (const locale of ['es', 'en'] as const) {
      const text = translations[locale][step.reasonKey];
      expect(typeof text).toBe('string');
      const params = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      expect(params).toEqual(Object.keys(step.reasonParams ?? {}).sort());
    }
  }
});
