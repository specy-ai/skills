# Enterprise Architecture metamodel

> **Status: draft.** This file proposes the concepts and relations of an enterprise-scope layer for Specy. There is no grammar, no file extension and no skill for it yet; the concrete syntax in the [worked example](#worked-example) is illustrative only. The points still to settle are listed under [Open questions](#open-questions).

![Specy Enterprise Architecture metamodel](../../specy-EA-metamodel.svg)

This file defines an **enterprise architecture** metamodel: the concepts needed to describe an organization's architecture as a whole — why it invests, who owns what, which rules hold everywhere, and how the landscape moves from its current state to a target one.

The other Specy metamodels each describe one thing in depth: a product (`.prd`), its requirements (`.sysreq`), a domain (`.domain`), a system (`.arch`), its data and operations (`.dataop`). They all work at **bounded-context scope** — one model, one language, one team. None of them answers the questions that only appear when there are many of them: which capability does this context serve, which team owns it, is it allowed to call that other system synchronously, what replaces it next year.

This metamodel adds that **enterprise scope**, and it does so by wrapping the existing models instead of re-describing them. It defines eight packages:

| Package | Scope | Answers | Concepts |
|---|---|---|---|
| [Strategy](#strategy-package) | enterprise | why | Goal, Capability |
| [Organization](#organization-package) | enterprise | who | Team, Ownership |
| [Domain](#domain-package) | bounded context | what the business knows | Subdomain, Bounded Context, Aggregate |
| [System](#system-package) | bounded context | what runs | System, Container, API |
| [Data](#data-package) | bounded context | what is stored and where it flows | Schema, Lineage |
| [Deployment](#deployment-package) | bounded context | where it runs | Environment, Node, Resource |
| [Governance](#governance-package) | enterprise, cross-cutting | what must hold | Principle, Rule, Fitness Function, Decision, Waiver |
| [Transformation](#transformation-package) | enterprise, cross-cutting | what changes, and when | Plateau, Gap, Initiative, Milestone |

Strategy, Organization, Domain, System, Data and Deployment form a chain: strategy and organization give a bounded context its reason and its owner, the domain is realized by systems and data, and both are deployed. Governance and Transformation are **cross-cutting**: a rule may constrain an element of any package, and a plateau may contain elements of every package.

It borrows from ArchiMate (goal, principle, capability, plateau, gap), from Team Topologies (team types), from evolutionary architecture (fitness functions) and from architecture decision records, and it is deliberately smaller than any of them (see [Mapping to ArchiMate](#mapping-to-archimate)).

## What this metamodel is NOT

- It is **not a second description** of the domain, the systems or the data. The four bounded-context packages name concepts that live in `.domain`, `.arch` and `.dataop` files and add only what is visible from above: classification, ownership, lineage, placement. An enterprise model that restates an aggregate's fields is wrong by construction.
- It is **not ArchiMate**. There is no business-process layer, no actor/role/collaboration vocabulary and no generic relationship algebra (serving, triggering, flow, access…). Each relation here is named and has one meaning.
- It is **not a portfolio or project-management tool**. An initiative carries what explains an architecture change — the gaps it closes, the goals it serves, its milestones — not budgets, staffing or task breakdowns.
- It is **not an org chart**. Teams appear as owners of things; reporting lines, headcount and people are out of scope.
- It is **not a CMDB**. Deployment records the placement and residency facts that architecture rules need; it does not inventory every running instance.

## Convention

Every concept in this metamodel carries a **name**, a **description** and a **metadata** map (arbitrary key/value pairs). These attributes are implicit and not repeated in each definition below.

**Scopes.** A concept is either *enterprise scope* (it exists once for the whole enterprise and spans bounded contexts) or *bounded-context scope* (it belongs to one bounded context and is described by a Specy model). The package table above gives the scope of each package.

**Element references.** Governance and Transformation concepts, and Ownership, point at "an element": any named concept of any package, including the concepts of the Specy models behind the bounded-context packages (a module, a component, a connector, a struct). Wherever a relation below says *element*, it means such a reference. An element is referenced, never copied.

**Implicit correspondence by naming.** As in the Data & Operation metamodel, an enterprise-scope reference to a bounded-context-scope concept is resolved by name: the enterprise is the domain model's `organization`, a bounded context named here is the `.domain` bounded context of the same name, a system is the `.arch` system of the same name. An explicit reference is needed only when names diverge.

**Stable identifiers.** The governance and transformation concepts that other artifacts cite carry unique, stable identifiers, following the rule already used for features and requirements — the identifier never changes when the element is renamed, and is never reused:

- **Principle**: `PRIN-NNN`
- **Rule**: `RULE-NNN`
- **Decision**: `ADR-NNN`
- **Waiver**: `WVR-NNN`
- **Initiative**: `INIT-NNN`

## Enterprise

The root of the model: the organization whose architecture is described. It is the same thing as the `organization` of the domain metamodel, seen with everything that surrounds its bounded contexts.

Relations:
- 1..1 "corresponds to" relation with a domain organization
- 1..n "pursues" relation with goals
- 1..n "has" relation with capabilities (the capability map)
- 1..n "is staffed by" relation with teams
- 0..n "adopts" relation with principles
- 0..n "records" relation with decisions
- 1..n "is described by" relation with plateaus (at least the baseline)

---

## Strategy package

Strategy states what the enterprise is trying to achieve and what it must be able to do to get there. It is the reason every other element exists: an element that no capability and no goal can be traced to is a candidate for retirement.

### Goal

An outcome the enterprise pursues, stated so that its achievement can be judged.

A goal has:
- **statement**: the outcome, measurable (e.g. "Decide 80% of consumer loan applications in under ten minutes").
- **measure**: the indicator and target that tell whether the goal is met.
- **horizon**: the date or period by which it should be met.

An enterprise goal is not a product goal. The `goal` of the PRD metamodel belongs to one product; an enterprise goal spans products, and product goals **contribute to** it.

Relations:
- 0..n "refined into" relation with sub-goals
- 0..n "requires" relation with capabilities (the capabilities whose creation or improvement the goal depends on)
- 0..n "contributed to by" relation with product goals (`.prd`)
- 0..n "served by" relation with initiatives

### Capability

Something the enterprise is able to do, named independently of how it is done, by whom and with which system ("Underwrite a loan", "Collect a payment"). Capabilities are stable: teams reorganize and systems are replaced far more often than a capability appears or disappears. That stability is what makes the capability map the anchor for everything below it.

Capabilities decompose into a tree, usually two or three levels deep. Only leaf capabilities are realized.

Relations:
- 0..n "decomposes into" relation with sub-capabilities
- 1..n "realized by" relation with subdomains (leaf capabilities)
- 0..n "required by" relation with goals
- 0..1 "owned by" relation with a team (through an ownership)

---

## Organization package

Organization records who is accountable for what. It exists because of Conway's law: the structure of the systems follows the structure of the teams, so a model that knows one and not the other cannot explain the architecture it describes.

### Team

A long-lived group of people that owns elements. A team has a **type**, taken from Team Topologies:

| Type | Purpose |
|---|---|
| `stream-aligned` | delivers a flow of business change for one or a few bounded contexts |
| `platform` | provides internal services that other teams consume |
| `enabling` | helps other teams acquire a capability, then steps back |
| `complicated-subsystem` | owns a part that needs rare specialist knowledge |

Teams may declare how they interact (`collaboration`, `x-as-a-service`, `facilitating`). The interaction mode between two teams should agree with the context-map pattern between the bounded contexts they own: a Partnership or Shared Kernel implies collaboration; an Open Host Service or Customer/Supplier relation implies x-as-a-service.

Relations:
- 0..n "holds" relation with ownerships
- 0..1 "part of" relation with a parent team
- 0..n "interacts with" relation with other teams, characterized by an interaction mode

### Ownership

A first-class link between **one team**, **one element** and **one role**. It is a concept of its own, not an attribute of the element, for three reasons: it changes on its own schedule, it belongs to a plateau like any other element (the owner in the target state may differ from today's), and its absence or duplication is something a rule can detect.

| Role | Meaning |
|---|---|
| `owner` | accountable for the element: decides its evolution, answers for its defects |
| `steward` | accountable for the meaning and quality of data (schemas) |
| `operator` | runs the element in production |

Constraints:
- An element has at most one `owner`. Two owners is a finding; so is none, for the kinds of element a rule declares must be owned.
- A bounded context shall have exactly one owner, and a team should own few of them: a context split between teams loses its single language, and a team spread over many contexts exceeds its cognitive load.

Relations:
- 1..1 "held by" relation with a team
- 1..1 "of" relation with an element (capability, subdomain, bounded context, system, container, API, schema, resource, initiative)

---

## Domain package

The domain package is described by `.domain` files (see DOMAIN-METAMODEL.md). The enterprise view adds the problem-space partition above the bounded contexts and the links that tie a context to strategy, to a team and to the systems that realize it.

### Subdomain

An area of the problem space: a part of the business the enterprise has to deal with, whether or not software exists for it. A subdomain is classified by its strategic value:

| Classification | Meaning | Typical consequence |
|---|---|---|
| `core` | where the enterprise differentiates | built in-house, by the strongest team, modeled in depth |
| `supporting` | necessary, specific to the business, not differentiating | built simply, or outsourced |
| `generic` | a problem every business has | bought or adopted, not built |

A subdomain is problem space; a bounded context is solution space. The ideal is one bounded context per subdomain. Several contexts for one subdomain usually records history (a legacy system next to its replacement); one context covering several subdomains is a context that has grown too large.

*Not in the domain metamodel today, which starts at the bounded context — see [Open questions](#open-questions).*

Relations:
- 1..n "realizes" relation with capabilities
- 1..n "modeled by" relation with bounded contexts

### Bounded Context

The bounded context of the domain metamodel: the boundary within which one model and one language hold. It is the pivot of this metamodel — the place where enterprise scope meets the Specy models. Everything above explains why it exists and who owns it; everything below is how it is built, stored and run.

Relations added at enterprise scope (the context's own relations — modules, context map — stay in the `.domain` file):
- 1..n "models" relation with subdomains
- 1..1 "owned by" relation with a team (through an ownership)
- 1..n "realized by" relation with systems (in the `.arch`, components realize the context's modules)
- 0..n "contains" relation with aggregates (through its modules)

### Aggregate

The aggregate of the domain metamodel: a cluster of entities with one root that enforces their integrity. At enterprise scope it matters for one reason: it is the **system of record** for its data. Every schema should trace back, directly or through lineage, to the one aggregate that masters it.

Relations added at enterprise scope:
- 0..n "mastered as" relation with schemas

---

## System package

The system package is described by `.arch` files (see SOFTWARE-ARCHITECTURE-METAMODEL.md), one per system. The set of all systems is the enterprise's application portfolio.

### System

The `system` of the architecture metamodel: one software system, the subject of one `.arch` file. At enterprise scope it is the unit of the application portfolio — what is funded, owned, replaced and retired.

Relations added at enterprise scope:
- 1..n "realizes" relation with bounded contexts
- 1..n "contains" relation with containers
- 1..1 "owned by" relation with a team (through an ownership)

### Container

The `container` of the architecture metamodel: a separately runnable or deployable unit with a free-form technology. It is the unit that deployment places.

Relations added at enterprise scope:
- 0..n "provides" relation with APIs
- 0..n "deployed on" relation with nodes

### API

The published surface of a system: the interfaces its containers and components **provide** to other systems, and the channels on which it publishes messages. Inside one `.arch` file these are `interface` and `channel`; the enterprise view gathers those that cross a system boundary, because they are what other teams depend on.

An API has a **visibility**: `internal` (same bounded context), `enterprise` (other contexts), or `public` (partners, customers).

Relations:
- 1..1 "provided by" relation with a container
- 0..n "exposes" relation with schemas
- 0..n "consumed by" relation with systems (the enterprise-wide dependency graph)

---

## Data package

The data package is described by `.dataop` files (structs — see DATA-OPERATION-METAMODEL.md) and by the type system of `.arch` files (structs and channel message types).

### Schema

A named data shape, at rest (a `.dataop` struct, persisted) or in motion (an `.arch` struct or message type, exchanged).

A schema has, at enterprise scope:
- **classification**: `public`, `internal`, `confidential` or `personal` — the sensitivity of what it holds.
- **retention**: how long instances may be kept, when a rule or a regulation says so.

Relations:
- 0..1 "masters" relation from an aggregate (the system of record; absent for a derived schema)
- 0..n "derived from" relation with schemas (through lineage)
- 0..n "exposed by" relation with APIs
- 0..n "stored in" relation with resources
- 0..1 "stewarded by" relation with a team (through an ownership)

### Lineage

A directed **derives-from** link between two schemas, possibly in different bounded contexts, optionally naming the API or channel that carries the data. Lineage is how the model knows that a reporting table, a search index or a read-only entity in another context is a copy of something mastered elsewhere.

The domain metamodel's read-only entity (master data) is one case of lineage, declared from the consumer's side; lineage states the same fact enterprise-wide and across more than one hop.

Lineage enables three checks: impact (which schemas are affected when a source changes), classification (a schema derived from `personal` data is `personal` unless a decision says otherwise), and provenance (a schema with no aggregate and no lineage has no system of record).

*Not in any Specy metamodel today — see [Open questions](#open-questions).*

Relations:
- 1..1 "from" relation with a source schema
- 1..1 "to" relation with a derived schema
- 0..1 "carried by" relation with an API

---

## Deployment package

The architecture metamodel has a deliberately light deployment view: environments and container placement. This package keeps the environment and adds the two concepts that enterprise rules need — where things run and where data physically is.

### Environment

The `environment` of the architecture metamodel: a named stage in which containers are deployed (`production`, `staging`).

Relations:
- 1..n "contains" relation with nodes

### Node

A place where containers run inside an environment: a region, a cluster, a virtual machine, a serverless runtime. Nodes nest (a cluster in a region). A node carries the facts placement rules test: provider, region, zone.

*Out of scope in the architecture metamodel today — see [Open questions](#open-questions).*

Relations:
- 1..1 "belongs to" relation with an environment
- 0..1 "nested in" relation with a parent node
- 0..n "hosts" relation with containers (with a replica count)
- 0..n "provides" relation with resources

### Resource

A provisioned unit of infrastructure on a node that containers consume: a database instance, a topic, a bucket, a cache, a secret store. It is where data physically lives, which makes it the element residency and retention rules are checked against. A `.arch` container whose technology is a data store or a broker is the logical element; the resource is its provisioned instance in one environment.

*Out of scope in the architecture metamodel today — see [Open questions](#open-questions).*

Relations:
- 1..1 "provided by" relation with a node
- 0..1 "instantiates" relation with a container (a data store or broker)
- 0..n "stores" relation with schemas

---

## Governance package

Governance states what must hold across the enterprise and keeps track of where it does not. It is cross-cutting: its concepts point at elements of every package.

The five concepts form one loop. A principle says what the enterprise wants; rules make it checkable; fitness functions check it; a waiver records an accepted violation; a decision is where principles, rules and waivers come from. A principle without a rule cannot be checked, and a rule without a principle has no stated reason.

### Principle

A durable statement of how the enterprise intends to build and run its architecture. Principles are few and change rarely.

A principle has:
- **statement**: the principle itself, in one sentence.
- **rationale**: why the enterprise holds it.
- **implications**: what it costs and what it rules out.

Relations:
- 1..n "refined into" relation with rules
- 0..1 "established by" relation with a decision

### Rule

A constraint that can be checked against elements. Where a principle says "bounded contexts are loosely coupled", a rule says "no synchronous connector joins components of two different bounded contexts".

A rule has:
- **statement**: the constraint.
- **applies to**: the kind of element it constrains, with an optional filter (connectors whose ends are in different bounded contexts; schemas classified `personal`).
- **severity**: `must` (a violation blocks) or `should` (a violation is reported).

Several constraints already written as "shall" in the other metamodels are natural rules: the domain metamodel says interactions between bounded contexts should be asynchronous; a rule lets an enterprise make that a `must`, or waive it for one integration.

A rule is not a non-functional requirement. An organization-scoped NFR (see SYSTEM-REQ-METAMODEL.md) states a quality the running platform shall have, and is decomposed into context-level requirements. A rule constrains the shape of the architecture itself. A rule may exist because of an NFR, and then names it.

Relations:
- 1..n "refines" relation with principles
- 0..n "verified by" relation with fitness functions
- 0..n "waived by" relation with waivers
- 0..n "derives from" relation with organization-scoped requirements (`.sysreq`)
- 0..1 "established by" relation with a decision

### Fitness Function

A repeatable, objective check of a rule. It has:
- **target**: what it inspects — `model` (the Specy files), `code`, or `runtime`.
- **mode**: `automated` or `manual` (a review, an audit).
- **trigger**: when it runs — on change, on a schedule, continuously.
- **verdict**: per element, `pass`, `fail` or `waived`.

Model-level fitness functions are where the Specy models pay off: because `.domain`, `.arch` and `.dataop` files are machine-readable, many rules are queries over them and need neither the code nor a running system. "Every required port is wired", "no sync connector crosses a bounded context", "every `personal` schema has a steward" are all of that kind.

A `must` rule with no fitness function is a finding: nothing checks it.

Relations:
- 1..n "verifies" relation with rules

### Decision

An architecture decision record. It has:
- **context**: the forces at play.
- **decision**: what was decided.
- **consequences**: what follows, good and bad.
- **status**: `proposed`, `accepted`, `rejected` or `superseded`.
- **date** and **deciders** (teams).

Decisions are how governance changes: a principle or a rule is established, amended or retired by a decision, and every waiver is granted by one. Principles and rules that predate the decision log simply have no establishing decision.

Relations:
- 0..n "establishes" relation with principles and rules
- 0..n "grants" relation with waivers
- 0..n "affects" relation with elements
- 0..1 "supersedes" relation with a decision
- 1..n "made by" relation with teams

### Waiver

An approved, time-boxed exception: named elements are allowed to violate one rule until a date. It has:
- **justification**: why the violation is accepted.
- **expiry**: the date after which the violation counts again. Mandatory — a waiver without an expiry is a rule change, and belongs in a decision.
- **remediation**: how the violation will be removed.

Relations:
- 1..1 "exempts from" relation with a rule
- 1..n "applies to" relation with elements
- 1..1 "granted by" relation with a decision
- 0..1 "remediated by" relation with an initiative

---

## Transformation package

Transformation describes change over time. It is cross-cutting: a plateau contains elements of every package, including teams, ownerships and rules.

### Plateau

A state of the architecture that holds for a period. A plateau has a **kind**: `baseline` (what exists now), `target` (where the enterprise wants to be) or `transition` (a stable intermediate state).

A plateau is a selection, not a copy: it names the elements that exist in that state. An element in the baseline and absent from the target is to be retired; the reverse is to be built.

The two ends of a transformation match the two ways Specy models are produced. The baseline is largely **extracted** from what runs today (the `*-extract-from-code` skills, the `observed` conformance level of `.dataop`); the target is **designed**.

Constraints:
- An enterprise has exactly one baseline plateau.

Relations:
- 0..n "contains" relation with elements
- 0..1 "follows" relation with a previous plateau

### Gap

The difference between two plateaus: the elements to add, to change and to retire. Much of a gap can be computed by comparing the two plateaus; it is declared when it needs a name, a description and someone to close it.

Relations:
- 1..1 "from" relation with a plateau
- 1..1 "to" relation with a plateau
- 0..n "concerns" relation with elements, each marked `added`, `changed` or `retired`
- 0..n "closed by" relation with initiatives

### Initiative

A body of work that moves the architecture from one plateau toward the next. An initiative is where the enterprise model hands over to the rest of the Specy pipeline: it is specified by one or more products (`.prd`), from which requirements, domain models and architectures follow.

Relations:
- 1..n "closes" relation with gaps
- 1..n "serves" relation with goals
- 1..n "has" relation with milestones
- 0..n "specified by" relation with products (`.prd`)
- 0..n "remediates" relation with waivers
- 1..1 "owned by" relation with a team (through an ownership)

### Milestone

A dated checkpoint of an initiative. A milestone has a **date** and states what is true once it is reached: a plateau attained, or a gap closed. A PRD `release` is the product-side counterpart; a milestone may name the releases that deliver it.

Relations:
- 1..1 "belongs to" relation with an initiative
- 0..1 "reaches" relation with a plateau
- 0..n "delivered by" relation with releases (`.prd`)

---

## Checks this metamodel enables

Each of these is a query over the enterprise model and the Specy models it references. They are candidate built-in rules.

| Check | Packages |
|---|---|
| Every leaf capability is realized by at least one subdomain | Strategy, Domain |
| Every subdomain is modeled by at least one bounded context in the target plateau | Domain, Transformation |
| Every bounded context and every system has exactly one owner | Organization, Domain, System |
| A `core` subdomain is owned by a `stream-aligned` team | Organization, Domain |
| Team interaction modes agree with context-map patterns | Organization, Domain |
| Every schema has a system of record: an aggregate, or lineage leading to one | Data, Domain |
| Classification propagates along lineage | Data |
| Every `personal` schema is stored only in resources of permitted regions | Data, Deployment |
| Every rule refines a principle; every `must` rule has a fitness function | Governance |
| Every waiver has a rule, an element, a decision and an expiry in the future | Governance |
| Every gap between baseline and target is closed by an initiative | Transformation |
| Every initiative serves a goal | Transformation, Strategy |
| Every element of the baseline that is absent from the target has an initiative retiring it | Transformation |

## Relationship to the other Specy metamodels

| Concept | Scope | Described by | Status |
|---|---|---|---|
| Enterprise | enterprise | `.domain` `organization` | exists — same element, by name |
| Goal, Capability | enterprise | this metamodel | new |
| Team, Ownership | enterprise | this metamodel | new |
| Subdomain | bounded context | — | **new** — the domain metamodel has no problem-space concept |
| Bounded Context, Aggregate | bounded context | `.domain` | exists |
| System, Container | bounded context | `.arch` | exists |
| API | bounded context | `.arch` `interface` and `channel` | exists — a view over those that cross a system boundary |
| Schema | bounded context | `.dataop` `struct`; `.arch` `struct` and message type | exists — classification and retention are new |
| Lineage | bounded context | — | **new** — the read-only entity sync pattern of `.domain` is a partial precedent |
| Environment | bounded context | `.arch` | exists |
| Node, Resource | bounded context | — | **new** — explicitly out of scope in the `.arch` deployment view |
| Principle, Rule, Fitness Function, Decision, Waiver | enterprise | this metamodel | new |
| Plateau, Gap, Initiative, Milestone | enterprise | this metamodel | new |

Links to the upstream metamodels:

| This metamodel | Other metamodel | Link |
|---|---|---|
| Goal | PRD `goal` | a product goal contributes to an enterprise goal |
| Initiative | PRD `product` | an initiative is specified by products |
| Milestone | PRD `release` | a milestone is delivered by releases |
| Rule | SysReq organization-scoped NFR | a rule may derive from a cross-cutting requirement |

## Mapping to ArchiMate

| ArchiMate | This metamodel | Notes |
|---|---|---|
| Goal, Outcome | Goal | one concept; the measure makes it an outcome |
| Capability | Capability | |
| Principle | Principle | |
| Requirement, Constraint | Rule | always checkable; has a severity |
| Business actor, Business role | Team, Ownership | role is a property of the ownership link |
| Application component | System, Container | the two C4 levels |
| Application interface | API | |
| Data object | Schema | |
| Node, System software, Technology service | Node, Resource | |
| Plateau, Gap | Plateau, Gap | same meaning |
| Work package | Initiative | |
| Implementation event, Deliverable | Milestone | |
| *no equivalent* | Subdomain, Bounded Context, Aggregate | ArchiMate has no model-boundary concept |
| *no equivalent* | Fitness Function, Decision, Waiver | governance is outside ArchiMate's language |
| *no equivalent* | Lineage | expressible only as a generic flow or access relation |
| Business process, Value stream, Driver, Stakeholder, … | *out of scope* | |

## Worked example

Illustrative syntax only — no grammar exists yet.

```
enterprise Lendwell :: "Consumer and business lending" {

  // strategy
  goal "Decide consumer loans in minutes" {
    measure "share of applications decided in under 10 minutes" target "80%"
    horizon 2027-12-31
    requires "Underwrite a loan"
  }
  capability "Originate loans" {
    capability "Underwrite a loan"   realized-by Underwriting
    capability "Verify identity"     realized-by IdentityVerification
  }

  // domain
  subdomain Underwriting         core     modeled-by LoanDecisioning, LegacyScoring
  subdomain IdentityVerification generic  modeled-by Kyc

  // organization
  team Decisioning stream-aligned {
    owner of LoanDecisioning
    owner of DecisionEngine          // the .arch system
    steward of CreditDecision        // a schema
  }

  // governance
  PRIN-002 "Bounded contexts are loosely coupled" {
    rationale "A context must be changeable and deployable without its neighbours"
    implications "Integration is asynchronous; data is copied, with lineage"
  }
  RULE-007 "No synchronous connector between bounded contexts" refines PRIN-002 {
    applies-to connector where "ends are in different bounded contexts"
    severity must
    verified-by fitness "sync-across-contexts" target model automated on-change
  }
  ADR-031 "Keep the synchronous call to LegacyScoring until it is retired" accepted 2026-09-14 {
    made-by Decisioning
    grants WVR-004
  }
  WVR-004 exempts-from RULE-007 {
    applies-to DecisionEngine.ScoreLookup -> LegacyScoring
    expires 2027-06-30
    remediated-by INIT-012
  }

  // transformation
  plateau Today    baseline
  plateau Mid2027  target follows Today
  gap "Scoring consolidation" from Today to Mid2027 {
    retired LegacyScoring
    changed LoanDecisioning
  }
  INIT-012 "Retire legacy scoring" {
    closes "Scoring consolidation"
    serves "Decide consumer loans in minutes"
    specified-by "specy/decisioning.prd"
    milestone "Scoring rules migrated" 2027-03-31
    milestone "Legacy scoring switched off" 2027-06-30 reaches Mid2027
  }
}
```

The example shows the loop the packages are designed for: a rule fails on one connector, a decision grants a waiver with an expiry, the waiver names the initiative that removes the violation, and that initiative closes a gap between two plateaus and serves a goal.

## Open questions

1. **Capability and subdomain.** Both partition the problem space, and in practice they map almost one to one. Are both needed, or is a subdomain a leaf capability with a classification?
2. **Where the new bounded-context concepts live.** Subdomain could be added to the domain metamodel (above bounded context); Node and Resource to the architecture metamodel's deployment view, which today rules them out; Lineage to the Data & Operation metamodel. The alternative is to keep all four here and leave the existing metamodels untouched.
3. **One file or several.** A single enterprise file, or one per package (strategy, organization, governance, transformation) so that each can be owned and reviewed separately?
4. **How a plateau selects elements.** By explicit membership, by a tag on each element, or by a revision of the repository that holds the models (a plateau as a named commit)?
5. **Goal naming.** The PRD metamodel already has `goal`. Keep the same word at both scopes, or rename the enterprise one (`objective`)?
6. **Rule language.** Rules need a way to select elements and state a constraint over them. Reuse the predicate language of `.dataop` contracts, or keep rules as prose plus a named fitness function?
7. **Element references.** A syntax for pointing into another Specy file (`DecisionEngine.ScoreLookup -> LegacyScoring` above) has to be defined once and shared by rules, waivers, ownerships, gaps and plateaus.
