import { useEffect, useRef, useState } from 'react';
import type { TranslationKey } from '@/shared/i18n/translations';
import type { PresencePose } from '@/shared/ui/SuiMark';
import type { ChatMessage } from '../types/chat';

export type { PresencePose };
export type PresenceState =
  'resting' | 'listening' | 'thinking' | 'reading' | 'speaking' | 'warm' | 'concern';

export const SPEAK_INTERVAL_MS = 110;
export const WARM_DURATION_MS = 600;

type Props = {
  streamingMessage?: ChatMessage;
  lastAssistant?: ChatMessage;
  waitingPhase: 'thinking' | 'remembering' | null;
  overlayVisible: boolean;
  draft: string;
};

export const useSuiPresence = ({
  streamingMessage,
  lastAssistant,
  waitingPhase,
  overlayVisible,
  draft,
}: Props) => {
  const [speakSignal, setSpeakSignal] = useState(0);
  const [warmId, setWarmId] = useState<string | null>(null);
  const previousStreamId = useRef<string | undefined>(undefined);
  const previousText = useRef({ id: '', content: '' });
  const lastSpeakAt = useRef(-Infinity);
  const streamId = streamingMessage?.id;
  const error = !!(streamingMessage?.error || (!streamingMessage && lastAssistant?.error));
  const assistantId = lastAssistant?.id;

  useEffect(() => {
    const endedId = previousStreamId.current;
    previousStreamId.current = streamId;
    if (!endedId || streamId || endedId !== assistantId || error || overlayVisible) {
      setWarmId(null);
      return;
    }
    setWarmId(endedId);
    const warmTimer = setTimeout(() => setWarmId(null), WARM_DURATION_MS);
    return () => clearTimeout(warmTimer);
  }, [streamId, assistantId, error, overlayVisible]);

  const presence: PresenceState =
    overlayVisible || error
      ? 'concern'
      : streamingMessage && streamingMessage.content.length > 0
        ? 'speaking'
        : waitingPhase === 'remembering'
          ? 'reading'
          : waitingPhase === 'thinking'
            ? 'thinking'
            : !streamId && warmId && warmId === assistantId
              ? 'warm'
              : draft.trim().length > 0
                ? 'listening'
                : 'resting';
  const content = streamingMessage?.content ?? '';

  useEffect(() => {
    const previous = previousText.current;
    previousText.current = { id: streamId ?? '', content };
    const grew =
      previous.id !== streamId ? content.length > 0 : content.length > previous.content.length;
    if (presence !== 'speaking' || !grew) return;
    const now = Date.now();
    if (now - lastSpeakAt.current < SPEAK_INTERVAL_MS) return;
    lastSpeakAt.current = now;
    setSpeakSignal((signal) => signal + 1);
  }, [presence, streamId, content]);

  const label: TranslationKey | null =
    presence === 'thinking'
      ? 'chat.thinking'
      : presence === 'reading'
        ? 'chat.remembering'
        : presence === 'concern'
          ? 'chat.presence.concern'
          : null;

  return { presence, speakSignal, label };
};
