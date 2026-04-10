#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { init } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('ccg')
  .description('Auto-generate Claude Code context files for any repository')
  .version(pkg.version);

program
  .command('init')
  .description('Analyze repository and generate all Claude Code context files')
  .argument('[directory]', 'Target repository directory', '.')
  .option('-f, --force', 'Overwrite existing files without prompting', false)
  .option('-l, --lang <language>', 'Language for generated context (ja, en)', 'ja')
  .option('--skip-agents', 'Skip generating .claude/agents/', false)
  .option('--skip-docs', 'Skip generating docs/', false)
  .option('--dry-run', 'Show what would be generated without writing files', false)
  .action(async (directory, options) => {
    try {
      await init(directory, options);
    } catch (err) {
      console.error(chalk.red(`\nError: ${err.message}`));
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  });

program.parse();
