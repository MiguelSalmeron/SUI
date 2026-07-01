import React, { useState } from 'react';
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
import { auth } from '../config/firebase';
import { MD3_COLORS, SPACING } from '../theme/theme';

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

const getLoginErrorMessage = (error: any) => {
  switch (error?.code) {
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

export const LoginScreen = ({ navigation }: any) => {
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
    } catch (error: any) {
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
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.title}>Sui</Text>
          <Text style={styles.subtitle}>Tu compañero de productividad</Text>
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
          >
            <Text style={styles.buttonText}>
              {loading ? 'Entrando...' : 'Iniciar Sesión'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MD3_COLORS.background,
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
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: MD3_COLORS.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: MD3_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    color: MD3_COLORS.surface,
    fontSize: 48,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: MD3_COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: MD3_COLORS.onSurfaceVariant,
    textAlign: 'center',
  },
  form: {
    backgroundColor: MD3_COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 24,
    shadowColor: MD3_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: MD3_COLORS.onSurface,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: MD3_COLORS.background,
    borderWidth: 1,
    borderColor: MD3_COLORS.outlineVariant,
    borderRadius: 14,
    padding: SPACING.md,
    fontSize: 16,
    color: MD3_COLORS.onSurface,
  },
  inputError: {
    borderColor: MD3_COLORS.error,
  },
  errorText: {
    color: MD3_COLORS.error,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  button: {
    backgroundColor: MD3_COLORS.primary,
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonDisabled: {
    backgroundColor: MD3_COLORS.primaryContainer,
  },
  buttonText: {
    color: MD3_COLORS.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  linkText: {
    color: MD3_COLORS.onSurfaceVariant,
    fontSize: 14,
  },
  linkTextBold: {
    color: MD3_COLORS.primary,
    fontWeight: 'bold',
  },
});
