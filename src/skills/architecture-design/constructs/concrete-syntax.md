## Concrete syntax

A `.arch` file describes **one software system in focus**, surrounded by the persons and external systems it interacts with (the C4 *System Context* view). The provenance declarations sit at the top of the `architecture` block; `satisfies` and `realizes` decorate the elements they trace.

```
architecture ShortLinkPlatform :: "URL shortening platform — architecture" {

  // Provenance — the satisfies / realizes / import references below resolve
  // against these two sibling files.
  domain-source       "specy/urlshortener.domain"
  requirements-source "specy/urlshortener.sysreq"

  // LEVEL 1 — persons + external systems + the one system in focus.
  person Visitor   :: "An anonymous end-user who follows short links"
  person Registrar :: "A registered user who creates and manages short links"

  externalSystem Analytics :: "Segment click-analytics platform"
      realizes module "Click Analytics" {
    provides AnalyticsIngest   // an interface our system calls
    consumes ClickExport       // an interface of ours it reads
  }

  system ShortLink :: "The link-shortening platform"
      satisfies [REQ-NFR-001] {

    // BOUNDED CONTEXTS — optional groupings projected onto components.
    boundedContext LinkManagement :: "Creation and lifecycle of short links"

    // IMPORTED DOMAIN TYPES — reference the .domain rather than re-declaring.
    import value type Slug          from domain
    import event      LinkCreated   from domain

    // SHARED THRIFT TYPES — wire-grade payloads of interfaces & channels.
    typedef Url = string

    enum LinkStatus { active = 1  disabled = 2  expired = 3 }

    struct ShortLinkDTO :: "Wire view of a short link" {
      1: required Slug       slug
      2: required Url        target
      3: optional datetime   expiresAt
      4: required LinkStatus  status
    }

    union Target { 1: Url url  2: string rawText }

    // Exceptions — the architecture realization of domain error events.
    exception SlugTaken { 1: required string slug }

    // SHARED INTERFACES — first-class contracts owned by whoever `provides`.
    interface LinkCommands :: "Write side of link lifecycle"
        satisfies [REQ-LNK-001] {
      createLink(1: required Url target, 2: optional datetime expiresAt)
        returns ShortLinkDTO throws (SlugTaken)
        :: "request-response / command (default style)"

      safe resolve(1: required string slug) returns ShortLinkDTO
        :: "safe = no mutation → query"

      oneway recordClick(1: required string slug, 2: required datetime at) returns void
        :: "oneway = fire-and-forget → event emission (must return void)"
    }

    // LEVEL 2 / LEVEL 3 — containers and the components inside them.
    container Api :: "Edge API service" technology "Clojure/Ring"
        satisfies [REQ-NFR-002] {
      provides LinkCommands                 // container-level port (black box)

      component LinkController :: "HTTP edge for link lifecycle"
          realizes module "Link Management" {   // domain modules are quoted strings
        boundedContext LinkManagement
        provides LinkCommands
        requires SlugAllocation
        publishes LinkCreated to events         // async publish
      }
    }

    container EventBus technology "Kafka"
    container LinkDb   technology "PostgreSQL"

    // CHANNELS — first-class async. Hosted on a broker, CARRIES message types
    // (usually imported domain events).
    channel events on EventBus :: "Link lifecycle fan-out" {
      carries LinkCreated
    }

    // CONNECTORS — wire required ports to provided ports + protocol + style.
    // The left side: Component.RequiredInterface | Container | Person.
    // The right side: Component[.ProvidedInterface] | Container | ExternalSystem[.ProvidedInterface].
    connect Registrar -> Api.LinkCommands over "REST/JSON" sync
    connect LinkController.SlugAllocation -> SlugAllocator over "gRPC" sync
    connect LinkController -> LinkDb over "JDBC" sync
    connect LinkController -> Analytics.AnalyticsIngest over "HTTPS" async

    // DEPLOYMENT VIEW — lightweight: environment + placement + replica hint.
    environment production :: "Multi-AZ production" {
      deploy Api replicas 3
      deploy EventBus, LinkDb
    }
  }
}
```

### Syntax rules that bite

- **Descriptions** use `::` then a string literal. **Metadata** uses `meta { key = value }`. Comments use `//`.
- **Names**: `system`, `container`, `component`, `interface`, and every named type (`struct`, `enum`, `typedef`, `union`, `exception`) are `PascalCase`. Operations, struct/union fields, enum members, channels, and environments are `camelCase`. Primitives are lowercase.
- **Primitives** (lowercase): `string`, `int`/`integer`, `long`, `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`. `void` is a return type only. Containers: `list<T>`, `set<T>`, `map<K, V>`.
- **Thrift fields & args** always carry an `<ordinal>: required|optional <type> <name> [= default]`. Ordinals start at 1 and never repeat within a struct/exception/operation.
- **Operation styles** prefix the name: bare = request-response (command), `safe` = query (no mutation), `oneway` = event emission (must `returns void`), `streaming` = result stream.
- **`realizes module "…"` / `realizes context "…"`** take **quoted multi-word strings** (domain modules and contexts are quoted in `.domain`). **`realizes interface Foo` / `realizes event Foo` / `realizes value type Foo`** take **bare PascalCase** names.
- **`satisfies [ID, …]`** takes a bracketed list of requirement identifiers (`REQ-…`, `NFR-…`). NFRs in particular belong on the elements that address them.
- **Ports vs connectors**: `provides` / `requires` declare ports; a separate `connect A.Port -> B over "<protocol>" <sync|async|streaming>` wires a required port to a provided port. A required port is unsatisfied until a connector binds it.
- **Async** is modeled with `channel <name> on <BrokerContainer> { carries <MsgTypes> }` plus component `publishes <Msg> to <chan>` / `subscribes <chan>` — never as an anonymous arrow.
- **Provenance is mandatory** when inputs come from files: `domain-source` and `requirements-source` at the top of the `architecture` block make both traceability bridges machine-resolvable.

When in doubt about syntax, re-read `grammar/architecture.ebnf` and the `examples/url-shortener/url-shortener.arch` model — it exercises every construct.
