import { useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons, type IoniconName } from '@/shared/ui/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { useI18n } from '@/shared/i18n/i18n';
import type { UserIntention } from '@/shared/account/introTypes';
import type { SpotlightStep } from '../hooks/useFirstRunSpotlight';

interface FirstRunSpotlightProps {
  visible: boolean;
  step: SpotlightStep;
  stepIndex: number;
  totalSteps: number;
  userIntention: UserIntention | null;
  onNext: () => void;
  onDismiss: () => void;
}

export const FirstRunSpotlight = ({
  visible,
  step,
  stepIndex,
  totalSteps,
  userIntention,
  onNext,
  onDismiss,
}: FirstRunSpotlightProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme, step, insets), [theme, step, insets]);

  if (!visible) return null;

  const isLast = stepIndex === totalSteps - 1;

  const stepDetails = (): { icon: IoniconName; title: string; body: string } => {
    switch (step) {
      case 'agenda':
        return {
          icon: 'calendar-outline',
          title: t('home.spotlight.agendaTitle'),
          body: t('home.spotlight.agendaBody'),
        };
      case 'chat':
        return {
          icon: 'chatbubble-ellipses-outline',
          title: t('home.spotlight.chatTitle'),
          body: t('home.spotlight.chatBody'),
        };
      case 'action':
        return {
          icon: userIntention === 'goal' ? 'flag-outline' : 'sparkles',
          title: t('home.spotlight.actionTitle'),
          body:
            userIntention === 'goal'
              ? t('home.spotlight.actionBodyGoal')
              : userIntention === 'habit'
                ? t('home.spotlight.actionBodyHabit')
                : t('home.spotlight.actionBodyGeneral'),
        };
    }
  };

  const details = stepDetails();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.topRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name={details.icon} size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>
                    {stepIndex + 1}/{totalSteps}
                  </Text>
                </View>
              </View>

              <Text style={styles.title}>{details.title}</Text>
              <Text style={styles.body}>{details.body}</Text>

              <View style={styles.footerRow}>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={onDismiss}
                  accessibilityRole="button"
                >
                  <Text style={styles.skipText}>{t('home.spotlight.skip')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={onNext}
                  accessibilityRole="button"
                >
                  <Text style={styles.nextText}>
                    {isLast ? t('home.spotlight.gotIt') : t('home.spotlight.next')}
                  </Text>
                  {!isLast && (
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={theme.colors.onPrimary}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (
  theme: AppTheme,
  step: SpotlightStep,
  insets: { top: number; bottom: number },
) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: step === 'chat' ? 'flex-end' : step === 'agenda' ? 'flex-start' : 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: step === 'agenda' ? Math.max(insets.top + 64, 100) : 0,
      paddingBottom: step === 'chat' ? Math.max(insets.bottom + 64, 80) : 0,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: SPACING.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
      gap: SPACING.sm,
      elevation: 6,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceContainerHigh,
    },
    stepBadgeText: {
      ...theme.type.labelSm,
      color: theme.colors.onSurfaceVariant,
    },
    title: {
      ...theme.type.titleMd,
      color: theme.colors.onSurface,
    },
    body: {
      ...theme.type.bodySm,
      color: theme.colors.onSurfaceVariant,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    skipButton: {
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
    },
    skipText: {
      ...theme.type.labelSm,
      color: theme.colors.onSurfaceVariant,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.primary,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.md,
      borderRadius: theme.radius.full,
    },
    nextText: {
      ...theme.type.labelSm,
      color: theme.colors.onPrimary,
    },
  });
