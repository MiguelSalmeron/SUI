import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING } from '../../theme/theme';

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
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              <Text style={[styles.tabDescription, isActive && styles.tabDescriptionActive]}>
                {tab.description}
              </Text>
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
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  tabLabelActive: {
    color: COLORS.white,
  },
  tabDescription: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tabDescriptionActive: {
    color: COLORS.white,
    opacity: 0.9,
  },
});
