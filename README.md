# Specy Skills

Specy is a Domain-Driven Design toolkit that makes business knowledge explicit, portable, and verifiable. It provides AI-assisted skills that reverse-engineer, explore, specify, and formalize domain models using either:
- a structured DSL (`.prd`, `.sysreq`, `.domain` files).
- a YAML  (`.prd.yaml`, `.sysreq.yaml`, `.domain.yaml` files).
- a Markdown files (`.prd.md`, `.sysreq.md`, `.domain.md` files) 

Business knowledge — rules, invariants, constraints, operational decisions — is the real asset. Code is a derivation. Specy captures that knowledge so it survives rewrites, anchors AI-generated code to real intent, and evolves with the business.

## Metamodels

Specy organizes business knowledge into three layers, each with its own metamodel, file format, and grammar. Together they form a **traceability chain** from product vision down to domain implementation.

```
  Product Requirements          System Requirements            Domain Model
  ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
  │  .prd            │  ──────▶│  .sysreq         │  ──────▶│  .domain         │
  │                  │ derives │                  │ realizes│                  │
  │  WHY + WHAT      │         │  WHAT (formal)   │         │  HOW (model)     │
  └─────────────────┘         └─────────────────┘          └─────────────────┘
   Audience: PO, PM            Audience: PO, Dev             Audience: Dev, Arch
```

### Product Requirements (`.prd`)

**Purpose:** Capture the *why* and *what* of a product — the problem, the people, and the intended value — before any solution is designed.

A `.prd` file structures product thinking into traceable concepts: problem statement, personas, jobs-to-be-done, desired outcomes, goals with success metrics, hypotheses, features, user stories, user journeys, risks, assumptions, constraints, open questions, and releases.

**Key concepts:**

| Concept | Description |
|---------|-------------|
| Problem Statement | The core problem the product addresses, with supporting evidence |
| Persona | An archetype of a user segment, with context and pain points |
| Job | A job-to-be-done (JTBD) — what the persona is trying to accomplish |
| Desired Outcome | What success looks like from the persona's perspective |
| Goal | A measurable business objective tied to success metrics |
| Hypothesis | A testable assumption linking a feature to an expected outcome |
| Feature | A capability the product provides, traceable to goals and personas |
| User Story | A concrete behavior within a feature, with acceptance criteria |
| User Journey | A sequence of steps a persona takes to accomplish a job |
| Release | A time-boxed delivery grouping features by priority (MoSCoW) |

**Traceability:** each feature traces to goals and personas; each user story traces to a feature; each release groups features. The PRD feeds into system requirements via feature-to-requirement coverage.

### System Requirements (`.sysreq`)

**Purpose:** Formalize *what the system shall do* in testable, unambiguous EARS statements — bridging product intent and domain modeling.

A `.sysreq` file contains requirement sets grouped by feature or capability, using the **EARS** (Easy Approach to Requirements Syntax) patterns. Each requirement has a unique ID, a priority (MoSCoW), and traces back to a PRD feature.

**EARS patterns:**

| Pattern | Template | When to use |
|---------|----------|-------------|
| Ubiquitous | "The system shall..." | Always-on behavior |
| State-driven | "While [state], the system shall..." | Behavior tied to a system state |
| Event-driven | "When [event], the system shall..." | Behavior triggered by an event |
| Unwanted | "If [condition], then the system shall..." | Error handling, edge cases |
| Optional | "Where [feature], the system shall..." | Feature-gated behavior |
| Complex | Combines two or more patterns | Multi-condition requirements |

**Key concepts:**

| Concept | Description |
|---------|-------------|
| Requirement Set | A group of related requirements, traced to a PRD feature |
| Requirement | A single EARS statement with ID, priority, and rationale |
| NFR (Non-Functional) | Performance, security, availability, scalability requirements |
| Traceability | `prd-source` links to the originating `.prd` file |

**Traceability:** each requirement set links to a PRD feature via `feature-ref`; each requirement has a unique ID (e.g., `REQ-ORD-001`) that domain model constructs reference via `satisfies`.

### Domain Model (`.domain`)

**Purpose:** Model the deep business logic — entities, their behaviors, rules, state machines, and cross-aggregate consistency — in a formal DDD notation.

A `.domain` file captures the full domain model for a bounded context: the structural concepts (what exists), the behavioral concepts (what happens), and the properties (what must hold true). It uses a hierarchical structure: `organization > context > module`.

**Key concepts:**

| Concept | Description |
|---------|-------------|
| Entity | Domain object with identity, mutable state, and lifecycle |
| Aggregate | Group of entities with a root, enforcing integrity boundaries |
| Value | Immutable object defined by its attributes (no identity) |
| Command | Intent to change domain state (input DTO for write operations) |
| Query | Request for current state (safe, idempotent read) |
| Event | Recorded fact: internal, external (from upstream), error, or temporal |
| Operation | Named behavior owned by an entity — command-triggered or event-triggered |
| Precondition | Named guard on an operation (`rejects` with message) |
| Policy | Reactive rule: listens to an event, issues a command (trigger/guard/effect) |
| Invariant | Safety property that must hold after any mutation (with enforcement strategy) |
| Agreement | Cross-aggregate consistency property with reconciliation mechanism |
| State Machine | Named lifecycle with states, transitions, guards, and actions |
| Domain Service | Stateless business logic spanning multiple entities |
| Application Service | Use case orchestrator from presentation layer |
| Infrastructure Service | External system adapter (notifications, payments, storage) |
| Interface | Named surface exposing a subset of operations |

**Traceability:** `requirements-source` links to the `.sysreq` file; individual constructs use `satisfies [REQ-XXX-001]` to trace back to specific requirements.

## Skills

Specy provides 6 AI-assisted skills, each specialized for a step in the product-to-code lifecycle.

### `/prd` — Product Requirements

Guides the creation of a `.prd` file through an interactive conversation. Works in two modes:

- **Interactive mode** — 7-phase conversation: Problem & Vision, Personas & Jobs, Goals & Metrics, Evidence & Hypotheses, Features & Stories, Risks & Constraints, Journeys & Releases. Each phase produces a section of the PRD, validated before moving on.
- **One-shot mode** — given a brief or description, generates a complete `.prd` in one pass.

**Input:** product idea, brief, or business context in prose.
**Output:** `specy/{product}.prd` file following the PRD metamodel.

### `/sysreq` — System Requirements

Formalizes system requirements in EARS syntax from a PRD, business rules, or prose. Works in two modes:

- **Interactive mode** — 4-phase conversation: Context Identification, Functional Requirements, NFR Discovery, Cross-Requirement Analysis. Iteratively builds requirement sets from features.
- **One-shot mode** — reads an existing `.prd` file and generates a complete `.sysreq` with feature-to-requirement mapping, NFR discovery, and gap analysis.

**Input:** `.prd` file, business rules, or prose requirements.
**Output:** `specy/{domain}.sysreq` file following the system requirements metamodel.

### `/domain` — Domain Modeling

Builds `.domain` files from system requirements, PRDs, or prose descriptions. Covers the full DDD modeling workflow:

- **Interactive mode** — 7-phase conversation: Bounded Contexts & Organization, Entities/Aggregates/Values, Operations/Commands/Events, State Machines, Invariants/Policies/Properties, Services & Infrastructure, Traceability. Includes DDD quality challenges (entity vs value, aggregate boundaries, anemic model detection).
- **One-shot mode** — reads `.sysreq` (or `.prd`) files and derives a complete domain model with requirement traceability.

**Input:** `.sysreq` file, `.prd` file, or prose description of business logic.
**Output:** `specy/{domain}.domain` file following the domain metamodel.

### `/distill` — Reverse Engineering

Reverse-engineers existing source code into `.domain` files. Extracts the business logic buried in code — entities, commands, events, operations, preconditions, policies, invariants, state machines — and formalizes it.

- **Creation mode** — full extraction from scratch.
- **Incremental mode** — uses `git diff` + `.meta.json` to extract only what changed since the last run.
- **Targeted mode** — re-extracts a single definition by name.

Supports stack-specific heuristics for Java/Spring, TypeScript/NestJS, and Clojure. Uses test assertions as evidence (test-aware enrichment).

**Input:** source code in any supported language.
**Output:** `specy/{domain}.domain` file + `specy/gaps.report` + `specy/.meta.json`.

### `/dialogue` — Domain Exploration

Read-only conversational exploration of existing `.domain` files. Navigates the domain model graph — from organization down to individual operation clauses — synthesizing, tracing, and challenging the model without ever modifying it.

4 conversation modes driven by automatic tests:
- **Explorer** — "How does X work?" — breadth-first behavioral summaries
- **Questioner** — "What happens if...?" — detailed scenario traces through operations
- **Confronter** — "We should allow X" — finds contradictions with existing preconditions, policies, invariants
- **Completer** — "What's missing?" — runs a 22-point completeness checklist

**Input:** questions or propositions about the domain.
**Output:** conversational responses anchored in the models, with follow-up offers.

### `/spec` — Business Specifications

Formalizes a business specification (user story, business rule, feature request) against existing `.domain` models. Produces a `.spec` file that captures the analysis and projected changes without ever modifying the domain models.

5-phase workflow: Decomposition, Anchoring, Confrontation, Proposition, Confirmation. Includes a `spec verify` mode that checks whether projected changes have been realized after implementation.

**Input:** business requirement in prose + existing `.domain` models.
**Output:** `specy/specs/{number}_{name}.spec` file with narrative, concept anchoring, confrontation analysis, projected changes in native Specy syntax, and impact analysis.

## Two Approaches

Specy supports two complementary approaches to domain modeling. Both converge on the same artifact — the `.domain` file — and once it exists, all six skills can operate on it.

```
     Top-down (greenfield)                Bottom-up (brownfield)

     Business vision                      Existing codebase
          │                                      │
          ▼                                      ▼
      /prd → .prd                          /distill → .domain
          │                                      │
          ▼                                      ▼
    /sysreq → .sysreq                    /dialogue (explore)
          │                                      │
          ▼                                      ▼
    /domain → .domain ◄──────────────────► /spec → .spec
                                                 │
                                          (implement + /distill)
                                                 │
                                          /spec verify → REALIZED
```

### Top-down: from product vision to domain model

Start with *why* (product vision, personas, jobs-to-be-done) and progressively formalize *what* the system should do (testable requirements) then *how* the domain is structured (entities, operations, rules).

1. **`/prd`** — capture the product vision: problem statement, personas, goals, hypotheses, features, user stories, and releases into a `.prd` file.
2. **`/sysreq`** — formalize testable system requirements in EARS syntax from the PRD, producing a `.sysreq` file with traceability back to features.
3. **`/domain`** — build the domain model from requirements: entities, aggregates, commands, events, operations, state machines, invariants, policies. Each construct traces back to specific requirements via `satisfies`.

This is the **greenfield** path — no code exists yet. Knowledge flows from intent to structure.

### Bottom-up: from existing code to explicit knowledge

Start with *what exists* (source code) and extract the implicit business knowledge into an explicit, verifiable model. Then explore it, challenge it, and propose changes that flow back through code.

1. **`/distill`** — reverse-engineer source code into `.domain` files. The extracted model becomes the source of truth for the other skills.
2. **`/dialogue`** — explore and question the domain model through conversation. Surface gaps, trace behaviors, challenge assumptions. When a change is needed, the dialogue naturally leads to `/spec`.
3. **`/spec`** — formalize a business change proposal against the existing model. Produces a `.spec` file with confrontation analysis and projected changes — without touching the `.domain` files.
4. The developer implements the change in code, then runs **`/distill`** (incremental) to update the model.
5. **`/spec verify`** checks whether the projected changes have been realized. When all changes match, the spec is marked as `REALIZED`.

This is the **brownfield** path — code already exists. Knowledge flows from implementation to model, and change proposals flow from model back to code.

## Folder Structure

```
specy-skill/
├── src/                          # All source material (humans edit here)
│   ├── skills/                   # Skill templates and build system
│   │   ├── build.sh              # Assembles SKILL.md from templates → dist/
│   │   ├── distill/           # Distill skill source
│   │   │   ├── main.md           # Template with <!-- include: --> markers
│   │   │   └── heuristics/       # Stack-specific extraction heuristics (source)
│   │   ├── dialogue/             # Dialogue skill source
│   │   ├── spec/                 # Spec skill source
│   │   ├── prd/                  # PRD skill source
│   │   ├── sysreq/              # System requirements skill source
│   │   └── domain/              # Domain skill source
│   ├── grammars/                 # Canonical EBNF grammars (source of truth)
│   │   ├── domain.ebnf           # Domain model grammar (.domain)
│   │   ├── prd.ebnf              # Product requirements grammar (.prd)
│   │   └── sysreq.ebnf           # System requirements grammar (.sysreq)
│   ├── metamodels/               # Metamodel documentation
│   │   ├── DOMAIN-METAMODEL.md
│   │   ├── PRODUCT-REQ-METAMODEL.md
│   │   └── SYSTEM-REQ-METAMODEL.md
│   ├── tree-sitters/             # Tree-sitter parser generators + build script
│   │   ├── build.sh
│   │   ├── tree-sitter-specy-domain/
│   │   ├── tree-sitter-specy-prd/
│   │   └── tree-sitter-specy-sysreq/
│   └── langium/                  # Langium-based LSP server + parser CLI
│       └── specy-domain/         # .domain language server (parse/validate/JSON)
│
├── dist/                         # Built output (generated — do not edit)
│   ├── distill/               # Distill skill
│   │   ├── SKILL.md
│   │   ├── heuristics/           # Runtime heuristics (copied from src)
│   │   └── grammars/             # Runtime grammar (domain.ebnf)
│   ├── dialogue/
│   ├── spec/
│   ├── prd/
│   │   ├── SKILL.md
│   │   ├── grammar/              # prd.ebnf
│   │   └── references/           # PRODUCT-REQ-METAMODEL.md
│   ├── sysreq/
│   │   ├── SKILL.md
│   │   ├── grammar/              # sysreq.ebnf
│   │   └── references/           # SYSTEM-REQ + PRODUCT-REQ metamodels
│   └── domain/
│       ├── SKILL.md
│       ├── grammar/              # domain.ebnf
│       └── references/           # All 3 metamodels
│
├── examples/                     # Example Specy projects
│   ├── business-loan/            # .prd, .sysreq, .domain
│   ├── url-shortener/            # .prd, .sysreq, .domain
│   ├── uber/                     # Multi-context ride-sharing domain
│   └── ecommerce/                # Orders example (v2 format)
│
├── hooks/                        # Git hooks
│   └── pre-commit                # Ensures dist/ stays in sync with src/
│
├── install-skills-for-user.sh    # Symlinks dist/ skills to ~/.claude/skills/
├── VISION.md                     # Specy thesis and design philosophy
├── CORE_TEAM.md                  # Core review panel
└── VISION_TEAM.md                # Vision review panel
```

### Key directories

**`src/`** — Everything humans edit. Skill templates, grammars, metamodels, and tree-sitter sources. The `src/skills/build.sh` script assembles the final `SKILL.md` files from templates using `<!-- include: path -->` and `<!-- include-code: lang path -->` markers.

**`dist/`** — Build output produced by `src/skills/build.sh`. Contains the assembled `SKILL.md` files and runtime files (heuristics, grammars, metamodel references) that skills load on demand. Never edit files here directly — they are overwritten on each build.

**`src/grammars/`** — Canonical EBNF grammars for each file format. The build script copies them to the relevant `dist/` skill directories.

**`src/metamodels/`** — Prose documentation of each metamodel. These describe the concepts, relationships, and constraints that the grammars formalize. Copied to `dist/` as runtime references for skills that need them.

**`src/tree-sitters/`** — Tree-sitter parser generators for Specy file formats. Used for syntax highlighting, parsing validation, and tooling integration.

**`src/langium/`** — [Langium](https://langium.org/)-based LSP server and parser CLI for the `.domain` DSL. Provides editor diagnostics, AST access, and a `parse` command that emits JSON, YAML, or Markdown. See [LSP Server](#lsp-server) below.

**`examples/`** — Complete example projects demonstrating Specy files across different domains.

## Prerequisites

You need one of the following AI coding assistants:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (Anthropic)
- [GitHub Copilot](https://docs.github.com/en/copilot) with custom skills support
- [Vibe](https://docs.mistral.ai/vibe/) (Mistral)

## Setup

### Claude Code (recommended)

Run the install script to symlink all skills from `dist/` to `~/.claude/skills/`:

```bash
./install-skills-for-user.sh
```

This installs: distill, dialogue, spec, prd, sysreq, domain.

### Manual setup (any assistant)

Skills are self-contained directories with a `SKILL.md` and optional runtime files. Symlink or copy from `dist/` to your assistant's skill directory:

```bash
# Claude Code
ln -sf /path/to/specy-skill/dist/distill ~/.claude/skills/distill

# GitHub Copilot (in your target project)
ln -sf /path/to/specy-skill/dist/distill .github/skills/distill

# Vibe (Mistral)
ln -sf /path/to/specy-skill/dist/distill ~/.vibe/skills/distill
```

## Usage

The typical workflow follows the traceability chain:

```
1. /prd          Define the product (problem, personas, features)
2. /sysreq       Formalize testable requirements from the PRD
3. /domain       Build the domain model from requirements
4. /dialogue     Explore and question the domain model
5. /spec         Formalize change specifications against the model
6. /distill      Reverse-engineer domain models from existing code
```

| Workflow | What to run |
|----------|-------------|
| Define product requirements | `/prd` |
| Formalize system requirements (EARS) | `/sysreq` after PRD is done |
| Build domain model from requirements | `/domain` after system requirements are written |
| Explore and question a domain model | `/dialogue` in a project with `*.domain` files |
| Formalize a business rule or feature | `/spec` against existing models |
| Extract domain models from existing code | `/distill` in your project |

In your target project, Specy files live under `specy/` at the project root.

## LSP Server

Specy ships a [Langium](https://langium.org/)-based Language Server and parser CLI for `.domain` files, located in `src/langium/specy-domain/`. It provides:

- **Editor integration** — diagnostics, syntax validation, and AST navigation via LSP (VS Code extension entrypoint in `src/extension/main.ts`).
- **Parser CLI** (`specy-domain`) — parses a `.domain` file into **JSON, YAML, or Markdown**, or validates it from the command line.

### Build

```bash
./src/langium/specy-domain/build.sh
```

The script runs `npm install`, generates the Langium artifacts, compiles TypeScript to `out/`, and smoke-tests the CLI against the bundled examples in JSON, YAML, and Markdown.

### Parse a `.domain` file

The easiest entry point is the `parse-domain.sh` wrapper at the repository root. It builds the parser on first use and works from any directory:

```bash
# Markdown documentation
./parse-domain.sh examples/ecommerce/v2/orders.domain -f markdown

# Clean YAML model
./parse-domain.sh examples/ecommerce/v2/orders.domain -f yaml > orders.yaml

# Pretty-printed JSON (default format is json)
./parse-domain.sh examples/ecommerce/v2/orders.domain --pretty
```

| Flag | Description |
|------|-------------|
| `-f, --format <fmt>` | `json` (default), `yaml`, or `markdown` |
| `--pretty` | Pretty-print JSON output |
| `--raw` | Emit the faithful Langium AST (with `$type` discriminators) instead of the clean domain model — `json`/`yaml` only |

`json` and `yaml` share a **clean domain model**: Langium internals are stripped and definitions are grouped by kind (`entities`, `values`, `enums`, `commands`, `queries`, `events`, `services`, `policies`, …) under their owning context/module. `markdown` renders the same model as a documentation-style document (heading hierarchy, field tables, operation summaries). Pass `--raw` when you need the verbatim AST.

Under the hood the wrapper calls the CLI directly, which you can also invoke from `src/langium/specy-domain/`:

```bash
node out/cli/index.js parse ../../../examples/ecommerce/v2/orders.domain -f markdown
node out/cli/index.js parse ../../../examples/ecommerce/v2/orders.domain -f json | jq '.definitions.entities[].name'
```

Example JSON output (truncated) for `examples/ecommerce/v2/orders.domain`:

```json
{
  "modules": [
    { "name": "Order", "dependencies": ["Shipping"] }
  ],
  "definitions": {
    "enums": [
      { "kind": "enum", "name": "OrderStatus", "values": ["draft", "confirmed", "shipped", "delivered", "cancelled"] }
    ],
    "entities": [
      {
        "kind": "entity",
        "name": "Customer",
        "description": "A customer who places orders",
        "identity": { "name": "id", "type": "UUID" },
        "fields": [
          { "name": "name", "type": "string", "constraints": ["minLength(1)", "maxLength(100)"] },
          { "name": "email", "type": "EmailAddress", "constraints": ["unique"] }
        ]
      }
    ]
  }
}
```

Parse errors are written to `stderr` with `line:column` locations, and the process exits non-zero.

### Validate a `.domain` file

```bash
node out/cli/index.js validate ../../../examples/ecommerce/v2/orders.domain
```

Emits one `path:line:col [severity] message` line per diagnostic. Exits `0` when there are no errors (warnings allowed), `1` otherwise — suitable for CI gates.

## Contributing

### Setup

After cloning, configure the git hooks:

```bash
git config core.hooksPath hooks/
```

### Editing skills

Always edit files in `src/skills/`, never the generated files in `dist/`.

After editing, regenerate:

```bash
src/skills/build.sh            # Build all skills
src/skills/build.sh distill # Build a single skill
```

The pre-commit hook blocks commits if `dist/` is out of date with `src/`.

### Building tree-sitter parsers

```bash
./src/tree-sitters/build.sh
```

Requires `tree-sitter` CLI. Builds all three grammars and runs smoke tests against `examples/`.
