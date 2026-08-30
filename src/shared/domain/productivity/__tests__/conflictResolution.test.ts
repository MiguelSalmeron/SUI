import { resolveMetadataConflict } from '../sync/conflictResolution';
import type { SyncMetadata } from '../sync/syncTypes';

const metadata = (
  revision: number,
  deviceId: string,
  fingerprint = `${revision}-${deviceId}`,
): SyncMetadata => ({
  schemaVersion: 1,
  updatedAt: '2026-08-30T00:00:00.000Z',
  revision,
  deviceId,
  fingerprint,
});

describe('productivity conflict resolution', () => {
  it('prioriza revisión sin depender del reloj cliente', () => {
    expect(resolveMetadataConflict(metadata(3, 'a'), metadata(2, 'z'))).toBe('incoming');
    expect(resolveMetadataConflict(metadata(1, 'z'), metadata(2, 'a'))).toBe('current');
  });

  it('resuelve concurrencia por deviceId', () => {
    expect(resolveMetadataConflict(metadata(2, 'z'), metadata(2, 'a'))).toBe('incoming');
    expect(resolveMetadataConflict(metadata(2, 'a'), metadata(2, 'z'))).toBe('current');
  });

  it('distingue replay de colisión imposible', () => {
    expect(resolveMetadataConflict(metadata(2, 'a', 'same'), metadata(2, 'a', 'same'))).toBe(
      'equal',
    );
    expect(resolveMetadataConflict(metadata(2, 'a', 'one'), metadata(2, 'a', 'two'))).toBe(
      'collision',
    );
  });
});
