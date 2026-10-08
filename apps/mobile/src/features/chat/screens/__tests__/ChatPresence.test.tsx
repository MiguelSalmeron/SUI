import { act, render } from '@testing-library/react-native';
import { ChatScreen } from '../ChatScreen';
import type { ChatMessage } from '../../types/chat';
import { ChatInput } from '../../components/ChatInput';
import { ChatMessage as ChatMessageComponent } from '../../components/ChatMessage';
import { streamChat } from '../../services/chatStream';

jest.mock('@/shared/theme/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  SCREEN_CONTENT_BOTTOM_PADDING: 24,
  useAppTheme: () => mockTheme,
}));
const mockTheme = {
  colors: {},
  type: { labelLg: {}, headlineMd: {}, bodyLg: {}, bodySm: {}, labelMd: {} },
};
const mockT = (key: string) => key;
jest.mock('@/shared/i18n/i18n', () => ({ useI18n: () => ({ locale: 'es', t: mockT }) }));
jest.mock('@/features/auth/public', () => ({
  AuthContext: require('react').createContext({ user: null }),
}));
jest.mock('@/shared/domain/productivity/public', () => ({
  useProductivityStore: (selector: (state: object) => unknown) => selector(mockProductivity),
}));
const mockProductivity = { goals: [{ completed: false }], habits: [], streak: 0 };
jest.mock('../../components/ChatMessage', () => ({ ChatMessage: jest.fn(() => null) }));
jest.mock('../../components/ChatInput', () => ({ ChatInput: jest.fn(() => null) }));
jest.mock('../../components/EmergencyOverlay', () => ({ EmergencyOverlay: () => null }));
jest.mock('../../components/SuiDock', () => ({ SuiDock: () => null }));
jest.mock('../../services/chatStream', () => ({ streamChat: jest.fn() }));
jest.mock('../../services/chatPrompt', () => ({
  buildEmotionalProfile: jest.fn(() => ({})),
  buildPayload: jest.fn(() => []),
}));
jest.mock('../../services/crisisDetection', () => ({ detectCrisis: jest.fn(() => false) }));
jest.mock('../../services/crisisConfig', () => ({
  DEFAULT_CRISIS_CONFIG: {},
  fetchCrisisConfig: jest.fn(async () => ({})),
}));
jest.mock('../../store/useChatStore', () => ({
  useChatStore: Object.assign((selector: (state: object) => unknown) => selector(mockChatState), {
    getState: () => mockChatState,
  }),
}));
const assistant = (content = '', streaming = true): ChatMessage => ({
  id: 'a1',
  role: 'assistant',
  content,
  streaming,
  createdAt: 0,
});
const mockChatState = {
  messages: [assistant()],
  streamingId: 'a1' as string | null,
  addUserMessage: jest.fn(),
  startAssistantMessage: jest.fn(),
  appendChunk: jest.fn(),
  finalizeAssistant: jest.fn(),
  markError: jest.fn(),
  removeMessage: jest.fn(),
  pruneExpired: jest.fn(),
  clear: jest.fn(),
};

describe('ChatScreen, presencia en header', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    mockChatState.messages = [assistant()];
    mockChatState.streamingId = 'a1';
    jest.clearAllMocks();
    mockChatState.startAssistantMessage.mockReturnValue('a1');
    jest.mocked(streamChat).mockResolvedValue({ cancel: jest.fn() });
  });
  afterEach(() => jest.useRealTimers());

  it('conserva flecha y limpiar; sólo cambia header con estado o señal limitada', async () => {
    const navigation = { goBack: jest.fn(), setOptions: jest.fn() };
    const screen = await render(<ChatScreen navigation={navigation} />);
    const headers = () =>
      navigation.setOptions.mock.calls
        .map(([options]) => options)
        .filter((options) => options.headerTitle);
    expect(navigation.setOptions.mock.calls.some(([options]) => options.headerLeft)).toBe(false);
    expect(navigation.setOptions.mock.calls.some(([options]) => options.headerRight)).toBe(true);
    mockChatState.messages = [assistant('H')];
    await screen.rerender(<ChatScreen navigation={navigation} />);
    expect(headers().at(-1).headerTitle().props).toEqual({
      presence: 'speaking',
      speakSignal: 1,
      label: null,
    });
    const count = headers().length;
    await act(async () => jest.advanceTimersByTime(109));
    mockChatState.messages = [assistant('Ho')];
    await screen.rerender(<ChatScreen navigation={navigation} />);
    expect(headers()).toHaveLength(count);
    await act(async () => jest.advanceTimersByTime(1));
    mockChatState.messages = [assistant('Hola')];
    await screen.rerender(<ChatScreen navigation={navigation} />);
    expect(headers().at(-1).headerTitle().props.speakSignal).toBe(2);
    mockChatState.streamingId = null;
    mockChatState.messages = [assistant('Hola', false)];
    await screen.rerender(<ChatScreen navigation={navigation} />);
    expect(headers().at(-1).headerTitle().props.presence).toBe('warm');
    await act(async () => jest.advanceTimersByTime(600));
    expect(headers().at(-1).headerTitle().props.presence).toBe('resting');
  });

  it('espera honesta en dock, sin duplicar rótulo en burbuja; primer chunk elimina espera', async () => {
    mockChatState.streamingId = null;
    const navigation = { goBack: jest.fn(), setOptions: jest.fn() };
    const screen = await render(<ChatScreen navigation={navigation} />);
    const header = () => navigation.setOptions.mock.calls.at(-1)?.[0].headerTitle().props;
    const input = () => jest.mocked(ChatInput).mock.calls.at(-1)![0];
    await act(async () => input().onSend('Hola'));
    mockChatState.streamingId = 'a1';
    await screen.rerender(<ChatScreen navigation={navigation} />);
    await act(async () => jest.advanceTimersByTime(599));
    expect(header().label).toBeNull();
    await act(async () => jest.advanceTimersByTime(1));
    expect(header()).toEqual({ presence: 'thinking', speakSignal: 0, label: 'chat.thinking' });
    await act(async () => jest.advanceTimersByTime(600));
    expect(header()).toEqual({ presence: 'reading', speakSignal: 0, label: 'chat.remembering' });
    expect(jest.mocked(ChatMessageComponent).mock.calls.at(-1)?.[0].waitingText).toBeUndefined();
    const callbacks = jest.mocked(streamChat).mock.calls.at(-1)![1];
    await act(async () => callbacks.onChunk('Hola'));
    mockChatState.messages = [assistant('Hola')];
    await screen.rerender(<ChatScreen navigation={navigation} />);
    expect(header()).toEqual({ presence: 'speaking', speakSignal: 1, label: null });
    await screen.unmount();
  });

  it('error finalizado mantiene concern, sin warm; hilo limpio vuelve a reposo', async () => {
    const navigation = { goBack: jest.fn(), setOptions: jest.fn() };
    const screen = await render(<ChatScreen navigation={navigation} />);
    const header = () => navigation.setOptions.mock.calls.at(-1)?.[0].headerTitle().props;
    mockChatState.streamingId = null;
    mockChatState.messages = [{ ...assistant('Parcial', false), error: true }];
    await screen.rerender(<ChatScreen navigation={navigation} />);
    expect(header().presence).toBe('concern');
    await act(async () => jest.advanceTimersByTime(600));
    expect(header().presence).toBe('concern');
    mockChatState.messages = [];
    await screen.rerender(<ChatScreen navigation={navigation} />);
    expect(header().presence).toBe('resting');
    await screen.unmount();
  });
});
