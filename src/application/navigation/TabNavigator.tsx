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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '@/features/auth/context/AuthContext';
import { ColorScheme, SPACING, useAppTheme, NAV_BAR_HEIGHT } from '@/shared/theme/theme';
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { isHabitDueToday, localDateKey } from '@/shared/domain/productivity/homeStorage';
import { useOnboardingStore } from '@/features/onboarding/store/useOnboardingStore';
import { Avatar } from '@/shared/ui/Avatar';
import type { RootStackNavigationProp } from './types';

import { OverviewScreen } from '@/features/home/screens/OverviewScreen';
import { GoalsScreen } from '@/features/goals/screens/GoalsScreen';
import { HabitsScreen } from '@/features/habits/screens/HabitsScreen';
import { CalendarScreen } from '@/features/calendar/screens/CalendarScreen';
import { SummaryScreen } from '@/features/home/screens/SummaryScreen';
import { CelebrationToast } from '@/features/home/components/CelebrationToast';
import { useCelebrationStore } from '@/shared/domain/productivity/useCelebrationStore';
import { requestNotificationPermission } from '@/features/settings/services/notifications';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap }> = {
  Overview: { focused: 'home', outline: 'home-outline' },
  Goals: { focused: 'flag', outline: 'flag-outline' },
  Habits: { focused: 'repeat', outline: 'repeat-outline' },
  Calendar: { focused: 'calendar', outline: 'calendar-outline' },
  Summary: { focused: 'stats-chart', outline: 'stats-chart-outline' },
};

type TabHeaderProps = {
  colors: ColorScheme;
  topInset: number;
  profileName: string;
  syncPending: boolean;
  onSettings: () => void;
};

const TabHeader = React.memo(({ colors, topInset, profileName, syncPending, onSettings }: TabHeaderProps) => {
  const styles = useMemo(() => headerStyles(colors), [colors]);
  return (
    <View style={[styles.headerShell, { paddingTop: topInset + SPACING.sm }]}>
      <View style={styles.identity}>
        <Avatar name={profileName} size="sm" variant="primary" />
        <View style={styles.identityText}>
          <Text style={styles.brand}>SUI</Text>
          <Text style={styles.welcome} numberOfLines={1}>Hola, {profileName}</Text>
        </View>
      </View>
      <View
        style={styles.syncStatus}
        accessibilityLabel={syncPending ? 'Sincronización pendiente' : 'Sincronizado'}
      >
        <View
          style={[
            styles.syncDot,
            { backgroundColor: syncPending ? colors.outline : colors.success },
          ]}
        />
      </View>
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={onSettings}
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
        accessibilityHint="Abre la pantalla de configuración"
      >
        <Ionicons name="settings-outline" size={22} color={colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
});

export const TabNavigator = () => {
  const { user } = useContext(AuthContext);
  const theme = useAppTheme();
  const colors = theme.colors;
  const tabIconStyleSheet = useMemo(() => tabIconStyles(colors), [colors]);
  const badgeStyleSheet = useMemo(() => badgeStyles(colors), [colors]);
  const fabStyleSheet = useMemo(() => fabStyles(colors), [colors]);
  const navigation = useNavigation<RootStackNavigationProp>();
  const insets = useSafeAreaInsets();

  const stateLoaded = useHomeStore((s) => s.stateLoaded);
  const loadState = useHomeStore((s) => s.loadState);
  const saveState = useHomeStore((s) => s.saveState);
  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const bumpStreak = useHomeStore((s) => s.bumpStreak);
  const celebrate = useCelebrationStore((s) => s.trigger);

  useEffect(() => {
    requestNotificationPermission().catch(() => undefined);
  }, []);

  const onboardingName = useOnboardingStore((s) => s.profile.name);
  const syncPending = useOnboardingStore((s) => s.syncPending);
  const profileName = onboardingName?.trim() || user?.email?.split('@')[0] || 'Usuario';

  useEffect(() => {
    loadState();
  }, [loadState]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!stateLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState();
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [goals, habits, streak, stateLoaded, saveState]);

  const completedGoals = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((h) => h.completed).length, [habits]);
  const todayGoals = useMemo(() => {
    const today = localDateKey();
    return goals.filter((goal) => goal.deadline === today || goal.impactDays?.includes(today));
  }, [goals]);
  const todayHabits = useMemo(() => habits.filter((habit) => isHabitDueToday(habit)), [habits]);
  const dailyCompleted =
    todayGoals.filter((goal) => goal.completed).length +
    todayHabits.filter((habit) => habit.completed).length;
  const dailyTotal = todayGoals.length + todayHabits.length;
  const totalCompletedActions = completedGoals + completedHabits;
  const pendingGoals = goals.length - completedGoals;
  const pendingHabits = todayHabits.filter((habit) => !habit.completed).length;

  const prevCompletedActions = useRef(totalCompletedActions);
  const perfectDayShown = useRef(false);
  useEffect(() => {
    if (!stateLoaded) return;
    if (totalCompletedActions > prevCompletedActions.current) {
      bumpStreak();
      if (
        dailyTotal > 0 &&
        dailyCompleted === dailyTotal &&
        !perfectDayShown.current
      ) {
        perfectDayShown.current = true;
        celebrate({ kind: 'perfect_day', subtitle: 'Completaste todo hoy' });
      }
    }
    prevCompletedActions.current = totalCompletedActions;
  }, [dailyCompleted, dailyTotal, totalCompletedActions, stateLoaded, bumpStreak, celebrate]);

  const fabScale = useRef(new Animated.Value(1)).current;
  const onFabPressIn = () =>
    Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start();
  const onFabPressOut = () =>
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const tabBarHeight = NAV_BAR_HEIGHT + 16 + insets.bottom;
  const fabBottom = tabBarHeight + SPACING.md;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CelebrationToast />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          sceneStyle: { backgroundColor: colors.background },
          sceneContainerStyle: { backgroundColor: colors.background },
          header: () => (
            <TabHeader
              colors={colors}
              topInset={insets.top}
              profileName={profileName}
              syncPending={syncPending}
              onSettings={() => navigation.navigate('Settings')}
            />
          ),
          tabBarIcon: ({ focused, color, size = 24 }) => {
            const icons = TAB_ICONS[route.name];
            if (!icons) return null;
            const badge =
              route.name === 'Goals' && pendingGoals > 0
                ? pendingGoals
                : route.name === 'Habits' && pendingHabits > 0
                ? pendingHabits
                : 0;
            return (
              <View style={[tabIconStyleSheet.shell, focused && tabIconStyleSheet.shellActive]}>
                <Ionicons
                  name={focused ? icons.focused : icons.outline}
                  size={size}
                  color={color}
                />
                {badge > 0 && (
                  <View style={badgeStyleSheet.badge}>
                    <Text style={badgeStyleSheet.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                )}
              </View>
            );
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.onSurfaceVariant,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.outlineVariant,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingTop: SPACING.xs,
            paddingBottom: Math.max(insets.bottom, SPACING.xs),
            height: tabBarHeight,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginBottom: 2,
          },
          tabBarLabelPosition: 'below-icon',
          animation: 'fade',
          lazy: true,
        })}
      >
        <Tab.Screen name="Overview" component={OverviewScreen} options={{ tabBarLabel: 'Inicio' }} />
        <Tab.Screen name="Goals" component={GoalsScreen} options={{ tabBarLabel: 'Metas' }} />
        <Tab.Screen name="Habits" component={HabitsScreen} options={{ tabBarLabel: 'Hábitos' }} />
        <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: 'Agenda' }} />
        <Tab.Screen name="Summary" component={SummaryScreen} options={{ tabBarLabel: 'Progreso' }} />
      </Tab.Navigator>

      <Animated.View style={[fabStyleSheet.fab, { bottom: fabBottom, transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Chat')}
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
          activeOpacity={0.9}
          style={fabStyleSheet.fabInner}
          accessibilityRole="button"
          accessibilityLabel="Hablar con SUI"
          accessibilityHint="Abre el chat de apoyo emocional"
        >
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.onPrimary} />
          <Text style={fabStyleSheet.fabText}>SUI</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const headerStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    headerShell: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
      backgroundColor: colors.background,
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      paddingRight: SPACING.md,
    },
    identityText: {
      flex: 1,
      gap: 0,
    },
    brand: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onSurface,
    },
    welcome: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.onSurfaceVariant,
    },
    syncStatus: {
      width: 20,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    syncDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    settingsBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
  });

const fabStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: SPACING.lg,
      backgroundColor: colors.primary,
      borderRadius: 30,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 8,
      elevation: 5,
      zIndex: 100,
    },
    fabInner: {
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    fabText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
  });

const badgeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    badge: {
      position: 'absolute',
      top: -4,
      right: -10,
      backgroundColor: colors.error,
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: colors.onError,
      fontSize: 10,
      fontWeight: '700',
    },
  });

const tabIconStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    shell: {
      minWidth: 42,
      height: 30,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shellActive: {
      backgroundColor: colors.primaryContainer,
    },
  });
