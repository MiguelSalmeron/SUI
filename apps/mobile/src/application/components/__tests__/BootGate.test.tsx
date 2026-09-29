import { act } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockFonts: { ready: boolean; status: string } = { ready: false, status: 'loading' };
const mockIntro = { hydrated: false, setHydrated: jest.fn() };

jest.mock('../useFontsReady', () => ({ useFontsReady: () => mockFonts }));
jest.mock('@/features/onboarding/public', () => ({
  useIntroStore: (selector: (state: typeof mockIntro) => unknown) => selector(mockIntro),
}));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'es', formatDate: () => '' }),
}));
jest.mock('@/shared/observability/telemetry', () => ({ recordTelemetry: jest.fn() }));
// El indicador animado tiene sus propios tests; acá sólo interesa la compuerta.
jest.mock('@/shared/ui/SuiLoader', () => ({ SuiLoader: () => null }));
jest.mock('@/shared/theme/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  useAppTheme: () => ({
    scheme: 'light',
    colors: { background: '#F6FAFC', primary: '#1677A6', onSurfaceVariant: '#516473' },
    type: { bodyMd: {} },
    motion: { indeterminate: { rotate: 1100, shimmer: 800 } },
  }),
}));
jest.mock('react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo', () => ({
  __esModule: true,
  default: {
    announceForAccessibility: jest.fn(),
    isReduceMotionEnabled: () => Promise.resolve(false),
  },
}));

import * as SplashScreen from 'expo-splash-screen';
import { BootGate, MESSAGE_DELAY_MS } from '../BootGate';

/** `fireEvent(..., 'layout')` rompe el alcance de act de RTL para los renders
 * siguientes, así que el handler se invoca directo. */
const fireLayout = (node: { props: { onLayout?: () => void } }) => {
  act(() => {
    node.props.onLayout?.();
  });
};

const renderGate = (messageDelayMs?: number) =>
  render(
    <BootGate messageDelayMs={messageDelayMs}>
      <Text>contenido</Text>
    </BootGate>,
  );

describe('BootGate (§12 familia 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFonts.ready = false;
    mockFonts.status = 'loading';
    mockIntro.hydrated = false;
  });

  it('sin arranque listo muestra la marca y no el contenido', async () => {
    const screen = await renderGate();

    expect(screen.getByTestId('loading-screen')).toBeTruthy();
    expect(screen.queryByText('contenido')).toBeNull();
  });

  it('con fuentes e hidratación listas muestra el contenido', async () => {
    mockFonts.ready = true;
    mockIntro.hydrated = true;

    const screen = await renderGate();

    expect(screen.getByText('contenido')).toBeTruthy();
    expect(screen.queryByTestId('loading-screen')).toBeNull();
  });

  it('retira el splash nativo en el primer layout y una sola vez', async () => {
    const screen = await renderGate();
    const root = screen.getByTestId('boot-gate');

    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    fireLayout(root);
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);

    fireLayout(root);
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('mantiene el silencio mientras la espera es corta', async () => {
    const screen = await renderGate(60_000);

    expect(screen.getByTestId('loading-screen')).toBeTruthy();
    expect(screen.queryByText('loading.preparing')).toBeNull();
  });

  it('describe el estado cuando la espera se alarga, y avisa en 3 s', async () => {
    // El default del componente es el silencio de §13: 3 s.
    expect(MESSAGE_DELAY_MS).toBe(3000);

    const screen = await renderGate(0);

    await waitFor(() => expect(screen.getByText('loading.preparing')).toBeTruthy());
  });
});
