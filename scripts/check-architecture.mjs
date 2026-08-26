import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = join(root, 'src');
const supportedExtensions = new Set(['.ts', '.tsx']);
const legacyRoots = new Set([
  'components',
  'config',
  'context',
  'hooks',
  'navigation',
  'screens',
  'services',
  'store',
  'theme',
  'types',
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    if (entry.isFile() && supportedExtensions.has(extname(entry.name))) files.push(path);
  }

  return files;
}

const failures = [];
const files = await collectFiles(sourceRoot);

for (const file of files) {
  const projectPath = relative(root, file).replaceAll('\\', '/');
  const sourcePath = relative(sourceRoot, file).replaceAll('\\', '/');
  const [topLevel] = sourcePath.split('/');
  const content = await readFile(file, 'utf8');

  if (legacyRoots.has(topLevel)) {
    failures.push(`${projectPath}: source remains in legacy technical-layer folder`);
  }

  if (sourcePath.startsWith('shared/') && /from\s+['"]@\/(?:application|features)\//.test(content)) {
    failures.push(`${projectPath}: shared layer cannot import application or features`);
  }
}

if (failures.length > 0) {
  console.error('Architecture check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Architecture check passed (${files.length} source files).`);
}
