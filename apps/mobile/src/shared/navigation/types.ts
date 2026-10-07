import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FocusTarget } from '@/shared/focus/focusTypes';

export type MainTabParamList = {
  Overview: undefined;
  Goals: { create?: boolean; editId?: string; returnTo?: keyof MainTabParamList } | undefined;
  Habits: { create?: boolean; editId?: string; returnTo?: keyof MainTabParamList } | undefined;
  Calendar: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Chat: { prefill?: string } | undefined;
  Pomodoro: { target?: FocusTarget; sessionMinutes?: number } | undefined;
  Progress: undefined;
  Settings: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MergeData: undefined;
  Connections: undefined;
  AccountabilitySettings: undefined;
};

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
