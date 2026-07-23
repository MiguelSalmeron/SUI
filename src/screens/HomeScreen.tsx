import React, { useContext, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../theme/theme';
import { DashboardNavbar, type DashboardTab } from '../components/home/DashboardNavbar';
import { HomeListSection, type HomeListItem } from '../components/home/HomeListSection';
import { PomodoroPanel } from '../components/home/PomodoroPanel';

type HomeState = {
  goals: HomeListItem[];
  habits: HomeListItem[];
  pomodoroMinutes: number;
  pomodoroSessions: number;
};

const HOME_STATE_KEY = 'sui-home-state-v4';
const DEFAULT_POMODORO_MINUTES = 25;

const tabs: Array<{ key: DashboardTab; label: string; description: string }> = [
  { key: 'overview', label: 'Inicio', description: 'Resumen rápido' },
  { key: 'goals', label: 'Metas', description: 'Objetivos del día' },
  { key: 'habits', label: 'Hábitos', description: 'Seguimiento diario' },
  { key: 'pomodoro', label: 'Pomodoro', description: 'Modo enfoque' },
  { key: 'summary', label: 'Resumen', description: 'Progreso semanal' },
];

const createItem = (title: string): HomeListItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  completed: false,
});

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const HomeScreen = () => {
  const { user } = useContext(AuthContext);
  const [goals, setGoals] = useState<HomeListItem[]>([]);
  const [habits, setHabits] = useState<HomeListItem[]>([]);
  const [pomodoroMinutes, setPomodoroMinutes] = useState(DEFAULT_POMODORO_MINUTES);
  const [pomodoroMinutesInput, setPomodoroMinutesInput] = useState(String(DEFAULT_POMODORO_MINUTES));
  const [pomodoroSessions, setPomodoroSessions] = useState(0);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(DEFAULT_POMODORO_MINUTES * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroFullscreen, setPomodoroFullscreen] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [itemMode, setItemMode] = useState<'goal' | 'habit'>('goal');
  const [itemTitle, setItemTitle] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [stateLoaded, setStateLoaded] = useState(false);

  const completedGoals = useMemo(() => goals.filter((item) => item.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((item) => item.completed).length, [habits]);
  const weeklySummary = useMemo(() => {
    if (goals.length === 0 && habits.length === 0) {
      return 'Empieza hoy: agrega una meta, registra un hábito y configura tu pomodoro.';
    }

    return `Metas: ${completedGoals}/${goals.length} | Hábitos: ${completedHabits}/${habits.length} | Pomodoros: ${pomodoroSessions}`;
  }, [completedGoals, completedHabits, goals.length, habits.length, pomodoroSessions]);

  const handleLogout = () => {
    signOut(auth);
  };

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(HOME_STATE_KEY);
        if (!savedState || !isMounted) {
          return;
        }

        const parsedState = JSON.parse(savedState) as Partial<HomeState>;
        const loadedMinutes = parsedState.pomodoroMinutes ?? DEFAULT_POMODORO_MINUTES;

        setGoals(parsedState.goals ?? []);
        setHabits(parsedState.habits ?? []);
        setPomodoroMinutes(loadedMinutes);
        setPomodoroMinutesInput(String(loadedMinutes));
        setPomodoroSessions(parsedState.pomodoroSessions ?? 0);
        setPomodoroSeconds(loadedMinutes * 60);
      } catch {
        // Keep the dashboard usable even if persistence fails.
      } finally {
        if (isMounted) {
          setStateLoaded(true);
        }
      }
    };

    loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!stateLoaded) {
      return;
    }

    void AsyncStorage.setItem(
      HOME_STATE_KEY,
      JSON.stringify({ goals, habits, pomodoroMinutes, pomodoroSessions })
    );
  }, [goals, habits, pomodoroMinutes, pomodoroSessions, stateLoaded]);

  useEffect(() => {
    if (!pomodoroRunning) {
      return;
    }

    const intervalId = setInterval(() => {
      setPomodoroSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          clearInterval(intervalId);
          setPomodoroRunning(false);
          setPomodoroFullscreen(false);
          setPomodoroSessions((currentSessions) => currentSessions + 1);
          Alert.alert('Pomodoro completado', 'Tu sesión terminó. Toma un descanso breve.');
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [pomodoroRunning]);

  const openItemModal = (mode: 'goal' | 'habit') => {
    setItemMode(mode);
    setItemTitle('');
    setItemModalVisible(true);
  };

  const addItem = () => {
    const trimmedTitle = itemTitle.trim();

    if (!trimmedTitle) {
      Alert.alert('Error', 'Escribe un texto antes de guardar');
      return;
    }

    const newItem = createItem(trimmedTitle);
    if (itemMode === 'goal') {
      setGoals((currentGoals) => [newItem, ...currentGoals]);
    } else {
      setHabits((currentHabits) => [newItem, ...currentHabits]);
    }

    setItemModalVisible(false);
    setItemTitle('');
  };

  const toggleGoal = (itemId: string) => {
    setGoals((currentGoals) =>
      currentGoals.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item))
    );
  };

  const toggleHabit = (itemId: string) => {
    setHabits((currentHabits) =>
      currentHabits.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item))
    );
  };

  const removeGoal = (itemId: string) => {
    setGoals((currentGoals) => currentGoals.filter((item) => item.id !== itemId));
  };

  const removeHabit = (itemId: string) => {
    setHabits((currentHabits) => currentHabits.filter((item) => item.id !== itemId));
  };

  const savePomodoroConfig = () => {
    const minutes = Number.parseInt(pomodoroMinutesInput, 10);

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      Alert.alert('Error', 'Ingresa minutos válidos entre 1 y 180');
      return;
    }

    setPomodoroMinutes(minutes);
    setPomodoroSeconds(minutes * 60);
    setPomodoroRunning(false);
    setPomodoroFullscreen(false);
    setConfigVisible(false);
  };

  const startPomodoro = () => {
    if (pomodoroSeconds === 0) {
      setPomodoroSeconds(pomodoroMinutes * 60);
    }

    setPomodoroFullscreen(true);
    setPomodoroRunning(true);
  };

  const pausePomodoro = () => {
    setPomodoroRunning(false);
  };

  const resetPomodoro = () => {
    setPomodoroRunning(false);
    setPomodoroFullscreen(false);
    setPomodoroSeconds(pomodoroMinutes * 60);
  };

  const renderOverview = () => (
    <View style={styles.overviewGrid}>
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
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={pomodoroFullscreen} barStyle="dark-content" />

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerShell}>
          <View>
            <Text style={styles.kicker}>Tu tablero personal</Text>
            <Text style={styles.greeting}>Hola, {user?.email?.split('@')[0] || 'Usuario'}</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
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
              <TouchableOpacity style={styles.primaryAction} onPress={addItem}>
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

      <Modal visible={pomodoroFullscreen} animationType="fade" onRequestClose={() => setPomodoroFullscreen(false)}>
        <View style={styles.fullscreenShell}>
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity onPress={() => setPomodoroFullscreen(false)}>
              <Text style={styles.fullscreenAction}>Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetPomodoro}>
              <Text style={styles.fullscreenAction}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fullscreenBody}>
            <Text style={styles.fullscreenKicker}>Modo enfoque</Text>
            <Text style={styles.fullscreenTimer}>{formatTime(pomodoroSeconds)}</Text>
            <Text style={styles.fullscreenMeta}>Duración: {pomodoroMinutes} minutos</Text>
            <Text style={styles.fullscreenMeta}>Sesiones completadas: {pomodoroSessions}</Text>

            <View style={styles.fullscreenButtons}>
              <TouchableOpacity style={styles.secondaryAction} onPress={pausePomodoro}>
                <Text style={styles.secondaryActionText}>{pomodoroRunning ? 'Pausar' : 'Reanudar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} onPress={startPomodoro}>
                <Text style={styles.primaryActionText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  fullscreenShell: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullscreenAction: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  fullscreenBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenKicker: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.md,
  },
  fullscreenTimer: {
    color: COLORS.white,
    fontSize: 78,
    fontWeight: '900',
    letterSpacing: 2,
  },
  fullscreenMeta: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: SPACING.sm,
    opacity: 0.94,
  },
  fullscreenButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    width: '100%',
  },
});
