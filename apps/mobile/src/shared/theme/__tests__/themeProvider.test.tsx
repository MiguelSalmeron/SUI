import { act } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import { setThemeMode } from '../themeModeStore';
import { ThemeProvider, useThemeController } from '../theme';

// Prueba punta a punta del primer toque: un solo `setThemeMode` tiene que
// voltear el `mode` que ve el árbol, sin necesitar un segundo toque ni
// una navegación que re-renderice al provider de chiripa.

const ModeProbe = () => {
  const { mode } = useThemeController();
  return <Text testID="mode">{mode}</Text>;
};

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  useSettingsStore.setState({
    theme: 'dark',
    language: 'es',
    fontSize: 'medium',
    notificationsEnabled: false,
  });
});

describe('ThemeProvider aplica el primer toque', () => {
  it('dark→light en una sola llamada', async () => {
    const screen = await render(
      <ThemeProvider>
        <ModeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mode').props.children).toBe('dark');

    await act(async () => {
      await setThemeMode('light');
    });

    expect(screen.getByTestId('mode').props.children).toBe('light');
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('light→dark en una sola llamada', async () => {
    useSettingsStore.setState({ theme: 'light' });
    const screen = await render(
      <ThemeProvider>
        <ModeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mode').props.children).toBe('light');

    await act(async () => {
      await setThemeMode('dark');
    });

    expect(screen.getByTestId('mode').props.children).toBe('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });
});
