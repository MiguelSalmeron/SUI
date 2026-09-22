import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const checker = fileURLToPath(new URL('./check-functions-config.mjs', import.meta.url));

const WEB_ID = '1111111111-web.apps.googleusercontent.com';
const ANDROID_ID = '1111111111-android.apps.googleusercontent.com';

const runFixture = async (
  files,
  { expectedMessage, expectPass = false, expectWarn, project } = {},
) => {
  const functionsDir = await mkdtemp(join(tmpdir(), 'sui-functions-cfg-'));
  const mobileDir = await mkdtemp(join(tmpdir(), 'sui-mobile-cfg-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      const target = join(functionsDir, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
    }
    await writeFile(
      join(mobileDir, '.env'),
      `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=${WEB_ID}\nEXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=${ANDROID_ID}\n`,
      'utf8',
    );
    const result = spawnSync(process.execPath, [checker], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SUI_FUNCTIONS_DIR: functionsDir,
        SUI_MOBILE_DIR: mobileDir,
        ...(project ? { SUI_FIREBASE_PROJECT: project } : {}),
      },
    });
    if (expectPass) {
      assert.equal(result.status, 0, `${result.stderr || result.stdout}`);
      return result;
    }
    if (expectWarn) {
      // Los warnings son no bloqueantes: exit 0 + mensaje visible.
      assert.equal(result.status, 0, `${result.stderr || result.stdout}`);
      assert.match(`${result.stderr}${result.stdout}`, expectWarn);
      return result;
    }
    assert.notEqual(result.status, 0);
    assert.match(
      `${result.stderr}${result.stdout}`,
      expectedMessage,
      JSON.stringify({ status: result.status, error: result.error }),
    );
    return result;
  } finally {
    await rm(functionsDir, { recursive: true, force: true });
    await rm(mobileDir, { recursive: true, force: true });
  }
};

const validEnv = `GOOGLE_OAUTH_CLIENT_IDS=${WEB_ID},${ANDROID_ID}\nGOOGLE_OAUTH_WEB_CLIENT_ID=${WEB_ID}\nAPP_CHECK_MODE=monitor\nALLOWED_ORIGINS=https://xsui.web.app,https://xsui.firebaseapp.com\n`;

test('pasa con allowlist completa, app check y orígenes correctos', () =>
  runFixture({ '.env.xsui-nica': validEnv }, { expectPass: true, project: 'xsui-nica' }));

test('falla si GOOGLE_OAUTH_CLIENT_IDS está vacío', () =>
  runFixture(
    {
      '.env.xsui-nica': validEnv.replace(
        `GOOGLE_OAUTH_CLIENT_IDS=${WEB_ID},${ANDROID_ID}`,
        'GOOGLE_OAUTH_CLIENT_IDS=',
      ),
    },
    { expectedMessage: /GOOGLE_OAUTH_CLIENT_IDS/, project: 'xsui-nica' },
  ));

test('falla si falta el archivo de env del proyecto activo', () =>
  runFixture({ '.env.otro': validEnv }, {
    expectedMessage: /no está en/,
    project: 'xsui-nica',
  }));

test('warn (no bloqueante) si la allowlist no cubre los client IDs del móvil', () =>
  runFixture(
    {
      '.env.xsui-nica': validEnv.replace(`,${ANDROID_ID}`, ''),
    },
    { expectWarn: /no incluye el Android Client ID/, project: 'xsui-nica' },
  ));

test('warn (no bloqueante) si APP_CHECK_MODE no es monitor|enforce', () =>
  runFixture(
    { '.env.xsui-nica': `${validEnv}APP_CHECK_MODE=strict\n` },
    { expectWarn: /APP_CHECK_MODE/, project: 'xsui-nica' },
  ));

test('warn (no bloqueante) si ALLOWED_ORIGINS omite el hosting de producción', () =>
  runFixture(
    {
      '.env.xsui-nica': validEnv.replace(
        'ALLOWED_ORIGINS=https://xsui.web.app,https://xsui.firebaseapp.com',
        'ALLOWED_ORIGINS=http://localhost:8081',
      ),
    },
    { expectWarn: /ALLOWED_ORIGINS/, project: 'xsui-nica' },
  ));
