import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const functionsRoot = join(root, '..');
const contracts = join(functionsRoot, '..', '..', 'packages', 'contracts', 'dist', 'index.js');
const vendored = join(functionsRoot, 'lib', 'productivity', 'contracts.js');
const validation = join(functionsRoot, 'lib', 'productivity', 'validation.js');

await copyFile(contracts, vendored);
const output = await readFile(validation, 'utf8');
const rewritten = output.replace('require("@sui/contracts")', 'require("./contracts")');
if (rewritten === output) throw new Error('contracts-runtime-import-not-found');
await writeFile(validation, rewritten, 'utf8');
