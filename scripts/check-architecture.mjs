import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const configuredSourceRoot = process.env.SUI_ARCHITECTURE_SOURCE_ROOT?.trim();
const sourceRoot = configuredSourceRoot ? resolve(root, configuredSourceRoot) : join(root, 'src');
const supportedExtensions = ['.ts', '.tsx'];
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
const rawTypographyPatterns = [
  [/\bfontSize\s*:\s*\d/u, 'raw fontSize; use theme.type token'],
  [/\blineHeight\s*:\s*\d/u, 'raw lineHeight; use theme.type token'],
  [/\bfontWeight\s*:\s*['"]/u, 'raw fontWeight; use theme.type token'],
  [/\bfontFamily\s*:\s*(?:['"]|SUI_FONTS\.)/u, 'raw fontFamily; use theme.type token'],
];

const normalizePath = (path) => path.replaceAll('\\', '/');
const productivityPrefix = 'shared/domain/productivity/';

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    if (entry.isFile() && supportedExtensions.includes(extname(entry.name))) files.push(path);
  }

  return files;
}

const resolveSourceFile = (base) => {
  const candidates = [
    base,
    ...supportedExtensions.map((extension) => `${base}${extension}`),
    ...supportedExtensions.map((extension) => join(base, `index${extension}`)),
  ];
  return candidates.find(
    (candidate) =>
      existsSync(candidate) && statSync(candidate).isFile() && candidate.startsWith(sourceRoot),
  );
};

const resolveImport = (file, specifier) => {
  if (specifier.startsWith('@/')) {
    return resolveSourceFile(join(sourceRoot, specifier.slice(2)));
  }
  if (specifier.startsWith('.')) {
    return resolveSourceFile(resolve(dirname(file), specifier));
  }
  return undefined;
};

const collectSpecifiers = (content, file) => {
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    extname(file) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return specifiers;
};

const describeLocation = (file) => {
  const path = normalizePath(relative(sourceRoot, file));
  const parts = path.split('/');
  return {
    feature: parts[0] === 'features' ? parts[1] : undefined,
    layer: parts[0],
    path,
  };
};

const findCycles = (graph) => {
  const cycles = [];
  const visited = new Set();
  const active = new Set();
  const stack = [];

  const visit = (node) => {
    if (active.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    stack.pop();
    active.delete(node);
  };

  for (const node of graph.keys()) visit(node);
  return cycles;
};

const failures = [];
const files = await collectFiles(sourceRoot);
const featureDirectories = await readdir(join(sourceRoot, 'features'), { withFileTypes: true });
const features = featureDirectories
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const featureGraph = new Map(features.map((feature) => [feature, new Set()]));

for (const feature of features) {
  const publicApi = join(sourceRoot, 'features', feature, 'public.ts');
  if (!existsSync(publicApi)) failures.push(`src/features/${feature}: missing public.ts`);
}

for (const file of files) {
  const projectPath = normalizePath(relative(root, file));
  const source = describeLocation(file);
  const content = await readFile(file, 'utf8');

  if (legacyRoots.has(source.layer)) {
    failures.push(`${projectPath}: source remains in legacy technical-layer folder`);
  }

  for (const specifier of collectSpecifiers(content, file)) {
    const targetFile = resolveImport(file, specifier);
    if (specifier.startsWith('@/') && !targetFile) {
      failures.push(`${projectPath}: unresolved internal import ${specifier}`);
      continue;
    }
    if (!targetFile) continue;
    const target = describeLocation(targetFile);
    const sourceIsProductivity = source.path.startsWith(productivityPrefix);
    const targetIsProductivity = target.path.startsWith(productivityPrefix);

    if (source.layer === 'shared' && ['application', 'features'].includes(target.layer)) {
      failures.push(`${projectPath}: shared cannot import ${target.layer}`);
    }
    if (source.layer === 'features' && target.layer === 'application') {
      failures.push(`${projectPath}: features cannot import application`);
    }
    if (target.layer === 'features') {
      const isExternalFeature = source.layer !== 'features' || source.feature !== target.feature;
      const expectedPublicApi = `@/features/${target.feature}/public`;
      if (isExternalFeature && specifier !== expectedPublicApi) {
        failures.push(`${projectPath}: import ${target.feature} through ${expectedPublicApi}`);
      }
      if (!isExternalFeature && specifier.startsWith('@/features/')) {
        failures.push(`${projectPath}: use relative imports inside feature ${source.feature}`);
      }
      if (source.feature && source.feature !== target.feature) {
        featureGraph.get(source.feature)?.add(target.feature);
      }
    }
    if (targetIsProductivity) {
      const expectedPublicApi = '@/shared/domain/productivity/public';
      if (!sourceIsProductivity && specifier !== expectedPublicApi) {
        failures.push(`${projectPath}: import productivity through ${expectedPublicApi}`);
      }
      if (sourceIsProductivity && specifier.startsWith('@/shared/domain/productivity/')) {
        failures.push(`${projectPath}: use relative imports inside productivity domain`);
      }
    }
  }

  if (extname(file) === '.tsx') {
    for (const [pattern, message] of rawTypographyPatterns) {
      if (pattern.test(content)) failures.push(`${projectPath}: ${message}`);
    }
  }
}

for (const cycle of findCycles(featureGraph)) {
  failures.push(`feature cycle: ${cycle.join(' -> ')}`);
}

if (failures.length > 0) {
  console.error('Architecture check failed:\n');
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Architecture check passed (${files.length} source files, ${features.length} features).`,
  );
}
