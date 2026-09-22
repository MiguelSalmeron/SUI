import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ACCOUNTABILITY_STORAGE_KEY,
  MAX_CYCLES_PER_COMMITMENT,
  MAX_FACTS,
  EMPTY_ENVELOPE,
  type AccountabilityEnvelopeV1,
} from '../model/accountabilityTypes';
import {
  enforceRetention,
  getAccountabilityStorageKey,
  loadAccountability,
  migrateAccountabilityGuestToUser,
  writeAccountability,
} from '../services/accountabilityRepository';

const stamp = '2026-09-08T10:00:00.000Z';

const validEnvelope = (): AccountabilityEnvelopeV1 => ({
  ...EMPTY_ENVELOPE(stamp),
  profile: {
    ...EMPTY_ENVELOPE(stamp).profile,
    enabled: true,
    updatedAt: stamp,
  },
  commitments: [
    {
      id: 'acc:goal:g1',
      subjectType: 'goal',
      subjectId: 'g1',
      enabled: true,
      intensity: 'firm',
      nextAction: 'Ordenar imágenes del portafolio',
      schedule: { kind: 'daily', time: '19:00' },
      escalation: 'reschedule_or_minimum',
      createdAt: stamp,
      updatedAt: stamp,
    },
  ],
});

describe('accountability repository', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
  });

  it('usa clave con sufijo de uid y base para invitado', () => {
    expect(getAccountabilityStorageKey(null)).toBe(ACCOUNTABILITY_STORAGE_KEY);
    expect(getAccountabilityStorageKey('user-1')).toBe(`${ACCOUNTABILITY_STORAGE_KEY}:user-1`);
    expect(getAccountabilityStorageKey('  user-1  ')).toBe(`${ACCOUNTABILITY_STORAGE_KEY}:user-1`);
  });

  it('una instalación sin clave crea un estado vacío válido', async () => {
    const envelope = await loadAccountability(null);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.commitments).toEqual([]);
    expect(envelope.profile.enabled).toBe(false);
  });

  it('descarta corrupción y reconstruye desde vacío sin lanzar', async () => {
    await AsyncStorage.setItem(ACCOUNTABILITY_STORAGE_KEY, '{not-json');
    const envelope = await loadAccountability(null);
    expect(envelope.commitments).toEqual([]);
    // La clave corrupta fue removida.
    await expect(AsyncStorage.getItem(ACCOUNTABILITY_STORAGE_KEY)).resolves.toBeNull();
  });

  it('descarta un sobre con campos inválidos aunque el JSON sea válido', async () => {
    const corrupt = JSON.stringify({
      schemaVersion: 1,
      profile: { ...EMPTY_ENVELOPE(stamp).profile, enabled: 'yes', updatedAt: stamp },
      commitments: [],
      cycles: [],
      facts: [],
      updatedAt: stamp,
    });
    await AsyncStorage.setItem(ACCOUNTABILITY_STORAGE_KEY, corrupt);
    await expect(loadAccountability(null)).resolves.toMatchObject({ commitments: [] });
  });

  it('roundtrip: escribe y lee el mismo sobre con uid propio', async () => {
    const envelope = validEnvelope();
    await writeAccountability(envelope, 'user-1');
    await expect(loadAccountability('user-1')).resolves.toMatchObject({
      profile: { enabled: true },
      commitments: [{ id: 'acc:goal:g1' }],
    });
    // El espacio invitado sigue vacío: los espacios están separados.
    await expect(loadAccountability(null)).resolves.toMatchObject({ commitments: [] });
  });

  it('normaliza perfiles v1 previos al toggle semanal', async () => {
    const legacy = JSON.parse(JSON.stringify(validEnvelope())) as {
      profile: Record<string, unknown>;
    };
    delete legacy.profile.weeklyDigestEnabled;
    await AsyncStorage.setItem(ACCOUNTABILITY_STORAGE_KEY, JSON.stringify(legacy));

    await expect(loadAccountability(null)).resolves.toMatchObject({
      profile: { weeklyDigestEnabled: true },
    });
  });

  it('retención: recorta ciclos por compromiso y hechos por topes', () => {
    const envelope = validEnvelope();
    const cycles = Array.from({ length: MAX_CYCLES_PER_COMMITMENT + 5 }, (_, index) => ({
      id: `acc:goal:g1:2026-08-${String(10 + index).padStart(2, '0')}`,
      commitmentId: 'acc:goal:g1',
      localDate: `2026-08-${String(10 + index).padStart(2, '0')}`,
      time: '19:00',
      status: 'completed' as const,
      attemptCount: 0,
    }));
    const facts = Array.from({ length: MAX_FACTS + 10 }, (_, index) => ({
      id: `fact-${index}`,
      // Referencian el ciclo más nuevo: la retención conserva los recientes.
      cycleId: cycles[cycles.length - 1].id,
      kind: 'check_in' as const,
      occurredAt: stamp,
      source: 'app' as const,
    }));
    const compacted = enforceRetention({ ...envelope, cycles, facts });
    expect(compacted.cycles.length).toBe(MAX_CYCLES_PER_COMMITMENT);
    expect(compacted.facts.length).toBe(MAX_FACTS);
  });

  it('retención: descarta ciclos de compromisos inexistentes', () => {
    const envelope = validEnvelope();
    const compacted = enforceRetention({
      ...envelope,
      cycles: [
        {
          id: 'orphan:2026-08-10',
          commitmentId: 'acc:goal:deleted',
          localDate: '2026-08-10',
          time: '19:00',
          status: 'scheduled',
          attemptCount: 0,
        },
      ],
    });
    expect(compacted.cycles).toEqual([]);
  });

  it('merge invitado→cuenta: complementa por ID, gana la cuenta y no duplica', async () => {
    const guestEnvelope = validEnvelope();
    // El invitado trae un compromiso distinto y un perfil propio activo.
    guestEnvelope.commitments = [
      {
        id: 'acc:habit:h1',
        subjectType: 'habit',
        subjectId: 'h1',
        enabled: true,
        intensity: 'soft',
        nextAction: 'Caminar 15 minutos',
        schedule: { kind: 'daily', time: '08:00' },
        escalation: 'notify_once',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];
    await writeAccountability(guestEnvelope, null);

    const userEnvelope = validEnvelope();
    await writeAccountability(userEnvelope, 'user-1');

    await migrateAccountabilityGuestToUser('user-1', null);

    const merged = await loadAccountability('user-1');
    expect(merged.commitments.map((item) => item.id).sort()).toEqual([
      'acc:goal:g1',
      'acc:habit:h1',
    ]);
    // El perfil de la cuenta prevalece.
    expect(merged.profile).toEqual(userEnvelope.profile);
    // El espacio invitado quedó limpio.
    await expect(AsyncStorage.getItem(ACCOUNTABILITY_STORAGE_KEY)).resolves.toBeNull();
  });

  it('merge idempotente: reintentos no duplican', async () => {
    const guestEnvelope = validEnvelope();
    await writeAccountability(guestEnvelope, null);
    await migrateAccountabilityGuestToUser('user-1', null);
    // Segundo intento: ya no hay nada en la clave invitado.
    await migrateAccountabilityGuestToUser('user-1', null);
    const merged = await loadAccountability('user-1');
    expect(merged.commitments.length).toBe(1);
    expect(merged.commitments[0].id).toBe('acc:goal:g1');
  });

  it('merge con cuenta corrupta: el estado del invitado se adopta', async () => {
    await AsyncStorage.setItem(`${ACCOUNTABILITY_STORAGE_KEY}:user-2`, 'nonsense');
    await writeAccountability(validEnvelope(), null);
    await migrateAccountabilityGuestToUser('user-2', null);
    await expect(loadAccountability('user-2')).resolves.toMatchObject({
      commitments: [{ id: 'acc:goal:g1' }],
    });
  });
});
