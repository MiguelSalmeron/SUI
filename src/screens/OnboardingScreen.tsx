import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ChatBubble } from '../components/onboarding/ChatBubble';
import { ChatComposer } from '../components/onboarding/ChatComposer';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useHomeStore } from '../store/useHomeStore';
import { signInAnon } from '../services/onboardingAuth';
import { seedOnboardingGoals } from '../services/homeStorage';
import { loadCachedGoogleEvents } from '../services/googleSync';
import { ColorScheme, SPACING, useAppTheme } from '../theme/theme';
import {
  GOALS_REQUIRED,
  OnboardingProfile,
  OnboardingStep,
  STEP_ORDER,
  WELLNESS_GOALS,
  POPULAR_CAREERS,
  getGoalById,
  nameSchema,
  careerSchema,
  birthYearSchema,
  BotPersonality,
  Chronotype,
} from '../types/onboarding';

type ChatMessage = { id: string; from: 'bot' | 'user'; text: string };

const botCopy = (step: OnboardingStep, profile: OnboardingProfile): string => {
  switch (step) {
    case 'welcome':
      return '¡Hola! Soy SUI, tu copiloto preventivo. Te haré unas preguntas súper rápidas para adaptar tu experiencia. ¿Empezamos?';
    case 'name':
      return '¿Cómo te gustaría que te llame?';
    case 'hasRoute':
      return `¡Un gusto${profile.name ? ', ' + profile.name : ''}! ¿Estás en alguna ruta educativa o académica actualmente?`;
    case 'career':
      return 'Elige tu área de estudio o escribe el nombre exacto de tu carrera:';
    case 'botPersonality':
      return '¿Cómo prefieres que sea la personalidad de tu asistente SUI?';
    case 'chronotype':
      return '¿En qué momento del día sientes que rinde mejor tu mente?';
    case 'birthYear':
      return '¿En qué año naciste? (solo el año, ej. 2005)';
    case 'goals':
      return `Por último, elige ${GOALS_REQUIRED} objetivos de bienestar para tu día a día:`;
    case 'submitting':
      return 'Personalizando tu experiencia...';
    default:
      return '';
  }
};

const userAnswer = (
  step: OnboardingStep,
  profile: OnboardingProfile,
  selectedGoals: string[],
): string | null => {
  switch (step) {
    case 'welcome':
      return '¡Empecemos!';
    case 'name':
      return profile.name || null;
    case 'hasRoute':
      return profile.hasRoute === 'yes' ? 'Sí, estoy estudiando' : 'No por el momento';
    case 'career':
      return profile.career || null;
    case 'botPersonality':
      return profile.botPersonality === 'direct'
        ? '🚀 Enfocado y Directo'
        : profile.botPersonality === 'coach'
        ? '🔥 Coach Gamificado'
        : '🧘 Empático y Calmo';
    case 'chronotype':
      return profile.chronotype === 'night'
        ? '🌙 Noches (Búho)'
        : profile.chronotype === 'afternoon'
        ? '🌆 Tardes'
        : '🌅 Mañanas (Madrugador)';
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const step = useOnboardingStore((s) => s.step);
  const profile = useOnboardingStore((s) => s.profile);
  const selectedGoals = useOnboardingStore((s) => s.selectedGoals);
  const setName = useOnboardingStore((s) => s.setName);
  const setHasRoute = useOnboardingStore((s) => s.setHasRoute);
  const setCareer = useOnboardingStore((s) => s.setCareer);
  const setBotPersonality = useOnboardingStore((s) => s.setBotPersonality);
  const setChronotype = useOnboardingStore((s) => s.setChronotype);
  const setBirthYear = useOnboardingStore((s) => s.setBirthYear);
  const toggleGoal = useOnboardingStore((s) => s.toggleGoal);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const markComplete = useOnboardingStore((s) => s.markComplete);
  const addXp = useHomeStore((s) => s.addXp);

  const [customCareerMode, setCustomCareerMode] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const loadingPhrases = useMemo(
    () => [
      'Analizando tus objetivos...',
      'Cargando tu agenda Local-First...',
      'Otorgando tus primeros +50 XP de bienvenida...',
      '¡Todo listo!',
    ],
    [],
  );

  const progressAnim = useRef(new Animated.Value(0)).current;

  // Transcript de mensajes en el chat
  const messages = useMemo<ChatMessage[]>(() => {
    const out: ChatMessage[] = [];
    const currentIndex = STEP_ORDER.indexOf(step);
    for (let i = 0; i <= currentIndex; i++) {
      const s = STEP_ORDER[i];
      if (s === 'done') continue;
      if (s === 'career' && profile.hasRoute === 'no') continue;

      const bot = botCopy(s, profile);
      if (bot) out.push({ id: `bot-${s}`, from: 'bot', text: bot });
      if (i < currentIndex) {
        const ans = userAnswer(s, profile, selectedGoals);
        if (ans) out.push({ id: `user-${s}`, from: 'user', text: ans });
      }
    }
    return out;
  }, [step, profile, selectedGoals]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, step]);

  // Fase final de Carga & Precarga en Segundo Plano (0ms)
  useEffect(() => {
    if (step !== 'submitting') return;
    let active = true;

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2400,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setLoadingPhraseIndex((prev) => (prev < loadingPhrases.length - 1 ? prev + 1 : prev));
    }, 600);

    const finalize = async () => {
      const labels = selectedGoals
        .map((id) => getGoalById(id)?.label)
        .filter((label): label is string => Boolean(label));

      // Precargar eventos de Google local-first y sembrar metas en paralelo
      await Promise.all([
        seedOnboardingGoals(labels),
        loadCachedGoogleEvents(),
      ]);

      const result = await signInAnon();

      // Bonus de Bienvenida de +50 XP
      addXp(50);

      if (!active) return;
      setTimeout(() => {
        markComplete({ uid: result.uid, syncPending: result.syncPending });
      }, 2500);
    };

    finalize();
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, selectedGoals, markComplete, addXp, loadingPhrases.length, progressAnim]);

  const goalsComplete = selectedGoals.length === GOALS_REQUIRED;

  const renderInputArea = () => {
    switch (step) {
      case 'welcome':
        return (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={nextStep}
            accessibilityRole="button"
            accessibilityLabel="Empezar onboarding"
          >
            <Text style={styles.primaryButtonText}>Empezar</Text>
          </TouchableOpacity>
        );

      case 'name':
        return (
          <ChatComposer
            fieldSchema={nameSchema}
            placeholder="Tu nombre (ej. Carlos)"
            maxLength={40}
            onSubmitValue={(value) => {
              setName(String(value));
              nextStep();
            }}
          />
        );

      case 'hasRoute':
        return (
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setHasRoute('yes');
                nextStep();
              }}
            >
              <Ionicons name="school-outline" size={18} color={colors.primary} />
              <Text style={styles.chipText}>Sí, estoy estudiando</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setHasRoute('no');
                nextStep();
              }}
            >
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
              <Text style={styles.chipText}>No por el momento</Text>
            </TouchableOpacity>
          </View>
        );

      case 'career':
        if (customCareerMode) {
          return (
            <ChatComposer
              fieldSchema={careerSchema}
              placeholder="Ej. Arquitectura o Psicología"
              onSubmitValue={(value) => {
                setCareer(String(value));
                nextStep();
              }}
            />
          );
        }

        return (
          <View>
            <View style={styles.popularCareersGrid}>
              {POPULAR_CAREERS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.careerChip}
                  onPress={() => {
                    setCareer(c.label);
                    nextStep();
                  }}
                >
                  <Ionicons name={c.icon as any} size={16} color={colors.primary} />
                  <Text style={styles.careerChipText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.otherCareerBtn}
              onPress={() => setCustomCareerMode(true)}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.onSurfaceVariant} />
              <Text style={styles.otherCareerText}>Escribir otra carrera...</Text>
            </TouchableOpacity>
          </View>
        );

      case 'botPersonality':
        return (
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setBotPersonality('calm');
                nextStep();
              }}
            >
              <Ionicons name="leaf-outline" size={18} color={colors.primary} />
              <View>
                <Text style={styles.chipText}>🧘 Empático y Calmo</Text>
                <Text style={styles.chipSubText}>Enfoque en reducción de estrés</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setBotPersonality('direct');
                nextStep();
              }}
            >
              <Ionicons name="rocket-outline" size={18} color={colors.primary} />
              <View>
                <Text style={styles.chipText}>🚀 Enfocado y Directo</Text>
                <Text style={styles.chipSubText}>Productividad y metas sin rodeos</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setBotPersonality('coach');
                nextStep();
              }}
            >
              <Ionicons name="trophy-outline" size={18} color={colors.primary} />
              <View>
                <Text style={styles.chipText}>🔥 Coach Gamificado</Text>
                <Text style={styles.chipSubText}>Motivador con rachas y XP</Text>
              </View>
            </TouchableOpacity>
          </View>
        );

      case 'chronotype':
        return (
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setChronotype('morning');
                nextStep();
              }}
            >
              <Ionicons name="sunny-outline" size={18} color={colors.primary} />
              <Text style={styles.chipText}>🌅 Mañanas (Madrugador)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setChronotype('afternoon');
                nextStep();
              }}
            >
              <Ionicons name="partly-sunny-outline" size={18} color={colors.primary} />
              <Text style={styles.chipText}>🌆 Tardes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setChronotype('night');
                nextStep();
              }}
            >
              <Ionicons name="moon-outline" size={18} color={colors.primary} />
              <Text style={styles.chipText}>🌙 Noches (Búho)</Text>
            </TouchableOpacity>
          </View>
        );

      case 'birthYear':
        return (
          <ChatComposer
            fieldSchema={birthYearSchema}
            placeholder="Ej. 2005"
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
                    accessibilityRole="button"
                    accessibilityLabel={goal.label}
                  >
                    <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                    <Text style={[styles.goalLabel, selected && styles.goalLabelSelected]}>
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
              <Text style={styles.primaryButtonText}>Confirmar y desbloquear +50 XP</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  if (step === 'submitting') {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingBox}>
          <View style={styles.loadingLogoBadge}>
            <Ionicons name="sparkles" size={32} color={colors.primary} />
          </View>
          <Text style={styles.loadingTitle}>Personalizando tu experiencia...</Text>
          <Text style={styles.loadingPhrase}>{loadingPhrases[loadingPhraseIndex]}</Text>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.headerTitle}>Bienvenido a SUI</Text>
        <Text style={styles.headerSubtitle}>Configuremos tu espacio preventivo</Text>
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
      </ScrollView>

      <View style={[styles.inputArea, { paddingBottom: insets.bottom + SPACING.md }]}>
        {renderInputArea()}
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.onSurface,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
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
      borderTopColor: colors.outlineVariant,
      backgroundColor: colors.surface,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: SPACING.md,
      alignItems: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontWeight: '800',
      fontSize: 16,
    },
    chipsWrap: {
      flexDirection: 'column',
      gap: SPACING.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
    },
    chipText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 15,
    },
    chipSubText: {
      color: colors.onSurfaceVariant,
      fontSize: 12,
      fontWeight: '500',
      marginTop: 1,
    },
    popularCareersGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs + 2,
      marginBottom: SPACING.sm,
    },
    careerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 12,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    careerChipText: {
      color: colors.onSurface,
      fontSize: 13,
      fontWeight: '700',
    },
    otherCareerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: SPACING.xs + 2,
    },
    otherCareerText: {
      color: colors.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '600',
      textDecorationLine: 'underline',
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
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 12,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md,
    },
    goalChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    goalEmoji: {
      fontSize: 16,
    },
    goalLabel: {
      color: colors.onSurface,
      fontWeight: '600',
      fontSize: 14,
    },
    goalLabelSelected: {
      color: colors.onPrimary,
    },
    goalsCounter: {
      color: colors.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: SPACING.sm,
    },
    loadingScreen: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
    },
    loadingBox: {
      width: '100%',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainer,
      borderRadius: 24,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    loadingLogoBadge: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    loadingTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.onSurface,
      marginBottom: SPACING.xs,
    },
    loadingPhrase: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '700',
      marginBottom: SPACING.lg,
    },
    progressTrack: {
      width: '100%',
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.outlineVariant,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
  });
