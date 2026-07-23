import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../theme/theme';
import { DashboardNavbar, type DashboardTab } from '../components/home/DashboardNavbar';
import { HomeListSection, type HomeListItem } from '../components/home/HomeListSection';
import { PomodoroPanel } from '../components/home/PomodoroPanel';
import { DailyProgress } from '../components/home/DailyProgress';
import { StreakBadge } from '../components/home/StreakBadge';
import { NightlyReportModal } from '../components/home/NightlyReportModal';
import { useGoals } from '../hooks/useGoals';
import { useHabits } from '../hooks/useHabits';
import { usePomodoroEngine } from '../hooks/usePomodoroEngine';
import { usePomodoroStore, DEFAULT_POMODORO_MINUTES } from '../store/usePomodoroStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { saveUserData, loadUserData } from '../services/db';
import {
  HOME_STATE_KEY,
  applyDailyReset,
  localDateKey,
  advanceStreak,
  normalizeStreak,
} from '../services/homeStorage';
import { buildGreeting } from '../services/greeting';
import {
  scheduleNightlyReport,
  isNightlyReportResponse,
} from '../services/notifications';
import type { DayStats } from '../services/reportPrompt';

type HomeState = {
  goals: any[];
  habits: any[];
  pomodoroMinutes: number;
  pomodoroSessions: number;
  lastResetDate?: string;
  streakCount?: number;
  lastCompletedDate?: string;
};

const tabs: Array<{ key: DashboardTab; label: string; description: string }> = [
  { key: 'overview', label: 'Inicio', description: 'Resumen rápido' },
  { key: 'goals', label: 'Metas', description: 'Objetivos del día' },
  { key: 'habits', label: 'Hábitos', description: 'Seguimiento diario' },
  { key: 'pomodoro', label: 'Pomodoro', description: 'Modo enfoque' },
  { key: 'summary', label: 'Resumen', description: 'Progreso semanal' },
];

export const HomeScreen = () => {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation<any>();

  // Nombre del onboarding (cae al email si el perfil aún no tiene nombre).
  const onboardingName = useOnboardingStore((s) => s.profile.name);
  const profileName = onboardingName?.trim() || user?.email?.split('@')[0] || 'Usuario';
  const [stateLoaded, setStateLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // Fade-in del contenido al terminar de cargar (percepción de fluidez): el
  // contenido aparece suavemente en vez de un "pop" abrupto tras la carga.
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!stateLoaded) return;
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stateLoaded, contentOpacity, contentTranslateY]);

  // Micro-interacción del FAB: escala sutil al presionar.
  const fabScale = useRef(new Animated.Value(1)).current;
  const onFabPressIn = () =>
    Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start();
  const onFabPressOut = () =>
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  // Reporte nocturno (efímero) + fecha del último reseteo diario.
  const [reportVisible, setReportVisible] = useState(false);
  const lastResetDateRef = useRef<string | undefined>(undefined);

  // Racha: días consecutivos cumpliendo. lastCompletedDateRef es el último día
  // que ya contó (evita doble conteo dentro del mismo día).
  const [streak, setStreak] = useState(0);
  const lastCompletedDateRef = useRef<string | undefined>(undefined);

  // Modals UI state
  const [configVisible, setConfigVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [itemMode, setItemMode] = useState<'goal' | 'habit'>('goal');
  const [itemTitle, setItemTitle] = useState('');
  const [pomodoroMinutesInput, setPomodoroMinutesInput] = useState(String(DEFAULT_POMODORO_MINUTES));

  // Custom Hooks
  const { goals, setGoals, addGoal, toggleGoal, removeGoal } = useGoals([]);
  const { habits, setHabits, addHabit, toggleHabit, removeHabit } = useHabits([]);

  // Zustand Store
  const pomodoroMinutes = usePomodoroStore((state) => state.pomodoroMinutes);
  const pomodoroSessions = usePomodoroStore((state) => state.pomodoroSessions);
  const pomodoroSeconds = usePomodoroStore((state) => state.pomodoroSeconds);
  const pomodoroRunning = usePomodoroStore((state) => state.pomodoroRunning);
  const pomodoroFullscreen = usePomodoroStore((state) => state.pomodoroFullscreen);
  const setPomodoroMinutes = usePomodoroStore((state) => state.setPomodoroMinutes);
  const setPomodoroSeconds = usePomodoroStore((state) => state.setPomodoroSeconds);
  const setPomodoroFullscreen = usePomodoroStore((state) => state.setPomodoroFullscreen);
  const startPomodoro = usePomodoroStore((state) => state.startPomodoro);
  const pausePomodoro = usePomodoroStore((state) => state.pausePomodoro);
  const resetPomodoro = usePomodoroStore((state) => state.resetPomodoro);
  const initFromStorage = usePomodoroStore((state) => state.initFromStorage);

  // Engine: Attach engine to component lifecycle and alert on complete
  usePomodoroEngine(() => {
    Alert.alert('Pomodoro completado', 'Tu sesión terminó. Toma un descanso breve.');
  });

  // Metrics
  const completedGoals = useMemo(() => goals.filter((item) => item.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((item) => item.completed).length, [habits]);
  const weeklySummary = useMemo(() => {
    if (goals.length === 0 && habits.length === 0) {
      return 'Empieza hoy: agrega una meta, registra un hábito y configura tu pomodoro.';
    }
    return `Metas: ${completedGoals}/${goals.length} | Hábitos: ${completedHabits}/${habits.length} | Pomodoros: ${pomodoroSessions}`;
  }, [completedGoals, completedHabits, goals.length, habits.length, pomodoroSessions]);

  // Progreso diario combinado (metas + hábitos) para la barra en tiempo real.
  const dailyTotal = goals.length + habits.length;
  const dailyCompleted = completedGoals + completedHabits;

  // Estadísticas del día para el reporte nocturno (efímero).
  const dayStats = useMemo<DayStats>(() => {
    const all: HomeListItem[] = [...goals, ...habits];
    return {
      completed: all.filter((i) => i.completed).map((i) => i.title),
      pending: all.filter((i) => !i.completed).map((i) => i.title),
      streak,
    };
  }, [goals, habits, streak]);

  // Saludo dinámico (hora local + progreso del día). Texto local, sin IA.
  const greeting = useMemo(
    () => buildGreeting({ hour: new Date().getHours(), completed: dailyCompleted, total: dailyTotal }),
    [dailyCompleted, dailyTotal]
  );

  const handleLogout = () => {
    signOut(auth);
  };

  // Load persistence (Local and cloud) + daily reset
  useEffect(() => {
    let isMounted = true;
    const loadState = async () => {
      try {
        let finalGoals: any[] = [];
        let finalHabits: any[] = [];
        let finalMinutes = DEFAULT_POMODORO_MINUTES;
        let finalSessions = 0;
        let lastReset: string | undefined;
        let finalStreakCount = 0;
        let finalLastCompleted: string | undefined;

        // Step 1: local primero (pintado instantáneo).
        const savedState = await AsyncStorage.getItem(HOME_STATE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState) as Partial<HomeState>;
          finalMinutes = parsed.pomodoroMinutes ?? DEFAULT_POMODORO_MINUTES;
          finalSessions = parsed.pomodoroSessions ?? 0;
          finalGoals = parsed.goals ?? [];
          finalHabits = parsed.habits ?? [];
          lastReset = parsed.lastResetDate;
          finalStreakCount = parsed.streakCount ?? 0;
          finalLastCompleted = parsed.lastCompletedDate;
        }

        // Step 2: la nube tiene prioridad si existe.
        if (user?.uid) {
          const cloudState = await loadUserData(user.uid);
          if (cloudState) {
            finalGoals = cloudState.goals ?? [];
            finalHabits = cloudState.habits ?? [];
            finalMinutes = cloudState.pomodoroMinutes ?? DEFAULT_POMODORO_MINUTES;
            finalSessions = cloudState.pomodoroSessions ?? 0;
            lastReset = cloudState.lastResetDate ?? lastReset;
            finalStreakCount = cloudState.streakCount ?? finalStreakCount;
            finalLastCompleted = cloudState.lastCompletedDate ?? finalLastCompleted;
          }
        }

        // Step 3: reseteo diario del checklist (medianoche local).
        const reset = applyDailyReset(finalGoals, finalHabits, lastReset);
        lastResetDateRef.current = reset.todayKey;

        // Racha: normalizar (si se rompió por un día sin cumplir → 0).
        lastCompletedDateRef.current = finalLastCompleted;
        const liveStreak = normalizeStreak({
          streakCount: finalStreakCount,
          lastCompletedDate: finalLastCompleted,
        });

        if (isMounted) {
          setGoals(reset.goals);
          setHabits(reset.habits);
          setStreak(liveStreak);
          initFromStorage(finalMinutes, finalSessions);
          setPomodoroMinutesInput(String(finalMinutes));
        }

        // Step 4: persistir el estado (incluyendo lastResetDate) para que el
        // efecto de guardado no reescriba con un día previo.
        const persisted = {
          goals: reset.goals,
          habits: reset.habits,
          pomodoroMinutes: finalMinutes,
          pomodoroSessions: finalSessions,
          lastResetDate: reset.todayKey,
          streakCount: liveStreak,
          lastCompletedDate: finalLastCompleted,
        };
        await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(persisted));
        if (user?.uid && reset.didReset) {
          await saveUserData(user.uid, persisted);
        }
      } catch (err) {
        console.error('Failed to load state:', err);
      } finally {
        if (isMounted) setStateLoaded(true);
      }
    };

    loadState();
    return () => {
      isMounted = false;
    };
  }, [user, setGoals, setHabits, initFromStorage]);

  // Save persistence (Local and cloud)
  useEffect(() => {
    if (!stateLoaded) return;
    
    const saveState = async () => {
      const stateObj = {
        goals,
        habits,
        pomodoroMinutes,
        pomodoroSessions,
        lastResetDate: lastResetDateRef.current ?? localDateKey(),
        streakCount: streak,
        lastCompletedDate: lastCompletedDateRef.current,
      };
      try {
        // Save Local
        await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(stateObj));
        
        // Save Cloud Firestore
        if (user?.uid) {
          await saveUserData(user.uid, stateObj);
        }
      } catch (err) {
        console.error('Failed to save state:', err);
      }
    };

    saveState();
  }, [goals, habits, pomodoroMinutes, pomodoroSessions, stateLoaded, user, streak]);

  // Avance de racha: en cuanto el usuario cumple algo hoy (>=1 ítem), cuenta el
  // día. advanceStreak es idempotente dentro del mismo día (no duplica).
  useEffect(() => {
    if (!stateLoaded || dailyCompleted === 0) return;
    const next = advanceStreak({
      streakCount: streak,
      lastCompletedDate: lastCompletedDateRef.current,
    });
    if (next.lastCompletedDate !== lastCompletedDateRef.current) {
      lastCompletedDateRef.current = next.lastCompletedDate;
      setStreak(next.streakCount);
    }
  }, [dailyCompleted, stateLoaded, streak]);

  // Notificaciones push locales: programa el recordatorio nocturno (21:30) y
  // escucha el toque para abrir el reporte reflexivo. 100% local/offline.
  useEffect(() => {
    scheduleNightlyReport().catch(() => undefined);

    // Cold start: la app se abrió tocando la notificación.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (isNightlyReportResponse(response)) setReportVisible(true);
    });

    // Foreground/background: toque de la notificación.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isNightlyReportResponse(response)) setReportVisible(true);
    });

    return () => sub.remove();
  }, []);

  // Handlers
  const openItemModal = (mode: 'goal' | 'habit') => {
    setItemMode(mode);
    setItemTitle('');
    setItemModalVisible(true);
  };

  const handleAddItem = () => {
    if (!itemTitle.trim()) {
      Alert.alert('Error', 'Escribe un texto antes de guardar');
      return;
    }
    
    if (itemMode === 'goal') {
      addGoal(itemTitle);
    } else {
      addHabit(itemTitle);
    }
    
    setItemModalVisible(false);
    setItemTitle('');
  };

  const savePomodoroConfig = () => {
    const minutes = Number.parseInt(pomodoroMinutesInput, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      Alert.alert('Error', 'Ingresa minutos válidos entre 1 y 180');
      return;
    }
    setPomodoroMinutes(minutes);
    setPomodoroSeconds(minutes * 60);
    pausePomodoro();
    setConfigVisible(false);
  };

  const renderOverview = () => (
    <View style={styles.overviewGrid}>
      <StreakBadge streak={streak} />
      <DailyProgress completed={dailyCompleted} total={dailyTotal} label="completados" />

      <View style={[styles.metricCard, styles.metricPrimary]}>
        <Text style={styles.metricLabelLight}>Metas activas</Text>
        <Text style={styles.metricValueLight}>{goals.length - completedGoals}</Text>
        <Text style={styles.metricHintLight}>{completedGoals} completadas</Text>
      </View>
      <View style={[styles.metricCard, styles.metricSecondary]}>
        <Text style={styles.metricLabelLight}>Hábitos activos</Text>
        <Text style={styles.metricValueLight}>{habits.length - completedHabits}</Text>
        <Text style={styles.metricHintLight}>{completedHabits} marcados</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>Pomodoro</Text>
        <Text style={styles.metricValue}>{pomodoroMinutes} min</Text>
        <Text style={styles.metricHint}>{pomodoroSessions} sesiones</Text>
      </View>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionPrimary} onPress={() => setActiveTab('goals')}>
          <Text style={styles.quickActionTextLight}>Ir a metas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionSecondary} onPress={() => setActiveTab('pomodoro')}>
          <Text style={styles.quickActionText}>Abrir pomodoro</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.reportButton} onPress={() => setReportVisible(true)}>
        <Text style={styles.reportButtonText}>Ver resumen del día 🌙</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={pomodoroFullscreen} barStyle="dark-content" />

      <Animated.View
        style={[
          styles.container,
          { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] },
        ]}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerShell}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            <Text style={styles.greeting}>
              {greeting.salutation}, {profileName} {greeting.emoji}
            </Text>
            <Text style={styles.subline}>{greeting.subline}</Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>

        <DashboardNavbar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'overview' && renderOverview()}

        {activeTab === 'goals' && (
          <HomeListSection
            title="Metas"
            subtitle="Enfoca tus objetivos principales del día."
            emptyText="No hay metas todavía. Agrega tu primera meta para empezar."
            items={goals}
            accent="primary"
            addLabel="Agregar meta"
            onAdd={() => openItemModal('goal')}
            onToggle={toggleGoal}
            onRemove={removeGoal}
          />
        )}

        {activeTab === 'habits' && (
          <HomeListSection
            title="Hábitos"
            subtitle="Registra acciones pequeñas que puedas repetir a diario."
            emptyText="No hay hábitos registrados. Crea uno para empezar a seguir tu progreso."
            items={habits}
            accent="secondary"
            addLabel="Agregar hábito"
            onAdd={() => openItemModal('habit')}
            onToggle={toggleHabit}
            onRemove={removeHabit}
          />
        )}

        {activeTab === 'pomodoro' && (
          <PomodoroPanel
            minutes={pomodoroMinutes}
            seconds={pomodoroSeconds}
            running={pomodoroRunning}
            sessions={pomodoroSessions}
            fullscreenVisible={pomodoroFullscreen}
            onStart={startPomodoro}
            onPause={pausePomodoro}
            onReset={resetPomodoro}
            onConfigure={() => setConfigVisible(true)}
            onCloseFullscreen={() => setPomodoroFullscreen(false)}
          />
        )}

        {activeTab === 'summary' && (
          <View style={styles.sectionSpacing}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Resumen semanal</Text>
              <Text style={styles.sectionSubtitle}>Una vista rápida de tu progreso</Text>
            </View>
            <View style={[styles.summaryCard, styles.cardShadow]}>
              <Text style={styles.summaryText}>{weeklySummary}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      </Animated.View>

      <Modal visible={itemModalVisible} transparent animationType="fade" onRequestClose={() => setItemModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{itemMode === 'goal' ? 'Nueva meta' : 'Nuevo hábito'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={itemMode === 'goal' ? 'Ej. Terminar el proyecto' : 'Ej. Leer 20 minutos'}
              value={itemTitle}
              onChangeText={setItemTitle}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => setItemModalVisible(false)}>
                <Text style={styles.secondaryActionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} onPress={handleAddItem}>
                <Text style={styles.primaryActionText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={configVisible} transparent animationType="fade" onRequestClose={() => setConfigVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Configurar Pomodoro</Text>
            <Text style={styles.modalHint}>Define una duración entre 1 y 180 minutos.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="25"
              keyboardType="number-pad"
              value={pomodoroMinutesInput}
              onChangeText={setPomodoroMinutesInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => setConfigVisible(false)}>
                <Text style={styles.secondaryActionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} onPress={savePomodoroConfig}>
                <Text style={styles.primaryActionText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <NightlyReportModal
        visible={reportVisible}
        stats={dayStats}
        onClose={() => setReportVisible(false)}
      />

      <Animated.View style={[styles.chatFab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Chat')}
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
          activeOpacity={0.9}
          style={styles.chatFabInner}
        >
          <Text style={styles.chatFabText}>Hablar con SUI</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  headerShell: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
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
    color: COLORS.secondary,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.text,
  },
  date: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  subline: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  logoutBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  overviewGrid: {
    gap: SPACING.sm,
  },
  metricCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  metricPrimary: {
    backgroundColor: COLORS.primary,
  },
  metricSecondary: {
    backgroundColor: COLORS.secondary,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 2,
  },
  metricHint: {
    color: COLORS.textSecondary,
    marginTop: 4,
    fontSize: 13,
  },
  metricLabelLight: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'uppercase',
  },
  metricValueLight: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 2,
  },
  metricHintLight: {
    color: COLORS.white,
    marginTop: 4,
    fontSize: 13,
    opacity: 0.9,
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  quickActionPrimary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 18,
    alignItems: 'center',
  },
  quickActionSecondary: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionTextLight: {
    color: COLORS.white,
    fontWeight: '800',
  },
  quickActionText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  reportButton: {
    backgroundColor: COLORS.text,
    padding: SPACING.md,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  reportButtonText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  sectionSpacing: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: SPACING.lg,
  },
  summaryText: {
    color: COLORS.white,
    fontSize: 15,
    lineHeight: 22,
  },
  cardShadow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  primaryAction: {
    backgroundColor: COLORS.secondary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    flex: 1,
  },
  primaryActionText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryAction: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  secondaryActionText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  chatFab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  chatFabInner: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  chatFabText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 15,
  },
});
