# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Specy is a DDD toolkit that captures business knowledge in structured DSL files (`.domain`, `.prd`, `.sysreq`). This repo contains the AI skill definitions, packaged as a single Claude Code **plugin** named `specy`. The 7 skills (invoked as `specy:<name>`) are: 6 core — `prd-design`, `sysreq-design`, `sysreq-extract-from-code`, `domain-design`, `domain-build-code`, `domain-extract-from-code` — plus 1 auxiliary — `domain-dialogue`. Skills are assembled from modular templates into self-contained `dist/skills/<name>/SKILL.md` files.

## Build Commands

```bash
# Build all skills (assembles src/skills/ templates → dist/)
./src/skills/build.sh

# Build a single skill
./src/skills/build.sh domain-extract-from-code

# Build tree-sitter parsers + run smoke tests against examples/
./src/tree-sitters/build.sh    # requires: tree-sitter CLI

# Install the `specy` plugin (symlinks dist/ → ~/.claude/skills/specy)
./install-skills-for-user.sh
```

## Architecture

### Template Assembly System

Skills are assembled by `src/skills/build.sh` from modular templates:

1. Each skill has a `src/skills/{skill}/main.md` template
2. Templates use include markers that the build script resolves:
   - `<!-- include: path -->` — inlines file content as-is
   - `<!-- include-code: lang path -->` — wraps in a fenced code block
3. Include paths resolve first relative to the skill directory, then fall back to `src/skills/`
4. Output goes to `dist/skills/{skill}/SKILL.md`

The build assembles the `specy` plugin into `dist/`: `dist/.claude-plugin/plugin.json` plus a
`dist/skills/{skill}/` directory per skill. It also copies **runtime files** (heuristics, grammars,
metamodel references) **inside each skill's dir** — loaded on demand by skill agents, not inlined into
SKILL.md (a plugin can't reference files outside its own directory).

### Source of Truth

- **Domain grammar**: `src/grammars/domain.ebnf` is the single canonical grammar. It gets copied to `dist/skills/domain-extract-from-code/grammars/` (and the other domain skills) by the build script.
- **Metamodels**: `src/metamodels/DOMAIN-METAMODEL.md` documents the v3 domain metamodel concepts and constraints.
- **Skill templates**: `src/skills/{skill}/main.md` — always edit here, never in `dist/`.

### Key Distinction: src/ vs dist/

- `src/` = human-edited source (templates, fragments, grammars, metamodels, tree-sitters)
- `dist/` = generated output (assembled SKILL.md + copied runtime files) — **never edit directly**

### Skill Source Layout

```
src/skills/{skill}/
├── main.md              # Template with <!-- include: --> markers
├── constructs/          # Reusable reference fragments (included at build time)
└── heuristics/          # Stack-specific extraction patterns (copied as runtime files)
```

Shared resources live at the `src/skills/` level (e.g., `src/skills/grammars/` for v1 grammars).

### Specy v3 Domain DSL

The current domain DSL (v3) uses a hierarchical structure:
```
organization > context (with context map) > module > entities/aggregates/values/...
```

Key v3 constructs: entity (with `identity`, `duplicate detection`, `states { machine }`), aggregate, value, command, query, event, external/error/temporal events, three service types (domain/application/infrastructure), reaction (reactive rule: `triggered-by` event / `effects` command), invariant (with enforcement), precondition/postcondition on operations, agreement/reconciliation, interface.

## Development Workflow

1. Edit templates and fragments in `src/skills/`
2. Run `./src/skills/build.sh` to regenerate `dist/`
3. The pre-commit hook (`hooks/pre-commit`) blocks commits if `dist/` is out of sync with `src/`

Setup hooks after clone: `git config core.hooksPath hooks/`

## Tree-Sitter Parsers

Three parsers in `src/tree-sitters/`: specy-domain, specy-prd, specy-sysreq. `src/tree-sitters/build.sh` generates, builds, and smoke-tests them against files in `examples/`.

## Examples

`examples/` contains complete Specy projects (business-loan, url-shortener, uber, ecommerce) used both as documentation and as tree-sitter smoke test inputs.

## DSL Conventions

- Type names: `PascalCase`. Field names and enum values: `camelCase` (convert UPPER_SNAKE_CASE from source)
- Operation labels: string literals in business language, not identifiers
- Every definition must have a `// source: path/to/file.ext` comment for traceability
- `// UNCLEAR:` — grammar genuinely cannot express the condition (business-critical)
- `// NOTE:` — infrastructure concern omitted or gap flagged

## Design Review Panels

- `TEAM.md` — 7-panellist review for language/grammar/skill changes (Simplicity, DDD Fidelity, Readability, Machine Reasoning, Cross-File Coherence, Skill Experience, Provocateur)
- `UX_TEAM.md` — 6-panellist review for interface/visualization changes
- Both follow: Present → Respond → Rebut → Synthesise → Verdict

## Grammar Gaps

Known limitations are tracked in `proposals/grammar-gaps-backlog.md` with severity levels (critical/high/medium/low). When distill produces `// UNCLEAR` markers that represent genuine grammar limitations, they should be added to this backlog with occurrence counts.

## Analyzing Specy Artifacts

When the user asks to analyze Specy artifacts (`.prd`, `.domain`, `.sysreq`, `gaps.report`, `.meta.json`):

1. **Read all files** in the target `specy/` directory
2. **Produce the analysis** — cover: extraction statistics, model quality (well-modeled parts, suspicious types, missing fields), UNCLEAR markers, unresolved dot-paths, and actionable recommendations
3. **Update the gaps backlog** — for each new grammar gap or modeling issue found, append a `GAP-0xx` entry to `proposals/grammar-gaps-backlog.md` following the existing format (severity, desired syntax, occurrences table, discussion). Also update the Summary table, the priority order, the Panel Resolution Monitor table (add the project row and update totals), and the coverage-by-pattern-family table if new pattern families are identified

