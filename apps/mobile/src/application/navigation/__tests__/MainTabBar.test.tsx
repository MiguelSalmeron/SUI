import {
  renderTransparentTabBarBackground,
  TRANSPARENT_TAB_BAR_STYLE,
} from '../TabNavigator';

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
