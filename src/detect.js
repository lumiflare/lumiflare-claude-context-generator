/**
 * Stack Detector — Framework-agnostic detection of language, framework, DB, ORM, test tools.
 * Detects from manifest files (composer.json, package.json, go.mod, etc.) and marker files.
 */

import { join } from 'node:path';
import { readJsonSafe, readTextSafe, fileExists } from './utils.js';

// ─── Manifest → Language mapping ─────────────────────────────────────────────

const MANIFEST_MAP = [
  { file: 'composer.json',     language: 'PHP',           packageManager: 'composer' },
  { file: 'package.json',      language: 'JavaScript',    packageManager: 'npm' },
  { file: 'go.mod',            language: 'Go',            packageManager: 'go mod' },
  { file: 'Cargo.toml',        language: 'Rust',          packageManager: 'cargo' },
  { file: 'pyproject.toml',    language: 'Python',        packageManager: 'pip' },
  { file: 'requirements.txt',  language: 'Python',        packageManager: 'pip' },
  { file: 'Pipfile',           language: 'Python',        packageManager: 'pipenv' },
  { file: 'Gemfile',           language: 'Ruby',          packageManager: 'bundler' },
  { file: 'pom.xml',           language: 'Java',          packageManager: 'maven' },
  { file: 'build.gradle',      language: 'Java',          packageManager: 'gradle' },
  { file: 'build.gradle.kts',  language: 'Kotlin',        packageManager: 'gradle' },
];

// ─── Dependency → Framework mapping ──────────────────────────────────────────

const FRAMEWORK_DEPS = {
  // PHP
  'laravel/framework':        { name: 'Laravel',      type: 'fullstack' },
  'symfony/framework-bundle':  { name: 'Symfony',      type: 'fullstack' },
  'cakephp/cakephp':          { name: 'CakePHP',      type: 'fullstack' },
  'slim/slim':                { name: 'Slim',          type: 'backend' },
  // JavaScript / TypeScript
  'next':                     { name: 'Next.js',       type: 'fullstack' },
  'nuxt':                     { name: 'Nuxt',          type: 'fullstack' },
  'express':                  { name: 'Express',       type: 'backend' },
  'fastify':                  { name: 'Fastify',       type: 'backend' },
  'hono':                     { name: 'Hono',          type: 'backend' },
  'nest':                     { name: 'NestJS',        type: 'backend' },
  '@nestjs/core':             { name: 'NestJS',        type: 'backend' },
  'react':                    { name: 'React',         type: 'frontend' },
  'vue':                      { name: 'Vue.js',        type: 'frontend' },
  '@angular/core':            { name: 'Angular',       type: 'frontend' },
  'svelte':                   { name: 'Svelte',        type: 'frontend' },
  // Python
  'django':                   { name: 'Django',        type: 'fullstack' },
  'flask':                    { name: 'Flask',         type: 'backend' },
  'fastapi':                  { name: 'FastAPI',       type: 'backend' },
  'starlette':                { name: 'Starlette',     type: 'backend' },
  // Ruby
  'rails':                    { name: 'Rails',         type: 'fullstack' },
  'sinatra':                  { name: 'Sinatra',       type: 'backend' },
  // Go (from go.mod require)
  'github.com/gin-gonic/gin':    { name: 'Gin',        type: 'backend' },
  'github.com/labstack/echo':    { name: 'Echo',       type: 'backend' },
  'github.com/gofiber/fiber':    { name: 'Fiber',      type: 'backend' },
  // Rust (from Cargo.toml)
  'actix-web':                { name: 'Actix Web',     type: 'backend' },
  'rocket':                   { name: 'Rocket',        type: 'backend' },
  'axum':                     { name: 'Axum',          type: 'backend' },
};

// ─── Dependency → ORM mapping ────────────────────────────────────────────────

const ORM_DEPS = {
  'laravel/framework': 'Eloquent',
  'doctrine/orm': 'Doctrine',
  'prisma': 'Prisma',
  '@prisma/client': 'Prisma',
  'typeorm': 'TypeORM',
  'sequelize': 'Sequelize',
  'drizzle-orm': 'Drizzle',
  'mongoose': 'Mongoose',
  'django': 'Django ORM',
  'sqlalchemy': 'SQLAlchemy',
  'activerecord': 'ActiveRecord',
  'gorm.io/gorm': 'GORM',
  'diesel': 'Diesel',
  'sea-orm': 'SeaORM',
};

// ─── Dependency → Test framework mapping ─────────────────────────────────────

const TEST_DEPS = {
  'phpunit/phpunit': 'PHPUnit',
  'pestphp/pest': 'Pest',
  'jest': 'Jest',
  'vitest': 'Vitest',
  'mocha': 'Mocha',
  '@playwright/test': 'Playwright',
  'cypress': 'Cypress',
  'pytest': 'pytest',
  'unittest': 'unittest',
  'rspec': 'RSpec',
  'minitest': 'Minitest',
};

// ─── Marker file → DB type mapping ──────────────────────────────────────────

const DB_MARKERS = [
  { deps: ['mysql2', 'mysqli', 'mysql'],        db: 'MySQL' },
  { deps: ['pg', 'psycopg2', 'pgsql'],          db: 'PostgreSQL' },
  { deps: ['better-sqlite3', 'sqlite3'],         db: 'SQLite' },
  { deps: ['mongodb', 'mongoose', 'pymongo'],    db: 'MongoDB' },
  { deps: ['redis', 'ioredis', 'predis/predis'], db: 'Redis' },
];

// ─── Main detect function ────────────────────────────────────────────────────

export async function detect(targetDir) {
  const result = {
    projectName: '',
    description: '',
    language: 'Unknown',
    languages: [],
    framework: null,
    frameworks: [],
    packageManager: null,
    orm: null,
    dbType: null,
    dbConnections: [],
    testFramework: null,
    hasTypeScript: false,
    hasDocker: false,
    hasCI: null,
    manifest: null,
    version: null,
  };

  // Detect from manifest files
  for (const { file, language, packageManager } of MANIFEST_MAP) {
    if (fileExists(join(targetDir, file))) {
      result.languages.push(language);
      if (!result.packageManager) {
        result.language = language;
        result.packageManager = packageManager;
      }
    }
  }

  // TypeScript check
  if (fileExists(join(targetDir, 'tsconfig.json'))) {
    result.hasTypeScript = true;
    if (result.language === 'JavaScript') result.language = 'TypeScript';
  }

  // Docker check
  result.hasDocker = fileExists(join(targetDir, 'Dockerfile')) ||
                     fileExists(join(targetDir, 'docker-compose.yml')) ||
                     fileExists(join(targetDir, 'docker-compose.yaml'));

  // CI check
  if (fileExists(join(targetDir, '.github/workflows'))) result.hasCI = 'GitHub Actions';
  else if (fileExists(join(targetDir, '.gitlab-ci.yml'))) result.hasCI = 'GitLab CI';
  else if (fileExists(join(targetDir, 'Jenkinsfile'))) result.hasCI = 'Jenkins';
  else if (fileExists(join(targetDir, '.circleci'))) result.hasCI = 'CircleCI';

  // Parse dependencies from manifest files
  const allDeps = collectDependencies(targetDir, result.language);

  // Detect framework
  for (const [dep, info] of Object.entries(FRAMEWORK_DEPS)) {
    if (allDeps.has(dep)) {
      result.frameworks.push(info);
      if (!result.framework) result.framework = info.name;
    }
  }

  // Detect ORM
  for (const [dep, orm] of Object.entries(ORM_DEPS)) {
    if (allDeps.has(dep)) { result.orm = orm; break; }
  }

  // Detect test framework
  for (const [dep, tf] of Object.entries(TEST_DEPS)) {
    if (allDeps.has(dep)) { result.testFramework = tf; break; }
  }

  // Detect DB type
  for (const { deps, db } of DB_MARKERS) {
    if (deps.some(d => allDeps.has(d))) {
      result.dbType = db;
      break;
    }
  }

  // Try to detect DB from .env
  if (!result.dbType) {
    result.dbType = detectDbFromEnv(targetDir);
  }

  // Project name and description from manifest
  const manifestInfo = readProjectManifest(targetDir, result.language);
  result.projectName = manifestInfo.name || guessProjectName(targetDir);
  result.description = manifestInfo.description || '';
  result.version = manifestInfo.version || null;
  result.manifest = manifestInfo;

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function collectDependencies(targetDir, language) {
  const deps = new Set();

  // PHP: composer.json
  const composer = readJsonSafe(join(targetDir, 'composer.json'));
  if (composer) {
    for (const key of Object.keys(composer.require || {})) deps.add(key);
    for (const key of Object.keys(composer['require-dev'] || {})) deps.add(key);
  }

  // JavaScript/TypeScript: package.json
  const pkg = readJsonSafe(join(targetDir, 'package.json'));
  if (pkg) {
    for (const key of Object.keys(pkg.dependencies || {})) deps.add(key);
    for (const key of Object.keys(pkg.devDependencies || {})) deps.add(key);
    for (const key of Object.keys(pkg.peerDependencies || {})) deps.add(key);
  }

  // Go: go.mod
  const gomod = readTextSafe(join(targetDir, 'go.mod'));
  if (gomod) {
    const requireBlock = gomod.match(/require\s*\(([\s\S]*?)\)/);
    if (requireBlock) {
      for (const line of requireBlock[1].split('\n')) {
        const match = line.trim().match(/^([\w./-]+)/);
        if (match) deps.add(match[1]);
      }
    }
    // Single-line requires
    for (const match of gomod.matchAll(/require\s+([\w./-]+)/g)) {
      deps.add(match[1]);
    }
  }

  // Python: requirements.txt
  const requirements = readTextSafe(join(targetDir, 'requirements.txt'));
  if (requirements) {
    for (const line of requirements.split('\n')) {
      const match = line.trim().match(/^([\w-]+)/);
      if (match && !line.startsWith('#')) deps.add(match[1].toLowerCase());
    }
  }

  // Python: pyproject.toml (simple parsing)
  const pyproject = readTextSafe(join(targetDir, 'pyproject.toml'));
  if (pyproject) {
    const depsBlock = pyproject.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depsBlock) {
      for (const match of depsBlock[1].matchAll(/"([\w-]+)/g)) {
        deps.add(match[1].toLowerCase());
      }
    }
  }

  // Ruby: Gemfile (simple parsing)
  const gemfile = readTextSafe(join(targetDir, 'Gemfile'));
  if (gemfile) {
    for (const match of gemfile.matchAll(/gem\s+['"](\w[\w-]*)['"]/g)) {
      deps.add(match[1]);
    }
  }

  // Rust: Cargo.toml (simple parsing)
  const cargo = readTextSafe(join(targetDir, 'Cargo.toml'));
  if (cargo) {
    const depsSection = cargo.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
    if (depsSection) {
      for (const line of depsSection[1].split('\n')) {
        const match = line.trim().match(/^([\w-]+)\s*=/);
        if (match) deps.add(match[1]);
      }
    }
  }

  return deps;
}

function detectDbFromEnv(targetDir) {
  const env = readTextSafe(join(targetDir, '.env')) ||
              readTextSafe(join(targetDir, '.env.example'));
  if (!env) return null;

  if (/DB_CONNECTION\s*=\s*mysql/i.test(env) || /DATABASE_URL.*mysql/i.test(env)) return 'MySQL';
  if (/DB_CONNECTION\s*=\s*pgsql/i.test(env) || /DATABASE_URL.*postgres/i.test(env)) return 'PostgreSQL';
  if (/DB_CONNECTION\s*=\s*sqlite/i.test(env)) return 'SQLite';
  if (/MONGO/i.test(env)) return 'MongoDB';
  return null;
}

function readProjectManifest(targetDir, language) {
  // composer.json
  const composer = readJsonSafe(join(targetDir, 'composer.json'));
  if (composer) {
    return {
      name: composer.name?.split('/').pop() || '',
      description: composer.description || '',
      version: composer.version || null,
    };
  }
  // package.json
  const pkg = readJsonSafe(join(targetDir, 'package.json'));
  if (pkg) {
    return {
      name: pkg.name || '',
      description: pkg.description || '',
      version: pkg.version || null,
    };
  }
  // go.mod
  const gomod = readTextSafe(join(targetDir, 'go.mod'));
  if (gomod) {
    const match = gomod.match(/module\s+([\w./-]+)/);
    return {
      name: match ? match[1].split('/').pop() : '',
      description: '',
      version: null,
    };
  }
  // Cargo.toml
  const cargo = readTextSafe(join(targetDir, 'Cargo.toml'));
  if (cargo) {
    const nameMatch = cargo.match(/name\s*=\s*"([^"]+)"/);
    const descMatch = cargo.match(/description\s*=\s*"([^"]+)"/);
    const verMatch = cargo.match(/version\s*=\s*"([^"]+)"/);
    return {
      name: nameMatch?.[1] || '',
      description: descMatch?.[1] || '',
      version: verMatch?.[1] || null,
    };
  }
  return { name: '', description: '', version: null };
}

function guessProjectName(targetDir) {
  return targetDir.split('/').filter(Boolean).pop() || 'project';
}
