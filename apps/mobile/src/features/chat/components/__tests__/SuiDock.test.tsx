import { render } from '@testing-library/react-native';
import { SuiDock } from '../SuiDock';
import { SuiAnimatedMark } from '@/shared/ui/SuiAnimatedMark';
import type { PresenceState } from '../../hooks/useSuiPresence';

jest.mock('@/shared/ui/SuiAnimatedMark', () => ({ SuiAnimatedMark: jest.fn(() => null) }));
jest.mock('@/shared/theme/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 16 },
  useAppTheme: () => ({
    colors: { onSurface: 'foreground', onSurfaceVariant: 'muted', error: 'error' },
    type: { titleSm: {}, labelXs: {} },
  }),
}));
jest.mock('@/shared/i18n/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe('SuiDock', () => {
  it.each<[PresenceState, string]>([
    ['resting', 'idle'],
    ['listening', 'listen'],
    ['thinking', 'think'],
    ['reading', 'read'],
    ['speaking', 'speak'],
    ['warm', 'warm'],
    ['concern', 'concern'],
  ])('%s usa pose %s, avatar 36 dp y señal declarativa', async (presence, pose) => {
    await render(<SuiDock presence={presence} speakSignal={3} label={null} />);
    expect(jest.mocked(SuiAnimatedMark).mock.calls.at(-1)?.[0]).toEqual({
      size: 36,
      pose,
      speakSignal: 3,
    });
  });

  it('nombre i18n; rótulo propio anuncia estado, permite truncar sin ancho fijo', async () => {
    const screen = await render(
      <SuiDock presence="reading" speakSignal={0} label="chat.remembering" />,
    );
    expect(screen.getByText('chat.assistantName')).toBeTruthy();
    const label = screen.getByText('chat.remembering');
    expect(label.props.accessibilityLiveRegion).toBe('polite');
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.ellipsizeMode).toBe('tail');
    const row = screen.getByTestId('sui-dock');
    expect(row.props.accessible).toBe(false);
    expect(row.props.accessibilityLiveRegion).toBeUndefined();
    expect(row.props.style).toEqual(
      expect.objectContaining({ flexShrink: 1, minWidth: 0, maxWidth: '100%' }),
    );
  });

  it('React.memo ignora render padre sin cambio real', async () => {
    const screen = await render(<SuiDock presence="speaking" speakSignal={2} label={null} />);
    const calls = jest.mocked(SuiAnimatedMark).mock.calls.length;
    await screen.rerender(<SuiDock presence="speaking" speakSignal={2} label={null} />);
    expect(jest.mocked(SuiAnimatedMark).mock.calls.length).toBe(calls);
  });
});
