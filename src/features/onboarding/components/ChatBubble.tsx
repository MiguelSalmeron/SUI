import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';

interface ChatBubbleProps {
  from: 'bot' | 'user';
  text: string;
}

export const ChatBubble = ({ from, text }: ChatBubbleProps) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isBot = from === 'bot';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.row,
        isBot ? styles.rowBot : styles.rowUser,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {isBot && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={16} color={colors.onPrimary} />
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
    </Animated.View>
  );
};

const createStyles = ({ colors, type }: AppTheme) => StyleSheet.create({
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
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  bubble: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    maxWidth: '80%',
  },
  bubbleBot: {
    backgroundColor: colors.surfaceContainer,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  text: {
    ...type.bodyMd,
  },
  textBot: {
    color: colors.onSurface,
  },
  textUser: {
    color: colors.onPrimary,
    fontFamily: type.titleSm.fontFamily,
    fontWeight: type.titleSm.fontWeight,
  },
});
