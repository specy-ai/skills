---
name: domain-build-code
version: v1
description: "Input: a `.domain` model → Output: source code. Generates idiomatic, stack-specific code artefacts for every domain building block of a Specy `.domain` file (entities, aggregates, value types, enums, commands, queries, events, operations, reactions, invariants, repositories, and domain/application/infrastructure services). Use this skill whenever the user wants to scaffold, generate, or implement code FROM an existing domain model — turn a `.domain` into Java/Spring, TypeScript/NestJS, or Clojure. Also trigger when the user says \"generate the code\", \"scaffold the aggregate\", \"implement this domain model\", or \"build the project from the .domain\". This is the inverse of `domain-extract-from-code`. If no `.domain` exists yet, delegate to `domain-design` first."
user-invocable: true
---

# Skill: domain-build-code

## Role

You are an expert Domain-Driven Design practitioner who turns a Specy v3 `.domain` model into
**idiomatic, production-shaped source code** for a chosen technology stack. You read the model, map
**every** domain building block to its code realization, preserve requirement traceability, and emit a
hexagonal (ports-and-adapters) source tree where the domain layer is free of framework concerns.

You do **not** invent business logic. The `.domain` file is the source of truth: every class, method,
guard, and event you emit must trace back to a declared building block. Where the model is ambiguous or
under-specified, you emit a clearly-marked stub rather than guessing.

This skill is the inverse of `domain-extract-from-code`.

---

## Input → Output

- **Input:** one or more `.domain` files (the Specy v3 domain model), plus a **target stack** chosen by
  the user. The `.domain` grammar is available at `grammar/domain.ebnf` and the concept reference at
  `references/DOMAIN-METAMODEL.md` (load them when you need to resolve a construct).
- **Output:** a source tree of code artefacts — one module per bounded context / module — with the
  domain layer (entities, value types, aggregates, events, services) isolated from infrastructure
  adapters. Plus a short `build-code.report` summarizing what was generated, the stack used, and any
  `// UNCLEAR` stubs that need human attention.

---

## Workflow

### Phase 1 — Read & plan

1. Locate the `.domain` file(s). If none exist, stop and delegate to `domain-design`.
2. Parse the organization → context → module → definitions hierarchy. Build an inventory of every
   building block and its relations (which entity owns which operations, which command triggers which
   operation, which event triggers which reaction, which entity is an aggregate root).
3. **Choose the target stack.** If the user named one, use it. Otherwise ask, then load the matching
   heuristic file:
   - `heuristics/java-spring.md` — Java / Spring Boot
   - `heuristics/typescript-nestjs.md` — TypeScript / NestJS
   - `heuristics/clojure.md` — Clojure
4. Decide the output layout (see **Output layout**). Confirm the root package/namespace with the user.

### Phase 2 — Generate per building block

Walk the model and emit code for every block using the **Building-block → code contract** below,
specialized by the chosen stack's heuristic file. Generate in dependency order: value types and enums
first, then entities/aggregates, then commands/queries/events, then operations, then services, then
reactions, then repositories, then the application layer that wires it together.

### Phase 3 — Traceability & gaps

5. Carry every `satisfies [REQ-...]` declaration into the generated code as a comment/annotation on the
   corresponding class or method (see **Traceability**).
6. For anything the model leaves unspecified (an operation with no body, an `// UNCLEAR` marker, a guard
   that can't be expressed), emit a compiling stub annotated with `// UNCLEAR: <reason>` and list it in
   `build-code.report`.
7. Write `build-code.report`: stack used, files generated (count per building-block kind), and every
   `// UNCLEAR` stub.

---

## Building-block → code contract (stack-agnostic)

This is the contract every stack heuristic specializes. Read it as "a `.domain` *X* becomes code *Y*".

| Domain building block | Code artefact |
|---|---|
| **Value type** | Immutable value object — a record/`final` class with all-args constructor that validates its `invariant`s at construction (transactional constructor: invalid input ⇒ construction fails). Equality by value. No identity, no setters. |
| **Enum** | A language `enum`. Enums backed by a value type become an enum holding that value object (carry the code field). |
| **Entity** | A class with an identity field, mutable state expressed only through its operations (no public setters), and value-typed fields embedded by value. Equality by identity. |
| **Aggregate** | The root entity is the only entry point; contained entities have no repository and are reached by navigating from the root. All state changes go through the root; every operation evaluates the aggregate's invariants before committing. |
| **Identity** | A typed identifier (a small value type wrapping a UUID/string), not a raw primitive. |
| **Field constraints** (`required`, `unique`, `min/max`, `pattern`, `immutable`, date constraints) | Construction-time validation on the owning value/entity; `immutable` ⇒ no setter / `final`. |
| **Command** | An immutable input DTO + a handler. The handler resolves the target aggregate from its repository, invokes the entity operation, and persists the result. Must carry the correlation id. |
| **Query** | An immutable request DTO + a read-side handler that reads from the repository/read model and returns the declared result type. No side effects. |
| **Event** | An immutable event class (past-tense name) carrying the entity id + payload, published through a domain-event publisher port. `internal`/`external`/`error`/`temporal` classifiers map to how it is published/consumed. |
| **Operation** | A method on the owning entity/aggregate (or domain service). Inputs = `accepts`; returns the next state; `precondition`s become guard clauses that reject with the declared message; `emits` becomes event publication; `creates`/`sets` become state construction/mutation; `foreach` becomes iteration. |
| **Precondition / Postcondition** | A guard at the top (precondition) of the operation that throws/returns a rejection with the declared `violation` message; postconditions become assertions/tests. |
| **Reaction** | An event listener that, on the trigger event (and optional guard), issues the effect command. Wired through the messaging/eventing mechanism of the stack. |
| **Invariant** | A check evaluated on every mutation within the consistency boundary; enforcement strategy maps to: `reject` ⇒ throw before commit; `compensation` ⇒ accept + issue corrective command; `alert` ⇒ record/notify. State-machine state invariants are checked while in that state. |
| **State machine** | An explicit state field + a transition table; operations are only permitted from their valid source states; each state carries its own invariants. |
| **Repository** (derived) | An interface (port) for the aggregate root only: `store`, `getById`, `remove`, `search`, plus `findByField` deduced from queries. Read-only/master-data entities get read-only repositories. A persistence adapter implements it. |
| **Domain service** | A stateless class holding logic that spans entities; no framework/IO dependencies. |
| **Application service** | An orchestrator that interprets commands/queries, loads aggregates via repositories, calls domain logic, and commits — no business rules of its own. |
| **Infrastructure service** | A port (interface) in the domain + an adapter implementation in the infrastructure layer (the ACL pattern). Domain calls the port, never the adapter. |
| **Agreement / Reconciliation** | A cross-aggregate consistency mechanism: a saga / process manager that listens to participant events, detects predicate violations, and issues compensating commands through the escalation chain. |
| **`satisfies [REQ-...]`** | A traceability comment/annotation on the generated artefact (see below). |

---

## Output layout

Default to a hexagonal layout per bounded context, mirroring the model hierarchy:

```
<root>/<context>/
  domain/            # pure model — no framework imports
    <module>/
      <Entity>, <Aggregate>, <ValueType>, <Enum>, <Event>, <Command>, <Query>
      <DomainService>
      <Repository> (port interface)
      <InfrastructureService> (port interface)
  application/        # command/query handlers, application services, reactions
  infrastructure/     # repository + infrastructure-service adapters, event bus wiring
```

Keep the `domain/` layer free of stack/framework annotations where the language allows; push framework
concerns to `application/` and `infrastructure/`. The exact folder/package conventions come from the
chosen stack's heuristic file.

---

## Traceability

Every element with a `satisfies [REQ-XYZ-001, ...]` declaration must carry those ids into the code so the
implementation stays navigable back to its requirements — as a doc comment or annotation on the class /
method, e.g. `// satisfies: REQ-XYZ-001`. Preserve the `// source:` provenance idea in reverse: annotate
each generated artefact with the `.domain` construct it came from (`// from: entity ShortLink`).

---

## Conventions

- **`// UNCLEAR:`** — the model under-specifies this artefact (empty operation body, unexpressible guard,
  missing type). Emit a compiling stub and flag it; never invent business logic.
- **`// NOTE:`** — an infrastructure/wiring decision you made that isn't in the model (e.g. chosen
  persistence technology), so the human can review it.
- Names: keep the model's `PascalCase` type names and `camelCase` field names; operation labels (string
  literals in the model) become idiomatic method names.
- Do not generate tests unless asked; when you do, derive them from `precondition`/`postcondition` and
  `emits` declarations.

---

## Stack heuristics

The per-stack realization of the contract lives in a heuristic file you load on demand for the chosen
stack. Each maps every building block above to concrete, idiomatic code for that stack:

- **Java / Spring Boot** → `heuristics/java-spring.md`
- **TypeScript / NestJS** → `heuristics/typescript-nestjs.md`
- **Clojure** → `heuristics/clojure.md`

Load the one matching the target stack and apply its patterns. If the user asks for a stack not listed,
fall back to the stack-agnostic contract above and produce idiomatic code for that language, flagging
choices with `// NOTE:`.
