/**
 * Notificación local de fin de sesión Pomodoro (100% local/offline).
 *
 * Reutiliza las primitivas de `shared/infrastructure/notifications`: agenda
 * una alerta de fecha única en el momento en que termina la sesión. El texto
 * se traduce con el idioma activo en el momento de programar.
 */

import type { TranslationKey } from '@/shared/i18n/translations';
import { resolveLocale, translate } from '@/shared/i18n/i18n';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import {
  cancelScheduledNotification,
  scheduleLocalNotification,
} from '@/shared/infrastructure/notifications';

/** Identificador estable: re-programar reemplaza, no duplica. */
export const POMODORO_NOTIFICATION_ID = 'sui-pomodoro-end';

/** Marca de payload para enrutar el toque de la notificación. */
export const POMODORO_NOTIFICATION_TYPE = 'pomodoro_end';

const POMODORO_CHANNEL = { id: 'focus-sessions', name: 'Pomodoro' };

const currentText = (key: TranslationKey): string =>
  translate(resolveLocale(useSettingsStore.getState().language), key);

/** Programa la alerta de fin de sesión para `targetEndTime` (ms epoch). */
export const schedulePomodoroCompleteNotification = async (
  targetEndTime: number,
): Promise<void> => {
  await scheduleLocalNotification({
    identifier: POMODORO_NOTIFICATION_ID,
    title: currentText('pomodoro.notifyTitle'),
    body: currentText('pomodoro.notifyBody'),
    data: { type: POMODORO_NOTIFICATION_TYPE },
    trigger: { kind: 'date', date: new Date(targetEndTime) },
    channel: POMODORO_CHANNEL,
  });
};

/** Cancela la alerta de fin de sesión pendiente. */
export const cancelPomodoroCompleteNotification = (): Promise<void> =>
  cancelScheduledNotification(POMODORO_NOTIFICATION_ID);
