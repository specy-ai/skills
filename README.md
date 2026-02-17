# Specy Skills

Specy is a Domain-Driven Design toolkit that provides AI-assisted skills for reverse-engineering, exploring, and specifying domain models. It defines a structured DSL with `.struct` (structural model), `.flow` (behavioral model), and `.spec` (specification) files.

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **distill** | `/distill` | Reverse-engineers source code into `.struct` and `.flow` domain models |
| **dialogue** | `/dialogue` | Explores and questions existing domain models through conversation (read-only) |
| **spec** | `/spec` | Formalizes business specifications against existing models, producing `.spec` files |

## Project Structure

```
specy-skill/
├── grammars/              # EBNF grammars for .struct, .flow, .spec
├── examples/              # Example domain files (orders.struct, orders.flow)
└── skills/
    ├── distill/
    │   ├── SKILL.md
    │   ├── constructs/    # Flow construct references (interaction, service, etc.)
    │   └── heuristics/    # Stack-specific extraction patterns (Java, TS, Clojure)
    ├── dialogue/
    │   └── SKILL.md
    └── spec/
        └── SKILL.md
```

## Prerequisites

You need one of the following AI coding assistants installed:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (Anthropic)
- [GitHub Copilot](https://docs.github.com/en/copilot) with custom skills support
- [Vibe](https://docs.mistral.ai/vibe/) (Mistral)

## Setup

### Claude Code

Claude Code loads skills from `~/.claude/skills/`. Each skill needs a directory containing a symlink to its `SKILL.md`.

```bash
# Create skill directories
mkdir -p ~/.claude/skills/distill
mkdir -p ~/.claude/skills/dialogue
mkdir -p ~/.claude/skills/spec

# Symlink SKILL.md for each skill
ln -sf /path/to/specy-skill/skills/distill/SKILL.md ~/.claude/skills/distill/SKILL.md
ln -sf /path/to/specy-skill/skills/dialogue/SKILL.md ~/.claude/skills/dialogue/SKILL.md
ln -sf /path/to/specy-skill/skills/spec/SKILL.md ~/.claude/skills/spec/SKILL.md
```

Replace `/path/to/specy-skill` with the absolute path to your clone of this repository.

> **Note on `distill` sub-directories:** The `distill` skill references `constructs/` and `heuristics/` files using relative paths from within `SKILL.md`. Since the symlink points to the original file, Claude Code resolves these paths from the source directory — no need to symlink the sub-directories.

### GitHub Copilot

Copilot loads skills from `.github/skills/` in the project where you want to use them. Each skill is a directory containing a `SKILL.md` with YAML frontmatter.

Since the skills live outside the target project, copy or symlink the entire skill directories:

```bash
# From your target project root
mkdir -p .github/skills

# Option A: Symlink (keeps skills in sync with upstream)
ln -sf /path/to/specy-skill/skills/distill .github/skills/distill
ln -sf /path/to/specy-skill/skills/dialogue .github/skills/dialogue
ln -sf /path/to/specy-skill/skills/spec .github/skills/spec

# Option B: Copy (standalone, no dependency on specy-skill)
cp -r /path/to/specy-skill/skills/distill .github/skills/distill
cp -r /path/to/specy-skill/skills/dialogue .github/skills/dialogue
cp -r /path/to/specy-skill/skills/spec .github/skills/spec
```

Each `SKILL.md` must include YAML frontmatter for Copilot to register it:

```yaml
---
name: "distill"
description: "Reverse-engineer source code into Specy domain models"
---
```

Invoke with `/distill`, `/dialogue`, or `/spec` in Copilot Chat.

> **Note on `distill`:** Because Copilot skills are project-local, you must copy or symlink the entire `distill/` directory (including `constructs/` and `heuristics/`) so that relative paths resolve correctly.

### Vibe (Mistral)

Vibe loads skills from `~/.vibe/skills/` (global) or `.vibe/skills/` (project-local). Same structure as above: each skill is a directory with a `SKILL.md` containing YAML frontmatter.

```bash
# Global install
mkdir -p ~/.vibe/skills

ln -sf /path/to/specy-skill/skills/distill ~/.vibe/skills/distill
ln -sf /path/to/specy-skill/skills/dialogue ~/.vibe/skills/dialogue
ln -sf /path/to/specy-skill/skills/spec ~/.vibe/skills/spec
```

Or project-local:

```bash
# From your target project root
mkdir -p .vibe/skills

ln -sf /path/to/specy-skill/skills/distill .vibe/skills/distill
ln -sf /path/to/specy-skill/skills/dialogue .vibe/skills/dialogue
ln -sf /path/to/specy-skill/skills/spec .vibe/skills/spec
```

Optional `config.toml` for fine-tuning (in `~/.vibe/` or `.vibe/`):

```toml
[skills]
skill_paths = ["~/.vibe/skills"]
enabled_skills = ["distill", "dialogue", "spec"]
```

> **Note on relative paths:** Like Claude Code, Vibe resolves relative paths from the symlink target. Symlinking the `distill/` directory ensures `constructs/` and `heuristics/` are accessible.

## Usage

### `/distill` — Extract domain models from code

Run in a project with source code. The skill analyzes your codebase and produces:
- `specy/{domain}.struct` — entities, values, enums, commands, events
- `specy/{domain}.flow` — interactions, reactions, policies, invariants, services, repositories
- `specy/.meta.json` — tracks extraction state for incremental updates

Supports incremental, full, and targeted extraction modes.

### `/dialogue` — Explore domain models

Run in a project that already has `specy/*.struct` and `specy/*.flow` files. The skill reads the models and engages in conversation to help you understand the domain. It never modifies files.

Modes: **Explorer** (synthesize knowledge), **Questionner** (what-if scenarios), **Confronter** (challenge propositions), **Completer** (find gaps).

### `/spec` — Formalize business specifications

Run in a project with existing domain models. Give it a user story, business rule, or feature request. The skill produces a `.spec` file in `specy/specs/` capturing:
- Concept anchoring against existing models
- Confrontation analysis (contradictions, impacts, gaps)
- Projected changes to `.struct` and `.flow`

> **Important:** The `grammars/` and `examples/` directories in this repository are reference material for the skills. In your target project, the skills expect to find (or create) `specy/` at the project root — this is where your domain-specific `.struct`, `.flow`, and `.spec` files live.
