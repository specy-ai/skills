---
name: distill-v2
description: Reverse-engineers source code into Specy v2 .domain.specy files
user-invocable: true
---

# Skill: distill-v2

## Role

You are an expert Domain-Driven Design practitioner who reverse-engineers existing source code into Specy v2 specification files. You extract the business logic — entities, value objects, commands, events, operations, policies, and invariants — from a codebase and express them in a unified `.domain.specy` file.

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

If the result affects an entity field via `sets` or is enforced as a policy, it is domain. Otherwise it is likely infrastructure.

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
| `field is defined` on a required/immutable field (in `fails` or `must`) | Always true → tautology | Use the real condition or `// UNCLEAR` |
| `now() - Entity.createdAt > 5` | No duration operator → ambiguous | `// UNCLEAR` with business rule |
| Status check masking a cross-aggregate rule | Real condition involves another aggregate | Model the cross-aggregate lookup or `// UNCLEAR` |
| Placeholder `when { totalAmount > 0 }` for fraud check | Real logic is an external API call | `// NOTE` (infrastructure) |

## Test 4 — "Is it the right construct?"

> Am I placing this element in the correct Specy construct type?

| Element is... | Correct construct |
|---|---|
| Has identity + mutable lifecycle | `entity` |
| No identity, immutable, equality by content | `value` |
| Fixed set of named constants | `enum` |
| Input DTO triggering a write | `command` |
| Record of something that happened | `event` |
| Stateless class with business logic | `service` (in `.domain.specy`) |
| Handler for a command → write operation | `operation` (command-triggered, inside entity) |
| Handler for an event → side effects | `operation` (event-triggered, inside entity) |
| Precondition that must hold before one or more operations execute | `policy` (file-level or entity-scoped, with params) |
| Property always true after any successful mutation of an entity | `invariant` (entity-scoped or value-scoped, never commands/events) |

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

Applies when the user specifies a definition name: `distill-v2 <DefinitionName>`.

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

# Generic Heuristics (any language/framework)

Always load this file. It provides language-agnostic patterns used as a base for all stacks.

## Naming Patterns

| Source Pattern | Inference |
|---|---|
| Class/module named `*Service`, `*Handler`, `*UseCase`, `*Interactor` | Likely contains entity operation logic |
| Class/module named `*Repository`, `*Store`, `*Dao` | The generic type it manages is likely an `entity` (no repository construct in v2 — use for resolution patterns) |
| Class/module named `*Saga`, `*Listener`, `*Subscriber`, `*Consumer` | Likely contains event-triggered entity operation logic |
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
| Call to a service method inside a command handler | direct service call `Service.op(args)` in operation body |
| Service result assigned to an entity field | inline as `field = Service.op(args)` inside `creates`/`sets` assignment block |

### What to model

- **Model:** business calculations (scoring, pricing, weight), business checks (eligibility, time window), external integrations with business scope (federation, notification)
- **Do not model** (use `// NOTE` instead): pure technical processing (image resize, password hash, compression), infrastructure (logging, cache, rate limiting)
- **Decision criterion:** if the result affects an entity field via `sets`/`creates` assignments or a service call appears in the operation body as a side-effect, it is a business service

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

Add `:: "justification"` when the business reason for invoking the service is not obvious from context alone.

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
- The `foreach` body allows: `resolves`, `sets`, `emits`, entity calls (`TypeName.op(args)`), service calls (`Service.op(args)`), and `policy` calls. It does **not** allow `fails` — replace any per-item guard with a named `policy` call.
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

- The target entity must be reachable from a `resolves` or `creates` clause earlier in the same operation — either directly or via relationship navigation.
- Use `sets TypeName { field = value }` blocks; there is no dot-path field targeting syntax (`sets Entity.field to value` does not exist in v2). If you need to update a nested field, resolve the intermediate entity first.
- Add `:: "justification"` when the business reason for the cross-aggregate mutation is not obvious from the construct alone.
- **Decision criterion:** if the code modifies a field on an entity other than the primary aggregate, it is a cross-aggregate mutation. If verifiable (the assignment is in the code), use `sets`. If not verifiable, use `// NOTE:` or `// UNCLEAR:`.

## Service Calls for Side-Effects

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Call to `*NotificationService`, `*EmailService`, `*SmsService`, `*MessagingService`, `*PushService` | `NotificationService.op(args)` service call in operation body |
| Event listener whose only effect is sending a message (no entity mutation) | event-triggered operation body with `ServiceName.op(args)` |
| Call to `send*`, `notify*`, `publish*` on a non-domain service inside a handler | service call statement in operation body |
| Webhook dispatch, HTTP callback to an external system | service call statement, `// NOTE: external HTTP callback` if not in domain scope |

### Rules

- Model the notification/messaging capability as a `service` block with typed operation parameters.
- Call the service directly inside the operation body: `NotificationService.notifyCustomer(id, "message")`.
- The argument string literal must describe the notification in business language ("Your order has been confirmed"), not technical language ("Send email via SES").
- Use `:: "justification"` when the side-effect is a contractual or regulatory obligation.
- **Do not model** as service calls: internal logging, metrics emission, cache invalidation — these are infrastructure (`// NOTE`).
- **Decision criterion:** if a non-technical stakeholder would say "the customer must be notified when X happens", model it as a service call to a notification service.

### Example

```
service NotificationService {
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
| REST/gRPC call to another bounded context's service | `Context.CommandName(namedArgs) :: "justification"` |
| Message published to a topic/queue named after another domain (e.g. `shipping.prepare`) | `Shipping.PrepareShipment(orderId = Order.id) :: "justification"` |
| Saga step invoking another context's command handler | `Context.CommandName(namedArgs)` |
| Choreography: event emission consumed by another context that triggers a command | `Context.CommandName(namedArgs)` |

### Rules

- The call form is `ContextName.CommandName(namedArgs)` — the context name matches a `module` declaration in another `.domain.specy` file; the command name matches a `command` defined in that file.
- Named arguments (`field = value`) are required when the target command has more than one field, to make the mapping explicit.
- Add `:: "justification"` when the business reason for the cross-context call is not obvious.
- If the target module's `.domain.specy` is not yet extracted, use `// NOTE: cross-context call — target module not yet extracted`.
- **Do not use** for intra-context event emission — use `emits EventType { ... }` instead.
- **Decision criterion:** if the code triggers behaviour in a *different* bounded context (different aggregate root, different deployment unit, different team), it is a cross-context call.

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
| `assertThrows` / `expect(...).rejects.toThrow` / `(is (thrown? ...))` | Named `policy` with rejection condition |
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
- `should_allow_retry_when_retryCount_below_3` → operation "Allow payment retry" with `policy retryCountBelowThreshold(Payment)`
- `should_mark_permanent_failure_after_3_retries` → operation "Mark payment as permanently failed" with `policy retryLimitReached(Payment)`

**Decision criterion:** if the tests assert different mutations (`sets`) or different side-effects (`emits`, service calls) depending on preconditions, decompose into separate operations. If the tests only vary in error messages for the same outcome, keep as a single operation with multiple `policy` calls.

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

Rules for expression bodies in policy and invariant blocks. In v2, expressions appear directly inside the construct body — there are no wrapping `when { }` or `must { }` blocks.

## Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `sum()`, `isEmpty()`, `isNotEmpty()`, `now()`, `today()`, `and`, `or`, `not`, `+`, `-`, `*`, `/`, `every TypeName in dotPath { expr }`, `if expr { expr }`

## Quick Reference — Expressible Patterns

| Pattern | Expression |
|---|---|
| Self-reference | `placeOrder.fieldA = placeOrder.fieldB` |
| Ownership | `Entity.userId != placeOrder.userId` |
| Status check | `Entity.status != someValue` |
| Duplicate/existence | `resolves Entity from dotPath` + policy with `Entity is defined` |
| Not found | policy with `Entity is not defined` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |
| Universal quantifier | `every Product in lines { Product.available = true }` |
| Computed value | `total.amount = productPrice.amount * quantity` |
| Conditional validation | `if charge.chargeAppliesTo = loan { charge.chargeTimeType in { disbursement, specifiedDueDate } }` |
| Conditional with optional | `if order.estimatedDelivery is defined { order.estimatedDelivery > today() }` |
| Compound conditional | `if charge.chargeAppliesTo = savings and charge.chargeCalculation = percentOfAmount { charge.chargeTimeType in { withdrawalFee, savingsNoActivityFee } }` |

## Conditional Expressions (`if`)

The `if` expression is a logical implication: `if A { B }` ≡ `¬A ∨ B`. The policy holds when the condition is false (vacuous truth) or when both condition and body are true.

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

## Non-obvious Conditions

When a guard does not map directly to an expressible pattern, apply Decision Test 3 ("Is it faithful?") instead of defaulting to `// UNCLEAR`.

Common resolutions:

| Pattern | Approach |
|---|---|
| Uniqueness check (`repo.existsByEmail`) | `resolves` entity from dotPath + policy with `Entity is defined` |
| Cross-entity existence | Same — `resolves` + `is defined` in policy |
| External business check | `Service.op(args)` direct call + policy on result |

If the condition cannot be expressed faithfully: infrastructure → `// NOTE`; business-critical grammar gap → `// UNCLEAR: {full rule}`.

### Construct Reference

# Specy v2 Construct Reference

## Structural constructs

### Entity

An `entity` is a domain object with a unique identity that persists over time. Entities are aggregate roots or members of an aggregate — they own mutable state and are the primary targets of commands, operations, and invariants.

#### Skeleton

```
entity Name :: "justification" {
    identifier fieldName : type
    fields {
        field : type constraint
    }
    references {
        fieldName : TypeName cardinality
    }
    policies {
        name(params) :: "justification" { expression }
    }
    invariants {
        name :: "justification" { expression }
    }
    operations {
        "Label" on CommandType { clauses... }
        "Label" when EventType then CommandType { clauses... }
        name(params) :: "justification" { clauses... }
    }
    transitions {
        [*] --> state on "label"
        state --> state on "label"
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Identity | Must have an `identifier` declaration (e.g., `identifier id : UUID`). Replaces the v1 `id : uuid unique immutable` convention. |
| Justification | Optional `:: "justification"` after the entity name describes the entity's purpose. |
| Fields | Wrapped in a `fields { }` block. Apply domain constraints directly on fields (`min`, `max`, `optional`, `default`, etc.). |
| References | Declared in a separate `references { }` block with explicit cardinality (`1..1`, `1..N`). |
| Sub-blocks | `references`, `policies`, `invariants`, `operations`, and `transitions` are all optional. `identifier` and `fields` are required. |
| Naming | `PascalCase` for the entity name, `camelCase` for field names. |

#### Example

```
entity Order :: "A customer order" {
    identifier id: UUID
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
    transitions { ... }
}
```

---

### Value

A `value` is an immutable object defined entirely by its attributes — it has no identity. Two values with the same fields are considered equal. In v2, values can contain an `invariants` block to express self-consistency rules.

#### Skeleton

```
value Name {
    fields {
        field : type constraint
    }
    invariants {
        name :: "justification" { expression }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| No identity | Never add an `identifier` — that makes it an entity. |
| Immutability | All fields are implicitly immutable. |
| Fields block | Fields are wrapped in a `fields { }` block. |
| Invariants | Optional `invariants { }` block for self-consistency rules on value fields. |
| Composability | Values can be embedded inside entities, other values, commands, and events. |
| Naming | `PascalCase` for the value name, `camelCase` for field names. |

#### Example

```
value OrderLine {
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
```

---

### Enum

An `enum` defines a closed set of named values representing a domain classification.

#### Skeleton

```
enum Name {
    value1
    value2
    value3
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Values | `camelCase` identifiers — convert `UPPER_SNAKE_CASE` from source code. |
| Closed set | All valid values must be listed exhaustively. |
| No fields | Enum values have no associated data — use a value object if data is needed. |
| Referenced by | Entities, values, commands, and events reference enums as field types. |

#### Example

```
enum OrderStatus {
    draft
    confirmed
    shipped
    delivered
    cancelled
}
```

---

### Command

A `command` represents an intent to change the state of the domain. Each command triggers exactly one operation inside an entity.

#### Skeleton

```
command Name {
    fields {
        field : type constraint
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, verb-noun form (e.g., `PlaceOrder`, `CancelOrder`). |
| Fields block | Fields are wrapped in a `fields { }` block. Carry the data needed to fulfill the intent. |
| 1:1 mapping | Exactly one entity operation must declare `on` this command. |
| No behavior | Commands are pure data — behavior lives in the entity operation. |

#### Example

```
command CancelOrder {
    fields {
        orderId : uuid
        reason : string optional maxLength(500)
    }
}
```

---

### Event

An `event` signals that something has happened in the domain. Events are emitted by operations and can trigger zero or more reactive operations.

#### Skeleton

```
event Name {
    fields {
        field : type
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, past-tense (e.g., `OrderPlaced`, `OrderCancelled`). |
| Fields block | Fields are wrapped in a `fields { }` block. Carry the facts of what happened. |
| 0:N mapping | Zero or more operations may declare `when` this event. |
| Immutable | Events are facts — they cannot be modified after emission. |

#### Example

```
event OrderCancelled {
    fields {
        orderId : uuid
        lines : list<OrderLine>
        reason : string optional
        cancelledAt : datetime
    }
}
```

---

## Behavioral constructs

### Operations (entity-scoped)

Operations are defined inside an entity's `operations { }` block. They model command handlers, event reactors, and internal behaviors. There are three forms.

#### Form 1 — Command-triggered

Triggered by a command. Exactly one operation per command.

```
"Business intent label" on CommandType {
    clauses...
}
```

#### Form 2 — Event-triggered

Triggered by an event. Zero or more operations per event.

```
"Business intent label" when EventType then CommandType {
    clauses...
}
```

The `then CommandType` names the internal command that carries the event data into this handler.

#### Form 3 — Internal

A named operation callable from other operations or services. Not directly triggered by a command or event.

```
name(params) :: "justification" {
    clauses...
}
```

#### Operation clause rules

| Clause | Syntax | Rule |
|---|---|---|
| `resolves` | `resolves TypeName from dotPath` | Every entity you `sets` or reference must be resolved or created first. No more `via Repository.op` — resolution is direct. |
| policy call | `policy identifier(args)` | Replaces `fails when { }`. References a named policy — either file-level or entity-scoped. |
| `creates` | `creates TypeName { field = valueExpr ... }` | Entity creation with explicit field assignments. |
| `sets` | `sets TypeName { field = valueExpr ... }` | Entity mutation with explicit field assignments. Target must appear in `resolves` or `creates`. |
| `emits` | `emits TypeName { field = valueExpr ... }` | Event emission with explicit field assignments. |
| service call | `dotPath(args) :: "justification"` | Direct call to a service operation. Replaces `delegates`. Optional justification via `::`. |
| `foreach` | `foreach dotPath as identifier { clauses... }` | Iteration over a collection. Body allows: `resolves`, `sets`, `emits`, entity calls, service calls, policy calls. |

#### Resolution patterns

The `resolves` clause identifies which entity to load and from where. Two patterns:

**Direct — from command/event field:**

```
resolves Customer from placeOrder.customerId
resolves Order from cancelOrder.orderId
```

**Indirect — from already-resolved entity:**

```
resolves Payment from Order
```

| Situation | Pattern |
|---|---|
| Command/event carries the entity's ID | Direct |
| An already-resolved entity carries the reference | Indirect |

#### Example

```
"Place a new order" on PlaceOrder {
    resolves Customer from placeOrder.customerId

    policy customerMustBeActive(Customer)
    policy orderMustContainsLines(placeOrder.lines)
    policy productMustBeAvailable(placeOrder.lines)

    creates Order {
        status = draft
        customer = Customer
        shippingAddress = placeOrder.shippingAddress
        lines = placeOrder.lines
        placedAt = now()
        totalAmount = PricingCalculator.computeTotal(placeOrder.lines)
    }

    policy minimumOrderAmount(Order)
    policy maxOrderAmount(Order)

    emits OrderPlaced {
        orderId = Order.id
        totalAmount = Order.totalAmount
        placedAt = Order.placedAt
        customerId = Customer.id
    }
}
```

---

### Service

A `service` block models a stateless class/interface with business logic. Operations have typed parameters in their signature and an optional return type.

#### Skeleton

```
service Name {
    operations {
        opName(params) : returnType :: "justification" {
            foreach / resolves / entityCall / returns
        }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Operations block | All operations are wrapped in an `operations { }` block. |
| Signature | Typed parameters in parentheses. Optional return type after `)` with `:`. |
| Justification | Optional `:: "justification"` on the operation signature. |
| Body | Can contain `foreach`, `resolves`, entity calls (`Entity.op(args)`), and `returns`. |
| No accepts/returns | No more separate `accepts` / `returns` declarations — parameters and return type are in the signature. |
| Exclusion | Do not create services for pure infrastructure (password hashing, logging, caching). Use `// NOTE` instead. |

#### Example

```
service PricingCalculator {
    operations {
        computeTotal(lines: list<OrderLine>) :: "Compute total from order lines" {
            returns sum(lines.total)
        }
    }
}

service StockService {
    operations {
        restock(lines: list<OrderLine>): void :: "Restore stock for each cancelled order line" {
            foreach lines as line {
                resolves Product from line.productId
                Product.increase(line.quantity)
            }
        }
    }
}
```

---

### Policy

A `policy` models a precondition — a state requirement that must be true **before** an operation can proceed. Policies are called inline from operations via `policy name(args)`.

#### Two scopes

**File-level** — cross-entity concerns, uses the `policy` keyword:

```
policy name(params) :: "justification" {
    expression
}
```

**Entity-scoped** — inside an entity's `policies { }` block, NO `policy` keyword:

```
name(params) :: "justification" {
    expression
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Parameters | Explicit typed parameters — the policy receives the data it needs. |
| Justification | `:: "justification"` describes the business reason. |
| Expression body | The precondition expression directly — no more `must { }` / `message` wrappers. |
| Conditional expression | Use `if condition { expression }` for field-dependent validation rules (logical implication: holds when condition is false or when both condition and body are true). |
| Inline calls | Policies are called from operations via `policy name(args)`. No more `on "interaction label"`. |
| Scope decision | Use file-level for cross-entity concerns shared across multiple entities. Use entity-scoped for rules specific to one entity. |
| Empty guard | Never emit a policy with an empty body. If the condition cannot be expressed, use `// UNCLEAR` instead. |

#### Example

File-level:

```
policy customerMustBeActive(customer: Customer) :: "Customer should be active" {
    customer.status = active
}

policy maxOrderAmount(order: Order) :: "Orders above 10000 require manual approval" {
    order.totalAmount.amount <= 10000
}

policy deliveryOnTime(order: Order) :: "Orders past their estimated delivery date require attention" {
    if order.estimatedDelivery is defined {
        order.estimatedDelivery > today()
    }
}

policy bankTransferMinimum(order: Order, payment: Payment) :: "Bank transfers require a minimum of 50" {
    if payment.method = bankTransfer {
        order.totalAmount.amount >= 50
    }
}
```

Entity-scoped (inside Order):

```
policies {
    orderMustBeDraft(order: Order) :: "Order must be in draft status" {
        order.status = draft
    }

    productMustBeAvailable(lines: list<OrderLine>) :: "Every order line must be available" {
        every Product in lines {
            Product.available = true
        }
    }
}
```

Entity-scoped with conditional (inside Charge):

```
policies {
    chargeTimeTypeMustBeValidForLoan(charge: Charge) :: "Loan charges have restricted time types" {
        if charge.chargeAppliesTo = loan {
            charge.chargeTimeType in { disbursement, specifiedDueDate, instalmentFee,
                                        overdueInstallment, trancheDisbursement }
        }
    }

    penaltyCannotBeDueAtDisbursement(charge: Charge) :: "A penalty cannot be due at disbursement" {
        if charge.penalty = true {
            charge.chargeTimeType not in { disbursement, trancheDisbursement }
        }
    }
}
```

---

### Invariant

An `invariant` models a property that is always guaranteed to be true **after** any successful mutation. In v2, invariants can be placed on entities AND values (not on commands or events).

#### Two scopes

**File-level** — uses the `invariant` keyword:

```
invariant name :: "justification" {
    expression
}
```

**Entity/value-scoped** — inside an `invariants { }` block, NO `invariant` keyword:

```
name :: "justification" {
    expression
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Scope | Determined by placement — no more `on Entity`. File-level for cross-entity rules. Scoped for entity- or value-specific rules. |
| No parameters | Invariants have no parameters — they reference fields of their enclosing entity or value directly. |
| Expression body | The condition directly — no more `must { }` / `message` wrappers. |
| Justification | `:: "justification"` describes the business reason. |
| Applicable to | Entities and values. Never on commands or events. |
| Unexpressible | If the condition cannot be expressed faithfully, use `// UNCLEAR` instead of creating a tautological invariant. |

#### Example

Entity-scoped (inside Order):

```
invariants {
    orderContainsLines :: "An order must contain at least one line" {
        isNotEmpty(lines)
    }
    orderTotalPositive :: "Order total amount must not be negative" {
        totalAmount.amount >= 0
    }
}
```

Value-scoped (inside OrderLine):

```
invariants {
    positiveQuantity :: "Order line quantity must be greater than zero" {
        quantity > 0
    }
    lineTotalConsistency :: "Line total must equal unit price multiplied by quantity" {
        total.amount = productPrice.amount * quantity
    }
}
```

---

## Structural blocks (inside entities)

### References

A `references` block declares structural relationships between an entity and other entities or values, with explicit cardinality.

#### Skeleton

```
references {
    fieldName : TypeName cardinality
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Cardinality | `N..M` notation where N and M are integers or `N` (unbounded). Common: `1..1` (required single), `1..N` (required collection), `0..1` (optional single), `0..N` (optional collection). |
| Replaces inline refs | In v1, references were inline fields (`customer : Customer`, `lines : list<OrderLine>`). In v2, they are declared in a dedicated block with cardinality. |
| Cross-module references | When the target type is modelled in another module, declare it as a normal reference and add `uses module` at file level. Do not use `// NOTE` for business types that exist in another module. Reserve `// NOTE` for unmodelled technical types (CodeValue, AppUser, Staff, etc.). |
| Naming | `camelCase` for field names, `PascalCase` for type names. |

#### Example

```
references {
    customer : Customer 1..1
    lines : OrderLine 1..N
    office : Office 1..1           // cross-module — requires `uses module Office`
    // NOTE: staff : Staff 0..1 (not modelled)
}
```

---

### Transitions

A `transitions` block declares a prescriptive state machine for an entity's status field. Labels must match operation labels in the same entity.

#### Skeleton

```
transitions {
    [*] --> state on "operation label"
    state --> state on "label", "label"
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `[*]` | Represents the initial state (entry point). |
| Labels | Must match operation labels (`"Label"` in `"Label" on Command` or `"Label" when Event then Command`) in the same entity. |
| Multiple labels | Multiple operation labels on a single transition are comma-separated. |
| Completeness | Every operation that mutates the status field should have a corresponding transition. |

#### Example

```
transitions {
    [*] --> draft on "Place a new order"
    draft --> confirmed on "Confirm an order after payment"
    draft --> cancelled on "Cancel an order", "Cancel an order on payment failure"
    confirmed --> shipped on "Ship a confirmed order"
    confirmed --> cancelled on "Cancel an order", "Cancel an order on payment failure"
    shipped --> delivered on "Deliver a shipped order"
}
```

---

## Removed constructs (vs v1)

- **`repository`** — eliminated. Resolution is direct via `resolves Entity from dotPath`.
- **`interaction`** (top-level) — replaced by entity-scoped `operations`.
- **`fails when { }`** — replaced by named `policy` calls.
- **`delegates`** — replaced by direct service calls.
- **`triggers notification`** — replaced by service calls to notification services.

---

## Syntax Reference

Load the grammar file during Phase 1 to calibrate syntax:

| Grammar | File |
|---|---|
| Specy v2 (.domain.specy) | Read `grammars/specy.ebnf` |

---

## Canonical Example

### orders.domain.specy

```specy
module Order
uses module Shipping

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
    fields {
        street : string
        city : string
        zipCode : string maxLength(10)
        country : string
    }
}

value Money {
    fields {
        amount : decimal min(0)
        currency : string default("EUR") maxLength(3)
    }
}

value EmailAddress {
    fields {
        value : string pattern("^[^@]+@[^@]+\\.[^@]+$")
    }
}

value OrderLine {
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
service PricingCalculator {
    operations {
        computeTotal(lines: list<OrderLine>) :: "Compute total from order lines" {
            returns sum(lines.total)
        }
    }
}

service NotificationService {
    operations {
        notifyCustomer(customerId: uuid, message: string) :: "Send a notification to a customer" {
        }
    }
}

service StockService {
    operations {
        restock(lines: list<OrderLine>): void :: "Restore stock for each cancelled order line" {
            foreach lines as line {
                resolves Product from line.productId
                Product.increase(line.quantity)
            }
        }
    }
}

// =============================================================================
// File-level policies (cross-entity)
// =============================================================================

policy customerMustBeActive(customer: Customer) :: "Customer should be active" {
    customer.status = active
}

policy maxOrderAmount(order: Order) :: "Orders above 10000 require manual approval" {
    order.totalAmount.amount <= 10000
}

policy minimumOrderAmount(order: Order) :: "Orders must have a total amount of at least 1" {
    order.totalAmount.amount >= 1
}

policy deliveryOnTime(order: Order) :: "Orders past their estimated delivery date require attention" {
    if order.estimatedDelivery is defined {
        order.estimatedDelivery > today()
    }
}

policy bankTransferMinimum(order: Order, payment: Payment) :: "Bank transfers require a minimum of 50" {
    if payment.method = bankTransfer {
        order.totalAmount.amount >= 50
    }
}

// =============================================================================
// Entities
// =============================================================================

entity Customer :: "A customer who places orders" {
    identifier id: UUID
    fields {
        name : string minLength(1) maxLength(100)
        email : EmailAddress unique
        status : CustomerStatus default("active")
        birthDate : date optional past
        shippingAddress : Address optional
        createdAt : datetime immutable pastOrPresent
    }
}

entity Product :: "A product available for purchase" {
    identifier id: UUID
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

entity Order :: "A customer order" {
    identifier id: UUID
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

    policies {
        orderMustContainsLines(lines: list<OrderLine>) :: "Order must contain order lines" {
            isNotEmpty(lines)
        }

        productMustBeAvailable(lines: list<OrderLine>) :: "Every order line must be available" {
            every Product in lines {
                Product.available = true
            }
        }

        maxOrderLines(lines: list<OrderLine>) :: "Orders with more than 20 lines require manual review" {
            count(lines) <= 20
        }

        orderMustBeDraft(order: Order) :: "Order must be in draft status" {
            order.status = draft
        }

        orderMustBePlaced(order: Order) :: "Order must have been placed" {
            order.placedAt is defined
        }

        shippingAddressMustExist(order: Order) :: "Shipping address is required" {
            order.shippingAddress is defined
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

    operations {
        // alternative create(placeOrder: PlaceOrder)
        // alternative when ... then ... :: "..." {
        // alternative on PlaceOrder :: "..." {
        "Place a new order" on PlaceOrder {
            resolves Customer from placeOrder.customerId

            policy customerMustBeActive(Customer)
            policy orderMustContainsLines(placeOrder.lines)
            policy productMustBeAvailable(placeOrder.lines)
            policy maxOrderLines(placeOrder.lines)

            creates Order {
                status = draft
                customer = Customer
                shippingAddress = placeOrder.shippingAddress
                lines = placeOrder.lines
                placedAt = now()
                totalAmount = PricingCalculator.computeTotal(placeOrder.lines)
            }

            policy minimumOrderAmount(Order)
            policy maxOrderAmount(Order)

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

            policy orderMustBePlaced(Order)
            policy paymentMustBeCaptured(Payment)

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

            policy shippingAddressMustExist(Order)
            policy paymentMustBeCaptured(Payment)
            policy deliveryOnTime(Order)

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

            policy deliveryOnTime(Order)

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

    transitions {
        [*] --> draft on "Place a new order"
        draft --> confirmed on "Confirm an order after payment"
        draft --> cancelled on "Cancel an order", "Cancel an order on payment failure"
        confirmed --> shipped on "Ship a confirmed order"
        confirmed --> cancelled on "Cancel an order", "Cancel an order on payment failure"
        shipped --> delivered on "Deliver a shipped order"
    }
}

entity Payment :: "A payment associated with an order" {
    identifier id: UUID
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

    policies {
        paymentMustBeCaptured(payment: Payment) :: "Payment must be captured" {
            payment.status = captured
        }
        orderCancelledForRefund(order: Order) :: "Order must be cancelled to refund" {
            order.status = cancelled
        }
    }

    invariants {
        paymentMatchesOrder :: "Payment amount must equal the order total" {
            amount.amount = order.totalAmount.amount
        }
    }

    operations {
        "Process payment for an order" on ProcessPayment {
            resolves Order from processPayment.orderId

            policy orderMustBeDraft(Order)
            policy bankTransferMinimum(Order, Payment)

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

            policy orderCancelledForRefund(Payment.order)

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

    transitions {
        [*] --> pending on "Process payment for an order"
        pending --> captured on "Process payment for an order"
        pending --> failed on "Handle payment failure"
        // NotifyPaymentRefund ne provoque pas de transition
        captured --> refunded on "Refund a captured payment"
    }
}

// =============================================================================
// Commands
// =============================================================================

command PlaceOrder {
    fields {
        customerId : uuid
        lines : list<OrderLine>
        shippingAddress : Address
    }
}

command ConfirmOrder {
    fields {
        orderId : uuid
    }
}

command CancelOrder {
    fields {
        orderId : uuid
        reason : string optional maxLength(500)
    }
}

command ProcessPayment {
    fields {
        orderId : uuid
        method : PaymentMethod
    }
}

command RefundPayment {
    fields {
        paymentId : uuid
        reason : string optional maxLength(500)
    }
}

command ShipOrder {
    fields {
        orderId : uuid
        trackingNumber : string optional maxLength(100)
    }
}

command DeliverOrder {
    fields {
        orderId : uuid
    }
}

command CancelAfterPaymentFailure {
    fields {
        orderId : uuid
    }
}

command NotifyOrderConfirmation {
    fields {
        orderId : uuid
    }
}

command NotifyOrderDelivery {
    fields {
        orderId : uuid
    }
}

command HandlePaymentFailure {
    fields {
        paymentId : uuid
    }
}

command NotifyPaymentRefund {
    fields {
        paymentId : uuid
    }
}

// =============================================================================
// Events
// =============================================================================

event OrderPlaced {
    fields {
        orderId : uuid
        customerId : uuid
        totalAmount : Money
        placedAt : datetime
    }
}

event OrderConfirmed {
    fields {
        orderId : uuid
        confirmedAt : datetime
    }
}

event OrderCancelled {
    fields {
        orderId : uuid
        lines : list<OrderLine>
        reason : string optional
        cancelledAt : datetime
    }
}

event OrderShipped {
    fields {
        orderId : uuid
        shippedAt : datetime
        trackingNumber : string optional
    }
}

event OrderDelivered {
    fields {
        orderId : uuid
        deliveredAt : datetime
    }
}

event PaymentProcessed {
    fields {
        paymentId : uuid
        orderId : uuid
        amount : Money
        method : PaymentMethod
        processedAt : datetime
    }
}

event PaymentFailed {
    fields {
        paymentId : uuid
        orderId : uuid
        reason : string
        failedAt : datetime
    }
}

event PaymentRefunded {
    fields {
        paymentId : uuid
        orderId : uuid
        amount : Money
        reason : string optional
        refundedAt : datetime
    }
}
```

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
