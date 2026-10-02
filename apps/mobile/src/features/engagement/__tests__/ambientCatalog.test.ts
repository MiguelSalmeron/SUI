import { buildAmbientCandidates } from '../model/ambientCatalog';

const goal = (
  id: string,
  title: string,
  progress: number,
  pendingMilestones: number,
  deadlineInDays?: number,
) => ({
  id,
  title,
  progress,
  pendingMilestones,
  ...(deadlineInDays !== undefined ? { deadlineInDays } : {}),
});

const habit = (id: string, title: string, streak = 0, plannedTime?: string) => ({
  id,
  title,
  streak,
  ...(plannedTime ? { plannedTime } : {}),
});

describe('ambientCatalog', () => {
  it('sin sujetos no produce candidatos: nunca relleno vacío', () => {
    expect(buildAmbientCandidates({ goals: [], habitsDue: [], hasActivity: false })).toEqual([]);
  });

  it('ancla cada fuente a un sujeto y limita el título', () => {
    const candidates = buildAmbientCandidates({
      goals: [goal('g1', 'X'.repeat(200), 40, 1, 2)],
      habitsDue: [habit('h1', 'Leer', 5, '19:00')],
      hasActivity: false,
    });
    const sources = candidates.map((candidate) => candidate.source);
    expect(sources).toContain('habit_due');
    expect(sources).toContain('habit_planned');
    expect(sources).toContain('streak');
    expect(sources).toContain('goal_progress');
    expect(sources).toContain('goal_deadline');
    expect(sources).toContain('inactivity');
    expect(sources).toContain('briefing');
    expect(sources).toContain('midday_focus');
    expect(sources).toContain('afternoon_check');
    expect(sources).toContain('evening_review');
    expect(sources).toContain('reflection');
    for (const candidate of candidates) {
      if (typeof candidate.values.title === 'string') {
        expect(candidate.values.title.length).toBeLessThanOrEqual(60);
      }
      expect(candidate.subjectId).toBeTruthy();
    }
  });

  it('en días futuros solo usa fuentes estables', () => {
    const candidates = buildAmbientCandidates({
      goals: [goal('g1', 'Portafolio', 40, 1)],
      habitsDue: [habit('h1', 'Leer', 5)],
      hasActivity: false,
      stableOnly: true,
    });
    const sources = candidates.map((candidate) => candidate.source);
    expect(sources).not.toContain('habit_due');
    expect(sources).not.toContain('habit_planned');
    expect(sources).not.toContain('streak');
    expect(sources).not.toContain('inactivity');
    expect(sources).toContain('briefing');
    expect(sources).toContain('midday_focus');
    expect(sources).toContain('afternoon_check');
    expect(sources).toContain('evening_review');
    expect(sources).toContain('reflection');
  });

  it('omite inactividad cuando ya hubo interacción hoy', () => {
    const candidates = buildAmbientCandidates({
      goals: [goal('g1', 'Portafolio', 40, 1)],
      habitsDue: [],
      hasActivity: true,
    });
    expect(candidates.map((candidate) => candidate.source)).not.toContain('inactivity');
  });

  it('omite el hábito planeado cuando no hay hora definida', () => {
    const candidates = buildAmbientCandidates({
      goals: [],
      habitsDue: [habit('h1', 'Leer', 1)],
      hasActivity: true,
    });
    expect(candidates.map((candidate) => candidate.source)).not.toContain('habit_planned');
  });
});
