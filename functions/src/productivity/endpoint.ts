import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { authenticateBearer } from '../chat/auth';
import { verifyAppCheckHeader } from '../http/appCheck';
import { setCorsHeaders } from '../http/cors';
import { synchronizeProductivityV9 } from './syncEngine';
import { parseSyncRequest } from './validation';

export const syncProductivity = onRequest(
  { cors: false, timeoutSeconds: 60, memory: '256MiB' },
  async (request, response): Promise<void> => {
    if (!setCorsHeaders(request, response)) {
      response.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const appCheckOk = await verifyAppCheckHeader(
      typeof request.headers['x-firebase-appcheck'] === 'string'
        ? request.headers['x-firebase-appcheck']
        : undefined,
      'syncProductivity',
    );
    if (!appCheckOk) {
      response.status(401).json({ error: 'Invalid App Check token' });
      return;
    }
    const authentication = await authenticateBearer(request.headers.authorization);
    if (!authentication.ok) {
      response.status(401).json({ error: 'Invalid authentication' });
      return;
    }
    const registered =
      authentication.signInProvider !== 'anonymous' &&
      (authentication.signInProvider !== 'password' || authentication.emailVerified);
    if (!registered) {
      response.status(403).json({ error: 'Verified account required' });
      return;
    }
    const payload = parseSyncRequest(request.body);
    if (!payload) {
      response.status(400).json({ error: 'Invalid sync payload' });
      return;
    }
    const startedAt = Date.now();
    try {
      const result = await synchronizeProductivityV9(authentication.uid, payload);
      logger.info('productivity sync completed', {
        result: 'success',
        batchSize: payload.mutations.length,
        applied: result.outcomes.filter((item) => item.status === 'applied').length,
        replayed: result.outcomes.filter((item) => item.status === 'replayed').length,
        rejected: result.outcomes.filter((item) => item.status === 'rejected').length,
        pulled: result.changes.length,
        resetRequired: result.resetRequired,
        compacted: result.compacted,
        durationMs: Date.now() - startedAt,
      });
      response.set('Cache-Control', 'no-store');
      response.status(200).json(result);
    } catch (error) {
      logger.error('productivity sync failed', {
        result: 'error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        durationMs: Date.now() - startedAt,
      });
      response.status(503).json({ error: 'Sync temporarily unavailable' });
    }
  },
);
