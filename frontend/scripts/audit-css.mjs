import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const srcDir = join(root, 'src');
const packageJsonPath = join(root, 'package.json');
const lockfilePath = join(root, 'pnpm-lock.yaml');
const allowedColorFile = 'src/styles/tokens.css';

const visualPackages = [
  '@emotion/react',
  '@emotion/styled',
  '@mui/material',
  'antd',
  'bootstrap',
  'chakra-ui',
  'daisyui',
  'mantine',
  'styled-components',
  'tailwindcss',
];
const legacyTokenPattern = /--(?:cream|card|ink|ink-soft|border|border-soft|green|green-deep|green-link|red|transfers-[a-z0-9-]+)\b/;
const hardcodedColorPattern = /:\s*[^;{}]*(#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)|(?<!-)\b(?:white|black)\b|\btransparent\b)/;

const failures = [];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    return [fullPath];
  });
}

function report(file, lineNumber, message, line) {
  const location = lineNumber ? `${file}:${lineNumber}` : file;
  failures.push(`${location} ${message}${line ? `\n  ${line.trim()}` : ''}`);
}

function rel(file) {
  return relative(root, file).replaceAll('\\', '/');
}

const files = walk(srcDir);
const cssFiles = files.filter((file) => file.endsWith('.css'));
const codeFiles = files.filter((file) => /\.(js|jsx)$/.test(file));

for (const file of cssFiles) {
  const fileRel = rel(file);
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    if (line.includes('!important')) {
      report(fileRel, index + 1, 'uses !important', line);
    }

    if (legacyTokenPattern.test(line)) {
      report(fileRel, index + 1, 'uses a legacy/local visual token', line);
    }

    if (fileRel !== allowedColorFile && hardcodedColorPattern.test(line) && !line.includes('var(--color-transparent)')) {
      report(fileRel, index + 1, 'uses a hardcoded color outside tokens.css', line);
    }
  });
}

for (const file of codeFiles) {
  const fileRel = rel(file);
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    if (/style=\{\{/.test(line)) {
      report(fileRel, index + 1, 'uses an inline style object', line);
    }
  });
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const installedPackages = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
]);

for (const pkg of visualPackages) {
  if (installedPackages.has(pkg)) {
    report('package.json', null, `installs disallowed visual/CSS package ${pkg}`);
  }
}

if (existsSync(lockfilePath)) {
  const lockfile = readFileSync(lockfilePath, 'utf8');

  for (const pkg of visualPackages) {
    if (lockfile.includes(`${pkg}:`) || lockfile.includes(`/${pkg}@`)) {
      report('pnpm-lock.yaml', null, `contains disallowed visual/CSS package ${pkg}`);
    }
  }
}

if (failures.length > 0) {
  console.error('CSS audit failed:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('CSS audit passed');
