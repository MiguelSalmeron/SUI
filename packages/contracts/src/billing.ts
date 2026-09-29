/**
 * Contratos de suscripciones y monetización.
 *
 * Sólo tipos y el parser de entitlements: la integración con la tienda vive en
 * el cliente, no en el contrato compartido.
 */

import { isRecord } from './validation';

// ---------------------------------------------------------------------------
// Subscriptions & Monetization Contracts
// ---------------------------------------------------------------------------
export type SubscriptionTier = 'free' | 'plus' | 'pro';
export type SubscriptionStatus =
  'active' | 'trialing' | 'canceled' | 'expired' | 'grace_period' | 'none';

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  priceString: string;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
}

export interface UserEntitlements {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  expiresAt?: string;
  hasUnlimitedAI: boolean;
  hasMultiDeviceSync: boolean;
  hasAdvancedCalendar: boolean;
}

export const DEFAULT_ENTITLEMENTS: UserEntitlements = {
  tier: 'free',
  status: 'none',
  hasUnlimitedAI: false,
  hasMultiDeviceSync: false,
  hasAdvancedCalendar: false,
};

export const parseUserEntitlements = (value: unknown): UserEntitlements => {
  if (!isRecord(value)) return DEFAULT_ENTITLEMENTS;
  const tier: SubscriptionTier = ['free', 'plus', 'pro'].includes(String(value.tier))
    ? (value.tier as SubscriptionTier)
    : 'free';
  const status: SubscriptionStatus = [
    'active',
    'trialing',
    'canceled',
    'expired',
    'grace_period',
    'none',
  ].includes(String(value.status))
    ? (value.status as SubscriptionStatus)
    : 'none';

  return {
    tier,
    status,
    expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : undefined,
    hasUnlimitedAI:
      typeof value.hasUnlimitedAI === 'boolean' ? value.hasUnlimitedAI : tier !== 'free',
    hasMultiDeviceSync:
      typeof value.hasMultiDeviceSync === 'boolean' ? value.hasMultiDeviceSync : tier !== 'free',
    hasAdvancedCalendar:
      typeof value.hasAdvancedCalendar === 'boolean' ? value.hasAdvancedCalendar : tier === 'pro',
  };
};
