import type { MainTabParamList } from '@/shared/navigation/types';

type TabIcon =
  | 'home'
  | 'home-outline'
  | 'flag'
  | 'flag-outline'
  | 'repeat'
  | 'repeat-outline'
  | 'calendar'
  | 'calendar-outline';

type TabPresentation = {
  label: string;
  focused: TabIcon;
  outline: TabIcon;
};

export const MAIN_TAB_ITEMS: Record<keyof MainTabParamList, TabPresentation> = {
  Overview: { label: 'Inicio', focused: 'home', outline: 'home-outline' },
  Goals: { label: 'Metas', focused: 'flag', outline: 'flag-outline' },
  Habits: { label: 'Hábitos', focused: 'repeat', outline: 'repeat-outline' },
  Calendar: { label: 'Agenda', focused: 'calendar', outline: 'calendar-outline' },
};

export const MAIN_TAB_ORDER = Object.keys(MAIN_TAB_ITEMS) as (keyof MainTabParamList)[];

export const ASSISTANT_INSERT_INDEX = 2;
