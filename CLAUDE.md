# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Specy is a DDD toolkit that captures business knowledge in structured DSL files (`.prd`, `.sysreq`, `.domain`, `.arch`, `.synth`). This repo contains the AI skill definitions, packaged as a single Claude Code **plugin** named `specy`. The 14 skills (invoked as `specy:<name>`) are: 7 core — `prd-design`, `sysreq-design`, `sysreq-extract-from-code`, `domain-design`, `domain-build-code`, `domain-extract-from-code`, `domain-refactor` — 3 architecture — `architecture-design`, `architecture-extract-from-code`, `architecture-build-code` — 2 synthetic data — `synth-design`, `domain-build-fixtures` — plus 2 auxiliary — `domain-dialogue` and `model-formats` (convert any model between DSL, JSON, YAML and Markdown). Skills are assembled from modular templates into self-contained `dist/skills/<name>/SKILL.md` files.

The languages themselves — the metamodels in prose, the EBNF grammars, the JSON Schemas, the Langium parsers with the `specy` CLI, the tree-sitter grammars and the example corpus — live in the sibling repository [metamodels](https://github.com/specy-ai/metamodels), expected at `../metamodels` (override with `SPECY_METAMODELS`). The build copies what each skill needs from there into `dist/`, so the published plugin stays self-contained. The other Specy repositories are [app](https://github.com/specy-ai/app) (the navigator of a model instance), [website](https://github.com/specy-ai/website) (specy.ai), [synthy](https://github.com/specy-ai/synthy) (synthetic data) and [diagram-engine](https://github.com/specy-ai/diagram-engine); all are checked out next to each other.

## Build Commands

```bash
# Build all skills (assembles src/skills/ templates → dist/; copies grammars, metamodels,
# schemas and examples from ../metamodels into each skill)
./src/skills/build.sh

# Build a single skill
./src/skills/build.sh domain-extract-from-code

# Install the `specy` plugin (symlinks dist/ → ~/.claude/skills/specy)
./install-skills-for-user.sh

# Parsers, the specy CLI and the examples live in ../metamodels
../metamodels/specy.sh validate ../metamodels/examples/url-shortener/url-shortener.prd
../metamodels/src/langium/specy-domain/build.sh
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
`dist/skills/{skill}/` directory per skill. It also copies **runtime files** (heuristics from this repo;
grammars, metamodel references, schemas and example files from `../metamodels`) **inside each skill's
dir** — loaded on demand by skill agents, not inlined into SKILL.md (a plugin can't reference files
outside its own directory). `METAMODELS_DIR` at the top of the script is the one place that knows where
the metamodels checkout is.

### Source of Truth

- **Skill templates**: `src/skills/{skill}/main.md` — always edit here, never in `dist/`.
- **Grammars, metamodels, schemas, examples**: owned by `../metamodels` (`src/grammars/*.ebnf`, `src/metamodels/*.md`, `src/schemas/*.schema.json`, `examples/`). Never edit the copies under `dist/`; change the source there, rebuild here and commit the regenerated `dist/`. The rules that matter from this side: a grammar change comes with its EBNF, its Langium and tree-sitter grammars and the metamodel prose; the metamodel headings are stable anchors (the website links to them); the JSON of `.domain` and `.synth` is consumed by synthy, so schema changes are additive.
- **Synthetic-data skills**: `synth-design` and `domain-build-fixtures` drive synthy (`../synthy`, npm `specy-synthy`) through its CLI or its MCP server (`synthy mcp`) and never write rows themselves. The certificate harnesses in `src/skills/domain-build-fixtures/heuristics/` (JUnit, vitest, clojure.test; dbt needs none) were run against synthy's exports: keep them in step with synthy's `load.sql` and `questions.json` formats. The worked example and the phrasebook of `synth-design` are checked against `../metamodels/examples/ecommerce/v2/orders.domain`; re-check them when the language changes.

### Key Distinction: src/ vs dist/

- `src/skills/` = human-edited source (templates, fragments, heuristics)
- `dist/` = generated output (assembled SKILL.md + copied runtime files) — **never edit directly**

### Skill Source Layout

```
src/skills/{skill}/
├── main.md              # Template with <!-- include: --> markers
├── constructs/          # Reusable reference fragments (included at build time)
└── heuristics/          # Stack-specific extraction patterns (copied as runtime files)
```

Shared resources live at the `src/skills/` level (e.g., `src/skills/grammars/` for v1 grammars, `src/skills/plugin/plugin.json` for the plugin manifest).

### Specy v3 Domain DSL

The current domain DSL (v3) uses a hierarchical structure:
```
organization > context (with context map) > module > entities/aggregates/values/...
```

Key v3 constructs: entity (with `identity`, `duplicate detection`, `states { machine }`), aggregate, value, command, query, event, external/error/temporal events, three service types (domain/application/infrastructure), reaction (reactive rule: `triggered-by` event / `effects` command), invariant (with enforcement), precondition/postcondition on operations, agreement/reconciliation, interface.

A context map entry is written by a context about itself: inside `X`, `downstream Y : ACL` means X is downstream of Y and protects itself with an ACL.

### Specy Software Architecture DSL (`.arch`)

A `.arch` file has one of two roots:
```
architecture  > system (one, in focus) > container > component     // C4 levels 1–3, Thrift-typed contracts, ports, connectors, channels, deployment
organization  > area / phase / person / externalSystem / system / dependency > flow   // level 0: the system landscape
```

Level 0: a `system` states its purpose (`::`), product (`technology`), `area`, `used-by`, the concepts it `masters` (source of truth) and `handles`, and its `hotspot`s. `dependency A -> B` reads "A depends on B" — the direction of the need, not of the call — with context-map patterns (`CS | Conformist | ACL` downstream, `OHS` upstream, `SharedKernel | PublishedLanguage | Partnership` both; `Partnership` is written on both dependencies of a mutual pair) and a `criticality`. A `flow` carries numbered domain concepts (`carries X as Y`, `to` when data goes to the upstream side) with a mechanism `over "…" manual | automated`, once or per `phase`. Concept names resolve against the `domain-source`(s) (`Context.Concept` when ambiguous; `// NOTE:` acknowledges a name with no domain element yet). The worked example is `../metamodels/examples/retail-media/`; the Specy app (`../app`) renders both roots.

## Development Workflow

1. Edit templates and fragments in `src/skills/`
2. Run `./src/skills/build.sh` to regenerate `dist/`
3. The pre-commit hook (`hooks/pre-commit`) blocks commits if `dist/` is out of sync with `src/`
4. After a grammar, metamodel, schema or example change in `../metamodels`, rebuild here too and commit the regenerated `dist/`

Setup hooks after clone: `git config core.hooksPath hooks/`

## DSL Conventions

- Type names: `PascalCase`. Field names and enum values: `camelCase` (convert UPPER_SNAKE_CASE from source)
- Operation labels: string literals in business language, not identifiers
- Every definition must have a `// source: path/to/file.ext` comment for traceability
- `// UNCLEAR:` — grammar genuinely cannot express the condition (business-critical)
- `// NOTE:` — infrastructure concern omitted or gap flagged; at `.arch` level 0 it also acknowledges a concept name that has no domain element yet

## Design Review Panels

The panels live in `../metamodels`: `CORE_TEAM.md` (7-panellist review for language/grammar/skill changes — Simplicity, DDD Fidelity, Readability, Machine Reasoning, Cross-File Coherence, Skill Experience, Provocateur) and `VISION_TEAM.md` (vision brainstorm), with the `/review` and `/vision` commands that apply them. Both follow: Present → Respond → Rebut → Synthesise → Verdict. A skill change that touches how a construct is produced or read goes through the core panel too.

## Grammar Gaps

Known limitations are tracked in `proposals/grammar-gaps-backlog.md` with severity levels (critical/high/medium/low). When distill produces `// UNCLEAR` markers that represent genuine grammar limitations, they should be added to this backlog with occurrence counts.

## Analyzing Specy Artifacts

When the user asks to analyze Specy artifacts (`.prd`, `.domain`, `.sysreq`, `gaps.report`, `.meta.json`):

1. **Read all files** in the target `specy/` directory
2. **Produce the analysis** — cover: extraction statistics, model quality (well-modeled parts, suspicious types, missing fields), UNCLEAR markers, unresolved dot-paths, and actionable recommendations
3. **Update the gaps backlog** — for each new grammar gap or modeling issue found, append a `GAP-0xx` entry to `proposals/grammar-gaps-backlog.md` following the existing format (severity, desired syntax, occurrences table, discussion). Also update the Summary table, the priority order, the Panel Resolution Monitor table (add the project row and update totals), and the coverage-by-pattern-family table if new pattern families are identified
