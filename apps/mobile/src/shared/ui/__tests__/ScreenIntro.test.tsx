import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/shared/theme/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24 },
  useAppTheme: () => ({
    colors: { onSurface: '#000', onSurfaceVariant: '#333', primary: '#00f', onPrimary: '#fff' },
    radius: { full: 999 },
    type: { headlineSm: {}, bodyMd: {}, labelMd: {} },
  }),
}));
jest.mock('../Ionicons', () => ({ Ionicons: () => null }));

import { ScreenIntro } from '../ScreenIntro';

describe('ScreenIntro', () => {
  it('muestra CTA rotulado y accesible', async () => {
    const onAction = jest.fn();
    const screen = await render(
      <ScreenIntro
        title="Metas"
        subtitle="Resultados concretos"
        actionLabel="Crear una meta"
        onAction={onAction}
      />,
    );

    const action = screen.getByRole('button', { name: 'Crear una meta' });
    expect(screen.getByText('Crear una meta')).toBeTruthy();
    fireEvent.press(action);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
