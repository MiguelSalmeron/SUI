import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardTypeOptions,
} from 'react-native';
import { useForm, Controller, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MD3_COLORS, SPACING } from '../../theme/theme';

interface ChatComposerProps {
  /** Esquema zod para validar el campo (string o number coercionado). */
  fieldSchema: z.ZodTypeAny;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  submitLabel?: string;
  onSubmitValue: (value: string | number) => void;
}

export const ChatComposer = ({
  fieldSchema,
  placeholder,
  keyboardType = 'default',
  submitLabel = 'Enviar',
  onSubmitValue,
}: ChatComposerProps) => {
  type FormValues = { value: string };
  const schema = z.object({ value: fieldSchema });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { value: '' },
  });

  const submit = (data: FormValues) => {
    onSubmitValue(data.value);
    reset({ value: '' });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <Controller
          control={control}
          name="value"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.value && styles.inputError]}
              placeholder={placeholder}
              placeholderTextColor={MD3_COLORS.onSurfaceVariant}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType={keyboardType}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={handleSubmit(submit)}
            />
          )}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSubmit(submit)}>
          <Text style={styles.sendText}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
      {errors.value && <Text style={styles.errorText}>{errors.value.message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: MD3_COLORS.surface,
    borderWidth: 1,
    borderColor: MD3_COLORS.outlineVariant,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: MD3_COLORS.onSurface,
  },
  inputError: {
    borderColor: MD3_COLORS.error,
  },
  sendButton: {
    backgroundColor: MD3_COLORS.primary,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: MD3_COLORS.surface,
    fontWeight: '800',
    fontSize: 15,
  },
  errorText: {
    color: MD3_COLORS.error,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
});
