const environment = process.env.EXPO_PUBLIC_APP_ENV?.trim() || 'development';

if (environment !== 'production') {
  console.log(`Production config skipped (${environment}).`);
  process.exit(0);
}

const required = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY',
  'EXPO_PUBLIC_CHAT_PROXY_URL',
  'EXPO_PUBLIC_CONNECTIONS_API_URL',
  'EXPO_PUBLIC_SYNC_API_URL',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_TERMS_URL',
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_POLICY_VERSION',
  'EXPO_PUBLIC_APPROVED_MARKETS',
  'EXPO_PUBLIC_SENTRY_DSN',
];

const missing = required.filter((key) => !process.env[key]?.trim());
for (const key of required) {
  if (process.env[key]?.includes('REPLACE_')) missing.push(key);
}

const approvedMarkets =
  process.env.EXPO_PUBLIC_APPROVED_MARKETS?.split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean) ?? [];
const countryCode = process.env.EXPO_PUBLIC_COUNTRY_CODE?.trim().toUpperCase();
if (!countryCode || !approvedMarkets.includes(countryCode)) {
  missing.push('EXPO_PUBLIC_COUNTRY_CODE (must be approved)');
}

for (const key of ['EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_PRIVACY_URL']) {
  const value = process.env[key]?.trim() ?? '';
  if (value && !value.startsWith('https://')) missing.push(`${key} (must use HTTPS)`);
}

if (missing.length) {
  console.error(`Production config invalid:\n- ${[...new Set(missing)].join('\n- ')}`);
  process.exit(1);
}

console.log(`Production config valid for ${countryCode}.`);
