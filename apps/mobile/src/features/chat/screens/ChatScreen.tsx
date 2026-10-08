import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  AppTheme,
  SPACING,
  SCREEN_CONTENT_BOTTOM_PADDING,
  useAppTheme,
} from '@/shared/theme/theme';
import { ChatMessage } from '../components/ChatMessage';
import { SuiDock } from '../components/SuiDock';
import { useSuiPresence } from '../hooks/useSuiPresence';
import { ChatInput } from '../components/ChatInput';
import { EmergencyOverlay } from '../components/EmergencyOverlay';
import { useChatStore } from '../store/useChatStore';
import { buildEmotionalProfile, buildPayload } from '../services/chatPrompt';
import { CrisisConfig, DEFAULT_CRISIS_CONFIG, fetchCrisisConfig } from '../services/crisisConfig';
import { detectCrisis } from '../services/crisisDetection';
import { streamChat, StreamController } from '../services/chatStream';
import type { ChatMessage as ChatMessageType, PromptMessage } from '../types/chat';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import { useI18n } from '@/shared/i18n/i18n';
import { AuthContext } from '@/features/auth/public';
import { PRODUCT_CONFIG } from '@/shared/config/product';

/** Borrador aparte del historial: sobrevivir a salir sin ensuciar `sui-chat-v1`. */
export const CHAT_DRAFT_KEY = 'sui-chat-draft-v1';

/** Momento local pa anclar el tono sin pedir la hora al usuario. */
const getTimeOfDay = (now = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  if (hour >= 19 && hour < 23) return 'evening';
  return 'night';
};

type WaitingPhase = 'thinking' | 'remembering' | null;

interface Props {
  navigation: {
    goBack: () => void;
    setOptions: (options: Record<string, unknown>) => void;
  };
}

export const ChatScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const messages = useChatStore((s) => s.messages);
  const streamingId = useChatStore((s) => s.streamingId);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendChunk = useChatStore((s) => s.appendChunk);
  const finalizeAssistant = useChatStore((s) => s.finalizeAssistant);
  const markError = useChatStore((s) => s.markError);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const pruneExpired = useChatStore((s) => s.pruneExpired);
  const clear = useChatStore((s) => s.clear);

  const goals = useProductivityStore((state) => state.goals);
  const habits = useProductivityStore((state) => state.habits);
  const streak = useProductivityStore((state) => state.streak);
  const { locale, t } = useI18n();
  const { user } = useContext(AuthContext);

  const [crisisConfig, setCrisisConfig] = useState<CrisisConfig>(DEFAULT_CRISIS_CONFIG);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [draft, setDraft] = useState('');
  // Fijate que la espera es estado de pantalla, no persistido: si salís y
  // volvés, no hay frase vieja colgada, sólo el borrador.
  const [waitingPhase, setWaitingPhase] = useState<WaitingPhase>(null);

  const listRef = useRef<FlatList<ChatMessageType>>(null);
  const controllerRef = useRef<StreamController | null>(null);
  const inputRef = useRef<TextInput>(null);
  const waitTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const busy = streamingId !== null;
  const activeGoalsCount = useMemo(() => goals.filter((goal) => !goal.completed).length, [goals]);
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);
  const { presence, speakSignal, label } = useSuiPresence({
    streamingMessage: streamingId
      ? messages.find((message) => message.id === streamingId)
      : undefined,
    lastAssistant: messages.find((message) => message.id === lastAssistantId),
    waitingPhase,
    overlayVisible,
    draft,
  });
  const headerTitle = useCallback(
    () => <SuiDock presence={presence} speakSignal={speakSignal} label={label} />,
    [presence, speakSignal, label],
  );
  const suggestions = useMemo(
    () => [
      t('chat.suggestionPrioritize'),
      t('chat.suggestionSplitGoal'),
      t('chat.suggestionResumeHabit'),
      t('chat.suggestionFirstStep'),
    ],
    [t],
  );

  const clearWaiting = useCallback(() => {
    waitTimers.current.forEach((timer) => clearTimeout(timer));
    waitTimers.current = [];
    setWaitingPhase(null);
  }, []);

  // La frase sólo aparece si la espera es real: antes de 600 ms no se muestra
  // nada para no inventar una espera que no existió.
  const scheduleWaiting = useCallback(
    (assistantId: string, hasActiveGoals: boolean) => {
      clearWaiting();
      const thinkingTimer = setTimeout(() => {
        const current = useChatStore.getState().messages.find((m) => m.id === assistantId);
        if (current && current.streaming && current.content.length === 0) {
          setWaitingPhase('thinking');
        }
      }, 600);
      const rememberingTimer = setTimeout(() => {
        const current = useChatStore.getState().messages.find((m) => m.id === assistantId);
        if (current && current.streaming && current.content.length === 0 && hasActiveGoals) {
          setWaitingPhase('remembering');
        }
      }, 1200);
      waitTimers.current = [thinkingTimer, rememberingTimer];
    },
    [clearWaiting],
  );

  const confirmClear = useCallback(() => {
    Alert.alert(t('chat.clearTitle'), t('chat.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('chat.delete'), style: 'destructive', onPress: () => clear() },
    ]);
  }, [clear, t]);

  // Header nativo: el botón de retorno lo provee el Stack (flecha nativa).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle,
      headerRight: () => (
        <TouchableOpacity
          onPress={confirmClear}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('chat.clearTitle')}
        >
          <Text style={styles.headerBtnText}>{t('chat.clear')}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, headerTitle, confirmClear, styles, t]);

  // Carga del diccionario de crisis + limpieza de historial + borrador.
  useEffect(() => {
    pruneExpired();
    let active = true;
    fetchCrisisConfig(locale, PRODUCT_CONFIG.countryCode).then((cfg) => {
      if (active) setCrisisConfig(cfg);
    });
    AsyncStorage.getItem(CHAT_DRAFT_KEY)
      .then((saved) => {
        if (active && saved) setDraft(saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      controllerRef.current?.cancel();
      // Al salir, el mensaje no puede quedar en streaming:true (se
      // persistiría así en `sui-chat-v1`): se conserva el texto parcial y se
      // apaga el cursor.
      const pendingId = useChatStore.getState().streamingId;
      if (pendingId) useChatStore.getState().finalizeAssistant(pendingId);
      waitTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, [locale, pruneExpired]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const persistDraft = useCallback((value: string) => {
    if (value) {
      AsyncStorage.setItem(CHAT_DRAFT_KEY, value).catch(() => undefined);
    } else {
      AsyncStorage.removeItem(CHAT_DRAFT_KEY).catch(() => undefined);
    }
  }, []);

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      persistDraft(value);
    },
    [persistDraft],
  );

  const openStream = useCallback(
    (payload: PromptMessage[], assistantId: string) => {
      streamChat(payload, {
        onChunk: (delta) => {
          // Con el primer chunk se cae la frase de espera y queda el cursor.
          if (useChatStore.getState().streamingId === assistantId) {
            clearWaiting();
          }
          appendChunk(assistantId, delta);
          scrollToEnd();
        },
        onDone: () => {
          clearWaiting();
          finalizeAssistant(assistantId);
        },
        onError: () => {
          clearWaiting();
          markError(assistantId);
        },
      }).then((controller) => {
        // Si ya se pidió detener (o el stream terminó) antes de que llegara
        // el controller, cancelalo al recibirlo y no lo guardés: sino el
        // `then` reviviría un stream que el usuario ya detuvo.
        if (useChatStore.getState().streamingId !== assistantId) {
          controller.cancel();
          return;
        }
        controllerRef.current = controller;
      });
    },
    [appendChunk, clearWaiting, finalizeAssistant, markError, scrollToEnd],
  );

  // La ficha se arma al enviar: títulos frescos + momento del día, sin pedir
  // datos de más. Metas con progreso y hábitos con racha anclan la respuesta.
  const buildProfileCard = useCallback(
    () =>
      buildEmotionalProfile({
        name: user?.displayName ?? '',
        goals: goals
          .filter((goal) => !goal.completed)
          .slice(0, 3)
          .map((goal) => `${goal.title} (${goal.progress}%)`),
        habits: habits
          .filter((habit) => !habit.completed)
          .slice(0, 3)
          .map((habit) =>
            habit.streak > 1 ? `${habit.title} (racha ${habit.streak})` : habit.title,
          ),
        timeOfDay: getTimeOfDay(),
        streak,
        locale,
      }),
    [goals, habits, locale, streak, user?.displayName],
  );

  const handleSend = useCallback(
    (text: string) => {
      if (busy) return;

      // Protocolo de intervención: validación en cliente ANTES del envío.
      // Si hay crisis, el borrador queda en la cápsula para que lo reformulés.
      if (detectCrisis(text, crisisConfig)) {
        setOverlayVisible(true);
        return;
      }

      // Recién acá se vacía el campo: el envío fue aceptado.
      addUserMessage(text);
      setDraft('');
      AsyncStorage.removeItem(CHAT_DRAFT_KEY).catch(() => undefined);

      // El payload se arma con el historial fresco (incluye el mensaje recién
      // agregado) tomado del estado actual del store.
      const profileCard = buildProfileCard();
      const payload = buildPayload(profileCard, useChatStore.getState().messages);

      const assistantId = startAssistantMessage();
      scheduleWaiting(assistantId, activeGoalsCount > 0);
      scrollToEnd();
      openStream(payload, assistantId);
    },
    [
      busy,
      crisisConfig,
      addUserMessage,
      buildProfileCard,
      startAssistantMessage,
      scheduleWaiting,
      activeGoalsCount,
      scrollToEnd,
      openStream,
    ],
  );

  const handleStop = useCallback(() => {
    if (!streamingId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    controllerRef.current?.cancel();
    controllerRef.current = null;
    // Se conserva lo ya escrito: finalizar no borra el texto parcial.
    clearWaiting();
    finalizeAssistant(streamingId);
  }, [streamingId, clearWaiting, finalizeAssistant]);

  const handleRetry = useCallback(
    (failedAssistantId?: string) => {
      if (busy) return;
      const lastText = useChatStore.getState().lastSentText;
      if (!lastText) return;

      // Reintentar no duplica tu mensaje: borra la respuesta fallida o
      // incompleta y vuelve a abrir el stream con el historial que ya incluye
      // tu texto.
      const allMessages = useChatStore.getState().messages;
      const targetId = failedAssistantId ?? allMessages[allMessages.length - 1]?.id ?? null;
      const target = targetId
        ? useChatStore.getState().messages.find((m) => m.id === targetId)
        : null;
      if (target && target.role === 'assistant') {
        removeMessage(target.id);
      }

      const profileCard = buildProfileCard();
      const payload = buildPayload(profileCard, useChatStore.getState().messages);
      const assistantId = startAssistantMessage();
      scheduleWaiting(assistantId, activeGoalsCount > 0);
      scrollToEnd();
      openStream(payload, assistantId);
    },
    [
      busy,
      buildProfileCard,
      removeMessage,
      startAssistantMessage,
      scheduleWaiting,
      activeGoalsCount,
      scrollToEnd,
      openStream,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessageType }) => (
      <ChatMessage
        message={item}
        isLastAssistant={item.role === 'assistant' && item.id === lastAssistantId}
        onRetry={() => handleRetry(item.id)}
        onStop={handleStop}
      />
    ),
    [lastAssistantId, handleRetry, handleStop],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('chat.hello')}</Text>
            <Text style={styles.emptyText}>{t('chat.empty')}</Text>
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestion}
                  onPress={() => {
                    handleDraftChange(suggestion);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.emptyNote}>{t('chat.localTtl')}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <ChatInput
          busy={busy}
          text={draft}
          onChangeText={handleDraftChange}
          onSend={handleSend}
          onStop={handleStop}
          inputRef={inputRef}
        />
      </KeyboardAvoidingView>

      <EmergencyOverlay
        visible={overlayVisible}
        config={crisisConfig}
        onClose={() => setOverlayVisible(false)}
      />
    </SafeAreaView>
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    headerBtn: {
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.xs,
    },
    headerBtnText: {
      ...type.labelLg,
      color: colors.primary,
    },
    listContent: {
      padding: SPACING.lg,
      paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING + SPACING.lg,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.xl,
    },
    emptyTitle: {
      ...type.headlineMd,
      color: colors.onSurface,
      marginBottom: SPACING.sm,
    },
    emptyText: {
      ...type.bodyLg,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: SPACING.md,
    },
    emptyNote: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      opacity: 0.8,
    },
    suggestions: {
      width: '100%',
      maxWidth: 480,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    suggestion: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
      borderRadius: 22,
      backgroundColor: colors.primaryContainer,
    },
    suggestionText: { ...type.labelMd, color: colors.onPrimaryContainer },
  });
