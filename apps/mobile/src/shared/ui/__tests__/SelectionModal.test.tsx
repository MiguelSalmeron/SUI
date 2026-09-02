import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/shared/theme/theme', () => ({
  SPACING: { sm: 8, md: 16, lg: 24 },
  useAppTheme: () => ({
    colors: {
      scrim: '#0008',
      surface: '#fff',
      onSurface: '#000',
      onSurfaceVariant: '#333',
      primary: '#00f',
    },
    radius: { xl: 24 },
    type: { titleLg: {}, bodyLg: {} },
  }),
}));
jest.mock('../Ionicons', () => ({ Ionicons: () => null }));

import { SelectionModal } from '../SelectionModal';

describe('SelectionModal', () => {
  it('marca radio actual, aplica selección y cierra', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <SelectionModal
        visible
        title="Tema"
        value="dark"
        options={[
          { value: 'system', label: 'Sistema' },
          { value: 'dark', label: 'Oscuro' },
        ]}
        closeLabel="Cerrar"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Oscuro' }).props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(screen.getByRole('radio', { name: 'Sistema' }));
    expect(onSelect).toHaveBeenCalledWith('system');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
