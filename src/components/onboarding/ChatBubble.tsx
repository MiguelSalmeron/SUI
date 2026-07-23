import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';

interface ChatBubbleProps {
  from: 'bot' | 'user';
  text: string;
}

export const ChatBubble = ({ from, text }: ChatBubbleProps) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isBot = from === 'bot';
  return (
    <View style={[styles.row, isBot ? styles.rowBot : styles.rowUser]}>
      {isBot && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>S</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isBot ? styles.bubbleBot : styles.bubbleUser,
        ]}
      >
        <Text style={[styles.text, isBot ? styles.textBot : styles.textUser]}>
          {text}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
    maxWidth: '100%',
  },
  rowBot: {
    justifyContent: 'flex-start',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '900',
    fontSize: 16,
  },
  bubble: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    maxWidth: '80%',
  },
  bubbleBot: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textBot: {
    color: colors.onSurface,
  },
  textUser: {
    color: colors.surface,
    fontWeight: '600',
  },
});
