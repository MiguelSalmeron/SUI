import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/shared/i18n/i18n';
import type { TranslationKey } from '@/shared/i18n/translations';
import { type AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { SuiAnimatedMark } from '@/shared/ui/SuiAnimatedMark';
import type { PresencePose, PresenceState } from '../hooks/useSuiPresence';

type Props = {
  presence: PresenceState;
  speakSignal: number;
  label: TranslationKey | null;
};

const POSES: Record<PresenceState, PresencePose> = {
  resting: 'idle',
  listening: 'listen',
  thinking: 'think',
  reading: 'read',
  speaking: 'speak',
  warm: 'warm',
  concern: 'concern',
};

export const SuiDock = React.memo(function SuiDock({ presence, speakSignal, label }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  return (
    <View style={styles.row} accessible={false} testID="sui-dock">
      <SuiAnimatedMark size={36} pose={POSES[presence]} speakSignal={speakSignal} />
      <View style={styles.text} accessible={false}>
        <Text style={styles.name} numberOfLines={1}>
          {t('chat.assistantName')}
        </Text>
        {label ? (
          <Text
            style={presence === 'concern' ? styles.concern : styles.label}
            numberOfLines={1}
            ellipsizeMode="tail"
            accessibilityLiveRegion="polite"
          >
            {t(label)}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '100%',
    },
    text: { flexShrink: 1, minWidth: 0 },
    name: { ...type.titleSm, color: colors.onSurface },
    label: { ...type.labelXs, color: colors.onSurfaceVariant },
    concern: { ...type.labelXs, color: colors.error },
  });
