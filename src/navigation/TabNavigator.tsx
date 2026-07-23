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
import { AuthContext } from '../context/AuthContext';
import { ColorScheme, SPACING, useAppTheme, NAV_BAR_HEIGHT } from '../theme/theme';
import { useHomeStore } from '../store/useHomeStore';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { Avatar } from '../components/ui/Avatar';

import { OverviewScreen } from '../screens/tabs/OverviewScreen';
import { GoalsScreen } from '../screens/tabs/GoalsScreen';
import { HabitsScreen } from '../screens/tabs/HabitsScreen';
import { PomodoroScreen } from '../screens/tabs/PomodoroScreen';
import { SummaryScreen } from '../screens/tabs/SummaryScreen';
import { CelebrationToast } from '../components/home/CelebrationToast';
import { usePomodoroEngine } from '../hooks/usePomodoroEngine';
import { useCelebrationStore } from '../store/useCelebrationStore';
import { requestNotificationPermission } from '../services/notifications';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap }> = {
  Overview: { focused: 'home', outline: 'home-outline' },
  Goals: { focused: 'flag', outline: 'flag-outline' },
  Habits: { focused: 'repeat', outline: 'repeat-outline' },
  Pomodoro: { focused: 'timer', outline: 'timer-outline' },
  Summary: { focused: 'stats-chart', outline: 'stats-chart-outline' },
};

type TabHeaderProps = {
  colors: ColorScheme;
  topInset: number;
  profileName: string;
  streak: number;
  onSettings: () => void;
};

const TabHeader = React.memo(({ colors, topInset, profileName, streak, onSettings }: TabHeaderProps) => (
  <View style={[headerStyles(colors).headerShell, { paddingTop: topInset + SPACING.sm }]}>
    <View style={headerStyles(colors).identity}>
      <Avatar name={profileName} size="md" variant="primary" />
      <View style={headerStyles(colors).identityText}>
        <Text style={headerStyles(colors).name} numberOfLines={1}>
          {profileName}
        </Text>
        {streak > 0 && (
          <View style={headerStyles(colors).streakPill}>
            <Ionicons name="flame" size={11} color={colors.flame} />
            <Text style={headerStyles(colors).streakText}>{streak} días</Text>
          </View>
        )}
      </View>
    </View>
    <TouchableOpacity
      style={headerStyles(colors).settingsBtn}
      onPress={onSettings}
      accessibilityRole="button"
      accessibilityLabel="Ajustes"
      accessibilityHint="Abre la pantalla de configuración"
    >
      <Ionicons name="settings-outline" size={22} color={colors.onSurfaceVariant} />
    </TouchableOpacity>
  </View>
));

export const TabNavigator = () => {
  const { user } = useContext(AuthContext);
  const theme = useAppTheme();
  const colors = theme.colors;
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const stateLoaded = useHomeStore((s) => s.stateLoaded);
  const loadState = useHomeStore((s) => s.loadState);
  const saveState = useHomeStore((s) => s.saveState);
  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const bumpStreak = useHomeStore((s) => s.bumpStreak);
  const pomodoroSessions = usePomodoroStore((s) => s.pomodoroSessions);
  const pomodoroMinutes = usePomodoroStore((s) => s.pomodoroMinutes);
  const celebrate = useCelebrationStore((s) => s.trigger);

  usePomodoroEngine();

  useEffect(() => {
    requestNotificationPermission().catch(() => undefined);
  }, []);

  const onboardingName = useOnboardingStore((s) => s.profile.name);
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
  }, [goals, habits, streak, pomodoroSessions, pomodoroMinutes, stateLoaded, saveState]);

  const completedGoals = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((h) => h.completed).length, [habits]);
  const dailyCompleted = completedGoals + completedHabits;
  const dailyTotal = goals.length + habits.length;
  const pendingGoals = goals.length - completedGoals;
  const pendingHabits = habits.length - completedHabits;

  const prevDailyCompleted = useRef(dailyCompleted);
  const perfectDayShown = useRef(false);
  useEffect(() => {
    if (!stateLoaded || dailyCompleted === 0) return;
    if (dailyCompleted > prevDailyCompleted.current) {
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
    prevDailyCompleted.current = dailyCompleted;
  }, [dailyCompleted, dailyTotal, stateLoaded, bumpStreak, celebrate]);

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
          header: () => (
            <TabHeader
              colors={colors}
              topInset={insets.top}
              profileName={profileName}
              streak={streak}
              onSettings={() => navigation.navigate('Settings')}
            />
          ),
          tabBarIcon: ({ focused, color, size }) => {
            const icons = TAB_ICONS[route.name];
            if (!icons) return null;
            const badge =
              route.name === 'Goals' && pendingGoals > 0
                ? pendingGoals
                : route.name === 'Habits' && pendingHabits > 0
                ? pendingHabits
                : 0;
            return (
              <View>
                <Ionicons name={focused ? icons.focused : icons.outline} size={size} color={color} />
                {badge > 0 && (
                  <View style={badgeStyles(colors).badge}>
                    <Text style={badgeStyles(colors).badgeText}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                )}
              </View>
            );
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.onSurfaceVariant,
          tabBarStyle: {
            backgroundColor: colors.surfaceContainer,
            borderTopColor: colors.outlineVariant,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingTop: SPACING.xs,
            paddingBottom: Math.max(insets.bottom, SPACING.xs),
            height: tabBarHeight,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
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
        <Tab.Screen name="Pomodoro" component={PomodoroScreen} options={{ tabBarLabel: 'Pomodoro' }} />
        <Tab.Screen name="Summary" component={SummaryScreen} options={{ tabBarLabel: 'Resumen' }} />
      </Tab.Navigator>

      <Animated.View style={[fabStyles(colors).fab, { bottom: fabBottom, transform: [{ scale: fabScale }] }]}>
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
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.onPrimary} />
          <Text style={fabStyles(colors).fabText}>SUI</Text>
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
      paddingBottom: SPACING.sm,
      backgroundColor: colors.background,
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      flex: 1,
      paddingRight: SPACING.md,
    },
    identityText: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.onSurface,
    },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      alignSelf: 'flex-start',
    },
    streakText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
    },
    settingsBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      backgroundColor: colors.primary,
      borderRadius: 30,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 7,
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
      fontWeight: '900',
      fontSize: 15,
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
      fontWeight: '900',
    },
  });
