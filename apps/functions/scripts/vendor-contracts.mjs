import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const functionsRoot = join(root, '..');
const contractsDist = join(functionsRoot, '..', '..', 'packages', 'contracts', 'dist');
const productivity = join(functionsRoot, 'lib', 'productivity');
const vendored = join(productivity, 'contracts');
const validation = join(productivity, 'validation.js');

/**
 * El deploy de Functions no resuelve el workspace `@sui/contracts`, así que su
 * runtime se copia dentro de `lib`. El paquete tiene un módulo por dominio: se
 * copia el dist completo y los `require('./...')` relativos siguen resolviendo
 * dentro de la carpeta.
 */
await rm(join(productivity, 'contracts.js'), { force: true });
await rm(vendored, { recursive: true, force: true });
await mkdir(vendored, { recursive: true });

for (const entry of await readdir(contractsDist)) {
  if (!entry.endsWith('.js')) continue;
  await copyFile(join(contractsDist, entry), join(vendored, entry));
}

const output = await readFile(validation, 'utf8');
const rewritten = output.replace('require("@sui/contracts")', 'require("./contracts")');
if (rewritten === output) throw new Error('contracts-runtime-import-not-found');
await writeFile(validation, rewritten, 'utf8');
