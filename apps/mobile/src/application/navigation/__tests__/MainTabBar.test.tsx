import { AuthContext } from '@/features/auth/public';
import { Avatar } from '@/shared/ui/Avatar';
import { useIdentityStore, defaultIdentity } from '@/shared/identity/useIdentityStore';
import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SuiAnimatedMark } from '@/shared/ui/SuiAnimatedMark';
import {
  MainTabBar,
  TabHeader,
  renderTransparentTabBarBackground,
  TRANSPARENT_TAB_BAR_STYLE,
} from '../TabNavigator';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: () => ({}) }));
jest.mock('@/shared/ui/SuiAnimatedMark', () => ({ SuiAnimatedMark: () => null }));
jest.mock('@/shared/ui/SuiMark', () => ({ SuiMark: () => null }));
jest.mock('@/shared/ui/Avatar', () => ({ Avatar: () => null }));
jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));
jest.mock('@/features/auth/public', () => ({
  AuthContext: require('react').createContext({ user: null, loading: false }),
}));
jest.mock('@/features/onboarding/public', () => ({}));
jest.mock('@/features/calendar/public', () => ({}));
jest.mock('@/features/goals/public', () => ({}));
jest.mock('@/features/habits/public', () => ({}));
jest.mock('@/features/home/public', () => ({}));
jest.mock('@/features/accountability/public', () => ({}));
jest.mock('@/features/engagement/public', () => ({}));
jest.mock('@/shared/domain/productivity/public', () => ({}));
jest.mock('@/shared/infrastructure/notifications', () => ({}));
jest.mock('@/shared/i18n/i18n', () => ({}));
jest.mock('@/shared/config/product', () => ({ PRODUCT_CONFIG: {} }));

describe('MainTabBar, acceso Sui', () => {
  it.each([
    ['light', '#FFFFFF', 0],
    ['dark', '#132431', 34],
  ])(
    'overlay %s conserva cápsula, safe-area y acceso inmediato a Chat',
    (scheme, surface, bottomInset) => {
      let renderer: ReactTestRenderer;
      const navigate = jest.fn();
      const onAssistant = jest.fn(() => {
        navigate('Chat');
        expect(renderer.root.findAllByType(SuiAnimatedMark)[0].props.winkSignal).toBe(0);
      });
      const props = {
        state: {
          index: 0,
          routes: ['Overview', 'Goals', 'Habits', 'Calendar'].map((name) => ({ key: name, name })),
        },
        navigation: { navigate: jest.fn(), emit: jest.fn() },
        insets: { bottom: bottomInset, top: 0, left: 0, right: 0 },
        colors: { surface },
        elevation: { floating: { elevation: 4 } },
        scheme,
        onAssistant,
        labels: { Overview: 'Inicio', Goals: 'Metas', Habits: 'Hábitos', Calendar: 'Agenda' },
        assistantAccessibilityLabel: 'Abrir Chat',
        assistantAccessibilityHint: 'Conversá con Sui',
      } as unknown as React.ComponentProps<typeof MainTabBar>;
      act(() => {
        renderer = create(<MainTabBar {...props} />);
      });
      const surfaces = renderer!.root
        .findAll((node) => node.type === 'View')
        .map((node) => StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>));
      const capsule = surfaces.find((style) => style?.height === 58 && style?.maxWidth === 560);
      const outer = surfaces.find(
        (style) => style?.paddingTop === 8 && style?.paddingHorizontal === 16,
      );
      expect(capsule).toEqual(expect.objectContaining({ backgroundColor: surface, elevation: 4 }));
      expect(capsule?.borderRadius).toBeGreaterThan(0);
      expect(outer).toEqual(
        expect.objectContaining({
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'transparent',
          paddingBottom: Math.max(Number(bottomInset), 8) + 8,
        }),
      );
      expect(outer?.elevation).toBeUndefined();
      expect(outer?.shadowColor).toBeUndefined();
      expect(outer?.borderWidth).toBeUndefined();
      expect(
        renderer!.root.findAll((node) => node.props.pointerEvents === 'box-none').length,
      ).toBeGreaterThan(0);
      const button = renderer!.root.findAll(
        (node) => node.props.testID === 'assistant-tab-button',
      )[0];
      expect(button.props.testID).toBe('assistant-tab-button');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('Abrir Chat');
      expect(button.props.accessibilityHint).toBe('Conversá con Sui');
      act(() => button.props.onPress?.());
      expect(navigate).toHaveBeenCalledWith('Chat');
      expect(onAssistant).toHaveBeenCalledTimes(1);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
      expect(renderer!.root.findAllByType(SuiAnimatedMark)[0].props.winkSignal).toBe(1);
      act(() => renderer!.unmount());
    },
  );
});

describe('MainTabBar, wrapper nativo transparente', () => {
  it('no pinta fondo ni borde ni sombra: la cápsula queda como única superficie', () => {
    // Acá se ata el fix del rectángulo full-width: el contenedor default del
    // lib pintaba `colors.card` + hairline + elevation 8. Transparente vale
    // para light y dark porque deja ver el fondo de la pantalla.
    expect(TRANSPARENT_TAB_BAR_STYLE).toEqual(
      expect.objectContaining({
        position: 'absolute',
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        borderWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
      }),
    );
    expect(renderTransparentTabBarBackground()).toBeNull();
  });
});

describe('TabHeader identidad', () => {
  it('no muestra foto anterior; avatar mantiene acceso a Ajustes', async () => {
    let renderer!: ReactTestRenderer;
    const onSettings = jest.fn();
    useIdentityStore.setState({
      owner: 'a',
      identity: { ...defaultIdentity(), localPhotoUri: 'file:///a.webp' },
      identities: {},
    });
    const props = {
      colors: { primary: '#2455A4' },
      topInset: 0,
      profileName: 'Bea',
      settingsLabel: 'Abrir Ajustes',
      settingsHint: 'Preferencias',
      onSettings,
    } as unknown as React.ComponentProps<typeof TabHeader>;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider
          value={{ user: { uid: 'b', isAnonymous: false } as never, loading: false }}
        >
          <TabHeader {...props} />
        </AuthContext.Provider>,
      );
    });
    expect(renderer.root.findAllByType(Avatar)[0].props.source).toBeUndefined();
    await act(async () => {
      useIdentityStore.setState({
        owner: 'b',
        identity: { ...defaultIdentity(), localPhotoUri: 'file:///b.webp' },
      });
    });
    expect(renderer.root.findAllByType(Avatar)[0].props.source).toBe('file:///b.webp');
    const button = renderer.root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'Abrir Ajustes' &&
        typeof node.props.onPress === 'function',
    )[0];
    await act(async () => {
      (button.props.onPress as () => void)();
    });
    expect(onSettings).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount());
  });
});
