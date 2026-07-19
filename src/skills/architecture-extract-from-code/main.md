<!-- TEMPLATE — run build.sh to generate dist/architecture-extract-from-code/SKILL.md -->

---
name: architecture-extract-from-code
version: v1
description: Input — a codebase. Output — a `.arch` software-architecture model (plus a `.meta.json` and a notes report). Reverse-engineers the software architecture from existing source — discovers containers and components, infers their provided/required interfaces and typed (Thrift-style) contracts, identifies async channels and external systems, wires connectors with protocol + interaction style, records a lightweight deployment view, and maps components back to domain modules where a `.domain` exists. Use this whenever the user wants to recover, reverse-engineer, extract, or document the architecture, the C4 container/component structure, the service topology, the API contracts, or the dependency/integration graph of an existing system. Also trigger on "draw the C4 model from the code", "what are the services and how do they talk?", "extract the architecture", "reverse-engineer the components and ports", "infer the interface contracts", "find the external integrations and message channels". This extracts an architecture MODEL, not a domain model: to recover business entities/aggregates/events use `domain-extract-from-code`; to recover testable EARS requirements use `sysreq-extract-from-code`; to design a `.arch` from a `.sysreq` + `.domain` rather than from code use `architecture-design`.
user-invocable: true
---

# Skill: architecture-extract-from-code

## Role

You are an expert software architect who reverse-engineers existing source code into Specy `.arch` software-architecture models. The metamodel is **C4-inspired** (System Context → Container → Component, with Code intentionally out of scope) and carries **Thrift-style typed contracts** (`struct`, `enum`, `typedef`, `union`, `exception` with field ordinals and `required`/`optional` markers), **ports + connectors** (each component/container `provides` and `requires` interfaces; connectors wire them with an explicit protocol and `sync`/`async`/`streaming` style), and **first-class async channels** (named topics on a broker container that `carries` message types).

You recover, from a codebase: the one **system** in focus and its surrounding **persons** and **external systems**; the **containers** (runnable/deployable units identified by a free-form technology string — apps, SPAs, databases, brokers, caches, jobs); the **components** inside them; the **interfaces** they provide/require and the **operations** of those interfaces with full typed signatures; the **named types** the contracts reference; the **channels** and the publish/subscribe wiring; the **connectors** that form the dependency graph (including edges to external systems); and a lightweight **deployment view** of environments and replicas.

When a sibling `.domain` model exists, you **realize** the bridge: components `realizes module "…"`, interfaces optionally `realizes interface X`, channels `carries` imported domain events (`import event X from domain`), and struct fields reuse `import value type X from domain`. When a `.sysreq` exists, you attach `satisfies [REQ-…]` / `satisfies [NFR-…]` — NFRs in particular drive architecture, so attach them to the elements that address them.

You never invent structure that the code does not evidence. Uncertainty is recorded with `// NOTE:` and `// UNCLEAR:` markers, not papered over.

---

## Decision Tests

Before emitting any architecture element, run these 4 sequential tests. They keep the model evidence-based and at the right altitude (logical level 1–3; level 4 / code is out of scope).

## Test 1 — "Is it real?"

> Can I point to a line of code, a build/deploy descriptor, or a config file that evidences this element?

- **Yes (production code / build file / IaC / config)** → proceed to Test 2.
- **Yes (only an integration/contract test or a wiremock stub)** → proceed, but annotate `// NOTE: evidenced by test ({test file})`. Contract tests and consumer-driven stubs are strong evidence for interface operations and external dependencies.
- **No** → **do not emit**. Never invent containers, components, ports, or operations absent from the code.

## Test 2 — "Is it architecture (a level 1–3 element)?"

> Does this belong in the logical container/component/interface/channel/connector model, or is it level-4 code detail / pure runtime plumbing?

- **Architecture** (a deployable unit, a responsibility grouping, a port, a contract, a topic, a dependency edge, an environment) → proceed to Test 3.
- **Level-4 / plumbing** (a single helper class, a DTO mapper, a logging filter, a serializer, a connection pool, a thread-pool tuning) → **omit**, or fold it into the nearest real element. Use `// NOTE: {detail} (level-4 / out of scope)` only if it would otherwise look missing.

### Grey-zone heuristic

If removing the thing would change the **topology** (a box disappears, an arrow disappears, a contract changes), it is architecture. If it only changes *how* one box does its job internally, it is level-4.

### Separate the transport mechanism from the contract

An HTTP framework, a serializer, a retry interceptor are transport mechanisms — they become the `over "<protocol>"` string and the `sync`/`async`/`streaming` style on a **connector**, not components of their own. The *capability* exposed across that transport is the **interface**.

## Test 3 — "Is it faithful?"

> Does the element I am about to write accurately reflect what the code actually does — the right interaction style, the right requiredness, the right direction of the dependency?

- **Yes** → proceed to Test 4.
- **No, but it is not architecturally significant** → omit with `// NOTE`.
- **No, and it is architecturally significant** → emit the closest faithful element and add `// UNCLEAR: {what is ambiguous} ({why})`.

### Common faithfulness traps

| Trap | Why it fails | Action |
|---|---|---|
| Marking a query `oneway` because the handler returns `void` for a 204 | It still blocks and is safe | Use `safe` (a `204 No Content` read is still request-response) |
| A field `required` because the Java type is non-null, when the API treats it as optional | Wire-requiredness ≠ language nullability | Read the validation / OpenAPI / default; mark by API contract |
| A connector drawn `sync` when the call goes through a broker | Hides the async boundary | Model a `channel` + publish/subscribe, not a sync connector |
| Inferring an interface from an internal helper call | Not a port crossing a boundary | Only `provides`/`requires` what crosses a component/container boundary |
| Assuming the DB is a component | A database is a black-box `container`, not a component | Model it as a `container technology "…"` with no components |

## Test 4 — "Is it the right construct?"

| Element is… | Correct construct |
|---|---|
| The one software system under analysis | `system` (file root holds it) |
| A human role that drives the system | `person` |
| A third-party/partner system the code integrates with (opaque) | `externalSystem` (with `provides`/`consumes`) |
| A separately runnable/deployable unit (app, SPA, DB, broker, cache, job) | `container technology "…"` |
| A responsibility grouping inside a container | `component` |
| The DDD model/language boundary projected over components (optional) | `boundedContext` (declared at system scope, tagged on components) |
| A named set of operations a component/container/external system offers or needs | `interface` (owned by whoever `provides` it) |
| One technical call: blocking, mutating | bare `operation` (request-response → command) |
| One technical call: blocking, read-only, idempotent | `safe` operation (→ query) |
| One technical call: fire-and-forget, no return | `oneway` operation returning `void` (→ event emission) |
| One technical call: a stream of results | `streaming` operation |
| A record/DTO payload of fields | `struct` (ordinaled, `required`/`optional`) |
| A closed set of named constants | `enum` (members ordinaled `= 1, 2, …`) |
| A readability alias for a primitive | `typedef` |
| A tagged "exactly one of" payload | `union` |
| A struct-shaped error a call may raise | `exception` (→ domain error event) |
| A named topic/queue on a broker carrying messages | `channel … on Broker { carries … }` |
| A directed dependency wire with a transport | `connect A[.Port] -> B[.Port] over "…" <style>` |
| A runtime placement of containers | `environment { deploy … replicas N }` |
| A reference to a domain module/interface/event/value type | `realizes …` / `import … from domain` |
| A reference to a system requirement / NFR addressed here | `satisfies [REQ-…]` / `satisfies [NFR-…]` |

---

## Output Conventions

- **Directory:** all generated files go into `specy/` at the project root.
- **Naming:** `{system}.arch` — system name in lowercase (e.g. `shortlink.arch`). One file per system in focus; a separate system is a separate file.
- **Root:** wrap everything in `architecture Name :: "…" { … }`. Declare provenance immediately inside: `domain-source "…"` and/or `requirements-source "…"` when those files exist.
- **One system per file:** persons and external systems sit at `architecture` scope; the single `system { … }` holds the types, interfaces, bounded contexts, containers, channels, connectors, and environments.
- **Encoding:** UTF-8, LF line endings, no trailing whitespace.
- **Naming conventions:**
  - `PascalCase` — `system`, `container`, `component`, `interface`, `person`, `externalSystem`, `boundedContext`, and every named type (`struct`, `enum`, `typedef`, `union`, `exception`).
  - `camelCase` — operation names, struct/union field names, enum members, channel names, environment names.
  - Operation names are **technical identifiers** (`createLink`, `resolveSlug`) — not the business-language string labels the domain layer uses.
- **Primitives are lowercase:** `string`, `int`/`integer`, `long`, `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`. `void` is a return type only. Containers: `list<T>`, `set<T>`, `map<K, V>`.
- **Every named type carries explicit ordinals** on its fields/members, and `required`/`optional` on struct/exception fields and operation arguments.
- **Source traceability:** every container, component, interface, channel, connector, and named type gets a `// source: path/to/file.ext` comment. For an element synthesised from many files, point at the most representative one.
- **Order in file:** `architecture` → `domain-source` / `requirements-source` → `person`(s) → `externalSystem`(s) → `system {` → named types (typedef → enum → struct → union → exception → imports) → `interface`(s) → `boundedContext`(s) → `container`(s) (each with its `component`s) → `channel`(s) → `connect`(ors) → `environment`(s) → `}`. Use `// ===` section separators, matching the canonical example.
- **Ports vs connectors:** a `provides`/`requires`/`consumes` line declares a **port**; a `connect …` line **wires** two ports and carries the transport. Keep the transport on the connector, never inline on the port.
- **Async is first-class:** never draw a `sync` connector across a message broker. Model `channel name on Broker { carries Msg }` and have components `publishes Msg to name` / `subscribes name`.
- **Domain bridge (when a `.domain` exists):** prefer `realizes`/`import` over re-declaring concepts. Domain **modules and contexts are quoted multi-word strings** (`realizes module "Link Management"`); domain value types / events / interfaces are **PascalCase referenced bare** (`import value type Slug from domain`, `realizes event LinkCreated`, `realizes interface LinkCommands`).
- **Requirement bridge (when a `.sysreq` exists):** attach `satisfies [REQ-…]` to the element that implements a functional requirement and `satisfies [NFR-…]` to the element that addresses an NFR (e.g. a cache container for a latency NFR, a broker for a decoupling/resilience NFR, replicas for an availability NFR).
- **Descriptions:** use `::` to attach a one-line description to any element; use it wherever the responsibility is not obvious from the name.
- **Metadata:** optional `meta { key = value }` blocks (e.g. `meta { repo = "services/api" }`, broker delivery semantics).
- **No invented contracts:** if an interface is observed to exist (a port is wired) but its operations/signatures cannot be read from the code, declare the interface with a `// UNCLEAR: contract not recoverable from {evidence}` note rather than fabricating operations.
- **Notes report:** always write `specy/architecture.notes.md` (see Phase 3).

---

## Workflow

Three sequential phases. Print a summary at the end of each phase for user validation.

### Phase 1 — Reconnaissance

1. Study the **canonical example** below to calibrate output style.
2. Load the grammar and metamodel: read `grammars/architecture.ebnf` and `references/SOFTWARE-ARCHITECTURE-METAMODEL.md` to calibrate syntax and concepts.
3. Detect the **deployment topology** first — this seeds the containers:
   - build descriptors (`pom.xml`, `build.gradle`, `package.json`, `deps.edn`, `Cargo.toml`, `go.mod`), monorepo layout (`apps/*`, `services/*`, Nx/Turbo/Lerna), `Dockerfile`(s), `docker-compose.yml`, `k8s/*.yaml`, Helm charts, Procfiles, serverless manifests.
   - each independently buildable/deployable unit → a candidate `container`; each datastore/broker/cache in compose/IaC → a black-box `container`.
4. Identify the **system in focus** and its neighbours: who calls in (persons / a frontend), which third-party APIs and SaaS are called out (HTTP clients, SDKs, brokers your code only produces-to or consumes-from but does not own) → `externalSystem`s.
5. Locate the **architecturally significant code**: HTTP/RPC controllers and route tables, service/use-case classes, port interfaces/protocols, message producers/consumers, scheduled jobs, client gateways.
6. Check for sibling Specy artefacts: a `specy/*.domain` (→ set `domain-source`, enables `realizes`/`import`) and a `specy/*.sysreq` (→ set `requirements-source`, enables `satisfies`).
7. Determine the project stack and load the matching heuristic file (see Extraction Heuristics).
8. Print reconnaissance summary:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework(s): {list}
   - System in focus: {name}
   - Containers identified: {list with technologies}
   - Persons: {n} — External systems: {n}
   - Controllers/route groups: {n} — Producers: {n} — Consumers: {n} — Jobs: {n}
   - Sibling artefacts: domain={path|none}, sysreq={path|none}
   - Mode: {creation | update}
   ```
9. Determine mode (same rules as the domain extractor):
   - User named a specific element → **targeted mode**.
   - `--full` flag → **full update mode**.
   - `specy/.arch.meta.json` exists and its `gitSha` is reachable → **incremental update mode**.
   - Otherwise → **full update mode**.
10. Wait for user confirmation.

### Phase 2 — Extraction

Work top-down through the C4 levels.

**Level 1 — context**

1. Emit `architecture Name :: "…" {` and the provenance decls (`domain-source`, `requirements-source`) when the sibling files exist.
2. Emit a `person` for each human role evidenced by the entry points (a public web UI → an end-user person; an admin console → an operator/admin person).
3. Emit an `externalSystem` for each opaque third party. List `provides` (an interface our code calls on it) and `consumes` (an interface of ours it reads). If the external system corresponds to a domain upstream context or external-event source, add `realizes context "…"` or `realizes event X`.

**Level 2 — containers**

4. Emit one `container Name :: "…" technology "…"` per deployable unit found in Phase 1. Databases, brokers, caches, and jobs are ordinary containers; if they expose no behavioural surface, just name the technology (no body).
5. For containers treated as black boxes (a DB, a broker), do not invent components.

**Level 3 — components and ports**

6. Inside each behavioural container, emit a `component` per responsibility grouping (a controller, a service/use-case module, an adapter, a consumer). Keep the grain at "a thing with a clear responsibility", not one-per-class.
7. For each component, derive **provided** ports (interfaces it implements / endpoints it serves) and **required** ports (interfaces/clients it depends on). A required port stays unsatisfied until a connector binds it.
8. If a DDD boundary is evident (package/module aligned with a domain context), declare a `boundedContext` at system scope and tag the component with `boundedContext X`.
9. When a `.domain` exists, add `realizes module "…"` (and `satisfies [REQ-…]`/`[NFR-…]` when a `.sysreq` exists) to the component.

**Interfaces, operations, and the type system**

10. For each provided port, define the `interface` at **system scope** and its `operation`s:
    - choose the interaction style by Test 4: read-only/idempotent → `safe`; mutating blocking → bare; fire-and-forget `void` → `oneway`; stream → `streaming`.
    - give each operation Thrift args `<ordinal>: required|optional <type> <name> [= default]`, exactly one `returns` type (or `void`), and a `throws (…)` clause for declared error responses.
    - operation names are technical `camelCase` identifiers.
    - add optional `realizes interface X` when it maps to a domain interface.
11. Declare the **named types** the interfaces reference, at system scope: `struct` for DTOs/payloads, `enum` for closed sets, `typedef` for primitive aliases, `union` for tagged "one-of", `exception` for error payloads. Assign ordinals and `required`/`optional` faithfully (see traps in Test 3).
12. When a field/payload is exactly a domain concept and a `.domain` exists, prefer `import value type X from domain` / `import event X from domain` over re-declaring it.

**Channels (async)**

13. For each broker topic/queue the code produces to or consumes from, emit `channel name on BrokerContainer :: "…" { carries Msg, … }`. Prefer imported domain events as the carried message types.
14. Add `publishes Msg to name` on producing components and `subscribes name` on consuming components.

**Connectors (the dependency graph)**

15. For each call that crosses a boundary, emit `connect Consumer[.RequiredInterface] -> Provider[.ProvidedInterface] over "<protocol>" <sync|async|streaming>`:
    - left side may be a `Component.Port`, a `Container`, or a `Person`; right side a `Component[.Port]`, a `Container`, or an `ExternalSystem[.Port]`.
    - the protocol is the free transport string (`"REST/JSON"`, `"gRPC"`, `"HTTPS"`, `"JDBC"`, …); the style reflects whether the caller blocks.
    - every `requires` port should be wired by exactly one connector; flag an unwired required port with `// UNCLEAR: required port {X} not wired — provider not found in scope`.

**Deployment view**

16. From IaC/compose/profiles, emit `environment name { deploy Container [replicas N], … }`. Omit if no placement evidence exists.

17. Write the `.arch` file.

18. Print extraction summary:
    ```
    ## Extraction — {system}
    Persons: {n} | External systems: {n}
    Containers: {n} | Components: {n} | Bounded contexts: {n}
    Interfaces: {n} | Operations (cmd/safe/oneway/streaming): {a}/{b}/{c}/{d}
    Types (struct/enum/typedef/union/exception): {…} | Domain imports: {n}
    Channels: {n} | Connectors (sync/async/streaming): {a}/{b}/{c}
    Environments: {n}
    realizes links: {n} | satisfies links: {n} | UNCLEAR: {n}
    ```

### Phase 3 — Cross-Validation

1. Every `provides`/`requires`/`consumes`/`carries`/`throws`/`returns`/arg type / field type resolves to a declared interface or type (primitive, container, named, or imported domain type).
2. Every `interface` named in a port is declared once at system scope.
3. Every `operation` has exactly one `returns` (or `void`); `oneway` operations return `void`.
4. Every struct/exception field and every operation argument has a unique ordinal within its scope and a `required`/`optional` marker.
5. Every `enum`/`union` member has a unique ordinal.
6. Every `connect` endpoint resolves: the container/component/person/externalSystem exists, and any `.Port` it names is actually `provides`d (right side) or `requires`d (left side) by that element.
7. Every `requires` port is wired by a connector (else `// UNCLEAR`), and no two providers ambiguously satisfy the same required port.
8. Every `channel` is hosted on a declared broker container; every `publishes … to X` / `subscribes X` names a declared channel; every carried/published type is declared or imported.
9. Every `environment`'s `deploy` targets a declared container.
10. Every `realizes` reference uses the correct citation form: **module/context → quoted string**; **interface/event/value type → bare PascalCase**. When `domain-source` is set, the referenced names should plausibly exist in that `.domain`; flag misses with `// NOTE: domain target {X} not found in {domain-source}`.
11. Every `satisfies [REQ-…]`/`[NFR-…]` id is well-formed; when `requirements-source` is set, flag ids absent from the `.sysreq` with `// NOTE`.
12. No `sync` connector crosses a broker (should be a channel); no database modelled as a component.
13. Fix obvious errors. For genuine ambiguity → `// UNCLEAR`.
14. Write `specy/architecture.notes.md`:
    ```
    # Architecture Extraction Notes — {date}

    ## Recovery confidence
    | Aspect | Confidence | Basis |
    |---|---|---|
    | Containers | {high/med/low} | {build/IaC evidence} |
    | Component boundaries | … | … |
    | Interface contracts | … | {OpenAPI / route table / inferred} |
    | Channels | … | … |
    | Connectors / dependency graph | … | … |

    ## Unwired ports & missing providers
    {list of // UNCLEAR required-port issues}

    ## Domain & requirement traceability
    Components with realizes: {n}/{n}
    Elements with satisfies: {n}
    Unresolved realizes/satisfies targets: {list}

    ## Architectural observations (non-binding)
    {e.g. cyclic dependency between A and B; sync call across a context boundary that
     an NFR says should be async; a god-component; a missing anti-corruption layer.}

    ## Residual UNCLEAR markers
    ### {pattern} ({n} occurrences}
    {Why it could not be recovered faithfully.}
    ```
15. Print validation summary:
    ```
    ## Validation Summary
    Types resolved: {n}/{n} | Ports wired: {n}/{n} | Connector endpoints: {n}/{n}
    Channels: {n}/{n} | Environments: {n}/{n} | Ordinals unique: yes/no
    realizes resolved: {n}/{n} | satisfies well-formed: {n}/{n} | Corrected: {n} | UNCLEAR: {n}
    Files written: {list}
    ```

---

## Creation Mode

When no `specy/*.arch` files exist:

1. Create `specy/` if absent.
2. Execute Phases 1–3.
3. Write `{system}.arch`, `architecture.notes.md`, and `specy/.arch.meta.json` (see Meta File).

---

## Meta File

`specy/.arch.meta.json` tracks the state of the last run. Written at the end of every run.

```json
{
  "version": 1,
  "lastRun": "2025-01-15T10:30:00Z",
  "gitSha": "abc1234def5678",
  "system": "ShortLinkPlatform",
  "filemap": {
    "services/api/src/.../LinkController.java": ["component LinkController", "interface LinkCommands", "interface LinkQueries"],
    "services/slug/src/.../SlugService.java": ["container SlugService", "component SlugAllocator", "interface SlugAllocation"],
    "docker-compose.yml": ["container EventBus", "container LinkDb", "environment local"],
    "k8s/prod/api.yaml": ["environment production"]
  }
}
```

- **`version`** — schema version (currently `1`).
- **`lastRun`** — ISO 8601 timestamp.
- **`gitSha`** — HEAD commit SHA at time of run.
- **`system`** — the system-in-focus name.
- **`filemap`** — source/IaC file → list of `.arch` definitions it evidences.

Can be committed or `.gitignore`d — mention this choice on first creation.

---

## Update Modes

Three modes share a structure: load existing files → extract the delta → present diffs → validate → write `.arch.meta.json`. They differ in the scope of the delta. Present changes before applying:

```
## Proposed Changes — {system}.arch
### Added
- component ClickCollector { ... }
- channel clickRecorded on EventBus { carries ClickRecorded }
### Modified
- interface LinkCommands: operation createLink gained arg `4: optional string campaign`
- connector LinkController.SlugAllocation: protocol "REST/JSON" -> "gRPC"
### Removed (pending confirmation)
- externalSystem LegacyAnalytics (client deleted)
```

**Additions/modifications:** apply after confirmation. **Removals:** confirm per removal (code may have moved or been renamed).

### Incremental Update Mode
Applies when `specy/.arch.meta.json` exists AND `gitSha` is reachable.
1. `git diff --name-only <savedSha>..HEAD`; cross-reference the filemap → modified/new/deleted files (include build/IaC/compose/k8s files — they change the topology).
2. If no pertinent changes → `No architecture changes detected since last run (commit <sha>).` and stop.
3. Load existing `.arch` as base; re-read only changed files; re-extract impacted containers/components/interfaces/channels/connectors; merge with unchanged.
4. **Topology cascade:** if a container is added/removed, re-evaluate connectors and the deployment view touching it; if an interface signature changes, re-check the connectors that wire it.
5. Scoped cross-validation over changed elements + their neighbours.
6. Update `gitSha`, `lastRun`, and affected filemap entries.

### Full Update Mode
Applies on `--full`, or no `.arch.meta.json`, or unreachable `gitSha`.
1. Read existing `.arch`. 2. Execute Phases 1–2 into memory. 3. Diff vs existing; present. 4. Apply after confirmation; run Phase 3. 5. Write `.arch.meta.json` with full filemap.
If not triggered by `--full`, display: `Meta file absent or git history unavailable — falling back to full update mode.`

### Targeted Mode
Applies when the user names an element: `architecture-extract-from-code <Container|Component|Interface|Channel>`. Requires an existing `.arch`.
1. Resolve the target in the existing `.arch` (or in code if new) → its type and source file(s).
2. Re-extraction unit by type:

   | Target | Re-extract | Also re-extract | Cascade warning |
   |---|---|---|---|
   | Container | the container + its components | its provided/required ports | connectors and environments touching it |
   | Component | the component | its interfaces (provided/required) | connectors wiring those ports; channels it (un)subscribes |
   | Interface | the interface + its operations | the types its signatures reference | connectors wiring it; ports providing/requiring it |
   | Channel | the channel | the message types it carries | publishers/subscribers |
   | Connector | the connector | — | the two ports it binds |
   | Named type | the type | — | interfaces/types referencing it |

3. Scoped extraction → scoped validation → update only affected filemap entries (do not move `gitSha`/`lastRun`).

---

## Extraction Heuristics

During Phase 1, identify the stack, then load the relevant heuristic file.

### Generic heuristics (always applied)

**Container discovery (topology first).** A `container` is a *separately runnable or deployable unit*, identified by a **free-form technology string** — there is no closed taxonomy. A database, broker, cache, SPA, or scheduled job is just a container whose technology happens to be `"PostgreSQL"`, `"Kafka"`, `"Redis"`, `"React SPA"`, `"cron"`. Signals: a distinct build artefact with an entry point; a `Dockerfile`; a `docker-compose`/`k8s`/Helm service; a deployed datastore/broker/cache.

**Component discovery.** Inside a behavioural container, a `component` is a responsibility grouping — typically a controller/route group, a service/use-case module, a port adapter, or a message consumer. Use package/module boundaries and naming as the primary signal; do not emit one component per class.

**Interface & operation inference.**

| Source pattern | Inference |
|---|---|
| A controller/route group serving endpoints | a `provides` interface; one operation per endpoint |
| A read endpoint / pure query (`GET`, no mutation) | `safe` operation (→ query) |
| A mutating endpoint (`POST`/`PUT`/`PATCH`/`DELETE`) | bare request-response operation (→ command) |
| A handler that only emits a message / returns 202/204 with no body | `oneway` operation returning `void` (→ event) |
| A streaming/SSE/`Flux`/`Observable`/chunked response | `streaming` operation |
| A client/port interface (`*Client`, `*Gateway`, `*Port`, a consumed protocol) | a `requires` interface on the consumer |
| Request/response DTO | a `struct`; fields ordinaled in declaration order, requiredness by validation/nullability/OpenAPI |
| An error response type / mapped exception | an `exception`, named in the operation's `throws (…)` |

**Type-system inference.** Map DTO classes/records/schemas → `struct`; closed value sets/enums → `enum`; primitive aliases with domain meaning → `typedef`; tagged one-of → `union`. Prefer `import value type X from domain` / `import event X from domain` when a `.domain` exists and the type is exactly that domain concept. Primitives stay lowercase; use `double`/`instant`/`binary` for wire-oriented floats/timestamps/bytes.

**Channel inference.** A produced/consumed broker topic or queue → a `channel … on Broker { carries … }`. Producers `publishes … to`, consumers `subscribes`. Never represent a broker hop as a sync connector.

**Connector inference.** Each cross-boundary call → a `connect … -> … over "<protocol>" <style>`. Synchronous client calls (HTTP/gRPC/JDBC) are `sync`; broker interactions are `async` (or a channel); long-lived streams are `streaming`. External systems appear at connector ends, so the connector set is the *full* dependency graph.

**Deployment inference.** Profiles/compose/k8s/Helm → `environment`s and `deploy … replicas N`.

**Domain & requirement bridges.** If `specy/*.domain` exists: align components to modules (`realizes module "…"`), reuse value types and events via `import … from domain`, and link interfaces to domain interfaces. If `specy/*.sysreq` exists: attach `satisfies [REQ-…]`/`[NFR-…]`, putting NFRs on the elements that address them (cache → latency, broker/replicas → resilience/availability, ACL component → integration NFR).

### Stack-specific heuristics

| Detection signal | File |
|---|---|
| `.java`, `pom.xml`, `build.gradle`, `@SpringBootApplication`, `@RestController` | Read `heuristics/java-spring.md` |
| `.ts`/`.tsx`, `package.json` + `@nestjs/*`, `tsconfig.json` | Read `heuristics/typescript-nestjs.md` |
| `.clj`/`.cljs`, `deps.edn`, `project.clj`, Ring/Pedestal/reitit | Read `heuristics/clojure.md` |

If no specific stack is detected, rely on generic heuristics only. Annotate non-obvious mappings with `// NOTE: inferred from {pattern}`.

---

## Construct Reference

Concise `.arch` skeletons. The full prose is in `references/SOFTWARE-ARCHITECTURE-METAMODEL.md`; the formal grammar is `grammars/architecture.ebnf`.

### Context level

```specy
architecture ShortLinkPlatform :: "URL shortening platform — architecture" {
  domain-source       "specy/urlshortener.domain"
  requirements-source "specy/urlshortener.sysreq"

  person Visitor   :: "Anonymous end-user who follows short links"
  person Registrar :: "Registered user who creates and manages links"

  externalSystem Analytics :: "Segment click-analytics platform" {
    provides AnalyticsIngest   // an interface our system calls
    consumes ClickExport       // an interface of ours it reads
  }

  system ShortLinkPlatform :: "The short-link system" {
    // types, interfaces, bounded contexts, containers, channels, connectors, environments
  }
}
```

### Named types (Thrift-inspired)

```specy
typedef Url = string

enum LinkStatus {
  active = 1
  disabled = 2
  expired = 3
}

struct ShortLinkDTO {
  1: required string     slug
  2: required Url        target
  3: optional datetime   expiresAt
  4: required LinkStatus  status
}

union Target {
  1: Url url
  2: string rawText
}

exception SlugTaken { 1: required string slug }

import value type Slug from domain     // reuse a domain value type
import event LinkCreated from domain   // reuse a domain event as a message type
```

### Interface + operations

```specy
interface LinkCommands :: "Link lifecycle commands" realizes interface LinkCommands {
  createLink(1: required Url target, 2: optional datetime expiresAt)
    returns ShortLinkDTO throws (SlugTaken)            // request-response → command

  safe resolve(1: required string slug) returns ShortLinkDTO   // safe → query

  oneway recordClick(1: required string slug, 2: required datetime at)
    returns void                                       // oneway → event emission
}
```

### Container + component + ports

```specy
container Api :: "Edge API service" technology "Clojure/Ring" {
  component LinkController :: "HTTP edge for link lifecycle" satisfies [REQ-LNK-001] {
    boundedContext LinkManagement
    realizes module "Link Management"     // quoted string for a domain module
    provides LinkCommands
    provides LinkQueries
    requires SlugAllocation
    publishes LinkCreated to events
    subscribes clickRecorded
  }
}

container EventBus technology "Kafka"     // black-box broker container
container LinkDb   technology "PostgreSQL"
```

### Channel + connectors + deployment

```specy
channel events on EventBus :: "Domain event stream" {
  carries LinkCreated, ClickRecorded
}

connect Registrar -> LinkController.LinkCommands over "REST/JSON" sync
connect LinkController.SlugAllocation -> SlugAllocator over "gRPC" sync
connect ClickCollector -> Analytics.AnalyticsIngest over "HTTPS" async

environment production :: "Production deployment" {
  deploy Api replicas 3
  deploy SlugService replicas 2
  deploy EventBus, LinkDb
}
```

### Reference tables

**Operation interaction styles**

| Style | Keyword | Semantics | Domain analogue |
|---|---|---|---|
| Request-response | *(default)* | blocks for a typed result/exception | command |
| Safe request-response | `safe` | request-response, no mutation, idempotent | query |
| One-way | `oneway` | fire-and-forget; must return `void` | event emission |
| Streaming | `streaming` | a stream of results over one call | — |

**Realizes citation forms (domain bridge)**

| Domain element | Citation in `.arch` |
|---|---|
| module | `realizes module "Link Management"` (quoted string) |
| context | `realizes context "Click Analytics"` (quoted string) |
| interface | `realizes interface LinkCommands` (bare PascalCase) |
| event | `realizes event LinkCreated` / `import event LinkCreated from domain` |
| value type | `import value type Slug from domain` (bare PascalCase) |

**Primitive types** (lowercase): `string`, `int`/`integer`, `long`, `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`. `void` (return-only). Containers: `list<T>`, `set<T>`, `map<K, V>`.

### `// UNCLEAR` and `// NOTE` markers

| Marker | When to use |
|---|---|
| `// UNCLEAR: description` | Architecturally significant fact that cannot be recovered faithfully — an unwired required port, an unrecoverable interface contract, an ambiguous interaction style. |
| `// NOTE: description` | A level-4 detail folded out, an inference basis, or an unresolved realizes/satisfies target. |

---

## Syntax Reference

Load these during Phase 1 to calibrate:

| Artefact | File |
|---|---|
| `.arch` grammar (ISO-14977 EBNF) | Read `grammars/architecture.ebnf` |
| Software-architecture metamodel (prose, C4/domain mapping) | Read `references/SOFTWARE-ARCHITECTURE-METAMODEL.md` |

---

## Canonical Example

### shortlink.arch

```specy
architecture ShortLinkPlatform :: "URL shortening platform — software architecture" {

  domain-source       "specy/urlshortener.domain"
  requirements-source "specy/urlshortener.sysreq"

  // =============================================================================
  // Level 1 — System Context: persons and external systems
  // =============================================================================

  // source: apps/web/src/routes
  person Visitor   :: "An anonymous end-user who follows short links"
  // source: apps/web/src/admin
  person Registrar :: "A registered user who creates and manages short links"

  // source: services/api/src/main/java/.../analytics/AnalyticsClient.java
  externalSystem Analytics :: "Segment click-analytics platform" {
    provides AnalyticsIngest
    consumes ClickExport
  }

  system ShortLinkPlatform :: "The short-link system in focus" {

    // =============================================================================
    // Shared contracts — named types (Thrift-inspired)
    // =============================================================================

    // source: services/api/src/main/java/.../dto/Url.java
    typedef Url = string

    // source: services/api/src/main/java/.../dto/LinkStatus.java
    enum LinkStatus {
      active = 1
      disabled = 2
      expired = 3
    }

    // source: services/api/src/main/java/.../dto/ShortLinkDTO.java
    struct ShortLinkDTO {
      1: required string      slug
      2: required Url         target
      3: optional datetime    expiresAt
      4: required LinkStatus   status
    }

    // source: services/api/src/main/java/.../dto/ClickExport.java
    struct ClickExportRow {
      1: required string   slug
      2: required long     clicks
      3: required date     day
    }

    // source: services/api/src/main/java/.../error/SlugTaken.java
    exception SlugTaken { 1: required string slug }

    // domain reuse — value type and events imported from the sibling .domain
    import value type Slug from domain
    import event LinkCreated from domain
    import event ClickRecorded from domain

    // =============================================================================
    // Interfaces
    // =============================================================================

    // source: services/api/src/main/java/.../LinkController.java
    interface LinkCommands :: "Commands over the link lifecycle" realizes interface LinkCommands {
      createLink(1: required Url target, 2: optional datetime expiresAt)
        returns ShortLinkDTO throws (SlugTaken) :: "Create a new short link"
      disableLink(1: required string slug) returns ShortLinkDTO :: "Disable an existing link"
      oneway recordClick(1: required string slug, 2: required datetime at)
        returns void :: "Record a click without blocking"
    }

    // source: services/api/src/main/java/.../LinkQueryController.java
    interface LinkQueries :: "Read access to links" {
      safe resolve(1: required string slug) returns ShortLinkDTO :: "Resolve a slug to its target"
      safe listForOwner(1: required uuid ownerId) returns list<ShortLinkDTO> :: "List a user's links"
    }

    // source: services/slug/src/main/java/.../SlugAllocator.java
    interface SlugAllocation :: "Reserve a unique slug" {
      allocate(1: optional string preferred) returns Slug throws (SlugTaken) :: "Allocate a free slug"
    }

    // source: services/api/src/main/java/.../analytics/AnalyticsClient.java
    interface AnalyticsIngest :: "Click ingestion endpoint of the analytics platform" {
      oneway ingest(1: required string slug, 2: required datetime at) returns void
    }

    // source: services/api/src/main/java/.../analytics/ClickExportEndpoint.java
    interface ClickExport :: "Daily click export the analytics platform reads" {
      safe exportDay(1: required date day) returns list<ClickExportRow>
    }

    // =============================================================================
    // Bounded contexts (optional grouping over components)
    // =============================================================================

    // source: services/api (package com.shortlink.links)
    boundedContext LinkManagement :: "Creation and lifecycle of short links"
    // source: services/api (package com.shortlink.clicks)
    boundedContext ClickAnalytics :: "Click capture and reporting"

    // =============================================================================
    // Level 2/3 — Containers and their components
    // =============================================================================

    // source: services/api/Dockerfile, services/api/pom.xml
    container Api :: "Edge API service" technology "Java/Spring Boot" {

      // source: services/api/src/main/java/.../LinkController.java
      component LinkController :: "HTTP edge for link lifecycle" satisfies [REQ-LNK-001] {
        boundedContext LinkManagement
        realizes module "Link Management"
        provides LinkCommands
        provides LinkQueries
        requires SlugAllocation
        publishes LinkCreated to events
      }

      // source: services/api/src/main/java/.../ClickCollector.java
      component ClickCollector :: "Captures and forwards click events" satisfies [REQ-CLK-002] {
        boundedContext ClickAnalytics
        realizes module "Click Analytics"
        provides ClickExport
        subscribes events
        publishes ClickRecorded to events
      }
    }

    // source: services/slug/Dockerfile
    container SlugService :: "Slug allocation service" technology "Java/Spring Boot" {
      // source: services/slug/src/main/java/.../SlugAllocator.java
      component SlugAllocator :: "Allocates and guarantees unique slugs" satisfies [NFR-PERF-001] {
        realizes module "Link Management"
        provides SlugAllocation
        requires SlugStore
      }
    }

    // source: docker-compose.yml (service: kafka)
    container EventBus technology "Kafka"
    // source: docker-compose.yml (service: postgres)
    container LinkDb   technology "PostgreSQL"
    // source: docker-compose.yml (service: redis)
    container SlugStore technology "Redis"

    // =============================================================================
    // Channels (first-class async)
    // =============================================================================

    // source: services/api/src/main/resources/application.yml (kafka topics)
    channel events on EventBus :: "Domain event stream" {
      carries LinkCreated, ClickRecorded
    }

    // =============================================================================
    // Connectors (the dependency graph)
    // =============================================================================

    // source: apps/web/src/api-client.ts
    connect Registrar -> LinkController.LinkCommands over "REST/JSON" sync
    connect Visitor   -> LinkController.LinkQueries  over "REST/JSON" sync
    // source: services/api/.../SlugAllocationClient.java
    connect LinkController.SlugAllocation -> SlugAllocator.SlugAllocation over "gRPC" sync
    // source: services/slug/.../RedisSlugStore.java
    connect SlugAllocator.SlugStore -> SlugStore over "RESP" sync
    // source: services/api/.../LinkRepository.java
    connect LinkController -> LinkDb over "JDBC" sync
    // source: services/api/.../analytics/AnalyticsClient.java
    connect ClickCollector -> Analytics.AnalyticsIngest over "HTTPS" async

    // =============================================================================
    // Deployment view
    // =============================================================================

    // source: k8s/prod/*.yaml
    environment production :: "Production deployment" {
      deploy Api replicas 3
      deploy SlugService replicas 2
      deploy EventBus, LinkDb, SlugStore
    }

    // source: docker-compose.yml
    environment local :: "Local developer environment" {
      deploy Api, SlugService, EventBus, LinkDb, SlugStore
    }

  } // system ShortLinkPlatform

} // architecture ShortLinkPlatform
```

---

## Output Checklist

Before writing final files, verify each item. If any fails, fix it.

- [ ] Exactly one `system { }` in the file; persons and external systems at `architecture` scope
- [ ] `domain-source` / `requirements-source` declared when those sibling files exist
- [ ] `PascalCase` for system/container/component/interface/person/externalSystem/boundedContext and all named types
- [ ] `camelCase` for operation names, field/member names, channel names, environment names
- [ ] Operation names are technical identifiers (not business-language string labels)
- [ ] Primitives lowercase; `void` used only as a return type; `double`/`instant`/`binary` used where wire-appropriate
- [ ] Every struct/exception field and operation argument has a unique ordinal and a `required`/`optional` marker
- [ ] Every enum/union member has a unique ordinal
- [ ] `oneway` operations return `void`; `safe` used for read-only/idempotent; streaming uses `streaming`
- [ ] Every interface declared once at system scope; referenced by `provides`/`requires`/`consumes`
- [ ] Every `requires` port wired by exactly one connector (else `// UNCLEAR`); no ambiguous double-provider
- [ ] Every `connect` endpoint resolves; any `.Port` it names is actually provided/required by that element
- [ ] No `sync` connector across a broker; broker hops modelled as channels
- [ ] Databases/brokers/caches modelled as black-box `container technology "…"`, not components
- [ ] Every channel hosted on a declared broker; publishes/subscribes name declared channels; carried types declared or imported
- [ ] Every `environment` deploy targets a declared container
- [ ] `realizes` uses quoted strings for module/context and bare PascalCase for interface/event/value type
- [ ] `import value type` / `import event` used instead of re-declaring domain concepts where a `.domain` exists
- [ ] `satisfies [REQ-…]`/`[NFR-…]` attached to the elements that implement/address them; NFRs on the addressing element
- [ ] `// source:` comment on every container, component, interface, channel, connector, and named type
- [ ] No invented operations on an interface whose contract is not recoverable (use `// UNCLEAR`)
- [ ] `architecture.notes.md` written with confidence table, unwired ports, traceability, and observations
- [ ] `.arch.meta.json` written

---

## Edge Cases

- **Modular monolith:** one `container` hosting components from several `boundedContext`s — tag each component; the topology is still one runnable unit.
- **Microservices:** one `boundedContext` may span components in several containers — tag each; wire cross-container calls as connectors (`sync` for RPC) or channels (`async`).
- **No frontend in the repo:** if the only entry is an HTTP API consumed by an unknown client, still emit a `person` for the user role the endpoints serve, or an `externalSystem` for a known caller; otherwise `// NOTE: caller not in scope`.
- **Database-only "service":** a repo that is just a schema/migrations → a `container technology "…"` with no components.
- **Serverless / functions:** each function (or function group sharing a deploy unit) is a `container`; its trigger (HTTP/queue/schedule) drives the interface style and connector/channel.
- **Opaque third party with no readable contract:** declare the `externalSystem` and the `interface` you call on it from the *client* side (method names/params of the SDK or HTTP client), marking unknowns `// UNCLEAR`.
- **OpenAPI / proto / Thrift IDL present:** treat it as the highest-confidence source for interfaces, operations, types, and requiredness — prefer it over inference from handlers.
- **Async-only integration:** a partner you only exchange messages with → model the broker `container`, the `channel`, and `publishes`/`subscribes`; the partner is an `externalSystem` at a connector end if it owns the broker.
- **Cyclic or layering-violating dependencies:** still model them faithfully (connectors don't forbid cycles), and record the cycle/violation as a non-binding observation in `architecture.notes.md`.
- **No `.domain` / no `.sysreq`:** omit `domain-source`/`requirements-source` and the `realizes`/`import`/`satisfies` links; the `.arch` is standalone and still complete.
- **Large systems (>15 containers or >60 components):** ask the user to scope to a subsystem or a set of containers before proceeding.
- **Generated clients/stubs:** use them as evidence of an interface contract, but attribute `// source:` to the IDL/spec they were generated from when available.
