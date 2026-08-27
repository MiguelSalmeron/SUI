import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '@/features/auth/context/AuthContext';
import {
  NAV_BAR_HEIGHT,
  SPACING,
  type ColorScheme,
  useAppTheme,
} from '@/shared/theme/theme';
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import {
  isHabitDueToday,
  localDateKey,
} from '@/shared/domain/productivity/homeStorage';
import { useOnboardingStore } from '@/features/onboarding/store/useOnboardingStore';
import { Avatar } from '@/shared/ui/Avatar';
import { SuiMark } from '@/shared/ui/SuiMark';
import type {
  MainTabParamList,
  RootStackNavigationProp,
} from './types';
import {
  ASSISTANT_INSERT_INDEX,
  MAIN_TAB_ITEMS,
} from './mainTabs';

export { MAIN_TAB_ITEMS } from './mainTabs';

import { OverviewScreen } from '@/features/home/screens/OverviewScreen';
import { GoalsScreen } from '@/features/goals/screens/GoalsScreen';
import { HabitsScreen } from '@/features/habits/screens/HabitsScreen';
import { CalendarScreen } from '@/features/calendar/screens/CalendarScreen';
import { CelebrationToast } from '@/features/home/components/CelebrationToast';
import { useCelebrationStore } from '@/shared/domain/productivity/useCelebrationStore';
import { requestNotificationPermission } from '@/features/settings/services/notifications';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabHeaderProps = {
  colors: ColorScheme;
  topInset: number;
  profileName: string;
  onSettings: () => void;
};

export const TabHeader = React.memo(
  ({ colors, topInset, profileName, onSettings }: TabHeaderProps) => {
    const styles = useMemo(() => headerStyles(colors), [colors]);
    return (
      <View style={[styles.headerShell, { paddingTop: topInset + SPACING.sm }]}>
        <View style={styles.headerContent}>
          <SuiMark variant="isologo" size={28} accessible />
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={onSettings}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ajustes de ${profileName}`}
            accessibilityHint="Abre la configuración de la aplicación"
          >
            <Avatar name={profileName} size="sm" variant="primary" />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

type MainTabBarProps = BottomTabBarProps & {
  colors: ColorScheme;
  onAssistant: () => void;
};

export const MainTabBar = ({
  state,
  navigation,
  insets,
  colors,
  onAssistant,
}: MainTabBarProps) => {
  const styles = useMemo(() => tabBarStyles(colors), [colors]);

  const assistantButton = (
    <TouchableOpacity
      key="assistant"
      style={styles.assistantSlot}
      onPress={onAssistant}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel="Hablar con Sui"
      accessibilityHint="Abre el chat de acompañamiento"
      testID="assistant-tab-button"
    >
      <View style={styles.assistantButton}>
        <SuiMark variant="isotype" tone="inverse" size={25} />
      </View>
      <Text style={styles.assistantLabel}>Sui</Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.barSurface,
        {
          minHeight: NAV_BAR_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, SPACING.xs),
        },
      ]}
    >
      <View style={styles.barContent}>
        {state.routes.map((route, index) => {
          const routeName = route.name as keyof MainTabParamList;
          const presentation = MAIN_TAB_ITEMS[routeName];
          const focused = state.index === index;
          const color = focused ? colors.primary : colors.onSurfaceVariant;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <React.Fragment key={route.key}>
              {index === ASSISTANT_INSERT_INDEX ? assistantButton : null}
              <TouchableOpacity
                style={styles.tabItem}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.72}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={presentation.label}
                testID={`tab-${routeName}`}
              >
                <View style={[styles.iconShell, focused && styles.iconShellActive]}>
                  <Ionicons
                    name={focused ? presentation.focused : presentation.outline}
                    size={22}
                    color={color}
                  />
                </View>
                <Text style={[styles.tabLabel, { color }]}>{presentation.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

export const TabNavigator = () => {
  const { user } = useContext(AuthContext);
  const theme = useAppTheme();
  const { colors } = theme;
  const navigation = useNavigation<RootStackNavigationProp>();
  const insets = useSafeAreaInsets();

  const stateLoaded = useHomeStore((state) => state.stateLoaded);
  const loadState = useHomeStore((state) => state.loadState);
  const saveState = useHomeStore((state) => state.saveState);
  const goals = useHomeStore((state) => state.goals);
  const habits = useHomeStore((state) => state.habits);
  const streak = useHomeStore((state) => state.streak);
  const bumpStreak = useHomeStore((state) => state.bumpStreak);
  const celebrate = useCelebrationStore((state) => state.trigger);

  useEffect(() => {
    requestNotificationPermission().catch(() => undefined);
  }, []);

  const onboardingName = useOnboardingStore((state) => state.profile.name);
  const profileName =
    onboardingName?.trim() || user?.email?.split('@')[0] || 'Usuario';

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

  const completedGoals = useMemo(
    () => goals.filter((goal) => goal.completed).length,
    [goals],
  );
  const completedHabits = useMemo(
    () => habits.filter((habit) => habit.completed).length,
    [habits],
  );
  const todayGoals = useMemo(() => {
    const today = localDateKey();
    return goals.filter(
      (goal) => goal.deadline === today || goal.impactDays?.includes(today),
    );
  }, [goals]);
  const todayHabits = useMemo(
    () => habits.filter((habit) => isHabitDueToday(habit)),
    [habits],
  );
  const dailyCompleted =
    todayGoals.filter((goal) => goal.completed).length +
    todayHabits.filter((habit) => habit.completed).length;
  const dailyTotal = todayGoals.length + todayHabits.length;
  const totalCompletedActions = completedGoals + completedHabits;

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
  }, [
    dailyCompleted,
    dailyTotal,
    totalCompletedActions,
    stateLoaded,
    bumpStreak,
    celebrate,
  ]);

  const openAssistant = useCallback(() => {
    navigation.navigate('Chat');
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CelebrationToast />
      <Tab.Navigator
        tabBar={(props) => (
          <MainTabBar
            {...props}
            colors={colors}
            onAssistant={openAssistant}
          />
        )}
        screenOptions={{
          sceneStyle: { backgroundColor: colors.background },
          header: () => (
            <TabHeader
              colors={colors}
              topInset={insets.top}
              profileName={profileName}
              onSettings={() => navigation.navigate('Settings')}
            />
          ),
          tabBarHideOnKeyboard: true,
          animation: 'fade',
          lazy: true,
        }}
      >
        <Tab.Screen
          name="Overview"
          component={OverviewScreen}
          options={{ title: MAIN_TAB_ITEMS.Overview.label }}
        />
        <Tab.Screen
          name="Goals"
          component={GoalsScreen}
          options={{ title: MAIN_TAB_ITEMS.Goals.label }}
        />
        <Tab.Screen
          name="Habits"
          component={HabitsScreen}
          options={{ title: MAIN_TAB_ITEMS.Habits.label }}
        />
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{ title: MAIN_TAB_ITEMS.Calendar.label }}
        />
      </Tab.Navigator>
    </View>
  );
};

const headerStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    headerShell: {
      backgroundColor: colors.background,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    headerContent: {
      width: '100%',
      maxWidth: 560,
      minHeight: 40,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    avatarButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
  });

const tabBarStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    barSurface: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant,
      paddingTop: SPACING.xs,
    },
    barContent: {
      width: '100%',
      maxWidth: 560,
      minHeight: NAV_BAR_HEIGHT - SPACING.xs,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    tabItem: {
      flex: 1,
      minWidth: 0,
      minHeight: 60,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 2,
    },
    iconShell: {
      minWidth: 42,
      height: 29,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconShellActive: {
      backgroundColor: colors.primaryContainer,
    },
    tabLabel: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '600',
      fontFamily: 'Poppins-SemiBold',
    },
    assistantSlot: {
      flex: 1,
      minWidth: 0,
      minHeight: 68,
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginTop: -14,
    },
    assistantButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 4,
      borderColor: colors.surface,
      shadowColor: colors.onBackground,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.14,
      shadowRadius: 6,
      elevation: 4,
    },
    assistantLabel: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      fontFamily: 'Poppins-Bold',
      color: colors.primary,
      marginTop: 1,
    },
  });
