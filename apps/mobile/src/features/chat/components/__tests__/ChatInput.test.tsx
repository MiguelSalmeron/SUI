import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/shared/theme/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  useAppTheme: () => ({
    colors: {
      background: '#fff',
      onSurface: '#000',
      onSurfaceVariant: '#333',
      primary: '#00f',
      onPrimary: '#fff',
      surfaceContainerHigh: '#eee',
      surfaceContainerHighest: '#ddd',
      outlineVariant: '#ccc',
      flame: '#f60',
    },
    type: { bodyLg: {}, labelXs: {} },
  }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('respeta valor controlado y no vacía: el vaciado vive en la pantalla tras la crisis', async () => {
    const onSend = jest.fn();
    const onStop = jest.fn();
    const onChangeText = jest.fn();
    const screen = await render(
      <ChatInput
        busy={false}
        text="Priorizar mi día"
        onChangeText={onChangeText}
        onSend={onSend}
        onStop={onStop}
      />,
    );

    expect(onSend).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'chat.send' }));
    expect(onSend).toHaveBeenCalledWith('Priorizar mi día');
    // Acá el campo no se borra solo: la pantalla lo vacía después de pasar
    // detectCrisis, así el borrador sobrevive al overlay.
    expect(onChangeText).not.toHaveBeenCalledWith('');
    expect(onStop).not.toHaveBeenCalled();
  });

  it('prefill no autoenvía', async () => {
    const onSend = jest.fn();
    const onStop = jest.fn();
    const onChangeText = jest.fn();
    const screen = await render(
      <ChatInput
        busy={false}
        text=""
        onChangeText={onChangeText}
        onSend={onSend}
        onStop={onStop}
      />,
    );

    fireEvent.changeText(screen.getByPlaceholderText('chat.inputPlaceholder'), 'Dividir una meta');
    expect(onChangeText).toHaveBeenCalledWith('Dividir una meta');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('en streaming el mismo botón detiene y el campo sigue editable', async () => {
    const onSend = jest.fn();
    const onStop = jest.fn();
    const onChangeText = jest.fn();
    const screen = await render(
      <ChatInput
        busy
        text="sigo pensando"
        onChangeText={onChangeText}
        onSend={onSend}
        onStop={onStop}
      />,
    );

    // El campo nunca se bloquea: podés seguir escribiendo mientras Sui responde.
    const input = screen.getByPlaceholderText('chat.inputPlaceholder');
    expect(input.props.editable).toBe(true);

    fireEvent.press(screen.getByRole('button', { name: 'chat.stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('muestra el contador sobre 1000', async () => {
    const screen = await render(
      <ChatInput
        busy={false}
        text="hola"
        onChangeText={() => undefined}
        onSend={() => undefined}
        onStop={() => undefined}
      />,
    );

    expect(screen.getByText('4/1000')).toBeTruthy();
  });
});
