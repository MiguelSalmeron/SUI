import { fireEvent, render } from '@testing-library/react-native';

const mockCalendarState = {
  status: 'connected',
  syncStatus: 'synced',
  connectionStatus: 'connected',
  connected: true,
  lastSyncedAt: null,
  error: null,
  platformHint: null,
  connect: jest.fn(),
  sync: jest.fn(),
  disconnect: jest.fn(),
};
let mockMirrorQueueLength = 0;

jest.mock('@/features/calendar/public', () => ({
  useGoogleCalendar: () => mockCalendarState,
  getMirrorQueueLength: () => Promise.resolve(mockMirrorQueueLength),
}));
jest.mock('@/shared/theme/theme', () => {
  const colors = new Proxy({}, { get: () => '#000' });
  const radius = new Proxy({}, { get: () => 8 });
  const type = new Proxy({}, { get: () => ({}) });
  return {
    SCREEN_CONTENT_BOTTOM_PADDING: 80,
    SPACING: { xs: 4, sm: 8, md: 16, lg: 24 },
    useAppTheme: () => ({ colors, radius, type }),
  };
});
jest.mock('@/shared/i18n/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, formatDate: () => 'fecha' }),
}));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/shared/ui/ScreenIntro', () => ({ ScreenIntro: () => null }));

import { ConnectionsScreen } from '../ConnectionsScreen';
import type { ComponentProps } from 'react';

const props = { navigation: {}, route: {} } as unknown as ComponentProps<typeof ConnectionsScreen>;

describe('ConnectionsScreen mirror', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockCalendarState, {
      status: 'connected',
      syncStatus: 'synced',
      connectionStatus: 'connected',
      connected: true,
      lastSyncedAt: null,
      error: null,
      platformHint: null,
    });
    mockMirrorQueueLength = 0;
  });

  it('conectado muestra espejo activo y Pendientes cuando hay cola', async () => {
    mockMirrorQueueLength = 3;
    const screen = await render(<ConnectionsScreen {...props} />);
    expect(screen.getByText('connections.mirrorActive', { exact: false })).toBeTruthy();
    expect(await screen.findByText('connections.mirrorPending')).toBeTruthy();
    expect(screen.getByLabelText('connections.sync')).toBeTruthy();
  });

  it('reauth muestra aviso y reconecta en vez de sincronizar', async () => {
    Object.assign(mockCalendarState, {
      status: 'reauthRequired',
      connected: false,
      connectionStatus: 'reauthRequired',
      error: 'reauth',
    });
    const screen = await render(<ConnectionsScreen {...props} />);
    expect(screen.getByText('connections.reauthHint')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('connections.reconnect'));
    expect(mockCalendarState.connect).toHaveBeenCalledTimes(1);
    expect(mockCalendarState.sync).not.toHaveBeenCalled();
  });

  it('sin conectar ofrece conectar y sin pendientes', async () => {
    Object.assign(mockCalendarState, { connected: false, connectionStatus: 'disconnected' });
    const screen = await render(<ConnectionsScreen {...props} />);
    fireEvent.press(screen.getByLabelText('connections.connect'));
    expect(mockCalendarState.connect).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('connections.mirrorPending')).toBeNull();
  });
});
