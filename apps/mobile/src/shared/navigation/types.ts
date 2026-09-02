import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Overview: undefined;
  Goals: { create?: boolean; editId?: string } | undefined;
  Habits: { create?: boolean; editId?: string } | undefined;
  Calendar: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Chat: undefined;
  Progress: undefined;
  Settings: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MergeData: undefined;
  Connections: undefined;
};

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
