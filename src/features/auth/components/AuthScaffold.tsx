import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { SuiMark } from '@/shared/ui/SuiMark';

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
};

export const AuthScaffold = ({ title, subtitle, onBack, children }: Props) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, SPACING.md) }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.header}>
          <SuiMark variant="isologo" size={64} accessible />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.card}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, padding: SPACING.lg, justifyContent: 'center' },
    back: {
      position: 'absolute',
      top: SPACING.md,
      left: SPACING.lg,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    header: { alignItems: 'center', marginBottom: SPACING.lg, marginTop: SPACING.xl },
    title: { ...type.brandDisplaySm, color: colors.onSurface, textAlign: 'center', marginTop: SPACING.sm },
    subtitle: { ...type.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 2 },
    card: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.xl,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
  });
