export const PRODUCT_CONFIG = {
  environment: process.env.EXPO_PUBLIC_APP_ENV?.trim() || 'development',
  minimumAge: 16,
  policyVersion: process.env.EXPO_PUBLIC_POLICY_VERSION?.trim() || '2026-08-27',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || '',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || '',
  countryCode: process.env.EXPO_PUBLIC_COUNTRY_CODE?.trim().toUpperCase() || 'NI',
  approvedMarkets: (process.env.EXPO_PUBLIC_APPROVED_MARKETS ?? '')
    .split(',')
    .map((value: string) => value.trim().toUpperCase())
    .filter(Boolean),
} as const;

export const isProductionEnvironment = PRODUCT_CONFIG.environment === 'production';
