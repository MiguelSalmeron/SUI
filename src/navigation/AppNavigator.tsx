import React, { useContext, useEffect } from 'react';
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

export const AppNavigator = () => {
  // El gate principal es el onboarding (login anónimo, sin fricción).
  // El login tradicional (email/Google) se pospone a una fase posterior.
  const { loading } = useContext(AuthContext);
  const hydrated = useOnboardingStore((state) => state.hydrated);
  const onboardingComplete = useOnboardingStore((state) => state.onboardingComplete);
  const theme = useAppTheme();

  // El usuario ve el splash NATIVO mientras Firebase Auth y el Guardián de
  // Estado (Zustand) terminan. Solo cuando AMBOS están listos ocultamos el
  // splash; así no hay destello blanco ni spinner intermedio.
  const ready = !loading && hydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  // Mientras no esté listo, no renderizamos nada: el splash nativo sigue arriba.
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
        }}
      >
        {!onboardingComplete ? (
          // Tunneling: mientras no se complete el onboarding, no hay otra ruta.
          // gestureEnabled:false evita el swipe-back que rompería el bloqueo.
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
                headerStyle: { backgroundColor: theme.colors.surface },
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
                headerStyle: { backgroundColor: theme.colors.surface },
                headerTitleStyle: { color: theme.colors.onSurface, fontWeight: '900' },
                headerShadowVisible: true,
                animation: 'slide_from_right',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
