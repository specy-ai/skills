<!-- TEMPLATE — run build.sh to generate dist/domain-extract-from-code/SKILL.md -->

---
name: domain-extract-from-code
version: v4
description: Input — a codebase. Output — a `.domain` model file (plus a refactoring report and a `.meta.json`). Reverse-engineers source code into a `.domain` model and produces DDD refactoring recommendations. Use this whenever the user wants to recover, reverse-engineer, or extract a domain model from existing code. To extract testable system requirements (EARS) from code instead, use `sysreq-extract-from-code`; to design a domain model from requirements/prose, use `domain-design`.
user-invocable: true
---

# Skill: domain-extract-from-code

## Role

You are an expert Domain-Driven Design practitioner who reverse-engineers existing source code into Specy v3 domain model files. You extract the business logic — entities, aggregates, value objects, commands, queries, events, operations, preconditions, postconditions, reactions, invariants, agreements, and state machines — from a codebase and express them in a unified `.domain` file.

When the codebase is JVM code and the **codegraph** pipeline is available, you read its artifacts first — the per-type domain-facts dossier and the bottom-up LLM insights side-car (`heuristics/codegraph.md`) — and open source files only to confirm or to write an exact expression. Facts stay facts, inferences stay inferences: the Decision Tests below apply to both.

You also **derive system requirements** from the extracted domain model, producing a `.sysreq` file per bounded context that formalizes what the code actually does in testable EARS statements — including infrastructure concerns, unclear business rules, and gaps that the domain grammar cannot express. Finally, you produce a **refactoring report** with DDD-aligned design improvements.

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

**Codegraph evidence.** A `domain-facts.json` entry (a declared field, annotation, call, throw site, import) is production-code evidence. An `insights` block is an **inference** made by a model: it counts only when it points at a fact (the record's anchored span, a matching domain-facts entry) or that span was read. Unconfirmed blocks are at best `// NOTE: inferred by codegraph explain, unconfirmed`. See `heuristics/codegraph.md` §4.

**Non-regression rule:** absence of tests must never degrade extraction. When no test files exist or no test correlates to a handler, `domain-extract-from-code` extracts from production code exactly as before. Tests improve confidence; they do not condition it.

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
| Has identity, but its state is owned by another context or an external system (master data) | `read-only entity` (with `sourced-from`) |
| Cluster of entities that changes as one | `aggregate` — it IS the root; `entities { }` lists the non-root children |
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
| Handler for a command → write operation | `operation` (command-triggered: `"Label" on CommandType`, inside entity) |
| Handler for an event → side effects | a `reaction` (event → command) **plus** the command-triggered `operation` it effects — there is no event-triggered operation form |
| Named guard that must hold before an operation can proceed | `precondition` (inside operation, with its mandatory `rejects` reason) |
| Named assertion on state after an operation completes | `postcondition` (inside operation) |
| Reactive rule: an event causes a command | `reaction` (file-level: `triggered-by` / `guard` / `effects`) |
| Property always true after any successful mutation | `invariant` (entity/value-scoped or file-level — always with an `enforcement` strategy) |
| Cross-aggregate consistency property that cannot be verified atomically | `agreement` (with reconciliation) |
| Driving port — the surface consumers may call | `api interface` (`exposes Entity.op`) |
| Driven port — the contract the domain needs from a provider | `spi interface` (`describes Provider` + operation signatures) |
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
- **Order in file:** `organization` → `context` → `map` → `module` (with `exposes` / `requires` / `depends on`) → interfaces (`api` then `spi`) → enums → value objects → domain services → application services → infrastructure services → file-level reactions → file-level invariants → entities/read-only entities/aggregates → repositories → commands → queries → events → external events → error events → temporal events → agreements. Within each section, alphabetical or dependency order.
- **Section separators:** use `// ===` comment blocks between sections, matching the canonical example.
- **Field ordering:** identity first, then required, then optional. Within each group, keep source order.
- **No `null` literal.** The grammar has no `null`. Use `// NOTE:` instead of `sets ... to null`.
- **Business-language messages.** Use domain vocabulary, not technical jargon.
- **Preserve source vocabulary.** Use the same names as the code.
- **Distill Report:** always write `specy/gaps.report` (see Phase 3).
- **Slot order:** bodies are ordered slots, not a free-form bag. `satisfies [...]` is **always the first element inside the body braces** — never on the header line. Entity/aggregate order: `satisfies?`, `identity`, `duplicate detection?`, `fields`, `references?`, `operations?`, `states?`, `invariants?`.
- **Identity block:** entities, aggregates and **commands** use `identity fieldName : type` before the `fields` block (a command's identity is the correlation id of the causality chain it opens).
- **Fields wrapper:** all field declarations go inside `fields { }` blocks (entities, values, commands, queries, and every event kind — a `fields { }` block is required on all four).
- **References block:** entity/aggregate references with cardinality go in `references { }` blocks. Cardinality uses `N..M` notation (e.g., `1..1`, `1..N`).
- **Aggregates:** the aggregate **is** its root — it carries `identity`, `fields`, `operations`, `states` directly. There is no `root` clause. `entities { }` lists only the NON-ROOT children and must be non-empty; with no children, emit an `entity` instead.
- **Operations block:** entity/aggregate operations go inside `operations { }` blocks. Two forms only — `"Label" on CommandType { ... }` and `name(params) : ReturnType { ... }`. Declare `safe` / `unsafe` / `idempotent` when the code makes it evident. **Infrastructure-service and repository operations are signatures only** (no body).
- **State machine block:** entity/aggregate state machines go inside `states { machine Name { ... } }` blocks with `state`, `final`, and transition definitions. Transitions name the **operation** that drives them (`on "Label"` or `on identifier`) and carry **named** preconditions/postconditions — there is no top-level `statemachine` and no `transitions { }` block, and no anonymous `when {}` / `then {}`.
- **Scoped invariants:** entity or value invariants go inside `invariants { }` blocks without repeating the `invariant` keyword on each entry. Each one declares `enforcement rejection|compensation CommandType|alert` as the **last element of its body**.
- **Preconditions in operations:** use `precondition name :: "description" { expr } rejects "message"` inside operation bodies for guards. `rejects` is **mandatory** and sits outside the closing brace.
- **Postconditions in operations:** use `postcondition name :: "description" { expr }` inside operation bodies for state assertions. No reason, no enforcement.
- **Reactions:** file-level `reaction Name :: "description" { triggered-by EventType  guard { expr }  effects CommandType }`. A reaction is the **only** way an event causes a command — for every event kind, including external ones. Reaction names are `PascalCase`.
- **Invariants with enforcement:** file-level `invariant Name { on Entity  must { expr }  enforcement rejection|compensation CommandType|alert }` — `on` takes a dot-path, so it may scope to a state (`on Order.paid`).
- **Queries:** every query declares `reads-from <Repository>` and `returns <Type>`.
- **Interfaces:** every interface declares its role — `api interface X { exposes Entity.op }` (driving port) or `spi interface X { describes ProviderService  op(a: T) : R }` (driven port). The infrastructure service or repository that fulfils an SPI carries the matching `described-by <Spi>`.
- **Read-only entities:** master data owned elsewhere → `read-only entity X { sourced-from <Context>  synced-via synchronous-query|asynchronous-projection  projected-by <Adapter>  identity ...  fields { ... } }`. Its operations are safe: no `sets`, `creates` or `emits`.
- **Modules:** declare `exposes { Api }`, `requires { Spi }` and `depends on { Module }`.
- **Description operator:** use `::` to attach business descriptions to constructs (e.g., `entity Order :: "A customer order" { ... }`).
- **Metadata:** optionally add `meta { key = value }` blocks on constructs.
- **Traceability:** every domain construct MUST have a `satisfies [REQ-{CTX}-{NNN}]` reference to the derived system requirement it realizes.

### System Requirements Output

- **Naming:** `{domain}.sysreq` per bounded context — same base name as the `.domain` file.
- **Requirement ID scheme:** `REQ-{CTX}-{NNN}` where `CTX` is the context shortname in upper case (e.g., context `Orders (ord)` → `REQ-ORD-001`) and `NNN` is a zero-padded 3-digit sequence. The shortname itself is written lower case in the `context` header.
- **Traceability link:** the `.domain` file declares `requirements-source "{domain}.sysreq"` at context level; each domain construct uses `satisfies [REQ-{CTX}-{NNN}]`.
- **NOTE promotion:** every `// NOTE:` marker in the `.domain` file becomes an NFR requirement in the `.sysreq` file (classify by category: performance, security, operability, resilience, compliance).
- **UNCLEAR promotion:** every `// UNCLEAR:` marker becomes a functional requirement with `priority should` and the full business rule description as the EARS statement. The rationale (`::`) explains why the domain grammar cannot express it.
- **Infrastructure promotion:** every element that failed Decision Test 2 (omitted from `.domain` with `// NOTE: infrastructure`) becomes an NFR in the `.sysreq` file.
- **Functional requirements:** every operation, precondition, invariant, and reaction in the `.domain` also gets a corresponding EARS requirement. This ensures the `.sysreq` is a complete specification of the bounded context's behavior.

### Refactoring Report Output

- **File:** `specy/refactoring.report` — a single markdown file covering all bounded contexts.
- **Purpose:** proposes DDD-aligned design improvements over what the code currently implements, explaining why the refactored design better satisfies the requirements.

---

## Workflow

Three sequential phases. Print a summary at the end of each phase for user validation.

### Phase 1 — Reconnaissance

1. Study the canonical example below to calibrate output style.
2. Load the grammar: read `grammars/domain.ebnf` to calibrate syntax.
3. Explore the project tree. Identify language, framework, layout.
4. **Codegraph detection (JVM corpora).** Resolve the CLI and the extractor jar as in `heuristics/codegraph.md` §1. If both are present:
   - extract `specy/codegraph/model.jsonl` from the main source root, `validate` it, build `specy/codegraph/domain-facts.json` (`--framework spring` when Spring/Jakarta annotations are present);
   - run `codegraph explain --dry-run` and read the plan: units per level, calls, estimated prompt tokens, package cycles (`cycle(n)` on module lines);
   - **ask the user** whether to run the explanation (cost is theirs), proposing `--scope` per candidate context and `--max-calls` for a first pass; reuse an existing `specy/codegraph/model.insights.jsonl` when its header matches the model;
   - if anything is missing or the user declines, continue with the manual workflow and say so.
   Otherwise (no codegraph, non-JVM corpus) skip this step.
5. Locate key code areas: models/entities, handlers/services, events, validators/reactions, test suites (integration, acceptance, BDD). With codegraph: the type list of `domain-facts.json` with stereotypes and the `type` records of the insights (sorted by `concept`) ARE this inventory; test suites are still located by hand.
6. Identify bounded context(s) and propose domain name(s). With codegraph: start from the `module` records' `boundedContextHint` and the import graph (`modules[].imports`); a group of mutually dependent packages (`scc`) is one context or a shared kernel — never split it across two.
7. Print reconnaissance summary:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework: {framework}
   - Codegraph: {absent | model {entities}/{edges}, facts {types} types, insights {records} records ({llm} explained, {template} templated, {low-confidence} below 0.5) | plan only: {calls} calls, ~{tokens} prompt tokens}
   - Domain(s) identified: {list}
   - Models found: {count} — Handlers/Services: {count} — Events: {count} — Test suites: {count}
   - Mode: {creation | update}
   ```
8. Determine mode:
   - If the user specified a definition name → **targeted mode**.
   - If `--full` flag → **full update mode**.
   - If `specy/.meta.json` exists and (`gitSha` is reachable or it carries `codegraph.fingerprints`) → **incremental update mode**.
   - Otherwise → **full update mode**.
9. Wait for user confirmation.

### Phase 2 — Extraction

**With codegraph**, the inputs of the steps below change, not the steps: "read every class" means "walk the `type` records of the insights, sorted by `concept`, with the matching `domain-facts` dossier open"; "read every handler" means "walk the `operation` records with `origin: llm`" (templated accessors are never operations). The mapping from a block to a construct is the table in `heuristics/codegraph.md` §3; the evidence rules of §4 decide what may be emitted without opening the file. Open the anchored span (`file`, domain-facts `anchor.span`) whenever a predicate, a message or a cardinality must be exact, and whenever confidence is below 0.7. Everything below applies unchanged to a corpus without codegraph.

For each bounded context:

1. Read every model/entity/data class. **Classify** using Decision Test 4 + extraction heuristics.
2. **Map fields** to Specy primitives (see type mapping in generic heuristics). Map collections to `list<T>` / `set<T>` / `map<K,V>`. Map references to domain types by Specy typeName.
3. **Extract constraints** from annotations, decorators, validation rules.
4. **Extract entity references** with cardinality → `references { }` block.
5. **Identify aggregates** — entities that own child entities via composition (cascade, orphan removal). Emit the owner as an `aggregate` block: it carries the root's `identity`, `fields`, `operations` and `states` directly, and lists its non-root children in `entities { }`. Do not emit the root as a separate entity, and never write a `root` clause.
6. **Extract duplicate detection** — uniqueness constraints across multiple fields → `duplicate detection { expression }`.
7. Read every handler, service, listener, saga, reaction file.
8. **For each command handler** → entity/aggregate operation (command-triggered: `"Label" on CommandType { ... }`). For each service call → direct `Service.op(args)`. For each entity resolution → `resolves Entity from dotPath`.
9. **For each event listener** → a file-level `reaction Name { triggered-by EventType  guard { expr }  effects CommandType }`, plus the command-triggered operation that command targets (`"Label" on CommandType { ... }`) carrying the mutations and emissions the listener performs. An event never reaches a command directly — the reaction's guard is where "does this upstream fact still matter to us?" lives. Skip technical listeners (logging, metrics, cache).
10. **The listener's condition** (an `if` at the top of the listener that decides whether to act at all) → the reaction's `guard { }`. A condition that rejects the *command* once issued stays a `precondition` on the operation.
11. **Preconditions guarding operations** → `precondition name :: "description" { expr } rejects "message"` inside the operation body.
12. **Postconditions verifying state after operations** → `postcondition name :: "description" { expr }` inside the operation body.
13. **Properties always true after mutation** → `invariant` definitions. Entity/value-scoped inside `invariants { }` blocks, or file-level with `on <dotPath>` + `must { }`. Either way, declare the `enforcement` strategy — for a scoped invariant it is the last element of the body.
14. **Extract commands** with `identity <field> : <type>` (the correlation id) followed by `fields { }`. **Extract events** with `about <Entity>` / `caused-by <Command>` where the code makes them evident, and always a `fields { }` block.
15. **Extract queries** — read-only endpoints/handlers → `query Name { reads-from <Repository>  fields { ... }  returns Type }`. Derive the repository from the entity/aggregate the read path targets.
16. **Classify services** into three types: `domain service` (business logic), `application service` (orchestration), `infrastructure service` (external adapters — signatures only, `described-by` its SPI). Derive an `spi interface` for each driven port (persistence, gateway, notification, ACL) and an `api interface` for the module's public surface.
17. **Derive state machines** from status enum + operation flow → a `states { machine Name { ... } }` block inside the entity/aggregate, with `state` / `final` declarations and transitions of the form `source --> target on <operation>`, where `<operation>` is the `"Label"` of a command-triggered operation or the identifier of an internal one. A transition's guard is a **named** `precondition ... rejects "..."` inside the transition's braces.
18. **Identify temporal events** — scheduled jobs, time-based triggers, expiration logic → `temporal event` (relative/absolute/recurring).
19. **Identify agreements** — cross-aggregate consistency checks, sagas that compensate → `agreement` with `reconciliation`.
20. **Test-aware enrichment:** for each extracted operation, read associated test files. Use test assertions to confirm or enrich `precondition` clauses, `sets` blocks, `emits` blocks, and service calls. Use test names as candidate operation labels when they are more expressive than handler method names.
21. Write `.domain` file.

22. **Derive system requirements** — for each bounded context, generate a `.sysreq` file:

    | Domain construct | EARS pattern | Requirement type |
    |---|---|---|
    | Command-triggered operation | Event-driven (`When {command} is received, the system shall...`) | Functional |
    | Internal operation | Ubiquitous (`The system shall {compute/return}...`) | Functional |
    | Precondition with `rejects` | Unwanted (`If {condition violated}, then the system shall reject...`) | Functional |
    | Invariant | Ubiquitous (`The system shall ensure that {property} holds...`) | Functional |
    | Reaction (reactive rule) | Event-driven (`When {triggered-by event}, the system shall {effects command}`) | Functional |
    | State machine transition | State-driven (`While {entity} is in {state}, when {operation}, the system shall transition to {target}`) | Functional |
    | Agreement | Ubiquitous (`The system shall maintain consistency between {participants}...`) | Functional |
    | `// NOTE: (infrastructure)` | Ubiquitous or Event-driven (depends on context) | NFR |
    | `// NOTE: {gap description}` | Based on gap type | NFR or Functional (`priority could`) |
    | `// UNCLEAR: {business rule}` | Based on rule intent | Functional (`priority should`) |
    | Decision Test 2 failure (infrastructure element) | Ubiquitous or Event-driven | NFR |

    For each generated requirement:
    - Assign a unique `REQ-{CTX}-{NNN}` ID.
    - Write the EARS statement in business language (not code language).
    - Classify priority: `must` for operations/preconditions/invariants, `should` for UNCLEAR-sourced, `could` for NOTE-sourced gaps.
    - Add `:: "rationale"` explaining the business justification (from the code's perspective).
    - Back-annotate the `.domain` file: add `satisfies [REQ-{CTX}-{NNN}]` on every domain construct that realizes the requirement.
    - Add `requirements-source "{domain}.sysreq"` at context level in the `.domain` file.

23. **Generate refactoring report** — analyze the extracted model for DDD design smells:

    | Smell | Detection heuristic | Refactoring suggestion |
    |---|---|---|
    | **Anemic entity** | Entity has many fields but few or no operations (logic lives in services) | Move operations into the entity; convert service methods to entity operations |
    | **God entity** | Entity has >10 operations or >20 fields | Split into multiple entities or extract an aggregate with contained entities |
    | **Missing aggregate** | Multiple entities always modified together in the same operation but not grouped | Promote the owner to an `aggregate` (it becomes the root) and list the others in its `entities { }` |
    | **Missing state machine** | Entity has a status enum field + operations that check/set status, but no `states { machine }` block | Add an explicit state machine with guards and transitions |
    | **Transaction script** | Application service contains business logic (conditions, mutations) instead of delegating to entities | Move logic into entity operations; convert service to orchestrator |
    | **Missing error events** | Operations have preconditions that reject but no error event is emitted on rejection | Add error events for failed operations |
    | **Missing temporal concerns** | Entities have date/datetime fields suggesting expiration or deadlines but no temporal events | Add temporal events (relative/absolute) |
    | **Orphan events** | Events emitted but never consumed by any operation or reaction | Flag as potential missing reactive behavior |
    | **Missing invariants** | Entity has cross-field consistency requirements evident in code but not formalized | Add invariants with enforcement strategy |
    | **Weak aggregate boundaries** | Cross-aggregate mutations without justification or agreement | Propose agreement/reconciliation or redesign boundaries |
    | **Package cycle** (codegraph) | `module` insights records sharing an `scc`: the packages depend on each other | Quote the records' `sharedKernelHint`; propose the inversion or the shared kernel it names |
    | **Type cycle** (codegraph) | `type` records sharing an `scc` across what should be separate aggregates | Split by the cycle's members; usually one of them is a missing value or event |
    | **Concept disagreement** (codegraph) | The insights `concept` and the Decision-Test-4 verdict differ (e.g. `valueType` with an `@Id`) | Record the disagreement; the fact wins, the smell names why the code reads otherwise |

    For each detected smell, write a refactoring note with:
    - **What the code does:** describe the current implementation
    - **What it should do:** propose the DDD-aligned design
    - **Why:** the DDD principle violated and the business benefit of fixing it
    - **Affected requirements:** which `REQ-{CTX}-{NNN}` would be better satisfied

    Write `specy/refactoring.report`.

24. Print extraction summary:
    ```
    ## Extraction — {domain}
    Enums: {n} | Values: {n} | Entities: {n} | Aggregates: {n}
    Domain Services: {n} | App Services: {n} | Infra Services: {n}
    Commands: {n} | Queries: {n} | Events: {n}
    External Events: {n} | Error Events: {n} | Temporal Events: {n}
    Operations (cmd): {n} | Operations (internal): {n} | Interfaces (api/spi): {n}/{n}
    Preconditions: {n} | Postconditions: {n} | Reactions: {n} | Invariants: {n}
    Agreements: {n} | State Machines: {n} | UNCLEAR: {n}
    Requirements (functional): {n} | Requirements (NFR): {n}
    Refactoring notes: {n}
    Codegraph: {records used}/{records} insights records, {confirmed} confirmed by facts, {read} spans read by hand, {unconfirmed} left as NOTE
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
9. Verify every operation named by a state machine transition (`on "Label"` / `on identifier`) exists in the owning `operations` block.
10. Verify every `references` cardinality matches the structural model.
11. Verify every aggregate declares its own `identity` and a non-empty `entities { }` of non-root children — and that no aggregate carries a `root` clause or lists itself.
12. Verify every query has a `reads-from` repository and a `returns` declaration.
13. Verify every reaction's `triggered-by` event(s) and `effects` command exist — and that no event reaches a command by any other route.
14. Verify every agreement's `participants` exist as entities/aggregates, and that its escalation chain terminates (`alert`, `suspend` or `manual`).
15. Verify every invariant — scoped or file-level — has an `enforcement` strategy.
16. Verify every command declares an `identity`, and every precondition a `rejects` reason.
17. Verify every interface declares its role: an `spi interface` has exactly one `describes`; an `api interface` has none and its `exposes` dot-paths resolve to declared operations.
18. **Requirement traceability:** verify every domain construct has at least one `satisfies [REQ-...]` reference — always as the first element inside its body braces.
19. **Requirement resolution:** verify every `REQ-{CTX}-{NNN}` referenced in `satisfies` exists in the `.sysreq` file.
20. **Marker coverage:** verify every `// NOTE` and `// UNCLEAR` in the `.domain` file has a corresponding requirement in the `.sysreq` file.
21. **Requirement uniqueness:** verify requirement IDs are unique and sequential within each context.
22. **Test confirmation:** when a test assertion confirms an extracted behaviour (precondition, `sets`, `emits`, service call), treat it as validation. When a test asserts a behaviour absent from the extraction, flag it for review.
23. Fix obvious errors. For ambiguous cases → `// UNCLEAR`.
24. Write `specy/gaps.report`:
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

    ## Requirement Coverage
    Total requirements generated: {n} (functional: {n}, NFR: {n})
    Domain constructs with satisfies: {n}/{n} ({%})
    NOTE markers promoted to requirements: {n}/{n}
    UNCLEAR markers promoted to requirements: {n}/{n}
    Infrastructure elements promoted to NFRs: {n}

    ## Codegraph Coverage (when used)
    Units explained: {llm} | templated: {template} | failed: {failed} | reused from a previous run: {reused}
    Records below confidence 0.5: {n} — read by hand: {n} — left UNCLEAR: {n}
    Package cycles: {n} (largest {n} packages) | Type cycles: {n}
    Cost: {calls} calls, {prompt}+{completion} tokens{, $cost}

    ## Refactoring Summary
    Design smells detected: {n}
    | Smell | Entity/Aggregate | Severity | Affected Requirements |
    |-------|------------------|----------|----------------------|
    | {smell} | {name} | {high|medium|low} | {REQ-IDs} |
    ```
25. Print validation summary:
    ```
    ## Validation Summary
    Types: {n}/{n} | Dot-paths: {n}/{n} | Enums: {n}/{n} | Preconditions: {n}/{n} | Services: {n}/{n} | State Machines: {n}/{n} | Aggregates: {n}/{n} | Queries: {n}/{n} | Reactions: {n}/{n} | Interfaces: {n}/{n} | Corrected: {n} | UNCLEAR: {n}
    Requirement traceability: {n}/{n} constructs with satisfies | Requirement IDs: {n} unique
    Files written: {list}
    ```

---

## Creation Mode

When no `specy/*.domain` files exist:

1. Create `specy/` directory if absent.
2. Execute Phases 1–3.
3. Write `.domain`, `.sysreq`, `gaps.report`, and `refactoring.report`.
4. Write `specy/.meta.json` (see Meta File section).

---

## Meta File

`specy/.meta.json` tracks the state of the last domain-extract-from-code run. Written at the end of every run.

```json
{
  "version": 1,
  "lastRun": "2025-01-15T10:30:00Z",
  "gitSha": "abc1234def5678",
  "filemap": {
    "src/models/User.java": ["entity User", "enum UserStatus"],
    "src/services/OrderService.java": ["operation Order.PlaceOrder", "precondition orderMustBeDraft", "REQ-ORD-001", "REQ-ORD-002"],
    "src/listeners/OrderListener.java": ["reaction OnOrderShipped", "REQ-ORD-005"]
  }
}
```

- **`version`**: schema version (currently `1`)
- **`lastRun`**: ISO 8601 timestamp
- **`gitSha`**: HEAD commit SHA at time of run
- **`filemap`**: source file → list of Specy definitions (`"type Name"`)
- **`codegraph`** (when the pipeline was used): `{ "model": "specy/codegraph/model.jsonl", "insights": "specy/codegraph/model.insights.jsonl", "promptVersion": "…", "models": {…}, "fingerprints": { "<record id>": "<sha256>" } }` — the header fields copied from the side-car, and one fingerprint per insights record that fed a definition. This is what makes the next incremental run cheap: a record whose fingerprint is unchanged needs no re-extraction.

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
   **With codegraph:** re-extract the model, rebuild `domain-facts.json`, rerun `codegraph explain` with the same `--out` (unchanged units are reused, only changed ones are paid for), then diff `meta.codegraph.fingerprints` against the new records: changed, new and vanished ids are the delta. Union it with the VCS delta; a definition is re-extracted if either says so. See `heuristics/codegraph.md` §5.
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

Applies when the user specifies a definition name: `domain-extract-from-code <DefinitionName>`.

**Pre-condition:** existing `.domain` must be present.

1. **Target resolution:** search existing specs for `DefinitionName`. If found → identify type, source file, domain. If not found → search codebase for matching class/handler.
2. **Extraction unit** by type:

   | Target | Re-extract | Also re-extract | Cascade warning |
   |---|---|---|---|
   | Entity/Aggregate | The entity/aggregate | Enums/values from same source file | Operations referencing it |
   | Operation | The operation | Its command + emitted events | Reactions whose `effects` is that command |
   | Command | Treat as operation if one exists | (same as operation) | — |
   | Query | The query | Its `reads-from` repository | — |
   | Event | The event | — | Operations emitting it, reactions whose `triggered-by` names it |
   | Enum / Value | The definition | — | Entities/operations referencing it |
   | Reaction | The reaction | — | — |
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
| Class/module named `*Aggregate`, `*AggregateRoot` | Likely an `aggregate` — look for the child entities it owns |
| Class/module named `*Saga`, `*Listener`, `*Subscriber`, `*Consumer` | Likely a `reaction` (`triggered-by` / `guard` / `effects`) plus the operation its command targets |
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
| Controller or facade orchestrating multiple domain calls | `application service` block (`exposed-by` its api interface) |
| Adapter/gateway wrapping an external API or messaging system | `infrastructure service` block — **signatures only** — plus the `spi interface` it is `described-by` |
| The port the adapter implements (the domain-side interface it is injected as) | `spi interface` with `describes <InfrastructureService>` |
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
| Entity that owns child entities via cascade/composition (not just reference) | `aggregate` (the owner IS the root) |
| Entity with `@AggregateRoot` annotation or base class | `aggregate` |
| Entity that is never accessed independently — only via its parent | Non-root child, named in the aggregate's `entities { }` |
| Entity with its own repository and independent lifecycle | Separate entity (not part of another aggregate) |
| Entity/table whose rows are owned by an upstream context or external system | `read-only entity` with `sourced-from` (and a `read-only repository`) |

### Rules

- The aggregate **is** its root: it carries `identity`, `fields`, `operations`, `states` and `invariants` directly. There is no `root` clause — never emit one.
- `entities { }` lists only the NON-ROOT children, and must be non-empty. If the candidate has no children, it is an `entity`, not an aggregate.
- Only the aggregate has operations exposed externally, and only the aggregate derives a repository — children are reached by navigating from it.
- Invariants can span the entire aggregate boundary. Consistency that spans *two* aggregates is an `agreement`, not an invariant.

## Queries

### Identification

| Source Pattern | Inference |
|---|---|
| Read-only endpoint or method returning data without mutations | `query` |
| DTO/projection class used for read models, dashboards, search results | `query` with `returns` type |
| CQRS query handler or read-side handler | `query` |

### Rules

- Queries declare `reads-from <Repository>` (the read surface they target), `fields` (input parameters) and `returns` (output type) — in that order
- Queries never mutate state — they are safe and idempotent by definition
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

## Reactions

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Event listener whose effect is to issue a command | `reaction Name { triggered-by EventType  guard { expr }  effects CommandType }` |
| Saga step: receives event → sends command | `reaction` (file-level reactive rule) |
| Scheduled job triggered by events that dispatches actions | `reaction` with guard |
| Event handler that only calls services (no entity mutation) and dispatches a follow-up command | `reaction` |
| Listener consuming an **upstream** event (from another context) | `external event` (with its `fields { }`) + a `reaction` — never a `triggers { }` clause on the event |

### Rules

- A reaction is the **ONLY** way an event causes a command — uniform across all four event kinds (internal, external, error, temporal).
- A reaction is NOT a precondition — it listens to events and issues commands.
- `triggered-by` names one or more event types that activate the reaction.
- `guard { }` (optional) is a predicate over domain state, evaluated when the event arrives. It is what lets this context decide whether the fact still matters to it. No guard = fires on every occurrence.
- `effects` names the command issued when it fires.
- If the event listener mutates entity state directly, it still becomes a reaction — the mutation goes into the command-triggered operation the reaction `effects`. There is no event-triggered operation form.
- If an upstream event is consumed **only to refresh a local read-model**, it is not an external event at all: it belongs to the projection adapter of a `read-only entity` (`projected-by`). The sharp test: does the upstream fact change what this context *decides*, or only what it *knows*?

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
- The `foreach` body allows the same clauses as an operation body: `precondition`, `postcondition`, `resolves`, `creates`, `sets`, `emits`, entity calls (`TypeName.op(args)`), service calls (`Service.op(args)`), `returns`, and nested `foreach`.
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
| Event listener whose only effect is sending a message (no entity mutation) | a `reaction` (`triggered-by` the event, `effects` a notify command) + the operation on that command, whose body holds `ServiceName.op(args)` |
| Call to `send*`, `notify*`, `publish*` on a non-domain service inside a handler | service call statement in operation body |
| Webhook dispatch, HTTP callback to an external system | service call statement, `// NOTE: external HTTP callback` if not in domain scope |

### Rules

- Model the notification/messaging capability as an `infrastructure service` block with typed operation **signatures** (no bodies), plus the `spi interface` it is `described-by`.
- Call the service directly inside the operation body: `NotificationService.notifyCustomer(id, "message")`.
- The argument string literal must describe the notification in business language.
- Use `:: "description"` when the side-effect is a contractual or regulatory obligation.
- **Do not model** as service calls: internal logging, metrics emission, cache invalidation — these are infrastructure (`// NOTE`).

### Example

```
spi interface CustomerNotifier :: "What the domain needs in order to reach a customer" {
    describes NotificationService
    notifyCustomer(customerId: uuid, message: string) :: "Send a notification to a customer"
}

infrastructure service NotificationService :: "Customer notification adapter" {
    described-by CustomerNotifier
    operations {
        notifyCustomer(customerId: uuid, message: string)
    }
}

// The listener becomes a reaction — an event reaches a command only this way:
reaction NotifyOnOrderConfirmed :: "Tell the customer once the order is confirmed" {
    triggered-by OrderConfirmed
    effects NotifyOrderConfirmation
}

// ...and the side-effect lives in the operation that command targets:
"Notify the customer of the confirmation" on NotifyOrderConfirmation {
    resolves Order from notifyOrderConfirmation.orderId
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
| JVM corpus **and** the `codegraph` CLI + Java extractor jar are reachable (`CODEGRAPH_HOME`, `codegraph` on PATH) | Read `heuristics/codegraph.md` **first** — it replaces file-by-file reading with the domain-facts dossier and the insights side-car; the stack file still applies for annotation → constraint mappings |

If no specific stack is detected, rely on generic heuristics only. Annotate non-obvious mappings with `// NOTE: inferred from {pattern}`.

---

## Constructs

### Expression Rules

# Expression Rules

Rules for expression bodies in precondition, postcondition, reaction, and invariant blocks.

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

Constraints: `optional`, `required`, `immutable`, `unique`, `ordered`, `code`, `min(n)`, `max(n)`, `range(a,b)`, `minLength(n)`, `maxLength(n)`, `pattern("regex")`, `default("value")`, `past`, `future`, `pastOrPresent`, `futureOrPresent`

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

Mirrors `src/grammars/domain.ebnf`, which is the normative grammar. Where this
reference and the grammar disagree, the grammar wins.

Two conventions hold everywhere:

- **`satisfies [...]` is always the first element inside the body braces.**
- **Bodies are ordered slots, not a free-form bag.** The order below is the order
  the parser expects.

## Structural constructs

### Entity

An `entity` is a domain object with a unique identity that persists over time. Entities own mutable state and are the primary targets of commands, operations, and invariants.

#### Skeleton

```
entity Name :: "description" {
    satisfies [REQ-XXX-001]
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
        name(params) : ReturnType :: "description" { clauses... }
    }
    states {
        machine MachineName :: "description" { ... }
    }
    invariants {
        name :: "description" { expression  enforcement rejection }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Identity | Required — `identity id : uuid`. |
| Fields | Required — wrapped in a `fields { }` block (may be empty). |
| Slot order | `satisfies?`, `identity`, `duplicate detection?`, `fields`, `references?`, `operations?`, `states?`, `invariants?`. |
| References | Explicit cardinality (`1..1`, `1..N`, `0..1`, `0..N`). |
| Sub-blocks | `references`, `operations`, `states`, `invariants` are optional. |
| Naming | `PascalCase` for the entity, `camelCase` for fields. |

---

### Read-only Entity (Master Data)

A `read-only entity` is state **owned by another bounded context or an external system**. Observable here, not mutable here. The archetypes are `Customer`, `Supplier`, `Product`.

#### Skeleton

```
read-only entity Product :: "Owned by the Catalog context" {
    sourced-from Catalog
    synced-via asynchronous-projection
    projected-by CatalogProjector
    identity sku : string
    fields { name : string }
    operations {
        isAvailable() : boolean { safe  returns price.value > 0 }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `sourced-from` | Required — the upstream context or external system that owns the state. |
| `synced-via` | `synchronous-query` (no local copy) or `asynchronous-projection` (local read-model). |
| `projected-by` | The ACL adapter that refreshes the read-model. **Only** with `asynchronous-projection`. |
| Safe operations only | The operations block admits **no** `sets`, `creates` or `emits` — the parser rejects them. The entity is structural, not behavioural. |
| Repository | Derives a `read-only repository` — `getById`/`findByField`/`search`, never `store`/`remove`. |

**The sharp test:** *does an upstream event change what this context **decides**, or only what it **knows**?* If it changes a decision, model it as an `external event` with a `reaction`. If it only refreshes knowledge, it belongs to the projection adapter and stays out of the domain model — do **not** model a command or reaction for it.

---

### Aggregate

An `aggregate` is a cluster of entities that changes as one. **The aggregate IS its root** — it carries the root's identity, fields, operations and states directly. There is no `root` clause.

#### Skeleton

```
aggregate Name :: "description" {
    satisfies [REQ-XXX-001]
    identity fieldName : type
    duplicate detection { expression }
    fields { ... }
    entities { ChildEntityType }
    references { ... }
    operations { ... }
    states { ... }
    invariants { ... }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| It IS the root | The aggregate declares its own `identity` and `fields`. Do not declare a separate root entity. |
| `entities { }` | Required, non-empty — the **non-root children** of the cluster. An aggregate must not list itself. |
| No children? | Then it is not an aggregate. Make it an `entity`. |
| Repository | Only the aggregate derives a repository. Child entities are reached by navigating from it. |

---

### Value

A `value` is an immutable object defined entirely by its attributes — no identity.

#### Skeleton

```
value Name :: "description" {
    fields { field : type constraint }
    operations {
        name(params) : ReturnType :: "description" {
            precondition p { expr } rejects "reason"
            returns expression
        }
    }
    invariants {
        name :: "description" { expression  enforcement rejection }
    }
}
```

| Rule | Detail |
|------|--------|
| No identity | Never add `identity` — that makes it an entity. |
| Immutability | All fields are implicitly immutable; operations return a **new** value. |
| Transactional constructor | A value exists only if its fields are valid — express that with preconditions on the constructing operation. |

---

### Enum

An `enum` is a closed, named set of values.

```
enum Severity { low = "low"  high = "high" }

enum Currencies of Currency :: "ISO 4217" {
    usd :: "US Dollar"
    eur :: "Euro"
}
```

| Rule | Detail |
|------|--------|
| Values | `camelCase` identifiers (convert `UPPER_SNAKE_CASE` from source). May carry `= "literal"`. |
| `of ValueType` | Use when the enum holds **instances of a value type**. That value type must then declare exactly one field with the `code` constraint — the code is how the rest of the system refers to each value. |
| Closed set | List all valid values exhaustively. |

---

### Command

A `command` is an intent to change domain state.

```
command PlaceOrder :: "Customer submits an order" {
    identity commandId : uuid
    fields { customerId : uuid required }
}
```

| Rule | Detail |
|------|--------|
| Identity | **Required** — the correlation id of the causality chain the command opens. |
| Naming | `PascalCase`, verb + noun (`PlaceOrder`, `CancelBooking`). |
| 1:1 | Exactly one operation declares `on` this command. That operation is where the behavior lives — commands are pure data. |
| Target | An entity, an aggregate, **or a domain service**. |

---

### Query

A `query` requests current state — safe and idempotent by definition.

```
query GetOrder :: "Retrieve one order" {
    reads-from OrderRepository
    fields { orderId : uuid required }
    returns Order
}
```

| Rule | Detail |
|------|--------|
| `reads-from` | **Required** — the repository whose read surface the query targets. Commands flow through entity operations; queries read straight from the repository. |
| `returns` | Required. |
| Naming | `get` + noun (by identifier) or `find` + noun (by criteria). |

---

## Event types

All four event kinds are consumed **exactly one way — through a `reaction`.** An event never reaches a command directly.

### Event (internal)

Raised by an operation within this bounded context.

```
event OrderPlaced :: "An order was placed" {
    about Order
    caused-by PlaceOrder
    fields { orderId : uuid required }
}
```

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, past participle (`OrderPlaced`, `PaymentReceived`). |
| `about` | The entity this event is a fact about. Its `fields` must then carry that entity's identifier. |
| `caused-by` | The command or query that originated it — the causation link. |
| `fields` | Required (may be empty). |
| Raised by | The operation that `emits` it. |

### External Event

Originates from an upstream bounded context or external system.

```
external event PaymentSettled :: "From the Payments context" {
    from Payments
    fields { correlationId : uuid required }
}
```

| Rule | Detail |
|------|--------|
| `from` | The upstream context or external system. |
| No `triggers` | An external event **cannot** name commands directly. It is consumed through a `reaction`, whose guard is what lets this context decide whether the upstream fact still matters to it — which matters more here than anywhere else, since upstream knows nothing of local state. |
| When to declare one | Only when this context **reacts** to it with domain behavior. An upstream event consumed solely to refresh a read-model is **not** an external event — it belongs to the projection adapter. |

### Error Event

Raised by an operation on failure.

```
error event OrderRejected :: "The order could not be placed" {
    about Order
    caused-by PlaceOrder
    fields { orderId : uuid  reason : string }
}
```

### Temporal Event

A domain fact caused by the passage of time. **Time alone is never the cause** — every temporal event is anchored to a domain reference. `about` binds the entity whose state the guard reads.

#### Relative — fires after a duration from a reference event

```
temporal event Name :: "description" {
    about Order
    reference OrderPlaced
    offset 30 minutes
    guard { expression }
    fields { ... }
}
```

#### Absolute — fires at an instant described by an entity field

```
temporal event Name { about Credit  instant Credit.expiryDate  guard { ... }  fields { ... } }
```

#### Recurring — fires on each occurrence of a schedule

```
temporal event Name { schedule "0 0 * * MON"  fields { ... } }
```

The **guard** absorbs cancellation: it is evaluated at firing time, and if false the event is silently suppressed — no fact is recorded, no reaction triggers. No armed/fired/cancelled lifecycle is needed.

> **Recomputation heuristic.** When an `offset` or `instant` depends on a mutable value (e.g. a recalculated ETA), you must identify which events change that value and define a reaction that re-arms the deadline. Failing to is a modeling gap.

---

## Service types

### Domain Service

Operations spanning several entities/aggregates, where assigning ownership to any one of them would be arbitrary. May be **targeted by a command** and may change entity state.

```
domain service TransferService :: "Moves funds between accounts" {
    calls { LedgerAdapter }
    operations {
        "Transfer funds" on TransferFunds {
            unsafe
            resolves Account from transferFunds.sourceId
            sets Account { balance = balance - amount }
            emits FundsTransferred { accountId = Account.id }
        }
    }
}
```

### Application Service

Orchestrates use cases; contains no domain logic. Reached through an API interface.

```
application service OrderAppService {
    exposed-by OrderApi
    operations { "Submit an order" on PlaceOrder { ... } }
}
```

### Infrastructure Service

An adapter exposing an external system through the domain's language. **Operations are signatures only** — an adapter's implementation lives outside the model. The Anti-Corruption Layer is an infrastructure service.

```
infrastructure service StripeAdapter :: "Payment adapter" {
    described-by PaymentGateway
    operations {
        charge(amount: Money, ref: uuid) : Receipt
        refund(ref: uuid)
    }
}
```

#### Service classification

| Pattern | Type |
|---------|------|
| Business logic spanning entities | `domain service` |
| Use case orchestration for the presentation layer | `application service` |
| External system adapter (notifications, payments, storage, ACL) | `infrastructure service` |

---

## Behavioral constructs

### Operations (entity / aggregate / service-scoped)

**Two forms.** There is no event-triggered form — an event reaches a command only through a `reaction`.

#### Form 1 — Command-triggered

```
"Business intent label" on CommandType {
    satisfies [REQ-XXX-001]
    unsafe
    precondition name :: "description" { expr } rejects "business reason"
    postcondition name { expr }
    resolves Entity from dotPath
    creates Entity { field = value }
    sets Entity { field = value }
    Service.op(args) :: "description"
    emits Event { field = value }
}
```

#### Form 2 — Internal

```
name(params) : ReturnType :: "description" {
    safe
    idempotent
    returns expression
}
```

#### Operation attributes

| Attribute | Meaning |
|---|---|
| `safe` | No mutation — read-only. |
| `unsafe` | Mutates domain state. |
| `idempotent` | Repeating the operation has the same effect as performing it once. |

Slot order inside a body: `satisfies?`, `safe`\|`unsafe`?, `idempotent`?, then clauses.

#### Operation clause rules

| Clause | Syntax | Rule |
|---|---|---|
| `precondition` | `precondition name :: "desc" { expr } rejects "msg"` | **`rejects` is mandatory** and sits *outside* the closing brace. |
| `postcondition` | `postcondition name :: "desc" { expr }` | Evaluates over state_before, state_after and arguments. No reason, no enforcement. |
| `resolves` | `resolves TypeName from dotPath` | Every entity you `sets` must be resolved or created first. |
| `creates` | `creates TypeName { field = value }` | Entity creation with explicit assignments. |
| `sets` | `sets TypeName { field = value }` | Entity mutation with explicit assignments. |
| `emits` | `emits TypeName { field = value }` | Event emission. This is the event's "raised by" link. |
| service call | `Service.op(args) :: "description"` | Direct call. |
| `foreach` | `foreach dotPath as id { clauses }` | Iteration over a collection. |
| `returns` | `returns expression` | The operation's result. |

#### Precondition vs postcondition

|  | Precondition | Postcondition |
|---|---|---|
| **Signature** | `P(state_before, arguments)` | `P(state_before, state_after, arguments)` |
| **Expresses** | What the caller must guarantee | What the behavior guarantees in return |
| **Violation means** | The caller was not entitled to invoke it | The model or its implementation is **wrong** |
| **Enforcement** | Implicit: rejection, with a reason | None — it is detected as a defect |

That is why a precondition declares `rejects "..."` and a postcondition does not: a failing precondition is a domain outcome (an error event), a failing postcondition is a bug.

---

### Reaction (reactive rule)

**A reaction is the only way an event causes a command.** Uniform across all four event types — internal, external, error, temporal.

#### Skeleton

```
reaction Name :: "description" {
    triggered-by EventType, OtherEventType
    guard { expression }
    effects CommandType
}
```

| Rule | Detail |
|------|--------|
| Name | `PascalCase`, anchored in the ubiquitous language. |
| `triggered-by` | One or more events, of any kind. |
| `guard` | Optional predicate over domain state, evaluated when the event arrives. Without it, consuming an event would mean issuing its command *unconditionally* — so "when `PaymentSettled` arrives, release the order **only if** it is still held" would have nowhere to live. No guard = fires on every occurrence. |
| `effects` | The command issued when it fires. |
| Distinction | Reactions react to **events**. Preconditions guard **operations**. Invariants assert **properties**. |

```
reaction ReleaseOrderOnPayment :: "Release the order once payment settles" {
    triggered-by PaymentSettled
    guard { Order.status = held }
    effects ReleaseOrder
}
```

---

### Invariant

A safety property that must hold at every observable point. **Every invariant declares its enforcement strategy.**

**File-level** — scoped by `on`, which takes a dot-path (so it can scope to a *state*):

```
invariant Name :: "description" {
    on Order.paid
    must { expression }
    enforcement rejection | compensation CommandType | alert
}
```

**Scoped** — inside an `invariants { }` block, the owner is the enclosing entity/aggregate/value/state, so no `on` is needed. `enforcement` is the **last element of the body**:

```
invariants {
    totalIsSumOfLines :: "Order total equals the sum of its lines" {
        total.value = sum(lines.amount)
        enforcement rejection
    }
}
```

| Strategy | Meaning |
|----------|---------|
| `rejection` | Operation refused, no state change. |
| `compensation CommandType` | State change accepted, corrective command issued. |
| `alert` | Violation recorded for review. |

An entity-level invariant holds across **all** states. A state-scoped invariant holds only while the entity occupies that state — and is implicitly conjoined with the entity-level ones.

---

### Agreement & Reconciliation

An `agreement` is a consistency property spanning **two or more distinct aggregates** — no single transaction can verify it, so it is maintained by coordination rather than enforced atomically. It accepts a window of inconsistency, which must be explicit and acceptable to domain experts.

```
agreement StockMatchesOrders :: "Reserved stock equals ordered quantity" {
    participants { Order, Product }
    predicate { sum(Order.lines.qty) <= Product.stock }
    reconciliation StockReconciliation {
        trigger event OrderPlaced, PaymentSettled     // or: trigger schedule "0 0 * * *"
        detection query                                // or: event-sourced
        compensation { RestockProduct }
        coordination orchestration                     // or: choreography
        escalation {
            step retryOnce   { when { true }  action retry(3) }
            step compensate2 { when { true }  action compensate { RestockProduct } }
            step giveUp      { when { true }  action manual "Ops must reconcile stock by hand" }
        }
    }
}
```

| Rule | Detail |
|------|--------|
| `participants` | ≥ 2 **distinct** aggregates. A property of a single aggregate is an invariant, not an agreement. |
| `predicate` | A real expression over the participants' combined state. |
| **Escalation must terminate** | The final step's action must be `alert`, `suspend` or `manual` — **never** `retry` or `compensate`, which can themselves fail forever. The parser enforces this: a chain ending in `retry` will not parse. |

---

### State Machine

A `states { machine ... }` block structures an entity's lifecycle. It lives **inside** the entity or aggregate.

```
states {
    machine Lifecycle :: "Order lifecycle" {
        state draft {
            invariants { noPlacedAt { placedAt is not defined  enforcement rejection } }
        }
        state placed
        final cancelled

        [*]    --> draft     on "Create the order"
        draft  --> placed    on "Place the order" {
            precondition notEmpty { isNotEmpty(lines) } rejects "Cannot place an empty order"
        }
        placed --> cancelled on cancel
    }
}
```

| Rule | Detail |
|------|--------|
| `state` / `final` | A regular state (may carry its own invariants) / a terminal state. |
| `[*]` | The initial pseudo-state. |
| `on` | Names the **operation** that drives the transition — an identifier, or the `"Label"` of a command-triggered operation. |
| Conditions | A transition carries **named** preconditions/postconditions (0..n), not anonymous guards. One operation may drive transitions out of several states, each with its own precondition — `cancel()` may be legal from `pending` always, but from `paid` only within the refund window. |

---

### Interface (a port)

Every interface declares its **role**. Both roles are the same construct; what separates them is **who owns the contract**.

|  | `api interface` | `spi interface` |
|---|---|---|
| **Position** | Driving port — the domain is called | Driven port — the domain calls out |
| **Operations come from** | Entities, aggregates, domain/app services | Infrastructure services, repositories |
| **Who owns the contract** | The owning artefact; the interface *selects* from it | The domain; the provider *conforms* to it |
| **Typical use** | Publishing a module's use cases | Persistence, payment gateway, notification, ACL |

```
api interface OrderApi :: "What consumers may call" {
    exposes Order.placeOrder
    exposes Order.cancel
}

spi interface PaymentGateway :: "What the domain needs from payments" {
    describes StripeAdapter
    charge(amount: Money, ref: uuid) : Receipt
}
```

An **API** *selects* operations that already exist (by dot-path). An **SPI** *defines* new signatures and names the provider that fulfils them with `describes`. The provider carries the matching `described-by`.

---

### Repository

Derived from an entity or aggregate root — never hand-authored. It is a kind of infrastructure service, so it too is described by an SPI, and its operations are signatures.

```
repository OrderRepository for Order {
    described-by OrderPersistence
    store(order: Order)
    getById(id: uuid) : Order
    remove(id: uuid)
    findByCustomerId(customerId: uuid) : list<Order>
}

read-only repository ProductRepository for Product { ... }   // master data: no store/remove
```

| Rule | Detail |
|------|--------|
| Derivation | One per persisted entity. When an entity belongs to an aggregate, **only the aggregate** derives one. |
| Operations | `store`, `getById`, `remove`, `search`, plus `findByField` operations deduced from the use cases. |
| Never mutates | A repository stores or removes whole objects. Mutation is the entity's own job; the result is handed back to `store`. |

---

### Module

A module's two interface relations are **not symmetric**. The APIs it *exposes* are its public surface. The SPIs it *requires* are what it must be given.

```
module Orders :: "Order handling" {
    exposes { OrderApi }
    requires { PaymentGateway OrderPersistence }
    depends on { Shared }

    // definitions...
}
```

---

## Expression Rules

### Available operators

`=` `!=` `>` `<` `>=` `<=`, `and` `or` `not`, `+` `-` `*` `/`,
`is defined` / `is not defined` / `is null` / `is not null`,
`in { … }` / `not in { … }`, `matches`, `contains`,
ternary `cond ? a : b`, elvis `a ?: b`, safe-navigation `a?.b`,
`if expr { expr }`, `every x in xs { expr }`, `exists x in xs where expr`, `forall`.

Calls (a built-in and a service call are syntactically identical):
`count()` `sum()` `min()` `max()` `avg()` `abs()` `size()` `isEmpty()` `isNotEmpty()` `now()` `today()`.

Durations: `5 minutes`, `24h`, `2businessDays`.

### Quick Reference

| Pattern | Expression |
|---|---|
| Status check | `Entity.status != someValue` |
| Set membership | `Entity.status in {draft, confirmed}` |
| Existence | `Entity is defined` / `Entity is not defined` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |
| Universal quantifier | `every line in lines { line.available = true }` |
| Computed value | `total.amount = productPrice.amount * quantity` |
| Conditional | `if charge.type = loan { charge.timeType in { disbursement } }` |

### Field Types

Primitives: `string`, `int`/`integer`, `long`, `decimal`, `boolean`, `uuid`, `datetime`, `date`, `time`, `duration`, `void`

Collections: `list<T>`, `set<T>`, `map<K,V>`

Constraints: `optional`, `required`, `immutable`, `unique`, `ordered`, `code`, `min(n)`, `max(n)`, `range(a,b)`, `minLength(n)`, `maxLength(n)`, `pattern("regex")`, `default("value")`, `past`, `future`, `pastOrPresent`, `futureOrPresent`

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

context Orders (ord) :: "Order management bounded context" {

    requirements-source "orders.sysreq"

    // =============================================================================
    // Context Map
    // =============================================================================

    map {
        downstream Shipping : ACL
    }

    module Order :: "Core order processing module" {

        exposes {
            OrderApi
        }

        requires {
            OrderPersistence
            CustomerNotifier
        }

        // =============================================================================
        // Interfaces — the two port roles
        // =============================================================================

        // source: controllers/OrderController
        api interface OrderApi :: "What consumers of this module may call" {
            satisfies [REQ-ORD-001]
            exposes Order.placeOrder
            exposes Order.confirmOrder
            exposes Order.cancelOrder
        }

        // source: repositories/OrderRepository (port)
        spi interface OrderPersistence :: "What the domain needs from persistence" {
            describes OrderRepository
            store(order: Order)
            getById(id: uuid) : Order
        }

        // source: services/NotificationService (port)
        spi interface CustomerNotifier :: "What the domain needs in order to reach a customer" {
            describes NotificationService
            notifyCustomer(customerId: uuid, message: string) :: "Send a notification to a customer"
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
                    enforcement rejection
                }
                lineTotalConsistency :: "Line total must equal unit price multiplied by quantity" {
                    total.amount = productPrice.amount * quantity
                    enforcement rejection
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
                    safe
                    idempotent
                    returns sum(lines.total)
                }
            }
        }

        // source: services/StockService
        domain service StockService :: "Manages product stock levels" {
            operations {
                restock(lines: list<OrderLine>) :: "Restore stock for each cancelled order line" {
                    unsafe
                    foreach lines as line {
                        resolves Product from line.productId
                        Product.increase(line.quantity)
                    }
                }
            }
        }

        // source: services/NotificationService — an adapter: signatures only, no body
        infrastructure service NotificationService :: "Sends notifications to customers" {
            described-by CustomerNotifier
            operations {
                notifyCustomer(customerId: uuid, message: string)
            }
        }

        // =============================================================================
        // Reactions — the ONLY edge from an event to a command
        // =============================================================================

        // source: listeners/OrderConfirmedListener
        reaction NotifyOnOrderConfirmed :: "Tell the customer once the order is confirmed" {
            triggered-by OrderConfirmed
            effects NotifyOrderConfirmation
        }

        // source: listeners/OrderDeliveredListener
        reaction NotifyOnOrderDelivered :: "Tell the customer once the order is delivered" {
            triggered-by OrderDelivered
            effects NotifyOrderDelivery
        }

        // source: listeners/PaymentFailedListener
        reaction RecordPaymentFailure :: "Record the failure on the payment" {
            triggered-by PaymentFailed
            effects HandlePaymentFailure
        }

        // source: listeners/PaymentFailedListener
        reaction CancelOrderOnPaymentFailure :: "An order that cannot be paid for is cancelled" {
            triggered-by PaymentFailed
            guard {
                Order.status in {draft, confirmed}
            }
            effects CancelAfterPaymentFailure
        }

        // source: listeners/PaymentRefundedListener
        reaction NotifyOnPaymentRefunded :: "Tell the customer once the refund is processed" {
            triggered-by PaymentRefunded
            effects NotifyPaymentRefund
        }

        // source: listeners/ShipmentDeliveredListener (upstream Shipping)
        reaction MarkOrderDelivered :: "Close the order once Shipping confirms the parcel arrived" {
            triggered-by ShipmentDelivered
            guard {
                Order.status = shipped
            }
            effects DeliverOrder
        }

        // source: jobs/UnconfirmedOrderSweeper
        reaction CancelUnconfirmedOrder :: "Cancel an order left unconfirmed past the deadline" {
            triggered-by OrderConfirmationDeadlineElapsed
            effects CancelOrder
        }

        // =============================================================================
        // File-level invariants
        // =============================================================================

        // source: validators/OrderTotalValidator
        invariant ConfirmedOrderHasPositiveTotal :: "A confirmed order always carries a positive total" {
            satisfies [REQ-ORD-002]
            on Order.confirmed
            must {
                totalAmount.amount > 0
            }
            enforcement rejection
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
                    unsafe
                    sets Product {
                        stockQuantity = stockQuantity + quantity
                    }
                }
            }
        }

        // source: entities/Order
        // Order owns no child ENTITY (its lines are values), so it stays an entity.
        // Had it owned children, it would be an `aggregate` — carrying this same
        // identity/fields/operations/states, plus `entities { OrderLine }`.
        entity Order :: "A customer order" {
            satisfies [REQ-ORD-001]
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
                "Place a new order" on PlaceOrder {
                    satisfies [REQ-ORD-001]
                    unsafe
                    resolves Customer from placeOrder.customerId

                    precondition customerMustBeActive :: "Customer should be active to place an order" {
                        Customer.status = active
                    } rejects "Cannot place order: customer is not active"

                    precondition orderMustContainLines :: "Order must contain order lines" {
                        isNotEmpty(placeOrder.lines)
                    } rejects "Cannot place order: no order lines provided"

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

                    emits OrderPlaced {
                        orderId = Order.id
                        totalAmount = Order.totalAmount
                        placedAt = Order.placedAt
                        customerId = Customer.id
                    }
                }

                "Confirm an order after payment" on ConfirmOrder {
                    unsafe
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
                    unsafe
                    resolves Order from cancelOrder.orderId

                    precondition orderCancellable :: "Order must be in a cancellable status" {
                        Order.status in {draft, confirmed}
                    } rejects "Cannot cancel order: order has already shipped"

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

                "Cancel an order on payment failure" on CancelAfterPaymentFailure {
                    unsafe
                    resolves Order from cancelAfterPaymentFailure.orderId

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

                "Ship a confirmed order" on ShipOrder {
                    unsafe
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
                    unsafe
                    resolves Order from deliverOrder.orderId

                    sets Order {
                        status = delivered
                        deliveredAt = now()
                    }

                    emits OrderDelivered {
                        orderId = Order.id
                        deliveredAt = Order.deliveredAt
                    }
                }

                // The listener that used to sit here is now a reaction (NotifyOnOrderConfirmed);
                // only the behaviour of its command remains an operation.
                "Notify the customer of the confirmation" on NotifyOrderConfirmation {
                    resolves Order from notifyOrderConfirmation.orderId

                    NotificationService.notifyCustomer(Order.customer.id, "Your order has been confirmed")

                    Shipping.PrepareShipment(orderId = Order.id) :: "Launch shipping process"
                }

                "Notify the customer of the delivery" on NotifyOrderDelivery {
                    resolves Order from notifyOrderDelivery.orderId

                    NotificationService.notifyCustomer(Order.customer.id, "Your order has been delivered")
                }
            }

            states {
                machine OrderLifecycle :: "Order status lifecycle" {
                    state draft :: "Order has been placed but not yet confirmed"
                    state confirmed :: "Order has been confirmed after payment"
                    state shipped :: "Order has been shipped to customer"
                    final delivered :: "Order has been delivered to customer"
                    final cancelled :: "Order has been cancelled"

                    // `on` names the OPERATION that drives the transition, not the command.
                    [*] --> draft on "Place a new order"
                    draft --> confirmed on "Confirm an order after payment"
                    draft --> cancelled on "Cancel an order"
                    draft --> cancelled on "Cancel an order on payment failure"
                    confirmed --> shipped on "Ship a confirmed order"
                    confirmed --> cancelled on "Cancel an order" {
                        precondition notYetShipped :: "A shipped order can no longer be cancelled" {
                            Order.shippedAt is not defined
                        } rejects "Cannot cancel order: order has already shipped"
                    }
                    confirmed --> cancelled on "Cancel an order on payment failure"
                    shipped --> delivered on "Deliver a shipped order"
                }
            }

            invariants {
                orderContainsLines :: "An order must contain at least one line" {
                    isNotEmpty(lines)
                    enforcement rejection
                }
                orderTotalNotNegative :: "Order total amount must not be negative" {
                    totalAmount.amount >= 0
                    enforcement rejection
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
                    unsafe
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
                    unsafe
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

                "Handle payment failure" on HandlePaymentFailure {
                    unsafe
                    resolves Payment from handlePaymentFailure.paymentId

                    sets Payment {
                        status = failed
                    }
                    // NOTE: retry mechanism (infrastructure)

                    NotificationService.notifyCustomer(Payment.order.customer.id, "Your payment has failed")
                }

                "Notify the customer of the refund" on NotifyPaymentRefund {
                    resolves Payment from notifyPaymentRefund.paymentId

                    NotificationService.notifyCustomer(Payment.order.customer.id, "Your refund has been processed")
                }
            }

            states {
                machine PaymentLifecycle :: "Payment status lifecycle" {
                    state pending :: "Payment created and awaiting capture"
                    state captured :: "Payment successfully captured"
                    state failed :: "Payment attempt failed"
                    final refunded :: "Payment has been refunded"

                    [*] --> pending on "Process payment for an order"
                    pending --> captured on "Process payment for an order"
                    pending --> failed on "Handle payment failure"
                    captured --> refunded on "Refund a captured payment"
                    // "Notify the customer of the refund" drives no transition
                }
            }

            invariants {
                paymentMatchesOrder :: "Payment amount must equal the order total" {
                    amount.amount = order.totalAmount.amount
                    enforcement rejection
                }
            }
        }

        // =============================================================================
        // Repositories — derived from the entity, never hand-authored
        // =============================================================================

        // source: repositories/OrderRepository
        repository OrderRepository for Order {
            described-by OrderPersistence
            store(order: Order)
            getById(id: uuid) : Order
            remove(id: uuid)
            findByCustomerId(customerId: uuid) : list<Order>
        }

        // =============================================================================
        // Queries
        // =============================================================================

        // source: queries/OrderSummary
        query OrderSummary :: "Retrieve a summary view of an order" {
            satisfies [REQ-ORD-001]
            reads-from OrderRepository
            fields {
                orderId : uuid
            }
            returns Order
        }

        // =============================================================================
        // Commands — each carries the correlation id of the chain it opens
        // =============================================================================

        // source: commands/PlaceOrder
        command PlaceOrder :: "Place a new order for a customer" {
            satisfies [REQ-ORD-001]
            identity commandId : uuid
            fields {
                customerId : uuid
                lines : list<OrderLine>
                shippingAddress : Address
            }
        }

        // source: commands/ConfirmOrder
        command ConfirmOrder :: "Confirm an order after payment" {
            identity commandId : uuid
            fields {
                orderId : uuid
            }
        }

        // source: commands/CancelOrder
        command CancelOrder :: "Cancel an existing order" {
            identity commandId : uuid
            fields {
                orderId : uuid
                reason : string optional maxLength(500)
            }
        }

        // source: commands/ProcessPayment
        command ProcessPayment :: "Process payment for an order" {
            identity commandId : uuid
            fields {
                orderId : uuid
                method : PaymentMethod
            }
        }

        // source: commands/RefundPayment
        command RefundPayment :: "Refund a captured payment" {
            identity commandId : uuid
            fields {
                paymentId : uuid
                reason : string optional maxLength(500)
            }
        }

        // source: commands/ShipOrder
        command ShipOrder :: "Ship a confirmed order" {
            identity commandId : uuid
            fields {
                orderId : uuid
                trackingNumber : string optional maxLength(100)
            }
        }

        // source: commands/DeliverOrder
        command DeliverOrder :: "Deliver a shipped order" {
            identity commandId : uuid
            fields {
                orderId : uuid
            }
        }

        // source: commands/CancelAfterPaymentFailure
        command CancelAfterPaymentFailure :: "Cancel an order due to payment failure" {
            identity commandId : uuid
            fields {
                orderId : uuid
            }
        }

        // source: commands/NotifyOrderConfirmation
        command NotifyOrderConfirmation :: "Notify customer of order confirmation" {
            identity commandId : uuid
            fields {
                orderId : uuid
            }
        }

        // source: commands/NotifyOrderDelivery
        command NotifyOrderDelivery :: "Notify customer that order has been delivered" {
            identity commandId : uuid
            fields {
                orderId : uuid
            }
        }

        // source: commands/HandlePaymentFailure
        command HandlePaymentFailure :: "Handle a payment failure" {
            identity commandId : uuid
            fields {
                paymentId : uuid
            }
        }

        // source: commands/NotifyPaymentRefund
        command NotifyPaymentRefund :: "Notify customer of a refund" {
            identity commandId : uuid
            fields {
                paymentId : uuid
            }
        }

        // =============================================================================
        // Events
        // =============================================================================

        // source: events/OrderPlaced
        event OrderPlaced :: "Emitted when a new order is placed" {
            about Order
            caused-by PlaceOrder
            fields {
                orderId : uuid
                customerId : uuid
                totalAmount : Money
                placedAt : datetime
            }
        }

        // source: events/OrderConfirmed
        event OrderConfirmed :: "Emitted when an order is confirmed after payment" {
            about Order
            caused-by ConfirmOrder
            fields {
                orderId : uuid
                confirmedAt : datetime
            }
        }

        // source: events/OrderCancelled
        event OrderCancelled :: "Emitted when an order is cancelled" {
            about Order
            caused-by CancelOrder
            fields {
                orderId : uuid
                lines : list<OrderLine>
                reason : string optional
                cancelledAt : datetime
            }
        }

        // source: events/OrderShipped
        event OrderShipped :: "Emitted when an order is shipped" {
            about Order
            caused-by ShipOrder
            fields {
                orderId : uuid
                shippedAt : datetime
                trackingNumber : string optional
            }
        }

        // source: events/OrderDelivered
        event OrderDelivered :: "Emitted when an order is delivered" {
            about Order
            caused-by DeliverOrder
            fields {
                orderId : uuid
                deliveredAt : datetime
            }
        }

        // source: events/PaymentProcessed
        event PaymentProcessed :: "Emitted when a payment is successfully processed" {
            about Payment
            caused-by ProcessPayment
            fields {
                paymentId : uuid
                orderId : uuid
                amount : Money
                method : PaymentMethod
                processedAt : datetime
            }
        }

        // source: events/PaymentRefunded
        event PaymentRefunded :: "Emitted when a payment is refunded" {
            about Payment
            caused-by RefundPayment
            fields {
                paymentId : uuid
                orderId : uuid
                amount : Money
                reason : string optional
                refundedAt : datetime
            }
        }

        // =============================================================================
        // Error Events
        // =============================================================================

        // source: events/PaymentFailed
        error event PaymentFailed :: "Emitted when a payment attempt fails" {
            about Payment
            caused-by ProcessPayment
            fields {
                paymentId : uuid
                orderId : uuid
                reason : string
                failedAt : datetime
            }
        }

        // =============================================================================
        // External Events — consumed through a reaction, never via `triggers`
        // =============================================================================

        // source: listeners/ShipmentDeliveredListener
        external event ShipmentDelivered :: "The Shipping context delivered the parcel" {
            from Shipping
            about Order
            fields {
                orderId : uuid required
                deliveredAt : datetime
            }
        }

        // =============================================================================
        // Temporal Events
        // =============================================================================

        // source: jobs/UnconfirmedOrderSweeper
        temporal event OrderConfirmationDeadlineElapsed :: "A placed order was not confirmed in time" {
            about Order
            reference OrderPlaced
            offset 48 hours
            guard {
                Order.status = draft
            }
            fields {
                orderId : uuid
            }
        }

        // =============================================================================
        // Agreement — cross-aggregate consistency
        // =============================================================================

        // source: invariant/paymentMatchesOrder (cross-aggregate)
        agreement PaymentOrderConsistency :: "Payment amount must always match the order total across Order and Payment" {
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
                escalation :: "Must terminate" {
                    step retryRefund {
                        when { true }
                        action retry(3)
                    }
                    step escalateToOps {
                        when { true }
                        action manual "Finance must reconcile the payment by hand"
                    }
                }
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
- [ ] Every operation named by a state machine transition (`on "Label"` / `on identifier`) matches an operation in the same entity — no `transitions { }` block, no anonymous `when {}` / `then {}`
- [ ] Every `emits` type exists as a top-level `event` with matching fields
- [ ] Every `references` type exists as an entity or value
- [ ] Every aggregate carries its own `identity`/`fields` and a non-empty `entities { }` of non-root children — and no `root` clause anywhere
- [ ] Every operation form is either `"Label" on CommandType` or `name(params) : T` — no event-triggered operations
- [ ] Every command declares an `identity` (correlation id)
- [ ] Every query declares `reads-from <Repository>` and `returns`
- [ ] Every event kind (`event`, `external event`, `error event`, `temporal event`) has a `fields { }` block — and no `external event` carries a `triggers { }` clause
- [ ] Every reaction has `triggered-by` and `effects` that resolve; every event → command edge goes through a reaction
- [ ] Every precondition declares a `rejects "..."` reason, outside the closing brace
- [ ] Every invariant — scoped or file-level — declares an `enforcement` strategy (last element of a scoped body)
- [ ] Every interface declares its role (`api` / `spi`); every SPI has one `describes`, and its provider the matching `described-by`
- [ ] Every infrastructure-service and repository operation is a signature (no body)
- [ ] `satisfies [...]` is the first element inside the body braces, never on the header line
- [ ] Messages in business language, not technical jargon
- [ ] `// source:` comment on every definition
- [ ] Query-only entities annotated with `// NOTE: query-only`
- [ ] Unreferenced enums annotated with `// NOTE: not referenced`
- [ ] Every domain construct has `satisfies [REQ-{CTX}-{NNN}]`
- [ ] Every `// NOTE` in `.domain` has a corresponding requirement in `.sysreq`
- [ ] Every `// UNCLEAR` in `.domain` has a corresponding requirement in `.sysreq`
- [ ] Requirement IDs are sequential and unique within each context
- [ ] `.sysreq` file has correct syntax per SYSTEM-REQ-METAMODEL.md
- [ ] `.domain` file has `requirements-source "{domain}.sysreq"` at context level
- [ ] `refactoring.report` produced with design smell analysis

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
- **Outdated format detected:** if existing `.domain` files use an older syntax, migrate them to the current one during extraction. The forms to upgrade: flat `module` / `uses module` without an `organization`/`context` wrapper; `identifier` instead of `identity`; a top-level `statemachine` or an entity `transitions { }` block (→ `states { machine }`); anonymous transition `when {}` / `then {}` (→ named `precondition`/`postcondition`); a single `service` keyword (→ `domain` / `application` / `infrastructure service`); an `aggregate` with a `root` clause (→ the aggregate IS the root); an event-triggered operation `"Label" when E then C` (→ a `reaction` + the operation on `C`); `external event ... triggers { C }` (→ a `fields { }` block + a `reaction`); reaction `trigger`/`effect` (→ `triggered-by`/`effects`); a `command` with no `identity`; a `query` with no `reads-from`; a `precondition` with no `rejects`; an invariant with no `enforcement`; an `interface` with no `api`/`spi` role.
