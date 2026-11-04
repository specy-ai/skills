## Software architecture (`.arch`)

A `.arch` document has one root: `# architecture Name` (one system in focus, C4 levels 1–3) or `# organization Name` (level 0, the system landscape). Headings follow containment; one level deeper at each step. The things an architecture has many of and says little about (persons, phases, areas, bounded contexts, imports, connectors) are lists; the things with a body (external systems, systems, containers, components, interfaces, types, channels, environments, hotspots, dependencies, flows) are headings.

### Headings

| Heading | DSL |
|---|---|
| `# architecture Sniplink` | `architecture Sniplink { … }` |
| `# organization RetailMediaCo` (tolerated: `organisation`, `landscape`) | `organization RetailMediaCo { … }` |
| `## external system GoogleSafeBrowsing` (tolerated: `externalSystem`, `external`) | `externalSystem GoogleSafeBrowsing … { provides … }` |
| `## system Sniplink` | `system Sniplink { … }` — in an organization, a level-0 system, detailed inline when it has member sub-headings |
| `### hotspot MonthEndClose` (under a level-0 system) | `hotspot MonthEndClose :: "…" concerns …` |
| `### struct ShortLinkDTO`, `### exception SlugTaken`, `### union Payload`, `### enum Disposition` | the Thrift-typed declarations |
| `### typedef Url` + `**Type:**` (tolerated: `### typedef Url = string`) | `typedef Url = string` |
| `### interface LinkCommands` (tolerated: `contract`, `api`) | `interface LinkCommands { … }` |
| `### container EdgeApi` → `#### component LinkController` | `container EdgeApi { … component LinkController { … } }` |
| `### channel linkEvents on EventBus` (tolerated: `### channel linkEvents` + `**Broker:**`) | `channel linkEvents on EventBus { carries … }` |
| `### Connectors` + a list | one `connect … -> … over "…" sync` per item |
| `### environment production` | `environment production { … }` |
| `## dependency ERP -> CRM` (tolerated: `## ERP → CRM` under `## Dependencies`) → `### flow 1 "Ad products"` | `dependency ERP -> CRM : … { flow 1 "Ad products" carries … }` |
| `## person Visitor`, `## area Finance`, `## phase Phase1`, `### bounded context Shortening`, `### import value type Slug` | tolerated as headings; the canonical form is the list of the same name |

Group headings: `Persons`/`People`, `External systems`, `Systems`, `Dependencies`, `Flows`, `Hotspots`, `Types`/`Structs`, `Exceptions`, `Unions`, `Enums`, `Typedefs`, `Imports`, `Interfaces`/`Contracts`, `Containers`, `Components`, `Channels`/`Topics`, `Environments`/`Deployment`. A bare name under one of them takes its kind (`### EdgeApi` under `### Containers`); `Name (kind)` works anywhere.

### Labels

| Element | Labels (canonical, then aliases) | DSL |
|---|---|---|
| every element | `Metadata` (`Meta`) | `meta { … }` on the head line |
| architecture, organization | `Domain sources` (`Domain source`); `Requirements source`; `Persons` + list `Name — description` | `domain-source "…"`; `requirements-source "…"`; `person Name :: "…"` |
| organization | `Phases` + list; `Areas` + list | `phase Name :: "…"`; `area Name :: "…"` |
| external system | `Realizes`; `Provides`; `Consumes`; `Masters` (level 0) | `realizes …`; `provides X`; `consumes X`; `masters A, B` |
| system (both) | `Satisfies`; `Realizes` (`module "X", context Y, interface Z, event E, value type V`); `Bounded contexts` + list; `Imports` + list `value type X` / `event X` | `satisfies [...]`; `realizes …`; `boundedContext X :: "…"`; `import value type X from domain` |
| system (level 0) | `Technology` (`Product`); `Area`; `Used by` (`Users`); `Masters`; `Handles`; `Detailed in` | `technology "…"`; `area X`; `used-by A, B`; `masters A, B`; `handles A, B`; `detailed-in "…"` |
| hotspot | the description paragraph (required); `Concerns` (`Affects`) — flow numbers and concepts | `hotspot X :: "…" concerns 1, 2, Invoice` |
| struct | `Satisfies`; fields table | `struct X satisfies [...] { 1: required T f }` |
| typedef | `Type` (`Alias of`) | `typedef X = T` |
| interface | `Satisfies`; `Realizes`; a `specy` island of signatures (tolerated: an `Operations` list) | `interface X { op(…) returns T }` |
| container | `Technology` (`Tech`, `Stack`); `Satisfies`; `Realizes`; `Provides`; `Requires` | `container X technology "…" { provides I requires J … }` |
| component | `Satisfies`; `Realizes`; `Bounded context` (`Context`); `Provides`; `Requires`; `Publishes` + list `Message to channel`; `Subscribes` | `component X { boundedContext B provides I publishes M to c subscribes c }` |
| channel | `Carries` (`Messages`, `Events`); `Broker` (`On`) when not in the heading | `channel x on Broker { carries A, B }` |
| environment | a `specy` island with the body (`deploy …`, `node … { … }`, `resource …`); tolerated: `Deploys` + list | `environment x { … }` |
| dependency | `Patterns` (`Pattern`); `Criticality` | `dependency A -> B : ACL, OHS criticality degraded` |
| flow | `Carries` (`AdProduct as Item, X`); `To` (`Receiver`); `Mechanism` (`over "…" manual`); `Phases` + list `Phase1 over "…" manual` | `flow 1 "…" carries … to X over "…" manual`, or `{ phase P1 … }` |

### Tables and islands

- Struct and exception fields: `| # | requiredness | type | field | default | description |`. Tolerated: no `#` column (rows are numbered in order), a `required` yes/no column instead of `requiredness`, `name` for `field`.
- Union: `| # | type | member |`. Enum: `| member | value |`, or a bullet list `- name = 3` (a bare `- name` takes its position).
- Interface operations and environment bodies are `specy` islands in DSL syntax, written by the printer and pasted verbatim.
- Connectors: a list under `### Connectors`, one `` `A -> B over "protocol" sync|async|streaming` `` per item, ` — description` after it; an island of `connect …` lines is also read.
- A list item's ` · meta: key = value` carries the element's metadata (persons, phases, areas, bounded contexts, connectors).

### Example

```markdown
---
specy: architecture
---

# architecture Sniplink

**Domain sources:** sniplink.domain

**Persons:**
- Visitor — Follows a short link

## external system SafeBrowsing

**Provides:** ThreatLookup

## system Sniplink

**Bounded contexts:**
- Shortening — Links and slugs

**Imports:**
- value type Slug

### struct ShortLinkDTO

| # | requiredness | type | field | default | description |
|---|---|---|---|---|---|
| 1 | required | `Slug` | slug | | |
| 2 | optional | `datetime` | expiresAt | | |

### interface LinkCommands

```specy
createShortLink(1: required string target, 2: optional Slug customSlug) returns ShortLinkDTO throws (SlugTaken)
```

### container EdgeApi

**Technology:** Clojure/Ring
**Provides:** LinkCommands

#### component LinkController

**Bounded context:** Shortening
**Provides:** LinkCommands
**Requires:** ThreatLookup

### Connectors

- `Visitor -> EdgeApi.LinkCommands over "HTTPS" sync`
- `LinkController -> SafeBrowsing.ThreatLookup over "HTTPS/REST" async` — circuit-broken
```

A level-0 landscape: `# organization Acme`, `**Phases:**` and `**Areas:**` lists, `## system ERP` with `**Technology:**`, `**Area:**`, `**Used by:**`, `**Masters:**`, `**Handles:**` and `### hotspot …` sub-headings, then `## dependency ERP -> CRM` with `**Patterns:**`, `**Criticality:**` and `### flow 1 "…"` sub-headings carrying `**Carries:**`, `**To:**`, `**Mechanism:**` or `**Phases:**`.
