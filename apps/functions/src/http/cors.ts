import type { Request, Response } from 'express';
import { ALLOWED_ORIGINS } from '../chat/config';

const configuredOrigins = (): Set<string> =>
  new Set(
    ALLOWED_ORIGINS.value()
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

export function setCorsHeaders(request: Request, response: Response): boolean {
  const origin = request.headers.origin;
  const allowed = configuredOrigins();
  if (origin && !allowed.has(origin)) return false;
  if (origin) response.set('Access-Control-Allow-Origin', origin);
  response.set('Vary', 'Origin');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  response.set('Access-Control-Max-Age', '3600');
  return true;
}
