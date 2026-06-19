import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubble } from '../components/onboarding/ChatBubble';
import { TypingIndicator } from '../components/onboarding/TypingIndicator';
import { ChatComposer } from '../components/onboarding/ChatComposer';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { signInAnon } from '../services/onboardingAuth';
import { seedOnboardingGoals } from '../services/homeStorage';
import { COLORS, SPACING } from '../theme/theme';
import {
  GOALS_REQUIRED,
  OnboardingProfile,
  OnboardingStep,
  STEP_ORDER,
  STUDY_YEAR_OPTIONS,
  WELLNESS_GOALS,
  getGoalById,
  nameSchema,
  careerSchema,
  birthYearSchema,
} from '../types/onboarding';

type ChatMessage = { id: string; from: 'bot' | 'user'; text: string };

const studyYearLabel = (value: number): string =>
  STUDY_YEAR_OPTIONS.find((o) => o.value === value)?.label ?? `${value}° año`;

const botCopy = (step: OnboardingStep, profile: OnboardingProfile): string => {
  switch (step) {
    case 'welcome':
      return '¡Hola! 👋 Soy Sui, tu compañero preventivo. Te haré unas preguntas rápidas para conocerte. Sin contraseñas ni correo. ¿Empezamos?';
    case 'name':
      return '¿Cómo te gustaría que te llame?';
    case 'career':
      return `¡Un gusto${profile.name ? ', ' + profile.name : ''}! ¿Qué carrera estudias?`;
    case 'studyYear':
      return '¿En qué año de la carrera vas?';
    case 'birthYear':
      return '¿En qué año naciste? (solo el año, ej. 2003)';
    case 'goals':
      return `Genial. Por último, elige ${GOALS_REQUIRED} objetivos de bienestar en los que quieras que te acompañe 👇`;
    case 'submitting':
      return '¡Listo! Estoy preparando tu espacio personal… ✨';
    default:
      return '';
  }
};

const userAnswer = (
  step: OnboardingStep,
  profile: OnboardingProfile,
  selectedGoals: string[]
): string | null => {
  switch (step) {
    case 'welcome':
      return '¡Empecemos! 🚀';
    case 'name':
      return profile.name || null;
    case 'career':
      return profile.career || null;
    case 'studyYear':
      return profile.studyYear ? studyYearLabel(profile.studyYear) : null;
    case 'birthYear':
      return profile.birthYear ? String(profile.birthYear) : null;
    case 'goals':
      return selectedGoals.length
        ? selectedGoals
            .map((id) => getGoalById(id)?.label)
            .filter(Boolean)
            .join(', ')
        : null;
    default:
      return null;
  }
};

export const OnboardingScreen = () => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const step = useOnboardingStore((s) => s.step);
  const profile = useOnboardingStore((s) => s.profile);
  const selectedGoals = useOnboardingStore((s) => s.selectedGoals);
  const setName = useOnboardingStore((s) => s.setName);
  const setCareer = useOnboardingStore((s) => s.setCareer);
  const setStudyYear = useOnboardingStore((s) => s.setStudyYear);
  const setBirthYear = useOnboardingStore((s) => s.setBirthYear);
  const toggleGoal = useOnboardingStore((s) => s.toggleGoal);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const markComplete = useOnboardingStore((s) => s.markComplete);

  // Reconstruye el transcript de forma determinista desde el estado persistido,
  // de modo que al reanudar (Guardián de Estado) se vea el historial previo.
  const messages = useMemo<ChatMessage[]>(() => {
    const out: ChatMessage[] = [];
    const currentIndex = STEP_ORDER.indexOf(step);
    for (let i = 0; i <= currentIndex; i++) {
      const s = STEP_ORDER[i];
      if (s === 'done') continue;
      const bot = botCopy(s, profile);
      if (bot) out.push({ id: `bot-${s}`, from: 'bot', text: bot });
      // Solo mostramos la respuesta del usuario para pasos ya superados.
      if (i < currentIndex) {
        const ans = userAnswer(s, profile, selectedGoals);
        if (ans) out.push({ id: `user-${s}`, from: 'user', text: ans });
      }
    }
    return out;
  }, [step, profile, selectedGoals]);

  // Auto-scroll al final cuando cambian los mensajes o el paso.
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, step]);

  // Fase 4: al entrar a "submitting" sembramos metas y disparamos auth anónima.
  useEffect(() => {
    if (step !== 'submitting') return;
    let active = true;

    const finalize = async () => {
      const labels = selectedGoals
        .map((id) => getGoalById(id)?.label)
        .filter((label): label is string => Boolean(label));

      await seedOnboardingGoals(labels);
      const result = await signInAnon();
      if (!active) return;
      markComplete({ uid: result.uid, syncPending: result.syncPending });
    };

    finalize();
    return () => {
      active = false;
    };
  }, [step, selectedGoals, markComplete]);

  const goalsComplete = selectedGoals.length === GOALS_REQUIRED;

  const renderInputArea = () => {
    switch (step) {
      case 'welcome':
        return (
          <TouchableOpacity style={styles.primaryButton} onPress={nextStep}>
            <Text style={styles.primaryButtonText}>Empezar</Text>
          </TouchableOpacity>
        );

      case 'name':
        return (
          <ChatComposer
            fieldSchema={nameSchema}
            placeholder="Tu nombre"
            onSubmitValue={(value) => {
              setName(String(value));
              nextStep();
            }}
          />
        );

      case 'career':
        return (
          <ChatComposer
            fieldSchema={careerSchema}
            placeholder="Ej. Ingeniería en Sistemas"
            onSubmitValue={(value) => {
              setCareer(String(value));
              nextStep();
            }}
          />
        );

      case 'studyYear':
        return (
          <View style={styles.chipsWrap}>
            {STUDY_YEAR_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.chip}
                onPress={() => {
                  setStudyYear(option.value);
                  nextStep();
                }}
              >
                <Text style={styles.chipText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'birthYear':
        return (
          <ChatComposer
            fieldSchema={birthYearSchema}
            placeholder="Ej. 2003"
            keyboardType="number-pad"
            onSubmitValue={(value) => {
              setBirthYear(Number(value));
              nextStep();
            }}
          />
        );

      case 'goals':
        return (
          <View>
            <View style={styles.goalsGrid}>
              {WELLNESS_GOALS.map((goal) => {
                const selected = selectedGoals.includes(goal.id);
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.goalChip, selected && styles.goalChipSelected]}
                    onPress={() => toggleGoal(goal.id)}
                  >
                    <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                    <Text
                      style={[styles.goalLabel, selected && styles.goalLabelSelected]}
                    >
                      {goal.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.goalsCounter}>
              {selectedGoals.length}/{GOALS_REQUIRED} seleccionados
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, !goalsComplete && styles.primaryButtonDisabled]}
              onPress={nextStep}
              disabled={!goalsComplete}
            >
              <Text style={styles.primaryButtonText}>Confirmar y continuar</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.headerTitle}>Bienvenido a Sui</Text>
        <Text style={styles.headerSubtitle}>Configuremos tu compañero preventivo</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <ChatBubble key={message.id} from={message.from} text={message.text} />
        ))}
        {step === 'submitting' && <TypingIndicator />}
      </ScrollView>

      <View style={[styles.inputArea, { paddingBottom: insets.bottom + SPACING.md }]}>
        {step === 'submitting' ? (
          <View style={styles.submittingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.submittingText}>Creando tu cuenta…</Text>
          </View>
        ) : (
          renderInputArea()
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  inputArea: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: COLORS.accent,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
  },
  chipText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
  },
  goalChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  goalEmoji: {
    fontSize: 16,
  },
  goalLabel: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  goalLabelSelected: {
    color: COLORS.white,
  },
  goalsCounter: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  submittingText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
