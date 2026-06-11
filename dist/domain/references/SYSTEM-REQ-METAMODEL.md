<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Requirement metamodel](#requirement-metamodel)
  - [Convention](#convention)
  - [EARS — Easy Approach to Requirements Syntax](#ears--easy-approach-to-requirements-syntax)
    - [The EARS ruleset](#the-ears-ruleset)
    - [EARS patterns](#ears-patterns)
      - [Ubiquitous](#ubiquitous)
      - [State-driven (While)](#state-driven-while)
      - [Event-driven (When)](#event-driven-when)
      - [Unwanted behavior (If-Then)](#unwanted-behavior-if-then)
      - [Optional feature (Where)](#optional-feature-where)
      - [Complex](#complex)
  - [Requirement](#requirement)
  - [Requirement Set](#requirement-set)
  - [Traceability](#traceability)
  - [Integration with verification loops](#integration-with-verification-loops)
  - [Non-functional requirements](#non-functional-requirements)
    - [NFR categories and their domain anchors](#nfr-categories-and-their-domain-anchors)
    - [NFR discovery heuristic](#nfr-discovery-heuristic)
      - [Per operation](#per-operation)
      - [Per entity](#per-entity)
      - [Per infrastructure service](#per-infrastructure-service)
      - [Per bounded context](#per-bounded-context)
      - [Per organization (cross-cutting)](#per-organization-cross-cutting)
    - [Cross-cutting NFRs — scoping beyond a single bounded context](#cross-cutting-nfrs--scoping-beyond-a-single-bounded-context)
      - [Scoping](#scoping)
      - [Decomposition into context-level obligations](#decomposition-into-context-level-obligations)
      - [Cross-cutting NFR and the verification loops](#cross-cutting-nfr-and-the-verification-loops)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->




# Requirement metamodel

This file defines a requirement layer that sits above the domain model metamodel (see DOMAIN-METAMODEL.md). Its purpose is to capture *what the system shall do* using the EARS syntax.

System requirements are the parent of domain models. One set of system requirements may be realized by multiple domain models (e.g. different implementations, different technology stacks, or different bounded contexts). The traceability direction is bottom-up: domain model elements reference the requirement identifiers they satisfy via the `satisfies` attribute defined in DOMAIN-METAMODEL.md. System requirements do not reference domain model elements — they declare obligations without prescribing realization.

## Convention

Every concept in this metamodel carries a name, a description, and a metadata map (a set of arbitrary key/value pairs). These attributes are implicit and not repeated in each definition below.

This metamodel is downstream of PRODUCT-REQ-METAMODEL.md and upstream of DOMAIN-METAMODEL.md. It speaks the language of system obligations — what the system shall do — not the language of product management (personas, goals) or domain modeling (entities, commands, events).

When the product requirements that originated the system requirements are stored in a file, the requirement set MUST declare a **prd-source** attribute containing the relative path to that file. This makes the provenance chain file-resolvable: an agent or tool can follow `prd-source` to read the PRD, then match each requirement's `source` field to the corresponding PRD element (feature, user story, acceptance criterion, constraint, or goal). Combined with the `requirements-source` attribute on the domain model (defined in DOMAIN-METAMODEL.md), this creates a complete file-level traceability chain from product requirements through system requirements to the domain model.


## EARS — Easy Approach to Requirements Syntax

EARS was developed by Alistair Mavin, Philip Wilkinson, Adrian Harwood, and Mark Novak at Rolls-Royce PLC (published at IEEE RE '09, pp. 317–322). It provides a lightweight, structured syntax for writing natural-language requirements that are unambiguous, testable, and complete.

EARS addresses eight deficiencies of unconstrained natural language: ambiguity, vagueness, complexity, omission, duplication, wordiness, inappropriate implementation, and untestability. It achieves this through a small set of keywords (`While`, `When`, `If`, `Where`) that make preconditions, triggers, and error handling explicit.


### The EARS ruleset

Every EARS requirement conforms to this structure:

```
[While <precondition(s)>,] [When|If|Where <trigger or condition>,]
the <system name> shall <system response(s)>.
```

Constraints on the structure:
- Zero or many **preconditions** (optional `While` clauses). Recommended limit: three. Beyond three, decompose into separate requirements or use a decision table.
- Zero or one **trigger** (optional `When`, `If`, or `Where` clause).
- Exactly one **system name** (the entity, aggregate, service, or bounded context being specified).
- One or many **system responses** (the required behavior, stated with `shall`).
- Clauses always appear in temporal order: preconditions → trigger → system name → response.
- Each requirement is a single sentence.


### EARS patterns

Six patterns cover the full spectrum of requirement types. Each pattern is identified by its keyword(s).


#### Ubiquitous

An always-active, unconditional requirement. No keyword.

```
The <system name> shall <system response>.
```

Example: "The system shall reject order lines with a quantity less than one."

Use for: fundamental system properties, structural constraints, invariants that hold regardless of state or event.


#### State-driven (While)

A requirement active only while a specified state or condition holds.

```
While <system state>, the <system name> shall <system response>.
```

Example: "While the order is in draft, the system shall allow line additions."

Use for: mode-dependent behavior, state-scoped invariants, preconditions that apply only in certain lifecycle phases.


#### Event-driven (When)

A requirement triggered by a specific event or action.

```
When <trigger event>, the <system name> shall <system response>.
```

Example: "When payment is confirmed, the system shall transition the order to confirmed status and emit an OrderConfirmed event."

Use for: commands, operations, event-driven state transitions, reactive behavior.


#### Unwanted behavior (If-Then)

A requirement handling an undesired situation, error, or failure.

```
If <unwanted condition or trigger>, then the <system name> shall <system response>.
```

Example: "If the ordered product is out of stock, then the system shall reject the order and notify the customer."

Use for: error handling, fault tolerance, compensating actions, violation detection. This pattern makes omissions in error handling visible — the most common and costly category of missing requirements.


#### Optional feature (Where)

A requirement applying only to system variants that include a specific capability.

```
Where <feature is included>, the <system name> shall <system response>.
```

Example: "Where express shipping is available, the system shall offer same-day delivery for orders placed before noon."

Use for: product-line features, configurable capabilities, optional modules.


#### Complex

A requirement combining multiple EARS keywords for richer behavior. Keywords appear in strict temporal order: `While` → `When`/`If`/`Where` → system → response.

```
While <precondition(s)>, When <trigger>, the <system name> shall <system response>.
While <precondition(s)>, If <unwanted trigger>, then the <system name> shall <system response>.
Where <feature>, When <trigger>, the <system name> shall <system response>.
```

Example: "While the customer has an active credit account, when an order is placed, if the order total exceeds the remaining credit limit, then the system shall hold the order for manual approval."

Use for: guarded triggers, conditional error handling, feature-scoped events.


## Requirement

A requirement is a named EARS statement that declares a system obligation.

A requirement has:
- **id**: a unique, stable identifier (e.g., `REQ-ORD-001`). The prefix anchors the requirement to a bounded context or domain area. The identifier never changes, even if the statement is revised.
- **statement**: the full EARS sentence, following one of the six patterns above.
- **pattern**: one of `ubiquitous`, `state-driven`, `event-driven`, `unwanted`, `optional`, `complex`.
- **rationale**: why this requirement exists — the business justification. Equivalent to the `::` operator on domain constructs. The rationale is not itself verifiable; it explains why the verifiable obligation exists.
- **priority**: a domain-expert-assigned weight using MoSCoW classification:
  - `must` — non-negotiable. The system is unacceptable without it.
  - `should` — important but not blocking. The system is degraded without it.
  - `could` — desirable. Included if effort permits.
  - `wont` — explicitly excluded from the current scope (documented to prevent scope creep).

Relations:
- 1..1 "scoped to" relation with bounded context or organization (functional requirements scope to a BC; cross-cutting NFRs scope to the organization)
- 0..1 "sourced from" relation with external reference (PRD section, user story, business goal, regulatory clause — the product decision or business context that originated this requirement. This is a provenance marker: it answers *who asked for this and why*, enabling impact analysis from product strategy change to affected requirements.)
- 0..n "depends on" relation with other requirements (logical prerequisite: requirement B cannot be satisfied unless requirement A is satisfied first)
- 0..n "conflicts with" relation with other requirements (explicit tension: both requirements cannot be fully satisfied simultaneously — the model must document the resolution strategy)
- 0..n "decomposed into" relation with other requirements (an organization-level requirement creates derived obligations on context-level requirements that collectively satisfy it)
- 0..1 "belongs to" relation with a requirement set


## Requirement Set

A requirement set groups related requirements into a coherent unit — typically aligned with a business capability, a use case cluster, or a module boundary.

A requirement set has:
- **prd-source** (optional): the relative path to the product requirements file from which this set's requirements were derived. When present, the `source` field on individual requirements references elements inside this file. Multiple `prd-source` declarations are allowed when product requirements span several files.

Relations:
- 1..n "contains" relation with requirements
- 0..1 "maps to" relation with a module (the module whose interface realizes this set)
- 1..1 "scoped to" relation with a bounded context


## Traceability

System requirements are the parent layer. Domain models (defined in DOMAIN-METAMODEL.md) reference requirements via the `satisfies` attribute on each domain element. This bottom-up traceability enables two analyses that can be performed by traversing the `satisfies` lists in the domain model:

- **Coverage analysis** — Which requirements have no domain element satisfying them? A requirement whose ID appears in no `satisfies` list is **unsatisfied** — either a modeling gap (the domain model is incomplete) or a premature requirement (written before the domain was understood enough to model it).
- **Orphan analysis** — Which domain elements satisfy no requirement? A domain element with an empty `satisfies` list is an **orphan** — either over-engineering or a missing requirement. Orphan analysis is especially valuable during legacy extraction, where code contains implicit requirements that were never written down.

These analyses are defined and executed from the domain model side (see DOMAIN-METAMODEL.md, "Requirement Traceability" section). The system requirement layer does not maintain links to domain elements — it only declares obligations.

Additionally, at the requirement level:

- **Conflict detection** — Requirements linked by `conflicts-with` that cannot both be fully satisfied create an unresolved tension. The resolution strategy must be documented (typically through priority, a mediating reaction, or an agreement).


## Integration with verification loops

The requirement layer plugs into Specy's three verification loops:

| Loop | Role of Requirements |
|---|---|
| **Build** (intent → code) | Requirements are the input specification. The builder reads requirements and produces a domain model whose elements declare `satisfies` references back to the requirement IDs. Every `must` and `should` requirement should be traceable to at least one domain element. |
| **Check** (code → intent) | The checker traverses `satisfies` lists in the domain model and verifies that every referenced requirement ID is covered. A requirement ID that appears in no `satisfies` list is a checker failure — a gap between intent and model. |
| **Observe** (runtime → intent) | Requirements with `event-driven` or `unwanted` patterns are observable at runtime. The observer traces event flows and verifies that the behaviors declared in requirements actually occur. Missing events or unhandled error conditions signal drift between intent and behavior. |

The requirement layer does not replace the domain model — it *governs* it. The domain model remains the structural and behavioral specification. Requirements declare *why* each element must exist and *what obligation* it fulfills.


## Non-functional requirements

Non-functional requirements (NFRs) use the same EARS syntax as functional requirements. There is no separate grammar — an NFR is a requirement. What distinguishes an NFR is that it constrains *how well* the system performs rather than *what* it does. EARS patterns are expressive enough: a latency budget is an event-driven requirement, an availability SLA is ubiquitous, an encryption obligation is ubiquitous, a degraded-mode behavior is a state-driven requirement.

The metric itself lives in the EARS statement. Domain model elements that realize NFRs reference them via the `satisfies` attribute, just like functional requirements.


### NFR categories and their domain anchors

Not all NFRs are equal. Some trace directly to domain model elements; others are cross-cutting and require broader scoping. The table below classifies NFR categories by where they anchor in the metamodel.

| Category | What it constrains | Typical domain anchor | Scoping |
|---|---|---|---|
| **Performance** | How fast an operation responds or how much throughput it sustains | Operation, Domain Service, Infrastructure Service | Bounded Context |
| **Reliability** | How often the system is available, how it recovers from failure, how much data loss is tolerable | Entity (durability), Operation (retry/fallback), Infrastructure Service (redundancy) | Bounded Context or Organization |
| **Security** | How data is protected, who can access what, how secrets are handled | Entity (data classification), Operation (authorization), Value Type (encryption), Infrastructure Service (auth provider) | Bounded Context or Organization |
| **Operability** | How the system is monitored, deployed, debugged, and maintained | Operation (observability), Event (audit trail), Infrastructure Service (logging, alerting) | Bounded Context or Organization |
| **Scalability** | How the system handles growing load without degradation | Operation (throughput ceiling), Entity (partitioning), Infrastructure Service (elastic capacity) | Organization |
| **Compliance** | How the system meets regulatory, legal, or contractual obligations | Entity (data retention, deletion), Operation (audit), Value Type (PII classification) | Organization |
| **Resilience** | How the system behaves when parts fail — degraded modes, circuit breaking, bulkheading | Operation (fallback behavior), Infrastructure Service (circuit breaker), Reaction (compensating action) | Bounded Context |

### NFR discovery heuristic

When writing requirements, the modeler should systematically ask these questions for each scope level. The questions are designed to surface NFRs that are frequently omitted.

#### Per operation

- **Latency**: Does this operation have a response time budget? What is the p95/p99 target?
- **Throughput**: How many invocations per second must this operation sustain at peak?
- **Idempotency**: If this operation is retried, does it produce the same result? Is that a requirement or just a nice-to-have?
- **Timeout**: What happens if this operation does not complete? Is there a deadline?
- **Authorization**: Who is allowed to invoke this operation? Is there a role or permission model?
- **Audit**: Must this operation's invocation be logged for compliance? Who needs the audit trail?

#### Per entity

- **Data classification**: Does this entity hold personal data (PII), financial data, health data? What regulatory regime applies?
- **Retention**: How long must this entity's data be kept? When must it be deleted?
- **Encryption**: Must this entity's data be encrypted at rest? In transit?
- **Backup and recovery**: What is the recovery point objective (RPO) — how much data loss is tolerable? What is the recovery time objective (RTO) — how fast must the data be restored?
- **Partitioning**: Does this entity need geographic or tenant-based partitioning for data residency?

#### Per infrastructure service

- **Availability**: What is the SLA of the external system this service wraps? What happens when it's down?
- **Circuit breaking**: Should the system stop calling a failing dependency after N failures?
- **Fallback**: Is there a degraded mode when this service is unavailable? What data is stale-acceptable?
- **Rate limiting**: Does the external system impose rate limits? How does the system handle throttling?

#### Per bounded context

- **Availability SLA**: What uptime percentage must this context guarantee to its consumers?
- **Deployment independence**: Can this context be deployed without coordinating with other contexts?
- **Observability**: What metrics, logs, and traces must this context expose?
- **Incident response**: What is the severity classification? What is the escalation path?

#### Per organization (cross-cutting)

- **Regulatory compliance**: GDPR, PCI-DSS, HIPAA, SOC2 — which frameworks apply?
- **Data sovereignty**: Must data stay within specific geographic boundaries?
- **Disaster recovery**: What is the organization-wide RPO/RTO?
- **Security baseline**: Are there mandatory authentication, encryption, or network segmentation standards?
- **Accessibility**: Must the system meet WCAG or other accessibility standards?


### Cross-cutting NFRs — scoping beyond a single bounded context

Some NFRs cannot be meaningfully scoped to a single bounded context. "99.9% availability" is an organizational commitment. "PCI-DSS compliance" spans every context that touches payment card data. "GDPR right to erasure" requires coordinated deletion across multiple BCs.

These cross-cutting NFRs are handled as follows:

#### Scoping

A requirement's `scoped-to` relation is extended to accept either a bounded context **or** the organization. Cross-cutting NFRs scope to the organization.

```
requirements "Platform Reliability" scoped-to RideNowOrganization {

  REQ-NFR-001 "Platform availability" : ubiquitous
    :: "Contractual SLA with riders and drivers — breach triggers penalties"
    "The RideNow platform shall maintain 99.9% availability measured
     monthly across all rider-facing and driver-facing services."
    priority must
}
```

#### Decomposition into context-level obligations

A cross-cutting NFR at the organization level creates **derived obligations** on each bounded context it affects. The derivation is explicit: the organization-level requirement depends-on (or is-parent-of) context-level requirements that collectively satisfy it.

```
  REQ-NFR-001 "Platform availability" : ubiquitous
    scoped-to RideNowOrganization
    priority must
    decomposed-into {
      REQ-RIDE-NFR-001   // Ride Management context availability
      REQ-PAY-NFR-001    // Payment context availability
      REQ-GEO-NFR-001    // Geolocation context availability
      REQ-DRV-NFR-001    // Driver Management context availability
      REQ-RDR-NFR-001    // Rider Management context availability
    }
```

Each derived context-level requirement is a regular EARS requirement scoped to its BC. Domain model elements within each BC reference the derived requirement via `satisfies`. The decomposition makes it explicit that the organizational SLA is a collective responsibility — not owned by any single team.

Some cross-cutting NFRs may not be realizable by domain model elements at all — they are satisfied by deployment, networking, or operational tooling below the domain layer. Domain model elements that cannot satisfy such a requirement simply do not include its ID in their `satisfies` list. The requirement is still tracked, still has an owner, still has a priority — the absence of a `satisfies` reference in the domain model is an honest boundary, not a gap.

#### Cross-cutting NFR and the verification loops

| Loop | Role of Cross-Cutting NFRs |
|---|---|
| **Build** | Derived context-level requirements guide infrastructure choices (database encryption, circuit breaker configuration, monitoring setup). The builder reads the requirement and knows *what* quality bar to meet. |
| **Check** | The checker verifies that each derived context-level requirement is either referenced by a domain element's `satisfies` list or acknowledged as infrastructure-only. Requirements with no domain-level `satisfies` reference and no infrastructure acknowledgment are gaps. |
| **Observe** | Cross-cutting NFRs are the primary targets of the Observe loop. Availability SLAs are monitored via uptime dashboards. Latency budgets are tracked via distributed tracing. Compliance obligations are verified via periodic audits. The Observe loop detects drift between declared NFRs and actual system behavior. |


