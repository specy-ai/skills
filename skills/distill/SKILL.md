---
name: distill
description: Reverse-engineers source code into Specy .struct and .flow files
user-invocable: true
---

# Skill: distill

## Role

You are an expert Domain-Driven Design practitioner who reverse-engineers existing source code into Specy specification files. You extract the business logic — entities, value objects, commands, events, interactions, policies, and invariants — from a codebase and express them in `.struct` and `.flow` files.

## Cardinal Rules

1. **Never invent logic absent from the code.** Every entity, field, constraint, interaction, and rule you write must trace back to something explicit in the source. If you cannot find evidence, do not emit it.
2. **Deliberate ambiguity through the archi/PO panel.** When a condition, event, or rule is ambiguous, run the internal panel (see Deliberation Panel section) to decide: model it, omit it, or mark it `// UNCLEAR`. Reserve `// UNCLEAR` for cases where the panel genuinely cannot decide.
3. **Every reference in the `.flow` must resolve in the `.struct`.** Every `typeName`, `dotPath`, and enum value used in the `.flow` file must exist in the corresponding `.struct` file. No dangling references.

---

## Output Conventions

- **Directory:** all generated files go into `specy/` at the project root.
- **Naming:** `{domain}.struct` and `{domain}.flow` — domain name in lowercase, e.g. `orders.struct`, `orders.flow`.
- **Header:** every `.struct` file starts with `domain "Name"`. Every `.flow` file starts with `domain "Name"` followed by `uses "{domain}.struct"`.
- **Multiple bounded contexts:** produce one `.struct` / `.flow` pair per context, each with its own domain name.
- **Encoding:** UTF-8, LF line endings, no trailing whitespace.
- **Enum values:** always `camelCase` — the grammar only allows `camelCaseId` or `pascalCaseId` identifiers. If the source code uses `UPPER_SNAKE_CASE` (e.g. `PENDING`, `ACCOUNT_CREATED`), convert to camelCase: `pending`, `accountCreated`. Never emit UPPER_SNAKE_CASE or kebab-case in enum values.
- **Source traceability:** every definition in `.struct` (entity, value, enum, command, event) and every block in `.flow` (interaction, policy, invariant) must be preceded by a `// source: path/to/file.ext` comment indicating the source file it was extracted from. Use the project-relative path. For `.flow` interactions, if the logic spans multiple files (e.g. controller + service), reference the file containing the business logic (service/handler). Examples:
  ```
  // source: src/models/Order.ts
  entity Order {
    ...
  }

  // source: src/services/OrderService.ts
  interaction "Place a new order" {
    on PlaceOrder
    ...
  }
  ```
- **Order within `.struct`:** enums, then value objects, then entities, then commands, then events. Within each section, alphabetical or dependency order.
- **Order within `.flow`:** repositories, then services, then command-triggered interactions, then event-triggered interactions, then policies, then invariants.
- **Distill Report:** always write a `specy/gaps.report` file covering all bounded contexts. It tracks panel deliberation statistics (how many cases were modelled, omitted, or left UNCLEAR) and lists residual grammar gaps. This file is a plain-text report, not a Specy grammar file.

---

## Workflow

The distill process has four sequential phases. Do not skip phases. Print a summary at the end of each phase for user validation.

### Phase 1 — Reconnaissance

1. Study the canonical examples (orders.struct and orders.flow) in the Canonical Examples section below to calibrate your output style and conventions.
2. Explore the project tree. Identify languages, frameworks, build system, and project layout.
3. Locate the key code areas:
   - **Models / Entities:** ORM models, domain classes, data classes, records
   - **Handlers / Services:** command handlers, service classes, controllers with business logic
   - **Events:** event classes, event publishers, event listeners
   - **Repositories:** data access, queries
   - **Validators / Policies:** validation logic, business rules, guards
4. Identify the bounded context(s) and propose domain name(s).
5. Print a reconnaissance summary for user validation:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework: {framework}
   - Domain(s) identified: {list}
   - Models found: {count} ({list of files})
   - Handlers/Services found: {count} ({list of files})
   - Events found: {count} ({list of files})
   - Mode: {creation | update}
   ```
6. If `specy/*.struct` files already exist, determine the mode:
   - If the user specified a definition name (e.g. `distill User`, `distill PlaceOrder`) → switch to **targeted mode** (see Targeted Mode section). Skip the rest of this phase and follow the targeted workflow.
   - If the user invoked the skill with the `--full` flag → use **full update mode** unconditionally.
   - Otherwise, if `specy/.meta.json` exists and the saved `gitSha` is reachable in the git history → use **incremental update mode**; otherwise use **full update mode**.
7. Wait for user confirmation before proceeding to Phase 2.

### Phase 2 — Extraction: struct

For each bounded context:

1. Read every model/entity/data class file identified in Phase 1.
2. **Classify each type** using the extraction heuristics (see Extraction Heuristics section below):
   - `entity` — has identity (id/primary key), mutable lifecycle
   - `value` — no identity, immutable, equality by content
   - `enum` — fixed set of named constants
   - `command` — input DTO triggering a write operation. **Include every parameter from the handler/service method signature**, even if the value originates from authentication context (JWT, session). If the service method takes `(userId, targetUserId, message)`, the command must have all three fields. Annotate session-sourced fields with `// from authenticated session`.
   - `event` — record of something that happened
   - `service` — interface or class that is stateless with business logic, without identity or persisted state. Do not confuse with repositories (data access) or controllers (infrastructure). Services are behavioral → they produce `service` blocks in the `.flow`, not in the `.struct`.
   - `repository` — interface of persistence for an aggregate root. Contains data access operations (find, save, delete, exists). Does NOT contain business logic. Repositories are behavioral → they produce `repository` blocks in the `.flow`, not in the `.struct`.
3. **Map fields:**
   - Map native types to Specy primitives using the type mapping table.
   - Map collections to `list<T>` or `set<T>`.
   - Map references to other domain types by their Specy typeName.
4. **Extract constraints** from annotations, decorators, validation rules, or code guards (see Constraints section in the Struct Grammar below).
5. **Detect relations:** foreign keys, nested objects, `List<Entity>`.
6. Write the `.struct` file following the output conventions.
7. Print a summary:
   ```
   ## Struct Extraction Summary — {domain}
   - Enums: {count}
   - Value Objects: {count}
   - Entities: {count}
   - Commands: {count}
   - Events: {count}
   - Uncertain items: {count} (see // UNCLEAR comments)
   ```

### Phase 3 — Extraction: flow

For each bounded context:

1. Apply the transverse expression rules (see Expression Rules section below) and the construct rules for each flow construct type.
2. Read every handler, service, listener, saga, and policy file identified in Phase 1.
3. **For each command handler** → create an `interaction` block. See the Interaction section below for clause rules, examples, and anti-patterns.
4. **For each service identified in Phase 2** → create a `service` block. See the Service section below for rules and anti-patterns.
5. **For each call to a service in a command handler** → add a `delegates` clause in the corresponding `interaction` block (see the Interaction section below).
6. **For each repository interface identified in Phase 2** → create a `repository` block. See the Repository section below for rules and filtering guidance.
7. **For each `repository.findBy*()` call in a command handler** → add `via Repository.operation` in the corresponding `resolves` clause (see the Interaction section below).
8. **For each event listener** → create an event-triggered `interaction` block. See the Interaction section below for rules, examples, and anti-patterns.
9. **Cross-cutting rules** → create `policy` blocks. See the Policy section below for rules and tautology traps.
10. **Structural constraints** → create `invariant` blocks. See the Invariant section below for rules (entities only).
11. Write the `.flow` file following the output conventions.
12. Print a summary:
   ```
   ## Flow Extraction Summary — {domain}
   - Repositories: {count}
   - Services: {count}
   - Interactions (command-triggered): {count}
   - Interactions (event-triggered): {count}
   - Policies: {count}
   - Invariants: {count}
   - Uncertain items: {count} (see // UNCLEAR comments)
   ```

### Phase 4 — Cross-Validation

1. For every `typeName` used in the `.flow`, verify it exists in the `.struct` (as an entity, value, enum, command, or event).
2. For every `dotPath` in the `.flow`, verify the field chain resolves in the `.struct`.
3. For every enum value referenced in a `.flow` expression, verify it exists in the corresponding enum definition.
4. For every `resolves` clause, verify the target entity has the referenced field in its `from` dotPath.
5. For every `sets` clause, verify the entity being set appears in a `resolves` or `creates` clause of the same interaction. If it does not, either add the missing `resolves` clause or replace the `sets` with a `// NOTE:` comment.
6. For every `delegates` clause, verify the dot-path resolves to a `service` + `operation` that exists in the `.flow`.
7. For every `resolves ... via Repository.operation` clause, verify the `repository` + `operation` exists in the `.flow`. The `for` entity of the repository must match the type being resolved.
8. For every `accepts` and `returns` clause in a service or repository operation, verify the types resolve in the `.struct` (primitives are always valid).
9. Fix any obvious errors (typos, mismatched casing). For ambiguous cases, add `// UNCLEAR: ...`.
10. For every `policy` block, verify the `when` condition is not tautological (see Quality Rule 6). If it is, remove the `policy` block and replace with a `// UNCLEAR:` comment.
11. Write a `specy/gaps.report` file. This file has two sections: panel resolution statistics and residual grammar gaps. Always write it (even with zero UNCLEAR) to track panel effectiveness.
   ```
   # Distill Report
   Generated by distill on {date}

   ## Panel Resolutions

   Total ambiguous cases encountered: {n}

   | Verdict | Count | Patterns |
   |---------|-------|----------|
   | → model | {n} | {e.g. uniqueness checks via resolves+is defined, admin auth via policy} |
   | → omit (NOTE) | {n} | {e.g. password hash, MIME validation, missing events} |
   | → UNCLEAR | {n} | {e.g. datetime arithmetic, cross-context query} |

   Resolution rate: {resolved}/{total} ({%})

   ## Grammar Gaps

   Residual UNCLEAR markers: {n} across {n} domains

   ### {pattern name} ({n} occurrences)
   {Why the grammar cannot express it.}
   - {domain}.flow:{line} — {description}
   - {domain}.flow:{line} — {description}
   ```
12. Present a final summary:
   ```
   ## Validation Summary
   - Types resolved: {n}/{total}
   - Dot-paths resolved: {n}/{total}
   - Enum values verified: {n}/{total}
   - Issues corrected: {n}
   - UNCLEAR markers: {n}
   - Files written: {list}
   ```

---

## Creation Mode

When no `specy/*.struct` files exist:

1. Create the `specy/` directory if absent.
2. Execute Phases 1–4 as described above.
3. Write the generated `.struct` and `.flow` files, plus `specy/gaps.report`.
4. Display the final validation summary.
5. Write the `specy/.meta.json` meta file (see Meta File section) with the current HEAD SHA and the filemap of all definitions produced.

---

## Meta File

The meta file `specy/.meta.json` tracks the state of the last distill run. It is written at the end of every run (creation or update) and enables incremental updates.

### Format

```json
{
  "version": 1,
  "lastRun": "2025-01-15T10:30:00Z",
  "gitSha": "abc1234def5678",
  "filemap": {
    "src/models/User.java": ["entity User", "enum UserStatus"],
    "src/models/Order.java": ["entity Order", "entity OrderLine", "enum OrderStatus", "value Money"],
    "src/commands/PlaceOrder.java": ["command PlaceOrder"],
    "src/events/OrderPlaced.java": ["event OrderPlaced"],
    "src/services/OrderService.java": ["interaction PlaceOrder", "policy MaxOrderAmount"],
    "src/services/PricingService.java": ["service PricingCalculator"],
    "src/repositories/OrderRepository.java": ["repository OrderRepository"],
    "src/services/AuthService.java": ["interaction Register", "interaction Login"],
    "src/listeners/AuthListener.java": ["interaction OnUserRegistered"],
    "src/models/Order.java#invariants": ["invariant OrderMustHaveLines"]
  }
}
```

- **`version`**: schema version (currently `1`)
- **`lastRun`**: ISO 8601 timestamp of the last run
- **`gitSha`**: the SHA of the HEAD commit at the time of the last run
- **`filemap`**: mapping from source file (project-relative path) to the list of Specy definitions extracted from it. Each entry uses the format `"type Name"` (e.g. `"entity Order"`, `"interaction PlaceOrder"`). Struct and flow definitions are mixed together.

### When to write

- **Creation mode:** at the end of the run, after writing `.struct` and `.flow` files.
- **Update mode (incremental or full):** at the end of the run, after applying changes.

### .gitignore

`specy/.meta.json` can be committed to the repository (useful for teams sharing incremental state) or added to `.gitignore` (each developer rebuilds their own baseline). Mention this choice to the user on first creation.

---

## Update Mode

When `specy/*.struct` files already exist and the user did NOT specify a definition name, the update mode applies. There are two sub-modes: **incremental** (efficient, delta-based) and **full** (fallback). If the user specified a definition name (e.g. `distill User`), see **Targeted Mode** instead.

**Option `--full`:** when the user invokes `distill --full`, always use full update mode regardless of whether `specy/.meta.json` exists. This is useful to force a complete re-extraction after changing the skill itself or to rebuild specs from scratch without deleting existing files.

### Incremental Update Mode

Applies when `specy/.meta.json` exists AND the saved `gitSha` is reachable in the git history (`git cat-file -t <gitSha>` succeeds).

#### Phase 1 — Differential Reconnaissance

1. **Do not re-read the examples** — the style is already established from the initial creation run.
2. Read `specy/.meta.json` and retrieve the saved `gitSha`.
3. Run `git diff --name-only <gitSha>..HEAD` to get the list of changed files (modified, added, deleted).
4. Cross-reference with the `filemap`:
   - **Modified files** (present in filemap) → to re-extract; the impacted definitions are known from the filemap.
   - **New files** (absent from filemap) → to analyze for potential new definitions.
   - **Deleted files** (present in filemap but no longer on disk) → definitions to mark for deletion.
   - **Non-pertinent files** (not business code: tests, config, CI, docs, migrations, generated code) → ignore.
5. If no pertinent file has changed → display `No changes detected since last run (commit <gitSha>).` and stop.
6. Display a targeted summary:
   ```
   ## Incremental Reconnaissance
   - Last run: commit <savedSha> (<lastRun date>)
   - Current: commit <currentSha>
   - Modified source files: {count} ({list})
   - New source files: {count} ({list})
   - Deleted source files: {count} ({list})
   - Affected definitions: ~{count}
   - Unchanged definitions: {count} (kept as-is from existing specs)
   ```
7. Wait for user validation before proceeding.

#### Phases 2–3 — Targeted Extraction

1. Load the existing `.struct` and `.flow` files as the working base.
2. **Read only the changed and new files** — do not re-read unchanged files.
3. Re-extract only the impacted definitions:
   - **Modified file** (e.g. `User.java`) → re-extract only the definitions listed in the filemap for that file (e.g. `entity User`, `enum UserStatus`). Replace the old definitions in the working base with the new extractions.
   - **New file** (e.g. `Shipping.java`) → extract all new definitions. Add them to the working base.
   - **Deleted file** → propose removal of the corresponding definitions. Ask for explicit confirmation per removal — the code may have moved, not disappeared.
4. Merge the re-extracted definitions with the unchanged definitions to produce the updated specs.
5. **Cascade dependencies:** if an `entity` changes and an unchanged `interaction` references it, **signal** the potential dependency but do not re-read the handler unless the fields referenced in the flow have actually changed. Display:
   ```
   ## Cascade Warning
   - entity Order changed → interaction PlaceOrder references Order (unchanged handler — verify manually if needed)
   ```
6. Present the changes to the user in diff format:
   ```
   ## Proposed Changes — {domain}.struct
   ### Added
   - entity Shipment { ... }
   ### Modified
   - entity User: field email constraint changed from maxLength(50) to maxLength(100)
   - enum UserStatus: added value "suspended"
   ### Removed (pending confirmation)
   - entity TempOrder (source file deleted)
   ```
7. **For additions and modifications:** apply after user confirms.
8. **For removals:** apply only after explicit user confirmation per removal.

#### Phase 4 — Targeted Validation

1. Run cross-validation **only on definitions that changed or were added**, plus any definitions that reference them.
2. Do not re-validate definitions that are strictly unchanged and have no references to changed definitions.
3. Present a validation summary scoped to the delta:
   ```
   ## Validation Summary (incremental)
   - Definitions validated: {n} (of {total})
   - Types resolved: {n}/{n}
   - Dot-paths resolved: {n}/{n}
   - Issues corrected: {n}
   - UNCLEAR markers: {n}
   - Files updated: {list}
   ```

#### End of Run — Meta Update

Write `specy/.meta.json` with:
- `gitSha` set to the current HEAD SHA
- `lastRun` set to the current timestamp
- `filemap` updated: modified entries replaced, new entries added, deleted entries removed

### Full Update Mode (Fallback)

Applies when:
- the user invoked `distill --full`, OR
- `specy/.meta.json` does not exist, OR
- the saved `gitSha` is not reachable in the git history.

Display:
```
Full update mode — re-extracting all definitions from source code.
```
If not triggered by `--full`, also display the reason:
```
Meta file absent or git history unavailable — falling back to full update mode.
```

Then proceed with the full update workflow:

1. Read all existing `.struct` and `.flow` files.
2. Execute Phases 1–3 as described in the main workflow, producing updated versions in memory.
3. Compute diffs between existing and new versions:
   - **Added:** new types, fields, blocks, clauses
   - **Modified:** changed constraints, renamed fields, altered logic
   - **Removed:** types, fields, or blocks present in existing files but absent from code
4. Present the diffs to the user in a clear format:
   ```
   ## Proposed Changes — {domain}.struct
   ### Added
   - entity Shipment { ... }
   - field Order.trackingNumber : string
   ### Modified
   - OrderStatus: added value "returned"
   - Order.totalAmount: changed from int to Money
   ### Removed
   - entity TempOrder (no longer in code)
   ```
5. **For additions and modifications:** apply after user confirms.
6. **For removals:** ask for explicit confirmation per removal — the code may have moved, not disappeared.
7. Run Phase 4 (cross-validation) on the final result.
8. Write the `specy/.meta.json` meta file with the current HEAD SHA and the full filemap, enabling incremental mode for the next run.

---

## Targeted Mode

When `specy/*.struct` and `specy/*.flow` files already exist and the user specifies a definition to re-extract by name. This mode re-extracts a single definition (or a coherent unit of definitions) from the source code without touching anything else.

**Invocation:** `distill <DefinitionName>` — where `DefinitionName` is the name of an entity, interaction, command, event, enum, value, policy, or invariant. For event-triggered interactions, use the event name (e.g. `distill OrderConfirmed`).

**Pre-condition:** existing `.struct` / `.flow` files must be present. If they are not, refuse and ask the user to run a full distill first.

### Phase 1 — Target Resolution

1. Search all existing `specy/*.struct` and `specy/*.flow` files for a definition matching `DefinitionName`.
2. **If found** — identify:
   - The definition type (entity, interaction, command, etc.)
   - The domain / file pair it belongs to (`{domain}.struct` or `{domain}.flow`)
   - The source file from the `// source:` comment preceding the definition
   - If `specy/.meta.json` exists, cross-reference with the `filemap` for additional source files
3. **If not found** — the definition is new. Search the codebase for a matching class, handler, or type:
   - Look for files matching `*{DefinitionName}*` in the project
   - Apply the extraction heuristics to identify what type of definition it should be
   - Identify the bounded context it belongs to from the surrounding code structure
   - If nothing is found, inform the user and stop
4. Determine the **extraction unit** based on the definition type (see below).
5. Display a summary and wait for user confirmation:
   ```
   ## Targeted Extraction
   - Target: {type} {DefinitionName}
   - Source file(s): {list}
   - Extraction unit: {list of definitions to re-extract}
   - Status: {existing — will be updated | new — will be added}
   ```

### Extraction Units

The extraction unit defines what gets re-extracted together. The goal is to maintain internal consistency without re-extracting everything.

**Targeting an entity:**
```
distill User
```
- Re-extract: `entity User`
- Also re-extract: any `enum` or `value` defined in the **same source file** as the entity (they often co-evolve)
- Do NOT re-extract: interactions, commands, events, or definitions from other source files
- Cascade warning: list interactions that `resolves` or `creates` this entity — the user may want to re-extract them too

**Targeting an interaction:**
```
distill PlaceOrder
```
- Re-extract: `interaction PlaceOrder`
- Also re-extract: `command PlaceOrder` (1:1 coupling — the command is the interaction's input contract)
- Also re-extract: every `event` emitted by the interaction (listed in `emits` clauses)
- Do NOT re-extract: resolved entities (they have their own source of truth)
- Cascade warning: list event-triggered interactions triggered by the emitted events

**Targeting a command:**
```
distill PlaceOrder
```
- If a matching interaction exists, treat as "targeting an interaction" (same extraction unit)
- If no matching interaction exists (orphan command), re-extract just the command

**Targeting an event:**
```
distill OrderPlaced
```
- Re-extract: `event OrderPlaced`
- Cascade warning: list interactions that emit it and event-triggered interactions that listen to it

**Targeting an event-triggered interaction:**
```
distill OrderPlaced
```
- If an event-triggered interaction exists with `on OrderPlaced`, re-extract it
- Do NOT re-extract: the triggering event (it has its own source of truth)

**Targeting an enum or value:**
```
distill OrderStatus
```
- Re-extract: `enum OrderStatus` (or `value Money`)
- Cascade warning: list entities and interactions that reference it

**Targeting a policy or invariant:**
```
distill MaxOrderAmount
```
- Re-extract: `policy MaxOrderAmount` (or `invariant OrderMustHaveLines`)

### Phases 2–3 — Scoped Extraction

1. Load the existing `.struct` and `.flow` files as the working base.
2. Read **only** the source file(s) identified in Phase 1 — do not read other source files.
3. Re-extract only the definitions in the extraction unit, following the same rules as the main workflow (Phase 2 for struct, Phase 3 for flow).
4. Compare old vs new for each re-extracted definition:
   - **Modified:** show the diff (field added/removed/changed, constraint changed, clause added/removed)
   - **Unchanged:** report "no changes detected" and stop (do not rewrite the file)
   - **New:** show the full definition to be added
5. Present the changes:
   ```
   ## Proposed Changes — {domain}.struct
   ### Modified
   - entity Order: added field "trackingNumber : string optional maxLength(100)"
   - entity Order: field "totalAmount" type changed from int to Money

   ## Proposed Changes — {domain}.flow
   ### Modified
   - interaction ShipOrder: added sets clause "Order.trackingNumber"
   - interaction ShipOrder: added fails clause "Tracking number already assigned"

   ## Cascade Warning
   - entity Order changed → interaction PlaceOrder, interaction ConfirmOrder reference Order (not re-extracted — verify if needed)
   ```
6. Apply after user confirms.

### Phase 4 — Scoped Validation

1. Run cross-validation **only on the re-extracted definitions**, plus any existing definitions that directly reference them.
2. Verify:
   - All `typeName` references resolve
   - All `dotPath` chains resolve
   - All enum values exist
   - All `sets` clauses reference resolved/created entities
   - No tautological conditions
3. Present a scoped validation summary:
   ```
   ## Validation Summary (targeted)
   - Target: {type} {DefinitionName}
   - Definitions validated: {n}
   - Types resolved: {n}/{n}
   - Dot-paths resolved: {n}/{n}
   - Issues corrected: {n}
   - Files updated: {list}
   ```

### End of Run — Meta Update

If `specy/.meta.json` exists, update only the filemap entries corresponding to the re-extracted definitions. Do not change `gitSha` or `lastRun` — targeted mode is a surgical edit, not a full sync.

---

## Deliberation Panel

When extracting flow constructs, you will encounter conditions, events, or rules where the right modelling choice is not obvious. Instead of mechanically marking them `// UNCLEAR`, run an internal two-voice deliberation.

### The two voices

**Archi** — Reasons in terms of DDD aggregates, bounded context boundaries, and domain vs. infrastructure responsibilities. Asks: *Can this be modelled with the grammar? Is it a domain concern or an infrastructure concern? What construct would represent it?*

**PO** — Reasons in terms of business value and specification readability. Asks: *Is this rule business-critical? Should a product owner see it in the spec? Does omitting it lose important domain knowledge?*

### Protocol

The deliberation is **internal** — it happens in your reasoning, not in the output. The user sees only the result (a modelled construct, an omission with `// NOTE`, or a residual `// UNCLEAR`).

For each ambiguous case:
1. **Archi** gives a position (1 sentence): model, omit, or unclear — with rationale
2. **PO** gives a position (1 sentence): model, omit, or unclear — with rationale
3. **Verdict**: if both agree → apply; if they disagree → the more conservative position wins (model > omit > UNCLEAR)

### Resolved examples

These examples show how the panel handles the most common ambiguous patterns. Use them to calibrate your deliberation.

#### Uniqueness check (e.g. email already exists)

```
// Code: if (await repo.existsByEmail(email)) throw "Email in use"
```

- **Archi**: modelable — `resolves` + `fails when { ... is defined }` using a repository `existsByEmail` operation. This is a domain guard, not infra.
- **PO**: business-critical — duplicate accounts are a core business rule.
- **Verdict**: model.

```
resolves ExistingUser via UserRepository.findByEmail from Register.email
fails "Email already in use" when {
  ExistingUser is defined
}
```

#### Missing domain event

```
// Code: handler mutates user.lastLoginAt but publishes no event
```

- **Archi**: the mutation exists in source code, but no event is published. An event could be inferred, but cardinal rule #1 says do not invent.
- **PO**: user login tracking matters for analytics, but the code doesn't emit it — this is a gap the PO should know about.
- **Verdict**: omit the event (not in code), add a `// NOTE:` signalling the gap.

```
sets User.lastLoginAt to now()
// NOTE: no domain event emitted — consider adding UserLoggedIn if login tracking is a business requirement
```

#### Datetime arithmetic (e.g. edit window)

```
// Code: if (now() - post.createdAt > 5 * 60 * 1000) throw "Edit window expired"
```

- **Archi**: the grammar has no duration/time-arithmetic operators. Cannot model the condition faithfully.
- **PO**: the 5-minute edit window is a core business rule — it must appear in the spec.
- **Verdict**: UNCLEAR — but with a precise description that preserves the business rule.

```
// UNCLEAR: edit window — posts can only be edited within 5 minutes of creation (datetime arithmetic not expressible)
```

#### Infrastructure validation (e.g. password hashing, MIME type)

```
// Code: if (!validMimeType(file.type)) throw "Invalid file type"
```

- **Archi**: MIME validation is infrastructure — it depends on libraries and binary parsing, not domain logic.
- **PO**: the user-facing constraint ("only JPEG/PNG/WebP images") matters, but the mechanism doesn't.
- **Verdict**: omit the `fails` clause, add a `// NOTE`.

```
// NOTE: file type validated at upload (infrastructure — allowed types: JPEG, PNG, WebP)
```

#### Repeated authorization check (e.g. admin-only operations)

```
// Code: if (user.role !== "admin") throw "Forbidden"
// Found in 8 handlers across 3 bounded contexts
```

- **Archi**: this is a cross-cutting rule, not a per-interaction guard. It belongs in a single `policy` block, not repeated in each interaction.
- **PO**: admin authorization is a core access rule — it must be visible but once, not scattered.
- **Verdict**: extract a single policy, remove the repeated `fails` clauses.

```
policy AdminOnly {
  when { User.role != admin }
  then "Only administrators can perform this action"
}
```

#### Cross-context dependency (e.g. messaging checks social connection)

```
// Code: if (connectionService.getStatus(userId, targetId) !== "accepted") throw "Not connected"
// connectionService lives in Social context, handler lives in Messaging context
```

- **Archi**: this is a cross-aggregate, cross-context query — Messaging depends on Social's Connection state. It cannot be modelled within a single bounded context. Signal the architectural dependency.
- **PO**: "users must be connected to exchange messages" is a key business rule — it must be visible even if unmodellable within one context.
- **Verdict**: omit the `fails` clause, add a `// NOTE` that signals both the rule and the dependency.

```
// NOTE: cross-context dependency — requires accepted Connection (Social context) between participants
```

### When to use `// UNCLEAR` (residual)

After panel deliberation, `// UNCLEAR` is reserved for cases where:
- The grammar truly cannot express the condition **and** the business rule is too important to omit
- The code is genuinely ambiguous (unclear intent, missing context)
- Archi and PO disagree and neither position is clearly stronger

Residual `// UNCLEAR` markers signal potential grammar evolution needs — patterns that recur across projects should be considered as candidates for new grammar constructs.

---

## Extraction Heuristics

During Phase 1, identify the project's language and framework, then load the relevant heuristic file based on the detected stack.

### Generic Heuristics (always applied)

# Generic Heuristics (any language/framework)

Always load this file. It provides language-agnostic patterns used as a base for all stacks.

## Naming Patterns

| Source Pattern | Inference |
|---|---|
| Class/module named `*Service`, `*Handler`, `*UseCase`, `*Interactor` | Likely contains `interaction` logic |
| Class/module named `*Repository`, `*Store`, `*Dao` | The generic type it manages is likely an `entity` |
| Class/module named `*Saga`, `*Listener`, `*Subscriber`, `*Consumer` | Likely contains event-triggered `interaction` logic |
| Class/module named `*Policy`, `*Validator`, `*Guard`, `*Rule`, `*Specification` | Likely contains `policy` or `invariant` logic |
| Class/module named `*Event`, `*Message` with past-tense name | Likely an `event` |
| Class/module named `*Command`, `*Request` with imperative name | Likely a `command` |
| CRUD-only code with no explicit events | Run deliberation panel — PO decides if events matter; use `// NOTE` to signal the gap |

## Type Mapping

| Source Type | Specy Primitive |
|---|---|
| `String`, `string`, `str`, `TEXT`, `VARCHAR` | `string` |
| `int`, `Integer`, `Long`, `long`, `Int`, `Short` | `int` |
| `BigDecimal`, `double`, `Double`, `float`, `Float`, `Decimal`, `Number` | `decimal` |
| `boolean`, `Boolean`, `bool`, `Bool` | `boolean` |
| `LocalDate`, `Date`, `date`, `NaiveDate` | `date` |
| `LocalDateTime`, `DateTime`, `Instant`, `Timestamp`, `ZonedDateTime`, `OffsetDateTime` | `datetime` |
| `UUID`, `uuid`, `Uuid`, `GUID` | `uuid` |
| `List<T>`, `ArrayList<T>`, `T[]`, `Array<T>`, `Vec<T>`, `vector`, `[]T` | `list<T>` |
| `Set<T>`, `HashSet<T>`, `TreeSet<T>`, `LinkedHashSet<T>` | `set<T>` |

When a source type does not map to a primitive, check if it corresponds to another domain type (entity, value, enum). If it does, use the Specy typeName. If it is a technical type with no domain meaning (e.g. `HttpRequest`, `Logger`), omit it.

## Services

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Interface or class without state, with business calculation method(s) | `service` block |
| Constructor injection of a non-repository interface | potential `service` |
| Call to a service method inside a command handler | `delegates` clause |
| Service result assigned to an entity field | `sets Entity.field to Service.operation` |

### What to model

- **Model:** business calculations (scoring, pricing, weight), business checks (eligibility, time window), external integrations with business scope (federation, notification)
- **Do not model** (use `// NOTE` instead): pure technical processing (image resize, password hash, compression), infrastructure (logging, cache, rate limiting)
- **Decision criterion:** if the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service

## Repositories

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Interface `I*Repository` / class `*Repository` | `repository` block |
| Method `findById(id)` | `operation findById` |
| Method `findBy*(field)` | `operation findBy*` |
| Method `exists*(field)` / `existsBy*(field)` | `operation exists*` |
| Method `save(entity)` / `create(input)` | `operation save` |
| Method `delete(id)` / `remove(id)` | `operation delete` |
| `repository.findById(cmd.id)` in a handler | `resolves Entity via Repository.findById from Command.field` |
| `repository.findBy*(cmd.field)` in a handler | `resolves Entity via Repository.findBy* from Command.field` |

### Filtering

- **Model**: findById, findByField (used in `resolves`), save, delete, existsBy (used in a guard/check)
- **Do not model** (`// NOTE: query-only`): search, pagination, count for dashboards, aggregations for UI
- **Criterion**: if the operation is called in a use case that produces an `interaction`, it deserves a declaration

### Stack-specific Heuristics

Load the heuristic file matching the detected stack:

| Detection signal | File |
|---|---|
| `.java`, `pom.xml`, `build.gradle`, `@SpringBootApplication`, `@Entity` | Read `heuristics/java-spring.md` |
| `.ts`, `.tsx`, `package.json` + `@nestjs/*`, `tsconfig.json` | Read `heuristics/typescript-nestjs.md` |
| `.clj`, `.cljs`, `deps.edn`, `project.clj`, `lein` | Read `heuristics/clojure.md` |

If no specific stack is detected, rely on the generic heuristics only.

If the project uses a stack not listed here, apply the generic patterns and adapt based on the framework's conventions. Annotate non-obvious mappings with `// NOTE: inferred from {pattern}`.

---

## Flow Constructs

### Expression Rules

# Expressions — Rules, Examples & Anti-Patterns

Transverse rules for all `when { ... }` and `must { ... }` blocks across `fails` clauses, `policy`, and `invariant` constructs.

## Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `isEmpty()`

## Expressible Conditions

Most conditions fall into this category — try to express them **before** resorting to `// UNCLEAR`.

### Status check

```
// Code: if (order.status != "DRAFT") throw ...
fails "Order is not in draft status" when {
  Order.status != draft
}
```

### Empty collection

```
// Code: if (items.length === 0) throw ...
fails "Order has no lines" when {
  isEmpty(Order.lines)
}
```

### String length

```
// Code: if (name.length > 200) throw ...
fails "Product name exceeds 200 characters" when {
  size(CreateProduct.name) > 200
}
```

### Self-reference guard

```
// Code: if (userId === targetUserId) throw ...
fails "Cannot transfer to yourself" when {
  TransferFunds.sourceAccountId = TransferFunds.targetAccountId
}
```

### Ownership check

```
// Code: if (entity.ownerId !== userId) throw ...
fails "Not authorized to cancel this order" when {
  Order.customer.id != CancelOrder.customerId
}
```

### Entity not found

```
// Code: if (!entity) throw ...
fails "Order not found" when {
  Order is not defined
}
```

### Existence / duplicate check

```
// Code: if (await repo.exists(a, b)) throw ...
// Model with resolves + "is defined":
resolves Payment from ProcessPayment.orderId
fails "A payment already exists for this order" when {
  Payment is defined
}
```

## Quick Reference — Expressible Patterns

| Pattern | Expression |
|---|---|
| Self-reference | `Command.fieldA = Command.fieldB` |
| Ownership | `Entity.userId != Command.userId` |
| Status check | `Entity.status != someValue` |
| Duplicate/existence | `resolves` + `fails when { Entity is defined }` |
| Not found | `fails when { Entity is not defined }` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |

## Non-obvious Conditions

When a guard condition does not map directly to an expressible pattern, **run the deliberation panel** (see Deliberation Panel section in the main skill) instead of defaulting to `// UNCLEAR`. Many conditions that appear unexpressible can be modelled with the right approach.

### Conditions that CAN be modelled (common panel resolutions)

| Pattern | Modelling approach |
|---|---|
| Uniqueness check (`repo.existsByEmail`) | `resolves` existing entity via repository operation + `fails when { Entity is defined }` |
| Cross-entity existence (`repo.existsByUserAndTarget`) | same pattern — `resolves` + `is defined` |
| External business check (eligibility, scoring) | `delegates Service.operation` + `fails` on service result |

### Conditions to omit (infrastructure)

| Pattern | Handling |
|---|---|
| Password hashing / strength check | `// NOTE: password validated against strength rules (infrastructure)` |
| Rate limiting | `// NOTE: rate-limited (infrastructure — max N per hour)` |
| MIME type / file size validation | `// NOTE: file validated at upload (infrastructure)` |
| Bot detection / honeypot | `// NOTE: bot detection (infrastructure)` |

### Conditions that remain UNCLEAR (grammar limitation + business-critical)

| Pattern | Why |
|---|---|
| Datetime arithmetic (`now() - createdAt > 5min`) | No duration operator in grammar, but business rule is critical |
| Complex regex with business meaning (banned words) | Algorithmic check with no structural equivalent |

For these: the grammar truly cannot express them **and** the PO voice confirms the rule is too important to omit. Write `// UNCLEAR:` with the full business rule description.

**Never** emit a `fails` clause with a tautological or placeholder expression. If the condition cannot be expressed faithfully, either omit with `// NOTE` (infrastructure) or mark `// UNCLEAR` (grammar gap + business-critical).

## Anti-Patterns

### Tautological expression as placeholder

```
// BAD — email is required, so this is always true
fails "Email already in use" when {
  Register.email is defined
}
```

Never write `field is defined` on a `required` or `immutable` field as a stand-in for a condition you cannot express. A required/immutable field is always defined — this is a tautology. Use `// UNCLEAR:` instead.

### Datetime subtraction with bare number

```
// BAD — the unit is ambiguous
policy OrderModificationWindow {
  when { now() - Order.placedAt > 5 }
  then "Orders can only be modified within 24 hours"
}
```

Use `// UNCLEAR:` with a note about the time window instead.

### Wrong operator for the type

- Never compare a `string` field directly to a number — use `size(field)` for string length checks.
- Never use `count()` on a `string` field — `count()` is for `list<T>` / `set<T>` only.

### Interaction

# Interaction — Rules, Examples & Anti-Patterns

An `interaction` block models a handler triggered by a command (intentional) or an event (reactive). The trigger type is determined by the `on` clause: if it references a `command` defined in the `.struct`, it is intentional; if it references an `event`, it is reactive.

The interaction name is a **string literal** describing the business intent in plain language.

## Structure

### Command-triggered (intentional)

```
interaction "Place a new order" {
  on PlaceOrder
  resolves Customer via CustomerRepository.findById from PlaceOrder.customerId
  creates Order
  fails "Customer is inactive" when {
    Customer.status = inactive
  }
  delegates PricingCalculator.computeTotal
  sets Order.totalAmount to PricingCalculator.computeTotal
  sets Order.status to pending
  emits OrderPlaced
}
```

### Event-triggered (reactive)

```
interaction "Handle payment failure" {
  on PaymentFailed
  resolves Payment from PaymentFailed.paymentId
  then "Notify customer of payment failure"
  then "Allow retry with a different payment method"
  sets Payment.status to failed
}
```

## Clause Rules

### `on` — the trigger typeName

The `on` clause references a `command` or `event` defined in the `.struct`.

**Cardinality:**
- **Command trigger:** exactly one interaction per command (1:1). Never merge multiple commands into one interaction.
- **Event trigger:** zero to many interactions per event (1:N). Multiple handlers for the same event are allowed.

### String label — the interaction name

The string literal after `interaction` describes the business intent in plain language. It is a human-readable label, not a formal identifier. The formal identity of an interaction is its trigger (the `on` typeName).

**Label generation rules for `distill`:**
- Use the method name, javadoc, or class-level comment from the source code when available.
- If nothing meaningful is available, use a default pattern:
  - Command trigger: `"Handle {CommandName}"` (e.g. `"Handle PlaceOrder"`)
  - Event trigger: `"React to {EventName}"` (e.g. `"React to OrderConfirmed"`)
- Labels must be in business language, not technical jargon.

### `resolves` — entities loaded/fetched

There are three resolution patterns. The `from` dotPath identifies the source; the optional `via` clause specifies how the resolution is performed.

#### Pattern 1 — Direct resolution

The `from` dotPath points to a field on the command or event that carries the entity's identity.

```
// Direct — lookup by identity field:
resolves Order from CancelOrder.orderId

// Direct with repository — same lookup, explicit infrastructure path:
resolves User via UserRepository.findById from UpdateProfile.userId
```

#### Pattern 2 — Indirect resolution (forward ref)

The `from` dotPath points to a field on an already-resolved entity. That field carries the identity of the entity to resolve.

```
// The resolved Order has a field that identifies the Payment:
resolves Order via OrderRepository.findById from ShipOrder.orderId
resolves Payment from Order.paymentId

// Chained through a token — each step uses a field from the previous entity:
resolves PasswordResetToken from ResetPassword.token
resolves Customer from PasswordResetToken.customerId
```

#### Pattern 3 — Indirect resolution (reverse ref)

The resolved entity has a field that references the `from` entity. Use `via Entity.field` to name the relationship field explicitly.

```
// Payment has a field `order : Order` — navigate the reverse relationship:
resolves Order from ConfirmOrder.orderId
resolves Payment via Payment.order from Order

// Subscription has a field `customer : Customer` — reverse lookup:
resolves Customer from DeactivateSubscription.customerId
resolves Subscription via Subscription.customer from Customer

// Invoice has a field `order : Order` — reverse lookup:
resolves Order from CloseOrder.orderId
resolves Invoice via Invoice.order from Order
```

#### Decision rule

| Situation | Pattern | Example |
|---|---|---|
| Command/event carries the entity's ID | Direct | `resolves Order from PlaceOrder.orderId` |
| An already-resolved entity carries the ID | Indirect (forward) | `resolves Payment from Order.paymentId` |
| The entity to resolve has a field pointing back to an already-resolved entity | Indirect (reverse) | `resolves Payment via Payment.order from Order` |

#### `via` clause — two uses

The optional `via` clause serves two purposes depending on the dotPath shape:

- **Repository operation:** `via Repository.operation` — specifies the infrastructure method used to load the entity.
- **Relationship field:** `via Entity.field` — specifies the field on the resolved entity that references the `from` entity (reverse-ref pattern).

The two are distinguishable: a repository `via` references a `Repository.operation`, while a relationship `via` references `ResolvedEntity.field` where the entity name matches the `resolves` typeName.

**Every entity you `sets` or reference in a `fails` expression must be explicitly resolved or created.** A `// NOTE: resolved indirectly` comment is NOT a substitute for a `resolves` clause — if the code loads the entity, model it with `resolves`.

This rule applies equally to command-triggered and event-triggered interactions. An event-triggered interaction that `sets Payment.status to failed` must `resolves Payment from PaymentFailed.paymentId`.

### `creates` — entities instantiated

Entities instantiated via `new Entity`, `.save()` on new objects. Every interaction that creates a new entity instance must list it in a `creates` clause — do not omit the primary entity being created.

### `fails` — error conditions

Guard clauses, validation failures, `if (...) throw`. Use a business-language message, not the technical exception name. The `when { expression }` must be a real, evaluable boolean condition — never a tautology.

**Event-triggered interactions can also `fails`.** A reactive handler may fail to process an event (entity not found, condition not met). This reflects the reality of process managers and sagas.

See `constructs/expressions.md` for full expression rules and examples.

### `delegates` — service calls

Place `delegates` after `fails` and before `then`/`sets`. If the result of the service call is assigned to a field, express it with `sets Entity.field to ServiceName.operationName`.

### `then` — informal side effects

Describe the side effect in business language when it cannot be expressed structurally with `sets`/`emits`. Available for both command-triggered and event-triggered interactions.

```
interaction "Notify customer when order is confirmed" {
  on OrderConfirmed
  then "Notify customer that order is confirmed"
  then "Trigger shipment preparation"
}
```

### `sets` — field mutations

Every entity referenced in a `sets` clause must appear in a `resolves` or `creates` clause of the same interaction. If the code updates entities that are not directly resolved (e.g. bulk updates on related records), do not emit a `sets` clause — use a `// NOTE:` comment to describe the side effect instead.

### `emits` — events published/dispatched

List all events published by the handler.

## Clause Ordering

Within an interaction block, clauses follow this order:

1. `on`
2. `resolves`
3. `creates`
4. `fails`
5. `delegates`
6. `then`
7. `sets`
8. `emits`

## Examples

### Command-triggered — full interaction

```
interaction "Place a new order" {
  on PlaceOrder
  resolves Customer from PlaceOrder.customerId
  creates Order
  fails "Customer not found or inactive" when {
    Customer.status != active
  }
  fails "Order has no lines" when {
    isEmpty(PlaceOrder.lines)
  }
  sets Order.status to draft
  sets Order.placedAt to now()
  sets Order.totalAmount to sum(Order.lines.lineTotal)
  emits OrderPlaced
}
```

### Event-triggered — simple notification

```
interaction "Notify customer when order is confirmed" {
  on OrderConfirmed
  then "Notify customer that order is confirmed"
  then "Trigger shipment preparation"
}
```

### Event-triggered — with state mutation

```
interaction "Handle payment failure" {
  on PaymentFailed
  resolves Payment from PaymentFailed.paymentId
  then "Notify customer of payment failure"
  then "Allow retry with a different payment method"
  sets Payment.status to failed
}
```

### Event-triggered — with delegation and chained event

```
interaction "Send shipping notification" {
  on OrderShipped
  resolves Customer from OrderShipped.customerId
  delegates NotificationService.sendShippingNotification
  emits ShippingNotificationSent
}
```

## Anti-Patterns

### Bogus `resolves from` dotPath

```
// BAD — Customer is not resolved from a payment method
resolves Customer from ProcessPayment.method

// BAD — Order is not resolved from a reason text
resolves Order from CancelOrder.reason
```

If the entity is resolved from a field that is not in the command (e.g. only available in the session), add that field to the command first (see Phase 2 rule on command fields), then use it in `resolves`.

### Missing indirect resolution

```
// BAD — sets Customer fields but Customer is not resolved
interaction "Reset user password" {
  on ResetPassword
  resolves PasswordResetToken from ResetPassword.token
  // NOTE: Customer resolved indirectly via token  <- NOT ENOUGH
  sets Customer.password to ResetPassword.newPassword  // <- Customer not in resolves/creates
  sets PasswordResetToken.usedAt to now()
}

// GOOD — Customer explicitly resolved via indirect dotPath
interaction "Reset user password" {
  on ResetPassword
  resolves PasswordResetToken from ResetPassword.token
  resolves Customer from PasswordResetToken.customerId
  sets PasswordResetToken.usedAt to now()
  // NOTE: Customer.password is set to hashed value of ResetPassword.newPassword
}
```

### Merging multiple commands into one interaction

Each command type gets exactly one `interaction` block. Never merge `PlaceOrder` and `ConfirmOrder` into a single interaction.

### Inventing logic not in source code

Every `resolves`, `fails`, `sets`, and `emits` clause must trace to something explicit in the source handler. If you cannot find evidence, do not emit it.

### Event-triggered interaction without an event source

Every event-triggered interaction must have an `on` clause pointing to an existing event in the `.struct`. If the source code does not have an event listener, do not create an interaction. Annotate the missing event pattern with `// UNCLEAR: no event listener found`.

### Technical listeners as interactions

Do not model technical listeners (logging, metrics, cache invalidation) as interactions. Use `// NOTE:` comments instead.

```
// BAD — infrastructure concern
interaction "Log order metrics" {
  on OrderPlaced
  then "Increments order counter in Prometheus"
}

// GOOD — use a comment
// NOTE: OrderPlaced triggers metric recording (infrastructure — not modeled)
```

### Service

# Service — Rules, Examples & Anti-Patterns

A `service` block models a stateless class/interface with business logic. Services are behavioral — they produce blocks in the `.flow`, not in the `.struct`.

## Structure

```
service PricingCalculator {
  operation computeTotal {
    accepts lines : list<OrderLine>
    accepts discountCode : string optional
    returns decimal
    fails "Discount code expired" when {
      Discount.status = expired
    }
    then "Applies volume discounts, coupon reductions, and tax calculations"
  }

  operation evaluateShippingCost {
    accepts weight : decimal
    accepts destination : Address
    returns decimal
    then "Calculates shipping cost based on weight tiers and destination zone"
  }
}
```

## Rules

### One service block per service class/interface

Do not merge multiple service classes into a single block.

### One operation per public method with business logic

For each public method with business logic, create an `operation` inside the service block.

### Clause rules

- `accepts` — parameters of the method (map types using the type mapping table).
- `returns` — return type of the method (if not void).
- `fails` — error conditions thrown by the service method. Same expression rules as interaction `fails` (see `constructs/expressions.md`).
- `then` — describe the business logic in natural language when it cannot be expressed structurally. This is the primary way to document service logic.
- `emits` — events published by the service method.

### Use `then` for unexpressible logic

When a service operation's business logic cannot be captured structurally, describe it with a `then` clause. Use `fails` in operations only when the error condition is formally expressible.

```
// GOOD — logic described in then clause
operation calculateScore {
  accepts applicant : Applicant
  returns int
  then "Computes credit score based on income, debt ratio, and payment history"
}

// BAD — trying to express algorithmic logic structurally
operation calculateScore {
  accepts applicant : Applicant
  returns int
  fails "Score below threshold" when {
    Applicant.income is defined  // <- tautology, not the real condition
  }
}
```

### Service calls in handlers

When a command handler calls a service, add a `delegates ServiceName.operationName` clause in the corresponding `interaction` block. Place `delegates` after `fails` and before `sets`.

If the result of the service call is assigned to a field of an entity, express it with:
```
sets Entity.field to ServiceName.operationName
```

## Anti-Patterns

### Service for pure infrastructure

Do not create `service` blocks for image processing, password hashing, logging, caching, rate limiting, or other purely technical concerns. These are infrastructure, not domain logic. Use `// NOTE:` comments instead.

```
// BAD — infrastructure, not domain logic
service PasswordHasher {
  operation hash {
    accepts password : string
    returns string
  }
}

// GOOD — use a NOTE comment instead
// NOTE: password is hashed using bcrypt before storage
```

### Decision criterion

If the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service. Otherwise, it is likely infrastructure.

**Model:** business calculations (scoring, pricing, weight), business checks (eligibility, time window), external integrations with business scope (federation, notification).

**Do not model** (use `// NOTE` instead): pure technical processing (image resize, password hash, compression), infrastructure (logging, cache, rate limiting).

### Repository

# Repository — Rules, Examples & Anti-Patterns

A `repository` block models a persistence interface for an aggregate root. Repositories are behavioral — they produce blocks in the `.flow`, not in the `.struct`.

## Structure

```
repository OrderRepository {
  for Order

  operation findById {
    accepts id : uuid
    returns Order
  }

  operation findByCustomerId {
    accepts customerId : uuid
    returns list<Order>
  }

  operation save {
    accepts order : Order
  }

  // NOTE: query-only — not modeled
  // operation searchByDateRange — pagination for dashboard
  // operation countByStatus — aggregation for analytics
}
```

## Rules

### One repository block per repository interface/class

### `for` — the aggregate root

The `for` clause must reference an entity (aggregate root), not a value object or an enum.

```
// GOOD
repository OrderRepository {
  for Order
}

// BAD — Money is a value, not an aggregate root
repository MoneyRepository {
  for Money
}
```

### Operations are pure data access

Repository operations contain only `accepts` and `returns` — never `then`, `fails`, `sets`, or `emits`. Business logic belongs in interactions and services, not repositories.

```
// BAD — business logic in a repository
repository OrderRepository {
  for Order
  operation findById {
    accepts id : uuid
    returns Order
    fails "Order not found" when { Order is not defined }  // <- belongs in interaction
  }
}
```

### Only model operations referenced by interactions

Only model operations that are referenced by at least one `resolves ... via` clause or used in an extracted interaction. Do not model query-only methods (pagination, search, aggregation for UI/dashboard).

**Heuristic:** if an operation is not referenced by any `resolves ... via` in the `.flow`, it does not need to be declared. Annotate omissions with `// NOTE: query-only — not modeled`.

### Linking to interactions via `resolves ... via`

For each `repository.findBy*()` call in a command handler, add `via Repository.operation` in the corresponding `resolves` clause:

```
// In the interaction:
resolves Order via OrderRepository.findById from CancelOrder.orderId

// In the repository:
repository OrderRepository {
  for Order
  operation findById {
    accepts id : uuid
    returns Order
  }
}
```

### Filtering guide

| Operation type | Model? |
|---|---|
| `findById`, `findByField` (used in `resolves`) | Yes |
| `save`, `delete` (used in interactions) | Yes |
| `existsBy*` (used in a guard/check) | Yes |
| `search`, `pagination`, `count` (for dashboards) | No — `// NOTE: query-only` |
| `aggregations` (for UI/analytics) | No — `// NOTE: query-only` |

## Anti-Patterns

### Repository for technical types

Do not create `repository` blocks for audit logs, session tokens, or other purely technical persistence concerns — unless they are used in domain interactions.

```
// BAD — technical persistence
repository SessionTokenRepository {
  for SessionToken
}

// BAD — audit infrastructure
repository AuditLogRepository {
  for AuditLog
}
```

### Business logic inside repository

```
// BAD
repository UserRepository {
  for User
  operation deactivate {
    accepts id : uuid
    then "Sets user status to inactive and revokes tokens"  // <- belongs in interaction
  }
}
```

### Policy

# Policy — Rules, Examples & Anti-Patterns

A `policy` block models a cross-cutting domain rule that spans multiple operations or guards multiple commands.

## Structure

```
policy MaxOrderAmount {
  when { Order.totalAmount > 10000 }
  then "Orders exceeding 10,000 require manager approval"
}
```

## Rules

### `when` — evaluable boolean expression

The `when` condition must be a real, evaluable boolean expression — the same tautology prohibition as `fails` applies here. See `constructs/expressions.md` for full expression rules.

If the policy's real condition is not directly expressible, **run the deliberation panel**:
- If the condition is infrastructure (rate limiting, external API) → omit with `// NOTE`
- If the condition involves a grammar gap but is business-critical (datetime arithmetic, cross-context) → `// UNCLEAR` with the full business rule
- Never emit a `policy` block with a placeholder `when` clause

### `then` — consequence in business language

Use domain vocabulary, not technical jargon.

### Scope

Policies are for rules that:
- Span multiple operations (not tied to a single interaction)
- Guard multiple commands with the same condition
- Express domain-wide constraints that don't fit in a single `fails` clause

If a rule only applies to one command handler, it should be a `fails` clause in the corresponding `interaction`, not a policy.

## Examples

### Amount threshold policy

```
policy MaxOrderAmount {
  when { Order.totalAmount > 10000 }
  then "Orders exceeding 10,000 require manager approval"
}
```

### Membership restriction

```
policy PremiumContentAccess {
  when { Customer.membershipLevel = free }
  then "Free members cannot access premium content"
}
```

### Status-based restriction

```
policy SuspendedAccountRestriction {
  when { Account.status = suspended }
  then "Suspended accounts cannot initiate transactions"
}
```

## Anti-Patterns

### Tautological `when` clause — field always defined

```
// BAD — createdAt is immutable pastOrPresent, always defined
policy OrderModificationWindow {
  when { Order.createdAt is defined }
  then "Orders can only be modified within 24 hours of placement"
}
```

The real condition is datetime arithmetic (`now() - createdAt < 24h`). Run the deliberation panel — this is a grammar gap on a business-critical rule → `// UNCLEAR` with the full description.

### Tautological `when` clause — always-true field

```
// BAD — updatedAt being defined does not capture the time window
policy OrderEditDeadline {
  when { Order.updatedAt is defined }
  then "Orders can only be edited within 1 hour"
}
```

### Status check masking a cross-aggregate rule

```
// BAD — condition is a status check, not the actual cross-aggregate rule
policy PaymentRequiredForShipping {
  when { Order.status = confirmed }
  then "A captured payment is required before shipping"
}
```

The real rule involves checking the Payment aggregate, not just Order status. Run the deliberation panel — if the cross-aggregate lookup can be modelled via `resolves`, do so; otherwise `// UNCLEAR`.

### Placeholder expression for complex conditions

```
// BAD — the real condition involves an external API call
policy FraudDetection {
  when { Order.totalAmount > 0 }
  then "Orders must pass fraud screening"
}
```

Run the deliberation panel: fraud screening is typically an infrastructure/external concern → `// NOTE: fraud screening via external API (infrastructure — not modelled)`.

### Invariant

# Invariant — Rules, Examples & Anti-Patterns

An `invariant` block models a structural constraint that must always be true for an entity.

## Structure

```
invariant OrderMustHaveLines {
  on Order
  must { !isEmpty(Order.lines) }
  message "An order must contain at least one line"
}
```

## Rules

### `on` — entities only

The `on` clause must reference an `entity` type, never a `command`, `event`, or `value`. Validation rules on command inputs belong in `fails` clauses of the corresponding `interaction`, not in invariants.

```
// GOOD — invariant on an entity
invariant OrderMustHaveLines {
  on Order
  must { !isEmpty(Order.lines) }
  message "An order must contain at least one line"
}

// BAD — invariant on a command
invariant PlaceOrderMustHaveLines {
  on PlaceOrder
  must { !isEmpty(PlaceOrder.lines) }
  message "Must provide at least one line"
}
```

### `must` — always-true condition

The `must` expression must be a real, evaluable boolean condition that makes sense as a structural guarantee. See `constructs/expressions.md` for expression rules.

### `message` — domain language

Use business vocabulary, not technical jargon.

## Examples

### Non-empty collection

```
invariant OrderMustHaveLines {
  on Order
  must { !isEmpty(Order.lines) }
  message "An order must contain at least one line"
}
```

### Positive amount

```
invariant OrderTotalMustBePositive {
  on Order
  must { Order.totalAmount > 0 }
  message "Order total must be a positive amount"
}
```

### Status consistency

```
invariant ShippedOrderMustHaveTrackingNumber {
  on Order
  must { Order.status != shipped || Order.trackingNumber is defined }
  message "A shipped order must have a tracking number"
}
```

### Balance constraint

```
invariant AccountBalanceNonNegative {
  on Account
  must { Account.balance >= 0 }
  message "Account balance cannot be negative"
}
```

## Anti-Patterns

### Invariant on a command

```
// BAD — input validation belongs in fails clause of the interaction
invariant CreateProductNameRequired {
  on CreateProduct
  must { CreateProduct.name is defined }
  message "Product name is required"
}
```

This should be a `fails` clause in `interaction CreateProduct` instead.

### Invariant on a value object

```
// BAD — value objects are immutable, constraints belong in the struct definition
invariant MoneyMustBePositive {
  on Money
  must { Money.amount > 0 }
  message "Amount must be positive"
}
```

Use a `min(0)` constraint on the field in the `.struct` instead.

### Tautological must clause

```
// BAD — id is a required field, always defined
invariant OrderMustHaveId {
  on Order
  must { Order.id is defined }
  message "Order must have an identifier"
}
```

### Unexpressible invariant

If the invariant's condition cannot be expressed with available operators, do not create an `invariant` block. Use `// UNCLEAR:` instead.

```
// BAD — regex validation cannot be modeled
invariant ValidEmailFormat {
  on Customer
  must { Customer.email is defined }  // <- tautology, not the real check
  message "Email must be valid"
}

// GOOD
// UNCLEAR: invariant not expressible — email must match RFC 5322 format
```

---

## Syntax Reference

### Struct Grammar (.struct files)

```ebnf
// =============================================================================
// Specy — Structural Model Grammar (.struct)
// EBNF (ISO 14977 style)
// =============================================================================

// -----------------------------------------------------------------------------
// Top-level structure
// -----------------------------------------------------------------------------

structFile       = { comment | domainDecl | definition } ;

domainDecl       = "domain" , stringLiteral ;

definition       = entityDef
                 | valueDef
                 | enumDef
                 | commandDef
                 | eventDef ;

// -----------------------------------------------------------------------------
// Entity
// -----------------------------------------------------------------------------

entityDef        = "entity" , typeName , "{" , { comment | fieldDecl } , "}" ;

// -----------------------------------------------------------------------------
// Value Object
// -----------------------------------------------------------------------------

valueDef         = "value" , typeName , "{" , { comment | fieldDecl } , "}" ;

// -----------------------------------------------------------------------------
// Enum
// -----------------------------------------------------------------------------

enumDef          = "enum" , typeName , "{" , enumValue , { enumValue } , "}" ;

enumValue        = identifier ;

// -----------------------------------------------------------------------------
// Command
// -----------------------------------------------------------------------------

commandDef       = "command" , typeName , "{" , { comment | fieldDecl } , "}" ;

// -----------------------------------------------------------------------------
// Event
// -----------------------------------------------------------------------------

eventDef         = "event" , typeName , "{" , { comment | fieldDecl } , "}" ;

// -----------------------------------------------------------------------------
// Fields
// -----------------------------------------------------------------------------

fieldDecl        = fieldName , ":" , fieldType , { constraint } ;

fieldName        = identifier ;

fieldType        = primitiveType
                 | collectionType
                 | typeName ;

primitiveType    = "string"
                 | "int"
                 | "decimal"
                 | "boolean"
                 | "date"
                 | "datetime"
                 | "uuid" ;

collectionType   = ( "list" | "set" ) , "<" , fieldType , ">" ;

// A typeName that is not a primitiveType is a reference to another definition
// (entity, value, enum).
typeName         = pascalCaseId ;

// -----------------------------------------------------------------------------
// Constraints
// -----------------------------------------------------------------------------

constraint       = "required"
                 | "optional"
                 | "unique"
                 | "immutable"
                 | "default" , "(" , literalValue , ")"
                 | "min" , "(" , number , ")"
                 | "max" , "(" , number , ")"
                 | "range" , "(" , number , "," , number , ")"
                 | "minLength" , "(" , integer , ")"
                 | "maxLength" , "(" , integer , ")"
                 | "pattern" , "(" , stringLiteral , ")"
                 | "past"
                 | "future"
                 | "pastOrPresent"
                 | "futureOrPresent" ;

// -----------------------------------------------------------------------------
// Literals and identifiers
// -----------------------------------------------------------------------------

literalValue     = stringLiteral | number | "true" | "false" ;

stringLiteral    = '"' , { character } , '"' ;

number           = [ "-" ] , digit , { digit } , [ "." , digit , { digit } ] ;

integer          = [ "-" ] , digit , { digit } ;

pascalCaseId     = upperLetter , { letter | digit } ;

identifier       = camelCaseId | pascalCaseId ;

camelCaseId      = lowerLetter , { letter | digit } ;

// -----------------------------------------------------------------------------
// Comments
// -----------------------------------------------------------------------------

comment          = "//" , { character } , newline ;

// -----------------------------------------------------------------------------
// Character classes
// -----------------------------------------------------------------------------

upperLetter      = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
                 | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R"
                 | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" ;

lowerLetter      = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i"
                 | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r"
                 | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" ;

letter           = upperLetter | lowerLetter ;

digit            = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;

character        = letter | digit | " " | "!" | "@" | "#" | "$" | "%" | "^"
                 | "&" | "*" | "(" | ")" | "-" | "_" | "=" | "+" | "["
                 | "]" | "{" | "}" | "|" | "\\" | ":" | ";" | "'" | ","
                 | "." | "<" | ">" | "/" | "?" | "~" | "`" ;

newline          = "\n" ;
```

### Flow Grammar (.flow files)

```ebnf
// =============================================================================
// Specy — Interaction Model Grammar (.flow)
// EBNF (ISO 14977 style)
// =============================================================================

// -----------------------------------------------------------------------------
// Top-level structure
// -----------------------------------------------------------------------------

flowFile         = { comment | domainDecl | usesDecl | block } ;

domainDecl       = "domain" , stringLiteral ;

usesDecl         = "uses" , stringLiteral ;

block            = interactionDef
                 | policyDef
                 | invariantDef
                 | serviceDef
                 | repositoryDef ;

// -----------------------------------------------------------------------------
// Interaction — triggered by a command (intentional) or an event (reactive)
//
// The trigger type is determined by the typeName in the `on` clause:
//   - If it resolves to a `command` in the .struct → intentional (1:1)
//   - If it resolves to an `event` in the .struct  → reactive (1:N allowed)
//
// The string literal is a human-readable label describing the intent.
// -----------------------------------------------------------------------------

interactionDef   = "interaction" , stringLiteral , "{"
                 ,   "on" , typeName
                 , { resolvesClause }
                 , { createsClause }
                 , { failsClause }
                 , { delegatesClause }
                 , { thenClause }
                 , { setsClause }
                 , { emitsClause }
                 , "}" ;

// resolves has three resolution patterns:
//   Direct:              resolves Entity from command.fieldId
//                        → lookup by identity field
//   Indirect (forward):  resolves Entity from ResolvedEntity.fieldId
//                        → lookup using a field from an already-resolved entity
//   Indirect (reverse):  resolves Entity via Entity.field from ResolvedEntity
//                        → navigate reverse relationship (Entity.field references ResolvedEntity)
//
// The optional `via` clause has two uses:
//   Repository operation: via Repository.operation (infrastructure path)
//   Relationship field:   via Entity.field         (domain relationship)
resolvesClause   = "resolves" , typeName , [ "via" , dotPath ] , "from" , dotPath ;

createsClause    = "creates" , typeName ;

emitsClause      = "emits" , typeName ;

setsClause       = "sets" , dotPath , "to" , valueExpr ;

failsClause      = "fails" , stringLiteral , "when" , "{" , expression , "}" ;

delegatesClause  = "delegates" , dotPath ;

thenClause       = "then" , stringLiteral ;

// -----------------------------------------------------------------------------
// Service — stateless domain logic
// -----------------------------------------------------------------------------

serviceDef       = "service" , typeName , "{" , { comment | operationDef } , "}" ;

operationDef     = "operation" , identifier , "{"
                 , { acceptsClause }
                 , [ returnsClause ]
                 , { failsClause }
                 , { thenClause }
                 , { setsClause }
                 , { emitsClause }
                 , "}" ;

acceptsClause    = "accepts" , identifier , ":" , fieldType ;

returnsClause    = "returns" , identifier , ":" , fieldType ;

fieldType        = primitiveType
                 | typeName
                 | collectionType ;

primitiveType    = "string" | "int" | "decimal" | "boolean" | "date" | "datetime" | "uuid" ;

collectionType   = ( "list" | "set" ) , "<" , fieldType , ">" ;

// -----------------------------------------------------------------------------
// Repository — data access contract for an entity
// -----------------------------------------------------------------------------

repositoryDef    = "repository" , typeName , "{"
                 ,   "for" , typeName
                 , { comment | repositoryOpDef }
                 , "}" ;

repositoryOpDef  = "operation" , identifier , "{"
                 , { acceptsClause }
                 , [ returnsClause ]
                 , "}" ;

// -----------------------------------------------------------------------------
// Policy — domain-wide rule
// -----------------------------------------------------------------------------

policyDef        = "policy" , typeName , "{"
                 ,   "when" , "{" , expression , "}"
                 ,   "then" , stringLiteral
                 , "}" ;

// -----------------------------------------------------------------------------
// Invariant — structural constraint on an entity
// -----------------------------------------------------------------------------

invariantDef     = "invariant" , typeName , "{"
                 ,   "on" , typeName
                 ,   "must" , "{" , expression , "}"
                 ,   "message" , stringLiteral
                 , "}" ;

// -----------------------------------------------------------------------------
// Expressions
// -----------------------------------------------------------------------------

expression       = orExpr ;

orExpr           = andExpr , { "or" , andExpr } ;

andExpr          = notExpr , { "and" , notExpr } ;

notExpr          = [ "not" ] , comparison ;

comparison       = addExpr , [ compOp , addExpr ] ;

compOp           = "=" | "!=" | ">" | "<" | ">=" | "<=" ;

addExpr          = mulExpr , { ( "+" | "-" ) , mulExpr } ;

mulExpr          = unaryExpr , { ( "*" | "/" ) , unaryExpr } ;

unaryExpr        = dotPath , "is" , "defined"
                 | dotPath , "is" , "not" , "defined"
                 | dotPath , "in" , "{" , valueList , "}"
                 | dotPath , "not" , "in" , "{" , valueList , "}"
                 | functionCall
                 | dotPath
                 | literal
                 | "(" , expression , ")" ;

// -----------------------------------------------------------------------------
// Dot-path: references to fields across the model
// -----------------------------------------------------------------------------

dotPath          = identifier , { "." , identifier } ;

// -----------------------------------------------------------------------------
// Value expressions (right-hand side of sets...to, comparisons, etc.)
// -----------------------------------------------------------------------------

valueExpr        = functionCall
                 | dotPath
                 | literal ;

valueList        = valueExpr , { "," , valueExpr } ;

// -----------------------------------------------------------------------------
// Built-in functions
// -----------------------------------------------------------------------------

functionCall     = functionName , "(" , [ argList ] , ")" ;

argList          = expression , { "," , expression } ;

functionName     = "count"
                 | "sum"
                 | "now"
                 | "today"
                 | "size"
                 | "isEmpty"
                 | "isNotEmpty" ;

// -----------------------------------------------------------------------------
// Literals
// -----------------------------------------------------------------------------

literal          = stringLiteral | number | "true" | "false" ;

stringLiteral    = '"' , { character } , '"' ;

number           = [ "-" ] , digit , { digit } , [ "." , digit , { digit } ] ;

// -----------------------------------------------------------------------------
// Identifiers
// -----------------------------------------------------------------------------

typeName         = pascalCaseId ;

identifier       = camelCaseId | pascalCaseId ;

pascalCaseId     = upperLetter , { letter | digit } ;

camelCaseId      = lowerLetter , { letter | digit } ;

// -----------------------------------------------------------------------------
// Comments
// -----------------------------------------------------------------------------

comment          = "//" , { character } , newline ;

// -----------------------------------------------------------------------------
// Character classes
// -----------------------------------------------------------------------------

upperLetter      = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
                 | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R"
                 | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" ;

lowerLetter      = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i"
                 | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r"
                 | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" ;

letter           = upperLetter | lowerLetter ;

digit            = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;

character        = letter | digit | " " | "!" | "@" | "#" | "$" | "%" | "^"
                 | "&" | "*" | "(" | ")" | "-" | "_" | "=" | "+" | "["
                 | "]" | "{" | "}" | "|" | "\\" | ":" | ";" | "'" | ","
                 | "." | "<" | ">" | "/" | "?" | "~" | "`" ;

newline          = "\n" ;
```

---

## Canonical Examples

### orders.struct

```specy
domain "Orders"

// =============================================================================
// Enums
// =============================================================================

enum OrderStatus {
  draft
  confirmed
  shipped
  delivered
  cancelled
}

enum PaymentStatus {
  pending
  captured
  failed
  refunded
}

enum PaymentMethod {
  creditCard
  bankTransfer
  paypal
}

enum CustomerStatus {
  active
  suspended
  closed
}

// =============================================================================
// Value Objects
// =============================================================================

value Address {
  street : string
  city : string
  zipCode : string maxLength(10)
  country : string
}

value Money {
  amount : decimal min(0)
  currency : string default("EUR") maxLength(3)
}

value EmailAddress {
  value : string pattern("^[^@]+@[^@]+\\.[^@]+$")
}

// =============================================================================
// Entities
// =============================================================================

entity Customer {
  id : uuid unique immutable
  name : string minLength(1) maxLength(100)
  email : EmailAddress unique
  status : CustomerStatus default("active")
  birthDate : date optional past
  shippingAddress : Address optional
  createdAt : datetime immutable pastOrPresent
}

entity Product {
  id : uuid unique immutable
  name : string minLength(1) maxLength(200)
  description : string optional maxLength(2000)
  price : Money
  tags : set<string> optional
  rating : int optional range(1, 5)
  available : boolean default("true")
}

entity OrderLine {
  id : uuid unique immutable
  product : Product
  quantity : int required min(1) max(1000)
  unitPrice : Money
  lineTotal : Money
}

entity Order {
  id : uuid unique immutable
  customer : Customer
  lines : list<OrderLine>
  status : OrderStatus default("draft")
  totalAmount : Money
  shippingAddress : Address
  estimatedDelivery : date optional futureOrPresent
  requiredDeliveryBy : date optional future
  placedAt : datetime optional pastOrPresent
  confirmedAt : datetime optional pastOrPresent
  shippedAt : datetime optional pastOrPresent
  deliveredAt : datetime optional pastOrPresent
  cancelledAt : datetime optional pastOrPresent
  createdAt : datetime immutable pastOrPresent
}

entity Payment {
  id : uuid unique immutable
  order : Order
  amount : Money
  method : PaymentMethod
  status : PaymentStatus default("pending")
  processedAt : datetime optional pastOrPresent
  failureReason : string optional maxLength(500)
  createdAt : datetime immutable pastOrPresent
}

// =============================================================================
// Commands
// =============================================================================

command PlaceOrder {
  customerId : uuid
  lines : list<OrderLine>
  shippingAddress : Address
}

command ConfirmOrder {
  orderId : uuid
}

command CancelOrder {
  orderId : uuid
  reason : string optional maxLength(500)
}

command ProcessPayment {
  orderId : uuid
  method : PaymentMethod
}

command RefundPayment {
  paymentId : uuid
  reason : string optional maxLength(500)
}

command ShipOrder {
  orderId : uuid
  trackingNumber : string optional maxLength(100)
}

command DeliverOrder {
  orderId : uuid
}

// =============================================================================
// Events
// =============================================================================

event OrderPlaced {
  orderId : uuid
  customerId : uuid
  totalAmount : Money
  placedAt : datetime
}

event OrderConfirmed {
  orderId : uuid
  confirmedAt : datetime
}

event OrderCancelled {
  orderId : uuid
  reason : string optional
  cancelledAt : datetime
}

event OrderShipped {
  orderId : uuid
  shippedAt : datetime
  trackingNumber : string optional
}

event OrderDelivered {
  orderId : uuid
  deliveredAt : datetime
}

event PaymentProcessed {
  paymentId : uuid
  orderId : uuid
  amount : Money
  method : PaymentMethod
  processedAt : datetime
}

event PaymentFailed {
  paymentId : uuid
  orderId : uuid
  reason : string
  failedAt : datetime
}

event PaymentRefunded {
  paymentId : uuid
  orderId : uuid
  amount : Money
  reason : string optional
  refundedAt : datetime
}
```

### orders.flow

```specy
domain "Orders"
uses "orders.struct"

// =============================================================================
// Interactions — command-triggered (intentional)
// =============================================================================

interaction "Place a new order" {
  on PlaceOrder

  resolves Customer from PlaceOrder.customerId
  creates Order

  fails "Customer not found or inactive" when {
    Customer.status != active
  }

  fails "Order has no lines" when {
    isEmpty(PlaceOrder.lines)
  }

  fails "Some products are unavailable" when {
    PlaceOrder.lines.product.available != true
  }

  sets Order.status to draft
  sets Order.placedAt to now()
  sets Order.totalAmount to sum(Order.lines.lineTotal)

  emits OrderPlaced
}

interaction "Confirm an order after payment" {
  on ConfirmOrder

  resolves Order from ConfirmOrder.orderId
  resolves Payment via Payment.order from Order

  fails "Order is not in draft status" when {
    Order.status != draft
  }

  fails "Order has not been placed yet" when {
    Order.placedAt is not defined
  }

  fails "Payment not yet captured" when {
    Payment.status != captured
  }

  sets Order.status to confirmed
  sets Order.confirmedAt to now()

  emits OrderConfirmed
}

interaction "Cancel an order" {
  on CancelOrder

  resolves Order from CancelOrder.orderId

  fails "Order cannot be cancelled" when {
    Order.status not in {draft, confirmed}
  }

  sets Order.status to cancelled
  sets Order.cancelledAt to now()

  emits OrderCancelled
}

interaction "Process payment for an order" {
  on ProcessPayment

  resolves Order from ProcessPayment.orderId
  creates Payment

  fails "Order is not in draft status" when {
    Order.status != draft
  }

  sets Payment.status to captured
  sets Payment.processedAt to now()
  sets Payment.method to ProcessPayment.method
  sets Payment.amount to Order.totalAmount

  emits PaymentProcessed
}

interaction "Refund a captured payment" {
  on RefundPayment

  resolves Payment from RefundPayment.paymentId

  fails "Payment is not captured" when {
    Payment.status != captured
  }

  fails "Order is not cancelled" when {
    Payment.order.status != cancelled
  }

  sets Payment.status to refunded

  emits PaymentRefunded
}

interaction "Ship a confirmed order" {
  on ShipOrder

  resolves Order from ShipOrder.orderId
  resolves Payment via Payment.order from Order

  fails "Shipping address is missing" when {
    not (Order.shippingAddress is defined)
  }

  fails "Order is not confirmed or payment not captured" when {
    (Order.status != confirmed) or (Payment.status != captured)
  }

  sets Order.status to shipped
  sets Order.shippedAt to now()

  emits OrderShipped
}

interaction "Deliver a shipped order" {
  on DeliverOrder

  resolves Order from DeliverOrder.orderId

  fails "Order is not shipped" when {
    Order.status != shipped
  }

  sets Order.status to delivered
  sets Order.deliveredAt to now()

  emits OrderDelivered
}

// =============================================================================
// Interactions — event-triggered (reactive)
// =============================================================================

interaction "Notify customer when order is confirmed" {
  on OrderConfirmed

  then "Notify customer that order is confirmed"
  then "Trigger shipment preparation"
}

interaction "Handle payment failure" {
  on PaymentFailed

  resolves Payment from PaymentFailed.paymentId

  then "Notify customer of payment failure"
  then "Allow retry with a different payment method"

  sets Payment.status to failed
}

interaction "Handle order cancellation side effects" {
  on OrderCancelled

  then "Notify customer that order is cancelled"
  then "Restore product stock for each order line"
}

interaction "Notify customer of refund" {
  on PaymentRefunded

  then "Notify customer that refund has been processed"
}

interaction "Notify customer of delivery" {
  on OrderDelivered

  then "Notify customer that order has been delivered"
  then "Close order lifecycle"
}

// =============================================================================
// Policies — domain-wide rules
// =============================================================================

policy MaxOrderAmount {
  when {
    Order.totalAmount.amount > 10000
  }
  then "Orders above 10000 require manual approval before confirmation"
}

policy InactiveCustomerBlocked {
  when {
    Customer.status = suspended or Customer.status = closed
  }
  then "Suspended or closed customers cannot place new orders"
}

policy MinimumOrderAmount {
  when {
    Order.totalAmount.amount < 1
  }
  then "Orders must have a total amount of at least 1"
}

policy UnavailableProductBlocked {
  when {
    Product.available = false
  }
  then "Unavailable products cannot be added to orders"
}

policy LateDeliveryAlert {
  when {
    (Order.status = confirmed or Order.status = shipped) and Order.estimatedDelivery <= today()
  }
  then "Orders past their estimated delivery date require attention"
}

policy MaxOrderLines {
  when {
    count(Order.lines) > 20
  }
  then "Orders with more than 20 lines require manual review"
}

// =============================================================================
// Invariants — structural constraints on entities
// =============================================================================

invariant OrderMustHaveLines {
  on Order
  must {
    isNotEmpty(Order.lines)
  }
  message "An order must contain at least one line"
}

invariant OrderTotalMustBePositive {
  on Order
  must {
    Order.totalAmount.amount >= 0
  }
  message "Order total amount must not be negative"
}

invariant PaymentAmountMustMatchOrder {
  on Payment
  must {
    Payment.amount.amount = Payment.order.totalAmount.amount
  }
  message "Payment amount must equal the order total"
}

invariant OrderLineMustHavePositiveQuantity {
  on OrderLine
  must {
    OrderLine.quantity > 0
  }
  message "Order line quantity must be greater than zero"
}

invariant OrderLineTotal {
  on OrderLine
  must {
    OrderLine.lineTotal.amount = OrderLine.unitPrice.amount * OrderLine.quantity
  }
  message "Line total must equal unit price multiplied by quantity"
}
```

---

## Quality Rules

### General

1. **No invention.** Every element in the output must be traceable to source code. If you cannot find it in the code, do not write it. Use `// UNCLEAR: ...` for ambiguous cases.
2. **Enum values in camelCase.** Every enum value must be a valid `camelCaseId` (starts with a lowercase letter, no underscores). Convert `UPPER_SNAKE_CASE` from source code: `ACCOUNT_CREATED` → `accountCreated`, `PENDING` → `pending`.
3. **Enum values verified.** Every enum value used in a `.flow` expression (e.g. `Order.status != draft`) must exist in the corresponding `enum` definition in the `.struct`.
4. **Dot-paths resolved.** Every `dotPath` in the `.flow` must chain through fields that exist in the `.struct`. `Order.totalAmount.amount` requires `Order` to have a `totalAmount` field of type `Money`, and `Money` to have an `amount` field.
5. **Expressions must be valid.** See the Expression Rules section above for the complete rules on `when`/`must` expressions, tautology prohibition, and operator usage.
6. **No `null` literal.** The grammar has no `null` value. If the code sets a field to null, express it with a `// NOTE:` comment instead of `sets ... to null`.
7. **Business-language messages.** Failure messages, policy consequences, and invariant messages must use domain vocabulary, not technical jargon. Write `"Customer not found or inactive"`, not `"EntityNotFoundException"`.
8. **Preserve source vocabulary.** Use the same names as the code: if the code says `Order`, write `Order`, not `PurchaseOrder`. If the code says `cancel`, write `cancel`, not `abort`.
9. **No technical artifacts.** Do not include framework-specific types, infrastructure code, or ORM metadata in the output. Extract only domain concepts. Specifically exclude:
    - **OAuth/auth infrastructure:** entities storing client IDs, client secrets, access tokens, refresh tokens (e.g. `OAuthApp { clientId, clientSecret }`). If OAuth/federation is a domain concept, model the *connection* (user linked to external service) but omit the token storage details.
    - **Monitoring/analytics entities:** access counters, IP tracking, usage metrics (e.g. `ApiMetrics { requestCount, lastRequestIp }`).
    - **Technical token fields on domain entities:** fields like `accessToken`, `refreshToken`, `sessionJwt` on a domain entity are infrastructure concerns. Omit them. Keep the *domain-meaningful* fields (e.g. `externalHandle`, `externalId`) that represent the business relationship.
10. **Field ordering.** Within an entity or value, order fields: identity fields first (id, uuid), then required fields, then optional fields. Within each group, keep the order from the source code.
11. **Section separators.** Use `// ===` comment blocks to separate sections (enums, values, entities, commands, events in `.struct`; command-triggered interactions, event-triggered interactions, policies, invariants in `.flow`), matching the style in the canonical examples.
12. **Minimal output.** Do not add fields, constraints, or blocks that are not evidenced by the code. When in doubt, omit rather than invent.
13. **Query-only entities.** If an entity defined in the `.struct` has no corresponding write interaction in the `.flow` (it is only read, never created or mutated by a command handler), annotate it in the `.struct` with `// NOTE: query-only — no write interaction found`. This signals a deliberate observation, not an omission.
14. **Enums without flow references.** If an enum is defined in the `.struct` but never referenced in any `.flow` expression, annotate it with `// NOTE: not referenced in flow — used for queries/UI only`. Do not omit it from the struct (it is still part of the domain vocabulary), but flag it.

### Construct-specific

Rules specific to each flow construct are documented in the Flow Constructs section above. Key rules per construct:

- **Interaction (command-triggered):** one per command, `creates` must list all created entities, label describes intent. See the Interaction section.
- **Interaction (event-triggered):** 0 to N per event, label describes intent. See the Interaction section.
- **Service:** use `then` for unexpressible logic, no service for pure infrastructure. See the Service section.
- **Repository:** pure data access only (no `then`/`fails`/`sets`/`emits`), `for` must be aggregate root, no repository for technical types. See the Repository section.
- **Policy:** real `when` condition required, no tautologies. See the Policy section.
- **Invariant:** `on` entities only, never commands/events/values. See the Invariant section.

---

## Edge Cases

### Anemic Models (CRUD without business logic)
When entities are plain data holders with no validation or business rules, look for logic in services, controllers, and middleware. The business rules may live outside the model classes. If truly no rules exist, produce a minimal `.struct` with the entities and a `.flow` with basic CRUD interactions, and annotate: `// NOTE: anemic model — business logic may be elsewhere`.

### Multiple Bounded Contexts
If the codebase contains distinct domains (e.g. Orders, Inventory, Shipping), produce a separate `.struct` / `.flow` pair for each. Name them `orders.struct`, `inventory.struct`, etc.

### Shared Types Across Contexts
If a type (e.g. `Money`, `Address`) is used in multiple bounded contexts, duplicate it in each `.struct` file. Each context must be self-contained.

### Generated Code
Ignore generated code (protobuf stubs, ORM migrations, GraphQL types, Swagger DTOs) unless it reveals domain concepts not found elsewhere. Annotate with `// NOTE: extracted from generated code`.

### Tests as a Source of Truth
Read test files — they often encode business rules more explicitly than production code. Test assertions like `assertThrows(...)` or `expect(...).toThrow(...)` reveal `fails` conditions. Test setup reveals entity creation patterns.

### Large Projects
If the project has more than ~50 model classes or ~30 service classes, ask the user to scope the extraction to a specific bounded context or module before proceeding. Do not attempt to extract everything at once.

### Missing Events
When a command handler mutates state but does not publish an event, run the deliberation panel. The PO voice decides whether the event matters for the business. Do not invent events (cardinal rule #1), but signal the gap with `// NOTE: no domain event emitted — consider adding {SuggestedEventName} if {business reason}`.

### Ambiguous Conditions
When a guard condition is not straightforwardly expressible, run the deliberation panel (see Deliberation Panel section). Do not default to `// UNCLEAR` — many conditions can be modelled with `resolves` + `is defined`, repository operations, or service delegates. Only mark `// UNCLEAR` when the panel cannot find a faithful modelling approach.

### Inheritance and Polymorphism
When entities use inheritance (e.g. `Payment` → `CreditCardPayment`, `BankTransferPayment`):
- If the subtypes differ only in a type field → model as a single entity with an enum field. Add `// NOTE: collapsed inheritance hierarchy into enum`.
- If the subtypes have genuinely different fields → model as separate entities. Add `// NOTE: split from inheritance hierarchy`.
- Document the choice with a comment so the user can review.
