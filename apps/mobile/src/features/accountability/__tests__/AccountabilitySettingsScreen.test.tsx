import { render, fireEvent } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/shared/theme/theme', () => ({
  SCREEN_MAX_CONTENT_WIDTH: 560,
  SCREEN_CONTENT_BOTTOM_PADDING: 32,
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  useAppTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      surfaceContainerLow: '#eee',
      onSurface: '#000',
      onSurfaceVariant: '#333',
      onPrimary: '#fff',
      onPrimaryContainer: '#008',
      primary: '#00f',
      primaryContainer: '#ddf',
      outlineVariant: '#ccc',
      error: '#f00',
    },
    radius: { md: 8, lg: 12, xl: 24 },
    type: {
      headlineSm: {},
      titleSm: {},
      bodyLg: {},
      bodyMd: {},
      bodySm: {},
      labelLg: {},
      labelMd: {},
      labelSm: {},
    },
  }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
}));

import { AccountabilitySettingsScreen } from '../screens/AccountabilitySettingsScreen';
import { DEFAULT_PROFILE } from '../model/accountabilityTypes';
import { useAccountabilityStore } from '../store/useAccountabilityStore';

const screenProps = {} as ComponentProps<typeof AccountabilitySettingsScreen>;

describe('AccountabilitySettingsScreen', () => {
  beforeEach(async () => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    useAccountabilityStore.setState({
      profile: { ...DEFAULT_PROFILE, updatedAt: '' },
      commitments: [],
      cycles: [],
      facts: [],
      stateLoaded: true,
    });
  });

  it('el interruptor global activa el perfil opt-in', async () => {
    const screen = await render(<AccountabilitySettingsScreen {...screenProps} />);
    const toggle = screen.getByLabelText('accountability.settings.enabledTitle');
    expect(toggle.props.value).toBe(false);
    await fireEvent(toggle, 'valueChange', true);
    expect(useAccountabilityStore.getState().profile.enabled).toBe(true);
  });

  it('cambia la intensidad por defecto con los radios', async () => {
    const screen = await render(<AccountabilitySettingsScreen {...screenProps} />);
    await fireEvent.press(screen.getByText('accountability.intensity.demanding'));
    expect(useAccountabilityStore.getState().profile.defaultIntensity).toBe('demanding');
  });

  it('ajusta el límite diario y el interruptor de insistir', async () => {
    const screen = await render(<AccountabilitySettingsScreen {...screenProps} />);
    // Opciones [2, 4, 6]: el {count} no se interpola en el mock de i18n,
    // así que las tres opciones comparten texto y se distinguen por índice.
    const limitOptions = screen.getAllByText('accountability.settings.limitOption');
    await fireEvent.press(limitOptions[2]);
    expect(useAccountabilityStore.getState().profile.maxNotificationsPerDay).toBe(6);

    const escalationSwitch = screen.getByLabelText('accountability.settings.escalationTitle');
    await fireEvent(escalationSwitch, 'valueChange', false);
    expect(useAccountabilityStore.getState().profile.allowEscalation).toBe(false);
  });

  it('cambia personalidad y resumen semanal', async () => {
    const screen = await render(<AccountabilitySettingsScreen {...screenProps} />);
    await fireEvent.press(screen.getByText('accountability.personality.partner'));
    expect(useAccountabilityStore.getState().profile.personality).toBe('partner');

    const digest = screen.getByLabelText('accountability.settings.weeklyDigestTitle');
    await fireEvent(digest, 'valueChange', false);
    expect(useAccountabilityStore.getState().profile.weeklyDigestEnabled).toBe(false);
  });

  it('muestra patrones calculados sólo desde historial local', async () => {
    useAccountabilityStore.setState({
      cycles: [
        {
          id: 'c1',
          commitmentId: 'acc:goal:g1',
          localDate: '2026-09-08',
          time: '19:00',
          status: 'completed',
          attemptCount: 1,
          completedAt: '2026-09-08T09:00:00',
        },
      ],
    });
    const screen = await render(<AccountabilitySettingsScreen {...screenProps} />);
    expect(screen.getByText('accountability.settings.completionHour')).toBeTruthy();
  });
});
