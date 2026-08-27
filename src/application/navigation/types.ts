import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Overview: undefined;
  Goals: undefined;
  Habits: undefined;
  Calendar: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Chat: undefined;
  Progress: undefined;
  Settings: undefined;
  // Dormant screens (account consolidation, see work/PENDIENTES_Onboarding.md #6).
  // Declared so navigation calls in LoginScreen/RegisterScreen typecheck; not
  // yet registered in AppNavigator's Stack.Navigator graph.
  Login: undefined;
  Register: undefined;
};

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
