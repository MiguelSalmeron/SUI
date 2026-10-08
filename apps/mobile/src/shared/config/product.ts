export const PRODUCT_CONFIG = {
  environment: process.env.EXPO_PUBLIC_APP_ENV?.trim() || 'development',
  minimumAge: 18,
  policyVersion: process.env.EXPO_PUBLIC_POLICY_VERSION?.trim() || '2026-08-27',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || '',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || '',
  countryCode: process.env.EXPO_PUBLIC_COUNTRY_CODE?.trim().toUpperCase() || 'NI',
  approvedMarkets: (process.env.EXPO_PUBLIC_APPROVED_MARKETS ?? '')
    .split(',')
    .map((value: string) => value.trim().toUpperCase())
    .filter(Boolean),
  accountabilityEnabled: process.env.EXPO_PUBLIC_ACCOUNTABILITY_ENABLED?.trim() === 'true',
  engagementEnabled: process.env.EXPO_PUBLIC_ENGAGEMENT_ENABLED?.trim() === 'true',
  /**
   * Google Tasks. Apagado por defecto: el conector es nuevo y su alcance en
   * producción todavía no está aprobado. Es el mismo mecanismo que
   * `engagementEnabled`, y es lo que permite revertir el conector sin tocar
   * migraciones (borrar el documento deja al cliente en desconectado).
   */
  googleTasksEnabled: process.env.EXPO_PUBLIC_GOOGLE_TASKS_ENABLED?.trim() === 'true',
} as const;

export const isProductionEnvironment = PRODUCT_CONFIG.environment === 'production';
