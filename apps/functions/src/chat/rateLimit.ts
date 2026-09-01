import * as logger from 'firebase-functions/logger';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MIN } from './config';
import { firestore } from './firebase';

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export async function checkRateLimit(uid: string): Promise<RateLimitResult> {
  try {
    const ref = firestore.collection('rate_limits').doc(uid);
    const now = Date.now();
    const windowMs = RATE_LIMIT_WINDOW_MIN * 60_000;
    const windowStart = now - windowMs;

    return await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data() as { timestamps?: number[] } | undefined;
      const recent = (data?.timestamps ?? []).filter((timestamp) => timestamp >= windowStart);

      if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
        const oldest = Math.min(...recent);
        const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
        return { allowed: false as const, retryAfterSec: Math.max(retryAfterSec, 1) };
      }

      recent.push(now);
      transaction.set(ref, { timestamps: recent, updatedAt: now });
      return { allowed: true as const };
    });
  } catch (error) {
    logger.warn('rate-limit check failed (fail-open)', {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true };
  }
}
