import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Avatar } from '../Avatar';
jest.mock('@/shared/infrastructure/profile/localPhoto', () => ({
  resolveLocalPhoto: async (uri?: string) => uri,
}));
test('inicial conserva label accesible', async () => {
  const screen = await render(<Avatar name="Ana" />);
  expect(screen.getByText('A')).toBeTruthy();
  expect(screen.getByLabelText('Avatar de Ana')).toBeTruthy();
});
test('foto falla silenciosamente al fallback, URI nueva se recupera', async () => {
  const screen = await render(<Avatar name="Ana" source="file:///one.webp" detail="🌱" />);
  await waitFor(() => expect(screen.getByTestId('avatar-photo')).toBeTruthy());
  await fireEvent(screen.getByTestId('avatar-photo'), 'error');
  expect(screen.getByText('🌱')).toBeTruthy();
  expect(screen.queryByTestId('avatar-photo')).toBeNull();
  await screen.rerender(<Avatar name="Ana" source="file:///two.webp" />);
  await waitFor(() =>
    expect(screen.getByTestId('avatar-photo').props.source.uri).toBe('file:///two.webp'),
  );
});
