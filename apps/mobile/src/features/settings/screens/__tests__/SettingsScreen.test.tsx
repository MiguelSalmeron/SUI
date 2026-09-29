import { Alert, Share } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockSignOutCurrentUser = jest.fn(async () => undefined);
const mockDeleteAnonymousUser = jest.fn(async () => undefined);
const mockResendVerificationEmail = jest.fn(async () => undefined);
const mockRequestPasswordReset = jest.fn(async () => undefined);
const mockDeleteRegisteredAccount = jest.fn(async () => undefined);
const mockClearGoogleEventsCache = jest.fn(async () => undefined);
const mockClearLocalProductivity = jest.fn(async (_uid?: string | null) => undefined);
const mockClearAccountability = jest.fn(async (_uid?: string | null) => undefined);
const mockCancelAccountability = jest.fn(async () => 0);
const mockExportAccountability = jest.fn(async (_uid?: string | null) => ({
  schemaVersion: 1,
  commitments: [],
}));
const mockHandleAuthUserChanged = jest.fn(async (_uid?: string | null) => undefined);
const mockClearState = jest.fn(async () => undefined);
const mockResetIntro = jest.fn();
const mockNavigation = { navigate: jest.fn(), reset: jest.fn() };

const mockUser = {
  uid: 'user-1',
  isAnonymous: false,
  email: 'user@example.com',
  emailVerified: true,
  displayName: null,
  providerData: [{ providerId: 'password' }],
};

jest.mock('@/features/auth/public', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({ user: mockUser, loading: false }),
    deleteRegisteredAccount: () => mockDeleteRegisteredAccount(),
    signOutCurrentUser: () => mockSignOutCurrentUser(),
    deleteAnonymousUser: () => mockDeleteAnonymousUser(),
    resendVerificationEmail: () => mockResendVerificationEmail(),
    requestPasswordResetForCurrentUser: () => mockRequestPasswordReset(),
  };
});

jest.mock('@/features/calendar/public', () => ({
  clearGoogleEventsCache: () => mockClearGoogleEventsCache(),
}));

jest.mock('@/features/onboarding/public', () => ({
  useIntroStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      accountMode: 'registered',
      syncEnabled: true,
      pendingCloudMerge: false,
      setSyncEnabled: jest.fn(),
      setPendingCloudMerge: jest.fn(),
      resetIntro: mockResetIntro,
    }),
}));

jest.mock('@/shared/infrastructure/firebase/firebase', () => ({
  auth: { currentUser: mockUser },
}));

jest.mock('@/shared/domain/productivity/public', () => ({
  clearLocalProductivity: (uid?: string | null) => mockClearLocalProductivity(uid),
  useProductivityStore: () => ({
    goals: [{ id: 'g1' }],
    habits: [],
    weeklyHistory: [],
    syncStatus: 'idle',
    clearState: mockClearState,
    syncNow: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/features/accountability/public', () => ({
  cancelAllAccountabilityNotifications: () => mockCancelAccountability(),
  clearAccountability: (uid?: string | null) => mockClearAccountability(uid),
  exportAccountability: (uid?: string | null) => mockExportAccountability(uid),
  useAccountabilityStore: {
    getState: () => ({
      handleAuthUserChanged: (uid?: string | null) => mockHandleAuthUserChanged(uid),
    }),
  },
}));

jest.mock('@/shared/config/product', () => ({
  PRODUCT_CONFIG: { accountabilityEnabled: true },
}));

jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/shared/theme/theme', () => {
  const colors = new Proxy({}, { get: () => '#000' });
  const radius = new Proxy({}, { get: () => 8 });
  const type = new Proxy({}, { get: () => ({}) });
  return {
    SCREEN_CONTENT_BOTTOM_PADDING: 80,
    SCREEN_MAX_CONTENT_WIDTH: 560,
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    useAppTheme: () => ({ colors, radius, type }),
    useThemeController: () => ({ mode: 'system', setMode: jest.fn() }),
  };
});

jest.mock('@/shared/preferences/useSettingsStore', () => ({
  useSettingsStore: () => ({
    notificationsEnabled: false,
    fontSize: 'medium',
    language: 'es',
    mirrorGoalsEnabled: true,
    mirrorHabitsEnabled: false,
    setFontSize: jest.fn(),
    setLanguage: jest.fn(),
    setMirrorGoalsEnabled: jest.fn(),
    setMirrorHabitsEnabled: jest.fn(),
  }),
}));

jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/ui/SelectionModal', () => ({ SelectionModal: () => null }));
jest.mock('@/shared/ui/ConfirmModal', () => ({
  ConfirmModal: ({ visible, onConfirm }: { visible: boolean; onConfirm: () => void }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return visible
      ? React.createElement(Text, { testID: 'confirm-modal', onPress: onConfirm }, 'confirm')
      : null;
  },
}));

jest.mock('../../services/notifications', () => ({
  disableNightlyReport: jest.fn(async () => undefined),
  scheduleNightlyReport: jest.fn(async () => 'scheduled'),
}));

import { SettingsScreen } from '../SettingsScreen';
import { AuthContext } from '@/features/auth/public';
import { auth } from '@/shared/infrastructure/firebase/firebase';

const renderScreen = () =>
  render(
    <AuthContext.Provider value={{ user: mockUser as never, loading: false }}>
      <SettingsScreen navigation={mockNavigation as never} route={{} as never} />
    </AuthContext.Provider>,
  );

describe('SettingsScreen accountability lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as { currentUser: typeof mockUser | null }).currentUser = mockUser;
  });

  it('incluye accountability en export local', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const screen = await renderScreen();

    await fireEvent.press(screen.getByText('settings.export'));

    await waitFor(() => expect(mockExportAccountability).toHaveBeenCalledWith('user-1'));
    const payload = JSON.parse((share.mock.calls[0][0] as { message: string }).message);
    expect(payload.accountability).toEqual({ schemaVersion: 1, commitments: [] });
    share.mockRestore();
  });

  it('logout cancela alertas y cambia memoria sin borrar espacio UID', async () => {
    const screen = await renderScreen();
    await fireEvent.press(screen.getByText('settings.logout'));
    await fireEvent.press(screen.getByTestId('confirm-modal'));

    await waitFor(() => expect(mockSignOutCurrentUser).toHaveBeenCalled());
    expect(mockCancelAccountability).toHaveBeenCalled();
    expect(mockHandleAuthUserChanged).toHaveBeenCalledWith(null);
    expect(mockClearAccountability).not.toHaveBeenCalled();
  });

  it('eliminación purga accountability del UID', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = await renderScreen();
    await fireEvent.press(screen.getByText('settings.delete'));
    const actions = alert.mock.calls[0][2] ?? [];
    const destructive = actions.find((action) => action.style === 'destructive');
    await destructive?.onPress?.();

    await waitFor(() => expect(mockClearAccountability).toHaveBeenCalledWith('user-1'));
    expect(mockCancelAccountability).toHaveBeenCalled();
    alert.mockRestore();
  });
});
