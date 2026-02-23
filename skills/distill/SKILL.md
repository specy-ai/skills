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

# Decision Tests

Run these 4 tests **in sequence** on every element you are about to emit. If any test fails, apply the indicated action instead.

## Test 1 — "Is it real?"

> Can I point to a line of source code that evidences this element?

- **Yes** → proceed to Test 2.
- **No** → **do not emit**. Never invent logic absent from code.

## Test 2 — "Is it domain?"

> Would this element still exist if we swapped the technical stack (framework, database, transport)?

- **Yes** (business calculation, domain rule, business status) → proceed to Test 3.
- **No** (password hashing, MIME validation, rate limiting, caching, logging, token storage, metrics) → **omit** with `// NOTE: {description} (infrastructure)`.

### Grey-zone heuristic

If the result affects an entity field via `sets` or conditions the flow via `fails`, it is domain. Otherwise it is likely infrastructure.

### Separate the authorization mechanism from the protected action

A role check (`user.isAdmin`, `requirePermission`) is an **authorization mechanism** — infrastructure. But the action it protects (freeze a user, delete content, manage tokens) may be a **domain operation** that changes entity state. Evaluate the action independently of its guard: if the action passes Test 2, model the interaction; annotate the role check with `// UNCLEAR: admin role authorization`.

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
| Stateless class with business logic | `service` (in `.flow`) |
| Persistence interface for aggregate root | `repository` (in `.flow`) |
| Handler for a command → write operation | `interaction` (command-triggered) |
| Handler for an event → side effects | `interaction` (event-triggered) |
| Cross-cutting rule spanning multiple operations | `policy` |
| Structural constraint always true for an entity | `invariant` (entities only, never commands/events/values) |

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
3. Locate key code areas: models/entities, handlers/services, events, repositories, validators/policies.
4. Identify bounded context(s) and propose domain name(s).
5. Print reconnaissance summary:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework: {framework}
   - Domain(s) identified: {list}
   - Models found: {count} — Handlers/Services: {count} — Events: {count}
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
5. **Cross-cutting rules** → `policy` blocks. **Structural constraints** → `invariant` blocks.
6. Write `.flow` and print summary:
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
9. Fix obvious errors. For ambiguous cases → `// UNCLEAR`.
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

1. **Differential recon:** `git diff --name-only <savedSha>..HEAD`. Cross-reference with filemap → modified, new, deleted files. Skip non-business files (tests, config, CI, migrations).
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

## Collection Iteration (`foreach`)

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Loop over a collection field of a resolved entity with per-item mutation | `foreach Entity.collection as alias { sets alias.field to ... }` |
| Loop over a collection field with per-item event emission | `foreach Entity.collection as alias { emits Event }` |
| Loop over a collection field with per-item validation/guard | `foreach Entity.collection as alias { fails "msg" when { ... } }` |

### Rules

- The collection must be a `list<T>` field in the structural model.
- The alias scopes dot-paths inside the body — `alias.field` navigates the item, not the collection.
- If the loop body contains only a single `then` narrative, keep it as `then` inside the interaction (no `foreach` needed).
- **Decision criterion:** if each iteration produces a verifiable mutation (`sets`) or emission (`emits`), use `foreach`. If the iteration effect is only describable as narrative, keep `then`.

## Cross-Aggregate Mutation

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Mutation on an entity not resolved as the primary aggregate | `sets OtherEntity.field to value` (cross-aggregate `sets`) |
| Mutation via dot-path navigation through relationships | `sets Entity.relation.field to value` |
| Mutation inside a loop on a related entity's field | `foreach ... as alias { sets alias.related.field to value }` |

### Rules

- The target dot-path must be reachable from a `resolves` or `creates` entity — either directly or via relationship navigation.
- Add `:: "justification"` when the business reason for the cross-aggregate mutation is not obvious from the construct alone.
- **Decision criterion:** if the code modifies a field on an entity other than the primary aggregate, it is a cross-aggregate mutation. If verifiable (the assignment is in the code), use `sets`. If not verifiable, use `then`.

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

| Detection signal | File |
|---|---|
| `.java`, `pom.xml`, `build.gradle`, `@SpringBootApplication`, `@Entity` | Read `heuristics/java-spring.md` |
| `.ts`, `.tsx`, `package.json` + `@nestjs/*`, `tsconfig.json` | Read `heuristics/typescript-nestjs.md` |
| `.clj`, `.cljs`, `deps.edn`, `project.clj`, `lein` | Read `heuristics/clojure.md` |

If no specific stack is detected, rely on generic heuristics only. Annotate non-obvious mappings with `// NOTE: inferred from {pattern}`.

---

## Flow Constructs

### Expression Rules

# Expression Rules

Rules for all `when { ... }` and `must { ... }` blocks across `fails`, `policy`, and `invariant`.

## Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `isEmpty()`, `isNotEmpty()`

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

When a guard does not map directly to an expressible pattern, apply Decision Test 3 ("Is it faithful?") instead of defaulting to `// UNCLEAR`.

Common resolutions:

| Pattern | Approach |
|---|---|
| Uniqueness check (`repo.existsByEmail`) | `resolves` entity via repository op + `fails when { Entity is defined }` |
| Cross-entity existence | Same — `resolves` + `is defined` |
| External business check | `delegates Service.op` + `fails` on result |

If the condition cannot be expressed faithfully: infrastructure → `// NOTE`; business-critical grammar gap → `// UNCLEAR: {full rule}`.

### Construct Reference

# Flow Construct Reference

## Interaction

An `interaction` block models a handler triggered by a command (intentional) or an event (reactive).

### Skeleton

```
interaction "Business intent label" {
  on CommandOrEvent
  resolves Entity [via Repository.op | via Entity.field] from dotPath
  creates Entity
  fails "message" when { expression }
  delegates Service.operation
  then "side effect in business language"
  sets Entity.field to value :: "business justification"
  foreach Collection.path as alias {
    sets alias.field to valueExpr :: "justification"
    emits Event
  }
  emits Event
}
```

### Clause rules

| Clause | Rule |
|---|---|
| `on` | Command → exactly 1 interaction per command. Event → 0..N interactions per event. |
| label | Business language from method name / javadoc. Default: `"Handle {Command}"` or `"React to {Event}"`. |
| `resolves` | Every entity you `sets` or reference in `fails` must be explicitly resolved or created. |
| `creates` | Every `new Entity()` / `.save()` on a new object. Never omit the primary entity. |
| `fails` | Guard clauses / validation. Business-language message. Expression must pass Test 3. |
| `delegates` | After `fails`, before `sets`. Result assigned → `sets Entity.field to Service.op`. |
| `then` | Side effects not expressible with `sets`/`emits`. Available for both triggers. |
| `sets` | Target dot-path must be reachable from an entity in `resolves` or `creates`. Cross-aggregate targets (via dot-path navigation) are allowed. Use `::` justification on cross-aggregate mutations where the business reason is not obvious. |
| `foreach` | Iterates over a `list<T>` field. Body allows `sets`, `emits`, `fails`, `then`. The alias can be used as the root of dot-paths inside the body. |
| `::` | Justification operator — attaches a business reason to a clause. Optional on `sets`. Does not change verifiability. |
| `emits` | All events published by the handler. |

### Resolution patterns

Three patterns for `resolves`. The `from` dotPath identifies the source; `via` specifies how.

#### Pattern 1 — Direct resolution

The `from` dotPath points to a field on the command/event carrying the entity's identity.

```
resolves Order from CancelOrder.orderId
resolves User via UserRepository.findById from UpdateProfile.userId
```

#### Pattern 2 — Indirect (forward ref)

The `from` dotPath points to a field on an already-resolved entity.

```
resolves Order via OrderRepository.findById from ShipOrder.orderId
resolves Payment from Order.paymentId
```

#### Pattern 3 — Indirect (reverse ref)

The resolved entity has a field referencing the `from` entity. Use `via Entity.field` to name it.

```
resolves Order from ConfirmOrder.orderId
resolves Payment via Payment.order from Order
```

#### Decision table

| Situation | Pattern |
|---|---|
| Command/event carries the entity's ID | Direct |
| An already-resolved entity carries the ID | Indirect (forward) |
| The entity to resolve has a field pointing back | Indirect (reverse) |

### `via` — two uses

- **Repository operation:** `via Repository.operation` — infrastructure method.
- **Relationship field:** `via Entity.field` — reverse-ref field (entity name matches `resolves` typeName).

### `foreach` — collection iteration

Use `foreach` when the code iterates over a collection and performs per-item mutations, emissions, or validations.

```
foreach Order.lines as line {
  sets line.product.stockQuantity to line.product.stockQuantity + line.quantity
    :: "Restore stock for each cancelled line"
}
```

**Rules:**
- The dot-path must resolve to a `list<T>` field in the structural model.
- The alias (`line`) scopes all dot-paths inside the body — `line.product.stockQuantity` means "the stockQuantity of the product of this particular line".
- Body allows: `sets`, `emits`, `fails`, `then` — same constructs as an interaction body (minus `resolves`, `creates`, `delegates`, `foreach`).
- **Checker verification:** the code contains a loop over the collection with per-item mutations matching the declared `sets`.

### `::` — justification operator

Attaches a business reason to a clause. Does not change semantics or verifiability.

```
sets Order.status to cancelled
  :: "Cancellation is immediate — no approval required for draft orders"
```

**Rules:**
- Optional on `sets` clauses.
- Use it when the *why* is not obvious from the construct alone — especially for cross-aggregate mutations.
- The justification is not verifiable itself — it is the reason *why the verifiable proof exists*.

---

## Service

A `service` block models a stateless class/interface with business logic.

### Skeleton

```
service Name {
  operation opName {
    accepts param : type [optional]
    returns type
    fails "message" when { expression }
    then "business logic description"
    emits Event
  }
}
```

### Rules

- One service block per service class/interface.
- One operation per public method with business logic.
- Use `then` for logic that cannot be captured structurally.
- Do not create services for pure infrastructure (password hashing, image processing, logging, caching). Use `// NOTE` instead.
- **Decision criterion:** if the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service.

---

## Repository

A `repository` block models a persistence interface for an aggregate root.

### Skeleton

```
repository Name {
  for Entity
  operation opName {
    accepts param : type
    returns type
  }
}
```

### Rules

- `for` must reference an entity (aggregate root), not a value or enum.
- Operations contain only `accepts` and `returns` — never `then`, `fails`, `sets`, `emits`.
- Only model operations referenced by at least one `resolves ... via` or used in an extracted interaction.

### Filtering guide

| Operation type | Model? |
|---|---|
| `findById`, `findByField` (used in `resolves`) | Yes |
| `save`, `delete` (used in interactions) | Yes |
| `existsBy*` (used in a guard) | Yes |
| `search`, `pagination`, `count` (dashboards) | No — `// NOTE: query-only` |

---

## Policy

A `policy` block models a cross-cutting domain rule spanning multiple operations.

### Skeleton

```
policy Name {
  when { expression }
  then "consequence in business language"
}
```

### Rules

- `when` must be a real, evaluable boolean expression — never a tautology, never empty (apply Test 3).
- **Never emit a policy block with an empty or commented-out `when`.** If the condition cannot be expressed, use an inline `// UNCLEAR` comment instead of a policy block.
- If the rule applies to only one command handler, use `fails` in the interaction instead.
- If the real condition is infrastructure → `// NOTE`.

---

## Invariant

An `invariant` block models a structural constraint that must always be true for an entity.

### Skeleton

```
invariant Name {
  on Entity
  must { expression }
  message "constraint in business language"
}
```

### Rules

- `on` must reference an **entity** — never a command, event, or value.
- `must` must be a real, evaluable condition (apply Test 3).
- If the condition cannot be expressed faithfully, use `// UNCLEAR` instead of creating an invariant with a tautological `must`.
- Validation rules on command inputs belong in `fails` clauses, not invariants.

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

// =============================================================================
// Value Objects
// =============================================================================

value Money {
  amount : decimal min(0)
  currency : string default("EUR") maxLength(3)
}

// =============================================================================
// Entities
// =============================================================================

entity Customer {
  id : uuid unique immutable
  name : string minLength(1) maxLength(100)
  email : string unique
  status : CustomerStatus default("active")
  createdAt : datetime immutable pastOrPresent
}

entity Order {
  id : uuid unique immutable
  customer : Customer
  lines : list<OrderLine>
  status : OrderStatus default("draft")
  totalAmount : Money
  shippingAddress : string
  placedAt : datetime optional pastOrPresent
  createdAt : datetime immutable pastOrPresent
}

// =============================================================================
// Commands
// =============================================================================

command PlaceOrder {
  customerId : uuid
  lines : list<OrderLine>
  shippingAddress : string
}

command CancelOrder {
  orderId : uuid
  reason : string optional maxLength(500)
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

event OrderCancelled {
  orderId : uuid
  reason : string optional
  cancelledAt : datetime
}

event OrderStockRestored {
  orderId : uuid
  restoredAt : datetime
}
```

### orders-compact.flow

```specy
domain "Orders"
uses "orders-compact.struct"

// =============================================================================
// Repositories
// =============================================================================

repository OrderRepository {
  for Order

  operation findById {
    accepts id : uuid
    returns Order
  }
}

// =============================================================================
// Services
// =============================================================================

service PricingCalculator {
  operation computeTotal {
    accepts lines : list<OrderLine>
    returns decimal
    then "Applies volume discounts and tax calculations"
  }
}

// =============================================================================
// Interactions — command-triggered
// =============================================================================

// source: src/services/OrderService.java
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

  delegates PricingCalculator.computeTotal
  sets Order.status to draft
  sets Order.placedAt to now()
  sets Order.totalAmount to PricingCalculator.computeTotal

  emits OrderPlaced
}

// source: src/services/OrderService.java
interaction "Cancel an order" {
  on CancelOrder

  resolves Order via OrderRepository.findById from CancelOrder.orderId

  fails "Order cannot be cancelled" when {
    Order.status not in {draft, confirmed}
  }

  sets Order.status to cancelled

  emits OrderCancelled
}

// =============================================================================
// Interactions — event-triggered
// =============================================================================

// source: src/listeners/OrderListener.java
interaction "Handle order cancellation side effects" {
  on OrderCancelled

  resolves Order from OrderCancelled.orderId

  foreach Order.lines as line {
    sets line.product.stockQuantity to line.product.stockQuantity + line.quantity
      :: "Restore stock for each cancelled line"
  }

  then "Notify customer that order is cancelled"

  emits OrderStockRestored
}

// =============================================================================
// Policies
// =============================================================================

policy MaxOrderAmount {
  when {
    Order.totalAmount.amount > 10000
  }
  then "Orders above 10000 require manual approval before confirmation"
}

// =============================================================================
// Invariants
// =============================================================================

invariant OrderMustHaveLines {
  on Order
  must {
    isNotEmpty(Order.lines)
  }
  message "An order must contain at least one line"
}
```

---

## Output Checklist

Before writing final files, verify each item. If any fails, fix it.

- [ ] Enum values in `camelCase` (no `UPPER_SNAKE_CASE`)
- [ ] No `fails when { field is defined }` on a required/immutable field
- [ ] No `invariant` with `must { field is defined }` on a required/immutable field (same tautology)
- [ ] No `invariant` on command, event, or value (entities only)
- [ ] No `policy` with a tautological or empty `when` — if the condition is unexpressible, use `// UNCLEAR` inline instead of emitting a policy block
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
- **Tests as source:** read test files — assertions reveal `fails` conditions, setup reveals creation patterns.
- **Large projects (>50 models):** ask the user to scope before proceeding.
- **Missing events:** do not invent. Signal with `// NOTE: no domain event emitted — consider adding {Event} if {reason}`.
- **Inheritance:** same type field → single entity + enum (`// NOTE: collapsed hierarchy`). Different fields → separate entities.
