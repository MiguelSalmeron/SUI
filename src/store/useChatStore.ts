import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, CHAT_TTL_MS } from '../types/chat';

export const CHAT_STORAGE_KEY = 'sui-chat-v1';

const newId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Descarta mensajes con más de 48h (privacidad / auto-limpieza). */
const prune = (messages: ChatMessage[]): ChatMessage[] => {
  const cutoff = Date.now() - CHAT_TTL_MS;
  return messages.filter((m) => m.createdAt >= cutoff);
};

interface ChatState {
  hydrated: boolean;
  messages: ChatMessage[];
  /** id del mensaje del asistente que está recibiendo chunks, o null. */
  streamingId: string | null;

  // Lectura
  setHydrated: (value: boolean) => void;
  pruneExpired: () => void;

  // Escritura
  addUserMessage: (content: string) => string;
  startAssistantMessage: () => string;
  appendChunk: (id: string, chunk: string) => void;
  finalizeAssistant: (id: string) => void;
  markError: (id: string) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      messages: [],
      streamingId: null,

      setHydrated: (value) => set({ hydrated: value }),

      pruneExpired: () => set((s) => ({ messages: prune(s.messages) })),

      addUserMessage: (content) => {
        const msg: ChatMessage = {
          id: newId(),
          role: 'user',
          content: content.trim(),
          createdAt: Date.now(),
        };
        set((s) => ({ messages: [...prune(s.messages), msg] }));
        return msg.id;
      },

      startAssistantMessage: () => {
        const msg: ChatMessage = {
          id: newId(),
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          streaming: true,
        };
        set((s) => ({ messages: [...s.messages, msg], streamingId: msg.id }));
        return msg.id;
      },

      appendChunk: (id, chunk) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + chunk } : m
          ),
        })),

      finalizeAssistant: (id) =>
        set((s) => ({
          streamingId: null,
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, streaming: false } : m
          ),
        })),

      markError: (id) =>
        set((s) => ({
          streamingId: null,
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, streaming: false, error: true } : m
          ),
        })),

      clear: () => set({ messages: [], streamingId: null }),
    }),
    {
      name: CHAT_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Nunca persistimos el estado de streaming en curso.
      partialize: (state) => ({ messages: state.messages }),
      onRehydrateStorage: () => (state) => {
        // Al rehidratar: limpiar mensajes caducados (>48h) y marcar listo.
        if (state) {
          state.messages = prune(state.messages);
          state.streamingId = null;
          state.setHydrated(true);
        }
      },
    }
  )
);
