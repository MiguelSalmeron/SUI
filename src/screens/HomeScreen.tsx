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
import { useNavigation } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../theme/theme';
import { DashboardNavbar, type DashboardTab } from '../components/home/DashboardNavbar';
import { HomeListSection } from '../components/home/HomeListSection';
import { PomodoroPanel } from '../components/home/PomodoroPanel';
import { useGoals } from '../hooks/useGoals';
import { useHabits } from '../hooks/useHabits';
import { usePomodoroEngine } from '../hooks/usePomodoroEngine';
import { usePomodoroStore, DEFAULT_POMODORO_MINUTES } from '../store/usePomodoroStore';
import { saveUserData, loadUserData } from '../services/db';
import { HOME_STATE_KEY } from '../services/homeStorage';

type HomeState = {
  goals: any[];
  habits: any[];
  pomodoroMinutes: number;
  pomodoroSessions: number;
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
  const [stateLoaded, setStateLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

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

  const handleLogout = () => {
    signOut(auth);
  };

  // Load persistence (Local and cloud)
  useEffect(() => {
    let isMounted = true;
    const loadState = async () => {
      try {
        // Step 1: Attempt to load from local first for instant paint
        const savedState = await AsyncStorage.getItem(HOME_STATE_KEY);
        let initialMinutes = DEFAULT_POMODORO_MINUTES;
        let initialSessions = 0;
        let initialGoals: any[] = [];
        let initialHabits: any[] = [];

        if (savedState) {
          const parsedState = JSON.parse(savedState) as Partial<HomeState>;
          initialMinutes = parsedState.pomodoroMinutes ?? DEFAULT_POMODORO_MINUTES;
          initialSessions = parsedState.pomodoroSessions ?? 0;
          initialGoals = parsedState.goals ?? [];
          initialHabits = parsedState.habits ?? [];

          if (isMounted) {
            setGoals(initialGoals);
            setHabits(initialHabits);
            initFromStorage(initialMinutes, initialSessions);
            setPomodoroMinutesInput(String(initialMinutes));
          }
        }

        // Step 2: Sincronización en la nube con Firestore (si el usuario está autenticado)
        if (user?.uid) {
          const cloudState = await loadUserData(user.uid);
          if (cloudState && isMounted) {
            // Firestore data takes priority if it exists
            setGoals(cloudState.goals ?? []);
            setHabits(cloudState.habits ?? []);
            initFromStorage(cloudState.pomodoroMinutes ?? DEFAULT_POMODORO_MINUTES, cloudState.pomodoroSessions ?? 0);
            setPomodoroMinutesInput(String(cloudState.pomodoroMinutes ?? DEFAULT_POMODORO_MINUTES));
            
            // Sync local storage to match cloud
            await AsyncStorage.setItem(HOME_STATE_KEY, JSON.stringify(cloudState));
          }
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
      const stateObj = { goals, habits, pomodoroMinutes, pomodoroSessions };
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
  }, [goals, habits, pomodoroMinutes, pomodoroSessions, stateLoaded, user]);

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
            <Text style={styles.kicker}>Tu tablero personal (Sincronizado)</Text>
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

      <TouchableOpacity
        style={styles.chatFab}
        onPress={() => navigation.navigate('Chat')}
        activeOpacity={0.85}
      >
        <Text style={styles.chatFabText}>Hablar con SUI</Text>
      </TouchableOpacity>
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
  chatFab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 30,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  chatFabText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 15,
  },
});
