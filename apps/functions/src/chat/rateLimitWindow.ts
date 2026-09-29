/**
 * Lógica pura del límite de peticiones.
 *
 * Vive aparte de `rateLimit.ts` a propósito: aquel módulo importa `./firebase`,
 * que llama a `initializeApp()` al cargarse, así que cualquier test que lo
 * importe necesitaría credenciales. Aquí no hay red ni relojes: el `now` y el
 * consumidor de cubos entran por parámetro.
 */

import { createHash } from 'node:crypto';

export type RateLimitScope = 'uid' | 'ip';

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSec: number; scope: RateLimitScope };

export type RateLimitWindow = {
  allowed: boolean;
  retryAfterSec: number;
  /** Marcas de tiempo que sobreviven a la ventana, incluida la actual si cupo. */
  timestamps: number[];
};

/** Consume un cubo. Se inyecta para poder probar la orquestación sin Firestore. */
export type ConsumeBucket = (
  documentId: string,
  max: number,
  windowMin: number,
) => Promise<RateLimitWindow>;

export type RateLimitKey = { uid: string; clientIp?: string };

export type RateLimitLimits = { perUser: number; perIp: number; windowMin: number };

/**
 * Decisión sobre una ventana deslizante: descarta lo viejo, bloquea si ya se
 * alcanzó el máximo y, si hay sitio, registra la marca actual.
 */
export function evaluateWindow(
  previous: number[] | undefined,
  now: number,
  max: number,
  windowMs: number,
): RateLimitWindow {
  const recent = (previous ?? []).filter((timestamp) => timestamp >= now - windowMs);

  if (recent.length >= max) {
    const oldest = Math.min(...recent);
    return {
      allowed: false,
      retryAfterSec: Math.max(Math.ceil((oldest + windowMs - now) / 1000), 1),
      timestamps: recent,
    };
  }

  recent.push(now);
  return { allowed: true, retryAfterSec: 0, timestamps: recent };
}

/**
 * Pseudónimo estable del cliente para limitar por IP sin guardar la IP.
 *
 * Mantiene la IP fuera de la base de datos y de los logs, que es el objetivo.
 * No es una garantía criptográfica: el espacio IPv4 es enumerable, así que con
 * el hash a la vista podría recuperarse por fuerza bruta. No se presenta como
 * anonimización.
 */
export function hashClientKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

/**
 * Comprueba los dos cupos. La dimensión por IP va primero: si el cliente ya
 * agotó el suyo no tiene sentido consumir también el del usuario, que es
 * precisamente el que un abusador puede renovar creando cuentas anónimas.
 */
export async function checkRateLimit(
  key: RateLimitKey,
  consume: ConsumeBucket,
  limits: RateLimitLimits,
): Promise<RateLimitResult> {
  const { uid, clientIp } = key;

  if (clientIp) {
    const byClient = await consume(`ip_${hashClientKey(clientIp)}`, limits.perIp, limits.windowMin);
    if (!byClient.allowed) {
      return { allowed: false, retryAfterSec: byClient.retryAfterSec, scope: 'ip' };
    }
  }

  const byUser = await consume(uid, limits.perUser, limits.windowMin);
  if (!byUser.allowed) {
    return { allowed: false, retryAfterSec: byUser.retryAfterSec, scope: 'uid' };
  }

  return { allowed: true };
}
