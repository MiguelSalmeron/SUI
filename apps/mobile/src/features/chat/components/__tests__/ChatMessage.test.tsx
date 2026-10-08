import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/shared/theme/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  useAppTheme: () => ({
    colors: {
      primaryContainer: '#def',
      onPrimaryContainer: '#012',
      surfaceContainerLow: '#eee',
      outlineVariant: '#ccc',
      onSurface: '#000',
      onSurfaceVariant: '#333',
      secondary: '#060',
      error: '#b00',
    },
    type: { bodyLg: {}, bodyMd: {}, labelMd: {}, labelXs: {} },
  }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/ui/SuiMark', () => ({ SuiAvatar: jest.fn(() => null) }));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ locale: 'es', t: (key: string) => key }),
}));
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

import * as Clipboard from 'expo-clipboard';
import { ChatMessage } from '../ChatMessage';
import { SuiAvatar } from '@/shared/ui/SuiMark';

jest.mock('@/shared/ui/motion/useReduceMotion', () => ({ useReduceMotion: () => true }));

const baseTime = 1759792800000;

describe('ChatMessage', () => {
  it('muestra tu burbuja sin acciones', async () => {
    const screen = await render(
      <ChatMessage
        message={{ id: 'u1', role: 'user', content: 'Me cuesta arrancar', createdAt: baseTime }}
      />,
    );

    expect(screen.getByText('Me cuesta arrancar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'chat.copy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'chat.retry' })).toBeNull();
  });

  it('sólo el último mensaje de Sui muestra copiar y reintentar', async () => {
    const onRetry = jest.fn();
    const middle = await render(
      <ChatMessage
        message={{ id: 'a1', role: 'assistant', content: 'Vamos paso a paso', createdAt: baseTime }}
        isLastAssistant={false}
        onRetry={onRetry}
      />,
    );
    expect(middle.queryByRole('button', { name: 'chat.copy' })).toBeNull();

    const last = await render(
      <ChatMessage
        message={{ id: 'a2', role: 'assistant', content: 'Vamos paso a paso', createdAt: baseTime }}
        isLastAssistant
        onRetry={onRetry}
      />,
    );
    await fireEvent.press(last.getByRole('button', { name: 'chat.retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('copiar guarda en el portapapeles y avisa con chat.copied', async () => {
    const screen = await render(
      <ChatMessage
        message={{ id: 'a3', role: 'assistant', content: 'Respirá conmigo', createdAt: baseTime }}
        isLastAssistant
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'chat.copy' }));
    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Respirá conmigo');
    });
    expect(screen.getByRole('button', { name: 'chat.copied' })).toBeTruthy();
  });

  it('mientras llega el stream muestra detener en vez de copiar', async () => {
    const onStop = jest.fn();
    const screen = await render(
      <ChatMessage
        message={{
          id: 'a4',
          role: 'assistant',
          content: 'Voy ',
          createdAt: baseTime,
          streaming: true,
        }}
        isLastAssistant
        onStop={onStop}
      />,
    );

    expect(screen.getByText('Voy ')).toBeTruthy();
    expect(screen.getByTestId('streaming-cursor', { includeHiddenElements: true })).toBeTruthy();
    expect(jest.mocked(SuiAvatar).mock.calls.at(-1)?.[0]).toEqual({ size: 20 });
    await fireEvent.press(screen.getByRole('button', { name: 'chat.stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'chat.copy' })).toBeNull();
  });

  it('con espera real muestra la frase honesta y con error el copy único', async () => {
    const waiting = await render(
      <ChatMessage
        message={{ id: 'a5', role: 'assistant', content: '', createdAt: baseTime, streaming: true }}
        isLastAssistant
        waitingText="chat.thinking"
      />,
    );
    expect(waiting.getByText('chat.thinking')).toBeTruthy();
    expect(waiting.queryByTestId('streaming-cursor', { includeHiddenElements: true })).toBeNull();

    const failed = await render(
      <ChatMessage
        message={{
          id: 'a6',
          role: 'assistant',
          content: '',
          createdAt: baseTime,
          error: true,
        }}
        isLastAssistant
      />,
    );
    expect(failed.getByText('chat.connectionLost')).toBeTruthy();
    expect(failed.getByRole('button', { name: 'chat.retry' })).toBeTruthy();
  });
});
