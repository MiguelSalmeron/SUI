import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MD3_COLORS, SPACING } from '../../theme/theme';

export type DashboardTab = 'overview' | 'goals' | 'habits' | 'pomodoro' | 'summary';

type NavbarTab = {
  key: DashboardTab;
  label: string;
  description: string;
};

type Props = {
  tabs: NavbarTab[];
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

export const DashboardNavbar = ({ tabs, activeTab, onChange }: Props) => {
  return (
    <View style={styles.shell}>
      <Text style={styles.title}>Navegación</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabCard, isActive && styles.tabCardActive]}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              <Text style={[styles.tabDescription, isActive && styles.tabDescriptionActive]}>
                {tab.description}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: MD3_COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  tabsRow: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  tabCard: {
    minWidth: 128,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 18,
    backgroundColor: MD3_COLORS.surface,
    borderWidth: 1,
    borderColor: MD3_COLORS.outlineVariant,
  },
  tabCardActive: {
    backgroundColor: MD3_COLORS.primary,
    borderColor: MD3_COLORS.primary,
    shadowColor: MD3_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: MD3_COLORS.surface,
    opacity: 0.9,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: MD3_COLORS.onSurface,
  },
  tabLabelActive: {
    color: MD3_COLORS.surface,
  },
  tabDescription: {
    marginTop: 4,
    fontSize: 12,
    color: MD3_COLORS.onSurfaceVariant,
  },
  tabDescriptionActive: {
    color: MD3_COLORS.surface,
    opacity: 0.9,
  },
});
