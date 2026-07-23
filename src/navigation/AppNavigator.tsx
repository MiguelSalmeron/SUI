import React, { useContext, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';

import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TabNavigator } from './TabNavigator';
import { AuthContext } from '../context/AuthContext';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useAppTheme } from '../theme/theme';

const Stack = createNativeStackNavigator();
const AUTH_READY_TIMEOUT_MS = 8000;

export const AppNavigator = () => {
  const { loading } = useContext(AuthContext);
  const hydrated = useOnboardingStore((state) => state.hydrated);
  const setHydrated = useOnboardingStore((state) => state.setHydrated);
  const onboardingComplete = useOnboardingStore((state) => state.onboardingComplete);
  const theme = useAppTheme();
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAuthTimedOut(true), AUTH_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // Evita quedarse en splash si la rehidratación de Zustand no responde.
  useEffect(() => {
    if (hydrated) return;
    const timer = setTimeout(() => setHydrated(true), 4000);
    return () => clearTimeout(timer);
  }, [hydrated, setHydrated]);

  const ready = hydrated && (!loading || authTimedOut);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 280,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {!onboardingComplete ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ gestureEnabled: false, animation: 'fade' }}
          />
        ) : (
          <>
            <Stack.Screen name="Home" component={TabNavigator} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                headerShown: true,
                title: 'SUI',
                headerBackTitle: 'Inicio',
                headerTintColor: theme.colors.primary,
                headerStyle: { backgroundColor: theme.colors.surfaceContainer },
                headerTitleStyle: { color: theme.colors.onSurface, fontWeight: '900' },
                headerShadowVisible: true,
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                headerShown: true,
                title: 'Ajustes',
                headerBackTitle: 'Inicio',
                headerTintColor: theme.colors.primary,
                headerStyle: { backgroundColor: theme.colors.surfaceContainer },
                headerTitleStyle: { color: theme.colors.onSurface, fontWeight: '900' },
                headerShadowVisible: true,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
