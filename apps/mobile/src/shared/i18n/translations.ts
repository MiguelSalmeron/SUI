/**
 * Cadenas ES/EN de la aplicación.
 *
 * Cada namespace vive en su propio módulo bajo `messages/`, con ambos idiomas
 * juntos para que no se pueda agregar una clave en un idioma y olvidar el otro.
 * El test `i18n.test.ts` verifica además que ES y EN tengan claves idénticas.
 */

import { loading } from './messages/loading';
import { brand } from './messages/brand';
import { welcome } from './messages/welcome';
import { onboarding } from './messages/onboarding';
import { home } from './messages/home';
import { auth } from './messages/auth';
import { merge } from './messages/merge';
import { settings } from './messages/settings';
import { notifications } from './messages/notifications';
import { accountability } from './messages/accountability';
import { engagement } from './messages/engagement';
import { connections } from './messages/connections';
import { tasks } from './messages/tasks';
import { calendar } from './messages/calendar';
import { nav } from './messages/nav';
import { goals } from './messages/goals';
import { goalForm } from './messages/goal-form';
import { habits } from './messages/habits';
import { habitForm } from './messages/habit-form';
import { chat } from './messages/chat';
import { crisis } from './messages/crisis';
import { daily } from './messages/daily';
import { streak } from './messages/streak';
import { nightly } from './messages/nightly';
import { celebration } from './messages/celebration';
import { pomodoro } from './messages/pomodoro';
import { progress } from './messages/progress';
import { achievement } from './messages/achievement';
import { common } from './messages/common';

export const translations = {
  es: {
    ...loading.es,
    ...brand.es,
    ...welcome.es,
    ...onboarding.es,
    ...home.es,
    ...auth.es,
    ...merge.es,
    ...settings.es,
    ...notifications.es,
    ...accountability.es,
    ...engagement.es,
    ...connections.es,
    ...tasks.es,
    ...calendar.es,
    ...nav.es,
    ...goals.es,
    ...goalForm.es,
    ...habits.es,
    ...habitForm.es,
    ...chat.es,
    ...crisis.es,
    ...daily.es,
    ...streak.es,
    ...nightly.es,
    ...celebration.es,
    ...pomodoro.es,
    ...progress.es,
    ...achievement.es,
    ...common.es,
  },
  en: {
    ...loading.en,
    ...brand.en,
    ...welcome.en,
    ...onboarding.en,
    ...home.en,
    ...auth.en,
    ...merge.en,
    ...settings.en,
    ...notifications.en,
    ...accountability.en,
    ...engagement.en,
    ...connections.en,
    ...tasks.en,
    ...calendar.en,
    ...nav.en,
    ...goals.en,
    ...goalForm.en,
    ...habits.en,
    ...habitForm.en,
    ...chat.en,
    ...crisis.en,
    ...daily.en,
    ...streak.en,
    ...nightly.en,
    ...celebration.en,
    ...pomodoro.en,
    ...progress.en,
    ...achievement.en,
    ...common.en,
  },
} as const;

export type Locale = keyof typeof translations;
export type TranslationKey = keyof typeof translations.es;
