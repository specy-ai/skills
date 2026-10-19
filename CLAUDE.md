# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Specy is a DDD toolkit that captures business knowledge in structured DSL files (`.prd`, `.sysreq`, `.domain`, `.arch`). This repo contains the AI skill definitions, packaged as a single Claude Code **plugin** named `specy`. The 11 skills (invoked as `specy:<name>`) are: 7 core — `prd-design`, `sysreq-design`, `sysreq-extract-from-code`, `domain-design`, `domain-build-code`, `domain-extract-from-code`, `domain-refactor` — 3 architecture — `architecture-design`, `architecture-extract-from-code`, `architecture-build-code` — plus 1 auxiliary — `domain-dialogue`. Skills are assembled from modular templates into self-contained `dist/skills/<name>/SKILL.md` files.

## Build Commands

```bash
# Build all skills (assembles src/skills/ templates → dist/)
./src/skills/build.sh

# Build a single skill
./src/skills/build.sh domain-extract-from-code

# Build tree-sitter parsers + run smoke tests against examples/
./src/tree-sitters/build.sh    # requires: tree-sitter CLI

# Regenerate the PRD and SysReq metamodel diagrams (repo root specy-*-metamodel.svg)
./src/diagrams/build.sh        # requires: python3 + network on first run (fonts, fontTools)

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

- **Grammars**: `src/grammars/*.ebnf` are the canonical grammars (`domain.ebnf`, `architecture.ebnf`, `prd.ebnf`, `sysreq.ebnf`, `data-operation.ebnf`). The build script copies each into the skills that need it (e.g. `dist/skills/domain-extract-from-code/grammars/`). The tree-sitter grammars under `src/tree-sitters/` are faithful translations of the EBNF files and must be updated with them.
- **Metamodels**: `src/metamodels/*.md` document each layer's concepts and constraints (`DOMAIN-METAMODEL.md` for the v3 domain model, `SOFTWARE-ARCHITECTURE-METAMODEL.md` for `.arch`, incl. its level 0). They are published verbatim on specy.ai, so their heading texts are stable anchors: add headings, do not rename them.
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

A context map entry is written by a context about itself: inside `X`, `downstream Y : ACL` means X is downstream of Y and protects itself with an ACL.

### Specy Software Architecture DSL (`.arch`)

A `.arch` file has one of two roots:
```
architecture  > system (one, in focus) > container > component     // C4 levels 1–3, Thrift-typed contracts, ports, connectors, channels, deployment
organization  > area / phase / person / externalSystem / system / dependency > flow   // level 0: the system landscape
```

Level 0: a `system` states its purpose (`::`), product (`technology`), `area`, `used-by`, the concepts it `masters` (source of truth) and `handles`, and its `hotspot`s. `dependency A -> B` reads "A depends on B" — the direction of the need, not of the call — with context-map patterns (`CS | Conformist | ACL` downstream, `OHS` upstream, `SharedKernel | PublishedLanguage | Partnership` both; `Partnership` is written on both dependencies of a mutual pair) and a `criticality`. A `flow` carries numbered domain concepts (`carries X as Y`, `to` when data goes to the upstream side) with a mechanism `over "…" manual | automated`, once or per `phase`. Concept names resolve against the `domain-source`(s) (`Context.Concept` when ambiguous; `// NOTE:` acknowledges a name with no domain element yet). The worked example is `examples/retail-media/`; the Navigator in `ui/` renders both roots (see `ui/README.md`).

## Development Workflow

1. Edit templates and fragments in `src/skills/`
2. Run `./src/skills/build.sh` to regenerate `dist/`
3. The pre-commit hook (`hooks/pre-commit`) blocks commits if `dist/` is out of sync with `src/`

Setup hooks after clone: `git config core.hooksPath hooks/`

## Metamodel Diagrams

`specy-DDD-metamodel.svg` is hand-built. `specy-PRD-metamodel.svg`, `specy-SysReq-metamodel.svg`, `specy-Arch-metamodel.svg`, `specy-DataOp-metamodel.svg` and `EA-metamodel.svg` are generated by `src/diagrams/build.sh` from declarative specs (`src/diagrams/prd_metamodel.py`, `sysreq_metamodel.py`, `arch_metamodel.py`, `dataop_metamodel.py`, `ea_metamodel.py`) rendered by `metamodel_diagram.py` in the DDD diagram's style; every node carries a `data-anchor` naming the heading of the matching metamodel section (used by the specy.ai site to make nodes clickable). Edit the specs, not the SVGs.

## Tree-Sitter Parsers

Four parsers in `src/tree-sitters/`: specy-domain, specy-prd, specy-sysreq, specy-architecture. `src/tree-sitters/build.sh` generates, builds, and smoke-tests them against files in `examples/`.

## Examples

`examples/` contains complete Specy projects (business-loan, url-shortener, ride-now, ecommerce, retail-media — an organization-level `.arch` landscape with its `.domain`) used both as documentation and as tree-sitter smoke test inputs. Examples are fictional: no client names, no people, no e-mail addresses.

## DSL Conventions

- Type names: `PascalCase`. Field names and enum values: `camelCase` (convert UPPER_SNAKE_CASE from source)
- Operation labels: string literals in business language, not identifiers
- Every definition must have a `// source: path/to/file.ext` comment for traceability
- `// UNCLEAR:` — grammar genuinely cannot express the condition (business-critical)
- `// NOTE:` — infrastructure concern omitted or gap flagged; at `.arch` level 0 it also acknowledges a concept name that has no domain element yet

## Design Review Panels

- `CORE_TEAM.md` — 7-panellist review for language/grammar/skill changes (Simplicity, DDD Fidelity, Readability, Machine Reasoning, Cross-File Coherence, Skill Experience, Provocateur)
- `UX_TEAM.md` — 6-panellist review for interface/visualization changes (not in the repo yet)
- Both follow: Present → Respond → Rebut → Synthesise → Verdict

## Grammar Gaps

Known limitations are tracked in `proposals/grammar-gaps-backlog.md` with severity levels (critical/high/medium/low). When distill produces `// UNCLEAR` markers that represent genuine grammar limitations, they should be added to this backlog with occurrence counts.

## Analyzing Specy Artifacts

When the user asks to analyze Specy artifacts (`.prd`, `.domain`, `.sysreq`, `gaps.report`, `.meta.json`):

1. **Read all files** in the target `specy/` directory
2. **Produce the analysis** — cover: extraction statistics, model quality (well-modeled parts, suspicious types, missing fields), UNCLEAR markers, unresolved dot-paths, and actionable recommendations
3. **Update the gaps backlog** — for each new grammar gap or modeling issue found, append a `GAP-0xx` entry to `proposals/grammar-gaps-backlog.md` following the existing format (severity, desired syntax, occurrences table, discussion). Also update the Summary table, the priority order, the Panel Resolution Monitor table (add the project row and update totals), and the coverage-by-pattern-family table if new pattern families are identified

