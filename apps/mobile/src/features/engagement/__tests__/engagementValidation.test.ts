import {
  EMPTY_ENGAGEMENT_ENVELOPE,
  type EngagementEnvelopeV1,
  type EngagementFact,
} from '../model/engagementTypes';
import { parseEngagementEnvelopeV1 } from '../model/engagementValidation';

const valid = (): EngagementEnvelopeV1 => ({
  ...EMPTY_ENGAGEMENT_ENVELOPE('2026-09-01T00:00:00.000Z'),
  slots: [{ id: '2026-09-08:600', dayKey: '2026-09-08', startMinute: 600, status: 'planned' }],
  facts: [],
});

describe('engagementValidation', () => {
  it('acepta un sobre v1 válido (objeto y JSON)', () => {
    expect(parseEngagementEnvelopeV1(valid())).not.toBeNull();
    expect(parseEngagementEnvelopeV1(JSON.stringify(valid()))).not.toBeNull();
  });

  it('rechaza versión distinta, campos extra y JSON roto', () => {
    expect(parseEngagementEnvelopeV1({ ...valid(), schemaVersion: 2 })).toBeNull();
    expect(parseEngagementEnvelopeV1({ ...valid(), extra: true })).toBeNull();
    expect(parseEngagementEnvelopeV1('{no-es-json')).toBeNull();
    expect(parseEngagementEnvelopeV1({ ...valid(), profile: {} })).toBeNull();
  });

  it('rechaza hechos que cuelgan de franjas inexistentes', () => {
    const fact: EngagementFact = {
      id: 'x:opened',
      slotId: 'fantasma:600',
      kind: 'opened',
      occurredAt: '2026-09-08T10:00:00.000Z',
      source: 'notification',
    };
    expect(parseEngagementEnvelopeV1({ ...valid(), facts: [fact] })).toBeNull();
  });
});
