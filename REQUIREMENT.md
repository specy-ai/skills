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
  - [Satisfaction Link](#satisfaction-link)
    - [Satisfaction roles](#satisfaction-roles)
    - [Coverage](#coverage)
  - [Requirement Set](#requirement-set)
  - [EARS-to-DDD realization mapping](#ears-to-ddd-realization-mapping)
  - [Traceability analysis](#traceability-analysis)
    - [Coverage analysis](#coverage-analysis)
    - [Orphan analysis](#orphan-analysis)
    - [Fragmentation analysis](#fragmentation-analysis)
    - [Conflict detection](#conflict-detection)
  - [Integration with verification loops](#integration-with-verification-loops)
  - [Concrete syntax](#concrete-syntax)
    - [Syntax rules](#syntax-rules)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->




# Requirement metamodel

This file defines a requirement layer that sits above the domain model metamodel (see METAMODEL.md). Its purpose is to capture *what the system shall do* using the EARS syntax, and to trace each requirement down to the domain model elements that satisfy it.

A requirement without a satisfaction link is a gap. A domain model element that realizes no requirement is an orphan worth questioning. This bidirectional traceability — top-down from intent to implementation, bottom-up from implementation to intent — is the mechanical proof that the system does what was asked.

## Convention

Every concept in this metamodel carries a name, a description, and a metadata map (a set of arbitrary key/value pairs). These attributes are implicit and not repeated in each definition below.

This metamodel references concepts defined in METAMODEL.md (entity, operation, invariant, policy, command, event, agreement, reconciliation, etc.). Those definitions are not repeated here.


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
- 1..n "satisfied by" relation with satisfaction links
- 1..1 "scoped to" relation with bounded context or organization (functional requirements scope to a BC; cross-cutting NFRs scope to the organization)
- 0..n "depends on" relation with other requirements (logical prerequisite: requirement B cannot be satisfied unless requirement A is satisfied first)
- 0..n "conflicts with" relation with other requirements (explicit tension: both requirements cannot be fully satisfied simultaneously — the model must document the resolution strategy)
- 0..n "decomposed into" relation with other requirements (an organization-level requirement creates derived obligations on context-level requirements that collectively satisfy it)
- 0..1 "belongs to" relation with a requirement set


## Satisfaction Link

A satisfaction link connects a requirement to a specific metamodel element and declares *how* that element contributes to satisfying the requirement. It is the atomic unit of traceability.

A satisfaction link has:
- **role**: how this element participates in the satisfaction (see roles below).
- **target**: reference to a metamodel element — any concept defined in METAMODEL.md.
- **coverage**: whether this link alone satisfies the requirement or contributes alongside others (see coverage below).
- **justification**: an optional note explaining why this particular element satisfies this particular requirement, when the mapping is not self-evident.

Relations:
- 1..1 "links" relation with a requirement
- 1..1 "targets" relation with a metamodel element


### Satisfaction roles

Each satisfaction link declares one role that describes the nature of the realization:

| Role | Meaning | Typical targets |
|------|---------|-----------------|
| `structured-by` | The requirement is realized through the existence and shape of a domain concept. | Entity, Value Type, Aggregate, field, reference |
| `enforced-by` | The requirement is guaranteed by a constraint that prevents violation. | Invariant, Precondition, Policy |
| `implemented-by` | The requirement is fulfilled by behavior — an action the system performs. | Operation, Command, Event, Domain Service, Application Service |
| `reconciled-by` | The requirement is maintained across aggregate boundaries through coordination. | Agreement, Reconciliation, Escalation Chain |
| `detected-by` | The requirement's violation is caught and surfaced — the system reacts to the unwanted condition. | Error Event, Policy (compensating), Precondition violation reason |
| `quality-constrained-by` | The requirement imposes a measurable quality bar (performance, reliability, security, operability) on a domain element. The metric is stated in the EARS sentence; the link identifies *what* is constrained. | Operation, Domain Service, Infrastructure Service, Entity, Bounded Context |
| `satisfied-by-infrastructure` | The requirement is satisfied below the domain layer — by deployment, networking, operational tooling, or configuration. No domain model element realizes it. This is not a gap; it is an honest boundary marker. | *(no domain target — the link stands alone)* |

A single requirement typically combines multiple roles. For example, an event-driven requirement might be `implemented-by` a command and operation, `enforced-by` a policy, and `detected-by` an error event. A non-functional requirement might be `quality-constrained-by` an operation and `detected-by` an alert policy that fires when the quality bar is breached.


### Coverage

- `full`: this single satisfaction link is sufficient — the requirement is entirely realized by this one element.
- `partial`: this link contributes to the requirement alongside other links. The requirement is satisfied only when *all* its `partial` links are considered together.

A requirement with only `partial` links forms a **satisfaction argument** — the set of elements that collectively realize the requirement. The argument is complete when every aspect of the EARS statement (precondition, trigger, system response) maps to at least one link.


## Requirement Set

A requirement set groups related requirements into a coherent unit — typically aligned with a business capability, a use case cluster, or a module boundary.

Relations:
- 1..n "contains" relation with requirements
- 0..1 "maps to" relation with a module (the module whose interface realizes this set)
- 1..1 "scoped to" relation with a bounded context


## EARS-to-DDD realization mapping

Each EARS pattern has a natural affinity with specific metamodel constructs. This table guides the modeler toward the right satisfaction roles:

| EARS Pattern | EARS Clause | Primary DDD Realization | Satisfaction Role |
|---|---|---|---|
| **Ubiquitous** | `shall` (unconditional) | Invariant, Value Type constraint, Entity structure | `enforced-by`, `structured-by` |
| **State-driven** | `While <state>` | State machine state, state-scoped invariant, precondition | `enforced-by` |
| **Event-driven** | `When <trigger>` | Command → Operation → Event chain | `implemented-by` |
| **Unwanted** | `If <condition> then` | Error Event, Policy, precondition violation reason | `detected-by`, `enforced-by` |
| **Optional** | `Where <feature>` | Module presence, conditional operation | `structured-by`, `implemented-by` |
| **Complex** | Multiple clauses | Combination of roles matching each clause | Mixed |

For complex requirements, each clause maps independently:
- The `While` clause maps to `enforced-by` (state guard)
- The `When` clause maps to `implemented-by` (trigger → operation)
- The `If` clause maps to `detected-by` (unwanted condition handling)
- The `shall` response maps to `implemented-by` (the action taken)

This decomposition ensures that no clause in a complex requirement goes unrealized.

For non-functional requirements, the mapping depends on the NFR category:

| NFR Category | Typical EARS Pattern | Primary Satisfaction Role | Example |
|---|---|---|---|
| **Performance** (latency, throughput) | event-driven or ubiquitous | `quality-constrained-by` operation/service | "When a ride enters requested status, the system shall return a matched driver within 10 seconds" |
| **Reliability** (availability, recovery) | ubiquitous | `quality-constrained-by` BC or infra service | "The Payment system shall maintain 99.95% availability" |
| **Security** (encryption, authorization) | ubiquitous or state-driven | `quality-constrained-by` entity/operation, `enforced-by` policy | "The system shall encrypt all payment card data at rest" |
| **Operability** (monitoring, alerting) | ubiquitous or event-driven | `quality-constrained-by` operation, `detected-by` alert policy | "When an operation exceeds its p99 latency, the system shall emit an alert" |
| **Resilience** (fallback, degraded mode) | unwanted or complex | `quality-constrained-by` infra service, `detected-by` circuit breaker policy | "If the Geolocation service is unavailable, the system shall use cached driver positions" |
| **Compliance** (GDPR, PCI, retention) | ubiquitous | `quality-constrained-by` entity, `satisfied-by-infrastructure` | "The system shall delete all rider personal data within 30 days of account deletion" |


## Traceability analysis

Four analyses derive mechanically from the requirement/satisfaction structure. They require no human judgment — only traversal of the links.


### Coverage analysis

**Question**: Which requirements have no satisfaction links?

**Derivation**: Requirements with zero satisfaction links are **unsatisfied** — a gap in the domain model. Every unsatisfied requirement is either:
- A modeling gap (the domain model is incomplete), or
- A premature requirement (written before the domain was understood well enough to model it).

Both cases demand action.


### Orphan analysis

**Question**: Which metamodel elements realize no requirement?

**Derivation**: Elements targeted by zero satisfaction links across all requirements are **orphans**. An orphan is either:
- Over-engineering (the element exists but serves no stated business need), or
- A missing requirement (the business need exists but was never formalized).

Orphan analysis is especially valuable during legacy extraction (DISTILL phase), where code contains implicit requirements that were never written down.


### Fragmentation analysis

**Question**: Is a requirement scattered across too many elements?

**Derivation**: Requirements with more than five `partial` satisfaction links are **fragmented** — a cohesion smell. High fragmentation suggests either:
- The requirement is too coarse and should be decomposed into finer EARS statements, or
- The domain model lacks a concept that would unify the scattered elements (a missing aggregate, domain service, or policy).


### Conflict detection

**Question**: Do conflicting requirements target the same element?

**Derivation**: When two requirements linked by a `conflicts-with` relation both have satisfaction links targeting the same metamodel element, that element carries an **unresolved tension**. The model must document how the tension is resolved — typically through priority (MoSCoW), a policy that mediates, or an agreement that coordinates.


## Integration with verification loops

The requirement layer plugs into Specy's three verification loops:

| Loop | Role of Requirements |
|---|---|
| **Build** (intent → code) | Requirements are the input specification. The builder generates code that must satisfy every `must` and `should` requirement. Each satisfaction link tells the builder *which* domain construct to generate and *what role* it plays. |
| **Check** (code → intent) | The checker verifies that every satisfaction link has a corresponding code realization. A requirement with `satisfied-by { enforced-by orderContainsLines }` must have a matching invariant check in code. An unsatisfied requirement is a checker failure. |
| **Observe** (runtime → intent) | Requirements with `event-driven` or `unwanted` patterns are observable at runtime. The observer traces event flows and compares against declared `implemented-by` and `detected-by` chains. Missing events or unhandled error conditions signal drift between intent and behavior. |

The requirement layer does not replace the domain model — it *governs* it. The domain model remains the structural and behavioral specification. Requirements declare *why* each element must exist and *what obligation* it fulfills.


## Non-functional requirements

Non-functional requirements (NFRs) use the same EARS syntax as functional requirements. There is no separate grammar — an NFR is a requirement. What distinguishes an NFR is that it constrains *how well* the system performs rather than *what* it does. EARS patterns are expressive enough: a latency budget is an event-driven requirement, an availability SLA is ubiquitous, an encryption obligation is ubiquitous, a degraded-mode behavior is a state-driven requirement.

NFRs use the `quality-constrained-by` satisfaction role to link the quality bar to the domain element it constrains. The metric itself lives in the EARS statement — the satisfaction link identifies the target, not the number.


### NFR categories and their domain anchors

Not all NFRs are equal. Some trace directly to domain model elements; others are cross-cutting and require broader scoping. The table below classifies NFR categories by where they anchor in the metamodel.

| Category | What it constrains | Domain anchor | Satisfaction role | Scoping |
|---|---|---|---|---|
| **Performance** | How fast an operation responds or how much throughput it sustains | Operation, Domain Service, Infrastructure Service | `quality-constrained-by` | Bounded Context |
| **Reliability** | How often the system is available, how it recovers from failure, how much data loss is tolerable | Entity (durability), Operation (retry/fallback), Infrastructure Service (redundancy) | `quality-constrained-by` | Bounded Context or Organization |
| **Security** | How data is protected, who can access what, how secrets are handled | Entity (data classification), Operation (authorization), Value Type (encryption), Infrastructure Service (auth provider) | `quality-constrained-by`, `enforced-by` | Bounded Context or Organization |
| **Operability** | How the system is monitored, deployed, debugged, and maintained | Operation (observability), Event (audit trail), Infrastructure Service (logging, alerting) | `quality-constrained-by` | Bounded Context or Organization |
| **Scalability** | How the system handles growing load without degradation | Operation (throughput ceiling), Entity (partitioning), Infrastructure Service (elastic capacity) | `quality-constrained-by` | Organization |
| **Compliance** | How the system meets regulatory, legal, or contractual obligations | Entity (data retention, deletion), Operation (audit), Value Type (PII classification) | `quality-constrained-by`, `enforced-by` | Organization |
| **Resilience** | How the system behaves when parts fail — degraded modes, circuit breaking, bulkheading | Operation (fallback behavior), Infrastructure Service (circuit breaker), Policy (compensating action) | `quality-constrained-by`, `detected-by` | Bounded Context |

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

Each derived context-level requirement is a regular EARS requirement scoped to its BC, with satisfaction links to concrete infrastructure services, operations, or policies within that BC. The decomposition makes it explicit that the organizational SLA is a collective responsibility — not owned by any single team.

#### Satisfaction of cross-cutting NFRs

Cross-cutting NFRs typically cannot be satisfied by domain model elements alone. Their satisfaction links target:

- **Infrastructure services** — the domain model's interface to external systems, deployment infrastructure, monitoring. Example: `quality-constrained-by PaymentGateway` for PCI compliance on the payment path.
- **Policies** — reactive rules that detect and compensate for quality breaches. Example: a policy that triggers a fallback when a service's error rate exceeds a threshold.
- **Agreements and reconciliations** — cross-aggregate coordination mechanisms. Example: a GDPR data deletion agreement spanning Rider, Payment, and Ride BCs with a reconciliation that verifies all traces are purged.

When a cross-cutting NFR cannot be linked to any domain model element, it is marked `satisfied-by-infrastructure` — an explicit acknowledgment that the satisfaction lives below the domain layer (in deployment, networking, or operational tooling). This is not a gap — it is an honest boundary. The requirement is still tracked, still has an owner, still has a priority. It simply traces to infrastructure rather than domain constructs.

```
  REQ-NFR-002 "Data encryption at rest" : ubiquitous
    :: "Security baseline — all persistent stores must encrypt data"
    "The RideNow platform shall encrypt all data at rest using
     AES-256 or equivalent."
    priority must
    satisfied-by {
      satisfied-by-infrastructure   // deployment/infrastructure responsibility
    }
```

#### Cross-cutting NFR and the verification loops

| Loop | Role of Cross-Cutting NFRs |
|---|---|
| **Build** | Derived context-level requirements guide infrastructure choices (database encryption, circuit breaker configuration, monitoring setup). The builder knows *which* infrastructure services need *what* quality bars. |
| **Check** | The checker verifies that each derived context-level requirement has a corresponding infrastructure configuration or operational runbook. `satisfied-by-infrastructure` links are verified by infrastructure-as-code audits, not code review. |
| **Observe** | Cross-cutting NFRs are the primary targets of the Observe loop. Availability SLAs are monitored via uptime dashboards. Latency budgets are tracked via distributed tracing. Compliance obligations are verified via periodic audits. The Observe loop detects drift between declared NFRs and actual system behavior. |


## Concrete syntax

Requirements are written in a `.req` section or file, consistent with Specy's DSL style.

```
requirements "Order Processing" scoped-to OrderContext {

  REQ-ORD-001 "Order line quantity floor" : ubiquitous
    :: "Regulatory minimum — trade compliance requires explicit quantity"
    "The system shall reject order lines with a quantity less than one."
    priority must
    satisfied-by {
      enforced-by OrderLine.positiveQuantity
      structured-by OrderLine.quantity
    }

  REQ-ORD-002 "Order placement" : event-driven
    :: "Core revenue path — every sale starts here"
    "When a customer submits an order, the system shall create
     the order in draft status and emit an OrderPlaced event."
    priority must
    satisfied-by {
      implemented-by Order."Place a new order"
      implemented-by PlaceOrder
      implemented-by OrderPlaced
      structured-by Order.status
    }

  REQ-ORD-003 "Active customer guard" : state-driven
    :: "Suspended customers must not accumulate new debt"
    "While the customer is suspended, the system shall reject
     new orders."
    priority must
    satisfied-by {
      enforced-by customerMustBeActive
      detected-by OrderRejected
    }

  REQ-ORD-004 "Insufficient stock handling" : unwanted
    :: "Overselling erodes trust — hard lesson from Q3 2024"
    "If the ordered product is out of stock, then the system shall
     reject the order and notify the customer."
    priority must
    satisfied-by {
      enforced-by productMustBeAvailable
      detected-by OrderRejected
      implemented-by NotificationService.notify
    }

  REQ-ORD-005 "Credit limit agreement" : complex
    :: "Finance requires real-time credit exposure control"
    "While the customer has an active credit account, when an order
     is placed, if the order total exceeds the remaining credit limit,
     then the system shall hold the order for manual approval."
    priority should
    satisfied-by {
      reconciled-by CustomerCreditAgreement
      reconciled-by CreditReconciliation
      implemented-by HoldOrderForApproval
    }

  REQ-ORD-006 "Express shipping option" : optional
    :: "Premium feature — only for regions with courier partnerships"
    "Where express shipping is available, the system shall offer
     same-day delivery for orders placed before noon."
    priority could
    satisfied-by {
      implemented-by Shipping."Offer express delivery"
      enforced-by expressDeliveryDeadline
    }
}
```

### Syntax rules

- `requirements "<name>" scoped-to <BoundedContext>` opens a requirement set.
- Each requirement starts with its **id** followed by its **name** in quotes, a colon, and its **pattern**.
- `::` introduces the rationale (same operator as in `.domain.specy` files).
- The EARS statement follows in quotes, on one or more lines.
- `priority` declares the MoSCoW level.
- `satisfied-by { ... }` contains one or more satisfaction links, each prefixed with its role and targeting a metamodel element using dot-path notation.
- Requirements may declare dependencies and conflicts:

```
  REQ-ORD-007 "Order confirmation" : event-driven
    depends-on REQ-ORD-002
    "When payment is verified, the system shall confirm the order."
    priority must
    satisfied-by {
      implemented-by Order."Confirm order"
      implemented-by ConfirmOrder
      implemented-by OrderConfirmed
    }
```

```
  REQ-ORD-008 "Immediate fulfillment" : event-driven
    conflicts-with REQ-ORD-005
    :: "Ops wants auto-ship; Finance wants credit hold — resolved by priority"
    "When an order is confirmed, the system shall immediately
     initiate fulfillment."
    priority should
    satisfied-by {
      implemented-by Order."Ship order"
      implemented-by ShipOrder
    }
```
