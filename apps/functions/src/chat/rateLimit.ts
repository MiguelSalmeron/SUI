import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_MAX_REQUESTS_PER_IP,
  RATE_LIMIT_WINDOW_MIN,
} from './config';
import { firestore } from './firebase';
import {
  checkRateLimit as checkRateLimitBuckets,
  evaluateWindow,
  type ConsumeBucket,
  type RateLimitKey,
  type RateLimitResult,
  type RateLimitWindow,
} from './rateLimitWindow';

/**
 * Margen para que una política TTL de Firestore pueda purgar el documento.
 * Muy por encima de la ventana: mientras la ventana siga viva, el documento no
 * debe desaparecer. Los cubos por IP crecen con cada IP distinta que ve el
 * servicio, así que sin purga la colección crece sin techo.
 */
const DOCUMENT_TTL_MS = 24 * 60 * 60 * 1000;

const consumeWithFirestore: ConsumeBucket = async (
  documentId,
  max,
  windowMin,
): Promise<RateLimitWindow> => {
  const ref = firestore.collection('rate_limits').doc(documentId);
  const now = Date.now();
  const windowMs = windowMin * 60_000;

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as { timestamps?: number[] } | undefined;
    const window = evaluateWindow(data?.timestamps, now, max, windowMs);
    transaction.set(ref, {
      timestamps: window.timestamps,
      updatedAt: now,
      expiresAt: Timestamp.fromMillis(now + DOCUMENT_TTL_MS),
    });
    return window;
  });
};

export async function checkRateLimit(key: RateLimitKey): Promise<RateLimitResult> {
  try {
    return await checkRateLimitBuckets(key, consumeWithFirestore, {
      perUser: RATE_LIMIT_MAX_REQUESTS,
      // Parámetro y no constante: si el cupo por IP bloquea a usuarios tras un
      // NAT compartido, hay que poder subirlo sin desplegar código.
      perIp: RATE_LIMIT_MAX_REQUESTS_PER_IP.value(),
      windowMin: RATE_LIMIT_WINDOW_MIN,
    });
  } catch (error) {
    // Fail-open deliberado: un fallo de Firestore no debe tumbar el Chat.
    logger.warn('rate-limit check failed (fail-open)', {
      uid: key.uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true };
  }
}
