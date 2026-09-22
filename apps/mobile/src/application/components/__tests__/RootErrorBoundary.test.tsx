import { useState } from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { captureException } from '@sentry/react-native';
import { reportError } from '@/shared/observability/telemetry';
import { RootErrorBoundary } from '../RootErrorBoundary';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  metrics: { count: jest.fn(), distribution: jest.fn() },
  wrap: jest.fn((component: unknown) => component),
}));

const Thrower = ({ explode }: { explode: boolean }) => {
  if (explode) throw new Error('boom de prueba');
  return <Text>contenido sano</Text>;
};

const ExplodingTree = ({ explode }: { explode: boolean }) => (
  <RootErrorBoundary>
    <Thrower explode={explode} />
  </RootErrorBoundary>
);

describe('RootErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('muestra fallback de marca en vez de pantalla vacía', async () => {
    const screen = await render(<ExplodingTree explode />);

    expect(screen.getByText('Algo salió mal')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    expect(screen.queryByText('contenido sano')).toBeNull();
  });

  it('reintentar recupera el contenido sin reinstalar', async () => {
    const screen = await render(<ExplodingTree explode />);
    expect(screen.getByText('Algo salió mal')).toBeTruthy();

    await screen.rerender(<ExplodingTree explode={false} />);
    fireEvent.press(screen.getByText('Reintentar'));

    expect(await screen.findByText('contenido sano')).toBeTruthy();
    expect(screen.queryByText('Algo salió mal')).toBeNull();
  });

  it('onRetry del padre se invoca al reintentar', async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <RootErrorBoundary onRetry={onRetry}>
        <Thrower explode />
      </RootErrorBoundary>,
    );

    fireEvent.press(screen.getByText('Reintentar'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('reportError sin DSN es no-op (no revienta en local)', () => {
    expect(() => reportError(new Error('falla de prueba'))).not.toThrow();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('hijos sanos renderizan normal (con estado previo de error aislado)', async () => {
    const Toggle = () => {
      const [explode] = useState(false);
      return (
        <RootErrorBoundary>
          <Thrower explode={explode} />
        </RootErrorBoundary>
      );
    };
    const screen = await render(<Toggle />);

    expect(screen.getByText('contenido sano')).toBeTruthy();
  });
});
