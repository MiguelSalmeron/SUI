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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import type { RootStackParamList } from '@/application/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SuiMark } from '@/shared/ui/SuiMark';

// Validation Schema with Zod
const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, { message: 'Por favor ingresa tu email' })
      .email({ message: 'Ingresa un email válido' }),
    password: z
      .string()
      .min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
    confirmPassword: z
      .string()
      .min(1, { message: 'Por favor confirma tu contraseña' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type RegisterFields = z.infer<typeof registerSchema>;

const getRegisterErrorMessage = (error: unknown) => {
  const err = error as { code?: string; message?: string };
  switch (err.code) {
    case 'auth/invalid-email':
      return 'Ingresa un email válido';
    case 'auth/email-already-in-use':
      return 'Ese email ya está registrado';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres';
    case 'auth/operation-not-allowed':
      return 'El registro con email y contraseña no está habilitado en Firebase';
    default:
      return err.message ?? 'No se pudo crear la cuenta';
  }
};

export const RegisterScreen = ({ navigation }: NativeStackScreenProps<RootStackParamList, 'Register'>) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleRegister = async (data: RegisterFields) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      Alert.alert('Éxito', 'Cuenta creada correctamente');
    } catch (error: unknown) {
      Alert.alert('Error', getRegisterErrorMessage(error));
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
          <SuiMark variant="isologo" size={52} accessible />
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Un espacio claro para avanzar a tu ritmo.</Text>
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

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirmar Contraseña</Text>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.confirmPassword && styles.inputError]}
                  placeholder="••••••••"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit(handleRegister)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Registrarse"
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Cargando...' : 'Registrarse'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel="Ir a inicio de sesión"
          >
            <Text style={styles.linkText}>
              ¿Ya tienes cuenta? <Text style={styles.linkTextBold}>Inicia sesión</Text>
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
    marginBottom: SPACING.sm,
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
