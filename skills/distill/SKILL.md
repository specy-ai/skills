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
| Precondition that must hold before one or more interactions execute | `policy` (with `on "interaction"`) |
| Property always true after any successful mutation of an entity | `invariant` (with `on Entity` — entities only, never commands/events/values) |

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
6. **Test-aware enrichment:** for each extracted interaction, read associated test files (correlated by naming convention or imports — see test heuristics). Use test assertions to confirm or enrich `fails`, `sets`, `emits`, `triggers notification`, and `delegates`. Use test names as candidate interaction labels when they are more expressive than handler method names. When 2+ tests target the same handler with different preconditions and different assertions, consider decomposing into separate interactions with complementary guards.
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
- If the loop body contains no verifiable mutation or emission, omit the `foreach` and use `// NOTE:` to describe the iteration effect.
- **Decision criterion:** if each iteration produces a verifiable mutation (`sets`) or emission (`emits`), use `foreach`. If the iteration effect is only describable as narrative, use `// NOTE:` or `// UNCLEAR:`.

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
- **Decision criterion:** if the code modifies a field on an entity other than the primary aggregate, it is a cross-aggregate mutation. If verifiable (the assignment is in the code), use `sets`. If not verifiable, use `// NOTE:` or `// UNCLEAR:`.

## Notifications and Side-Effects (`triggers notification`)

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Call to `*NotificationService`, `*EmailService`, `*SmsService`, `*MessagingService`, `*PushService` | `triggers notification "description"` |
| Event listener whose only effect is sending a message (no entity mutation) | `triggers notification "description" on Event` |
| Call to `send*`, `notify*`, `publish*` on a non-domain service inside an event handler | `triggers notification "description"` |
| Webhook dispatch, HTTP callback to an external system | `triggers notification "description"` |

### Rules

- The string literal must describe the notification in business language ("Notify customer that order is confirmed"), not technical language ("Send email via SES").
- Use `on EventType` when the notification is directly caused by a specific event and the interaction reacts to that event.
- Use `:: "justification"` when the notification is a contractual or regulatory obligation.
- **Do not use** `triggers notification` for: internal logging, metrics emission, cache invalidation — these are infrastructure (`// NOTE`).
- **Decision criterion:** if a non-technical stakeholder would say "the customer must be notified when X happens", it is a `triggers notification`.

## Inter-Context Communication (`triggers Context.Command`)

### Identification

| Source Pattern | Specy Construct |
|---|---|
| REST/gRPC call to another bounded context's service | `triggers Context.Command` |
| Message published to a topic/queue named after another domain (e.g. `shipping.prepare`) | `triggers Shipping.PrepareShipment` |
| Saga step invoking another context's command handler | `triggers Context.Command` |
| Choreography: event emission consumed by another context that triggers a command | `triggers Context.Command` |

### Rules

- The dot-path must be `ContextName.CommandName` — the context name matches another `.struct` file's `domain` declaration; the command name matches a `command` defined in that `.struct`.
- Add `:: "justification"` when the business reason for the cross-context trigger is not obvious.
- If the target context's `.struct` is not available, use `// NOTE: cross-context trigger — target .struct not yet extracted`.
- **Do not use** for intra-context event emission — use `emits Event` instead.
- **Decision criterion:** if the code triggers behaviour in a *different* bounded context (different aggregate root, different deployment unit, different team), it is a `triggers Context.Command`.

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
| `assertThrows` / `expect(...).rejects.toThrow` / `(is (thrown? ...))` | `fails` — confirms guard condition + message |
| `assertEquals(value, entity.getField())` / `expect(result.field).toBe(value)` | `sets Entity.field to value` — confirms mutation target and value |
| `verify(publisher).publishEvent(any(Event.class))` / `expect(emitter.emit).toHaveBeenCalledWith(...)` | `emits Event` — confirms event emission |
| `verify(notificationService).send(...)` / `expect(notifService.send).toHaveBeenCalled()` | `triggers notification` — confirms side-effect |
| `when(service.compute(...)).thenReturn(...)` / `jest.spyOn(service, 'compute')` | `delegates Service.operation` — confirms delegation |
| `when(repository.findById(id)).willReturn(entity)` / `mockResolvedValue(entity)` | `resolves Entity` — confirms resolution pattern |
| Test name: `should_X_when_Y` | Candidate interaction label — often more expressive than method names |

### Branch decomposition

When **2+ tests** target the **same handler** with **different preconditions** and **different assertions**, this signals branching. Each test case represents a distinct business behaviour.

**Rule:** decompose into separate event-triggered interactions with complementary guards.

Example signal:
- `should_allow_retry_when_retryCount_below_3` → interaction "Allow payment retry" with `fails ... when { Payment.retryCount >= 3 }`
- `should_mark_permanent_failure_after_3_retries` → interaction "Mark payment as permanently failed" with `fails ... when { Payment.retryCount < 3 }`

**Decision criterion:** if the tests assert different mutations (`sets`) or different side-effects (`emits`, `triggers notification`) depending on preconditions, decompose. If the tests only vary in error messages for the same outcome, keep as a single interaction with multiple `fails`.

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

Rules for all `when { ... }` blocks in `fails` clauses and `must { ... }` blocks in `policy` and `invariant`.

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

# Specy Construct Reference

## Structural constructs (.struct)

### Entity

An `entity` is a domain object with a unique identity that persists over time. Entities are aggregate roots or members of an aggregate — they own mutable state and are the primary targets of commands and invariants.

#### Skeleton

```
entity Name {
  id : uuid unique immutable
  field : type constraint constraint
  ref : OtherEntity
  collection : list<ValueOrEntity>
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Identity | Must have at least one `unique immutable` field (typically `id : uuid`). |
| References | A field typed as another entity or value creates a structural relationship. |
| Collections | Use `list<T>` or `set<T>` for multi-valued associations. |
| Constraints | Apply domain constraints directly on fields (`min`, `max`, `optional`, `default`, etc.). |
| Naming | `PascalCase` for the entity name, `camelCase` for field names. |

#### Example

```
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
```

---

### Value

A `value` is an immutable object defined entirely by its attributes — it has no identity. Two values with the same fields are considered equal.

#### Skeleton

```
value Name {
  field : type constraint
}
```

#### Rules

| Rule | Detail |
|------|--------|
| No identity | Never add `unique immutable` identity fields — that makes it an entity. |
| Immutability | All fields are implicitly immutable. |
| Composability | Values can be embedded inside entities or other values. |
| Naming | `PascalCase` for the value name, `camelCase` for field names. |

#### Example

```
value Money {
  amount : decimal min(0)
  currency : string default("EUR") maxLength(3)
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
| Referenced by | Entities and commands reference enums as field types. |

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

A `command` represents an intent to change the state of the domain. Each command triggers exactly one interaction.

#### Skeleton

```
command Name {
  field : type constraint
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, verb-noun form (e.g., `PlaceOrder`, `CancelOrder`). |
| Fields | Carry the data needed to fulfill the intent — identity references, payload. |
| 1:1 mapping | Exactly one `interaction` block must declare `on` this command. |
| No behavior | Commands are pure data — behavior lives in the interaction. |

#### Example

```
command CancelOrder {
  orderId : uuid
  reason : string optional maxLength(500)
}
```

---

### Event

An `event` signals that something has happened in the domain. Events are emitted by interactions and can trigger zero or more reactive interactions.

#### Skeleton

```
event Name {
  field : type
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, past-tense (e.g., `OrderPlaced`, `OrderCancelled`). |
| Fields | Carry the facts of what happened — enough for any listener to react. |
| 0:N mapping | Zero or more interactions may declare `on` this event. |
| Immutable | Events are facts — they cannot be modified after emission. |

#### Example

```
event OrderCancelled {
  orderId : uuid
  reason : string optional
  cancelledAt : datetime
}
```

---

## Behavioral constructs (.flow)

### Interaction

An `interaction` block models a handler triggered by a command (intentional) or an event (reactive).

#### Skeleton

```
interaction "Business intent label" {
  on CommandOrEvent
  resolves Entity [via Repository.op | via Entity.field] from dotPath
  creates Entity
  fails "message" when { expression }
  delegates Service.operation
  sets Entity.field to value :: "business justification"
  foreach Collection.path as alias {
    sets alias.field to valueExpr :: "justification"
    emits Event
  }
  triggers notification "description" [on Event] [:: "justification"]
  triggers Context.Command [:: "justification"]
  emits Event
}
```

#### Clause rules

| Clause | Rule |
|---|---|
| `on` | Command → exactly 1 interaction per command. Event → 0..N interactions per event. |
| label | Business language from method name / javadoc. Default: `"Handle {Command}"` or `"React to {Event}"`. |
| `resolves` | Every entity you `sets` or reference in `fails` must be explicitly resolved or created. |
| `creates` | Every `new Entity()` / `.save()` on a new object. Never omit the primary entity. |
| `fails` | Guard clauses / validation. Business-language message. Expression must pass Test 3. |
| `delegates` | After `fails`, before `sets`. Result assigned → `sets Entity.field to Service.op`. |
| `sets` | Target dot-path must be reachable from an entity in `resolves` or `creates`. Cross-aggregate targets (via dot-path navigation) are allowed. Use `::` justification on cross-aggregate mutations where the business reason is not obvious. |
| `foreach` | Iterates over a `list<T>` field. Body allows `sets`, `emits`, `fails`, `triggers notification`, `triggers Context.Command`. The alias can be used as the root of dot-paths inside the body. |
| `triggers notification` | Out-of-domain side-effect (email, SMS, webhook). Business-language description. Optional `on Event` and `:: justification`. |
| `triggers Context.Command` | Inter-bounded-context communication. `Context` matches a `domain` in another `.struct`; `Command` matches a `command` in that `.struct`. Optional `:: justification`. |
| `::` | Justification operator — attaches a business reason to a clause. Optional on `sets`, `triggers notification`, `triggers Context.Command`. Does not change verifiability. |
| `emits` | All events published by the handler. |

#### Resolution patterns

Three patterns for `resolves`. The `from` dotPath identifies the source; `via` specifies how.

##### Pattern 1 — Direct resolution

The `from` dotPath points to a field on the command/event carrying the entity's identity.

```
resolves Order from CancelOrder.orderId
resolves User via UserRepository.findById from UpdateProfile.userId
```

##### Pattern 2 — Indirect (forward ref)

The `from` dotPath points to a field on an already-resolved entity.

```
resolves Order via OrderRepository.findById from ShipOrder.orderId
resolves Payment from Order.paymentId
```

##### Pattern 3 — Indirect (reverse ref)

The resolved entity has a field referencing the `from` entity. Use `via Entity.field` to name it.

```
resolves Order from ConfirmOrder.orderId
resolves Payment via Payment.order from Order
```

##### Decision table

| Situation | Pattern |
|---|---|
| Command/event carries the entity's ID | Direct |
| An already-resolved entity carries the ID | Indirect (forward) |
| The entity to resolve has a field pointing back | Indirect (reverse) |

#### `via` — two uses

- **Repository operation:** `via Repository.operation` — infrastructure method.
- **Relationship field:** `via Entity.field` — reverse-ref field (entity name matches `resolves` typeName).

#### `foreach` — collection iteration

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
- Body allows: `sets`, `emits`, `fails`, `triggers notification`, `triggers Context.Command` — same constructs as an interaction body (minus `resolves`, `creates`, `delegates`, `foreach`).
- **Checker verification:** the code contains a loop over the collection with per-item mutations matching the declared `sets`.

#### `::` — justification operator

Attaches a business reason to a clause. Does not change semantics or verifiability.

```
sets Order.status to cancelled
  :: "Cancellation is immediate — no approval required for draft orders"
```

**Rules:**
- Optional on `sets` clauses.
- Use it when the *why* is not obvious from the construct alone — especially for cross-aggregate mutations.
- The justification is not verifiable itself — it is the reason *why the verifiable proof exists*.

#### `triggers notification` — out-of-domain side-effects

Use `triggers notification` when the code sends a message, email, SMS, webhook, or push notification as a business-required side-effect.

```
triggers notification "Notify customer that order is confirmed"
triggers notification "Notify customer that order is cancelled"
  :: "Cancellation notification is a contractual obligation"
```

**Rules:**
- The string literal describes the notification in business language — not technical language.
- Optional `on EventType` narrows to a specific triggering event (useful when the interaction handles multiple events, or to make the trigger explicit).
- Optional `:: "justification"` adds a business reason — use it for contractual or regulatory obligations.
- **Checker verification:** the code contains a call to a notification/messaging service. The checker verifies the notification *exists*, not its content.
- **Do not use** for internal logging, metrics, cache invalidation — these are infrastructure (`// NOTE`).

#### `triggers Context.Command` — inter-context communication

Use `triggers Context.Command` when the code triggers behaviour in another bounded context — via REST call, message queue, saga step, or choreography.

```
triggers Shipping.PrepareShipment
  :: "Shipment preparation starts automatically after confirmation"
```

**Rules:**
- The dot-path must be `ContextName.CommandName`. `ContextName` matches the `domain` declaration in another `.struct` file (linked via `uses`). `CommandName` matches a `command` defined in that `.struct`.
- Optional `:: "justification"` adds a business reason.
- **Checker verification:** the code contains a call/message to the target context that triggers the specified command.
- If the target context's `.struct` is not available, use `// NOTE: cross-context trigger — target .struct not yet extracted`.
- **Do not use** for intra-context event emission — use `emits Event` instead.

#### Cross-file coherence for `triggers`

The lint (level 0) validates:
- `triggers notification` → a notification mechanism exists in the code for that event.
- `triggers Context.Command` → the command exists in the referenced `.struct`.
- Every `triggers` has a corresponding handler somewhere in the `.flow` files.

#### Example

```
interaction "Cancel an order" {
  on CancelOrder

  resolves Order via OrderRepository.findById from CancelOrder.orderId

  fails "Order cannot be cancelled" when {
    Order.status not in {draft, confirmed}
  }

  sets Order.status to cancelled

  emits OrderCancelled
}
```

---

### Service

A `service` block models a stateless class/interface with business logic.

#### Skeleton

```
service Name {
  operation opName {
    accepts param : type [optional]
    returns type
    fails "message" when { expression }
    emits Event
  }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Scope | One service block per service class/interface. |
| Operations | One operation per public method with business logic. |
| Exclusion | Do not create services for pure infrastructure (password hashing, image processing, logging, caching). Use `// NOTE` instead. |
| Decision criterion | If the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service. |

#### Example

```
service PricingCalculator {
  operation computeTotal {
    accepts lines : list<OrderLine>
    returns decimal
  }
}
```

---

### Repository

A `repository` block models a persistence interface for an aggregate root.

#### Skeleton

```
repository Name {
  for Entity
  operation opName {
    accepts param : type
    returns type
  }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `for` | Must reference an entity (aggregate root), not a value or enum. |
| Operations | Contain only `accepts` and `returns` — never `fails`, `sets`, `emits`. |
| Filtering | Only model operations referenced by at least one `resolves ... via` or used in an extracted interaction. |

#### Filtering guide

| Operation type | Model? |
|---|---|
| `findById`, `findByField` (used in `resolves`) | Yes |
| `save`, `delete` (used in interactions) | Yes |
| `existsBy*` (used in a guard) | Yes |
| `search`, `pagination`, `count` (dashboards) | No — `// NOTE: query-only` |

#### Example

```
repository OrderRepository {
  for Order

  operation findById {
    accepts id : uuid
    returns Order
  }
}
```

---

### Policy

A `policy` block models a precondition — a state requirement that must be true **before** one or more interactions can execute.

#### Skeleton

```
policy Name {
  on "interaction label", "another interaction"
  must { expression }
  message "constraint in business language"
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `on` | Lists the interaction labels this policy guards. Must be string literals matching interaction names. At least one required. |
| `must` | The precondition — must be a real, evaluable boolean expression that must hold for the action to proceed (apply Test 3). Never a tautology, never empty. |
| Empty guard | **Never emit a policy block with an empty or commented-out `must`.** If the condition cannot be expressed, use an inline `// UNCLEAR` comment instead. |
| Condition sense | `must` expresses what must be **true** for the action to proceed (precondition). This is the inverse of "when the problem occurs". |
| Scope | If the rule applies to only one command handler and is specific to that handler's logic, use `fails` in the interaction instead. Use `policy` when the rule is a cross-cutting concern shared across interactions. |
| Infrastructure | If the real condition is infrastructure → `// NOTE`. |

#### Example

```
policy MaxOrderAmount {
  on "Place a new order", "Confirm an order after payment"
  must {
    Order.totalAmount.amount <= 10000
  }
  message "Orders above 10000 require manual approval before confirmation"
}
```

---

### Invariant

An `invariant` block models a property that is always guaranteed to be true **after** any action completes successfully on an entity.

#### Skeleton

```
invariant Name {
  on Entity
  must { expression }
  message "constraint in business language"
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `on` | Must reference an **entity** — never a command, event, or value. |
| `must` | Must be a real, evaluable condition (apply Test 3). |
| Unexpressible | If the condition cannot be expressed faithfully, use `// UNCLEAR` instead of creating an invariant with a tautological `must`. |
| Scope | Validation rules on command inputs belong in `fails` clauses, not invariants. |

#### Example

```
invariant OrderMustHaveLines {
  on Order
  must {
    isNotEmpty(Order.lines)
  }
  message "An order must contain at least one line"
}
```

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

  triggers notification "Notify customer that order is cancelled"

  emits OrderStockRestored
}

// =============================================================================
// Policies — preconditions guarding interactions
// =============================================================================

policy MaxOrderAmount {
  on "Place a new order", "Confirm an order after payment"
  must {
    Order.totalAmount.amount <= 10000
  }
  message "Orders above 10000 require manual approval before confirmation"
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
