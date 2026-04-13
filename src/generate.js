/**
 * Generator — Produces all output files from analysis results.
 * All user-visible text is pulled from the locale object (i18n).
 */

import { join } from 'node:path';
import { render, readTemplate, writeFileSafe, fileExists } from './utils.js';

// ─── Main generate function ──────────────────────────────────────────────────

export async function generate(targetDir, analysis, options = {}) {
  const { detect: stack } = analysis;
  const generated = [];
  const lang = options.lang || 'ja';
  const locale = options.locale;

  const vars = buildTemplateVars(stack, analysis);

  // 1. REPOSITORY_OVERVIEW.md
  if (!options.skipDocs) {
    const overviewPath = join(targetDir, 'docs', 'REPOSITORY_OVERVIEW.md');
    if (options.force || !fileExists(overviewPath)) {
      const content = generateOverview(vars, analysis, locale);
      writeFileSafe(overviewPath, content);
      generated.push('docs/REPOSITORY_OVERVIEW.md');
    }
  }

  // 2. docs/feature/feature_list.md
  if (!options.skipDocs) {
    const featurePath = join(targetDir, 'docs', 'feature', 'feature_list.md');
    if (options.force || !fileExists(featurePath)) {
      const content = generateFeatureList(vars, analysis, locale);
      writeFileSafe(featurePath, content);
      generated.push('docs/feature/feature_list.md');
    }
  }

  // 3. docs/DOCUMENT_GUIDE.md
  if (!options.skipDocs) {
    const docGuidePath = join(targetDir, 'docs', 'DOCUMENT_GUIDE.md');
    if (options.force || !fileExists(docGuidePath)) {
      const content = generateDocGuide(vars, locale);
      writeFileSafe(docGuidePath, content);
      generated.push('docs/DOCUMENT_GUIDE.md');
    }
  }

  // 4. CLAUDE.md
  {
    const claudePath = join(targetDir, 'CLAUDE.md');
    if (options.force || !fileExists(claudePath)) {
      const content = generateClaudeMd(vars, analysis, locale);
      writeFileSafe(claudePath, content);
      generated.push('CLAUDE.md');
    }
  }

  // 5. .claude/agents/*.md
  if (!options.skipAgents) {
    const agentNames = [
      'orchestrator', 'architect', 'reviewer', 'implementer',
      'test-writer', 'bug-investigator', 'refactoring-specialist',
      'doc-generator', 'context-bootstrap',
    ];

    for (const name of agentNames) {
      const agentPath = join(targetDir, '.claude', 'agents', `${name}.md`);
      if (options.force || !fileExists(agentPath)) {
        try {
          const template = readTemplate(`agents/${name}.md`, lang);
          const content = render(template, vars);
          writeFileSafe(agentPath, content);
          generated.push(`.claude/agents/${name}.md`);
        } catch {
          // Template not found — skip silently
        }
      }
    }
  }

  return generated;
}

// ─── Template variables builder ──────────────────────────────────────────────

function buildTemplateVars(stack, analysis) {
  const { routes, controllers, models, services, migrations, tests } = analysis;

  return {
    projectName: stack.projectName,
    description: stack.description,
    language: stack.language,
    framework: stack.framework || 'N/A',
    packageManager: stack.packageManager || 'N/A',
    orm: stack.orm || 'N/A',
    dbType: stack.dbType || 'N/A',
    testFramework: stack.testFramework || 'N/A',
    hasTypeScript: stack.hasTypeScript,
    hasDocker: stack.hasDocker,
    hasCI: stack.hasCI,
    hasFramework: !!stack.framework,
    hasOrm: !!stack.orm,
    hasDb: !!stack.dbType,
    hasTests: tests.length > 0,
    routeCount: routes.length,
    controllerCount: controllers.length,
    modelCount: models.length,
    serviceCount: services.length,
    migrationCount: migrations.length,
    testCount: tests.length,
    today: new Date().toISOString().split('T')[0],
  };
}

// ─── REPOSITORY_OVERVIEW.md ──────────────────────────────────────────────────

function generateOverview(vars, analysis, locale) {
  const t = locale.overview;
  const { detect: stack, routes, controllers, models, services, configs, structure, tests } = analysis;
  const lines = [];

  lines.push(`# ${t.title(vars.projectName)}`);
  lines.push('');
  lines.push(`> ${t.disclaimer.replace('{{today}}', vars.today)}`);
  lines.push('');
  if (vars.description) { lines.push(vars.description); lines.push(''); }

  // Tech Stack
  lines.push(`## ${t.techStack}`);
  lines.push('');
  lines.push(`| ${t.item} | ${t.value} |`);
  lines.push('|---|---|');
  lines.push(`| ${t.language} | ${vars.language} |`);
  if (vars.hasFramework) lines.push(`| ${t.framework} | ${vars.framework} |`);
  if (vars.hasOrm) lines.push(`| ${t.orm} | ${vars.orm} |`);
  if (vars.hasDb) lines.push(`| ${t.database} | ${vars.dbType} |`);
  lines.push(`| ${t.packageManager} | ${vars.packageManager} |`);
  if (vars.testFramework !== 'N/A') lines.push(`| ${t.testFramework} | ${vars.testFramework} |`);
  if (vars.hasTypeScript) lines.push('| TypeScript | Yes |');
  if (vars.hasDocker) lines.push('| Docker | Yes |');
  if (vars.hasCI) lines.push(`| CI/CD | ${vars.hasCI} |`);
  lines.push('');

  if (stack.frameworks.length > 1) {
    lines.push(`### ${t.librariesAndFrameworks}`);
    lines.push('');
    for (const fw of stack.frameworks) lines.push(`- ${fw.name} (${fw.type})`);
    lines.push('');
  }

  // Directory Structure
  lines.push(`## ${t.directoryStructure}`);
  lines.push('');
  lines.push('```');
  for (const item of structure.tree.filter(i => i.type === 'dir' && i.depth <= 2)) {
    lines.push(`${'  '.repeat(item.depth)}${item.path.split('/').pop()}/`);
  }
  lines.push('```');
  lines.push('');
  lines.push(`> ${t.directoryNote}`);
  lines.push('');

  // File stats
  lines.push(`## ${t.fileStats}`);
  lines.push('');
  const topExts = Object.entries(structure.fileCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (topExts.length > 0) {
    lines.push(`| ${t.extension} | ${t.fileCount} |`);
    lines.push('|---|---|');
    for (const [ext, count] of topExts) lines.push(`| ${ext} | ${count} |`);
    lines.push('');
  }

  // Models
  if (models.length > 0) {
    lines.push(`## ${t.modelsEntities}`);
    lines.push('');
    lines.push(`| ${t.modelName} | ${t.file} |`);
    lines.push('|---|---|');
    for (const model of models) lines.push(`| ${model.name} | \`${model.file}\` |`);
    lines.push('');
  }

  // Routes
  if (routes.length > 0) {
    lines.push(`## ${t.routesEndpoints}`);
    lines.push('');
    lines.push(t.routesDetected(routes.length));
    lines.push('');
    const byFile = {};
    for (const r of routes) { if (!byFile[r.file]) byFile[r.file] = []; byFile[r.file].push(r); }
    for (const [file, fileRoutes] of Object.entries(byFile)) {
      lines.push(`### \`${file}\``);
      lines.push('');
      lines.push(`| ${t.method} | ${t.path} |`);
      lines.push('|---|---|');
      for (const r of fileRoutes.slice(0, 30)) lines.push(`| ${r.method} | \`${r.path}\` |`);
      if (fileRoutes.length > 30) lines.push(`| ... | ${t.moreRoutes(fileRoutes.length - 30)} |`);
      lines.push('');
    }
  }

  // Controllers
  if (controllers.length > 0) {
    lines.push(`## ${t.controllers}`);
    lines.push('');
    lines.push(`| ${t.controllerName} | ${t.file} | ${t.methodCount} |`);
    lines.push('|---|---|---|');
    for (const c of controllers) lines.push(`| ${c.name} | \`${c.file}\` | ${c.methods.length} |`);
    lines.push('');
  }

  // Services
  if (services.length > 0) {
    lines.push(`## ${t.servicesLogic}`);
    lines.push('');
    for (const s of services) lines.push(`- \`${s}\``);
    lines.push('');
  }

  // Configs
  if (configs.length > 0) {
    lines.push(`## ${t.configFiles}`);
    lines.push('');
    for (const c of configs) lines.push(`- \`${c}\``);
    lines.push('');
  }

  // Tests
  lines.push(`## ${t.tests}`);
  lines.push('');
  lines.push(tests.length > 0 ? t.testFileCount(tests.length) : t.noTests);
  lines.push('');

  // TODO
  lines.push(`## ${t.todoTitle}`);
  lines.push('');
  for (const item of t.todoItems) lines.push(`- [ ] ${item}`);
  lines.push('');

  return lines.join('\n');
}

// ─── feature_list.md ─────────────────────────────────────────────────────────

function generateFeatureList(vars, analysis, locale) {
  const t = locale.featureList;
  const fg = locale.featureGuess;
  const { routes, controllers, models } = analysis;
  const lines = [];

  lines.push(`# ${t.title(vars.projectName)}`);
  lines.push('');
  lines.push(`> ${t.disclaimer.replace('{{today}}', vars.today)}`);
  lines.push('');

  let sectionNum = 1;

  // Group controllers by directory
  const controllerGroups = {};
  for (const c of controllers) {
    const parts = c.file.split('/');
    const group = parts.length > 2 ? parts[parts.length - 2] : 'General';
    if (!controllerGroups[group]) controllerGroups[group] = [];
    controllerGroups[group].push(c);
  }

  if (Object.keys(controllerGroups).length > 0) {
    for (const [group, ctrls] of Object.entries(controllerGroups).sort()) {
      lines.push(`## ${sectionNum}. ${group}`);
      lines.push('');
      for (const c of ctrls) {
        const feature = guessFeature(c.name, fg);
        lines.push(`- ${c.name} — ${feature}`);
        for (const m of c.methods) {
          lines.push(`    - ${m}`);
        }
      }
      lines.push('');
      sectionNum++;
    }
  }

  // Route-based feature map
  if (controllers.length === 0 && routes.length > 0) {
    const routeGroups = {};
    for (const r of routes) {
      const prefix = r.path.split('/').filter(Boolean)[0] || 'root';
      if (!routeGroups[prefix]) routeGroups[prefix] = [];
      routeGroups[prefix].push(r);
    }
    for (const [prefix, rts] of Object.entries(routeGroups).sort()) {
      const feature = guessFeature(prefix, fg);
      lines.push(`## ${sectionNum}. ${feature} (/${prefix})`);
      lines.push('');
      for (const r of rts.slice(0, 20)) {
        lines.push(`- ${r.method} \`${r.path}\``);
      }
      if (rts.length > 20) lines.push(`- ... (${rts.length - 20} more)`);
      lines.push('');
      sectionNum++;
    }
  }

  // Models
  if (models.length > 0) {
    lines.push(`## ${t.modelDomainMap}`);
    lines.push('');
    for (const m of models) {
      lines.push(`- ${m.name} — ${guessFeature(m.name, fg)} (\`${m.file}\`)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function guessFeature(name, featureGuess) {
  const lower = name.toLowerCase();
  for (const [key, label] of Object.entries(featureGuess)) {
    if (key === 'fallback') continue;
    if (lower.includes(key)) return label;
  }
  return featureGuess.fallback;
}

// ─── CLAUDE.md ───────────────────────────────────────────────────────────────

function generateClaudeMd(vars, analysis, locale) {
  const t = locale.claudeMd;
  const lines = [];

  lines.push('# CLAUDE.md');
  lines.push('');
  lines.push(t.header);
  lines.push('');

  // Document loading rules
  lines.push(`## ${t.docLoadingRules}`);
  lines.push('');
  lines.push(t.docLoadingNote);
  lines.push('');
  lines.push(`| ${t.trigger} | ${t.document} |`);
  lines.push('|---|---|');
  lines.push(`| ${t.triggerDesign} | ${t.docDesign} |`);
  lines.push(`| ${t.triggerImpl} | ${t.docImpl} |`);
  lines.push('');

  // Required rules
  lines.push(`## ${t.requiredRules}`);
  lines.push('');
  lines.push(`- ${t.ruleAgentSelection}`);
  lines.push(`- ${t.ruleTeamSize}`);

  if (vars.hasDb) lines.push(`- ${t.ruleDbConnection(vars.dbType)}`);
  if (vars.hasOrm) lines.push(`- ${t.ruleOrm(vars.orm)}`);
  if (vars.framework === 'Laravel') {
    lines.push(`- ${t.ruleLaravelTransaction}`);
    lines.push(`- ${t.ruleLaravelCsrf}`);
  }
  if (vars.framework === 'Next.js' || vars.framework === 'React') {
    lines.push(`- ${t.ruleReactComponents}`);
  }

  lines.push(`- ${t.ruleCodeFirst}`);
  lines.push(`- ${t.ruleLang}`);
  lines.push(`- ${t.rulePackage}`);
  lines.push(`- ${t.ruleBusinessLogic}`);
  lines.push('');

  return lines.join('\n');
}

// ─── DOCUMENT_GUIDE.md ───────────────────────────────────────────────────────

function generateDocGuide(vars, locale) {
  const t = locale.docGuide;
  const s = t.templateSections;

  const lines = [];
  lines.push(`# ${t.title}`);
  lines.push('');
  lines.push(`## ${t.purpose}`);
  lines.push('');

  lines.push(`## ${t.structureTitle}`);
  lines.push('');
  lines.push('```');
  lines.push('docs/');
  lines.push('  REPOSITORY_OVERVIEW.md');
  lines.push('  DOCUMENT_GUIDE.md');
  lines.push('  feature/');
  lines.push('    feature_list.md');
  lines.push('    [feature_name].md');
  lines.push('```');
  lines.push('');

  lines.push(`## ${t.templateTitle}`);
  lines.push('');
  lines.push('```markdown');
  lines.push(`# ${s.featureName}`);
  lines.push('');
  lines.push(`## ${s.overview}`);
  lines.push(`- ${s.overviewItems}`);
  lines.push('');
  lines.push(`## ${s.scope}`);
  lines.push(`- ${s.scopeItems}`);
  lines.push('');
  lines.push(`## ${s.spec}`);
  lines.push(`- ${s.specItems}`);
  lines.push('');
  lines.push(`## ${s.businessRules}`);
  lines.push(`- ${s.businessRulesItems}`);
  lines.push('');
  lines.push(`## ${s.dataSpec}`);
  lines.push(`- ${s.dataSpecItems}`);
  lines.push('');
  lines.push(`## ${s.impact}`);
  lines.push(`- ${s.impactItems}`);
  lines.push('');
  lines.push(`## ${s.testPoints}`);
  lines.push(`- ${s.testPointsItems}`);
  lines.push('```');
  lines.push('');

  lines.push(`## ${t.rulesTitle}`);
  lines.push('');
  for (let i = 0; i < t.rules.length; i++) {
    lines.push(`${i + 1}. ${t.rules[i]}`);
  }
  lines.push('');

  return lines.join('\n');
}
