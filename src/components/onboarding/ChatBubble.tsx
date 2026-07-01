import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MD3_COLORS, SPACING } from '../../theme/theme';

interface ChatBubbleProps {
  from: 'bot' | 'user';
  text: string;
}

export const ChatBubble = ({ from, text }: ChatBubbleProps) => {
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

const styles = StyleSheet.create({
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
    backgroundColor: MD3_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    color: MD3_COLORS.surface,
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
    backgroundColor: MD3_COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: MD3_COLORS.outlineVariant,
  },
  bubbleUser: {
    backgroundColor: MD3_COLORS.primary,
    borderBottomRightRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textBot: {
    color: MD3_COLORS.onSurface,
  },
  textUser: {
    color: MD3_COLORS.surface,
    fontWeight: '600',
  },
});
