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
} from 'react-native';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { EmergencyOverlay } from '../components/EmergencyOverlay';
import { useChatStore } from '../store/useChatStore';
import { buildEmotionalProfile, buildPayload } from '../services/chatPrompt';
import { CrisisConfig, DEFAULT_CRISIS_CONFIG, fetchCrisisConfig } from '../services/crisisConfig';
import { detectCrisis } from '../services/crisisDetection';
import { streamChat, StreamController } from '../services/chatStream';
import type { ChatMessage as ChatMessageType } from '../types/chat';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import { useI18n } from '@/shared/i18n/i18n';
import { AuthContext } from '@/features/auth/public';
import { PRODUCT_CONFIG } from '@/shared/config/product';

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
  const pruneExpired = useChatStore((s) => s.pruneExpired);
  const clear = useChatStore((s) => s.clear);

  const goals = useProductivityStore((state) => state.goals);
  const { locale, t } = useI18n();
  const { user } = useContext(AuthContext);

  const [crisisConfig, setCrisisConfig] = useState<CrisisConfig>(DEFAULT_CRISIS_CONFIG);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const listRef = useRef<FlatList<ChatMessageType>>(null);
  const controllerRef = useRef<StreamController | null>(null);

  const busy = streamingId !== null;

  const confirmClear = useCallback(() => {
    Alert.alert(t('chat.clearTitle'), t('chat.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('chat.delete'), style: 'destructive', onPress: () => clear() },
    ]);
  }, [clear, t]);

  // Header nativo: el botón de retorno lo provee el Stack (flecha nativa).
  // Solo inyectamos la acción "Limpiar" a la derecha del header.
  useLayoutEffect(() => {
    navigation.setOptions({
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
  }, [navigation, confirmClear, styles, t]);

  // Carga del diccionario de crisis + limpieza de historial caducado.
  useEffect(() => {
    pruneExpired();
    let active = true;
    fetchCrisisConfig(locale, PRODUCT_CONFIG.countryCode).then((cfg) => {
      if (active) setCrisisConfig(cfg);
    });
    return () => {
      active = false;
      controllerRef.current?.cancel();
    };
  }, [locale, pruneExpired]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      if (busy) return;

      // Protocolo de intervención: validación en cliente ANTES del envío.
      if (detectCrisis(text, crisisConfig)) {
        setOverlayVisible(true);
        return;
      }

      addUserMessage(text);

      // El payload se arma con el historial fresco (incluye el mensaje recién
      // agregado) tomado del estado actual del store.
      const profileCard = buildEmotionalProfile({
        name: user?.displayName ?? '',
        goals: goals
          .filter((goal) => !goal.completed)
          .slice(0, 3)
          .map((goal) => goal.title),
        locale,
      });
      const payload = buildPayload(profileCard, useChatStore.getState().messages);

      const assistantId = startAssistantMessage();
      scrollToEnd();

      streamChat(payload, {
        onChunk: (delta) => {
          appendChunk(assistantId, delta);
          scrollToEnd();
        },
        onDone: () => finalizeAssistant(assistantId),
        onError: () => markError(assistantId),
      }).then((controller) => {
        controllerRef.current = controller;
      });
    },
    [
      busy,
      crisisConfig,
      addUserMessage,
      goals,
      locale,
      user?.displayName,
      startAssistantMessage,
      appendChunk,
      finalizeAssistant,
      markError,
      scrollToEnd,
    ],
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
            <Text style={styles.emptyNote}>{t('chat.localTtl')}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatMessage message={item} />}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <ChatInput busy={busy} onSend={handleSend} />
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
      paddingBottom: SPACING.md,
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
  });
