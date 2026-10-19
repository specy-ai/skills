<!-- TEMPLATE — run build.sh to generate dist/architecture-extract-from-code/SKILL.md -->

---
name: architecture-extract-from-code
version: v1
description: "Input — a codebase, or several systems at once (several codebases or repositories, a monorepo of several deployable systems, or a set of single-system `.arch` files). Output — a `.arch` software-architecture model per system (plus a `.meta.json` and a notes report) and, when the input holds several systems, one level-0 `organization` file mapping the landscape. Reverse-engineers the software architecture from existing source — discovers containers and components, infers their provided/required interfaces and typed (Thrift-style) contracts, identifies async channels and external systems, wires connectors with protocol + interaction style, records a lightweight deployment view, and maps components back to domain modules where a `.domain` exists. Given several systems it also recovers level 0 — each system declared once and linked to its own file through `detailed-in` (or left a black box when it is a bought product), the directed dependencies between systems, and the numbered flows of domain concepts along each dependency, every fact backed by integration code or a cited document. Use this whenever the user wants to recover, reverse-engineer, extract, or document the architecture, the C4 container/component structure, the service topology, the API contracts, or the dependency/integration graph of an existing system, or the system landscape of several. Also trigger on \"draw the C4 model from the code\", \"what are the services and how do they talk?\", \"extract the architecture\", \"reverse-engineer the components and ports\", \"infer the interface contracts\", \"find the external integrations and message channels\", \"map our system landscape from the repos\", \"how do our systems depend on each other?\", \"which system masters this data?\", \"extract the integration flows between our applications\". This extracts an architecture MODEL, not a domain model: to recover business entities/aggregates/events use `domain-extract-from-code`; to recover testable EARS requirements use `sysreq-extract-from-code`; to design a `.arch` from a `.sysreq` + `.domain` rather than from code use `architecture-design`."
user-invocable: true
---

# Skill: architecture-extract-from-code

## Role

You are an expert software architect who reverse-engineers existing source code into Specy `.arch` software-architecture models. The metamodel is **C4-inspired** (System Context → Container → Component, with Code intentionally out of scope) and carries **Thrift-style typed contracts** (`struct`, `enum`, `typedef`, `union`, `exception` with field ordinals and `required`/`optional` markers), **ports + connectors** (each component/container `provides` and `requires` interfaces; connectors wire them with an explicit protocol and `sync`/`async`/`streaming` style), and **first-class async channels** (named topics on a broker container that `carries` message types).

You recover, from a codebase: the one **system** in focus and its surrounding **persons** and **external systems**; the **containers** (runnable/deployable units identified by a free-form technology string — apps, SPAs, databases, brokers, caches, jobs); the **components** inside them; the **interfaces** they provide/require and the **operations** of those interfaces with full typed signatures; the **named types** the contracts reference; the **channels** and the publish/subscribe wiring; the **connectors** that form the dependency graph (including edges to external systems); and a lightweight **deployment view** of environments and replicas.

When the input holds **several systems** — several codebases or repositories, a monorepo of several deployable systems, or a set of existing single-system `.arch` files — you also recover **level 0**, the organization's system landscape, in one `organization`-rooted file: each **system** declared once and linked to its own `.arch` through `detailed-in` (or left a **black box** when it is a bought product seen only through the integrations that call it), the directed **dependencies** between systems (`A -> B` reads "A depends on B"), and the numbered **flows** of domain concepts along each dependency. Level 0 obeys the same evidence discipline as the rest: a dependency, a flow, a pattern, a criticality, a mastered concept or a hotspot is written only when integration code or a document in the sources evidences it. A single codebase holding one system is extracted exactly as before — an `architecture`-rooted file, with no level-0 construct.

When a sibling `.domain` model exists, you **realize** the bridge: components `realizes module "…"`, interfaces optionally `realizes interface X`, channels `carries` imported domain events (`import event X from domain`), and struct fields reuse `import value type X from domain`. When a `.sysreq` exists, you attach `satisfies [REQ-…]` / `satisfies [NFR-…]` — NFRs in particular drive architecture, so attach them to the elements that address them.

You never invent structure that the code does not evidence. Uncertainty is recorded with `// NOTE:` and `// UNCLEAR:` markers, not papered over.

---

## Decision Tests

Before emitting any architecture element, run these 4 sequential tests. They keep the model evidence-based and at the right altitude (logical level 1–3, plus level 0 when the input holds several systems; level 4 / code is out of scope).

## Test 1 — "Is it real?"

> Can I point to a line of code, a build/deploy descriptor, or a config file that evidences this element?

- **Yes (production code / build file / IaC / config)** → proceed to Test 2.
- **Yes (only an integration/contract test or a wiremock stub)** → proceed, but annotate `// NOTE: evidenced by test ({test file})`. Contract tests and consumer-driven stubs are strong evidence for interface operations and external dependencies.
- **Yes (only a document in the sources — a runbook, an integration spec, an incident note, a roadmap)** → level 0 only: proceed for a manual flow, a hotspot, a phase, an area or a `used-by`, which leave no trace in code, and cite the document in the `// source:` comment. A prose document alone never evidences a container, a component, a port or an operation.
- **No** → **do not emit**. Never invent containers, components, ports, or operations absent from the code — nor, at level 0, dependencies, flows, patterns, criticality, mastered concepts or hotspots the sources do not evidence.

## Test 2 — "Is it architecture (a level 1–3 element)?"

> Does this belong in the logical container/component/interface/channel/connector model, or is it level-4 code detail / pure runtime plumbing?

- **Architecture** (a deployable unit, a responsibility grouping, a port, a contract, a topic, a dependency edge, an environment) → proceed to Test 3.
- **Level-4 / plumbing** (a single helper class, a DTO mapper, a logging filter, a serializer, a connection pool, a thread-pool tuning) → **omit**, or fold it into the nearest real element. Use `// NOTE: {detail} (level-4 / out of scope)` only if it would otherwise look missing.

### Grey-zone heuristic

If removing the thing would change the **topology** (a box disappears, an arrow disappears, a contract changes), it is architecture. If it only changes *how* one box does its job internally, it is level-4.

### Separate the transport mechanism from the contract

An HTTP framework, a serializer, a retry interceptor are transport mechanisms — they become the `over "<protocol>"` string and the `sync`/`async`/`streaming` style on a **connector**, not components of their own. The *capability* exposed across that transport is the **interface**.

### One system or several (level 0)

A **system** is what an organization funds, runs and replaces as one unit. Several deployables are **containers of one system** unless the sources say otherwise: services built, versioned and released together, sharing a data store or one product name, are one system — however many there are. They are **several systems** when the sources evidence it — separate repositories, or top-level applications of a monorepo that each have their own name, pipeline, release cycle and data store and reach each other only through published APIs, topics or files — or when the user designates them. Level-0 constructs exist only for several systems: one system never gets an `organization` file. When the evidence is mixed, ask during Phase 1 rather than split one system's services into a landscape.

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
| Level 0 — drawing a dependency along the call ("X's code calls Y's API, so X depends on Y") | The arrow is the direction of the *need*, not of the call: when X pushes records it masters into Y's API, it is Y that needs them | A feed — Y keeps X's records for its own work — is `dependency Y -> X`, flow in the default direction. Only when Y acts on X's behalf and X uses the outcome is it `dependency X -> Y`, flow `to Y` |
| Level 0 — a webhook read as "B calls A's endpoint, so B depends on A" | A obtains B's data, whoever opens the connection | `dependency A -> B`; the flow keeps the default direction (B to A) |
| Level 0 — one two-headed edge, or `Partnership`, for two systems that each need the other | It loses which side translates what, and `Partnership` is a statement about two teams, not a fact in code | Two dependencies, each with its own patterns and flows; report the pair as a *mutual dependency* |
| Level 0 — `masters X` on a system that keeps a table of X fed by another system | A local copy is not the system of record | `handles X`; the master is the system whose code creates X |
| Level 0 — `ACL` because a client DTO exists, or `Conformist` by default | A pattern is a claim about the code | No evidence, no pattern — leave it out |
| Level 0 — renumbering flows when the file is updated | Flow numbers are cited by hotspots, diagrams and people | Keep every number; a new flow takes a new number |

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
| A place containers run on — a cloud region, a cluster, a VM, a serverless runtime — named by IaC or manifests | `node name [provider "…"] [region "…"] [zone "…"] { … }` in the environment (nodes nest) |
| A provisioned database instance, topic, bucket, cache or secret store | `resource name [instantiates Container] [technology "…"] [tenancy shared\|dedicated] [{ stores … }]` on a node |
| Several systems of one organization and the dependencies between them (level 0) | `organization Name { … }` — the root of its own file |
| One of those systems, whose code was extracted | `system` in the organization file, with `detailed-in "<its file>.arch"` |
| One of those systems, a bought product seen only through the integrations that call it | `system … technology "<product>"` left a black box (no containers, no `detailed-in`) |
| A party outside the organization (a bank, a carrier, a tax authority) | `externalSystem` at organization scope |
| System A needs what system B holds or does — it obtains B's data, or asks B to act on its behalf | `dependency A -> B` |
| One integration along a dependency | `flow N "label" carries X [as Y] [to System] over "…" manual\|automated` |
| A main concept a system creates and owns the write model of / another main concept it stores or processes | `masters X` / `handles X` |
| An evidenced point of fragility or manual effort in operating a system | `hotspot Name :: "…" [concerns …]` |
| A reference to a domain module/interface/event/value type | `realizes …` / `import … from domain` |
| A reference to a system requirement / NFR addressed here | `satisfies [REQ-…]` / `satisfies [NFR-…]` |

---

## Output Conventions

- **Directory:** all generated files go into `specy/` at the project root.
- **Naming:** `{system}.arch` — system name in lowercase (e.g. `shortlink.arch`). One file per system in focus; a separate system is a separate file. Several systems add one organization file (see **Organization file** below).
- **Root:** wrap everything in `architecture Name :: "…" { … }`. Declare provenance immediately inside: `domain-source "…"` and/or `requirements-source "…"` when those files exist.
- **One system per `architecture` file:** persons and external systems sit at `architecture` scope; the single `system { … }` holds the types, interfaces, bounded contexts, containers, channels, connectors, and environments.
- **Encoding:** UTF-8, LF line endings, no trailing whitespace.
- **Naming conventions:**
  - `PascalCase` — `system`, `container`, `component`, `interface`, `person`, `externalSystem`, `boundedContext`, and every named type (`struct`, `enum`, `typedef`, `union`, `exception`).
  - `camelCase` — operation names, struct/union field names, enum members, channel names, environment, node and resource names.
  - Operation names are **technical identifiers** (`createLink`, `resolveSlug`) — not the business-language string labels the domain layer uses.
- **Primitives are lowercase:** `string`, `int`/`integer`, `long`, `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`. `void` is a return type only. Containers: `list<T>`, `set<T>`, `map<K, V>`.
- **Every named type carries explicit ordinals** on its fields/members, and `required`/`optional` on struct/exception fields and operation arguments.
- **Source traceability:** every container, component, interface, channel, connector, named type, node, and resource gets a `// source: path/to/file.ext` comment. For an element synthesised from many files, point at the most representative one. In an organization file, every system, dependency, flow and hotspot gets one too.
- **Order in file:** `architecture` → `domain-source` / `requirements-source` → `person`(s) → `externalSystem`(s) → `system {` → named types (typedef → enum → struct → union → exception → imports) → `interface`(s) → `boundedContext`(s) → `container`(s) (each with its `component`s) → `channel`(s) → `connect`(ors) → `environment`(s) → `}`. Use `// ===` section separators, matching the canonical example.
- **Ports vs connectors:** a `provides`/`requires`/`consumes` line declares a **port**; a `connect …` line **wires** two ports and carries the transport. Keep the transport on the connector, never inline on the port.
- **Async is first-class:** never draw a `sync` connector across a message broker. Model `channel name on Broker { carries Msg }` and have components `publishes Msg to name` / `subscribes name`.
- **Domain bridge (when a `.domain` exists):** prefer `realizes`/`import` over re-declaring concepts. Domain **modules and contexts are cited by their declared PascalCase name** (`realizes module LinkManagement`, `realizes context Ordering` — the name concept references qualify by in an organization file, as in `Ordering.Order`); the quoted form (`realizes module "Link Management"`) is accepted for readability and matched ignoring case and spaces, but prefer the bare name. Domain value types / events / interfaces are **PascalCase referenced bare** (`import value type Slug from domain`, `realizes event LinkCreated`, `realizes interface LinkCommands`). `realizes` is a header clause: it sits after `satisfies`, before the `{` of the element — never inside its body.
- **Requirement bridge (when a `.sysreq` exists):** attach `satisfies [REQ-…]` to the element that implements a functional requirement and `satisfies [NFR-…]` to the element that addresses an NFR (e.g. a cache container for a latency NFR, a broker for a decoupling/resilience NFR, replicas for an availability NFR).
- **Descriptions:** use `::` to attach a one-line description to any element; use it wherever the responsibility is not obvious from the name.
- **Metadata:** optional `meta { key = value }` blocks (e.g. `meta { repo = "services/api" }`, broker delivery semantics).
- **No invented contracts:** if an interface is observed to exist (a port is wired) but its operations/signatures cannot be read from the code, declare the interface with a `// UNCLEAR: contract not recoverable from {evidence}` note rather than fabricating operations.
- **Organization file (level 0 — only when the input holds several systems):**
  - **Name and place:** `{organization}.arch` — organization name in lowercase (e.g. `freshcrate.arch`), never the name of a system's file. It goes into the `specy/` of the directory that holds all the systems: the monorepo root, or the folder containing the repositories (ask when there is no such directory). Each system's own file stays where a single-system run puts it.
  - **Root:** `organization Name :: "…" { … }` — an alternative root, not a wrapper. The systems' files stay `architecture`-rooted and never contain a level-0 clause, a dependency or a phase. Declare one `domain-source "…"` per `.domain` file found (the clause may be repeated).
  - **Systems:** each system is declared **once**, named after its role in the organization (`Billing`, `CRM`), not after the product that implements it — the product goes in `technology "…"`. Every system states its purpose with `::`. A system whose code was extracted carries `detailed-in "<file>.arch"` — a path relative to the organization file — and the same name as the `system` of that file. The organization file is authoritative for the system's description, `realizes` and metadata: its own file need not repeat them and must not state them differently. The extraction never inlines levels 2–3 in the organization file.
  - **Peers keep their name:** in a system's own file, another system of the organization appears as an `externalSystem` under exactly the name it has in the organization file. In the organization file, `externalSystem` is reserved for parties outside the organization, and carries no `provides`/`consumes` there (interfaces live in the systems' files).
  - **Naming conventions:** `PascalCase` — `organization`, `area`, `phase`, `hotspot`, and concept references (`Invoice`, or `Finance.Invoice` when the bare name is ambiguous). Flow labels are business-language strings (`"Signed sales orders"`), not endpoint names; flow numbers are positive integers, unique in the file and permanent.
  - **Source traceability:** `// source:` on every system (its repository or root directory; for a black box, the client code that reveals it), every dependency and flow (the client, consumer, job or mapper of that integration; the document, for a manual flow) and every hotspot (the runbook, script or code comment it comes from).
  - **Order in file:** `organization` → `domain-source`(s) → `phase`(s) → `area`(s) → `person`(s) → `externalSystem`(s) → `system`(s) → `dependency`(ies), each with its flows in number order.
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
   - **One system or several?** Apply *One system or several (level 0)* from Test 2. Several codebases or repositories, a monorepo of several deployable systems, or a set of existing single-system `.arch` files make an **organization run**: list the systems, and run steps 3–7 once per system whose code is in the input. One system → a single-system run, unchanged.
   - In an organization run, sort every neighbour into three kinds: a **system to detail** (its code is in the input), a **black-box system** (a product the organization runs — its own tenant or instance of a CRM, an ERP, a billing product — seen only through the integrations that call it), or an **external system** (a party outside the organization: a bank, a carrier, a tax authority, a public API). The sources decide (tenant or instance configuration, administration scripts, documentation naming it as one of the organization's applications); when they do not, keep it an `externalSystem` and list it in the summary for the user to reclassify.
5. Locate the **architecturally significant code**: HTTP/RPC controllers and route tables, service/use-case classes, port interfaces/protocols, message producers/consumers, scheduled jobs, client gateways. In an organization run, also the **cross-system integration code** (clients and SDKs of another system, subscriptions to its topics or queues, webhook endpoints it calls, SFTP and file jobs, scheduled imports, a second datasource on its database, mappers between its types and ours) and the **documents** that describe integrations and operations (runbooks, integration specs, incident notes, roadmaps).
6. Check for sibling Specy artefacts: a `specy/*.domain` (→ set `domain-source`, enables `realizes`/`import`) and a `specy/*.sysreq` (→ set `requirements-source`, enables `satisfies`). In an organization run, also existing `specy/*.arch` files: a single-system file is reused as it is; an `organization`-rooted file makes the run an update.
7. Determine the project stack and load the matching heuristic file (see Extraction Heuristics).
8. Print reconnaissance summary:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework(s): {list}
   - System in focus: {name}
   - Scope: {single system | organization {name}: {n} systems to detail, {n} black boxes, {n} external systems}
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

Work top-down through the C4 levels. In an organization run, do steps 1–18 once per system to detail — one `architecture`-rooted file each; a system whose `.arch` already exists is read, not re-extracted — then build the organization file (**Level 0 — organization**, steps 19–27).

**Level 1 — context**

1. Emit `architecture Name :: "…" {` and the provenance decls (`domain-source`, `requirements-source`) when the sibling files exist.
2. Emit a `person` for each human role evidenced by the entry points (a public web UI → an end-user person; an admin console → an operator/admin person).
3. Emit an `externalSystem` for each opaque third party. List `provides` (an interface our code calls on it) and `consumes` (an interface of ours it reads). If the external system corresponds to a domain upstream context or external-event source, add `realizes context "…"` or `realizes event X`. In an organization run, a neighbour that is another system of the organization is still an `externalSystem` in this file — under exactly the name that system has in the organization file.

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

16. From IaC/compose/profiles, emit `environment name { deploy Container [replicas N], … }`. Omit if no placement evidence exists. Then add the **nodes** and **resources** the deployment evidence names, each with a `// source:` comment on the manifest or IaC file:
    - **Nodes** — where containers run. Kubernetes manifests and Helm values (the cluster a release targets: kubeconfig context, Argo CD `destination`, per-cluster values files), Terraform/CloudFormation/CDK provider and stack settings (`provider "aws" { region = … }`, a CDK stack's `env: { region }`, `availabilityZone`), serverless manifests (`provider.name`, `provider.region`), cloud provider configs (`AWS_REGION`, `GOOGLE_CLOUD_REGION`, an Azure `location`), a docker-compose project (one node). Nest a cluster in its region node; put each `deploy` in the node whose manifest places that container.
    - **`provider`, `region` and `zone` are extracted facts**: write one only when a file states it (a provider block, an environment variable, an endpoint hostname that embeds the region), never from a naming convention. When a manifest places a container but no file says where the cluster is, keep the node and leave the attribute out, with `// NOTE: region not stated in {file}`.
    - **Resources** — provisioned data stores and brokers in IaC or charts: `aws_db_instance` / `aws_rds_cluster`, `aws_s3_bucket`, `aws_msk_cluster`, `aws_elasticache_*`, `aws_secretsmanager_secret`, `google_sql_database_instance`, `azurerm_postgresql_flexible_server`, CloudFormation `AWS::RDS::DBInstance`, CDK `rds.DatabaseInstance`, a Helm release of a database or broker chart, a compose service built from a database image. `instantiates` names the data-store or broker container the application connects to (match the connection string or client config to the resource); `technology` is the engine and version the IaC states; `tenancy` only when the IaC or platform config says whether the instance serves this system alone (`dedicated`) or several (`shared`); `stores` only when persistence code (repositories, migrations, table mappings) unambiguously writes a record that matches a declared struct. A container a resource instantiates needs no `deploy` clause in that environment.

17. Write the `.arch` file.

18. Print extraction summary:
    ```
    ## Extraction — {system}
    Persons: {n} | External systems: {n}
    Containers: {n} | Components: {n} | Bounded contexts: {n}
    Interfaces: {n} | Operations (cmd/safe/oneway/streaming): {a}/{b}/{c}/{d}
    Types (struct/enum/typedef/union/exception): {…} | Domain imports: {n}
    Channels: {n} | Connectors (sync/async/streaming): {a}/{b}/{c}
    Environments: {n} | Nodes: {n} | Resources: {n}
    realizes links: {n} | satisfies links: {n} | UNCLEAR: {n}
    ```

**Level 0 — organization** (organization run only; a single-system run stops at step 18)

Build the organization file from the systems' files and the integration evidence gathered in Phase 1. What counts as evidence for each fact is in **Level-0 inference** (Extraction Heuristics); a fact without evidence is left out and listed in the notes, never guessed. The syntax to follow is the level-0 section of `grammars/architecture.ebnf` (`organizationDef` and the productions under it), summarized in the *Level 0 syntax* block of the metamodel reference.

19. **Root.** Emit `organization Name :: "…" {` and one `domain-source "…"` per `.domain` file found. The name is the organization's, as a `.domain` `organization`, a README or the user states it — ask rather than derive it from a repository name.
20. **Systems.** Declare each system once.
    - A **system to detail**: take the name, description, `realizes` and metadata of the `system` of its file — the two must never disagree — and add `detailed-in "<file>.arch"`. Add `realizes context X` only when a `domain-source` exists and the system's components realize modules of that context. No `technology` on a system built in-house: its technologies are on its containers.
    - A **black box**: name it after its role when the code or the documentation states one (a `crm` package, a `billing.base-url` key), put the product in `technology "…"`, and state as its purpose only what the integrations show. When only the product is known, name it after the product with `// NOTE: named after the product — role name to confirm`.
21. **Persons and external systems.** Declare at organization scope each `person` the systems' files connect to their system — one per population; merge the persons of two files only when the sources show the same role (the same IAM group, the same sign-in) — and each `externalSystem` that is outside the organization. Then, per system, `used-by` and `area` (see Level-0 inference); a system for which neither is evidenced has neither.
22. **Dependencies.** The direction is that of the **need**, not of the call: emit `dependency A -> B` when A needs what B holds or what B does.
    - **A obtains B's data** — whoever opens the connection. A pulls from B's API, reads B's files or database, subscribes to B's topic, serves the webhook B calls; or B's own connector or job pushes B's records into A's API, or drops them where A imports them; or a documented procedure has a person carry them into A. The receiver of the data depends on its source: `dependency A -> B`, flow in the default direction (B to A).
    - **A asks B to act on its behalf** — execute a payment, collect a signature, serve an ad, send a message, check an identity — and hands B what it needs for that: `dependency A -> B`, flow `to B`.
    - **Code in X calls Y's API with a payload — which of the two?** Ask whose job is being done. If the payload is records X masters and Y keeps them for its own work (the accounting system receives orders to invoice them), Y depends on X: `dependency Y -> X`, default direction, even though the calling code lives in X and is written against Y's API. If Y performs a function for X and X uses the outcome (a status, a result, an effect it waits for or polls), X depends on Y: `dependency X -> Y`, flow `to Y`. The evidence is what the caller does with the response, and whether the callee has a lifecycle of its own for what it received. When the code does not settle it, write the first — the receiver depends on the source — and list the dependency in the notes as *direction to confirm*.

    The coupling of the calling code to the callee's API is real, but it is level 2–3 information: it is the connector in the caller's file, and a dependency on that pair covers a connector in either direction. Emit one dependency per ordered pair of systems: all the exchanges that answer A's need of B are its flows. Two systems that each need the other get **two** dependencies, never one two-headed edge. Either end may be an external system; at least one end is a system of the organization.
23. **Flows.** Inside each dependency, one `flow` per integration — one business exchange, in one direction, over one mechanism; split when any of the three differs, and do not emit one flow per endpoint:
    - **label** — the exchange in business language (`"Confirmed orders"`);
    - **`carries`** — the concepts the payload types represent, named in the sender's model: resolved through the `domain-source` when one exists (qualify `Context.Concept` when the bare name is ambiguous), plain `PascalCase` names otherwise. A name the domain sources do not hold stays, acknowledged on the line directly above by `// NOTE: {X} — no domain element in {domain-source}`;
    - **`as`** — only when code on either side visibly turns the sender's concept into a different concept of the receiver (a mapper, an adapter, an anti-corruption layer): `carries Order as Shipment`;
    - **`to`** — data goes from B (upstream) to A (downstream) by default. Write `to B` only when A, the downstream system, hands B what B needs to act on A's behalf (step 22, second case); a flow that feeds A never carries `to`;
    - **mechanism** — `over "<medium>"`, then `automated` (code or a scheduler performs the transfer) or `manual` (a person does, per the cited document). It is stated once — an extraction describes what runs today — or per phase when a roadmap document in the sources names phases (step 26). The interaction style and the interface stay on the connectors, not on the flow;
    - **number** — at creation, number the flows 1…n in file order; from then on numbers are permanent (see Update Modes). In the systems' files, mark each connector that realizes an automated flow with a `// realizes flow N` comment above it.
24. **Patterns and criticality** on each dependency — only with evidence (Level-0 inference); otherwise the dependency states none. Never write `Partnership`. No pattern on a dependency between two systems that realize the same bounded context.
25. **`masters` / `handles`** on each system — its main concepts only: the handful that explain the system, not an inventory of its tables.
26. **Hotspots** — only what the sources evidence, each citing its source — and **phases**, only when a roadmap document in the sources names them.
27. Write `{organization}.arch` and print the level-0 summary:
    ```
    ## Extraction — organization {name}
    Systems: {n} ({n} detailed, {n} black boxes) | External systems: {n} | Persons: {n}
    Dependencies: {n} ({n} mutual pairs, {n} with direction to confirm) | Flows (automated/manual): {a}/{b}
    Patterns stated on: {n}/{n} dependencies | Criticality stated on: {n}/{n}
    Concepts mastered: {n} | handled: {n} | unresolved (// NOTE): {n}
    Hotspots: {n} | Areas: {n} | Phases: {n} | UNCLEAR: {n}
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
9. Every `deploy`, directly under an environment or inside a node, targets a declared container; every `instantiates` names a declared data-store or broker container; every `stores` names a declared struct (or a struct of the system's `.dataop`); every node and resource carries a `// source:`.
10. Every `realizes` reference uses the correct citation form: **module/context → the declared PascalCase name** (`realizes module LinkManagement`, `realizes context Ordering`; a quoted `"Link Management"` is accepted and matched ignoring case and spaces); **interface/event/value type → bare PascalCase**. Every `realizes` sits in the element's header, before `{`. When `domain-source` is set, the referenced names should plausibly exist in that `.domain`; flag misses with `// NOTE: domain target {X} not found in {domain-source}`.
11. Every `satisfies [REQ-…]`/`[NFR-…]` id is well-formed; when `requirements-source` is set, flag ids absent from the `.sysreq` with `// NOTE`.
12. No `sync` connector crosses a broker (should be a channel); no database modelled as a component.
13. **Organization run — level 0.** Check the organization file against the systems' files and the domain sources:
    - every connector of a detailed system that has another system of the organization at its other end is covered by a `dependency` on that pair, in either direction — an uncovered connector is a missing dependency;
    - every `automated` flow with a detailed system at one end is realized by at least one such connector, marked `// realizes flow N` (when the integration is only a shared topic, add the `async` connector that names the peer); a `manual` flow has none;
    - at most one `dependency` per ordered pair of systems, and none from a system to itself; every mutual pair is two dependencies and is listed in the notes as a *mutual dependency*; no `Partnership` was written;
    - flow numbers are unique in the file, and none was renumbered or reused; `to` names an end of its dependency; a hotspot's `concerns` names only flows that have its system at one end;
    - a concept is mastered by at most one system, external systems included. Two systems that both evidence a write model for the same concept keep both `masters`, each with `// UNCLEAR: {X} has two systems of record ({A}, {B})`; homonyms are told apart by qualifying them (`Sales.Account`, `Treasury.Account`), which needs a domain source — without one, two `masters` of the same name are reported as one concept with two masters;
    - the sender of every flow holds what it sends: it masters or handles it, receives it through another flow, or finds it in a context it realizes;
    - a `Conformist` dependency has no `as` on the flows its downstream system receives; a dependency between two systems that realize the same bounded context has no pattern;
    - every `detailed-in` path resolves to a file whose `system` has the same name and states no different description, `realizes` or metadata; every peer named as an `externalSystem` in a system's file bears its organization name; the persons connected to a detailed system are its `used-by`, and conversely;
    - every system states a purpose; every concept name the domain sources do not resolve carries a `// NOTE:`; every system, dependency, flow and hotspot carries a `// source:`;
    - when a domain source declares a context map between the contexts two systems realize, compare it with the dependency's direction and patterns and **report** any disagreement in the notes — never copy a pattern from the map, never bend the dependency to it: the map is the design, the dependency is what the code does.
14. Fix obvious errors. For genuine ambiguity → `// UNCLEAR`.
15. Write `specy/architecture.notes.md`:
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
    | Systems and their boundaries (level 0) | … | {separate repositories / pipelines / user-designated} |
    | Dependencies and flows (level 0) | … | {integration code / documents} |

    ## Unwired ports & missing providers
    {list of // UNCLEAR required-port issues}

    ## Domain & requirement traceability
    Components with realizes: {n}/{n}
    Elements with satisfies: {n}
    Unresolved realizes/satisfies targets: {list}

    ## Level 0 — organization (organization run only)
    Mutual dependencies: {pairs — two dependencies each; whether it is a Partnership is for the teams to say}
    Directions to confirm: {dependencies where the code does not settle whose need the exchange answers — written receiver-depends-on-source}
    Statements to confirm: {each pattern, criticality and masters written, with its evidence}
    Left out for lack of evidence: {areas, used-by, patterns, criticality, masters — per system or dependency}
    Connectors without a dependency / automated flows without a connector: {list}
    Context-map disagreements: {dependency vs the map of its domain source}
    Cycles of more than two dependencies: {list}

    ## Architectural observations (non-binding)
    {e.g. cyclic dependency between A and B; sync call across a context boundary that
     an NFR says should be async; a god-component; a missing anti-corruption layer.}

    ## Residual UNCLEAR markers
    ### {pattern} ({n} occurrences}
    {Why it could not be recovered faithfully.}
    ```
16. Print validation summary:
    ```
    ## Validation Summary
    Types resolved: {n}/{n} | Ports wired: {n}/{n} | Connector endpoints: {n}/{n}
    Channels: {n}/{n} | Environments: {n}/{n} | Ordinals unique: yes/no
    realizes resolved: {n}/{n} | satisfies well-formed: {n}/{n} | Corrected: {n} | UNCLEAR: {n}
    Level 0 (organization run): Connectors covered: {n}/{n} | Automated flows realized: {n}/{n}
      Flow numbers unique: yes/no | Concepts with two masters: {n} | Mutual pairs: {n}
    Files written: {list}
    ```

---

## Creation Mode

When no `specy/*.arch` files exist:

1. Create `specy/` if absent.
2. Execute Phases 1–3.
3. Write `{system}.arch`, `architecture.notes.md`, and `specy/.arch.meta.json` (see Meta File).

**Organization run.** Step 2 writes one `{system}.arch` per system to detail, then `{organization}.arch`. Existing single-system `.arch` files — the input itself, or systems extracted earlier — are reused as they are: only the organization file is created, and whatever it needs changed in them (a peer `externalSystem` to rename, a `// realizes flow N` comment, a description that disagrees with the organization's) is presented as a proposed change first. When an `organization`-rooted file already exists, the run is an update (see Update Modes).

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

An organization run writes the file beside the organization file, replaces `system` with an `organization` block, and maps integration code and documents to the level-0 definitions they evidence:

```json
{
  "version": 1,
  "lastRun": "2025-01-15T10:30:00Z",
  "gitSha": "abc1234def5678",
  "organization": {
    "name": "FreshCrate",
    "file": "freshcrate.arch",
    "systems": {
      "Storefront": { "detailedIn": "storefront.arch", "root": "apps/storefront", "gitSha": "abc1234def5678" },
      "Fulfilment": { "detailedIn": "fulfilment.arch", "root": "apps/fulfilment", "gitSha": "abc1234def5678" },
      "Accounting": { "detailedIn": null }
    },
    "counts": { "systems": 3, "detailed": 2, "blackBoxes": 1, "dependencies": 4, "flows": 6 },
    "lastFlowNumber": 6
  },
  "filemap": {
    "apps/fulfilment/src/.../orders/OrderConfirmedConsumer.java": ["dependency Fulfilment -> Storefront", "flow 1"],
    "apps/storefront/src/accounting/xero-invoice.mapper.ts": ["dependency Accounting -> Storefront", "flow 3"],
    "docs/runbooks/refunds.md": ["flow 4", "hotspot InvoiceReconciliation"]
  }
}
```

- **`organization.systems`** — each system of the organization file: the file that details it (`null` for a black box), the root directory of its code, and the HEAD SHA of that code at the time of the run — one per system, since the systems may live in separate repositories.
- **`organization.counts`** — systems (detailed and black boxes), dependencies and flows in the organization file.
- **`organization.lastFlowNumber`** — the highest flow number ever assigned, retired flows included; the next new flow takes `lastFlowNumber + 1`.
- When the systems share one `specy/` (a monorepo), their own filemap entries live in this same file, each definition prefixed with its system (`"Storefront: component Checkout"`).

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
   | System (level 0) | its level-0 clauses | the dependencies that have it at one end, and their flows | hotspots that concern those flows; its own file when `detailed-in` |
   | Dependency (`A -> B`) | the dependency, its patterns and criticality | its flows | hotspots that concern them; the connectors that realize them |
   | Flow (by number) | the flow, under the same number | — | hotspots that concern it; the connector that realizes it |

3. Scoped extraction → scoped validation → update only affected filemap entries (do not move `gitSha`/`lastRun`).

### Organization File (level 0)

The three modes apply to an organization file, with these additions:

- **Flow numbers are permanent.** Never renumber an existing flow, even when flows are reordered or a dependency is rewritten. A new flow takes the next number above `lastFlowNumber` (meta file) and above every number in the file. A flow whose integration is gone is proposed for removal; once confirmed, its number is retired and a comment keeps the trace: `// Flow 19 (salary advances) was retired: numbers are never reused.`
- **Match before adding.** An integration found in code is an existing flow when it joins the same two systems and carries the same concepts in the same direction: a changed mechanism (`"SFTP file"` → `"REST/JSON"`, `manual` → `automated`) modifies that flow, it does not create a new one.
- **Keep what a person wrote.** An organization file is usually completed by hand with statements code cannot show — areas, `used-by`, phases and per-phase mechanisms, `Partnership`, `CS`, a criticality, the `masters` of a black box, hotspots, descriptions, an inline detail. An update never removes or rewrites them for lack of code evidence. When the code contradicts one (a `Conformist` dependency whose downstream now maps the payload, a `masters` on a system that only stores a copy), report it in the notes and propose the change; never apply it silently.
- **Targeted mode** accepts a system, a dependency (`A -> B`) or a flow number (last three rows of the table above).
- **Incremental mode** diffs each system from the `gitSha` recorded for it in `organization.systems`; a system whose SHA is unreachable falls back to a full update of that system alone. **Topology cascade:** a connector added, removed or re-targeted across a system boundary re-evaluates the dependency and the flows of that pair; a system added or removed re-evaluates every dependency that has it at one end.
- **Present level-0 changes like the others**, citing flows by number:
  ```
  ## Proposed Changes — freshcrate.arch
  ### Added
  - flow 7 "Delivery slots" carries DeliverySlot over "REST/JSON" automated   (dependency Storefront -> Fulfilment)
  ### Modified
  - flow 4: mechanism "double entry" manual -> "Xero Accounting API" automated
  ### Removed (pending confirmation)
  - flow 2 "Shipment tracking" (tracking client deleted) — number 2 would be retired
  ### Reported, not applied
  - dependency Storefront -> Fulfilment is `Conformist`, but a mapper now translates Shipment
  ```

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

**Deployment inference.** Profiles/compose/k8s/Helm → `environment`s and `deploy … replicas N`. Kubernetes cluster targets, Terraform/CloudFormation/CDK provider and stack settings, serverless manifests and cloud provider configs → `node`s, with the `provider` / `region` / `zone` a file states; managed databases, topics, buckets, caches and secret stores declared in IaC or charts → `resource`s on those nodes (see Phase 2, step 16).

**Domain & requirement bridges.** If `specy/*.domain` exists: align components to modules (`realizes module "…"`), reuse value types and events via `import … from domain`, and link interfaces to domain interfaces. If `specy/*.sysreq` exists: attach `satisfies [REQ-…]`/`[NFR-…]`, putting NFRs on the elements that address them (cache → latency, broker/replicas → resilience/availability, ACL component → integration NFR).

**Level-0 inference (organization runs only).** Each row is the evidence a level-0 fact needs; without it the fact is left out and listed in the notes. `A -> B` reads "A depends on B": A needs what B holds or what B does — the direction of the need, not of the call (Phase 2, step 22). Each flow states the direction of its own data: from B to A by default, `to B` when A hands B what B needs to act for it.

| Source evidence | Level-0 inference |
|---|---|
| A's code reads from B — it pulls from B's API or SDK (HTTP / gRPC client, generated stub, vendor SDK) | `dependency A -> B`; a flow in the default direction, `over "<protocol or API>" automated` |
| A subscribes to a topic or queue B publishes, or serves the webhook B calls | `dependency A -> B` (A obtains B's data, whoever opens the connection); a flow in the default direction, `over "<topic or webhook>" automated` |
| B's code, connector or job pushes records B masters into A's API, and A keeps them for its own work | `dependency A -> B` — the receiver depends on the source, although the calling code is B's; a flow in the default direction, `over "<A's API>" automated` |
| A's code calls B's API so that B acts on A's behalf (a payment, a signature, a delivery, a message, an identity check), and A uses the outcome — a status, a result, an effect it waits for or polls | `dependency A -> B`; a flow `to B` carrying what A hands over, `over "<protocol or API>" automated` |
| A call that sends a payload, where the code settles neither of the two readings above | the receiver depends on the source (third row); list the dependency in the notes as *direction to confirm* |
| A fetches the files B drops (SFTP, bucket, shared folder), or runs a scheduled import of B's export | `dependency A -> B`; a flow `over "SFTP file"` / `over "scheduled import"`, `automated` |
| A reads B's database (a second datasource, cross-schema SQL, a database link) | `dependency A -> B`; a flow `over "shared database" automated`; record the coupling as an observation |
| A runbook or documented procedure has a person export from B and import or re-key into A | `dependency A -> B`; a flow `over "<what the document names>" manual`, with the document as `// source:` |
| A connector of a system's `.arch` with a peer system at its other end | a dependency on that pair, in the direction of the need — not necessarily the connector's: a read or a subscription makes the consumer depend on the provider; a call that delivers the consumer's own records makes the provider depend on the consumer; a call that has the provider act for the consumer makes the consumer depend on it, with a flow `to` the provider. One flow per business exchange of the wired interface |
| The payload type of an integration (`OrderDto`, `InvoiceMessage`) | the concept the flow `carries`: the domain element it represents when a `domain-source` exists, else the plain name without its technical suffix (`Order`) |
| A mapper, an adapter or an anti-corruption layer turns the sender's type into a different type of the receiver | `carries X as Y` on that flow |
| A translation layer of its own in A, the downstream system, keeps B's model out of A's core | `ACL` (A's side). A mapper in B, the upstream system, that shapes what B pushes for A shows as `as` only: it is not A's `ACL` |
| B's types — generated client models, B's shared library — are used as they are in A's core and persistence | `Conformist` (A's side); no `as` on the flows A receives |
| B publishes one versioned API or schema for all its consumers (OpenAPI / proto / AsyncAPI, `/v2/` paths, a public developer API) | `OHS` (B's side) |
| The exchanged format is a standard or a schema owned by neither side (ISO 20022, EDIFACT, HL7 FHIR, an industry schema) | `PublishedLanguage` |
| A, the downstream system, calls B synchronously with no fallback, on a path every use of A goes through (sign-in, a start-up or readiness check, the main transaction) | `criticality critical` |
| A wraps its call to B in a circuit breaker, a fallback or a feature switch, with a degraded path in code | `criticality degraded` |
| A queue, an outbox or a scheduled batch buffers what A takes from B, and nothing user-facing in A waits on B | `criticality tolerant` |
| A's code creates X and owns its write model (a create command or endpoint, the owning table and its migrations) | `masters X` on A — entities and aggregates only; also when A makes its own X out of what a flow brings (`carries Account as Customer`) |
| A stores or processes a main concept it does not create — a copy fed by a flow, a read model, a document it receives and works on | `handles X` on A |
| A `.domain` read-only entity X is `sourced-from` a black box or an external system | `masters X` on that system |
| A black box sends X and nothing shows where X is created | `handles X` on it, with `// NOTE: system of record of {X} not evidenced` (an external system takes no `handles`: write nothing and list it in the notes) |
| A runbook, an incident note, a `TODO` / `FIXME` on integration code, a manual re-sync job, a retry or reconciliation script | `hotspot Name :: "<what the source says>" concerns <flow numbers, concepts>` on the system whose sources hold it |
| A roadmap document that names integration phases | `phase` declarations, and the per-phase mechanism form on the flows it covers |
| Documentation that groups the systems by department or business area | `area` declarations, and each system's `area` |
| Access configuration (SSO application assignments, role or group mappings) or documentation naming who works with a system | `person` + `used-by`; for a detailed system, exactly the persons its own file connects to it |

What no code evidences stays out: `CS`, `SharedKernel` and `Partnership` are statements about how two teams work together, and two systems that depend on each other are two dependencies plus a *mutual dependency* line in the notes. **Criticality** says what happens to A, the downstream system, when B is unavailable, so only resilience code in A evidences it — a fallback around an upstream system's push says nothing about this dependency. It qualifies the whole dependency: write `critical` as soon as one of its flows evidences it, `degraded` or `tolerant` only when every flow of the dependency is evidenced; otherwise it stays unstated, which is not `tolerant`. Every pattern, criticality and `masters` you do write is listed in the notes as a statement to confirm: the code shows how the systems are wired, the business says who owns what.

### Stack-specific heuristics

| Detection signal | File |
|---|---|
| `.java`, `pom.xml`, `build.gradle`, `@SpringBootApplication`, `@RestController` | Read `heuristics/java-spring.md` |
| `.ts`/`.tsx`, `package.json` + `@nestjs/*`, `tsconfig.json` | Read `heuristics/typescript-nestjs.md` |
| `.clj`/`.cljs`, `deps.edn`, `project.clj`, Ring/Pedestal/reitit | Read `heuristics/clojure.md` |

Each file ends with the stack's cues for cross-system integration, used by organization runs. If no specific stack is detected, rely on generic heuristics only. Annotate non-obvious mappings with `// NOTE: inferred from {pattern}`.

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
  component LinkController :: "HTTP edge for link lifecycle" satisfies [REQ-LNK-001]
      realizes module "Link Management" {   // header clause, never in the body; quoted form of module LinkManagement (bare name preferred)
    boundedContext LinkManagement
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

// source: k8s/prod/*.yaml, infra/terraform/main.tf
environment production :: "Production deployment" {
  // source: infra/terraform/main.tf (provider "aws", region = "eu-west-1")
  node euWest provider "AWS" region "eu-west-1" {
    // source: infra/terraform/eks.tf (aws_eks_cluster.prod)
    node prodCluster :: "EKS workload cluster" {
      deploy Api replicas 3              // source: k8s/prod/api.yaml (replicas: 3)
      deploy SlugService replicas 2      // source: k8s/prod/slug.yaml
    }
    // source: infra/terraform/rds.tf (aws_db_instance.links, engine_version "16")
    resource linkDb instantiates LinkDb technology "PostgreSQL 16" tenancy dedicated {
      stores ShortLinkDTO                // source: services/api/.../LinkRepository.java
    }
  }
  deploy EventBus                        // NOTE: no node evidence — placement unstated
}
```

### Organization level (level 0 — several systems only)

```specy
organization FreshCrate :: "A meal-kit company delivering weekly recipe boxes" {
  domain-source "freshcrate.domain"     // one per .domain file; concept names resolve against them
  // then: persons, external systems, systems, dependencies
}
```

Systems — each declared once, level-0 clauses only:

```specy
person Subscribers :: "Households subscribed to a weekly box"

externalSystem Carrier :: "Parcel carrier" {      // outside the organization
  masters Parcel
}

// a system whose code was extracted: detailed in its own file
system Storefront :: "Sells subscriptions and takes the weekly box orders" realizes context Ordering {
  used-by Subscribers
  masters Subscription, Order, Refund   // system of record: created and written here
  handles Shipment                      // another main concept it holds; Context.Concept when ambiguous
  hotspot InvoiceReconciliation :: "A weekly script re-pushes the orders the accounting API rejected"
      concerns 3, 4                     // flow numbers and/or concepts
  detailed-in "storefront.arch"         // relative to this file; its system bears the same name
}

// a bought product seen only through the integrations that call it: a black box
system Accounting :: "Keeps the books" technology "Xero"
```

Dependencies and flows — `A -> B` reads "A depends on B", the direction of the need; patterns, then criticality, both optional:

```specy
dependency Storefront -> Fulfilment : Conformist criticality degraded
    :: "Subscribers follow their box with the warehouse's shipment status" {
  flow 2 "Shipment tracking" carries Shipment over "REST/JSON" automated   // data goes from B to A by default
}

dependency Accounting -> Storefront {              // no pattern, no criticality: none evidenced
  // `as`: the sender's concept becomes another one in the receiver
  flow 3 "Orders to invoice" carries Order as Invoice over "Xero Accounting API" automated
  flow 4 "Refunds to book" carries Refund over "double entry" manual
}

dependency Fulfilment -> Carrier : ACL, OHS {
  // `to`: A, the downstream system, hands B what B needs to act on A's behalf
  flow 5 "Label requests" carries Shipment as Parcel to Carrier over "carrier REST API v3" automated
}
```

Members written only when a document in the sources names them:

```specy
phase Phase1 :: "Refunds re-keyed by hand"
phase Phase2 :: "Refunds pushed through the accounting API"
area  CustomerCare :: "Subscriber support and refunds"   // then `area CustomerCare` in each system it groups

dependency Accounting -> Storefront {
  flow 4 "Refunds to book" carries Refund {     // per-phase mechanisms
    phase Phase1 over "double entry" manual
    phase Phase2 over "Xero Accounting API" automated
  }
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
| module | `realizes module LinkManagement` — its declared PascalCase name; `realizes module "Link Management"` is accepted (matched ignoring case and spaces), the bare name preferred |
| context | `realizes context ClickAnalytics` — same rule; the quoted `"Click Analytics"` is accepted |
| interface | `realizes interface LinkCommands` (bare PascalCase) |
| event | `realizes event LinkCreated` / `import event LinkCreated from domain` |
| value type | `import value type Slug from domain` (bare PascalCase) |
| context, on a system of an organization (level 0) | `realizes context Ordering` — the context's name as the `.domain` writes it; concept references qualify by it (`Ordering.Order`) |

**Level-0 dependency patterns** (`dependency A -> B : …` — at most one downstream pattern, `OHS`, and one shared pattern)

| Pattern | Side | An extraction writes it |
|---|---|---|
| `ACL` | downstream (A) | when A holds a translation layer of its own for B's model |
| `Conformist` | downstream (A) | when A uses B's types as they are; the flows A receives then carry no `as` |
| `CS` | downstream (A) | never — code does not show a customer–supplier agreement |
| `OHS` | upstream (B) | when B publishes one versioned API or schema for all its consumers |
| `PublishedLanguage` | both | when the exchanged schema is owned by neither side |
| `SharedKernel` | both | never from code alone |
| `Partnership` | both — on both dependencies of a mutual pair, excluding `CS`, `Conformist`, `ACL`, `OHS` | never — report the *mutual dependency* |

**Level-0 criticality** (`criticality …`, after the patterns)

| Criticality | If B is down |
|---|---|
| `critical` | A is down |
| `degraded` | A keeps running with reduced service |
| `tolerant` | no user-visible impact |
| *(absent)* | unstated — nobody has said yet; not the same as `tolerant` |

**Primitive types** (lowercase): `string`, `int`/`integer`, `long`, `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`. `void` (return-only). Containers: `list<T>`, `set<T>`, `map<K, V>`.

### `// UNCLEAR` and `// NOTE` markers

| Marker | When to use |
|---|---|
| `// UNCLEAR: description` | Architecturally significant fact that cannot be recovered faithfully — an unwired required port, an unrecoverable interface contract, an ambiguous interaction style, a concept with two systems of record. |
| `// NOTE: description` | A level-4 detail folded out, an inference basis, or an unresolved realizes/satisfies target. At level 0: a concept name the domain sources do not resolve (on the line directly above its use, or on the same line), a black box named after its product, a system of record that is not evidenced. |

---

## Syntax Reference

Load these during Phase 1 to calibrate:

| Artefact | File |
|---|---|
| `.arch` grammar (ISO-14977 EBNF) | Read `grammars/architecture.ebnf` |
| Software-architecture metamodel (prose, C4/domain mapping) | Read `references/SOFTWARE-ARCHITECTURE-METAMODEL.md` |
| Level 0, for an organization run (concepts, syntax, checks) | Read the section *Level 0 — Organization* of `references/SOFTWARE-ARCHITECTURE-METAMODEL.md`, down to *Level 0 syntax* and *Checks enabled by level 0* |

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
      component LinkController :: "HTTP edge for link lifecycle" satisfies [REQ-LNK-001]
          realizes module "Link Management" {
        boundedContext LinkManagement
        provides LinkCommands
        provides LinkQueries
        requires SlugAllocation
        publishes LinkCreated to events
      }

      // source: services/api/src/main/java/.../ClickCollector.java
      component ClickCollector :: "Captures and forwards click events" satisfies [REQ-CLK-002]
          realizes module "Click Analytics" {
        boundedContext ClickAnalytics
        provides ClickExport
        subscribes events
        publishes ClickRecorded to events
      }
    }

    // source: services/slug/Dockerfile
    container SlugService :: "Slug allocation service" technology "Java/Spring Boot" {
      // source: services/slug/src/main/java/.../SlugAllocator.java
      component SlugAllocator :: "Allocates and guarantees unique slugs" satisfies [NFR-PERF-001]
          realizes module "Link Management" {
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

### freshcrate.arch (organization file — several systems only)

A different input: a monorepo holding two systems built in-house (`apps/storefront`, `apps/fulfilment` — each with its own pipeline, release cycle and database), which integrate with a bought accounting product and with a carrier outside the organization. `storefront.arch` and `fulfilment.arch` are `architecture`-rooted files like the one above; this file adds level 0.

```specy
// source: README.md (the company and its two applications), .github/workflows/*.yml (one pipeline each)
organization FreshCrate :: "A meal-kit company delivering weekly recipe boxes to subscribers" {

  domain-source "freshcrate.domain"

  // No phase, no area: no document in the sources names any (listed in architecture.notes.md).

  // source: storefront.arch (person Subscribers)
  person Subscribers    :: "Households subscribed to a weekly box"
  // source: fulfilment.arch (person WarehouseStaff)
  person WarehouseStaff :: "Pickers, packers and dispatchers"

  // Outside the organization. Parcel is a read-only entity of Shipping, sourced-from Carrier.
  // source: apps/fulfilment/src/main/java/.../carrier/CarrierClient.java
  externalSystem Carrier :: "Parcel carrier: prints labels, collects and delivers the boxes" {
    masters Parcel
  }

  // =============================================================================
  // Systems — each declared once; an extracted system points at its own file
  // =============================================================================

  // source: apps/storefront (package.json, .github/workflows/storefront.yml)
  system Storefront :: "Sells subscriptions and takes the weekly box orders"
      realizes context Ordering {
    used-by Subscribers
    masters Subscription, Order, Refund   // created and written in apps/storefront/src/{subscriptions,orders,refunds}
    handles Shipment                      // a local copy fed by flow 2: handled, not mastered
    // source: apps/storefront/scripts/reconcile-invoices.ts, docs/runbooks/refunds.md
    hotspot InvoiceReconciliation
        :: "A weekly script re-pushes the orders the accounting API rejected; refunds are re-keyed by hand"
        concerns 3, 4
    detailed-in "storefront.arch"
  }

  // source: apps/fulfilment (pom.xml, .github/workflows/fulfilment.yml)
  system Fulfilment :: "Plans, packs and ships the weekly boxes"
      realizes context Shipping {
    used-by WarehouseStaff
    masters Shipment                      // made here out of each confirmed order (flow 1)
    handles Parcel                        // the carrier's parcels, fed by flow 6
    detailed-in "fulfilment.arch"
  }

  // A bought product seen only through the storefront's integration: a black box.
  // Its users and what it masters are not evidenced: left out, listed in the notes.
  // source: apps/storefront/src/accounting/xero.client.ts
  system Accounting :: "Keeps the books: receives each order to invoice it, and each refund"
      technology "Xero"

  // =============================================================================
  // Dependencies — `A -> B` reads "A depends on B": the direction of the need, not of
  // the call. Data goes from B to A unless the flow says `to`.
  // =============================================================================

  // Storefront and Fulfilment depend on each other: a mutual dependency, kept as two dependencies.

  // The warehouse needs the storefront's confirmed orders. ACL: its OrderTranslator turns each
  // Order into a Shipment. tolerant: the topic buffers while the storefront is down.
  // source: apps/fulfilment/src/main/java/.../orders/OrderConfirmedConsumer.java
  dependency Fulfilment -> Storefront : ACL criticality tolerant {
    // source: apps/fulfilment/src/main/java/.../orders/OrderTranslator.java
    flow 1 "Confirmed orders" carries Order as Shipment over "Kafka topic orders.confirmed" automated
  }

  // The storefront needs the warehouse's shipment status. Conformist: the generated client's
  // Shipment type is used as it is. degraded: a circuit breaker falls back to "tracking unavailable".
  // source: apps/storefront/src/fulfilment/tracking.client.ts
  dependency Storefront -> Fulfilment : Conformist criticality degraded {
    // source: apps/storefront/src/fulfilment/tracking.client.ts
    flow 2 "Shipment tracking" carries Shipment over "REST/JSON" automated
  }

  // The calling code is the storefront's, but the need is accounting's: it keeps the orders to
  // invoice them, and the storefront does nothing with the response. The receiver depends on the
  // source: default direction, no `to`. No pattern: the mapper sits in the storefront, the upstream
  // side, and shows as `as`. No criticality: nothing shows what accounting does without the storefront.
  // source: apps/storefront/src/accounting/xero.client.ts
  dependency Accounting -> Storefront {
    // source: apps/storefront/src/accounting/xero-invoice.mapper.ts
    // NOTE: Invoice — the accounting product's own concept; no domain element in freshcrate.domain
    flow 3 "Orders to invoice" carries Order as Invoice over "Xero Accounting API" automated
    // A person re-keys each refund into the accounting product: no code, the runbook is the evidence.
    // source: docs/runbooks/refunds.md
    flow 4 "Refunds to book" carries Refund over "double entry" manual
  }

  // The warehouse asks the carrier to act for it — label, collect, deliver — and hands it the
  // shipment: `to Carrier`. ACL: the carrier package maps Shipment to the carrier's Parcel.
  // OHS: the carrier's public, versioned API (vendored OpenAPI document).
  // source: apps/fulfilment/src/main/resources/carrier-openapi-v3.yaml
  dependency Fulfilment -> Carrier : ACL, OHS {
    // source: apps/fulfilment/src/main/java/.../carrier/CarrierClient.java
    flow 5 "Label requests" carries Shipment as Parcel to Carrier over "carrier REST API v3" automated
    // The carrier calls our webhook; the warehouse obtains the carrier's data: default direction.
    // source: apps/fulfilment/src/main/java/.../carrier/TrackingWebhookController.java
    flow 6 "Tracking updates" carries Parcel over "carrier tracking webhook" automated
  }

} // organization FreshCrate
```

In `storefront.arch` and `fulfilment.arch`, the peers appear as `externalSystem Fulfilment`, `externalSystem Accounting`, `externalSystem Storefront` and `externalSystem Carrier` — the same names as here — and the connectors that reach them are marked `// realizes flow N` for flows 1, 2, 3, 5 and 6. Flow 4 is manual: no connector realizes it. The connector that realizes flow 3 runs from the storefront to accounting — the direction of the call, opposite to the dependency; a dependency on the pair covers a connector in either direction.

---

## Output Checklist

Before writing final files, verify each item. If any fails, fix it.

- [ ] Exactly one `system { }` in each `architecture`-rooted file; persons and external systems at `architecture` scope
- [ ] `domain-source` / `requirements-source` declared when those sibling files exist
- [ ] `PascalCase` for system/container/component/interface/person/externalSystem/boundedContext and all named types
- [ ] `camelCase` for operation names, field/member names, channel names, environment, node and resource names
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
- [ ] Every `deploy` (under an environment or a node) targets a declared container; every `instantiates` names a declared data-store/broker container; every `stores` names a declared struct
- [ ] `provider` / `region` / `zone` written only where a file states them; nodes and resources only where IaC or manifests evidence them
- [ ] `realizes` cites modules/contexts by their declared PascalCase name (the quoted form is accepted; prefer the bare name) and interfaces/events/value types bare; every `realizes` sits in the element's header, before `{`
- [ ] `import value type` / `import event` used instead of re-declaring domain concepts where a `.domain` exists
- [ ] `satisfies [REQ-…]`/`[NFR-…]` attached to the elements that implement/address them; NFRs on the addressing element
- [ ] `// source:` comment on every container, component, interface, channel, connector, named type, node, and resource
- [ ] No invented operations on an interface whose contract is not recoverable (use `// UNCLEAR`)
- [ ] `architecture.notes.md` written with confidence table, unwired ports, traceability, and observations
- [ ] `.arch.meta.json` written

Organization run only (a single-system run emits no `organization` file and no level-0 construct):

- [ ] One `organization` file; each system declared once, named after its role, with a purpose (`::`); the product of a bought system in `technology`
- [ ] Every extracted system has `detailed-in` and the same name as the `system` of its own file, which states no different description, `realizes` or metadata; no levels 2–3 inlined; bought products left as black boxes
- [ ] Peers appear in each system's file as `externalSystem` under their organization name; in the organization file, `externalSystem` only for parties outside the organization
- [ ] Every `dependency A -> B` follows the need, not the call: A obtains B's data (whoever opens the connection) or asks B to act on its behalf; a direction the code does not settle is written receiver-depends-on-source and listed as *direction to confirm*
- [ ] One dependency per ordered pair; a mutual pair is two dependencies, reported as a mutual dependency, never `Partnership`
- [ ] Every flow has a unique number (never renumbered, never reused), a business-language label, `carries`, a mechanism (`over "…"` and `manual`/`automated`) stated once — or per phase when a roadmap document names phases — and `to` only when the downstream system hands the upstream one what it needs to act on its behalf
- [ ] `as`, patterns, criticality, `masters`, hotspots, phases, areas and `used-by` written only with evidence; what was left out, and what is to confirm, is listed in the notes
- [ ] At most one system `masters` each concept (else `// UNCLEAR`); a copy fed by another system is `handles`; only main concepts listed
- [ ] Every cross-system connector covered by a dependency on that pair; every automated flow realized by a connector marked `// realizes flow N`
- [ ] Concept names resolve against the `domain-source`(s), or carry `// NOTE:`; `// source:` on every system, dependency, flow and hotspot
- [ ] `.arch.meta.json` carries the `organization` block (systems, counts, `lastFlowNumber`)

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
- **Several services, one system:** microservices built and released together are containers of one system — a single-system run, no organization file (see *One system or several* in Test 2).
- **Only `.arch` files as input (no code):** dependencies and flows come from the connectors that have a peer at their other end and from the payload types of the interfaces they wire; `// source:` cites the `.arch` file. `as`, patterns, criticality and `masters` stay out unless those files or a `.domain` evidence them.
- **One system among several is missing from the input:** if the organization runs it, declare it as a black box from what the integrations show; never fill in its inside.
- **Integration between two black boxes** (a CRM's built-in connector to the ERP): no code of ours shows it. Emit the dependency and its flow only from documentation or configuration that names it, with that file as `// source:`; otherwise leave it out and say so in the notes.
- **Shared broker between systems:** the broker is not a system. The subscriber depends on the system that publishes the topic (`over "Kafka topic …"`); in the subscriber's file, an `async` connector names that peer.
- **Shared database between systems:** A reading B's tables is `dependency A -> B` with a flow `over "shared database"`. Both writing the same table is two systems of record: keep both `masters` and mark them `// UNCLEAR`.
- **Integration platform (ESB, iPaaS) between two systems:** when it only transports, it is the medium (`over "…"`) of a dependency between the two; when the sources show mapping or routing logic of its own, ask whether it is one of the organization's systems.
- **Large landscape (>20 systems):** ask the user to scope to an area or a set of systems before proceeding; the systems left out can be declared later without renumbering any flow.
