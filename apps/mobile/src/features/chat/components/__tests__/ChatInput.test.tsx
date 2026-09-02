import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/shared/theme/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24 },
  useAppTheme: () => ({
    colors: {
      onSurface: '#000',
      onSurfaceVariant: '#333',
      primary: '#00f',
      onPrimary: '#fff',
      surface: '#fff',
      surfaceContainerLow: '#eee',
      surfaceContainerHighest: '#ddd',
      outlineVariant: '#ccc',
    },
    type: { bodyLg: {} },
  }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('respeta valor controlado y limpia después de enviar', async () => {
    const onSend = jest.fn();
    const onChangeText = jest.fn();
    const screen = await render(
      <ChatInput
        busy={false}
        text="Priorizar mi día"
        onChangeText={onChangeText}
        onSend={onSend}
      />,
    );

    expect(onSend).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'chat.send' }));
    expect(onSend).toHaveBeenCalledWith('Priorizar mi día');
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('prefill no autoenvía', async () => {
    const onSend = jest.fn();
    const onChangeText = jest.fn();
    const screen = await render(
      <ChatInput busy={false} text="" onChangeText={onChangeText} onSend={onSend} />,
    );

    fireEvent.changeText(screen.getByPlaceholderText('chat.inputPlaceholder'), 'Dividir una meta');
    expect(onChangeText).toHaveBeenCalledWith('Dividir una meta');
    expect(onSend).not.toHaveBeenCalled();
  });
});
