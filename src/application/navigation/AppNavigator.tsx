import React, { useEffect, useMemo } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { WelcomeScreen } from '@/features/onboarding/screens/WelcomeScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { MergeDataScreen } from '@/features/auth/screens/MergeDataScreen';
import { ChatScreen } from '@/features/chat/screens/ChatScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { ConnectionsScreen } from '@/features/settings/screens/ConnectionsScreen';
import { SummaryScreen } from '@/features/home/screens/SummaryScreen';
import { useIntroStore } from '@/features/onboarding/store/useIntroStore';
import { useAppTheme } from '@/shared/theme/theme';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';
import { useI18n } from '@/shared/i18n/i18n';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const hydrated = useIntroStore((state) => state.hydrated);
  const setHydrated = useIntroStore((state) => state.setHydrated);
  const introComplete = useIntroStore((state) => state.introComplete);
  const theme = useAppTheme();
  const { t } = useI18n();

  const navTheme = useMemo(
    () => ({
      dark: theme.scheme === 'dark',
      colors: {
        ...(theme.scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surfaceContainer,
        text: theme.colors.onSurface,
        border: theme.colors.outlineVariant,
        notification: theme.colors.error,
      },
      fonts: theme.scheme === 'dark' ? DarkTheme.fonts : DefaultTheme.fonts,
    }),
    [theme],
  );

  useEffect(() => {
    if (hydrated) return;
    const timer = setTimeout(() => setHydrated(true), 4000);
    return () => clearTimeout(timer);
  }, [hydrated, setHydrated]);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  if (!hydrated) return null;

  const standardHeader = {
    headerShown: true,
    headerTintColor: theme.colors.primary,
    headerStyle: { backgroundColor: theme.colors.surfaceContainer },
    headerTitleStyle: { ...theme.type.titleMd, color: theme.colors.onSurface },
    headerShadowVisible: true,
  } as const;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={introComplete ? 'Home' : 'Welcome'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 280,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="Home" component={TabNavigator} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="MergeData" component={MergeDataScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ ...standardHeader, title: 'Sui', headerBackTitle: t('nav.backHome') }} />
        <Stack.Screen name="Progress" component={SummaryScreen} options={{ ...standardHeader, title: '', headerBackTitle: t('nav.backHome'), headerStyle: { backgroundColor: theme.colors.background }, headerShadowVisible: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...standardHeader, title: t('nav.settings'), headerBackTitle: t('nav.backHome') }} />
        <Stack.Screen name="Connections" component={ConnectionsScreen} options={{ ...standardHeader, title: t('settings.connections'), headerBackTitle: t('nav.backSettings') }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
