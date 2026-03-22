<!-- TEMPLATE — run build.sh to generate skills/distill/SKILL.md -->

---
name: distill
description: Reverse-engineers source code into Specy .domain.specy files
user-invocable: true
---

# Skill: distill

## Role

You are an expert Domain-Driven Design practitioner who reverse-engineers existing source code into Specy specification files. You extract the business logic — entities, value objects, commands, events, operations, policies, and invariants — from a codebase and express them in a unified `.domain.specy` file.

---

## Decision Tests

Before emitting any element, run these 4 sequential tests. They replace ad-hoc anti-pattern lists with a systematic decision framework.

<!-- include: constructs/decision-tests.md -->

---

## Output Conventions

- **Directory:** all generated files go into `specy/` at the project root.
- **Naming:** `{domain}.domain.specy` — domain name in lowercase. Single unified file per bounded context.
- **Header:** starts with `module Name`. Cross-module dependencies: `uses module Name`.
- **Multiple bounded contexts:** one `.domain.specy` per context.
- **Encoding:** UTF-8, LF line endings, no trailing whitespace.
- **Enum values:** always `camelCase`. Convert `UPPER_SNAKE_CASE` from source: `PENDING` → `pending`, `ACCOUNT_CREATED` → `accountCreated`.
- **Source traceability:** every definition must have a `// source: path/to/file.ext` comment. For operations spanning multiple files, reference the file with business logic.
- **Order in file:** `module` → `uses` → enums → value objects → services → file-level policies → entities (with inline references, policies, invariants, operations, transitions) → commands → events. Within each section, alphabetical or dependency order.
- **Section separators:** use `// ===` comment blocks between sections, matching the canonical example.
- **Field ordering:** identity fields first, then required, then optional. Within each group, keep source order.
- **No `null` literal.** The grammar has no `null`. Use `// NOTE:` instead of `sets ... to null`.
- **Business-language messages.** Use domain vocabulary, not technical jargon.
- **Preserve source vocabulary.** Use the same names as the code.
- **Distill Report:** always write `specy/gaps.report` (see Phase 3).
- **Identifier block:** entities use `identifier fieldName : type` before the `fields` block.
- **Fields wrapper:** all field declarations go inside `fields { }` blocks (entities, values, commands, events).
- **References block:** entity references with cardinality go in `references { }` blocks. Cardinality uses `N..M` notation (e.g., `1..1`, `1..N`).
- **Scoped policies:** entity or value policies go inside `policies { }` blocks without repeating the `policy` keyword on each entry.
- **Scoped invariants:** entity or value invariants go inside `invariants { }` blocks without repeating the `invariant` keyword on each entry.
- **Justification operator:** use `::` to attach business reasons to constructs (e.g., `entity Order :: "A customer order" { ... }`).

---

## Workflow

Three sequential phases. Print a summary at the end of each phase for user validation.

### Phase 1 — Reconnaissance

1. Study the canonical example below to calibrate output style.
2. Explore the project tree. Identify language, framework, layout.
3. Locate key code areas: models/entities, handlers/services, events, repositories, validators/policies, test suites (integration, acceptance, BDD).
4. Identify modules and propose domain name(s).
5. **Build module dependency graph.** For each identified module, scan source code imports and type references (annotations, foreign keys, field types) to determine which modules depend on which. Construct a directed dependency graph.
6. **Compute distillation order.** Topological sort on the dependency graph → distillation layers. Modules without dependencies are in layer 0. Modules depending only on layer 0 are in layer 1, etc. Modules within the same layer can be distilled in parallel.
   - **Cycles:** if circular dependencies exist between modules, group them in the same layer. Flag the cycle in the summary — these modules will produce `// NOTE` for cross-references within the cycle, resolved by a localized post-extraction patch limited to the cycle.
7. Print reconnaissance summary:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework: {framework}
   - Modules identified: {list}
   - Models found: {count} — Handlers/Services: {count} — Events: {count} — Test suites: {count}
   - Module dependency graph:
     Layer 0: {modules} (no dependencies)
     Layer 1: {modules} (depends on: {modules})
     Layer 2: {modules} (depends on: {modules})
     ...
     {Cycles: {modules} (grouped in layer N)} — if any
   - Distillation order: Layer 0 → Layer 1 → ...
   - Mode: {creation | update}
   ```
8. Determine mode:
   - If the user specified a definition name → **targeted mode**.
   - If `--full` flag → **full update mode**.
   - If `specy/.meta.json` exists and `gitSha` is reachable → **incremental update mode**.
   - Otherwise → **full update mode**.
9. Wait for user confirmation.

### Phase 2 — Extraction

Extraction proceeds **layer by layer** following the dependency graph from Phase 1. Modules within the same layer are extracted in parallel. Each layer completes before the next begins.

**Before extracting a module**, the sub-agent receives a **type summary** of all modules from previous layers. The type summary is a compact listing of exported types — enough to declare `references { }` and resolve dot-paths, not the full `.domain.specy`:

```
// Type summary — module Office (layer 0)
entity Office { identifier id : int, fields { name : string, openingDate : date } }

// Type summary — module Client (layer 1)
entity Client { identifier id : int, fields { status : ClientStatus, activationDate : date, ... } }
enum ClientStatus { pending, active, closed, ... }
```

**Cross-module references:** when the source code contains a reference to a type from another module (e.g., `@ManyToOne private Office office`), and that type appears in the type summary of a previous layer, declare it as a real `references { }` entry and add `uses module`. Do not use `// NOTE` for types that are in the type summary. Reserve `// NOTE` for types not modelled in any module (CodeValue, AppUser, Staff, etc.).

For each module:

1. Read every model/entity/data class. **Classify** using Decision Test 4 + extraction heuristics.
2. **Map fields** to Specy primitives (see type mapping in generic heuristics). Map collections to `list<T>` / `set<T>`. Map references to domain types by Specy typeName.
3. **Extract constraints** from annotations, decorators, validation rules.
4. **Extract entity references** with cardinality → `references { }` block. Use the type summary to resolve cross-module references as real declarations.
5. Read every handler, service, listener, saga, policy file.
6. **For each command handler** → entity operation (command-triggered: `"Label" on CommandType { ... }`). For each service call → direct `Service.op(args)`. For each entity resolution → `resolves Entity from dotPath`.
7. **For each event listener** → entity operation (event-triggered: `"Label" when EventType then CommandType { ... }`). Skip technical listeners (logging, metrics, cache).
8. **Preconditions guarding operations** → `policy` definitions. Decide placement: file-level `policy` for cross-entity preconditions, entity-scoped inside `policies { }` for entity-specific preconditions. **Properties always true after mutation** → `invariant` definitions inside entity-scoped or value-scoped `invariants { }` blocks. When a policy references a field from a cross-module entity reachable via a declared reference, use dot-path traversal (e.g., `group.office.openingDate`) or `every` over a collection reference instead of `// UNCLEAR`.
9. **Extract commands** with fields inside `fields { }`. **Extract events** with fields inside `fields { }`. Include every parameter from handler/service method signature, even session-sourced (annotate with `// from authenticated session`).
10. **Derive transitions** from status enum + operation flow → `transitions { }` block inside entity. Use `[*] --> state on "label"` for initial transitions, `state --> state on "label"` for subsequent ones.
11. **Test-aware enrichment:** for each extracted operation, read associated test files (correlated by naming convention or imports — see test heuristics). Use test assertions to confirm or enrich `policy` calls, `sets` blocks, `emits` blocks, and service calls. Use test names as candidate operation labels when they are more expressive than handler method names. When 2+ tests target the same handler with different preconditions and different assertions, consider decomposing into separate operations with complementary guards.
12. **After each layer completes**, build the type summary for this layer (module name → list of entity/value/enum names with identifier and field names). This summary is passed to sub-agents of the next layer.
13. Write `.domain.specy` and print summary:
    ```
    ## Extraction — {domain}
    Enums: {n} | Values: {n} | Entities: {n} | Services: {n} | Commands: {n} | Events: {n}
    Operations (cmd): {n} | Operations (evt): {n} | Operations (internal): {n}
    Policies (file): {n} | Policies (entity): {n} | Invariants: {n} | UNCLEAR: {n}
    Cross-module references declared: {n} | Cross-module references NOTE'd: {n}
    ```

### Phase 3 — Cross-Validation

1. Verify every `typeName` resolves within the file or via `uses module`.
2. Verify every `dotPath` chain resolves through the structural definitions, including cross-module dot-paths through declared references.
3. Verify every enum value in expressions exists in the enum definition.
4. Verify every `resolves` target entity has the referenced `from` field.
5. Verify every `sets`/`creates` entity is resolved or created in the same operation.
6. Verify every service call resolves to a `service` + `operation` in the file.
7. Verify every policy call resolves to a named policy (file-level or entity-scoped).
8. Verify every `emits` type exists as a top-level `event`.
9. Verify every operation label in `transitions` exists in `operations`.
10. Verify `references` cardinalities match the structural model.
11. Verify every `uses module X` is justified by at least one `references { }` entry pointing to a type in module X. Remove unjustified imports.
12. **Test confirmation:** when a test assertion confirms an extracted behaviour (`policy` call, `sets`, `emits`, service call), treat it as validation. When a test asserts a behaviour absent from the extraction, flag it for review — the extraction may be incomplete.
13. Fix obvious errors. For ambiguous cases → `// UNCLEAR`.
14. Write `specy/gaps.report`:
    ```
    # Distill Report — {date}

    ## Panel Resolutions
    Total ambiguous cases: {n}
    | Verdict | Count | Patterns |
    |---------|-------|----------|
    | → model | {n} | {patterns} |
    | → omit (NOTE) | {n} | {patterns} |
    | → UNCLEAR | {n} | {patterns} |
    Resolution rate: {resolved}/{total} ({%})

    ## Grammar Gaps
    Residual UNCLEAR markers: {n}
    ### {pattern} ({n} occurrences)
    {Why the grammar cannot express it.}
    ```
14. Print validation summary:
    ```
    ## Validation Summary
    Types: {n}/{n} | Dot-paths: {n}/{n} | Enums: {n}/{n} | Policies: {n}/{n} | Services: {n}/{n} | Transitions: {n}/{n} | Corrected: {n} | UNCLEAR: {n}
    Files written: {list}
    ```

---

## Creation Mode

When no `specy/*.domain.specy` files exist:

1. Create `specy/` directory if absent.
2. Execute Phases 1–3.
3. Write `.domain.specy` and `gaps.report`.
4. Write `specy/.meta.json` (see Meta File section).

---

## Meta File

`specy/.meta.json` tracks the state of the last distill run. Written at the end of every run.

```json
{
  "version": 1,
  "lastRun": "2025-01-15T10:30:00Z",
  "gitSha": "abc1234def5678",
  "filemap": {
    "src/models/User.java": ["entity User", "enum UserStatus"],
    "src/services/OrderService.java": ["operation Order.PlaceOrder", "policy MaxOrderAmount"],
    "src/listeners/OrderListener.java": ["operation Order.NotifyOrderConfirmation"]
  }
}
```

- **`version`**: schema version (currently `1`)
- **`lastRun`**: ISO 8601 timestamp
- **`gitSha`**: HEAD commit SHA at time of run
- **`filemap`**: source file → list of Specy definitions (`"type Name"`)

Can be committed or `.gitignore`d — mention this choice on first creation.

---

## Update Modes

Three modes share a common structure: load existing files → extract the delta → present diffs → validate → write `.meta.json`. They differ in the **scope** of the delta.

### Common diff presentation

For all modes, present changes before applying:

```
## Proposed Changes — {domain}.domain.specy
### Added
- entity Shipment { ... }
### Modified
- entity User: field email constraint changed
### Removed (pending confirmation)
- entity TempOrder (source file deleted)
```

**Additions and modifications:** apply after user confirms.
**Removals:** ask for explicit confirmation per removal (code may have moved).

### Incremental Update Mode

Applies when `specy/.meta.json` exists AND `gitSha` is reachable.

1. **Differential recon:** `git diff --name-only <savedSha>..HEAD`. Cross-reference with filemap → modified, new, deleted files. Skip non-business files (config, CI, migrations). Include test files correlated to changed handlers — a changed test may reveal new guards, mutations, or branching.
2. **If no pertinent changes** → `No changes detected since last run (commit <sha>).` and stop.
3. **Targeted extraction:** load existing specs as base. Read only changed/new files. Re-extract impacted definitions. Merge with unchanged.
4. **Cascade warning:** if an entity changes and unchanged operations reference it, signal the dependency but do not re-read the handler unless referenced fields changed.
5. **Scoped validation:** cross-validate only changed/added definitions + definitions referencing them.
6. **Meta update:** update `gitSha`, `lastRun`, and affected filemap entries.

### Full Update Mode

Applies when `--full` flag, or no `.meta.json`, or `gitSha` unreachable.

1. Read all existing `.domain.specy` files.
2. Execute Phases 1–2, producing updated versions in memory.
3. Compute diffs against existing. Present changes.
4. Apply after confirmation. Run Phase 3.
5. Write `.meta.json` with full filemap.

If not triggered by `--full`, display:
```
Meta file absent or git history unavailable — falling back to full update mode.
```

### Targeted Mode

Applies when the user specifies a definition name: `distill <DefinitionName>`.

**Pre-condition:** existing `.domain.specy` must be present.

1. **Target resolution:** search existing specs for `DefinitionName`. If found → identify type, source file, domain. If not found → search codebase for matching class/handler.
2. **Extraction unit** by type:

   | Target | Re-extract | Also re-extract | Cascade warning |
   |---|---|---|---|
   | Entity | The entity | Enums/values from same source file | Operations referencing it |
   | Operation | The operation | Its command + emitted events | Event-triggered operations on those events |
   | Command | Treat as operation if one exists | (same as operation) | — |
   | Event | The event | — | Operations emitting/listening to it |
   | Enum / Value | The definition | — | Entities/operations referencing it |
   | Policy / Invariant | The definition | — | — |

3. **Scoped extraction:** read only identified source files. Re-extract only the extraction unit.
4. **Scoped validation:** cross-validate only re-extracted definitions + references.
5. **Meta update:** update only affected filemap entries. Do not change `gitSha` / `lastRun`.

---

## Extraction Heuristics

During Phase 1, identify the project's stack, then load the relevant heuristic file.

### Generic Heuristics (always applied)

<!-- include: heuristics/generic.md -->

### Stack-specific Heuristics

| Detection signal | File |
|---|---|
| `.java`, `pom.xml`, `build.gradle`, `@SpringBootApplication`, `@Entity` | Read `heuristics/java-spring.md` |
| `.ts`, `.tsx`, `package.json` + `@nestjs/*`, `tsconfig.json` | Read `heuristics/typescript-nestjs.md` |
| `.clj`, `.cljs`, `deps.edn`, `project.clj`, `lein` | Read `heuristics/clojure.md` |

If no specific stack is detected, rely on generic heuristics only. Annotate non-obvious mappings with `// NOTE: inferred from {pattern}`.

---

## Constructs

### Expression Rules

<!-- include: constructs/expressions.md -->

### Construct Reference

<!-- include: constructs/constructs.md -->

---

## Syntax Reference

Load the grammar file during Phase 1 to calibrate syntax:

| Grammar | File |
|---|---|
| Specy (.domain.specy) | Read `grammars/specy.ebnf` |

---

## Canonical Example

### orders.domain.specy

<!-- include-code: specy examples/orders.domain.specy -->

---

## Output Checklist

Before writing final files, verify each item. If any fails, fix it.

- [ ] Enum values in `camelCase` (no `UPPER_SNAKE_CASE`)
- [ ] No policy with tautological condition on a required/immutable field
- [ ] No `invariant` on command or event (entities and values only)
- [ ] No policy with empty or tautological expression — if unexpressible, use `// UNCLEAR` inline
- [ ] No `service` for pure infrastructure
- [ ] Every `sets`/`creates` entity appears in `resolves` or `creates` of the same operation
- [ ] Every `dotPath` resolves through the structural definitions
- [ ] Every enum value in expressions exists in the enum definition
- [ ] Every service call resolves to a declared `service` + `operation`
- [ ] Every policy call resolves to a named policy
- [ ] Every operation label in `transitions` matches an operation in the same entity
- [ ] Every `emits` type exists as a top-level `event` with matching fields
- [ ] Every `references` type exists as an entity or value in the current module or in a `uses module` import
- [ ] Messages in business language, not technical jargon
- [ ] `// source:` comment on every definition
- [ ] Query-only entities annotated with `// NOTE: query-only`
- [ ] Unreferenced enums annotated with `// NOTE: not referenced`

---

## Edge Cases

- **Anemic models:** look for logic in services, controllers, middleware. If truly no rules → minimal specs + `// NOTE: anemic model`.
- **Multiple bounded contexts:** separate `.domain.specy` per context.
- **Cross-module types:** when an entity references a type modelled in another module, declare it in `references { }` with `uses module`. Do not duplicate entity definitions across modules. Reserve `// NOTE` for references to unmodelled technical types (CodeValue, AppUser, Staff, etc.).
- **Generated code:** ignore unless it reveals domain concepts not found elsewhere.
- **Tests as source:** tests are a legitimate evidence source (see Decision Test 1). Read test files correlated to handlers — assertions confirm `policy` calls, `sets`, `emits`, service calls. Multiple tests on the same handler with different preconditions signal branching (see test heuristics for decomposition rules). Absence of tests never degrades extraction.
- **Large projects (>50 models):** ask the user to scope before proceeding.
- **Missing events:** do not invent. Signal with `// NOTE: no domain event emitted — consider adding {Event} if {reason}`.
- **Inheritance:** same type field → single entity + enum (`// NOTE: collapsed hierarchy`). Different fields → separate entities.
