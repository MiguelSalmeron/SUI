/**
 * Valida los parámetros NO secretos de las Cloud Functions ANTES del deploy.
 *
 * Motivación: `GOOGLE_OAUTH_CLIENT_IDS` vacío hace que `googleCalendarConnect`
 * rechace toda conexión con 400 sin ruido en logs. Este check falla el
 * predeploy con un mensaje accionable en lugar de descubrirlo en producción.
 *
 * Uso:
 *   node scripts/check-functions-config.mjs
 *
 * Overrides para tests:
 *   SUI_FIREBASE_PROJECT, SUI_FUNCTIONS_DIR, SUI_MOBILE_DIR
 *
 * Nunca imprime valores: sólo claves y si están vacías o no.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const projectOverride = process.env.SUI_FIREBASE_PROJECT?.trim();
const functionsDir = resolve(
  root,
  process.env.SUI_FUNCTIONS_DIR?.trim() || join('apps', 'functions'),
);
const mobileDir = resolve(root, process.env.SUI_MOBILE_DIR?.trim() || join('apps', 'mobile'));

const parseEnvFile = (path) => {
  const values = new Map();
  if (!existsSync(path)) return values;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
    values.set(key, value);
  }
  return values;
};

/** Resuelve el proyecto activo: override de test > .firebaserc (default o alias único) > null. */
const resolveFirebaseProject = () => {
  if (projectOverride) return projectOverride;
  const rcPath = join(root, '.firebaserc');
  if (!existsSync(rcPath)) return null;
  try {
    const rc = JSON.parse(readFileSync(rcPath, 'utf8'));
    const projects = rc.projects ?? {};
    if (projects.default) return projects.default;
    const aliases = Object.values(projects).filter(Boolean);
    return aliases.length === 1 ? aliases[0] : null;
  } catch {
    return null;
  }
};

const project = resolveFirebaseProject();
const envFiles = [
  join(functionsDir, '.env'),
  ...(project ? [join(functionsDir, `.env.${project}`)] : []),
];

const params = new Map();
for (const file of envFiles) {
  for (const [key, value] of parseEnvFile(file)) params.set(key, value);
}

const missing = [];
const empty = [];
const warnings = [];

const required = [
  { key: 'GOOGLE_OAUTH_CLIENT_IDS', why: 'sin allowlist, googleCalendarConnect rechaza toda conexión con 400' },
  { key: 'GOOGLE_OAUTH_WEB_CLIENT_ID', why: 'necesario para adjuntar el client_secret en el intercambio web' },
];
for (const { key, why } of required) {
  if (!params.has(key)) missing.push(`${key} (no está en ${envFiles.map((f) => f.split('/').pop()).join(' ni ')})`);
  else if (!params.get(key)) empty.push(`${key} — ${why}`);
}

// Contraste cruzado: los client IDs de Functions deben cubrir los del móvil.
const mobileEnv = parseEnvFile(join(mobileDir, '.env'));
const mobileWebId = mobileEnv.get('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ?? '';
const mobileAndroidId = mobileEnv.get('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') ?? '';
const allowlist = (params.get('GOOGLE_OAUTH_CLIENT_IDS') ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const checkCovered = (label, clientId) => {
  if (clientId && !allowlist.includes(clientId)) {
    warnings.push(`GOOGLE_OAUTH_CLIENT_IDS no incluye el ${label} que usa la app (${clientId.slice(0, 12)}…)`);
  }
};
if (allowlist.length) {
  checkCovered('Web Client ID', mobileWebId);
  checkCovered('Android Client ID', mobileAndroidId);
}

// Modo App Check: sólo monitor u enforce.
const appCheckMode = params.get('APP_CHECK_MODE');
if (appCheckMode && appCheckMode !== 'monitor' && appCheckMode !== 'enforce') {
  warnings.push(`APP_CHECK_MODE="${appCheckMode}" no es válido (monitor|enforce)`);
}

// Los orígenes de la app desplegada deben estar en ALLOWED_ORIGINS.
const allowedOrigins = (params.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
if (allowedOrigins.length) {
  for (const origin of ['https://xsui.web.app', 'https://xsui.firebaseapp.com']) {
    if (!allowedOrigins.includes(origin)) {
      warnings.push(`ALLOWED_ORIGINS no incluye ${origin}`);
    }
  }
}

const failures = [...missing, ...empty];
if (failures.length || warnings.length) {
  console.error('Functions config check failed:\n');
  for (const item of failures) console.error(`- ${item}`);
  for (const item of warnings) console.error(`- WARN: ${item}`);
  if (failures.length) process.exitCode = 1;
  else console.log('\nConfig usable con advertencias.');
} else {
  console.log(`Functions config check passed (${envFiles.map((f) => f.split('/').pop()).join(' + ')}).`);
}
