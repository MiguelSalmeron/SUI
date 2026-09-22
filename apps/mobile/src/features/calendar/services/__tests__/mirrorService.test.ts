jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));
jest.mock('expo-localization', () => ({ getCalendars: () => [] }));
jest.mock('../googleConnectionApi', () => ({
  ConnectionApiError: class extends Error {},
  getGoogleCalendarConnectionStatus: jest.fn(async () => false),
  googleCalendarApiConfigured: jest.fn(() => false),
  mirrorDelete: jest.fn(),
  mirrorUpsert: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collectMirrorCandidates,
  enqueueMirror,
  pruneMirrorQueue,
} from '../mirrorService';

describe('mirrorService candidates', () => {
  it('incluye metas con fecha y excluye checklist sin hora', () => {
    const jobs = collectMirrorCandidates(
      [
        {
          id: 'goal-1',
          title: 'Meta',
          deadline: '2026-09-20',
          progress: 0,
          milestones: [],
          completed: false,
          gravity: 'low',
          createdAt: '2026-09-01',
        } as never,
        {
          id: 'goal-2',
          title: 'Sin espejo',
          deadline: '2026-09-20',
          progress: 0,
          milestones: [],
          completed: false,
          gravity: 'low',
          createdAt: '2026-09-01',
          mirrorToGoogle: false,
        } as never,
      ],
      [
        {
          id: 'habit-1',
          title: 'Agua',
          completed: false,
          frequency: 'daily',
          streak: 0,
          createdAt: '2026-09-01',
        } as never,
      ],
    );
    expect(jobs).toEqual([{ suiId: 'goal-1', suiType: 'goal', operation: 'upsert' }]);
  });

  it('incluye hábito con hora y flag', () => {
    const jobs = collectMirrorCandidates(
      [],
      [
        {
          id: 'habit-2',
          title: 'Gym',
          completed: false,
          frequency: ['mon', 'wed'],
          streak: 0,
          createdAt: '2026-09-01',
          plannedTime: '07:30',
          mirrorToGoogle: true,
        } as never,
      ],
      { goalsEnabled: true, habitsEnabled: true },
    );
    expect(jobs).toEqual([{ suiId: 'habit-2', suiType: 'habit', operation: 'upsert' }]);
  });

  it('prefs apagadas excluyen su categoría', () => {
    const goals = [
      {
        id: 'goal-9',
        title: 'Meta',
        deadline: '2026-09-20',
        progress: 0,
        milestones: [],
        completed: false,
        gravity: 'low',
        createdAt: '2026-09-01',
      } as never,
    ];
    expect(collectMirrorCandidates(goals, [], { goalsEnabled: false, habitsEnabled: false })).toEqual(
      [],
    );
    expect(collectMirrorCandidates(goals, [])).toEqual([
      { suiId: 'goal-9', suiType: 'goal', operation: 'upsert' },
    ]);
  });

  it('prune elimina upserts podados pero conserva deletes', async () => {
    const mocked = AsyncStorage as unknown as { __reset: () => void };
    mocked.__reset();
    await enqueueMirror({ suiId: 'goal-1', suiType: 'goal', operation: 'upsert' });
    await enqueueMirror({ suiId: 'goal-2', suiType: 'goal', operation: 'delete' });
    await enqueueMirror({ suiId: 'habit-1', suiType: 'habit', operation: 'upsert' });
    await pruneMirrorQueue(
      (job) => job.operation === 'upsert' && job.suiType === 'goal',
    );
    const raw = await AsyncStorage.getItem('@sui/mirror-queue-v1');
    expect(JSON.parse(raw ?? '[]')).toEqual([
      { suiId: 'goal-2', suiType: 'goal', operation: 'delete' },
      { suiId: 'habit-1', suiType: 'habit', operation: 'upsert' },
    ]);
  });
});
