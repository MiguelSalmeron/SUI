/**
 * Servicio de facturación y suscripciones con soporte RevenueCat y Fallback local/offline.
 */

import type {
  SubscriptionPlan,
  UserEntitlements,
} from './billingTypes';

export interface BillingProvider {
  initialize(): Promise<void>;
  getPlans(): Promise<SubscriptionPlan[]>;
  purchase(planId: string): Promise<UserEntitlements>;
  restore(): Promise<UserEntitlements>;
  getEntitlements(): Promise<UserEntitlements>;
}

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'sui_plus_monthly',
    tier: 'plus',
    name: 'Sui Plus (Mensual)',
    priceString: '$4.99 / mes',
    currency: 'USD',
    interval: 'monthly',
    features: [
      'Sincronización multi-dispositivo continua',
      'Asistencia IA ilimitada con desglose de metas',
      'Reportes nocturnos reflexivos ilimitados',
    ],
  },
  {
    id: 'sui_plus_yearly',
    tier: 'plus',
    name: 'Sui Plus (Anual)',
    priceString: '$39.99 / año',
    currency: 'USD',
    interval: 'yearly',
    features: [
      'Todo lo de Sui Plus mensual',
      '33% de descuento anual',
      'Acceso prioritario a nuevas herramientas',
    ],
  },
  {
    id: 'sui_pro_yearly',
    tier: 'pro',
    name: 'Sui Pro (Anual)',
    priceString: '$69.99 / año',
    currency: 'USD',
    interval: 'yearly',
    features: [
      'Conexión bidireccional de múltiples calendarios',
      'Auditorías semanales avanzadas',
      'Exportación ejecutiva a PDF / Markdown',
      'Soporte prioritario',
    ],
  },
];

export class MockBillingProvider implements BillingProvider {
  private currentEntitlements: UserEntitlements = {
    tier: 'free',
    status: 'none',
    hasUnlimitedAI: false,
    hasMultiDeviceSync: false,
    hasAdvancedCalendar: false,
  };

  async initialize(): Promise<void> {
    // Inicialización de proveedor (e.g. Purchases.configure)
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    return DEFAULT_PLANS;
  }

  async purchase(planId: string): Promise<UserEntitlements> {
    const plan = DEFAULT_PLANS.find((p) => p.id === planId);
    const tier = plan ? plan.tier : 'plus';

    this.currentEntitlements = {
      tier,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      hasUnlimitedAI: true,
      hasMultiDeviceSync: true,
      hasAdvancedCalendar: tier === 'pro',
    };
    return this.currentEntitlements;
  }

  async restore(): Promise<UserEntitlements> {
    return this.currentEntitlements;
  }

  async getEntitlements(): Promise<UserEntitlements> {
    return this.currentEntitlements;
  }
}

let activeProvider: BillingProvider = new MockBillingProvider();

export const setBillingProvider = (provider: BillingProvider): void => {
  activeProvider = provider;
};

export const getBillingProvider = (): BillingProvider => activeProvider;
