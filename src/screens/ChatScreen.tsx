import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { ColorScheme, SPACING, useAppTheme } from '../theme/theme';
import { ChatMessage } from '../components/chat/ChatMessage';
import { ChatInput } from '../components/chat/ChatInput';
import { EmergencyOverlay } from '../components/chat/EmergencyOverlay';
import { useChatStore } from '../store/useChatStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { buildEmotionalProfile, buildPayload } from '../services/chatPrompt';
import {
  CrisisConfig,
  DEFAULT_CRISIS_CONFIG,
  fetchCrisisConfig,
} from '../services/crisisConfig';
import { detectCrisis } from '../services/crisisDetection';
import { streamChat, StreamController } from '../services/chatStream';
import type { ChatMessage as ChatMessageType } from '../types/chat';

interface Props {
  navigation: {
    goBack: () => void;
    setOptions: (options: Record<string, unknown>) => void;
  };
}

export const ChatScreen = ({ navigation }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const messages = useChatStore((s) => s.messages);
  const streamingId = useChatStore((s) => s.streamingId);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendChunk = useChatStore((s) => s.appendChunk);
  const finalizeAssistant = useChatStore((s) => s.finalizeAssistant);
  const markError = useChatStore((s) => s.markError);
  const pruneExpired = useChatStore((s) => s.pruneExpired);
  const clear = useChatStore((s) => s.clear);

  const profile = useOnboardingStore((s) => s.profile);
  const selectedGoals = useOnboardingStore((s) => s.selectedGoals);

  const [crisisConfig, setCrisisConfig] = useState<CrisisConfig>(DEFAULT_CRISIS_CONFIG);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const listRef = useRef<FlatList<ChatMessageType>>(null);
  const controllerRef = useRef<StreamController | null>(null);

  const busy = streamingId !== null;

  const confirmClear = useCallback(() => {
    Alert.alert('Borrar conversación', '¿Seguro que quieres limpiar el chat?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => clear() },
    ]);
  }, [clear]);

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
          accessibilityLabel="Limpiar conversación"
        >
          <Text style={styles.headerBtnText}>Limpiar</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, confirmClear]);

  // Carga del diccionario de crisis + limpieza de historial caducado.
  useEffect(() => {
    pruneExpired();
    let active = true;
    fetchCrisisConfig().then((cfg) => {
      if (active) setCrisisConfig(cfg);
    });
    return () => {
      active = false;
      controllerRef.current?.cancel();
    };
  }, [pruneExpired]);

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
      const profileCard = buildEmotionalProfile(profile, selectedGoals);
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
      profile,
      selectedGoals,
      startAssistantMessage,
      appendChunk,
      finalizeAssistant,
      markError,
      scrollToEnd,
    ]
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
            <Text style={styles.emptyTitle}>Hola</Text>
            <Text style={styles.emptyText}>
              Estoy aquí para escucharte. Cuéntame cómo te sientes hoy.
            </Text>
            <Text style={styles.emptyNote}>
              Tu conversación se guarda solo en este dispositivo y se borra
              automáticamente a las 48 horas.
            </Text>
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

const createStyles = (colors: ColorScheme) => StyleSheet.create({
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
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
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
    fontSize: 26,
    fontWeight: '900',
    color: colors.onSurface,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: SPACING.md,
  },
  emptyNote: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 19,
    opacity: 0.8,
  },
});
