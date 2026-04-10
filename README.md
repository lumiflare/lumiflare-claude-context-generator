# lumiflare-claude-context-generator

Any repository → Claude Code context files in seconds.

Auto-generate `REPOSITORY_OVERVIEW.md`, `feature_list.md`, `CLAUDE.md`, and agent definitions for [Claude Code](https://claude.ai/code).

## Features

- **Framework-agnostic** — Detects PHP/Laravel, JS/TS/Next.js, Python/Django, Go/Gin, Ruby/Rails, Rust/Axum, and more
- **Static analysis** — Scans directory structure, routes, controllers, models, services, configs
- **Agent team scaffolding** — Generates 9 specialized agent definitions (architect, reviewer, implementer, etc.)
- **Hybrid approach** — CLI generates 80% from static analysis, then `context-bootstrap` agent refines with Claude's intelligence

## Quick Start

```bash
# Run directly with npx
npx lumiflare-claude-context-generator init

# Or install globally
npm install -g lumiflare-claude-context-generator
ccg init
```

## What It Generates

```
project/
  CLAUDE.md                              ← Claude Code instructions (adapted to your stack)
  docs/
    REPOSITORY_OVERVIEW.md               ← Architecture, tech stack, directory structure
    DOCUMENT_GUIDE.md                    ← Documentation standards
    feature/
      feature_list.md                    ← Feature map from controllers/routes/models
  .claude/
    agents/
      orchestrator.md                    ← Team workflow coordinator
      architect.md                       ← Design agent
      reviewer.md                        ← Code review agent
      implementer.md                     ← Implementation agent
      test-writer.md                     ← Test generation agent
      bug-investigator.md               ← Bug investigation agent
      refactoring-specialist.md          ← Refactoring agent
      doc-generator.md                   ← Documentation agent
      context-bootstrap.md               ← Deep analysis agent (refines CLI output)
```

## Usage

### Basic

```bash
# Analyze current directory (default: Japanese)
ccg init

# Generate in English
ccg init --lang en

# Analyze a specific directory
ccg init /path/to/project

# Preview without writing files
ccg init --dry-run

# Overwrite existing files
ccg init --force
```

### Options

| Option | Description |
|---|---|
| `-l, --lang <language>` | Language for generated context: `ja` (default), `en` |
| `-f, --force` | Overwrite existing files |
| `--skip-agents` | Skip generating `.claude/agents/` |
| `--skip-docs` | Skip generating `docs/` |
| `--dry-run` | Show analysis without writing files |

## Two-Phase Workflow

### Phase 1: CLI Static Analysis (automatic)

The CLI detects your tech stack and scans the codebase:

```
✔ Detected: TypeScript + Next.js
✔ Scanned: 24 controllers, 18 models, 67 routes, 12 services
✔ Generated 13 files
```

### Phase 2: Claude Deep Analysis (manual)

Open Claude Code in your project and say:

```
コンテキストを詳細化して
```

The `context-bootstrap` agent will:
1. Read your actual source code deeply
2. Refine `REPOSITORY_OVERVIEW.md` with architecture insights
3. Enhance `feature_list.md` with business logic details
4. Adapt `CLAUDE.md` rules to your project's conventions
5. Customize agent definitions for your stack

## Detection Support

| Language | Frameworks | ORM | Test |
|---|---|---|---|
| PHP | Laravel, Symfony, CakePHP, Slim | Eloquent, Doctrine | PHPUnit, Pest |
| JavaScript/TypeScript | Next.js, Nuxt, Express, Fastify, NestJS, Hono | Prisma, TypeORM, Sequelize, Drizzle, Mongoose | Jest, Vitest, Mocha, Playwright, Cypress |
| Python | Django, Flask, FastAPI | Django ORM, SQLAlchemy | pytest |
| Ruby | Rails, Sinatra | ActiveRecord | RSpec, Minitest |
| Go | Gin, Echo, Fiber | GORM | (built-in) |
| Rust | Actix Web, Rocket, Axum | Diesel, SeaORM | (built-in) |
| Java/Kotlin | (detected from manifest) | — | — |

## License

MIT
