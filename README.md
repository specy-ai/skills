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
├── proposals/             # Design proposals for grammar evolution
├── REVIEW.md              # Design review process
├── TEAM.md                # Review panel definitions
├── hooks/                 # Git hooks (see Contributing section)
└── skills/
    ├── src/               # Editable sources (humans edit here)
    │   ├── build.sh       # Assembles SKILL.md from templates
    │   ├── grammars/      # EBNF grammars for .struct, .flow, .spec
    │   ├── examples/      # Canonical examples (orders.struct, orders.flow)
    │   ├── distill/
    │   │   ├── main.md    # Template with <!-- include: --> markers
    │   │   ├── constructs/
    │   │   └── heuristics/
    │   ├── dialogue/
    │   │   └── main.md
    │   └── spec/
    │       └── main.md
    ├── distill/
    │   ├── SKILL.md       # Generated — do not edit
    │   └── heuristics/    # Stack-specific (loaded conditionally at runtime)
    ├── dialogue/
    │   └── SKILL.md       # Generated — do not edit
    └── spec/
        └── SKILL.md       # Generated — do not edit
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

> **Note:** The `SKILL.md` files are self-contained (grammars, examples, and construct rules are inlined at build time). Only `distill` keeps external `heuristics/` files for conditional loading by stack.

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

> **Note:** The `SKILL.md` files are self-contained. For `distill`, also include the `heuristics/` directory (stack-specific patterns loaded at runtime).

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

> **Note:** Same as Claude Code — `SKILL.md` files are self-contained. Include `distill/heuristics/` for stack-specific patterns.

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

> **Important:** The `skills/src/` directory contains source material for the skills. In your target project, the skills expect to find (or create) `specy/` at the project root — this is where your domain-specific `.struct`, `.flow`, and `.spec` files live.

---

## Contributing

### Setup

After cloning the repository, configure the git hooks:

```bash
git config core.hooksPath hooks/
```

This enables the pre-commit hook that ensures generated `SKILL.md` files stay in sync with their sources in `skills/src/`.

### Editing skills

Always edit files in `skills/src/`, never the generated `SKILL.md` files directly.

- **Grammars** — `skills/src/grammars/*.ebnf`
- **Canonical examples** — `skills/src/examples/orders.*`
- **Skill templates** — `skills/src/{skill}/main.md`
- **Constructs** (distill) — `skills/src/distill/constructs/*.md`
- **Heuristics** (distill) — `skills/src/distill/heuristics/*.md`

After editing, regenerate the `SKILL.md` files:

```bash
skills/src/build.sh
```

The pre-commit hook will block commits if the generated files are out of date.
