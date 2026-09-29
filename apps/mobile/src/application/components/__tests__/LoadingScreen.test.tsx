import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

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

import { LoadingScreen } from '../LoadingScreen';

const accessibilityMock = jest.requireMock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
) as { default: { announceForAccessibility: jest.Mock } };

describe('LoadingScreen (§13)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra el isologo como identificador y sin texto en el arranque rápido', async () => {
    const screen = await render(<LoadingScreen />);

    expect(screen.getByLabelText('Sui')).toBeTruthy();
    expect(accessibilityMock.default.announceForAccessibility).not.toHaveBeenCalled();
  });

  const withPlatform = async (os: 'ios' | 'android', run: () => Promise<void>) => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    try {
      await run();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
  };

  it('en iOS anuncia el estado cuando aparece la línea', async () => {
    await withPlatform('ios', async () => {
      const screen = await render(<LoadingScreen message="Preparando tus datos locales" />);

      expect(screen.getByText('Preparando tus datos locales')).toBeTruthy();
      expect(accessibilityMock.default.announceForAccessibility).toHaveBeenCalledWith(
        'Preparando tus datos locales',
      );
    });
  });

  it('en Android deja que la live region del texto lo anuncie, sin repetirlo', async () => {
    await withPlatform('android', async () => {
      const screen = await render(<LoadingScreen message="Preparando tus datos locales" />);
      const line = screen.getByText('Preparando tus datos locales');

      // La live region vive en el texto, no en el contenedor: Android anuncia
      // el nodo que cambió, y un `View` sin texto propio no tiene qué anunciar.
      expect(line.props.accessibilityLiveRegion).toBe('polite');
      expect(screen.getByTestId('loading-screen').props.accessibilityLiveRegion).toBeUndefined();
      expect(accessibilityMock.default.announceForAccessibility).not.toHaveBeenCalled();
    });
  });
});
