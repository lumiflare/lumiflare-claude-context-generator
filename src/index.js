/**
 * Main entry — orchestrates detection, scanning, and generation.
 */

import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { detect } from './detect.js';
import {
  scanStructure, scanRoutes, scanControllers,
  scanModels, scanConfigs, scanServices,
  scanMigrations, scanTests,
} from './scan.js';
import { generate } from './generate.js';
import { getLocale, SUPPORTED_LANGS } from './i18n/index.js';

export async function init(directory, options = {}) {
  const targetDir = resolve(directory);
  const lang = options.lang || 'ja';

  // Validate language
  if (!SUPPORTED_LANGS.includes(lang)) {
    throw new Error(`Unsupported language: "${lang}". Supported: ${SUPPORTED_LANGS.join(', ')}`);
  }
  const locale = getLocale(lang);

  console.log('');
  console.log(chalk.bold('  lumiflare-claude-context-generator'));
  console.log(chalk.gray(`  Target: ${targetDir}  |  Lang: ${lang}`));
  console.log('');

  // ── Phase 1: Detection ──────────────────────────────────────────────────

  const spinner = ora('Analyzing repository...').start();

  let stack;
  try {
    stack = await detect(targetDir);
  } catch (err) {
    spinner.fail('Stack detection failed');
    throw err;
  }

  const langDisplay = stack.hasTypeScript ? 'TypeScript' : stack.language;
  const fwDisplay = stack.framework ? ` + ${stack.framework}` : '';
  spinner.succeed(`Detected: ${chalk.cyan(langDisplay + fwDisplay)}`);

  // ── Phase 2: Scanning ───────────────────────────────────────────────────

  const scanSpinner = ora('Scanning codebase...').start();

  const [structure, routes, controllers, models, configs, services, migrations, tests] =
    await Promise.all([
      scanStructure(targetDir),
      scanRoutes(targetDir),
      scanControllers(targetDir),
      scanModels(targetDir),
      scanConfigs(targetDir),
      scanServices(targetDir),
      scanMigrations(targetDir),
      scanTests(targetDir),
    ]);

  scanSpinner.succeed(
    `Scanned: ${chalk.cyan(controllers.length)} controllers, ` +
    `${chalk.cyan(models.length)} models, ` +
    `${chalk.cyan(routes.length)} routes, ` +
    `${chalk.cyan(services.length)} services`
  );

  // ── Phase 3: Generation ─────────────────────────────────────────────────

  const analysis = {
    detect: stack,
    structure,
    routes,
    controllers,
    models,
    configs,
    services,
    migrations,
    tests,
  };

  if (options.dryRun) {
    console.log('');
    console.log(chalk.yellow('  Dry run — no files written'));
    console.log('');
    printAnalysisSummary(analysis);
    return;
  }

  const genSpinner = ora('Generating context files...').start();

  const generated = await generate(targetDir, analysis, {
    force: options.force,
    skipAgents: options.skipAgents,
    skipDocs: options.skipDocs,
    lang,
    locale,
  });

  genSpinner.succeed(`Generated ${chalk.cyan(generated.length)} files`);

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log('');
  console.log(chalk.bold('  Generated files:'));
  for (const file of generated) {
    console.log(chalk.green(`    + ${file}`));
  }

  console.log('');
  console.log(chalk.bold(`  ${locale.cli.nextSteps}`));
  console.log(chalk.gray(`    ${locale.cli.step1}`));
  console.log(chalk.gray(`    ${locale.cli.step2}`));
  console.log(chalk.gray(`    ${locale.cli.step3}`));
  console.log(chalk.gray(`    ${locale.cli.step3sub}`));
  console.log('');
}

function printAnalysisSummary(analysis) {
  const { detect: stack } = analysis;

  console.log(chalk.bold('  Analysis Summary:'));
  console.log(`    Language:        ${stack.language}`);
  console.log(`    Framework:       ${stack.framework || 'Not detected'}`);
  console.log(`    Package Manager: ${stack.packageManager || 'Not detected'}`);
  console.log(`    ORM:             ${stack.orm || 'Not detected'}`);
  console.log(`    Database:        ${stack.dbType || 'Not detected'}`);
  console.log(`    Test Framework:  ${stack.testFramework || 'Not detected'}`);
  console.log(`    TypeScript:      ${stack.hasTypeScript ? 'Yes' : 'No'}`);
  console.log(`    Docker:          ${stack.hasDocker ? 'Yes' : 'No'}`);
  console.log(`    CI/CD:           ${stack.hasCI || 'Not detected'}`);
  console.log('');
  console.log(`    Controllers:     ${analysis.controllers.length}`);
  console.log(`    Models:          ${analysis.models.length}`);
  console.log(`    Routes:          ${analysis.routes.length}`);
  console.log(`    Services:        ${analysis.services.length}`);
  console.log(`    Migrations:      ${analysis.migrations.length}`);
  console.log(`    Tests:           ${analysis.tests.length}`);
  console.log(`    Config files:    ${analysis.configs.length}`);
  console.log('');
}
