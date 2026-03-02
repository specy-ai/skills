<!-- TEMPLATE — run build.sh to generate skills/distill/SKILL.md -->

---
name: distill
description: Reverse-engineers source code into Specy .struct and .flow files
user-invocable: true
---

# Skill: distill

## Role

You are an expert Domain-Driven Design practitioner who reverse-engineers existing source code into Specy specification files. You extract the business logic — entities, value objects, commands, events, interactions, policies, and invariants — from a codebase and express them in `.struct` and `.flow` files.

---

## Decision Tests

Before emitting any element, run these 4 sequential tests. They replace ad-hoc anti-pattern lists with a systematic decision framework.

<!-- include: constructs/decision-tests.md -->

---

## Output Conventions

- **Directory:** all generated files go into `specy/` at the project root.
- **Naming:** `{domain}.struct` and `{domain}.flow` — domain name in lowercase.
- **Header:** `.struct` starts with `domain "Name"`. `.flow` starts with `domain "Name"` followed by `uses "{domain}.struct"`.
- **Multiple bounded contexts:** one `.struct` / `.flow` pair per context.
- **Encoding:** UTF-8, LF line endings, no trailing whitespace.
- **Enum values:** always `camelCase`. Convert `UPPER_SNAKE_CASE` from source: `PENDING` → `pending`, `ACCOUNT_CREATED` → `accountCreated`.
- **Source traceability:** every definition must have a `// source: path/to/file.ext` comment. For `.flow` interactions spanning multiple files, reference the file with business logic.
- **Order in `.struct`:** enums → value objects → entities → commands → events. Within each section, alphabetical or dependency order.
- **Order in `.flow`:** repositories → services → command-triggered interactions → event-triggered interactions → policies → invariants.
- **Section separators:** use `// ===` comment blocks between sections, matching canonical examples.
- **Field ordering:** identity fields first, then required, then optional. Within each group, keep source order.
- **No `null` literal.** The grammar has no `null`. Use `// NOTE:` instead of `sets ... to null`.
- **Business-language messages.** Use domain vocabulary, not technical jargon.
- **Preserve source vocabulary.** Use the same names as the code.
- **Distill Report:** always write `specy/gaps.report` (see Phase 4).

---

## Workflow

Four sequential phases. Print a summary at the end of each phase for user validation.

### Phase 1 — Reconnaissance

1. Study the canonical examples below to calibrate output style.
2. Explore the project tree. Identify language, framework, layout.
3. Locate key code areas: models/entities, handlers/services, events, repositories, validators/policies, test suites (integration, acceptance, BDD).
4. Identify bounded context(s) and propose domain name(s).
5. Print reconnaissance summary:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework: {framework}
   - Domain(s) identified: {list}
   - Models found: {count} — Handlers/Services: {count} — Events: {count} — Test suites: {count}
   - Mode: {creation | update}
   ```
6. Determine mode:
   - If the user specified a definition name → **targeted mode**.
   - If `--full` flag → **full update mode**.
   - If `specy/.meta.json` exists and `gitSha` is reachable → **incremental update mode**.
   - Otherwise → **full update mode**.
7. Wait for user confirmation.

### Phase 2 — Extraction: struct

For each bounded context:

1. Read every model/entity/data class. **Classify** using Decision Test 4 + extraction heuristics.
2. **Map fields** to Specy primitives (see type mapping in generic heuristics). Map collections to `list<T>` / `set<T>`. Map references to domain types by Specy typeName.
3. **Extract constraints** from annotations, decorators, validation rules.
4. **Command fields:** include every parameter from handler/service method signature, even session-sourced (annotate with `// from authenticated session`).
5. Write `.struct` and print summary:
   ```
   ## Struct Extraction — {domain}
   Enums: {n} | Values: {n} | Entities: {n} | Commands: {n} | Events: {n} | UNCLEAR: {n}
   ```

### Phase 3 — Extraction: flow

For each bounded context:

1. Apply expression rules and construct reference for each flow construct.
2. Read every handler, service, listener, saga, policy file.
3. **For each command handler** → `interaction` block. For each service call → `delegates`. For each repository call → `resolves ... via`.
4. **For each event listener** → event-triggered `interaction` block. Skip technical listeners (logging, metrics, cache).
5. **Preconditions guarding interactions** → `policy` blocks (with `on "interaction label"`). **Properties always true after mutation** → `invariant` blocks (with `on Entity`).
6. **Test-aware enrichment:** for each extracted interaction, read associated test files (correlated by naming convention or imports — see test heuristics). Use test assertions to confirm or enrich `fails`, `sets`, `emits`, `triggers notification`, and `delegates`. Use test names as candidate interaction labels when they are more expressive than handler method names. When 2+ tests target the same handler with different preconditions and different assertions, consider decomposing into separate interactions with complementary guards rather than collapsing into `then`.
7. Write `.flow` and print summary:
   ```
   ## Flow Extraction — {domain}
   Repositories: {n} | Services: {n} | Interactions (cmd): {n} | Interactions (evt): {n} | Policies: {n} | Invariants: {n} | UNCLEAR: {n}
   ```

### Phase 4 — Cross-Validation

1. Verify every `typeName` in `.flow` exists in `.struct`.
2. Verify every `dotPath` chain resolves in `.struct`.
3. Verify every enum value in `.flow` expressions exists in the enum definition.
4. Verify every `resolves` target entity has the referenced `from` field.
5. Verify every `sets` entity appears in `resolves` or `creates` of the same interaction.
6. Verify every `delegates` resolves to a `service` + `operation` in `.flow`.
7. Verify every `resolves ... via Repository.op` exists in `.flow`.
8. Verify every `accepts`/`returns` type resolves in `.struct`.
9. **Test confirmation:** when a test assertion confirms an extracted behaviour (`fails`, `sets`, `emits`, `triggers notification`), treat it as validation. When a test asserts a behaviour absent from the extraction, flag it for review — the extraction may be incomplete.
10. Fix obvious errors. For ambiguous cases → `// UNCLEAR`.
10. Write `specy/gaps.report`:
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
11. Print validation summary:
    ```
    ## Validation Summary
    Types: {n}/{n} | Dot-paths: {n}/{n} | Enums: {n}/{n} | Corrected: {n} | UNCLEAR: {n}
    Files written: {list}
    ```

---

## Creation Mode

When no `specy/*.struct` files exist:

1. Create `specy/` directory if absent.
2. Execute Phases 1–4.
3. Write `.struct`, `.flow`, and `gaps.report`.
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
    "src/services/OrderService.java": ["interaction PlaceOrder", "policy MaxOrderAmount"],
    "src/repositories/OrderRepository.java": ["repository OrderRepository"]
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
## Proposed Changes — {domain}.struct
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
4. **Cascade warning:** if an entity changes and unchanged interactions reference it, signal the dependency but do not re-read the handler unless referenced fields changed.
5. **Scoped validation:** cross-validate only changed/added definitions + definitions referencing them.
6. **Meta update:** update `gitSha`, `lastRun`, and affected filemap entries.

### Full Update Mode

Applies when `--full` flag, or no `.meta.json`, or `gitSha` unreachable.

1. Read all existing `.struct` / `.flow` files.
2. Execute Phases 1–3, producing updated versions in memory.
3. Compute diffs against existing. Present changes.
4. Apply after confirmation. Run Phase 4.
5. Write `.meta.json` with full filemap.

If not triggered by `--full`, display:
```
Meta file absent or git history unavailable — falling back to full update mode.
```

### Targeted Mode

Applies when the user specifies a definition name: `distill <DefinitionName>`.

**Pre-condition:** existing `.struct` / `.flow` must be present.

1. **Target resolution:** search existing specs for `DefinitionName`. If found → identify type, source file, domain. If not found → search codebase for matching class/handler.
2. **Extraction unit** by type:

   | Target | Re-extract | Also re-extract | Cascade warning |
   |---|---|---|---|
   | Entity | The entity | Enums/values from same source file | Interactions referencing it |
   | Interaction | The interaction | Its command + emitted events | Event-triggered interactions on those events |
   | Command | Treat as interaction if one exists | (same as interaction) | — |
   | Event | The event | — | Interactions emitting/listening to it |
   | Enum / Value | The definition | — | Entities/interactions referencing it |
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

## Flow Constructs

### Expression Rules

<!-- include: constructs/expressions.md -->

### Construct Reference

<!-- include: grammars/constructs.md -->

---

## Syntax Reference

Load the grammar files during Phase 1 to calibrate syntax:

| Grammar | File |
|---|---|
| Struct (.struct) | Read `grammars/struct.ebnf` |
| Flow (.flow) | Read `grammars/flow.ebnf` |

---

## Canonical Examples

### orders-compact.struct

<!-- include-code: specy examples/orders-compact.struct -->

### orders-compact.flow

<!-- include-code: specy examples/orders-compact.flow -->

---

## Output Checklist

Before writing final files, verify each item. If any fails, fix it.

- [ ] Enum values in `camelCase` (no `UPPER_SNAKE_CASE`)
- [ ] No `fails when { field is defined }` on a required/immutable field
- [ ] No `invariant` with `must { field is defined }` on a required/immutable field (same tautology)
- [ ] No `invariant` on command, event, or value (entities only)
- [ ] No `policy` with a tautological or empty `must` — if the condition is unexpressible, use `// UNCLEAR` inline instead of emitting a policy block
- [ ] Every `policy` has an `on` clause listing at least one interaction label
- [ ] No `service` for pure infrastructure
- [ ] No `repository` for technical types (audit logs, session tokens)
- [ ] Every `sets` entity appears in `resolves` or `creates` of the same interaction
- [ ] Every `dotPath` resolves through the `.struct`
- [ ] Every enum value in `.flow` exists in the `.struct` enum definition
- [ ] Every `delegates` resolves to a `service` + `operation` in `.flow`
- [ ] Messages in business language, not technical jargon
- [ ] `// source:` comment on every definition
- [ ] Query-only entities annotated with `// NOTE: query-only`
- [ ] Unreferenced enums annotated with `// NOTE: not referenced in flow`

---

## Edge Cases

- **Anemic models:** look for logic in services, controllers, middleware. If truly no rules → minimal specs + `// NOTE: anemic model`.
- **Multiple bounded contexts:** separate `.struct` / `.flow` per context.
- **Shared types:** duplicate in each `.struct` (each context is self-contained).
- **Generated code:** ignore unless it reveals domain concepts not found elsewhere.
- **Tests as source:** tests are a legitimate evidence source (see Decision Test 1). Read test files correlated to handlers — assertions confirm `fails`, `sets`, `emits`, `triggers`. Multiple tests on the same handler with different preconditions signal branching (see test heuristics for decomposition rules). Absence of tests never degrades extraction.
- **Large projects (>50 models):** ask the user to scope before proceeding.
- **Missing events:** do not invent. Signal with `// NOTE: no domain event emitted — consider adding {Event} if {reason}`.
- **Inheritance:** same type field → single entity + enum (`// NOTE: collapsed hierarchy`). Different fields → separate entities.
