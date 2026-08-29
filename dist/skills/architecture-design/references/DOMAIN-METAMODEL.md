<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Domain model metamodel](#domain-model-metamodel)
  - [Convention](#convention)
  - [Organization](#organization)
    - [Bounded Context](#bounded-context)
    - [Context map patterns](#context-map-patterns)
      - [Upstream patterns](#upstream-patterns)
      - [Open Host Service (OHS)](#open-host-service-ohs)
      - [Downstream patterns](#downstream-patterns)
      - [Customer / Supplier (C/S)](#customer--supplier-cs)
      - [Conformist (Conf)](#conformist-conf)
      - [Anti-Corruption Layer (ACL)](#anti-corruption-layer-acl)
      - [Symmetric patterns](#symmetric-patterns)
      - [Shared Kernel (SK)](#shared-kernel-sk)
      - [Published Language (PL)](#published-language-pl)
      - [Partnership (P)](#partnership-p)
      - [Separate Ways](#separate-ways)
  - [Module](#module)
  - [Interface](#interface)
  - [Behavior: Command, Operation and Reaction](#behavior-command-operation-and-reaction)
    - [Operation](#operation)
      - [Precondition and postcondition](#precondition-and-postcondition)
    - [Command](#command)
    - [Reaction](#reaction)
  - [Entity](#entity)
  - [State machine](#state-machine)
  - [Read-only Entity (Master Data)](#read-only-entity-master-data)
  - [Aggregate](#aggregate)
  - [Repository](#repository)
  - [Query](#query)
  - [Event](#event)
    - [Internal Event](#internal-event)
    - [External Event](#external-event)
    - [Error Event](#error-event)
    - [Temporal Event](#temporal-event)
      - [Relative temporal event](#relative-temporal-event)
      - [Absolute temporal event](#absolute-temporal-event)
      - [Recurring temporal event](#recurring-temporal-event)
      - [Guard expression](#guard-expression)
      - [Recomputation heuristic](#recomputation-heuristic)
      - [Differentiators with other event types](#differentiators-with-other-event-types)
  - [Value Type](#value-type)
  - [Enums (Referential)](#enums-referential)
  - [Domain Service](#domain-service)
  - [Application Service](#application-service)
  - [Infrastructure Service](#infrastructure-service)
  - [Property - Invariant, Condition & Agreement](#property---invariant-condition--agreement)
    - [Invariant](#invariant)
    - [Condition (precondition and postcondition)](#condition-precondition-and-postcondition)
      - [Precondition](#precondition)
      - [Postcondition](#postcondition)
      - [Invariant vs condition](#invariant-vs-condition)
    - [Agreement and Reconciliation](#agreement-and-reconciliation)
      - [Agreement](#agreement)
      - [Reconciliation](#reconciliation)
        - [Escalation chain](#escalation-chain)
  - [Requirement Traceability](#requirement-traceability)
    - [When traceability is required](#when-traceability-is-required)
    - [How traceability works](#how-traceability-works)
    - [Traceability by concept type](#traceability-by-concept-type)
    - [Bidirectional traceability](#bidirectional-traceability)
  - [Software System's Message Surface](#software-systems-message-surface)
    - [Inbound communication (System is Driven)](#inbound-communication-system-is-driven)
    - [Outbound Communication (System is Driving)](#outbound-communication-system-is-driving)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->




# Domain model metamodel

This file defines a Domain-Driven Design metamodel for creating domain models.

## Convention

Every concept in this metamodel carries a name, a description, a metadata map (a set of arbitrary key/value pairs), and a **satisfies** list (zero or more system requirement identifiers). These attributes are implicit and not repeated in each definition below.

The `satisfies` list is the traceability bridge from the domain model back to the system requirement layer (see SYSTEM-REQ-METAMODEL.md). When system requirements are provided as input and each requirement carries an identifier (e.g. `REQ-ORD-001`), **every domain model element that realizes a requirement MUST include the corresponding requirement identifier(s) in its `satisfies` list**. This applies to all concepts defined in this metamodel: entities, aggregates, value types, operations, commands, queries, events (all subtypes), state machines, invariants, reactions, agreements, reconciliations, domain services, application services, infrastructure services, interfaces, and modules.

If no system requirements are provided as input, the `satisfies` list is left empty — it is always optional in the schema but mandatory in practice when requirements exist.

When the system requirements are loaded from a file, the domain model MUST declare a **requirements-source** attribute at the top level (on the organization or bounded context) containing the relative path to that file. This makes the provenance of requirement identifiers explicit and machine-resolvable — any agent or tool can follow the path to read the full requirement text, check coverage, or detect drift.

## Organization

An organization groups bounded contexts. It serves as the top-level container for the domain model.

Relations:
- 1..n "has" relation with bounded contexts

### Bounded Context

A boundary within which a model is well-defined and its language is consistent. Words, types, and rules inside a bounded context share a single meaning. A bounded context has a shortname. A bounded context must not be used for decomposition into different modules, in doubt use a module. Interactions between bounded contexts should be asynchronous. Transactions cannot span across bounded contexts — there is a rupture of transactional consistency at context boundaries.

Relations:
- 0..n "has" relation with modules
- 1..1 "belongs to" relation with an organization
- 0..n relation with other bounded contexts, characterized by position and pattern:
  - **upstream**: Open Host Service (OHS)
  - **downstream**: Customer/Supplier (C/S), Conformist (Conf), or Anti-Corruption Layer (ACL)
  - **symmetric**: Shared Kernel (SK), Published Language (PL), Partnership (P), or Separate Ways


### Context map patterns

A context map pattern defines the behavioral constraints that govern how two bounded contexts interact. The pattern determines who controls the shared model, how translation happens, and what coupling is accepted. Each pattern imposes specific obligations on message handling, model evolution, and dependency management.

Patterns are grouped by the position of the bounded context in the relationship: upstream (the context that provides), downstream (the context that consumes), or symmetric (both contexts share responsibility).

#### Upstream patterns

#### Open Host Service (OHS)

The upstream context exposes a well-defined, stable protocol for all its consumers. The protocol is designed for general use, not tailored to any single downstream context.

Constraints:
- The upstream context shall publish a versioned interface (API, message schema, or event contract) that serves as the single integration point for all downstream consumers.
- The upstream context shall not modify the published interface in ways that break existing consumers without a versioning and deprecation strategy.
- The upstream context shall not accommodate the specific model of any single downstream context in its published interface — the interface reflects the upstream model only.
- Downstream contexts are responsible for translating the upstream protocol into their own model. The upstream context has no obligation to understand or adapt to downstream models.

Typical use: a bounded context that serves multiple consumers and needs a stable, public-facing contract.


#### Downstream patterns

#### Customer / Supplier (C/S)

The downstream context (customer) has influence over the upstream context (supplier). The upstream context accommodates reasonable requests from the downstream context regarding the shared interface.

Constraints:
- The upstream context shall accept feature requests and prioritization input from the downstream context regarding the shared interface.
- The upstream context shall negotiate interface changes with the downstream context before deploying them.
- The downstream context shall communicate its needs explicitly (expected message formats, required data, timing constraints).
- Both contexts shall agree on acceptance criteria for the shared interface, ideally expressed as contract tests that both sides run independently.
- The downstream context may still need a translation layer but has leverage to reduce the translation burden by shaping the upstream interface.

Typical use: two teams in the same organization where the downstream team's delivery depends on the upstream team's output and has enough organizational standing to negotiate.

#### Conformist (Conf)

The downstream context adopts the upstream context's model as-is, with no translation. The downstream context conforms to whatever the upstream provides.

Constraints:
- The downstream context shall use the upstream model's types, naming, and structure directly in its own domain layer — no translation layer, no local model divergence.
- The downstream context shall accept that changes in the upstream model propagate directly into its own model, with no buffering or adaptation.
- The downstream context shall not request changes to the upstream model — it has no negotiating power or chooses not to exercise it.
- The downstream context accepts full coupling to the upstream model's evolution. A breaking change upstream is a breaking change downstream.

Typical use: integrating with a dominant external system (e.g. a regulatory body's data model, a platform API) where the cost of translation outweighs the cost of coupling, or where the upstream context is unwilling to negotiate.

#### Anti-Corruption Layer (ACL)

The downstream context builds an explicit translation layer that isolates its own model from the upstream model. The upstream model never leaks into the downstream domain.

Constraints:
- The downstream context shall implement a translation component (the ACL) that converts upstream messages, types, and concepts into the downstream context's own ubiquitous language before they enter the domain layer.
- The downstream domain layer shall never reference upstream types, naming, or structure directly — all upstream concepts are translated at the boundary.
- The ACL shall be the sole point of contact between the two contexts. No domain object, domain service, or application service in the downstream context shall call the upstream context directly.
- The ACL shall handle upstream model evolution: when the upstream changes, only the ACL needs modification — the downstream domain model remains stable.
- The ACL is an infrastructure service in the downstream context's hexagonal architecture.

Typical use: integrating with a legacy system, an external API with a model that conflicts with the downstream domain, or any upstream context where model leakage would corrupt the downstream ubiquitous language.


#### Symmetric patterns

Symmetric patterns apply when neither context is strictly upstream or downstream — both share responsibility for the integration.

#### Shared Kernel (SK)

Both contexts share a common subset of the model (types, events, interfaces) that they co-own and co-evolve.

Constraints:
- Both contexts shall agree on the exact boundary of the shared kernel: which types, events, and interfaces are shared, and which remain private to each context.
- Neither context shall modify the shared kernel unilaterally — all changes require coordination and agreement from both sides.
- Both contexts shall run shared tests (contract tests or integration tests) against the kernel to verify compatibility after any change.
- The shared kernel shall be kept as small as possible. Any concept that can be owned by a single context should not be in the kernel.
- The shared kernel introduces tight coupling between the two contexts' release cycles. Both teams shall coordinate deployments when the kernel changes.

Typical use: two closely collaborating teams working on overlapping domain concepts where the cost of translation (ACL) outweighs the cost of coordination.

#### Published Language (PL)

Both contexts communicate through a well-documented, shared language (schema, standard, or protocol) that is not owned by either context.

Constraints:
- Both contexts shall translate their internal models to and from the published language at their boundaries — neither context uses the published language as its internal model.
- The published language shall be documented independently of both contexts (as a schema definition, specification document, or industry standard).
- Changes to the published language shall follow a governed process (versioning, review) that neither context controls unilaterally.
- Both contexts shall validate inbound messages against the published language schema before translation.

Typical use: integration via industry standards (HL7 in healthcare, FIX in finance, EDI in supply chain), shared event schemas in an event-driven architecture, or any situation where a neutral interchange format reduces bilateral coupling.

#### Partnership (P)

Both contexts are developed by teams that coordinate closely and succeed or fail together. Neither dominates; both adapt their models to serve the integration.

Constraints:
- Both teams shall plan and prioritize integration work jointly — neither team can unilaterally deprioritize the shared interface.
- Both contexts shall adapt their interfaces when the other context's needs change, through mutual negotiation.
- Integration failures are treated as shared problems — neither team can declare the issue "on the other side."
- Both teams shall maintain joint integration tests that verify the interaction between the two contexts.
- The partnership implies synchronized development cadence. If one team accelerates or slows, the integration surface is at risk.

Typical use: two teams building complementary parts of a core business flow where the boundary between them is somewhat arbitrary and could shift.

#### Separate Ways

Both contexts decide not to integrate. Each context solves its own problems independently, even if that means duplicating concepts or functionality.

Constraints:
- Neither context shall depend on the other's model, messages, events, or interfaces in any way.
- If both contexts need similar functionality or data, each shall implement its own version independently.
- No translation layer, shared kernel, or published language exists between the two contexts.
- The decision to go separate ways shall be explicit and documented, including the rationale (e.g. integration cost exceeds benefit, domains are genuinely independent, team autonomy is prioritized).
- The decision shall be revisited periodically — separate ways is often a temporary choice that becomes permanent by inertia.

Typical use: contexts that operate in genuinely distinct domains with no meaningful data or process overlap, or contexts where the organizational cost of coordination exceeds the technical cost of duplication.


## Module

A unit of decomposition that groups related domain concepts behind a controlled interface. A module encapsulates its internals and exposes only its API interfaces; everything else stays hidden. A module should always be preferred to Bounded Context for pure decomposition of concerns or if the user states it should be context.

A module's two interface relations are not symmetric. The **APIs** it exposes are its public surface — what consumers may call. The **SPIs** it depends on are the capabilities it needs from the outside, stated in its own language; they are part of the module's requirements, not of its public surface. A consumer reads a module's APIs to know what it offers, and its SPIs to know what it must be given.

Relations:
- 0..n "exposes" relation with interfaces playing the API role (the module's public surface)
- 0..n "depends on" relation with interfaces playing the SPI role (the ports the module requires; adapters implement them outside the domain)
- 0..n "depends on" relation with other modules
- 1..1 "belongs to" relation with a bounded context

## Interface

A named contract: a set of operation signatures stated independently of the artefact that owns or implements them. In the hexagonal architecture an interface is a **port**, and it plays one of two roles depending on which side of the domain it sits. Every interface declares its role.

**API — driving port (inbound).** The interface *selects*: it exposes a subset of the operations already owned by the entities, aggregates, domain services or application services of its module, and makes exactly that subset visible to consumers (other modules, the presentation layer, the outside world). The operations remain owned by their artefact; the interface only decides what is visible. Everything a module does not expose through an API stays hidden.

**SPI — driven port (outbound).** The interface *defines*: it states the operations the domain **needs from** an external capability, expressed in the domain's own ubiquitous language. It is the contract that an infrastructure service — or a repository, which is a kind of infrastructure service — fulfils. The domain layer depends only on the SPI; an adapter in the infrastructure layer implements it. The Anti-Corruption Layer is the archetypal SPI.

Both roles are the same construct. What separates them is **who owns the contract**: in an API the operations pre-exist and the interface publishes them; in an SPI the interface comes first and the provider is written to satisfy it. In both cases the dependency points inward, toward the domain — which is what makes them ports rather than mere signatures.

| | API | SPI |
|---|---|---|
| **Position** | Driving port — the domain is called | Driven port — the domain calls out |
| **Operations come from** | Entities, aggregates, domain services, application services | Infrastructure services, repositories |
| **Who owns the contract** | The owning artefact; the interface selects from it | The domain; the provider conforms to it |
| **Who implements** | The artefact that already owns the operations | An adapter in the infrastructure layer |
| **Typical use** | Publishing a module's use cases to its consumers | Persistence (repository), payment gateway, notification, ACL |

Relations:
- 1..1 "plays" relation with a role (`API` or `SPI`)
- 1..n "exposes" relation with operations (the signatures that make up the contract)
- 1..n "exposes from" relation with entities, aggregates, domain services or application services — API only (the artefacts whose operations this interface publishes)
- 1..1 "describes" relation with an infrastructure service or a repository — SPI only (the provider whose contract this interface defines)
- 0..n "used by" relation with entity or domain service operations — SPI only (the domain operations that depend on this contract)
- 1..1 "belongs to" relation with a module

## Behavior: Command, Operation and Reaction

### Operation

A named unit of behavior with typed input arguments and one typed output (which may be an error). An operation is either safe (no mutation, read-only) or unsafe (mutates domain state). An operation is either idempotent or not. An operation may emit multiple events, including errors that must be explicitely defined as Error event.

Ownership and exposure are distinct: an operation is owned by exactly one artefact, and an interface only publishes (API) or defines (SPI) operations — it never owns them. State machine transitions reference entity operations.

An operation may declare preconditions and postconditions.

Relations:
- 1..1 "owned by" relation with entity, aggregate, domain service, application service, infrastructure service, repository or value type (mutually exclusive, an operation has exactly one owner)
- 0..1 "handles" relation with a command (the operation side owns this edge — in the DSL: `"Label" on CommandType`; the command's `triggers` and `targets` relations are derived from it)
- 0..n "exposed by" relation with interfaces
- 0..n "emits" relation with events
- 0..n "has" relation with preconditions
- 0..n "has" relation with postconditions

#### Precondition and postcondition

A condition is a named predicate expression over the operation's arguments and, if the operation belongs to an entity, its state.

- A **precondition** on an interface operation references arguments only. A precondition on an entity operation references both state and arguments. Each precondition declares a violation reason.
- A **postcondition** evaluates over state-before, state-after, and arguments: `P(state_before, state_after, arguments) -> boolean`.

Conditions are properties: they are declared here, on the operation, but they belong to the same family as invariants. See [Condition (precondition and postcondition)](#condition-precondition-and-postcondition) for how they relate to invariants and how each is enforced.


### Command

An inbound message expressing an intention to change domain state. A command triggers an operation (owned by an entity, aggregate or a service), which produces one or more events as its result. A command must always include an identifier field (that will represent the correlation id in the chain of causality downstream). The command separates the stimulus with all its details that triggers the effects (the operation)

A command succeeds or fails. Success implies at least one state change occurred. Failure produces an error event.

The command's target is **derived, not declared**: it is the owner of the operation that handles the command. In the DSL the link is declared by the inverse edge — the owning artefact's operation names the command it handles (`"Place order" on PlaceOrder`) — so the target and the triggered operation can never disagree. This is also what lets a command reach behavior that spans entities: an intention that targets no single entity — `TransferMoney` between two accounts — is handled by a domain service operation, and the command's target is that domain service.

**Naming**: Commands use a verb in present tense or infinitive followed by a domain noun (the target entity or aggregate type). Example: `PlaceOrder`, `CancelBooking`.

Relations:
- 1..1 "belongs to" relation with a module (the module of the operation that handles it)
- 1..1 "triggers" relation with the operation that handles this command (declared on the operation side — see Operation's "handles" relation)
- 1..1 "targets" relation with entity, aggregate or domain service — derived: the target is the triggered operation's owner
- 1..n "produces" relation with events (success events or error events)

### Reaction

A reaction listens to events and issues a command in response to perform effects. It has a name (anchored in the ubiquitous language), a trigger (one or more event references), a guard (a condition that must hold for the reaction to fire), and an effect (a command reference).

**A reaction is the only way an event causes a command.** It is uniform across the four event types — internal, external, error and temporal: whatever raised the event, the way the domain responds to it is a reaction. An event never reaches a command directly. This gives every event the same three things: a named rule in the ubiquitous language, a guard, and an explicit effect.

The guard is what makes the uniformity worth having. It is a predicate over domain state, evaluated when the event arrives; if it is false, the reaction does not fire and no command is issued. Without it, consuming an event would mean issuing its command unconditionally — so "when `PaymentSettled` arrives, release the order **only if** it is still held" would have nowhere to live. A reaction with no guard fires on every occurrence of its trigger.

Relations:
- 1..n "triggered by" relation with events (internal, external, error or temporal — any event type)
- 0..1 "guarded by" predicate expression over domain state (evaluated when the event arrives; the reaction fires only if it holds)
- 1..1 "effects" relation with command (the command issued when the reaction fires)


## Entity

A domain concept with a fixed identity and a lifecycle. An entity changes through time; its identity stays the same. Two entities are equal if and only if their identities are equal.

**Structure**: An entity holds fields. Each field is typed as a primitive type (String, Integer, Boolean, Float, Date, DateTime, …), a value type, or a reference to another entity. A value type used as a field type is embedded — it is owned by the entity instance and has no independent identity. The same value type definition can be embedded in many different entities. The entity's state — often named with a past participle — is the complete set of its field values (primitives and embedded value types) at a given point in its lifecycle.

**Behavior**: An entity owns operations, named with verbs. Each operation takes the entity as its first explicit argument and returns the entity in its next state. An entity may relate to other entities.

**State machines**: An entity may have one or more state machines that structure how operations drive transitions. Multiple state machines must govern disjoint aspects of the entity's state.

**Duplicate detection**: An entity declares a duplicate detection predicate over candidate fields, evaluated through its repository.

**Repository**: Each entity derives a repository with core operations (store, getById, remove, search) plus findByField operations deduced from use cases. If the entity belongs to an aggregate, only the aggregate root has a repository. See [Repository](#repository) for the full definition.

**Naming**: Entity types are named with a noun.

Relations:
- 1..1 "belongs to" relation with a module
- 0..n "owns" relation with operations
- 0..n "has" relation with state machines
- 0..1 "derives" relation with repository (absent if the entity belongs to an aggregate as a non-root child)
- 0..n "relates to" relation with other entities
- 0..n "constrained by" relation with invariants

## State machine

A state machine structures the lifecycle of an entity through an explicit set of states and transitions.

- One start state, zero or more final states.
- Each state carries its own invariants.
- Transitions connect states. Each transition has preconditions (guards) and postconditions.
- Entity operations trigger transitions; the transition is the effect of the operation.
- An operation may participate in transitions from multiple states and therefore raise different events depending on the source state.
- The set of valid transitions from each state is finite and enumerable.

Relations:
- 1..1 "belongs to" relation with entity
- 1..n "has" relation with states
- Each transition 1..1 "triggered by" relation with an entity operation

## Read-only Entity (Master Data)

A read-only entity is a kind of entity whose state is owned by another bounded context or an external system. Within this bounded context it is observable but not mutable — operations that change its state do not exist locally, and its repository exposes only read operations.

Common examples are the master-data archetypes: `Customer`, `Supplier`, `Product`. They are referenced by other entities, aggregates or domain service of this context (e.g. an `Order` references a `Product`) but their lifecycle is governed elsewhere.

A read-only entity is kept in sync with its source through one of two patterns:

- **Synchronous lookup**: this context issues a query to the upstream context every time it needs the entity's current state. No local copy.
- **Asynchronous projection**: this context subscribes to the upstream context's events and maintains a local read-model that is updated each time a relevant event arrives.

The entity declares its sync pattern explicitly. Its repository derives only read operations (`getById`, `findByField`, `search`) — no `store`, no `delete`, no `update`. Unsafe domain operations (state-changing operations) defined locally on a read-only entity are forbidden, only safe operations are permitted; the entity is structural, not behavioural.

**The projection write path**: an asynchronous projection must nevertheless be *written* — the local read-model changes each time an upstream event arrives. That write is not a domain operation and does not contradict the rules above, because it happens **outside the domain layer**. The projection is maintained by the adapter that implements the read-only entity's SPI: the adapter subscribes to the upstream context's events, translates them into the local representation (it is an Anti-Corruption Layer), and refreshes the read-model behind the port. The domain layer never sees the write; it only ever reads through the repository's read operations, and what it reads is a fact already established upstream.

Two rules follow, and both are auditable:

- **The domain declares no reaction, no command and no operation for projection maintenance.** If a model contains a command whose only purpose is to update a read-only entity's local copy, the read-only entity has been misidentified — the state is in fact owned by this context, and the entity should be a normal entity.
- **The upstream events that feed the projection are not modeled as external events of this context.** An external event is one this context *reacts to* with domain behavior. An event consumed solely to refresh a projection has no domain consequence here; it is part of the adapter's contract with the upstream context, and the model records it — if at all — as metadata on the sync pattern, not as a domain event.

The consequence for the modeler is a sharp test: *does an upstream event change what this context decides, or only what it knows?* If it changes a decision, model it as an external event with a reaction. If it only refreshes knowledge, it belongs to the projection adapter and stays out of the domain model.

Relations:
- 1..1 "sourced from" relation with an upstream bounded context or external system
- 0..1 "synced via" relation with a sync pattern (`synchronous-query` or `asynchronous-projection`)
- 0..1 "projected by" relation with an infrastructure service — asynchronous projection only (the adapter that subscribes upstream and refreshes the local read-model behind the repository's SPI)


## Aggregate

A group of entities with a designated root among that entities (the aggregate itself) that enforces the integrity of the whole. All state changes pass through the root; every operation evaluates the aggregate's invariants. An aggregate is itself an entity — all entity rules apply.

Relations (in addition to all entity relations):
- 1..n "contains" relation with entities (the cluster of entities inside the aggregate boundary, excluding the root as it is the aggregate)
- 0..n "constrained by" relation with invariants (aggregate-level invariants that span the whole cluster)

## Repository

A repository is the collection-like abstraction through which the domain retrieves and persists entities and aggregate roots. It presents persistence as if it were an in-memory collection of domain objects keyed by identity, hiding the underlying data store entirely. The domain layer depends only on the repository's interface — a port in the hexagonal architecture — while an adapter in the infrastructure layer provides the concrete implementation.

A repository is **derived, not hand-authored**: it falls out of its owning entity or aggregate root together with the use cases that read its state. The modeler does not invent repositories — each entity that needs persistence implies one, and every criteria-based query implies a corresponding finder on it.

**Derivation rule**: Each persisted entity derives exactly one repository. When an entity belongs to an aggregate, only the aggregate root derives a repository — non-root child entities are reached only by navigating from the root, never through a repository of their own. This keeps the aggregate the unit of both consistency and access.

**Operations**: A repository provides a core set of operations — `store`, `getById`, `remove`, `search` — plus `findByField` operations deduced from the use cases that need them. Retrieval is always by identity (`getById`) or by criteria (`findByField`, `search`). A repository never exposes operations that mutate domain state; it only stores or removes whole domain objects. Mutation of an entity's state is the responsibility of the entity's own operations, after which the result is handed back to the repository to `store`.

**Read surface**: A repository is the read surface that queries target. Whereas commands flow through entity operations, queries read current state directly from the repository.

**Read-only repositories**: A repository derived from a read-only entity (master data) exposes read operations only — `getById`, `findByField`, `search` — and never `store` or `remove`, because the entity's state is owned by an upstream context or external system (see [Read-only Entity](#read-only-entity-master-data)).

**Naming**: Repositories are named after the entity or aggregate root they serve, suffixed with `Repository`. Example: `OrderRepository`, `CustomerRepository`.

Relations:
- 1..1 "derived from" relation with entity or aggregate root (the domain object whose persistence it manages; absent for non-root child entities of an aggregate)
- 1..n "provides" relation with operations (`store`, `getById`, `remove`, `search`, and deduced `findByField` operations)
- 1..1 "described by" relation with an interface playing the SPI role (the persistence port the domain depends on; an adapter in the infrastructure layer implements it)
- 0..n "read by" relation with queries (a query reads current state through the repository's read surface)
- 1..1 "belongs to" relation with the module of its owning entity or aggregate


## Query

An inbound message requesting current state. A query is safe and idempotent — it produces no side effects.

A query carries either an identifier (to retrieve one entity) or match fields (to search). Results succeed (with data, possibly paginated) or fail (not found).

**Naming**: `get` + noun (identifier-based) or `find` + noun (criteria-based). Example: `getOrder`, `findOverdueInvoices`.

Relations:
- 1..1 "belongs to" relation with a module (the module of the repository it reads from)
- 1..1 "reads from" relation with repository (the read surface of the targeted entity or aggregate)


## Event

A recorded fact about something that happened in the domain. Events are append-only: they cannot be retracted, only superseded by a subsequent event. An event may reference the command or query identifier that caused it. An event related to an entity must always include a field that references the entity identifier.

What raises an event depends on its subtype — the base concept deliberately carries no `raised by` relation. An internal or error event is raised by an operation within this context; an external event originates in an upstream bounded context; a temporal event fires when a time condition anchored to a domain reference is met. Each subtype declares its own origin relation below.

**Naming**: Events use a past participle. Example: `OrderPlaced`, `PaymentReceived`.

Relations:
- 1..1 "belongs to" relation with a module (inherited by all four subtypes: for an internal or error event, the module of the operation that raises it; for an external event, the module that declares and reacts to it; for a temporal event, the module of its temporal anchor)
- 0..1 "caused by" relation with command or query (the correlation/causation link to the originating message)

### Internal Event

An event raised within the bounded context from an entity state transition. Internal events can trigger reactions.

Relations:
- 0..n "triggers" relation with reactions
- 1..1 "raised by" relation with operation (the operation whose execution produced this event)

### External Event

An event originating from an upstream bounded context. If the external event doesn't have an id we should add one that will act as a correlation id for the chain of causality.

An external event is consumed through a reaction, exactly like an internal event: the reaction names the rule, guards it against local state, and issues the resulting command. The external event does not reach a command directly — the guard is what lets this context decide whether the upstream fact is still relevant to it, which matters more for external events than for any other type, since the upstream context knows nothing of local state.

An external event is declared only when this context **reacts** to it with domain behavior. An upstream event consumed solely to refresh a local read-model is not an external event — it belongs to the projection adapter (see [Read-only Entity](#read-only-entity-master-data)).

Relations:
- 0..n "triggers" relation with reactions
- 1..1 "sourced from" relation with an upstream bounded context or external system

### Error Event

An error raised by an operation is a special case of event. Error events can be referenced by reactions.

Relations:
- 0..n "triggers" relation with reactions
- 1..1 "raised by" relation with operation (the operation whose execution produced this event)

### Temporal Event

A temporal event is a domain fact caused by the passage of time. Unlike internal events (caused by an operation that emit it) or external events (caused by an upstream BC), a temporal event fires because a time condition — anchored to an domain reference as an instant field — has been met.

A temporal event is an event. It inherits all event properties: it is a recorded fact, it is append-only, it can trigger reactions, and it maintains the causality chain. Every temporal event has a domain-rooted cause — time alone is never the cause; the cause is the domain event, entity field (of type Instant), or schedule that establishes the temporal reference.

A temporal event has three flavors, determined by its trigger type:

#### Relative temporal event

Fires after a duration elapses from a reference event. The causality chain flows from the reference event: if the reference event never fires, the temporal event never exists.

A relative temporal event has:
- **reference**: the event that starts the countdown.
- **offset**: a duration expression, which may be a fixed duration or a computed expression referencing entity state (e.g., `ride.estimatedDriverArrivalTime + 5 minutes`).
- **guard**: a predicate over entity state evaluated at firing time. If the guard is false when the moment arrives, the event does not fire. The guard absorbs cancellation logic — no separate armed/fired/cancelled lifecycle is needed.

Example: "Driver arrival deadline elapsed" — fires `ride.estimatedDriverArrivalTime + 5 minutes` after `RideCreated`, guarded by `ride.status = driverEnRoute`. If the driver arrives before the deadline (status changes to `driverArrived`), the guard is false and the event is suppressed.

#### Absolute temporal event

Fires at a specific instant described by an entity field. The causality chain flows from the operation that set the field: if the entity is never created, no temporal event exists.

A absolute temporal event has:
- **instant**: a reference to an entity field of type datetime that defines when the event fires.
- **guard**: a predicate over entity state evaluated at firing time.

Example: "Promotional credit expired" — fires at `credit.expiryDate`, guarded by `credit.status = active`. If the credit was already used, the guard is false and the event is suppressed.

#### Recurring temporal event

Fires on each occurrence of a schedule expression. The causality chain is the schedule definition itself — a standing domain commitment established at system design time.

A recurring temporal event has:
- **schedule**: a cron-like expression defining the recurrence pattern.
- **guard**: a predicate over system state evaluated at each occurrence.

Example: "Weekly payout cycle due" — fires every Monday at 00:00 UTC, guarded by `true` (always fires on schedule).

#### Guard expression

The guard is the mechanism that absorbs both cancellation and conditional firing. At firing time, the system evaluates the guard predicate against current entity state. If the guard evaluates to false, the temporal event is silently suppressed — no event is recorded, no reaction triggers.

The guard expression has access to the entity state referenced by the temporal event's context. A temporal event with no guard (or `guard: true`) fires unconditionally when its time condition is met.

#### Recomputation heuristic

When the reference instant can change after the temporal event is armed (e.g., a route recalculation updates the ETA), the modeler should define an explicit **recomputation reaction** that:
1. Listens to the event that changes the reference value.
2. Cancels or re-arms the temporal event with the updated firing time.

The recomputation reaction is a regular reaction — no special metamodel construct is needed. The metamodel documents this as a modeling heuristic: *whenever a temporal event's offset or instant depends on a mutable value, the modeler must identify which events can change that value and define a reaction that re-arms the deadline accordingly.* Failure to do so is a modeling gap detectable by audit.

#### Differentiators with other event types

| | Internal Event | External Event | Error Event | Temporal Event |
|---|---|---|---|---|
| **Cause** | An operation within the BC | An upstream BC | An operation failure | Time, anchored to a domain reference |
| **Firing** | Synchronous with operation | Asynchronous from upstream | Synchronous with operation | Asynchronous from clock |
| **Suppression** | Cannot be suppressed | Cannot be suppressed | Cannot be suppressed | Guard can suppress at firing time |
| **Triggers** | Reactions | Reactions | Reactions | Reactions |

All four types are consumed the same way — through a [reaction](#reaction), whose guard decides whether the event leads to a command. What differs between them is what *raises* the event, not what the domain does with it. Note that a temporal event's guard is evaluated twice over: once at firing time (suppressing the event itself, so no fact is ever recorded) and again in any reaction that consumes it.

Relations:
- 1..1 "references" relation with event (for relative), entity field (for absolute), or schedule expression (for recurring) — the temporal anchor that roots the causality chain
- 0..1 "offset by" duration expression (for relative temporal events only)
- 0..1 "guarded by" predicate expression over entity state (evaluated at firing time)
- 0..n "triggers" relation with reactions 


## Value Type

An immutable domain concept defined entirely by its attributes. Two values are equal if and only if all their attributes are equal.

A value measures, quantifies, or describes a domain thing. Values may be ordered. Values compose — a value can contain other values.
Values may be ordered and has constraints enforced at creation with a "transactional" constructor (exist if fields are valid, otherwise creation is impossible).
A value has fields (typed as primitive types or other value types) and operations. Operations on a value return a new value.

A value type can be embedded in one or more entities as a field type. When embedded, the value type instance is owned by the entity — it has no independent identity or lifecycle. The same value type definition may appear as a field in many different entities: for example, an `Address` value type can be embedded in both a `Customer` entity and a `Warehouse` entity.

Relations:
- 0..n "composes" relation with other value types (a value can contain other values)
- 0..n "embedded in" relation with entities (the entities that use this value type as a field type)
- 0..n "has" relation with operations (behavior on the value; operations return new values)

## Enums (Referential)

An enum is a closed, named set of values used to constrain a field to a known finite range. The values may be primitive (a string or a number) or instances of an existing value type. Enums have no identity and no lifecycle of their own — they are purely referential.

When an enum's values are instances of a value type, the value type must declare a **code field** (typically named `id`, `code`, or `symbol`) that serves as the unambiguous reference to each value. The code is what other parts of the system use to refer to the value.

**Example.** The `Currency` value type carries:
- a code — the ISO 4217 alphabetic code (`USD`, `EUR`, `GBP`, …)
- a precision — the default number of fraction digits
- a display name (e.g. "US Dollar")
- a symbol (e.g. "$")

The `Currencies` enum holds every defined `Currency` value. Other parts of the system reference a currency by its code alone (e.g. an `Amount` field of type `currency: Currency` can be set with `Currencies.USD`), making the reference unambiguous and stable as the value type's other fields evolve.

**Naming**: enums are named with a noun, typically pluralized when they hold value-type instances (`Currencies`, `Roles`) and singular when they hold a closed set of primitive labels (`Severity`, `PaymentMethodType`).

Relations:
- 0..1 "references" relation with the value type whose instances populate the enum (omitted when the enum holds primitive values)
- 1..n "holds" relation with values (the closed set of enum members)
- 0..n "constrains" relation with fields (a field of enum-typed type is restricted to one of the enum's values)

## Domain Service

A named set of operations that span multiple entities or aggregates, where assigning ownership to any single one would be arbitrary. A domain service may invoke domain objects, and domain objects may invoke a domain service. A domain service may change the state of one or several entities or aggregates, if not the domain service must "do something" and produce a result. Typical example: a transfer service between two bank accounts doesn't belong to either the source or target account but the domain service orchestrates the state change in both account. 

Relations:
- 1..n "owns" relation with operations
- 0..n "targeted by" relation with commands
- 1..1 "belongs to" relation with a module
- 0..n "calls" relation with infrastructure service


## Application Service

An orchestrator that interprets requests from the presentation layer (API controllers, UI handlers) and delegates to domain services and domain objects. Application services manage use-case state but contain no domain logic. An application service is tied to a particular set of technologies (e.g. HTTP protocol and JSON for a REST API controller).

Relations:
- 1..n "owns" relation with operations
- 0..n "delegates to" relation with domain services, entities or aggregates
- 1..1 "exposed by" relation with an interface playing the API role (the driving port through which consumers reach this service's operations)
- 1..1 "belongs to" relation with a module


## Infrastructure Service

An adapter that exposes an external system's capabilities through the domain's ubiquitous language. Domain objects call infrastructure services, never the reverse. Infrastructure services belong to the infrastructure layer of the hexagonal architecture.
An infrastructure service is described by an interface called an SPI (Service Provider Interface) whose operations are consumed by entity operations or domain service operations. The interface defines the contract; an adapter provides the implementation for the real infrastructure component. The repository is a kind of infrastructure service as it exposes persistence and querying capabilities to each entities of the domain layer.

The Anti-Corruption Layer (ACL) pattern is implemented as an infrastructure service.

Relations:
- 1..n "owns" relation with operations (the operations that fulfil the SPI contract)
- 1..1 "described by" relation with an interface playing the SPI role (the driven port whose contract this service fulfils)
- 0..n "used by" relation with entity operations or domain service operations (domain objects depend on the infrastructure service's SPI, never the reverse)
- 1..1 "belongs to" relation with a module


## Property - Invariant, Condition & Agreement

Properties constrain system behavior.
A property has a name (anchored in the domain's ubiquitous language), a scope (the entity, domain service or value type that enforces the property holds). A property separates what must hold (a predicate for invariant, a pre or post-condition) from the enforcement mechanism (in which behavior the invariant is verified, and what happens when an invariant is violated).

### Invariant

Invariants are safety properties: rules that must hold true at every point within a consistency boundary. They are synchronous, checked at a point in time, and scoped to a single aggregate, entity or value type.
Examples: "An order total must equal the sum of its line items." "A booking cannot overlap with another booking for the same resource."

An invariant is "a named boolean expression over state that must evaluate to true at every observable point". Invariant(state) -> true.
An invariant is enforced depending on its scope whenever a state mutation occurs for that entity or aggregate. Enforcement strategies are: rejection (the operation is refused and no state change occurs), compensation (the state change is accepted and a corrective command is issued), or alert (the violation is recorded for review). Each invariant shall declare its enforcement strategy (at construction, in operation not related to the current state, it's essentially related to every beheavior that could violates the invariant as a result).
Each state from a state machine carries its own invariants (what must be true while in this state).
An entity-level invariant must hold across all states of the entity's lifecycle. A state-scoped invariant must hold only while the entity occupies that specific state. State-scoped invariants are implicitly conjoined with entity-level invariants — both must hold simultaneously while the entity is in that state.

Relations:
- 1..1 "scoped to" relation with entity, aggregate, value type or state of an entity (the consistency boundary this invariant protects)


### Condition (precondition and postcondition)

A condition is a property whose scope is a **behavior** — an operation or a state machine transition — rather than a consistency boundary. Conditions are declared on the behavior that carries them — see [Precondition and postcondition](#precondition-and-postcondition) under Operation for their declaration site — and are restated here because they are properties in the same sense as invariants: a named predicate in the ubiquitous language, separated from the mechanism that enforces it.

A condition is a named predicate expression over the behavior's arguments and, when the behavior belongs to an entity, its state. Conditions come in two kinds, and they are distinct concepts: they differ in signature, in when they are evaluated, and in what a violation means.

**Scope**: a condition attaches either to an **operation** — in which case it holds for every invocation of that operation — or to a single **state machine transition** — in which case it holds only for that transition. The distinction matters because one operation may drive transitions out of several source states (see [State machine](#state-machine)), and each of those transitions may carry its own condition. `cancel()` may be legal from `pending` when nothing has shipped, and legal from `paid` only within the refund window: two transitions of one operation, two different preconditions. An operation-scoped condition applies to all of an operation's transitions; a transition-scoped one applies to exactly one.

#### Precondition

A predicate that must hold **before** the behavior executes: `P(state_before, arguments) -> boolean`. It expresses what the caller must guarantee — the obligation the domain places on whoever invokes the behavior.

A precondition on a behavior exposed through an API interface references arguments only. A precondition on an entity operation references both state and arguments.

**Enforcement is always rejection** — the behavior is refused, no state change occurs, and the declared violation reason is returned (as an error event when the behavior was triggered by a command). Unlike an invariant, a precondition declares no enforcement strategy, because rejection is the only one available: there is no state change to compensate, and nothing has happened to alert about. Enforcement is therefore implicit.

Relations:
- 1..1 "scoped to" relation with an operation or a state machine transition (the behavior this precondition guards)
- 1..1 "declares" relation with a violation reason (the business language reason returned when the predicate fails)

#### Postcondition

A predicate that must hold **after** the behavior executes: `P(state_before, state_after, arguments) -> boolean`. Because it can compare the two states, it expresses the behavior's *effect* — what the domain guarantees in return — rather than a static truth. This is what distinguishes it from an invariant: an invariant would still hold if the behavior did nothing at all; a postcondition would not.

A postcondition has no violation reason and no enforcement strategy. A failing postcondition is not a domain outcome — the caller did nothing wrong, and no business rule was broken. It means the behavior did not do what the model says it does, which is a defect in the model or in its implementation. It is detected and reported, never rejected and never compensated.

Relations:
- 1..1 "scoped to" relation with an operation or a state machine transition (the behavior whose effect this postcondition asserts)

#### Invariant vs condition

The two are complementary, and both must hold.

| | Invariant | Precondition | Postcondition |
|---|---|---|---|
| **Scope** | A consistency boundary: entity, aggregate, value type, or state | A behavior: an operation or a transition | A behavior: an operation or a transition |
| **When it holds** | At every observable point of the boundary's lifecycle | Before the behavior runs | After the behavior runs |
| **Signature** | `P(state)` | `P(state_before, arguments)` | `P(state_before, state_after, arguments)` |
| **What it expresses** | A truth about state | What the caller must guarantee | What the behavior guarantees in return |
| **Violation means** | A business rule was broken | The caller was not entitled to invoke the behavior | The model or its implementation is wrong |
| **Enforcement** | Declared: rejection, compensation, or alert | Implicit: rejection, with a violation reason | None: detected as a defect |

An operation therefore satisfies three property sets simultaneously: its preconditions on entry, its postconditions on exit, and — because it mutates the state of its owner — every invariant scoped to that owner and to the state the owner occupies.


### Agreement and Reconciliation

#### Agreement

An agreement is a property that spans multiple aggregates within the same bounded context, or across bounded contexts. Unlike an invariant, which is guaranteed atomically within a single aggregate's transactional boundary, an agreement expresses a truth that no single transaction can verify alone. The system commits to maintaining the agreement through coordination rather than enforcement.
An agreement has a name (anchored in the ubiquitous language), a predicate expression over the combined observable state of its participants, and a list of participant aggregates whose states are involved in the predicate.

An agreement is bilateral (exactly two aggregates) or multilateral (N aggregates must collectively satisfy the predicate). Multilateral agreements are substantially harder to reconcile because a violation is caused by the collective, not by any single participant — no individual state change is "the" cause.
Because no single transaction can check the predicate atomically, an agreement accepts a window of inconsistency: the predicate may be temporarily violated between the moment a participant's state changes and the moment the reconciliation process detects and resolves the disagreement. The bounded context's design must make this window explicit and acceptable to domain experts.
An agreement has a reconciliation that defines how disagreements are detected and resolved.
Agreement has relations with:

2..n "involves" relation with aggregates (the participants)
1..1 "maintained by" relation with a reconciliation

#### Reconciliation

A reconciliation is the mechanism that detects violations of an agreement and drives the system back toward consistency. It is the enforcement counterpart to an agreement, just as invariant enforcement (reject, compensate, alert) is the counterpart to an invariant predicate.
A reconciliation has a name, a trigger that initiates the check, a detection strategy, and a set of compensating actions to execute when a violation is found.
A reconciliation has:

name: anchored in the ubiquitous language (e.g. "budget reconciliation", "capacity reconciliation").
trigger: what initiates the reconciliation. Either an event (reactive — the reconciliation runs each time a relevant participant emits an event that could affect the agreement) or a schedule (periodic — the reconciliation runs at fixed intervals and checks the predicate over current state).
detection: how the violation is discovered. Either by evaluating the agreement's predicate directly against the participants' current state (query-based), or by accumulating events and detecting that the sequence has produced a state that violates the predicate (event-sourced).
compensation: one or more commands issued to restore the agreement when a violation is detected. Compensation may target any participant. If compensation itself can fail, the reconciliation must define a fallback or escalation (e.g. alert, manual intervention, retry with backoff).

A reconciliation may be choreographed (each participant reacts to events from the others in a chain, with no central coordinator) or orchestrated (a dedicated process — often called a saga — coordinates the sequence of commands and compensations across participants). The choice between choreography and orchestration is a design decision driven by the number of participants and the complexity of the compensation logic: bilateral agreements often work well with choreography; multilateral agreements typically need orchestration.
A reconciliation that is triggered by events and uses choreography is structurally close to a set of cooperating reactions. The distinction is intent: reactions express independent reactive domain rules; a reconciliation is a coordinated mechanism serving a single agreement. When documenting the model, if several reactions exist solely to maintain one cross-aggregate truth, consider naming the agreement and reconciliation explicitly rather than leaving the coordination implicit in scattered reaction definitions.
Reconciliation has relations with:

1..1 "maintains" relation with an agreement
0..n "listens to" relation with events (when trigger is event-based)
1..n "issues" relation with commands (the compensating actions)

##### Escalation chain

An escalation chain is an ordered sequence of steps that the reconciliation follows when compensation fails. Each step defines a condition under which it activates and an action to take. Steps are evaluated in order — the first step whose condition is met is executed. If that step also fails, the next step is evaluated.

An escalation step has:

trigger condition: what determines this step activates. Typically: the previous compensation or escalation action failed, or a timeout elapsed, or a maximum retry count was reached.
action: one of: retry (re-execute the original compensation, with a maximum attempt count and backoff), alternative compensation (issue a different set of commands targeting any participant), alert (notify a defined role or monitoring system without halting), suspend (freeze further state changes on the agreement's participants until resolved), or manual intervention (create a structured work item for human resolution, carrying the full context of the failure).
max attempts: for retry actions only, the number of retries before this step is considered failed and the next step in the chain is evaluated.

An escalation chain must terminate: the final step must be either alert, suspend, or manual intervention — never retry or alternative compensation, which could themselves fail indefinitely. This guarantees that every reconciliation failure eventually reaches a defined end state rather than looping.

Relations:
- 1..1 "belongs to" relation with reconciliation
- 1..n "has" relation with escalation steps


## Requirement Traceability

Every domain model element can declare which system requirements it satisfies through the implicit `satisfies` attribute defined in the Convention section. This section specifies how traceability works and when it is required.

### When traceability is required

**Rule: if system requirements are provided as input and each requirement has an identifier, the domain model MUST include `satisfies` references on every element that realizes a requirement.** A domain model element without a `satisfies` reference when requirements exist is either an orphan (no requirement justifies it) or a traceability gap (the link was omitted). Both cases must be explicit.

Conversely, if no system requirements are available, the `satisfies` list is left empty on all elements. The domain model remains valid — traceability is additive, not blocking.

### How traceability works

The `satisfies` attribute is a list of requirement identifiers (e.g. `REQ-ORD-001`, `REQ-RIDE-020`). Each identifier references a requirement defined in the system requirement layer (SYSTEM-REQ-METAMODEL.md). The reference is a string match — no structural link, just the identifier.

A single domain model element may satisfy multiple requirements. A single requirement may be satisfied by multiple domain model elements. The relationship is many-to-many.

When the requirements come from a file, the domain model declares a `requirements-source` attribute at the organization or bounded context level with the relative path to that file. This makes the link between the domain model and its requirement input explicit and navigable — an agent or tool can resolve the path, read the requirements, and perform coverage or drift analysis without ambiguity about which requirements the `satisfies` identifiers refer to.

### Traceability by concept type

The table below maps each domain model concept to the typical satisfaction roles it plays. The role taxonomy (`structured-by`, `enforced-by`, `implemented-by`, `detected-by`, `reconciled-by`, `quality-constrained-by`, `satisfied-by-infrastructure`) is defined in SYSTEM-REQ-METAMODEL.md under "Satisfaction roles". A role is **descriptive, never written in the model**: the `satisfies` list holds requirement identifiers only, and the role is derived from the kind of element that carries the reference. This table guides the modeler — and any agent building a domain model — toward the right traceability links:

| Domain concept | Typical satisfaction role | Example |
|---|---|---|
| Entity, Aggregate, Value Type, field | `structured-by` | Entity `Order` satisfies REQ-ORD-002 (order structure) |
| Invariant, Precondition | `enforced-by` | Invariant `positiveQuantity` satisfies REQ-ORD-001 |
| Operation, Command, Event, Domain Service | `implemented-by` | Command `PlaceOrder` satisfies REQ-ORD-002 |
| Reaction (compensating) | `enforced-by` or `detected-by` | Reaction `notifyOnStockout` satisfies REQ-ORD-004 |
| Error Event | `detected-by` | Error event `OrderRejected` satisfies REQ-ORD-004 |
| Agreement, Reconciliation, Escalation Chain | `reconciled-by` | Agreement `CustomerCreditAgreement` satisfies REQ-ORD-005 |
| Infrastructure Service | `quality-constrained-by` or `satisfied-by-infrastructure` | Infra service `PaymentGateway` satisfies REQ-NFR-001 |

### Bidirectional traceability

Traceability is bidirectional:

- **Top-down** (requirement → domain): from a requirement identifier, find all domain elements whose `satisfies` list contains that identifier. This answers: *how is this requirement realized?*
- **Bottom-up** (domain → requirement): from a domain element, read its `satisfies` list. This answers: *why does this element exist? which business obligation justifies it?*

A domain element with an empty `satisfies` list when requirements are available is an **orphan** — it exists but no requirement justifies it. An orphan is either over-engineering or a signal that a requirement is missing.

A requirement whose identifier appears in no domain element's `satisfies` list is **unsatisfied** — a gap in the domain model.

## Software System's Message Surface

A software system communicates with collaborators (other bounded contexts, frontends, end users) through typed messages:

| Message | Timeline | Characteristics |
|---------|----------|-----------------|
| Event   | Past     | Represents a fact. Append-only. |
| Query   | Now      | Represents current state. |
| Command | Future   | Represents an intention. Can succeed or fail. |

The message surface is not the [Interface](#interface) construct. An interface is a **port** — a contract of operation signatures at a module boundary, inside the model. The message surface is the message-typed view of the whole system seen from outside — what crosses the system boundary. The two are connected by derivation, not by a separate declaration:

- An inbound **command** is on the surface when the operation that handles it is exposed through an API interface — the command is reachable precisely because its handling operation is published.
- An inbound **query** is on the surface through its module: a module's declared queries are the read side it offers consumers, reading through its repositories' read surfaces.
- An inbound **external event** is on the surface by declaration: the consuming module declares it and reacts to it.
- An outbound **event** is on the surface when an exposed operation emits it.

A command whose handling operation is exposed by no API interface is internal to its module — issuable by reactions, but not by outside collaborators.

### Inbound communication (System is Driven)

Direction: Collaborators → System
Accepted inputs: Commands, Queries, External Events.
The system handles commands and queries, and consumes events from upstream dependencies.

### Outbound Communication (System is Driving)

Direction: System → Collaborators
Dispatched outputs: Events, Commands, Queries.
The system publishes its own events and invokes commands or queries on external dependencies.
