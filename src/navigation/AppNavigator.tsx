import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { AuthContext } from '../context/AuthContext';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { COLORS } from '../theme/theme';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  // El gate principal es el onboarding (login anónimo, sin fricción).
  // El login tradicional (email/Google) se pospone a una fase posterior.
  const { loading } = useContext(AuthContext);
  const hydrated = useOnboardingStore((state) => state.hydrated);
  const onboardingComplete = useOnboardingStore((state) => state.onboardingComplete);

  // Esperar tanto a Firebase Auth como a la rehidratación del Guardián de Estado.
  if (loading || !hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!onboardingComplete ? (
          // Tunneling: mientras no se complete el onboarding, no hay otra ruta.
          // gestureEnabled:false evita el swipe-back que rompería el bloqueo.
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ gestureEnabled: false }}
          />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
