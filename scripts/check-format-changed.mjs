import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const supportedExtensions = new Set([
  '.cjs',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const gitFiles = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'buffer' })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);

const base = process.env.FORMAT_BASE_SHA?.trim();
const head = process.env.FORMAT_HEAD_SHA?.trim() || 'HEAD';
const validBase = base && !/^0+$/.test(base);
const ciHead = process.env.FORMAT_HEAD_SHA?.trim();
const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const changed = validBase
  ? gitFiles(['diff', '--name-only', '-z', '--diff-filter=ACMR', base, head])
  : ciHead
    ? gitFiles(['diff', '--name-only', '-z', '--diff-filter=ACMR', emptyTree, head])
    : [
        ...gitFiles(['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD']),
        ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z']),
      ];

const files = [...new Set(changed)]
  .filter((file) => supportedExtensions.has(extname(file)))
  .filter((file) => existsSync(join(root, file)));

if (files.length === 0) {
  console.log('No changed files require formatting checks.');
  process.exit(0);
}

const prettier = fileURLToPath(import.meta.resolve('prettier/bin/prettier.cjs'));
execFileSync(process.execPath, [prettier, '--check', ...files], {
  cwd: root,
  stdio: 'inherit',
});
