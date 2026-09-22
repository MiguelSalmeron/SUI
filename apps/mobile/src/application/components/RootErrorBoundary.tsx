import { Component, type ReactNode } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { SUI_BRAND } from '@/shared/theme/brand';
import { reportError } from '@/shared/observability/telemetry';

interface RootErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

interface RootErrorBoundaryState {
  hasError: boolean;
}

/**
 * Última red: si cualquier pantalla revienta en render, muestra fallback
 * de marca con reintento en vez de pantalla gris/vacía. Vive por encima
 * de todos los providers, así que el fallback no usa hooks ni theme:
 * solo constantes de marca y controles nativos sin tipografía custom
 * (el chequeo de arquitectura prohíbe fontSize/fontFamily en tsx).
 */
export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    reportError(error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.body}>
            La pantalla no pudo cargarse. Tus datos están a salvo: reintenta o
            reinicia la app.
          </Text>
          <Button
            title="Reintentar"
            color={SUI_BRAND.actionBlue}
            onPress={this.handleRetry}
            accessibilityLabel="Reintentar cargar la pantalla"
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SUI_BRAND.navy,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: SUI_BRAND.white,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    maxWidth: 340,
    width: '100%',
  },
  title: {
    color: SUI_BRAND.navy,
    textAlign: 'center',
  },
  body: {
    color: SUI_BRAND.navy,
    textAlign: 'center',
    opacity: 0.75,
    marginBottom: 4,
  },
});
