import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { useHomeStore } from '../../store/useHomeStore';
import { localDateKey, isHabitDueToday } from '../../services/homeStorage';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { PromptModal } from '../../components/ui/PromptModal';
import type { GoalGravity } from '../../types/models';

const DAYS_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const CalendarScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    events: googleEvents,
    lastSyncedAt,
    status: calendarStatus,
    error: calendarError,
    configured: calendarConfigured,
    ready: calendarReady,
    connected: calendarConnected,
    platformHint,
    connectAndSync,
    disconnect,
  } = useGoogleCalendar();

  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const addGoal = useHomeStore((s) => s.addGoal);

  const [selectedDate, setSelectedDate] = useState<string>(localDateKey());
  const [addGoalModalVisible, setAddGoalModalVisible] = useState(false);
  const [goalGravity, setGoalGravity] = useState<GoalGravity>('high');

  // Cuadrícula de 28 días limpia
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 3);

    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = localDateKey(d);

      const dayGoals = goals.filter(
        (g) => g.deadline === key || g.impactDays?.includes(key),
      );
      const hasHigh = dayGoals.some((g) => g.gravity === 'high');
      const hasLow = dayGoals.some((g) => g.gravity === 'low');
      const hasGoogleEvent = googleEvents.some((event) => event.date === key);

      let stress: 'green' | 'yellow' | 'red' = 'green';
      if (hasHigh) stress = 'red';
      else if (hasLow) stress = 'yellow';

      days.push({
        date: d,
        key,
        dayNum: d.getDate(),
        isToday: key === localDateKey(),
        stress,
        goals: dayGoals,
        hasGoogleEvent,
      });
    }
    return days;
  }, [goals, googleEvents]);

  const selectedDayInfo = useMemo(() => {
    const dayGoals = goals.filter(
      (g) => g.deadline === selectedDate || g.impactDays?.includes(selectedDate),
    );
    const dayHabits = habits.filter((h) => {
      const parts = selectedDate.split('-').map(Number);
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      return isHabitDueToday(h, dateObj);
    });
    const dayGoogleEvents = googleEvents.filter((event) => event.date === selectedDate);

    return {
      dateKey: selectedDate,
      goals: dayGoals,
      habits: dayHabits,
      googleEvents: dayGoogleEvents,
    };
  }, [selectedDate, goals, habits, googleEvents]);

  const handleAddGoal = (title: string) => {
    addGoal({
      title,
      deadline: selectedDate,
      gravity: goalGravity,
    });
    setAddGoalModalVisible(false);
  };

  const syncLabel =
    calendarStatus === 'syncing'
      ? 'Sincronizando…'
      : calendarStatus === 'loading-cache'
        ? 'Cargando caché…'
        : calendarStatus === 'offline'
          ? 'Usando caché local'
          : calendarConnected
            ? 'Calendario conectado'
            : 'Calendario no conectado';

  const lastSyncLabel = lastSyncedAt
    ? `Última actualización: ${new Date(lastSyncedAt).toLocaleString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Tus eventos aparecerán aquí después de conectar Google Calendar.';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Limpio */}
      <View style={styles.header}>
        <Text style={styles.title}>Planificador Mensual</Text>
      </View>

      <View style={styles.calendarConnectionCard}>
        <View style={styles.connectionHeader}>
          <View style={styles.connectionIcon}>
            <Ionicons name="logo-google" size={20} color={colors.primary} />
          </View>
          <View style={styles.connectionCopy}>
            <Text style={styles.connectionTitle}>Google Calendar</Text>
            <Text style={styles.connectionStatus}>{syncLabel}</Text>
          </View>
          {calendarConnected && (
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <Text style={styles.connectedBadgeText}>{googleEvents.length}</Text>
            </View>
          )}
        </View>
        <Text style={styles.connectionDescription}>
          Solo lectura: SUI combina tus eventos con tus metas y hábitos. No modifica tu calendario.
        </Text>
        <Text style={styles.lastSyncText}>{lastSyncLabel}</Text>
        {calendarError && <Text style={styles.connectionError}>{calendarError}</Text>}
        {platformHint && !calendarError && <Text style={styles.connectionHint}>{platformHint}</Text>}
        {!calendarConfigured && (
          <Text style={styles.connectionHint}>
            Configura el Client ID de Google para activar la conexión.
          </Text>
        )}
        <View style={styles.connectionActions}>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => void connectAndSync()}
            disabled={!calendarReady || calendarStatus === 'syncing' || calendarStatus === 'loading-cache'}
            accessibilityRole="button"
            accessibilityLabel={calendarConnected ? 'Actualizar Google Calendar' : 'Conectar Google Calendar'}
            accessibilityState={{
              disabled: !calendarReady || calendarStatus === 'syncing' || calendarStatus === 'loading-cache',
            }}
          >
            <Ionicons name={calendarConnected ? 'refresh' : 'link-outline'} size={16} color={colors.onPrimary} />
            <Text style={styles.connectButtonText}>{calendarConnected ? 'Actualizar' : 'Conectar'}</Text>
          </TouchableOpacity>
          {calendarConnected && (
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={() => void disconnect()}
              accessibilityRole="button"
              accessibilityLabel="Desconectar Google Calendar"
            >
              <Text style={styles.disconnectButtonText}>Desconectar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Encabezado días de la semana */}
      <View style={styles.daysHeader}>
        {DAYS_HEADER.map((d) => (
          <Text key={d} style={styles.dayHeaderCell}>
            {d}
          </Text>
        ))}
      </View>

      {/* Rejilla de Días */}
      <View style={styles.grid}>
        {calendarDays.map((day) => {
          const isSelected = day.key === selectedDate;
          const bgByStress = {
            green: colors.surfaceContainer,
            yellow: colors.flameContainer,
            red: colors.errorContainer,
          };

          return (
            <TouchableOpacity
              key={day.key}
              style={[
                styles.dayCell,
                {
                  backgroundColor: bgByStress[day.stress],
                  borderColor: isSelected ? colors.primary : colors.outlineVariant,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedDate(day.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayNumText,
                  day.isToday && styles.todayText,
                  isSelected && { color: colors.primary },
                ]}
              >
                {day.dayNum}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lista del Día Seleccionado (Limpia sin secciones vacías) */}
      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setGoalGravity('high');
              setAddGoalModalVisible(true);
            }}
          >
            <Ionicons name="add" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {selectedDayInfo.goals.length === 0 &&
        selectedDayInfo.habits.length === 0 &&
        selectedDayInfo.googleEvents.length === 0 ? (
          <Text style={styles.emptyText}>Sin eventos, entregas ni hábitos para esta fecha.</Text>
        ) : (
          <>
            {selectedDayInfo.googleEvents.map((event) => (
              <View key={`google-${event.id}`} style={styles.rowItem}>
                <Ionicons name="logo-google" size={16} color={colors.primary} />
                <Text style={styles.rowTitle}>
                  {event.allDay ? 'Todo el día: ' : `${event.time ?? ''} · `}
                  {event.title}
                </Text>
              </View>
            ))}

            {selectedDayInfo.goals.map((g) => (
              <View key={g.id} style={styles.rowItem}>
                <Ionicons name="flag" size={16} color={colors.primary} />
                <Text style={styles.rowTitle}>Entrega: {g.title}</Text>
              </View>
            ))}

            {selectedDayInfo.habits.map((h) => (
              <View key={h.id} style={styles.rowItem}>
                <Ionicons name="repeat" size={16} color={colors.flame} />
                <Text style={styles.rowTitle}>Hábito: {h.title}</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <PromptModal
        visible={addGoalModalVisible}
        title="Agregar Entrega para Fecha"
        hint={`Fecha: ${selectedDate}`}
        placeholder="Ej. Examen Parcial de Física"
        validate={(v) => (v ? null : 'Escribe un título')}
        onSubmit={handleAddGoal}
        onCancel={() => setAddGoalModalVisible(false)}
      />
    </ScrollView>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    content: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xl + 72,
    },
    calendarConnectionCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      marginBottom: SPACING.lg,
    },
    connectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    connectionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
      marginRight: SPACING.sm,
    },
    connectionCopy: {
      flex: 1,
    },
    connectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.onSurface,
    },
    connectionStatus: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
    },
    connectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: 12,
      backgroundColor: colors.successContainer,
    },
    connectedBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.onSuccessContainer,
    },
    connectionDescription: {
      marginTop: SPACING.sm,
      fontSize: 13,
      lineHeight: 19,
      color: colors.onSurfaceVariant,
    },
    lastSyncText: {
      marginTop: SPACING.xs,
      fontSize: 12,
      color: colors.onSurfaceVariant,
    },
    connectionError: {
      marginTop: SPACING.sm,
      fontSize: 12,
      lineHeight: 17,
      color: colors.error,
      fontWeight: '700',
    },
    connectionHint: {
      marginTop: SPACING.sm,
      fontSize: 12,
      lineHeight: 17,
      color: colors.flame,
    },
    connectionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    connectButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    connectButtonText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    disconnectButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: SPACING.sm,
    },
    disconnectButtonText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '800',
    },
    header: {
      marginBottom: SPACING.md,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.onSurface,
    },
    daysHeader: {
      flexDirection: 'row',
      marginBottom: SPACING.xs,
    },
    dayHeaderCell: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '800',
      color: colors.onSurfaceVariant,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: SPACING.lg,
    },
    dayCell: {
      width: '12.8%',
      aspectRatio: 1,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.onSurface,
    },
    todayText: {
      color: colors.primary,
      fontWeight: '900',
    },
    detailCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    detailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    detailTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.onSurface,
      textTransform: 'capitalize',
    },
    addBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      fontStyle: 'italic',
    },
    rowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onSurface,
    },
  });
