import type {
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionTier,
  UserEntitlements,
} from '@sui/contracts';

export type {
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionTier,
  UserEntitlements,
};

export interface BillingState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  entitlements: UserEntitlements;
  plans: SubscriptionPlan[];
  isLoading: boolean;
  error: string | null;
}

export interface BillingActions {
  initialize: () => Promise<void>;
  purchasePlan: (planId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  canAccessFeature: (feature: 'unlimited_ai' | 'multi_device_sync' | 'advanced_calendar') => boolean;
}
