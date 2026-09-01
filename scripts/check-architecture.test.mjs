import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const checker = fileURLToPath(new URL('./check-architecture.mjs', import.meta.url));

const runFixture = async (overrides, expectedMessage) => {
  const sourceRoot = await mkdtemp(join(tmpdir(), 'sui-architecture-'));
  const files = {
    'application/App.ts': '',
    'features/alpha/public.ts': '',
    'features/beta/public.ts': '',
    'shared/domain/productivity/public.ts': '',
    'shared/lib.ts': '',
    ...overrides,
  };

  try {
    for (const [path, content] of Object.entries(files)) {
      const target = join(sourceRoot, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
    }
    const result = spawnSync(process.execPath, [checker], {
      encoding: 'utf8',
      env: { ...process.env, SUI_ARCHITECTURE_SOURCE_ROOT: sourceRoot },
    });
    if (expectedMessage) {
      assert.notEqual(result.status, 0);
      assert.match(
        `${result.stderr}${result.stdout}`,
        expectedMessage,
        JSON.stringify({ status: result.status, signal: result.signal, error: result.error }),
      );
    } else {
      assert.equal(result.status, 0, result.stderr);
    }
  } finally {
    await rm(sourceRoot, { recursive: true, force: true });
  }
};

test('accepts imports through feature public APIs', () =>
  runFixture(
    {
      'application/App.ts': "import '@/features/alpha/public';",
    },
    null,
  ));

test('rejects deep feature imports', () =>
  runFixture(
    {
      'application/App.ts': "import '@/features/alpha/internal';",
      'features/alpha/internal.ts': '',
    },
    /import alpha through @\/features\/alpha\/public/,
  ));

test('rejects feature dependencies on application', () =>
  runFixture(
    {
      'features/alpha/public.ts': "import '@/application/App';",
    },
    /features cannot import application/,
  ));

test('rejects shared dependencies on features', () =>
  runFixture(
    {
      'shared/lib.ts': "import '@/features/alpha/public';",
    },
    /shared cannot import features/,
  ));

test('rejects feature cycles', () =>
  runFixture(
    {
      'features/alpha/public.ts': "import '@/features/beta/public';",
      'features/beta/public.ts': "import '@/features/alpha/public';",
    },
    /feature cycle: alpha -> beta -> alpha/,
  ));

test('rejects deep productivity imports', () =>
  runFixture(
    {
      'features/alpha/internal.ts':
        "import '@/shared/domain/productivity/store/useProductivityStore';",
      'shared/domain/productivity/store/useProductivityStore.ts': '',
    },
    /import productivity through @\/shared\/domain\/productivity\/public/,
  ));
