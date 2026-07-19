# Clojure — architecture → scaffolding heuristics

Realizes the stack-agnostic Element → code contract for Clojure, paired with the `clojure` stack-binding
tables. One deps-edn module per `container`; shared contracts in a `contracts` lib. Contracts are expressed
as **Malli schemas**; transport via Reitit (REST) and Jackdaw (Kafka). Generate the **skeleton**; delegate
business logic to the domain layer (`domain-build-code`).

## Types (the contracts)

| `.arch` type | Clojure |
|---|---|
| `struct S { 1: required string a; 2: optional int b }` | a Malli schema `(def S [:map [:a :string] [:b {:optional true} :int]])` — `required` ⇒ plain entry, `optional` ⇒ `{:optional true}`. Carried as namespaced-keyword maps. |
| `enum E { active = 1; … }` | `(def E [:enum :active :disabled :expired])`; keep the Thrift ordinal in metadata if a wire value is needed. |
| `typedef Url = string` | `(def Url :string)` (a named alias schema). |
| `union U { 1: A a; 2: B b }` | `(def U [:multi {:dispatch :kind} [:a A] [:b B]])` (or `:or`). |
| `exception SlugTaken { 1: required string slug }` | `(ex-info "slug taken" {:type ::slug-taken :slug slug})`; mapped at the edge to the protocol error (HTTP 409). |
| `import value type Slug from domain` | require the domain namespace and reuse its schema — do not re-declare. |
| `import event LinkCreated from domain` | require the domain event schema as a channel message contract. |
| primitives / containers | per the binding table (`int → long`, `decimal → BigDecimal`, `uuid → java.util.UUID`, `binary → bytes`, `list → vector`, `set → set`, `map → map`). |

## Interfaces & operations (ports)

| `.arch` | Clojure |
|---|---|
| `interface LinkCommands { … }` | a `defprotocol LinkCommands` (the port) owning operation signatures, plus a Malli `=>` function schema per operation for arg/return validation. |
| operation *(default)* `createLink(...) returns ShortLinkDTO throws (SlugTaken)` | `(createLink [this target expiresAt])` — request-response (command); throws `ex-info` for declared exceptions. |
| `safe resolve(...)` | `(resolve [this slug])` — pure read (query); marked `^:safe` in metadata. |
| `oneway recordClick(...) returns void` | `(recordClick [this slug at])` returning `nil` (fire-and-forget). |
| `streaming tail(...)` | returns a `core.async` channel or reducible. |
| argument `2: optional datetime expiresAt = null` | a parameter validated as `[:maybe :time/local-date-time]`; default applied at the edge. |

## Components & ports

| `.arch` | Clojure |
|---|---|
| `component LinkController { provides LinkCommands … }` | a record/Component (e.g. Integrant key `:link/controller`) that `reify`s/`extend`s `LinkCommands`; each op delegates to the realized domain ns or `(throw (ex-info "// UNCLEAR: no domain backing" {}))`. |
| `requires SlugAllocation` | a dependency in the component's Integrant config (`{:slug-allocation (ig/ref :slug/allocation)}`) satisfying the `SlugAllocation` protocol; the connector supplies the client. Unwired ⇒ `// UNCLEAR` stub. |
| `realizes module "Link Management"` | a `;; realizes: module "Link Management"` comment + a call into that module's application function. |
| `boundedContext LinkManagement` | a namespace segment `link-management`. |

## Connectors (transport adapters), per `protocol → framework`

| `.arch` connector | Clojure (consumer side) | Clojure (provider side) |
|---|---|---|
| `over "REST/JSON" sync` | a `hato`-based client fn implementing the required protocol (jsonista codec). | a Reitit-ring route table exposing the provided interface. |
| `over "gRPC" sync` | a gRPC client stub wrapped to satisfy the protocol. | a gRPC service impl. |
| `… async` | a non-blocking client / `core.async` send. | an async handler. |
| `… streaming` | a `core.async` channel client. | a streaming (SSE) handler. |
| left side is a `Person` / UI | generate only the provider-side route. | — |
| right side is an `externalSystem` | generate the outbound client only. | — |

## Channels (first-class async), per broker binding

| `.arch` | Clojure (`Kafka` → Jackdaw) |
|---|---|
| `channel events on EventBus { carries LinkCreated, ClickRecorded }` | a Jackdaw producer + a consumer loop on topic `events`, payloads validated against the carried (often imported) schemas. |
| component `publishes LinkCreated to events` | a producer fn sending `LinkCreated` to `events`. |
| component `subscribes events` | a consumer fn dispatching carried messages into the realized domain reaction. |

## Containers & deployment

| `.arch` | Clojure |
|---|---|
| `container Api technology "…" { … }` | one deps-edn module with its own `deps.edn`, an Integrant system map wiring components, adapters, and channel loops, and a `-main`. |
| `container LinkDb technology "PostgreSQL"` | no service module — a `next.jdbc` datasource component config under the consuming module; appears in `deploy/`. |
| `container EventBus technology "Kafka"` | no service module — Jackdaw connection + topic config; appears in `deploy/`. |
| container-level `provides`/`requires` | module-level ports realized by gateway components. |
| `environment production { deploy Api replicas 3 }` | a `docker-compose.edn`/k8s manifest per environment under `deploy/production/` with the replica hint. |

## Conventions
- Namespaces: `<root>.<container>.<components|adapters.inbound|adapters.outbound|messaging|system>`.
- `satisfies [NFR-PERF-001]` → a `;; satisfies: NFR-PERF-001` comment on the schema/protocol/component.
- Wiring via Integrant/Component; the system map binds required protocols to connector adapter components.
- The `contracts` lib holds pure Malli schemas + protocols (no transport deps).
- Keep namespaced keywords for all map keys; validate at the edges with Malli.
