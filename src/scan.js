/**
 * Code Scanner — Directory structure, routes, models, configs.
 * Framework-agnostic: uses file patterns and simple regex.
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import fg from 'fast-glob';

// ─── Directory structure scan ────────────────────────────────────────────────

export async function scanStructure(targetDir, maxDepth = 3) {
  const tree = [];
  const fileCounts = {};

  buildTree(targetDir, targetDir, 0, maxDepth, tree, fileCounts);

  return { tree, fileCounts };
}

function buildTree(baseDir, dir, depth, maxDepth, tree, fileCounts) {
  if (depth > maxDepth) return;

  const IGNORE = new Set([
    'node_modules', 'vendor', '.git', '.idea', '.vscode',
    '__pycache__', '.next', '.nuxt', 'dist', 'build',
    'storage', 'cache', '.cache', 'tmp', 'temp',
    'coverage', '.turbo', '.output',
  ]);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch { return; }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && depth === 0 && entry.name !== '.env.example') continue;
    if (IGNORE.has(entry.name)) continue;

    const fullPath = join(dir, entry.name);
    const relPath = relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      tree.push({ path: relPath, type: 'dir', depth });
      buildTree(baseDir, fullPath, depth + 1, maxDepth, tree, fileCounts);
    } else if (depth <= 1) {
      // Only list files at top 2 levels in tree
      tree.push({ path: relPath, type: 'file', depth });
    }

    // Count files by extension
    if (!entry.isDirectory()) {
      const ext = extname(entry.name).toLowerCase();
      if (ext) fileCounts[ext] = (fileCounts[ext] || 0) + 1;
    }
  }
}

// ─── Route / endpoint scanning ───────────────────────────────────────────────

const ROUTE_GLOBS = [
  '**/routes/**/*.{php,js,ts,py,rb}',
  '**/urls.py',
  '**/urls/**/*.py',
  'config/routes.rb',
  '**/router/**/*.{js,ts,go}',
  '**/api/**/*.{js,ts}',
  'src/pages/api/**/*.{js,ts,tsx}',       // Next.js API routes
  'app/api/**/route.{js,ts}',             // Next.js App Router
  'server/api/**/*.{js,ts}',              // Nuxt
];

const ROUTE_PATTERNS = [
  // PHP / Laravel
  { regex: /Route::(get|post|put|patch|delete|options|any)\(\s*['"]([^'"]+)['"]/gi, method: 1, path: 2 },
  { regex: /Route::(resource|apiResource)\(\s*['"]([^'"]+)['"]/gi, method: 'RESOURCE', path: 2 },
  // Express / Fastify / Hono
  { regex: /(?:router|app|server)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi, method: 1, path: 2 },
  // Django
  { regex: /path\(\s*['"]([^'"]*)['"]/gi, method: 'ANY', path: 1 },
  // Rails
  { regex: /(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/gi, method: 1, path: 2 },
  { regex: /resources?\s+:(\w+)/gi, method: 'RESOURCE', path: 1 },
  // Go / Gin / Echo / Fiber
  { regex: /\.(GET|POST|PUT|PATCH|DELETE)\(\s*["']([^"']+)["']/gi, method: 1, path: 2 },
];

export async function scanRoutes(targetDir) {
  const routeFiles = await fg(ROUTE_GLOBS, {
    cwd: targetDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/vendor/**'],
  });

  const routes = [];

  for (const filePath of routeFiles) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }

    const relPath = relative(targetDir, filePath);

    for (const pattern of ROUTE_PATTERNS) {
      for (const match of content.matchAll(pattern.regex)) {
        const method = typeof pattern.method === 'number'
          ? match[pattern.method].toUpperCase()
          : pattern.method;
        const path = match[typeof pattern.path === 'number' ? pattern.path : 2];
        routes.push({ method, path, file: relPath });
      }
    }

    // File-based routing (Next.js / Nuxt)
    if (/pages\/api\/|app\/api\/|server\/api\//.test(relPath)) {
      const routePath = relPath
        .replace(/^src\//, '')
        .replace(/^app\/api\//, '/api/')
        .replace(/^pages\/api\//, '/api/')
        .replace(/^server\/api\//, '/api/')
        .replace(/\/route\.(js|ts)$/, '')
        .replace(/\.(js|ts|tsx)$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1')
        .replace(/\/index$/, '');
      routes.push({ method: 'FILE', path: routePath || '/', file: relPath });
    }
  }

  return routes;
}

// ─── Controller scanning ─────────────────────────────────────────────────────

const CONTROLLER_GLOBS = [
  '**/Controllers/**/*.php',
  '**/controllers/**/*.{js,ts,rb,py}',
  '**/handlers/**/*.{go,js,ts}',
  '**/views.py',
  '**/viewsets.py',
  '**/views/**/*.py',
];

export async function scanControllers(targetDir) {
  const files = await fg(CONTROLLER_GLOBS, {
    cwd: targetDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/vendor/**'],
  });

  const controllers = [];

  for (const filePath of files) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }

    const relPath = relative(targetDir, filePath);
    const name = basename(filePath).replace(/\.\w+$/, '');
    const methods = [];

    // PHP: public function methodName
    for (const m of content.matchAll(/public\s+function\s+(\w+)\s*\(/g)) {
      if (!['__construct', '__destruct', '__get', '__set'].includes(m[1])) {
        methods.push(m[1]);
      }
    }
    // JS/TS: async methodName( or methodName(
    for (const m of content.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g)) {
      if (!['constructor', 'if', 'for', 'while', 'switch', 'catch'].includes(m[1])) {
        methods.push(m[1]);
      }
    }
    // Python: def method_name
    for (const m of content.matchAll(/def\s+(\w+)\s*\(/g)) {
      if (!m[1].startsWith('_')) methods.push(m[1]);
    }
    // Ruby: def method_name
    for (const m of content.matchAll(/def\s+(\w+)/g)) {
      methods.push(m[1]);
    }
    // Go: func (h *Handler) MethodName
    for (const m of content.matchAll(/func\s+\([^)]+\)\s+(\w+)\s*\(/g)) {
      methods.push(m[1]);
    }

    controllers.push({ name, file: relPath, methods: [...new Set(methods)] });
  }

  return controllers;
}

// ─── Model / entity scanning ─────────────────────────────────────────────────

const MODEL_GLOBS = [
  '**/Models/**/*.php',
  '**/models/**/*.{js,ts,py,rb,go,rs}',
  '**/entities/**/*.{js,ts}',
  '**/entity/**/*.{go,rs}',
  'prisma/schema.prisma',
];

export async function scanModels(targetDir) {
  const files = await fg(MODEL_GLOBS, {
    cwd: targetDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/vendor/**'],
  });

  const models = [];

  for (const filePath of files) {
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }

    const relPath = relative(targetDir, filePath);
    const ext = extname(filePath);

    // Prisma schema — special handling
    if (filePath.endsWith('schema.prisma')) {
      for (const m of content.matchAll(/model\s+(\w+)\s*\{/g)) {
        models.push({ name: m[1], file: relPath, type: 'prisma' });
      }
      continue;
    }

    // PHP: class ClassName extends Model
    for (const m of content.matchAll(/class\s+(\w+)\s+extends\s+(\w+)/g)) {
      models.push({ name: m[1], file: relPath, extends: m[2], type: 'class' });
    }

    // JS/TS: export class / export default class
    if (['.js', '.ts'].includes(ext)) {
      for (const m of content.matchAll(/(?:export\s+)?class\s+(\w+)/g)) {
        models.push({ name: m[1], file: relPath, type: 'class' });
      }
    }

    // Python: class ModelName(models.Model)
    for (const m of content.matchAll(/class\s+(\w+)\s*\([\w.]*Model\w*\)/g)) {
      models.push({ name: m[1], file: relPath, type: 'class' });
    }

    // Go: type ModelName struct
    for (const m of content.matchAll(/type\s+(\w+)\s+struct\s*\{/g)) {
      models.push({ name: m[1], file: relPath, type: 'struct' });
    }
  }

  return models;
}

// ─── Config file scanning ────────────────────────────────────────────────────

export async function scanConfigs(targetDir) {
  const CONFIG_FILES = [
    '.env.example', '.env',
    'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
    '.github/workflows/*.yml', '.github/workflows/*.yaml',
    '.gitlab-ci.yml', 'Jenkinsfile',
    'Makefile',
    // PHP
    'phpunit.xml', 'phpunit.xml.dist', 'phpstan.neon', 'phpcs.xml',
    // JS
    'jest.config.*', 'vitest.config.*', 'eslint.config.*', '.eslintrc.*',
    'tsconfig.json', 'webpack.config.*', 'vite.config.*', 'next.config.*',
    'tailwind.config.*', 'postcss.config.*',
    // Python
    'pytest.ini', 'setup.cfg', 'tox.ini', 'mypy.ini',
    // Ruby
    '.rspec', 'Rakefile',
    // Go
    '.golangci.yml',
  ];

  const found = await fg(CONFIG_FILES, {
    cwd: targetDir,
    absolute: false,
    ignore: ['**/node_modules/**', '**/vendor/**'],
  });

  return found;
}

// ─── Service / business logic scanning ───────────────────────────────────────

const SERVICE_GLOBS = [
  '**/Services/**/*.php',
  '**/services/**/*.{js,ts,py,rb,go}',
  '**/usecases/**/*.{js,ts,go}',
  '**/use-cases/**/*.{js,ts}',
  '**/interactors/**/*.{rb}',
];

export async function scanServices(targetDir) {
  const files = await fg(SERVICE_GLOBS, {
    cwd: targetDir,
    absolute: false,
    ignore: ['**/node_modules/**', '**/vendor/**'],
  });
  return files;
}

// ─── Migration scanning ─────────────────────────────────────────────────────

const MIGRATION_GLOBS = [
  '**/migrations/**/*.{php,py,rb,sql}',
  '**/migrate/**/*.{go,sql}',
  'prisma/migrations/**/*.sql',
  'drizzle/**/*.sql',
];

export async function scanMigrations(targetDir) {
  const files = await fg(MIGRATION_GLOBS, {
    cwd: targetDir,
    absolute: false,
    ignore: ['**/node_modules/**', '**/vendor/**'],
  });
  return files;
}

// ─── Test scanning ───────────────────────────────────────────────────────────

const TEST_GLOBS = [
  '**/tests/**/*.{php,js,ts,py,rb,go,rs}',
  '**/__tests__/**/*.{js,ts,tsx}',
  '**/*.test.{js,ts,tsx}',
  '**/*.spec.{js,ts,tsx}',
  '**/*_test.{go,py,rb}',
];

export async function scanTests(targetDir) {
  const files = await fg(TEST_GLOBS, {
    cwd: targetDir,
    absolute: false,
    ignore: ['**/node_modules/**', '**/vendor/**'],
  });
  return files;
}
