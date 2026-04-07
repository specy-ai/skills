<!-- TEMPLATE — run build.sh to generate dist/distill/SKILL.md -->

---
name: distill
version: v3
description: Reverse-engineers source code into Specy v3 .domain files
user-invocable: true
---

# Skill: distill

## Role

You are an expert Domain-Driven Design practitioner who reverse-engineers existing source code into Specy v3 domain model files. You extract the business logic — entities, aggregates, value objects, commands, queries, events, operations, preconditions, postconditions, policies, invariants, agreements, and state machines — from a codebase and express them in a unified `.domain` file.

---

## Decision Tests

Before emitting any element, run these 4 sequential tests. They replace ad-hoc anti-pattern lists with a systematic decision framework.

# Decision Tests

Run these 4 tests **in sequence** on every element you are about to emit. If any test fails, apply the indicated action instead.

## Test 1 — "Is it real?"

> Can I point to a line of production code **or** test code that evidences this element?

- **Yes (production code)** → proceed to Test 2.
- **Yes (test code only)** → proceed to Test 2, but annotate with `// NOTE: evidenced by test ({test file})`.
- **No** → **do not emit**. Never invent logic absent from code.

### Evidence weight

Production code establishes **what exists** — the implementation. Test code establishes **what is expected** — the intent. When both sources converge on the same element, confidence is high. When a test reveals a behaviour not obvious in production code (e.g. an assertion on a side-effect buried in a helper), the test is sufficient evidence to emit, but the annotation signals reduced traceability.

**Non-regression rule:** absence of tests must never degrade extraction. When no test files exist or no test correlates to a handler, `distill` extracts from production code exactly as before. Tests improve confidence; they do not condition it.

## Test 2 — "Is it domain?"

> Would this element still exist if we swapped the technical stack (framework, database, transport)?

- **Yes** (business calculation, domain rule, business status) → proceed to Test 3.
- **No** (password hashing, MIME validation, rate limiting, caching, logging, token storage, metrics) → **omit** with `// NOTE: {description} (infrastructure)`.

### Grey-zone heuristic

If the result affects an entity field via `sets` or is enforced as a precondition, it is domain. Otherwise it is likely infrastructure.

### Separate the authorization mechanism from the protected action

A role check (`user.isAdmin`, `requirePermission`) is an **authorization mechanism** — infrastructure. But the action it protects (freeze a user, delete content, manage tokens) may be a **domain operation** that changes entity state. Evaluate the action independently of its guard: if the action passes Test 2, model the operation; annotate the role check with `// UNCLEAR: admin role authorization`.

## Test 3 — "Is it faithful?"

> Does the expression I am about to write accurately reflect the actual condition in the code?

- **Yes** → proceed to Test 4.
- **No, but the rule is not business-critical** → **omit** with `// NOTE`.
- **No, and the rule is business-critical** → emit `// UNCLEAR: {full business rule description} ({why unexpressible})`.

### Common faithfulness traps

| Trap | Why it fails | Action |
|---|---|---|
| `field is defined` on a required/immutable field (in precondition or invariant) | Always true → tautology | Use the real condition or `// UNCLEAR` |
| `now() - Entity.createdAt > 5` | No duration operator → ambiguous | `// UNCLEAR` with business rule |
| Status check masking a cross-aggregate rule | Real condition involves another aggregate | Model the cross-aggregate lookup or `// UNCLEAR` |
| Placeholder `when { totalAmount > 0 }` for fraud check | Real logic is an external API call | `// NOTE` (infrastructure) |

## Test 4 — "Is it the right construct?"

> Am I placing this element in the correct Specy construct type?

| Element is... | Correct construct |
|---|---|
| Has identity + mutable lifecycle | `entity` |
| Group of entities with a designated root, enforcing integrity boundaries | `aggregate` |
| No identity, immutable, equality by content | `value` |
| Fixed set of named constants | `enum` |
| Input DTO triggering a write | `command` |
| Input DTO requesting current state (safe, idempotent) | `query` |
| Record of something that happened within the bounded context | `event` |
| Fact originating from an upstream bounded context | `external event` |
| Fact raised by an operation on failure | `error event` |
| Domain fact caused by passage of time (duration, instant, schedule) | `temporal event` |
| Stateless class with business logic spanning multiple entities | `domain service` |
| Class orchestrating use cases from presentation layer | `application service` |
| Adapter exposing external system capabilities through domain language | `infrastructure service` |
| Handler for a command → write operation | `operation` (command-triggered, inside entity) |
| Handler for an event → side effects | `operation` (event-triggered, inside entity) |
| Named guard that must hold before an operation can proceed | `precondition` (inside operation) |
| Named assertion on state after an operation completes | `postcondition` (inside operation) |
| Reactive rule: event triggers a command | `policy` (file-level, trigger/guard/effect) |
| Property always true after any successful mutation | `invariant` (entity/value-scoped or file-level with enforcement) |
| Cross-aggregate consistency property that cannot be verified atomically | `agreement` (with reconciliation) |
| Named surface exposing a subset of operations | `interface` |
| Entity lifecycle with named states and transitions | `states { machine Name { } }` (inside entity) |

---

## Output Conventions

- **Directory:** all generated files go into `specy/` at the project root.
- **Naming:** `{domain}.domain` — domain name in lowercase. Single unified file per bounded context.
- **Header:** wrap in `organization Name { context Name (shortname) { module Name { ... } } }` hierarchy. For single-context projects, `module Name { ... }` as top-level is acceptable.
- **Context map:** when multiple contexts exist, include a `map { }` block with upstream/downstream/symmetric relations.
- **Multiple bounded contexts:** one `.domain` per context.
- **Encoding:** UTF-8, LF line endings, no trailing whitespace.
- **Enum values:** always `camelCase`. Convert `UPPER_SNAKE_CASE` from source: `PENDING` → `pending`, `ACCOUNT_CREATED` → `accountCreated`.
- **Source traceability:** every definition must have a `// source: path/to/file.ext` comment. For operations spanning multiple files, reference the file with business logic.
- **Order in file:** `organization` → `context` → `map` → `module` → enums → value objects → domain services → application services → infrastructure services → file-level policies → file-level invariants → entities/aggregates → commands → queries → events → external events → error events → temporal events → agreements. Within each section, alphabetical or dependency order.
- **Section separators:** use `// ===` comment blocks between sections, matching the canonical example.
- **Field ordering:** identity first, then required, then optional. Within each group, keep source order.
- **No `null` literal.** The grammar has no `null`. Use `// NOTE:` instead of `sets ... to null`.
- **Business-language messages.** Use domain vocabulary, not technical jargon.
- **Preserve source vocabulary.** Use the same names as the code.
- **Distill Report:** always write `specy/gaps.report` (see Phase 3).
- **Identity block:** entities and aggregates use `identity fieldName : type` before the `fields` block.
- **Fields wrapper:** all field declarations go inside `fields { }` blocks (entities, values, commands, queries, events).
- **References block:** entity/aggregate references with cardinality go in `references { }` blocks. Cardinality uses `N..M` notation (e.g., `1..1`, `1..N`).
- **Operations block:** entity/aggregate operations go inside `operations { }` blocks.
- **State machine block:** entity/aggregate state machines go inside `states { machine Name { ... } }` blocks with `state`, `final`, and transition definitions.
- **Scoped invariants:** entity or value invariants go inside `invariants { }` blocks without repeating the `invariant` keyword on each entry.
- **Preconditions in operations:** use `precondition name :: "description" { expr } rejects "message"` inside operation bodies for guards.
- **Postconditions in operations:** use `postcondition name :: "description" { expr }` inside operation bodies for state assertions.
- **Reactive policies:** file-level `policy Name { trigger EventType, guard { expr }, effect CommandType }` for event-driven reactive rules.
- **Invariants with enforcement:** file-level `invariant Name { on Entity, must { expr }, enforcement rejection|compensation CommandType|alert }`.
- **Description operator:** use `::` to attach business descriptions to constructs (e.g., `entity Order :: "A customer order" { ... }`).
- **Metadata:** optionally add `meta { key = value }` blocks on constructs.
- **Traceability:** optionally add `satisfies [REQ-XXX-001]` on constructs linked to system requirements.

---

## Workflow

Three sequential phases. Print a summary at the end of each phase for user validation.

### Phase 1 — Reconnaissance

1. Study the canonical example below to calibrate output style.
2. Load the grammar: read `grammars/domain.ebnf` to calibrate syntax.
3. Explore the project tree. Identify language, framework, layout.
4. Locate key code areas: models/entities, handlers/services, events, validators/policies, test suites (integration, acceptance, BDD).
5. Identify bounded context(s) and propose domain name(s).
6. Print reconnaissance summary:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework: {framework}
   - Domain(s) identified: {list}
   - Models found: {count} — Handlers/Services: {count} — Events: {count} — Test suites: {count}
   - Mode: {creation | update}
   ```
7. Determine mode:
   - If the user specified a definition name → **targeted mode**.
   - If `--full` flag → **full update mode**.
   - If `specy/.meta.json` exists and `gitSha` is reachable → **incremental update mode**.
   - Otherwise → **full update mode**.
8. Wait for user confirmation.

### Phase 2 — Extraction

For each bounded context:

1. Read every model/entity/data class. **Classify** using Decision Test 4 + extraction heuristics.
2. **Map fields** to Specy primitives (see type mapping in generic heuristics). Map collections to `list<T>` / `set<T>` / `map<K,V>`. Map references to domain types by Specy typeName.
3. **Extract constraints** from annotations, decorators, validation rules.
4. **Extract entity references** with cardinality → `references { }` block.
5. **Identify aggregates** — entities that own child entities via composition (cascade, orphan removal). Create `aggregate` blocks with `root` and `entities { }`.
6. **Extract duplicate detection** — uniqueness constraints across multiple fields → `duplicate detection { expression }`.
7. Read every handler, service, listener, saga, policy file.
8. **For each command handler** → entity/aggregate operation (command-triggered: `"Label" on CommandType { ... }`). For each service call → direct `Service.op(args)`. For each entity resolution → `resolves Entity from dotPath`.
9. **For each event listener** that mutates entity state → entity operation (event-triggered: `"Label" when EventType then CommandType { ... }`). Skip technical listeners (logging, metrics, cache).
10. **For each event listener** that issues a command without entity mutation → reactive `policy Name { trigger EventType, guard { expr }, effect CommandType }` at file level.
11. **Preconditions guarding operations** → `precondition name :: "description" { expr } rejects "message"` inside the operation body.
12. **Postconditions verifying state after operations** → `postcondition name :: "description" { expr }` inside the operation body.
13. **Properties always true after mutation** → `invariant` definitions. Entity/value-scoped inside `invariants { }` blocks, or file-level with `enforcement` strategy.
14. **Extract commands** with fields inside `fields { }`. **Extract events** with fields inside `fields { }`.
15. **Extract queries** — read-only endpoints/handlers → `query Name { fields { ... }, returns Type }`.
16. **Classify services** into three types: `domain service` (business logic), `application service` (orchestration), `infrastructure service` (external adapters).
17. **Derive state machines** from status enum + operation flow → `states { machine Name { state/final, transitions with on/when/then } }` block inside entity.
18. **Identify temporal events** — scheduled jobs, time-based triggers, expiration logic → `temporal event` (relative/absolute/recurring).
19. **Identify agreements** — cross-aggregate consistency checks, sagas that compensate → `agreement` with `reconciliation`.
20. **Test-aware enrichment:** for each extracted operation, read associated test files. Use test assertions to confirm or enrich `precondition` clauses, `sets` blocks, `emits` blocks, and service calls. Use test names as candidate operation labels when they are more expressive than handler method names.
21. Write `.domain` and print summary:
    ```
    ## Extraction — {domain}
    Enums: {n} | Values: {n} | Entities: {n} | Aggregates: {n}
    Domain Services: {n} | App Services: {n} | Infra Services: {n}
    Commands: {n} | Queries: {n} | Events: {n}
    External Events: {n} | Error Events: {n} | Temporal Events: {n}
    Operations (cmd): {n} | Operations (evt): {n} | Operations (internal): {n}
    Preconditions: {n} | Postconditions: {n} | Policies: {n} | Invariants: {n}
    Agreements: {n} | State Machines: {n} | UNCLEAR: {n}
    ```

### Phase 3 — Cross-Validation

1. Verify every `typeName` resolves within the file or via context/module references.
2. Verify every `dotPath` chain resolves through the structural definitions.
3. Verify every enum value in expressions exists in the enum definition.
4. Verify every `resolves` target entity has the referenced `from` field.
5. Verify every `sets`/`creates` entity is resolved or created in the same operation.
6. Verify every service call resolves to a declared service + operation in the file.
7. Verify every precondition/postcondition expression is valid (no tautologies).
8. Verify every `emits` type exists as a top-level `event`.
9. Verify every operation label in state machine transitions exists in `operations`.
10. Verify every `references` cardinality matches the structural model.
11. Verify every aggregate has a `root` declaration and all contained entities are listed.
12. Verify every query has a `returns` declaration.
13. Verify every reactive policy's `trigger` event and `effect` command exist.
14. Verify every agreement's `participants` exist as entities/aggregates.
15. Verify every file-level invariant has an `enforcement` strategy.
16. **Test confirmation:** when a test assertion confirms an extracted behaviour (precondition, `sets`, `emits`, service call), treat it as validation. When a test asserts a behaviour absent from the extraction, flag it for review.
17. Fix obvious errors. For ambiguous cases → `// UNCLEAR`.
18. Write `specy/gaps.report`:
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
19. Print validation summary:
    ```
    ## Validation Summary
    Types: {n}/{n} | Dot-paths: {n}/{n} | Enums: {n}/{n} | Preconditions: {n}/{n} | Services: {n}/{n} | State Machines: {n}/{n} | Aggregates: {n}/{n} | Queries: {n}/{n} | Policies: {n}/{n} | Corrected: {n} | UNCLEAR: {n}
    Files written: {list}
    ```

---

## Creation Mode

When no `specy/*.domain` files exist:

1. Create `specy/` directory if absent.
2. Execute Phases 1–3.
3. Write `.domain` and `gaps.report`.
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
    "src/services/OrderService.java": ["operation Order.PlaceOrder", "precondition orderMustBeDraft"],
    "src/listeners/OrderListener.java": ["policy OnOrderShipped"]
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
## Proposed Changes — {domain}.domain
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

1. **Differential recon:** `git diff --name-only <savedSha>..HEAD`. Cross-reference with filemap → modified, new, deleted files. Skip non-business files (config, CI, migrations). Include test files correlated to changed handlers.
2. **If no pertinent changes** → `No changes detected since last run (commit <sha>).` and stop.
3. **Targeted extraction:** load existing specs as base. Read only changed/new files. Re-extract impacted definitions. Merge with unchanged.
4. **Cascade warning:** if an entity changes and unchanged operations reference it, signal the dependency but do not re-read the handler unless referenced fields changed.
5. **Scoped validation:** cross-validate only changed/added definitions + definitions referencing them.
6. **Meta update:** update `gitSha`, `lastRun`, and affected filemap entries.

### Full Update Mode

Applies when `--full` flag, or no `.meta.json`, or `gitSha` unreachable.

1. Read all existing `.domain` files.
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

**Pre-condition:** existing `.domain` must be present.

1. **Target resolution:** search existing specs for `DefinitionName`. If found → identify type, source file, domain. If not found → search codebase for matching class/handler.
2. **Extraction unit** by type:

   | Target | Re-extract | Also re-extract | Cascade warning |
   |---|---|---|---|
   | Entity/Aggregate | The entity/aggregate | Enums/values from same source file | Operations referencing it |
   | Operation | The operation | Its command + emitted events | Event-triggered operations on those events |
   | Command | Treat as operation if one exists | (same as operation) | — |
   | Query | The query | — | — |
   | Event | The event | — | Operations emitting/listening to it, policies triggered by it |
   | Enum / Value | The definition | — | Entities/operations referencing it |
   | Policy | The policy | — | — |
   | Invariant | The invariant | — | — |
   | Agreement | The agreement | — | Reconciliation mechanism |

3. **Scoped extraction:** read only identified source files. Re-extract only the extraction unit.
4. **Scoped validation:** cross-validate only re-extracted definitions + references.
5. **Meta update:** update only affected filemap entries. Do not change `gitSha` / `lastRun`.

---

## Extraction Heuristics

During Phase 1, identify the project's stack, then load the relevant heuristic file.

### Generic Heuristics (always applied)

# Generic Heuristics (any language/framework)

Always load this file. It provides language-agnostic patterns used as a base for all stacks.

## Naming Patterns

| Source Pattern | Inference |
|---|---|
| Class/module named `*Service`, `*Handler`, `*UseCase`, `*Interactor` | Likely contains entity operation logic |
| Class/module named `*Repository`, `*Store`, `*Dao` | The generic type it manages is likely an `entity` (use for resolution patterns) |
| Class/module named `*Aggregate`, `*AggregateRoot` | Likely an `aggregate` root — look for owned child entities |
| Class/module named `*Saga`, `*Listener`, `*Subscriber`, `*Consumer` | Likely contains event-triggered operation logic or reactive `policy` (trigger/guard/effect) |
| Class/module named `*Policy`, `*Validator`, `*Guard`, `*Rule`, `*Specification` | Likely contains `precondition` or `invariant` logic |
| Class/module named `*Event`, `*Message` with past-tense name | Likely an `event` |
| Class/module named `*Command`, `*Request` with imperative name | Likely a `command` |
| Class/module named `*Query`, `*ReadModel`, `*Projection`, `*View` | Likely a `query` |
| Class/module named `*Reconciliation`, `*Compensator` | Likely part of an `agreement` / `reconciliation` mechanism |
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
| `Duration`, `Period`, `Interval` | `duration` |
| `List<T>`, `ArrayList<T>`, `T[]`, `Array<T>`, `Vec<T>`, `vector`, `[]T` | `list<T>` |
| `Set<T>`, `HashSet<T>`, `TreeSet<T>`, `LinkedHashSet<T>` | `set<T>` |
| `Map<K,V>`, `HashMap<K,V>`, `TreeMap<K,V>`, `Dictionary<K,V>`, `Record<K,V>` | `map<K,V>` |

When a source type does not map to a primitive, check if it corresponds to another domain type (entity, value, enum). If it does, use the Specy typeName. If it is a technical type with no domain meaning (e.g. `HttpRequest`, `Logger`), omit it.

## Services

### Classification

Three service types — choose based on the nature of the logic:

| Pattern | Specy Construct |
|---|---|
| Stateless business logic spanning multiple entities (pricing, scoring, eligibility) | `domain service` |
| Use case orchestration: calls repositories + domain services, coordinates operations from presentation layer | `application service` |
| External system adapter: notifications, payments, file storage, email, HTTP gateways | `infrastructure service` |

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Interface or class without state, with business calculation method(s) | `domain service` block |
| Controller or facade orchestrating multiple domain calls | `application service` block |
| Adapter/gateway wrapping an external API or messaging system | `infrastructure service` block |
| Constructor injection of a non-repository interface | potential service (classify by logic type) |
| Call to a service method inside a command handler | direct service call `Service.op(args)` in operation body |
| Service result assigned to an entity field | inline as `field = Service.op(args)` inside `creates`/`sets` assignment block |

### What to model

- **Domain service:** business calculations (scoring, pricing, weight), business checks (eligibility, time window), cross-entity logic that doesn't belong to a single entity
- **Infrastructure service:** notification/messaging services, payment gateways, external API adapters, file storage
- **Application service:** use case orchestrators that coordinate domain services and entity operations
- **Do not model** (use `// NOTE` instead): pure technical processing (image resize, password hash, compression), infrastructure plumbing (logging, cache, rate limiting)
- **Decision criterion:** if the result affects an entity field via `sets`/`creates` assignments or the call is a business-visible side-effect, it is a business service

### Service call syntax

Service calls appear directly in the operation body as statements:

```
StockService.restock(Order.lines)
```

When a service result feeds into an entity field, inline it as a value expression inside the assignment block:

```
creates Order {
    totalAmount = PricingCalculator.computeTotal(placeOrder.lines)
}
```

Add `:: "description"` when the business reason for invoking the service is not obvious from context alone.

## Aggregates

### Identification

| Source Pattern | Inference |
|---|---|
| Entity that owns child entities via cascade/composition (not just reference) | `aggregate` root |
| Entity with `@AggregateRoot` annotation or base class | `aggregate` root |
| Entity that is never accessed independently — only via its parent | Contained entity within an aggregate |
| Entity with its own repository and independent lifecycle | Separate entity (not part of another aggregate) |

### Rules

- Only the aggregate root has operations exposed externally
- Only the aggregate root has a derived repository
- Contained entities are listed in the aggregate's `entities { }` block
- Invariants can span the entire aggregate boundary

## Queries

### Identification

| Source Pattern | Inference |
|---|---|
| Read-only endpoint or method returning data without mutations | `query` |
| DTO/projection class used for read models, dashboards, search results | `query` with `returns` type |
| CQRS query handler or read-side handler | `query` |

### Rules

- Queries have `fields` (input parameters) and `returns` (output type)
- Queries never mutate state — they are safe and idempotent
- Only model queries that represent significant domain read operations, not every database query

## Preconditions and Postconditions

### Preconditions

| Source Pattern | Specy Construct |
|---|---|
| `if (condition) throw new ...Exception(msg)` at the start of a handler | `precondition name :: "description" { condition } rejects "message"` inside operation |
| Validator class invoked before the main operation logic | `precondition` — extract the validation expression |
| Guard clause checking entity state before mutation | `precondition` — the guard condition becomes the expression |

### Postconditions

| Source Pattern | Specy Construct |
|---|---|
| Assertion at the end of a handler verifying state after mutation | `postcondition name :: "description" { expr }` inside operation |
| Test assertion on state after handler execution | Evidence for postcondition |

### Rules

- Preconditions express what must be true BEFORE the operation (guard → rejects message)
- Postconditions express what must be true AFTER the operation (can reference `state_before` and `state_after`)
- Use preconditions for operation-specific guards; use invariants for entity-wide properties

## Reactive Policies

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Event listener whose effect is to issue a command | `policy Name { trigger EventType, guard { expr }, effect CommandType }` |
| Saga step: receives event → sends command | `policy` (file-level reactive rule) |
| Scheduled job triggered by events that dispatches actions | `policy` with guard |
| Event handler that only calls services (no entity mutation) and dispatches a follow-up command | `policy` |

### Rules

- A reactive `policy` is NOT a precondition — it listens to events and issues commands
- The `trigger` is the event type that activates the policy
- The `guard` (optional) is a condition that must hold for the policy to fire
- The `effect` is the command to issue when the policy fires
- If the event listener mutates entity state directly (no separate command), model it as an event-triggered operation instead

## Collection Iteration (`foreach`)

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Loop over a collection field of a resolved entity with per-item mutation | `foreach Entity.collection as alias { sets TypeName { field = ... } }` |
| Loop over a collection field with per-item event emission | `foreach Entity.collection as alias { emits EventType { field = ... } }` |
| Loop over a collection field with per-item service or entity call | `foreach Entity.collection as alias { ServiceName.op(alias) }` |
| Loop over a collection field with per-item resolution | `foreach Entity.collection as alias { resolves TypeName from alias.fieldId }` |

### Rules

- The collection must be a `list<T>` field in the structural model.
- The alias scopes dot-paths inside the body — `alias.field` navigates the item, not the collection.
- The `foreach` body allows: `resolves`, `sets`, `emits`, entity calls (`TypeName.op(args)`), service calls (`Service.op(args)`), and `policy` calls.
- If the loop body contains no verifiable mutation, emission, or call, omit the `foreach` and use `// NOTE:` to describe the iteration effect.
- **Decision criterion:** if each iteration produces a verifiable mutation (`sets`), emission (`emits`), or call, use `foreach`. If the iteration effect is only describable as narrative, use `// NOTE:` or `// UNCLEAR:`.

### Example

```
foreach Order.lines as line {
    resolves Product from line.productId
    Product.increase(line.quantity)
}
```

## Cross-Aggregate Mutation

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Mutation on an entity not resolved as the primary aggregate | `sets OtherEntity { field = value }` (cross-aggregate `sets`) |
| Mutation via dot-path navigation through relationships | `sets Entity { field = value }` after resolving the target entity |
| Mutation inside a loop on a related entity's field | `foreach ... as alias { sets TypeName { field = value } }` |

### Rules

- The target entity must be reachable from a `resolves` or `creates` clause earlier in the same operation.
- Use `sets TypeName { field = value }` blocks.
- Add `:: "description"` when the business reason for the cross-aggregate mutation is not obvious.
- **Decision criterion:** if the code modifies a field on an entity other than the primary aggregate, it is a cross-aggregate mutation. If verifiable, use `sets`. If not, use `// NOTE:` or `// UNCLEAR:`.

## Service Calls for Side-Effects

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Call to `*NotificationService`, `*EmailService`, `*SmsService`, `*MessagingService`, `*PushService` | `NotificationService.op(args)` service call in operation body |
| Event listener whose only effect is sending a message (no entity mutation) | event-triggered operation body with `ServiceName.op(args)` |
| Call to `send*`, `notify*`, `publish*` on a non-domain service inside a handler | service call statement in operation body |
| Webhook dispatch, HTTP callback to an external system | service call statement, `// NOTE: external HTTP callback` if not in domain scope |

### Rules

- Model the notification/messaging capability as an `infrastructure service` block with typed operation parameters.
- Call the service directly inside the operation body: `NotificationService.notifyCustomer(id, "message")`.
- The argument string literal must describe the notification in business language.
- Use `:: "description"` when the side-effect is a contractual or regulatory obligation.
- **Do not model** as service calls: internal logging, metrics emission, cache invalidation — these are infrastructure (`// NOTE`).

### Example

```
infrastructure service NotificationService :: "Customer notification adapter" {
    operations {
        notifyCustomer(customerId: uuid, message: string) :: "Send a notification to a customer" {
        }
    }
}

// Inside an entity operation:
"Notify customer when order is confirmed" when OrderConfirmed then NotifyOrderConfirmation {
    NotificationService.notifyCustomer(Order.customer.id, "Your order has been confirmed")
}
```

## Inter-Context Communication

### Identification

| Source Pattern | Specy Construct |
|---|---|
| REST/gRPC call to another bounded context's service | `Context.CommandName(namedArgs) :: "description"` |
| Message published to a topic/queue named after another domain | `Shipping.PrepareShipment(orderId = Order.id) :: "description"` |
| Saga step invoking another context's command handler | `Context.CommandName(namedArgs)` |
| Choreography: event emission consumed by another context | Consider `external event` in the target context |

### Rules

- The call form is `ContextName.CommandName(namedArgs)` — the context name matches a `context` declaration in another `.domain` file.
- Named arguments (`field = value`) are required when the target command has more than one field.
- Add `:: "description"` when the business reason for the cross-context call is not obvious.
- If the target context's `.domain` is not yet extracted, use `// NOTE: cross-context call — target context not yet extracted`.
- **Do not use** for intra-context event emission — use `emits EventType { ... }` instead.

### Example

```
Shipping.PrepareShipment(orderId = Order.id) :: "Launch shipping process"
```

## Test Correlation & Branch Decomposition

### Correlating tests to production code

| Strategy | Fiability | Method |
|---|---|---|
| Import/require | High | Test file imports the handler class → direct link |
| Naming convention | Medium | `FooServiceTest` → `FooService`, `foo.spec.ts` → `foo.service.ts` |
| Subject under test | Low | Test instantiates or calls a class → inferred link |

Use the highest-fiability strategy available. When no correlation is found, skip the test file — do not guess.

### What test assertions evidence

| Assertion pattern | Evidence for |
|---|---|
| `assertThrows` / `expect(...).rejects.toThrow` / `(is (thrown? ...))` | Named `precondition` with rejection condition |
| `assertEquals(value, entity.getField())` / `expect(result.field).toBe(value)` | `sets Entity { field = value }` — confirms mutation target and value |
| `verify(publisher).publishEvent(any(Event.class))` / `expect(emitter.emit).toHaveBeenCalledWith(...)` | `emits EventType { field = value }` — confirms event emission |
| `verify(notificationService).send(...)` / `expect(notifService.send).toHaveBeenCalled()` | `NotificationService.op(args)` service call — confirms side-effect |
| `when(service.compute(...)).thenReturn(...)` / `jest.spyOn(service, 'compute')` | `Service.op(args)` direct call — confirms delegation |
| `when(repository.findById(id)).willReturn(entity)` / `mockResolvedValue(entity)` | `resolves Entity from dotPath` — confirms resolution pattern |
| Test name: `should_X_when_Y` | Candidate operation label — often more expressive than method names |

### Branch decomposition

When **2+ tests** target the **same handler** with **different preconditions** and **different assertions**, this signals branching. Each test case represents a distinct business behaviour.

**Rule:** decompose into separate entity operations with complementary guards.

Example signal:
- `should_allow_retry_when_retryCount_below_3` → operation "Allow payment retry" with `precondition retryCountBelowThreshold { Payment.retryCount < 3 } rejects "..."`
- `should_mark_permanent_failure_after_3_retries` → operation "Mark payment as permanently failed" with `precondition retryLimitReached { Payment.retryCount >= 3 } rejects "..."`

**Decision criterion:** if the tests assert different mutations (`sets`) or different side-effects (`emits`, service calls) depending on preconditions, decompose into separate operations. If the tests only vary in error messages for the same outcome, keep as a single operation with multiple `precondition` clauses.

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

# Expression Rules

Rules for expression bodies in precondition, postcondition, policy, and invariant blocks.

## Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `sum()`, `isEmpty()`, `isNotEmpty()`, `now()`, `today()`, `and`, `or`, `not`, `+`, `-`, `*`, `/`, `every TypeName in dotPath { expr }`, `if expr { expr }`

## Quick Reference — Expressible Patterns

| Pattern | Expression |
|---|---|
| Self-reference | `placeOrder.fieldA = placeOrder.fieldB` |
| Ownership | `Entity.userId != placeOrder.userId` |
| Status check | `Entity.status != someValue` |
| Set membership | `Entity.status in {draft, confirmed}` |
| Duplicate/existence | `resolves Entity from dotPath` + precondition with `Entity is defined` |
| Not found | precondition with `Entity is not defined` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |
| Universal quantifier | `every Product in lines { Product.available = true }` |
| Computed value | `total.amount = productPrice.amount * quantity` |
| Conditional validation | `if charge.chargeAppliesTo = loan { charge.chargeTimeType in { disbursement, specifiedDueDate } }` |
| Conditional with optional | `if order.estimatedDelivery is defined { order.estimatedDelivery > today() }` |
| Compound conditional | `if charge.chargeAppliesTo = savings and charge.chargeCalculation = percentOfAmount { charge.chargeTimeType in { withdrawalFee, savingsNoActivityFee } }` |
| Postcondition state comparison | `state_after.status != state_before.status` (postcondition bodies can reference `state_before` and `state_after`) |

## Conditional Expressions (`if`)

The `if` expression is a logical implication: `if A { B }` ≡ `¬A ∨ B`. The precondition holds when the condition is false (vacuous truth) or when both condition and body are true.

**Use `if` when:**
- A validation rule applies only under a specific condition (e.g., "loan charges only allow these time types")
- A field constraint depends on the value of another field (e.g., "if penalty, cannot be at disbursement")
- A field must be defined only when another field has a specific value (e.g., "monthly fees require feeOnMonthDay")

**Do NOT use `if` for:**
- Operation-level branching (two execution paths from the same command) — this is not yet supported in operations
- Simple unconditional checks — use direct expressions instead

**Common source patterns that map to `if`:**

| Source Pattern | Specy Expression |
|---|---|
| `if (entity.isX()) { validate(entity.fieldY); }` | `if entity.type = x { entity.fieldY ... }` |
| `switch (appliesTo) { case LOAN: validValues = [...]; }` | `if entity.appliesTo = loan { entity.field in { ... } }` |
| `if (isPenalty && isAtDisbursement) throw ...` | `if entity.penalty = true { entity.timeType not in { disbursement } }` |
| `if (isMonthlyFee()) { requireNotNull(feeOnMonthDay); }` | `if entity.timeType = monthlyFee { entity.feeOnDay is defined and ... }` |

## Field Types

Primitives: `string`, `int`, `long`, `decimal`, `boolean`, `uuid`, `datetime`, `date`, `time`, `duration`

Collections: `list<T>`, `set<T>`, `map<K,V>`

Constraints: `optional`, `required`, `immutable`, `unique`, `ordered`, `min(n)`, `max(n)`, `minLength(n)`, `maxLength(n)`, `pattern("regex")`, `default("value")`, `pastOrPresent`, `futureOrPresent`

## Non-obvious Conditions

When a guard does not map directly to an expressible pattern, apply Decision Test 3 ("Is it faithful?") instead of defaulting to `// UNCLEAR`.

Common resolutions:

| Pattern | Approach |
|---|---|
| Uniqueness check (`repo.existsByEmail`) | `resolves` entity from dotPath + precondition with `Entity is defined` |
| Cross-entity existence | Same — `resolves` + `is defined` in precondition |
| External business check | `Service.op(args)` direct call + precondition on result |

If the condition cannot be expressed faithfully: infrastructure → `// NOTE`; business-critical grammar gap → `// UNCLEAR: {full rule}`.

### Construct Reference

# Specy v3 Construct Reference

## Structural constructs

### Entity

An `entity` is a domain object with a unique identity that persists over time. Entities own mutable state and are the primary targets of commands, operations, and invariants.

#### Skeleton

```
entity Name :: "description" {
    identity fieldName : type
    duplicate detection { expression }
    fields {
        field : type constraint
    }
    references {
        fieldName : TypeName cardinality
    }
    operations {
        "Label" on CommandType { clauses... }
        "Label" when EventType then CommandType { clauses... }
        name(params) : ReturnType :: "description" { clauses... }
    }
    states {
        machine MachineName :: "description" {
            state stateName :: "description"
            final stateName :: "description"
            [*] --> stateName on operationLabel
            stateName --> stateName on operationLabel when { guard } then { action }
        }
    }
    invariants {
        name :: "description" { expression }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Identity | Must have an `identity` declaration (e.g., `identity id : uuid`). |
| Description | Optional `:: "description"` after the entity name. |
| Fields | Wrapped in a `fields { }` block. Domain constraints directly on fields (`min`, `max`, `optional`, `default`, etc.). |
| References | Declared in a `references { }` block with explicit cardinality (`1..1`, `1..N`, `0..1`, `0..N`). |
| Duplicate detection | Optional `duplicate detection { expression }` — predicate over candidate fields for uniqueness. |
| Sub-blocks | `references`, `operations`, `states`, `invariants` are optional. `identity` and `fields` are required. |
| Naming | `PascalCase` for entity name, `camelCase` for field names. |

#### Example

```
entity Order :: "A customer order" {
    identity id : uuid
    fields {
        status : OrderStatus default("draft")
        totalAmount : Money
        shippingAddress : Address
        placedAt : datetime optional pastOrPresent
        createdAt : datetime immutable pastOrPresent
    }
    references {
        customer : Customer 1..1
        lines : OrderLine 1..N
    }
    invariants {
        orderContainsLines :: "An order must contain at least one line" {
            isNotEmpty(lines)
        }
    }
    operations { ... }
    states { ... }
}
```

---

### Aggregate

An `aggregate` groups related entities under a single root, enforcing integrity boundaries. Operations on contained entities go through the root.

#### Skeleton

```
aggregate Name :: "description" {
    root RootEntityType
    entities {
        ContainedEntityType
    }
    identity fieldName : type
    fields { ... }
    references { ... }
    operations { ... }
    states { ... }
    invariants { ... }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Root | Must declare `root TypeName` — the aggregate root entity. |
| Entities | `entities { }` lists contained entity types. |
| Same sub-blocks | Supports the same blocks as entity (identity, fields, references, operations, states, invariants). |
| Repository | Only the aggregate root has a repository (derived). |

---

### Value

A `value` is an immutable object defined entirely by its attributes — no identity. Values can contain operations and invariants.

#### Skeleton

```
value Name :: "description" {
    fields {
        field : type constraint
    }
    operations {
        name(params) : ReturnType :: "description"
    }
    invariants {
        name :: "description" { expression }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| No identity | Never add `identity` — that makes it an entity. |
| Immutability | All fields are implicitly immutable. |
| Operations | Optional — named operations with typed parameters and return type. |
| Invariants | Optional — self-consistency rules on value fields. |
| Naming | `PascalCase` for value name, `camelCase` for field names. |

#### Example

```
value OrderLine :: "A single line in an order" {
    fields {
        productId : uuid
        quantity : int required min(1) max(1000)
        productPrice : Money
        total : Money
    }
    invariants {
        positiveQuantity :: "Quantity must be greater than zero" {
            quantity > 0
        }
        lineTotalConsistency :: "Line total must equal unit price times quantity" {
            total.amount = productPrice.amount * quantity
        }
    }
}
```

---

### Enum

An `enum` defines a closed set of named values representing a domain classification.

#### Skeleton

```
enum Name {
    value1
    value2
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Values | `camelCase` identifiers — convert `UPPER_SNAKE_CASE` from source code. |
| Closed set | All valid values must be listed exhaustively. |
| No fields | Enum values have no associated data — use a value if data is needed. |

---

### Command

A `command` represents an intent to change the state of the domain.

#### Skeleton

```
command Name :: "description" {
    fields {
        field : type constraint
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, verb-noun form (e.g., `PlaceOrder`, `CancelOrder`). |
| 1:1 mapping | Exactly one entity operation must declare `on` this command. |
| No behavior | Commands are pure data — behavior lives in the entity operation. |

---

### Query

A `query` represents a request for current state — safe and idempotent.

#### Skeleton

```
query Name :: "description" {
    fields {
        field : type constraint
    }
    returns ReturnType
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Returns | Must declare `returns Type` — the data returned by the query. |
| No side effects | Queries never mutate state. |
| Naming | `PascalCase`, noun form (e.g., `OrderSummary`, `CustomerOrders`). |

---

## Event types

### Event (internal)

An `event` signals that something has happened within the bounded context. Emitted by operations.

#### Skeleton

```
event Name :: "description" {
    fields {
        field : type
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, past-tense (e.g., `OrderPlaced`, `OrderCancelled`). |
| Immutable | Events are facts — cannot be modified after emission. |

---

### External Event

An `external event` originates from an upstream bounded context.

#### Skeleton

```
external event Name :: "description" {
    from UpstreamContextName
    triggers {
        CommandType
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `from` | Names the upstream bounded context. |
| `triggers` | Lists commands that should be executed when this event is received. |

---

### Error Event

An `error event` is raised by an operation on failure.

#### Skeleton

```
error event Name :: "description" {
    fields {
        field : type
    }
}
```

---

### Temporal Event

A `temporal event` is a domain fact caused by the passage of time. Three flavors:

#### Relative — fires after a duration from a reference event

```
temporal event Name :: "description" {
    reference EventType
    offset durationExpr
    guard { expression }
    fields { ... }
}
```

#### Absolute — fires at an instant described by an entity field

```
temporal event Name :: "description" {
    instant Entity.datetimeField
    guard { expression }
    fields { ... }
}
```

#### Recurring — fires on each occurrence of a schedule expression

```
temporal event Name :: "description" {
    schedule "cron expression"
    guard { expression }
    fields { ... }
}
```

---

## Service types

### Domain Service

A `domain service` contains operations spanning multiple entities/aggregates that don't naturally belong to a single entity.

```
domain service Name :: "description" {
    operations {
        opName(params) : ReturnType :: "description" {
            resolves / foreach / returns / service calls
        }
    }
}
```

### Application Service

An `application service` orchestrates use cases — interprets requests from presentation layer.

```
application service Name :: "description" {
    operations {
        opName(params) : ReturnType :: "description" { ... }
    }
}
```

### Infrastructure Service

An `infrastructure service` adapts external system capabilities through domain language.

```
infrastructure service Name :: "description" {
    operations {
        opName(params) : ReturnType :: "description" { ... }
    }
}
```

#### Service classification

| Pattern | Type |
|---------|------|
| Business logic spanning entities | `domain service` |
| Use case orchestration | `application service` |
| External system adapter (notifications, payments, storage) | `infrastructure service` |

---

## Behavioral constructs

### Operations (entity/aggregate-scoped)

Operations are defined inside an entity's `operations { }` block. Three forms:

#### Form 1 — Command-triggered

```
"Business intent label" on CommandType {
    precondition name :: "description" { expr } rejects "message"
    resolves Entity from dotPath
    creates Entity { field = value }
    sets Entity { field = value }
    Service.op(args) :: "description"
    emits Event { field = value }
}
```

#### Form 2 — Event-triggered

```
"Business intent label" when EventType then CommandType {
    clauses...
}
```

#### Form 3 — Internal

```
name(params) : ReturnType :: "description" {
    clauses...
}
```

#### Operation clause rules

| Clause | Syntax | Rule |
|---|---|---|
| `precondition` | `precondition name :: "desc" { expr } rejects "msg"` | Named guard — replaces v1 `fails when`. Expression must be a real boolean condition. |
| `postcondition` | `postcondition name :: "desc" { expr }` | Evaluates over state_before, state_after, and arguments. |
| `resolves` | `resolves TypeName from dotPath` | Entity resolution — every entity you `sets` must be resolved or created first. |
| `creates` | `creates TypeName { field = value }` | Entity creation with explicit field assignments. |
| `sets` | `sets TypeName { field = value }` | Entity mutation with explicit field assignments. |
| `emits` | `emits TypeName { field = value }` | Event emission with explicit field assignments. |
| service call | `Service.op(args) :: "description"` | Direct call. Replaces v1 `delegates`. |
| `foreach` | `foreach dotPath as id { clauses }` | Iteration over a collection. |
| policy call | `policy identifier(args)` | References a named policy (precondition). |

#### Resolution patterns

**Direct — from command/event field:**

```
resolves Customer from placeOrder.customerId
resolves Order from cancelOrder.orderId
```

**Indirect — from already-resolved entity:**

```
resolves Payment from Order
```

#### Example

```
"Cancel an order" on CancelOrder {
    resolves Order from cancelOrder.orderId

    precondition orderCancellable :: "Order must be in a cancellable status" {
        Order.status in {draft, confirmed}
    } rejects "Order cannot be cancelled"

    sets Order {
        status = cancelled
        cancelledAt = now()
    }

    StockService.restock(Order.lines) :: "Restore stock for cancelled lines"

    emits OrderCancelled {
        orderId = Order.id
        lines = Order.lines
        reason = cancelOrder.reason
        cancelledAt = Order.cancelledAt
    }
}
```

---

### Policy (reactive rule)

A `policy` is a reactive rule: it listens to events and issues commands in response. This is NOT a precondition (preconditions are clauses on operations).

#### Skeleton

```
policy Name :: "description" {
    trigger EventType
    guard { expression }
    effect CommandType
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Trigger | One or more event types that activate the policy. |
| Guard | Optional condition — policy fires only when guard is true. |
| Effect | The command to issue when the policy fires. |
| Distinction | Policies react to events. Preconditions guard operations. Invariants assert properties. |

#### Example

```
policy LateDeliveryAlert :: "Alert when delivery is overdue" {
    trigger DeliveryOverdue
    guard { Order.status = shipped }
    effect NotifyLateDelivery
}
```

---

### Invariant

An `invariant` is a safety property — a rule that must hold at every observable point.

#### Two scopes

**File-level** — with `enforcement` strategy:

```
invariant Name :: "description" {
    on EntityType
    must { expression }
    enforcement rejection | compensation CommandType | alert
}
```

**Entity/value-scoped** — inside `invariants { }` block:

```
name :: "description" {
    expression
}
```

#### Enforcement strategies

| Strategy | Meaning |
|----------|---------|
| `rejection` | Operation refused, no state change. |
| `compensation CommandType` | State change accepted, corrective command issued. |
| `alert` | Violation recorded for review. |

---

### Agreement & Reconciliation

An `agreement` is a consistency property spanning multiple aggregates — cannot be verified atomically.

#### Skeleton

```
agreement Name :: "description" {
    participants { EntityA, EntityB }
    predicate { expression }
    reconciliation ReconciliationName :: "description" {
        trigger event EventType | schedule "expression"
        detection query | eventSourced
        compensation { CommandA, CommandB }
        coordination orchestrated | choreographed
        escalation {
            step 1 retry after duration
            step 2 alert "message"
            step 3 suspend
        }
    }
}
```

---

### State Machine

A `states { machine ... }` block structures the lifecycle of an entity through named states and transitions.

#### Skeleton

```
states {
    machine MachineName :: "description" {
        state stateName :: "description" {
            invariant ruleName :: "description" { expression }
        }
        final stateName :: "description"

        [*] --> stateName on operationLabel
        stateName --> stateName on operationLabel when { guard } then { action }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `state` | A regular state in the lifecycle. Can contain state-scoped invariants. |
| `final` | A terminal state — no transitions out. |
| `[*]` | The initial pseudo-state (entry point). |
| Transition labels | Must match operation labels in the same entity. |
| `when` / `then` | Optional guard and action on transitions. |

---

### Interface

An `interface` exposes a subset of operations from entities or domain services.

```
interface Name :: "description" {
    exposes Entity.operationName
    exposes DomainService.operationName
}
```

---

## Expression Rules

### Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `sum()`, `isEmpty()`, `isNotEmpty()`, `now()`, `today()`, `and`, `or`, `not`, `+`, `-`, `*`, `/`, `every TypeName in dotPath { expr }`, `if expr { expr }`

### Quick Reference

| Pattern | Expression |
|---|---|
| Status check | `Entity.status != someValue` |
| Set membership | `Entity.status in {draft, confirmed}` |
| Existence | `Entity is defined` / `Entity is not defined` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |
| Universal quantifier | `every Product in lines { Product.available = true }` |
| Computed value | `total.amount = productPrice.amount * quantity` |
| Conditional | `if charge.type = loan { charge.timeType in { disbursement } }` |

### Field Types

Primitives: `string`, `int`, `long`, `decimal`, `boolean`, `uuid`, `datetime`, `date`, `time`, `duration`

Collections: `list<T>`, `set<T>`, `map<K,V>`

Constraints: `optional`, `required`, `immutable`, `unique`, `ordered`, `min(n)`, `max(n)`, `minLength(n)`, `maxLength(n)`, `pattern("regex")`, `default("value")`, `pastOrPresent`, `futureOrPresent`

### `// UNCLEAR` and `// NOTE` markers

| Marker | When to use |
|---|---|
| `// UNCLEAR: description` | Business rule that cannot be expressed in the grammar — needs domain expert clarification. |
| `// NOTE: description` | Infrastructure concern or technical detail not part of the domain model. |

---

## Syntax Reference

Load the grammar file during Phase 1 to calibrate syntax:

| Grammar | File |
|---|---|
| Specy v3 (.domain) | Read `grammars/domain.ebnf` |

---

## Canonical Example

### orders.domain

```specy
organization ECommerce :: "E-Commerce platform" {

context Orders (ORD) :: "Order management bounded context" {

    requirements-source "business-loan.sysreq"

    // =============================================================================
    // Context Map
    // =============================================================================

    map {
        downstream Shipping : ACL
    }

    module Order :: "Core order processing module" {

        depends on {
            Shipping
        }

        // =============================================================================
        // Enums
        // =============================================================================

        // source: enums/OrderStatus
        enum OrderStatus :: "Lifecycle status of an order" {
            draft
            confirmed
            shipped
            delivered
            cancelled
        }

        // source: enums/PaymentStatus
        enum PaymentStatus :: "Status of a payment transaction" {
            pending
            captured
            failed
            refunded
        }

        // source: enums/PaymentMethod
        enum PaymentMethod :: "Supported payment methods" {
            creditCard
            bankTransfer
            paypal
        }

        // source: enums/CustomerStatus
        enum CustomerStatus :: "Lifecycle status of a customer account" {
            active
            suspended
            closed
        }

        // =============================================================================
        // Value Objects
        // =============================================================================

        // source: values/Address
        value Address :: "A postal address" {
            fields {
                street : string
                city : string
                zipCode : string maxLength(10)
                country : string
            }
        }

        // source: values/Money
        value Money :: "A monetary amount with currency" {
            fields {
                amount : decimal min(0)
                currency : string default("EUR") maxLength(3)
            }
        }

        // source: values/EmailAddress
        value EmailAddress :: "A validated email address" {
            fields {
                value : string pattern("^[^@]+@[^@]+\\.[^@]+$")
            }
        }

        // source: values/OrderLine
        value OrderLine :: "A single line item within an order" {
            fields {
                productId : uuid
                quantity : int required min(1) max(1000)
                productPrice : Money
                total : Money
            }

            invariants {
                positiveQuantity :: "Order line quantity must be greater than zero" {
                    quantity > 0
                }
                lineTotalConsistency :: "Line total must equal unit price multiplied by quantity" {
                    total.amount = productPrice.amount * quantity
                }
            }
        }

        // =============================================================================
        // Services
        // =============================================================================

        // source: services/PricingCalculator
        domain service PricingCalculator :: "Computes pricing from order lines" {
            operations {
                computeTotal(lines: list<OrderLine>) : Money :: "Compute total from order lines" {
                    returns sum(lines.total)
                }
            }
        }

        // source: services/NotificationService
        infrastructure service NotificationService :: "Sends notifications to customers" {
            operations {
                notifyCustomer(customerId: uuid, message: string) :: "Send a notification to a customer" {
                }
            }
        }

        // source: services/StockService
        domain service StockService :: "Manages product stock levels" {
            operations {
                restock(lines: list<OrderLine>) :: "Restore stock for each cancelled order line" {
                    foreach lines as line {
                        resolves Product from line.productId
                        Product.increase(line.quantity)
                    }
                }
            }
        }

        // =============================================================================
        // Module-level policies (cross-entity)
        // =============================================================================

        // source: policies/customerMustBeActive
        policy CustomerMustBeActive :: "Customer should be active" {
            trigger PlaceOrder
            guard {
                customer.status = active
            }
            effect PlaceOrder
        }

        // source: policies/maxOrderAmount
        policy MaxOrderAmount :: "Orders above 10000 require manual approval" {
            trigger OrderPlaced
            guard {
                order.totalAmount.amount <= 10000
            }
            effect PlaceOrder
        }

        // source: policies/minimumOrderAmount
        policy MinimumOrderAmount :: "Orders must have a total amount of at least 1" {
            trigger OrderPlaced
            guard {
                order.totalAmount.amount >= 1
            }
            effect PlaceOrder
        }

        // source: policies/deliveryOnTime
        policy DeliveryOnTime :: "Orders past their estimated delivery date require attention" {
            trigger OrderShipped
            guard {
                if order.estimatedDelivery is defined {
                    order.estimatedDelivery > today()
                }
            }
            effect ShipOrder
        }

        // source: policies/bankTransferMinimum
        policy BankTransferMinimum :: "Bank transfers require a minimum of 50" {
            trigger PaymentProcessed
            guard {
                if payment.method = bankTransfer {
                    order.totalAmount.amount >= 50
                }
            }
            effect ProcessPayment
        }

        // =============================================================================
        // Entities
        // =============================================================================

        // source: entities/Customer
        entity Customer :: "A customer who places orders" {
            identity id : uuid
            fields {
                name : string minLength(1) maxLength(100)
                email : EmailAddress unique
                status : CustomerStatus default("active")
                birthDate : date optional past
                shippingAddress : Address optional
                createdAt : datetime immutable pastOrPresent
            }
        }

        // source: entities/Product
        entity Product :: "A product available for purchase" {
            identity id : uuid
            fields {
                name : string minLength(1) maxLength(200)
                description : string optional maxLength(2000)
                price : Money
                tags : set<string> optional
                rating : int optional range(1, 5)
                available : boolean default("true")
                stockQuantity : int min(0)
            }

            operations {
                increase(quantity: int) :: "Restore stock for a product" {
                    sets Product {
                        stockQuantity = stockQuantity + quantity
                    }
                }
            }
        }

        // source: entities/Order
        entity Order :: "A customer order" meta { aggregate = "true" } satisfies [REQ-ORD-001] {
            identity id : uuid
            fields {
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
            references {
                customer : Customer 1..1
                lines : OrderLine 1..N
            }

            operations {
                // alternative create(placeOrder: PlaceOrder)
                // alternative when ... then ... :: "..." {
                // alternative on PlaceOrder :: "..." {
                "Place a new order" on PlaceOrder {
                    resolves Customer from placeOrder.customerId

                    precondition customerMustBeActive :: "Customer should be active to place an order" {
                        Customer.status = active
                    } rejects "Cannot place order: customer is not active"

                    precondition orderMustContainLines :: "Order must contain order lines" {
                        isNotEmpty(placeOrder.lines)
                    } rejects "Cannot place order: no order lines provided"

                    precondition productMustBeAvailable :: "Every order line must be available" {
                        every Product in placeOrder.lines {
                            Product.available = true
                        }
                    } rejects "Cannot place order: one or more products are unavailable"

                    precondition maxOrderLines :: "Orders with more than 20 lines require manual review" {
                        count(placeOrder.lines) <= 20
                    } rejects "Cannot place order: exceeds 20 line items"

                    creates Order {
                        status = draft
                        customer = Customer
                        shippingAddress = placeOrder.shippingAddress
                        lines = placeOrder.lines
                        placedAt = now()
                        totalAmount = PricingCalculator.computeTotal(placeOrder.lines)
                    }

                    postcondition minimumOrderAmount :: "Order total must be at least 1" {
                        Order.totalAmount.amount >= 1
                    }

                    postcondition maxOrderAmount :: "Orders above 10000 require manual approval" {
                        Order.totalAmount.amount <= 10000
                    }

                    emits OrderPlaced {
                        orderId = Order.id
                        totalAmount = Order.totalAmount
                        placedAt = Order.placedAt
                        customerId = Customer.id
                    }
                }

                "Confirm an order after payment" on ConfirmOrder {
                    resolves Order from confirmOrder.orderId
                    resolves Payment from Order

                    precondition orderMustBePlaced :: "Order must have been placed" {
                        Order.placedAt is defined
                    } rejects "Cannot confirm order: order has not been placed"

                    precondition paymentMustBeCaptured :: "Payment must be captured" {
                        Payment.status = captured
                    } rejects "Cannot confirm order: payment has not been captured"

                    sets Order {
                        status = confirmed
                        confirmedAt = now()
                    }

                    emits OrderConfirmed {
                        orderId = Order.id
                        confirmedAt = Order.confirmedAt
                    }
                }

                "Cancel an order" on CancelOrder {
                    resolves Order from cancelOrder.orderId

                    sets Order {
                        status = cancelled
                        cancelledAt = now()
                    }

                    StockService.restock(Order.lines)

                    emits OrderCancelled {
                        orderId = Order.id
                        lines = Order.lines
                        reason = cancelOrder.reason
                        cancelledAt = Order.cancelledAt
                    }
                }

                "Ship a confirmed order" on ShipOrder {
                    resolves Order from shipOrder.orderId
                    resolves Payment from Order

                    precondition shippingAddressMustExist :: "Shipping address is required" {
                        Order.shippingAddress is defined
                    } rejects "Cannot ship order: no shipping address"

                    precondition paymentMustBeCapturedForShipping :: "Payment must be captured" {
                        Payment.status = captured
                    } rejects "Cannot ship order: payment has not been captured"

                    precondition deliveryOnTime :: "Orders past their estimated delivery date require attention" {
                        if Order.estimatedDelivery is defined {
                            Order.estimatedDelivery > today()
                        }
                    } rejects "Cannot ship order: past estimated delivery date"

                    sets Order {
                        status = shipped
                        shippedAt = now()
                    }

                    emits OrderShipped {
                        orderId = Order.id
                        shippedAt = Order.shippedAt
                        trackingNumber = shipOrder.trackingNumber
                    }
                }

                "Deliver a shipped order" on DeliverOrder {
                    resolves Order from deliverOrder.orderId

                    precondition deliveryOnTimeForDelivery :: "Orders past their estimated delivery date require attention" {
                        if Order.estimatedDelivery is defined {
                            Order.estimatedDelivery > today()
                        }
                    } rejects "Cannot deliver order: past estimated delivery date"

                    sets Order {
                        status = delivered
                        deliveredAt = now()
                    }

                    emits OrderDelivered {
                        orderId = Order.id
                        deliveredAt = Order.deliveredAt
                    }
                }

                "Notify customer when order is confirmed" when OrderConfirmed then NotifyOrderConfirmation {
                    NotificationService.notifyCustomer(Order.customer.id, "Your order has been confirmed")

                    Shipping.PrepareShipment(orderId = Order.id) :: "Launch shipping process"
                }

                "Cancel an order on payment failure" when PaymentFailed then CancelAfterPaymentFailure {
                    sets Order {
                        status = cancelled
                        cancelledAt = now()
                    }

                    StockService.restock(Order.lines)

                    emits OrderCancelled {
                        orderId = Order.id
                        lines = Order.lines
                        reason = "Order cancelled due to payment failure"
                        cancelledAt = Order.cancelledAt
                    }

                    NotificationService.notifyCustomer(Order.customer.id, "Your payment has failed and the order has been cancelled")
                }

                "Notify customer of delivery" when OrderDelivered then NotifyOrderDelivery {
                    NotificationService.notifyCustomer(Order.customer.id, "Your order has been delivered")
                }
            }

            states {
                machine OrderLifecycle :: "Order status lifecycle" {
                    state draft :: "Order has been placed but not yet confirmed"
                    state confirmed :: "Order has been confirmed after payment"
                    state shipped :: "Order has been shipped to customer"
                    state cancelled :: "Order has been cancelled"
                    final delivered :: "Order has been delivered to customer"

                    [*] --> draft on PlaceOrder
                    draft --> confirmed on ConfirmOrder
                    draft --> cancelled on CancelOrder
                    draft --> cancelled on CancelAfterPaymentFailure
                    confirmed --> shipped on ShipOrder
                    confirmed --> cancelled on CancelOrder
                    confirmed --> cancelled on CancelAfterPaymentFailure
                    shipped --> delivered on DeliverOrder
                }
            }

            invariants {
                orderContainsLines :: "An order must contain at least one line" {
                    isNotEmpty(lines)
                }
                orderTotalPositive :: "Order total amount must not be negative" {
                    totalAmount.amount >= 0
                }
            }
        }

        // source: entities/Payment
        entity Payment :: "A payment associated with an order" {
            identity id : uuid
            fields {
                amount : Money
                method : PaymentMethod
                status : PaymentStatus default("pending")
                processedAt : datetime optional pastOrPresent
                failureReason : string optional maxLength(500)
                createdAt : datetime immutable pastOrPresent
            }
            references {
                order : Order 1..1
            }

            operations {
                "Process payment for an order" on ProcessPayment {
                    resolves Order from processPayment.orderId

                    precondition orderMustBeDraft :: "Order must be in draft status" {
                        Order.status = draft
                    } rejects "Cannot process payment: order is not in draft status"

                    precondition bankTransferMinimum :: "Bank transfers require a minimum of 50" {
                        if processPayment.method = bankTransfer {
                            Order.totalAmount.amount >= 50
                        }
                    } rejects "Cannot process payment: bank transfer minimum is 50"

                    creates Payment {
                        order = Order
                        status = captured
                        processedAt = now()
                        method = processPayment.method
                        amount = Order.totalAmount
                    }

                    emits PaymentProcessed {
                        paymentId = Payment.id
                        orderId = Order.id
                        amount = Payment.amount
                        method = Payment.method
                        processedAt = Payment.processedAt
                    }
                }

                "Refund a captured payment" on RefundPayment {
                    resolves Payment from refundPayment.paymentId

                    precondition orderCancelledForRefund :: "Order must be cancelled to refund" {
                        Payment.order.status = cancelled
                    } rejects "Cannot refund payment: order has not been cancelled"

                    sets Payment {
                        status = refunded
                    }

                    emits PaymentRefunded {
                        paymentId = Payment.id
                        orderId = Payment.order.id
                        amount = Payment.amount
                        reason = refundPayment.reason
                        refundedAt = now()
                    }
                }

                "Handle payment failure" when PaymentFailed then HandlePaymentFailure {
                    resolves Payment from handlePaymentFailure.paymentId

                    sets Payment {
                        status = failed
                    }
                    // NOTE: retry mechanism (infrastructure)

                    NotificationService.notifyCustomer(Payment.order.customer.id, "Your payment has failed")
                }

                "Notify customer of refund" when PaymentRefunded then NotifyPaymentRefund {
                    NotificationService.notifyCustomer(Payment.order.customer.id, "Your refund has been processed")
                }
            }

            states {
                machine PaymentLifecycle :: "Payment status lifecycle" {
                    state pending :: "Payment created and awaiting capture"
                    state captured :: "Payment successfully captured"
                    state failed :: "Payment attempt failed"
                    final refunded :: "Payment has been refunded"

                    [*] --> pending on ProcessPayment
                    pending --> captured on ProcessPayment
                    pending --> failed on HandlePaymentFailure
                    // NotifyPaymentRefund does not trigger a transition
                    captured --> refunded on RefundPayment
                }
            }

            invariants {
                paymentMatchesOrder :: "Payment amount must equal the order total" {
                    amount.amount = order.totalAmount.amount
                }
            }
        }

        // =============================================================================
        // Queries
        // =============================================================================

        // source: queries/OrderSummary
        query OrderSummary :: "Retrieve a summary view of an order" satisfies [REQ-ORD-001] {
            fields {
                orderId : uuid
            }
            returns Order
        }

        // =============================================================================
        // Commands
        // =============================================================================

        // source: commands/PlaceOrder
        command PlaceOrder :: "Place a new order for a customer" {
            fields {
                customerId : uuid
                lines : list<OrderLine>
                shippingAddress : Address
            }
        }

        // source: commands/ConfirmOrder
        command ConfirmOrder :: "Confirm an order after payment" {
            fields {
                orderId : uuid
            }
        }

        // source: commands/CancelOrder
        command CancelOrder :: "Cancel an existing order" {
            fields {
                orderId : uuid
                reason : string optional maxLength(500)
            }
        }

        // source: commands/ProcessPayment
        command ProcessPayment :: "Process payment for an order" {
            fields {
                orderId : uuid
                method : PaymentMethod
            }
        }

        // source: commands/RefundPayment
        command RefundPayment :: "Refund a captured payment" {
            fields {
                paymentId : uuid
                reason : string optional maxLength(500)
            }
        }

        // source: commands/ShipOrder
        command ShipOrder :: "Ship a confirmed order" {
            fields {
                orderId : uuid
                trackingNumber : string optional maxLength(100)
            }
        }

        // source: commands/DeliverOrder
        command DeliverOrder :: "Deliver a shipped order" {
            fields {
                orderId : uuid
            }
        }

        // source: commands/CancelAfterPaymentFailure
        command CancelAfterPaymentFailure :: "Cancel an order due to payment failure" {
            fields {
                orderId : uuid
            }
        }

        // source: commands/NotifyOrderConfirmation
        command NotifyOrderConfirmation :: "Notify customer of order confirmation" {
            fields {
                orderId : uuid
            }
        }

        // source: commands/NotifyOrderDelivery
        command NotifyOrderDelivery :: "Notify customer that order has been delivered" {
            fields {
                orderId : uuid
            }
        }

        // source: commands/HandlePaymentFailure
        command HandlePaymentFailure :: "Handle a payment failure event" {
            fields {
                paymentId : uuid
            }
        }

        // source: commands/NotifyPaymentRefund
        command NotifyPaymentRefund :: "Notify customer of a refund" {
            fields {
                paymentId : uuid
            }
        }

        // =============================================================================
        // Events
        // =============================================================================

        // source: events/OrderPlaced
        event OrderPlaced :: "Emitted when a new order is placed" {
            fields {
                orderId : uuid
                customerId : uuid
                totalAmount : Money
                placedAt : datetime
            }
        }

        // source: events/OrderConfirmed
        event OrderConfirmed :: "Emitted when an order is confirmed after payment" {
            fields {
                orderId : uuid
                confirmedAt : datetime
            }
        }

        // source: events/OrderCancelled
        event OrderCancelled :: "Emitted when an order is cancelled" {
            fields {
                orderId : uuid
                lines : list<OrderLine>
                reason : string optional
                cancelledAt : datetime
            }
        }

        // source: events/OrderShipped
        event OrderShipped :: "Emitted when an order is shipped" {
            fields {
                orderId : uuid
                shippedAt : datetime
                trackingNumber : string optional
            }
        }

        // source: events/OrderDelivered
        event OrderDelivered :: "Emitted when an order is delivered" {
            fields {
                orderId : uuid
                deliveredAt : datetime
            }
        }

        // source: events/PaymentProcessed
        event PaymentProcessed :: "Emitted when a payment is successfully processed" {
            fields {
                paymentId : uuid
                orderId : uuid
                amount : Money
                method : PaymentMethod
                processedAt : datetime
            }
        }

        // source: events/PaymentFailed
        event PaymentFailed :: "Emitted when a payment attempt fails" {
            fields {
                paymentId : uuid
                orderId : uuid
                reason : string
                failedAt : datetime
            }
        }

        // source: events/PaymentRefunded
        event PaymentRefunded :: "Emitted when a payment is refunded" {
            fields {
                paymentId : uuid
                orderId : uuid
                amount : Money
                reason : string optional
                refundedAt : datetime
            }
        }

        // =============================================================================
        // Agreement — cross-aggregate consistency
        // =============================================================================

        // source: invariant/paymentMatchesOrder (cross-aggregate)
        agreement PaymentOrderConsistency :: "Payment amount must always match the order total across Order and Payment aggregates" {
            participants {
                Order, Payment
            }
            predicate {
                Payment.amount.amount = Payment.order.totalAmount.amount
            }
            reconciliation PaymentOrderReconciliation :: "Detect and compensate payment-order amount drift" {
                trigger event OrderCancelled
                detection query
                compensation {
                    RefundPayment
                }
                coordination choreography
            }
        }

    } // module Order

} // context Orders

} // organization ECommerce
```

---

## Output Checklist

Before writing final files, verify each item. If any fails, fix it.

- [ ] Enum values in `camelCase` (no `UPPER_SNAKE_CASE`)
- [ ] No precondition with tautological condition on a required/immutable field
- [ ] No `invariant` on command or event (entities and values only for scoped; file-level with `on Entity`)
- [ ] No precondition with empty or tautological expression — if unexpressible, use `// UNCLEAR` inline
- [ ] No `service` for pure infrastructure — classify into domain/application/infrastructure service
- [ ] Every `sets`/`creates` entity appears in `resolves` or `creates` of the same operation
- [ ] Every `dotPath` resolves through the structural definitions
- [ ] Every enum value in expressions exists in the enum definition
- [ ] Every service call resolves to a declared service + operation
- [ ] Every precondition expression is a real boolean condition
- [ ] Every operation label in state machine transitions matches an operation in the same entity
- [ ] Every `emits` type exists as a top-level `event` with matching fields
- [ ] Every `references` type exists as an entity or value
- [ ] Every aggregate has a `root` and its contained entities listed
- [ ] Every query has a `returns` declaration
- [ ] Every reactive policy has `trigger` and `effect` that resolve
- [ ] Every file-level invariant has an `enforcement` strategy
- [ ] Messages in business language, not technical jargon
- [ ] `// source:` comment on every definition
- [ ] Query-only entities annotated with `// NOTE: query-only`
- [ ] Unreferenced enums annotated with `// NOTE: not referenced`

---

## Edge Cases

- **Anemic models:** look for logic in services, controllers, middleware. If truly no rules → minimal specs + `// NOTE: anemic model`.
- **Multiple bounded contexts:** separate `.domain` per context.
- **Shared types:** duplicate in each `.domain` (each context is self-contained).
- **Generated code:** ignore unless it reveals domain concepts not found elsewhere.
- **Tests as source:** tests are a legitimate evidence source (see Decision Test 1). Read test files correlated to handlers — assertions confirm `precondition` clauses, `sets`, `emits`, service calls. Multiple tests on the same handler with different preconditions signal branching (see test heuristics for decomposition rules). Absence of tests never degrades extraction.
- **Large projects (>50 models):** ask the user to scope before proceeding.
- **Missing events:** do not invent. Signal with `// NOTE: no domain event emitted — consider adding {Event} if {reason}`.
- **Inheritance:** same type field → single entity + enum (`// NOTE: collapsed hierarchy`). Different fields → separate entities.
- **v2 format detected:** if existing `.domain` files use v2 syntax (flat `module`/`uses module`, `identifier`, `transitions {}`, single `service`), migrate to v3 syntax during extraction.
