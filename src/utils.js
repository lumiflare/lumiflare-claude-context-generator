import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const TEMPLATES_DIR = join(__dirname, '..', 'templates');

/**
 * Simple template renderer.
 * Replaces {{variable}} placeholders and handles {{#if var}}...{{/if}} blocks.
 */
export function render(template, vars = {}) {
  // Handle {{#if key}}content{{/if}} blocks
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key, content) => (vars[key] ? content : '')
  );
  // Handle {{#unless key}}content{{/unless}} blocks
  result = result.replace(
    /\{\{#unless (\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (_match, key, content) => (!vars[key] ? content : '')
  );
  // Replace {{variable}} placeholders
  result = result.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key) => (vars[key] !== undefined ? String(vars[key]) : '')
  );
  return result;
}

/**
 * Write file, creating directories as needed.
 */
export function writeFileSafe(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Read a template file from the templates directory.
 * For agent templates, resolves language-specific path: agents/{lang}/{name}.md
 */
export function readTemplate(relativePath, lang = 'ja') {
  // If path starts with agents/, inject language subdirectory
  if (relativePath.startsWith('agents/') && !relativePath.startsWith(`agents/${lang}/`)) {
    const fileName = relativePath.replace('agents/', '');
    const langPath = join(TEMPLATES_DIR, 'agents', lang, fileName);
    if (existsSync(langPath)) {
      return readFileSync(langPath, 'utf-8');
    }
    // Fallback: try root-level template (legacy compat)
  }
  return readFileSync(join(TEMPLATES_DIR, relativePath), 'utf-8');
}

/**
 * Check if a file exists at the given path.
 */
export function fileExists(filePath) {
  return existsSync(filePath);
}

/**
 * Try to read a JSON file. Returns null on failure.
 */
export function readJsonSafe(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Try to read a text file. Returns null on failure.
 */
export function readTextSafe(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
