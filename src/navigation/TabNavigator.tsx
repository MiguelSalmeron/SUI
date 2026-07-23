import React, { useContext, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { ColorScheme, SPACING, useAppTheme, NAV_BAR_HEIGHT } from '../theme/theme';
import { useHomeStore } from '../store/useHomeStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { buildGreeting } from '../services/greeting';

import { OverviewScreen } from '../screens/tabs/OverviewScreen';
import { GoalsScreen } from '../screens/tabs/GoalsScreen';
import { HabitsScreen } from '../screens/tabs/HabitsScreen';
import { PomodoroScreen } from '../screens/tabs/PomodoroScreen';
import { SummaryScreen } from '../screens/tabs/SummaryScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap }> = {
  Overview: { focused: 'home', outline: 'home-outline' },
  Goals: { focused: 'flag', outline: 'flag-outline' },
  Habits: { focused: 'repeat', outline: 'repeat-outline' },
  Pomodoro: { focused: 'timer', outline: 'timer-outline' },
  Summary: { focused: 'stats-chart', outline: 'stats-chart-outline' },
};

export const TabNavigator = () => {
  const { user } = useContext(AuthContext);
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();

  // Load home state on mount
  const stateLoaded = useHomeStore((s) => s.stateLoaded);
  const loadState = useHomeStore((s) => s.loadState);
  const saveState = useHomeStore((s) => s.saveState);
  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const bumpStreak = useHomeStore((s) => s.bumpStreak);

  const onboardingName = useOnboardingStore((s) => s.profile.name);
  const profileName = onboardingName?.trim() || user?.email?.split('@')[0] || 'Usuario';

  // Load state on mount
  useEffect(() => {
    loadState();
  }, [loadState]);

  // Save state on changes
  useEffect(() => {
    if (!stateLoaded) return;
    saveState();
  }, [goals, habits, streak, stateLoaded, saveState]);

  // Streak bump: when daily completion changes
  const completedGoals = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((h) => h.completed).length, [habits]);
  const dailyCompleted = completedGoals + completedHabits;

  const prevDailyCompleted = useRef(dailyCompleted);
  useEffect(() => {
    if (!stateLoaded || dailyCompleted === 0) return;
    if (dailyCompleted > prevDailyCompleted.current) {
      bumpStreak();
    }
    prevDailyCompleted.current = dailyCompleted;
  }, [dailyCompleted, stateLoaded, bumpStreak]);

  // Greeting
  const greeting = useMemo(
    () =>
      buildGreeting({
        hour: new Date().getHours(),
        completed: dailyCompleted,
        total: goals.length + habits.length,
      }),
    [dailyCompleted, goals.length, habits.length],
  );

  // Chat FAB animation
  const fabScale = useRef(new Animated.Value(1)).current;
  const onFabPressIn = () =>
    Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start();
  const onFabPressOut = () =>
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  // Shared header component for all tabs
  const Header = () => (
    <View style={styles(colors).headerShell}>
      <View style={styles(colors).headerText}>
        <Text style={styles(colors).kicker}>
          {new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
        <Text style={styles(colors).greeting}>
          {greeting.salutation}, {profileName} {greeting.emoji}
        </Text>
        <Text style={styles(colors).subline}>{greeting.subline}</Text>
      </View>
      <TouchableOpacity
        style={styles(colors).settingsBtn}
        onPress={() => navigation.navigate('Settings')}
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
        accessibilityHint="Abre la pantalla de configuración"
      >
        <Ionicons name="settings-outline" size={24} color={colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          header: () => <Header />,
          tabBarIcon: ({ focused, color, size }) => {
            const icons = TAB_ICONS[route.name];
            if (!icons) return null;
            return <Ionicons name={focused ? icons.focused : icons.outline} size={size} color={color} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.onSurfaceVariant,
          tabBarStyle: {
            backgroundColor: colors.surfaceContainer,
            borderTopColor: colors.outlineVariant,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingTop: SPACING.xs,
            height: NAV_BAR_HEIGHT + 16,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            marginBottom: 4,
          },
          tabBarLabelPosition: 'below-icon',
          animation: 'fade',
        })}
      >
        <Tab.Screen name="Overview" component={OverviewScreen} options={{ tabBarLabel: 'Inicio' }} />
        <Tab.Screen name="Goals" component={GoalsScreen} options={{ tabBarLabel: 'Metas' }} />
        <Tab.Screen name="Habits" component={HabitsScreen} options={{ tabBarLabel: 'Hábitos' }} />
        <Tab.Screen name="Pomodoro" component={PomodoroScreen} options={{ tabBarLabel: 'Pomodoro' }} />
        <Tab.Screen name="Summary" component={SummaryScreen} options={{ tabBarLabel: 'Resumen' }} />
      </Tab.Navigator>

      {/* Chat FAB */}
      <Animated.View style={[fabStyles(colors).fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Chat')}
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
          activeOpacity={0.9}
          style={fabStyles(colors).fabInner}
          accessibilityRole="button"
          accessibilityLabel="Hablar con SUI"
          accessibilityHint="Abre el chat de apoyo emocional"
        >
          <Text style={fabStyles(colors).fabText}>Hablar con SUI</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = (colors: ColorScheme) =>
  StyleSheet.create({
    headerShell: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.background,
    },
    headerText: {
      flex: 1,
      paddingRight: SPACING.md,
    },
    kicker: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.secondary,
      marginBottom: 4,
    },
    greeting: {
      fontSize: 30,
      fontWeight: '900',
      color: colors.onSurface,
    },
    subline: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginTop: 4,
      fontWeight: '600',
    },
    settingsBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainer,
    },
  });

const fabStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: SPACING.lg,
      bottom: NAV_BAR_HEIGHT + 24,
      backgroundColor: colors.primary,
      borderRadius: 30,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
      zIndex: 100,
    },
    fabInner: {
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    fabText: {
      color: colors.surface,
      fontWeight: '900',
      fontSize: 15,
    },
  });
