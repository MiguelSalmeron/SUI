import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { PRODUCT_CONFIG } from '@/shared/config/product';

type TelemetryEvent =
  | 'app.start'
  | 'auth.completed'
  | 'sync.completed'
  | 'productivity.completed'
  | 'connection.completed';

type TelemetryAttributes = Record<string, string | number | boolean>;

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? '';

const redact = (value: string | undefined): string | undefined =>
  value?.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]');

if (dsn) {
  Sentry.init({
    dsn,
    environment: PRODUCT_CONFIG.environment,
    sendDefaultPii: false,
    tracesSampleRate: PRODUCT_CONFIG.environment === 'production' ? 0.05 : 0,
    enableAutoSessionTracking: true,
    _experiments: { enableMetrics: true },
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb.category === 'console' || breadcrumb.category === 'http' ? null : breadcrumb,
    beforeSend: (event) => ({
      ...event,
      user: undefined,
      request: undefined,
      extra: undefined,
      message: redact(event.message),
      exception: event.exception
        ? {
            ...event.exception,
            values: event.exception.values?.map((value) => ({
              ...value,
              value: redact(value.value),
            })),
          }
        : undefined,
    }),
  });
}

const baseAttributes = {
  environment: PRODUCT_CONFIG.environment,
  platform: Platform.OS,
};

export const recordTelemetry = (
  event: TelemetryEvent,
  attributes: TelemetryAttributes = {},
  durationMs?: number,
): void => {
  if (!dsn) return;
  const safeAttributes = { ...baseAttributes, ...attributes };
  Sentry.metrics.count(event, 1, { attributes: safeAttributes });
  if (typeof durationMs === 'number') {
    Sentry.metrics.distribution(`${event}.duration`, durationMs, {
      unit: 'millisecond',
      attributes: safeAttributes,
    });
  }
};

export const withTelemetry = async <T>(
  event: TelemetryEvent,
  attributes: TelemetryAttributes,
  operation: () => Promise<T>,
): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await operation();
    recordTelemetry(event, { ...attributes, result: 'success' }, Date.now() - startedAt);
    return result;
  } catch (error) {
    recordTelemetry(event, { ...attributes, result: 'error' }, Date.now() - startedAt);
    throw error;
  }
};

export const wrapApplication = Sentry.wrap;
