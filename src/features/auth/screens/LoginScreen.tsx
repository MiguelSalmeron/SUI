import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import type { RootStackParamList } from '@/application/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SuiMark } from '@/shared/ui/SuiMark';

// Validation Schema with Zod
const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Por favor ingresa tu email' })
    .email({ message: 'Ingresa un email válido' }),
  password: z
    .string()
    .min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
});

type LoginFields = z.infer<typeof loginSchema>;

const getLoginErrorMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'Ingresa un email válido';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Credenciales inválidas';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta nuevamente más tarde';
    default:
      return 'Credenciales inválidas o problema de conexión';
  }
};

export const LoginScreen = ({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogin = async (data: LoginFields) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email.trim(), data.password);
    } catch (error: unknown) {
      Alert.alert('Error', getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <SuiMark variant="isologo" size={72} accessible />
          <Text style={styles.title}>Cultiva tu vida</Text>
          <Text style={styles.subtitle}>Organiza tu ritmo con claridad.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="tu@email.com"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email.message}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contraseña</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="••••••••"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password.message}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit(handleLogin)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión"
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Entrando...' : 'Iniciar Sesión'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}
            accessibilityRole="button"
            accessibilityLabel="Ir a registro"
          >
            <Text style={styles.linkText}>
              ¿No tienes cuenta? <Text style={styles.linkTextBold}>Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = ({ colors, type }: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    ...type.brandDisplayMd,
    color: colors.onSurface,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...type.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.surfaceContainer,
    padding: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  inputContainer: {
    marginBottom: SPACING.md,
  },
  label: {
    ...type.labelLg,
    color: colors.onSurface,
    marginBottom: SPACING.xs,
  },
  input: {
    ...type.bodyLg,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: SPACING.md,
    color: colors.onSurface,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...type.bodySm,
    color: colors.error,
    marginTop: 4,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...type.titleMd,
    color: colors.onPrimary,
  },
  linkButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  linkText: {
    ...type.bodyMd,
    color: colors.onSurfaceVariant,
  },
  linkTextBold: {
    ...type.labelLg,
    color: colors.primary,
  },
});
