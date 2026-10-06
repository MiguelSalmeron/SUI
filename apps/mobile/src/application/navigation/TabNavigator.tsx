import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '@/features/auth/public';
import { useDeferredStarterSeed } from '@/features/onboarding/public';
import {
  MD3_RADIUS,
  type AppTheme,
  SPACING,
  type ColorScheme,
  useAppTheme,
} from '@/shared/theme/theme';
import {
  isHabitDueToday,
  localDateKey,
  useProductivityStore,
} from '@/shared/domain/productivity/public';
import { appEventBus } from '@/shared/events/appEventBus';
import { Avatar } from '@/shared/ui/Avatar';
import { SuiMark } from '@/shared/ui/SuiMark';
import type { MainTabParamList, RootStackNavigationProp } from '@/shared/navigation/types';
import { ASSISTANT_INSERT_INDEX, MAIN_TAB_ITEMS } from './mainTabs';
import { CalendarScreen } from '@/features/calendar/public';
import { GoalsScreen } from '@/features/goals/public';
import { HabitsScreen } from '@/features/habits/public';
import { OverviewScreen } from '@/features/home/public';
import {
  AccountabilityCheckInHost,
  ACCOUNTABILITY_PAYLOAD_TYPE,
  cancelAllAccountabilityNotifications,
  reconcileAccountability,
  useAccountabilityStore,
} from '@/features/accountability/public';
import { useEngagementReconcile } from '@/features/engagement/public';
import {
  addNotificationResponseListener,
  getLastNotificationResponseAsync,
} from '@/shared/infrastructure/notifications';
import { useI18n } from '@/shared/i18n/i18n';
import { PRODUCT_CONFIG } from '@/shared/config/product';

export { MAIN_TAB_ITEMS } from './mainTabs';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Hidrata accountability con la sesión vigente y reconcilia la agenda:
 * al montar, al cambiar de usuario y al volver a foreground (plan §7.5).
 * Limpia compromisos de metas/hábitos eliminados vía verificación inyectada.
 * Nunca solicita permisos ni bloquea el render.
 */
const useReconcileAccountability = (uid: string | null, enabled: boolean) => {
  const handleAuthUserChanged = useAccountabilityStore((state) => state.handleAuthUserChanged);
  const goals = useProductivityStore((state) => state.goals);
  const habits = useProductivityStore((state) => state.habits);
  const subjectExistsRef = useRef({ goals, habits });
  subjectExistsRef.current = { goals, habits };

  useEffect(() => {
    let active = true;
    void (async () => {
      await handleAuthUserChanged(uid);
      if (!active) return;
      if (!enabled) {
        await cancelAllAccountabilityNotifications();
        return;
      }
      await reconcileAccountability({
        subjectExists: (type, id) =>
          type === 'goal'
            ? subjectExistsRef.current.goals.some((item) => item.id === id)
            : subjectExistsRef.current.habits.some((item) => item.id === id),
      });
    })();
    return () => {
      active = false;
    };
  }, [uid, enabled, handleAuthUserChanged]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (enabled && state === 'active' && useAccountabilityStore.getState().stateLoaded) {
        void reconcileAccountability({
          subjectExists: (type, id) =>
            type === 'goal'
              ? subjectExistsRef.current.goals.some((item) => item.id === id)
              : subjectExistsRef.current.habits.some((item) => item.id === id),
        });
      }
    });
    return () => subscription.remove();
  }, [enabled]);
};

/**
 * Toque de una alerta de accountability → abre el check-in correspondiente.
 * Sólo enruta: nunca muta datos sin confirmación del usuario (plan §11).
 */
const useAccountabilityNotificationRouting = (enabled: boolean) => {
  const openCheckIn = useAccountabilityStore((state) => state.openCheckIn);

  useEffect(() => {
    if (!enabled) return undefined;
    const routeResponse = (
      response: {
        notification: { request: { content: { data?: Record<string, unknown> } } };
      } | null,
    ) => {
      const data = response?.notification.request.content.data;
      if (data?.type !== ACCOUNTABILITY_PAYLOAD_TYPE) return;
      const commitmentId = typeof data.commitmentId === 'string' ? data.commitmentId : '';
      const cycleId = typeof data.cycleId === 'string' ? data.cycleId : '';
      if (commitmentId && cycleId) openCheckIn(commitmentId, cycleId);
    };
    void getLastNotificationResponseAsync().then(routeResponse);
    return addNotificationResponseListener(routeResponse);
  }, [enabled, openCheckIn]);
};

type TabHeaderProps = {
  colors: ColorScheme;
  topInset: number;
  profileName: string;
  settingsLabel: string;
  settingsHint: string;
  onSettings: () => void;
};

export const TabHeader = React.memo(function TabHeader({
  colors,
  topInset,
  profileName,
  settingsLabel,
  settingsHint,
  onSettings,
}: TabHeaderProps) {
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
          accessibilityLabel={settingsLabel}
          accessibilityHint={settingsHint}
        >
          <Avatar name={profileName} size="sm" variant="primary" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

type MainTabBarProps = BottomTabBarProps & {
  colors: ColorScheme;
  elevation: AppTheme['elevation'];
  scheme: AppTheme['scheme'];
  onAssistant: () => void;
  labels: Record<keyof MainTabParamList, string>;
  assistantAccessibilityLabel: string;
  assistantAccessibilityHint: string;
};

export const MainTabBar = ({
  state,
  navigation,
  insets,
  colors,
  elevation,
  scheme,
  onAssistant,
  labels,
  assistantAccessibilityLabel,
  assistantAccessibilityHint,
}: MainTabBarProps) => {
  const styles = useMemo(
    () => tabBarStyles(colors, elevation, scheme),
    [colors, elevation, scheme],
  );
  const assistantScale = useRef(new Animated.Value(1)).current;
  useEffect(() => () => assistantScale.stopAnimation(), [assistantScale]);

  const animateAssistant = (value: number) => {
    Animated.timing(assistantScale, {
      toValue: value,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const assistantButton = (
    <Pressable
      key="assistant"
      style={styles.assistantSlot}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onAssistant();
      }}
      onPressIn={() => animateAssistant(0.96)}
      onPressOut={() => animateAssistant(1)}
      accessibilityRole="button"
      accessibilityLabel={assistantAccessibilityLabel}
      accessibilityHint={assistantAccessibilityHint}
      testID="assistant-tab-button"
    >
      <Animated.View style={[styles.assistantOrb, { transform: [{ scale: assistantScale }] }]}>
        <View pointerEvents="none" style={styles.assistantHalo} />
        <View style={styles.assistantButton}>
          <SuiMark variant="isotype" tone="inverse" size={24} />
        </View>
      </Animated.View>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.barSurface,
        {
          paddingBottom: Math.max(insets.bottom, 8) + 8,
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
                accessibilityLabel={labels[routeName]}
                testID={`tab-${routeName}`}
              >
                <View style={[styles.iconShell, focused && styles.iconShellActive]}>
                  <Ionicons
                    name={focused ? presentation.focused : presentation.outline}
                    size={24}
                    color={color}
                    accessible={false}
                    importantForAccessibility="no"
                  />
                </View>
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
  const { t } = useI18n();
  const tabLabels = useMemo(
    () => ({
      Overview: t('nav.home'),
      Goals: t('nav.goals'),
      Habits: t('nav.habits'),
      Calendar: t('nav.calendar'),
    }),
    [t],
  );

  const stateLoaded = useProductivityStore((state) => state.stateLoaded);
  const loadState = useProductivityStore((state) => state.loadState);
  const handleAuthUserChanged = useProductivityStore((state) => state.handleAuthUserChanged);
  const saveState = useProductivityStore((state) => state.saveState);
  const goals = useProductivityStore((state) => state.goals);
  const habits = useProductivityStore((state) => state.habits);
  const streak = useProductivityStore((state) => state.streak);
  const bumpStreak = useProductivityStore((state) => state.bumpStreak);

  const profileName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Sui';

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Si la sesión se restaura después del mount inicial (o cambia el uid),
  // recargar para no dejar datos cargados bajo otra clave de usuario.
  useEffect(() => {
    handleAuthUserChanged(user?.uid ?? null);
  }, [user?.uid, handleAuthUserChanged]);

  // Va después del efecto de handleAuthUserChanged: la recarga por uid debe empezar antes de evaluar la siembra.
  useDeferredStarterSeed(user?.uid ?? null);

  useReconcileAccountability(user?.uid ?? null, PRODUCT_CONFIG.accountabilityEnabled);
  useAccountabilityNotificationRouting(PRODUCT_CONFIG.accountabilityEnabled);
  // Acompañamiento por franjas: independiente de accountability y detrás de flag.
  useEngagementReconcile(user?.uid ?? null, PRODUCT_CONFIG.engagementEnabled);

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

  const completedGoals = useMemo(() => goals.filter((goal) => goal.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((habit) => habit.completed).length, [habits]);
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

  const prevCompletedActions = useRef(totalCompletedActions);
  const perfectDayShown = useRef(false);
  useEffect(() => {
    if (!stateLoaded) return;
    if (totalCompletedActions > prevCompletedActions.current) {
      bumpStreak();
      if (dailyTotal > 0 && dailyCompleted === dailyTotal && !perfectDayShown.current) {
        perfectDayShown.current = true;
        appEventBus.emit('productivity.perfectDayReached', {
          date: localDateKey(),
          occurredAt: new Date().toISOString(),
        });
      }
    }
    prevCompletedActions.current = totalCompletedActions;
  }, [dailyCompleted, dailyTotal, totalCompletedActions, stateLoaded, bumpStreak]);

  const openAssistant = useCallback(() => {
    navigation.navigate('Chat');
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {PRODUCT_CONFIG.accountabilityEnabled ? (
        <AccountabilityCheckInHost goals={goals} habits={habits} />
      ) : null}
      <Tab.Navigator
        tabBar={(props) => (
          <MainTabBar
            {...props}
            colors={colors}
            elevation={theme.elevation}
            scheme={theme.scheme}
            onAssistant={openAssistant}
            labels={tabLabels}
            assistantAccessibilityLabel={t('nav.openChat')}
            assistantAccessibilityHint={t('nav.openChatHint')}
          />
        )}
        screenOptions={{
          sceneStyle: { backgroundColor: colors.background },
          header: () => (
            <TabHeader
              colors={colors}
              topInset={insets.top}
              profileName={profileName}
              settingsLabel={t('nav.openSettings', { name: profileName })}
              settingsHint={t('nav.openSettingsHint')}
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
          options={{ title: tabLabels.Overview }}
        />
        <Tab.Screen name="Goals" component={GoalsScreen} options={{ title: tabLabels.Goals }} />
        <Tab.Screen name="Habits" component={HabitsScreen} options={{ title: tabLabels.Habits }} />
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{ title: tabLabels.Calendar }}
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

const tabBarStyles = (
  colors: ColorScheme,
  elevation: AppTheme['elevation'],
  scheme: AppTheme['scheme'],
) =>
  StyleSheet.create({
    barSurface: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    barContent: {
      width: '100%',
      maxWidth: 560,
      height: 58,
      borderRadius: MD3_RADIUS.full,
      backgroundColor: colors.surface,
      ...elevation.floating,
      borderWidth: scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.outlineVariant,
      paddingHorizontal: 8,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
    },
    tabItem: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    iconShell: {
      minWidth: 48,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconShellActive: {
      width: 56,
      height: 32,
      borderRadius: MD3_RADIUS.full,
      backgroundColor: colors.primaryContainer,
    },
    assistantSlot: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -20,
    },
    assistantOrb: {
      width: 52,
      height: 52,
    },
    assistantHalo: {
      position: 'absolute',
      width: 60,
      height: 60,
      top: -4,
      left: -4,
      backgroundColor: colors.primaryContainer,
      opacity: scheme === 'dark' ? 0.12 : 0.18,
      borderRadius: MD3_RADIUS.full,
    },
    assistantButton: {
      width: 52,
      height: 52,
      borderRadius: MD3_RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.surface,
    },
  });
