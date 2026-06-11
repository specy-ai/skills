<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Product requirement metamodel](#product-requirement-metamodel)
  - [Convention](#convention)
  - [Position in the traceability chain](#position-in-the-traceability-chain)
  - [Product](#product)
  - [Problem Statement](#problem-statement)
  - [Supporting Evidence](#supporting-evidence)
  - [Persona](#persona)
  - [Job](#job)
    - [Job and other PRD concepts](#job-and-other-prd-concepts)
  - [Desired Outcome](#desired-outcome)
  - [Goal](#goal)
  - [Success Metric](#success-metric)
  - [Hypothesis](#hypothesis)
  - [Feature](#feature)
  - [User Story](#user-story)
  - [User Journey](#user-journey)
    - [Journey Step](#journey-step)
  - [Assumption](#assumption)
  - [Risk](#risk)
  - [Constraint](#constraint)
  - [Open Question](#open-question)
  - [Release](#release)
  - [Traceability to system requirements](#traceability-to-system-requirements)
    - [Feature-to-requirement coverage](#feature-to-requirement-coverage)
    - [Impact analysis](#impact-analysis)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->




# Product requirement metamodel

This file defines the structure and elements of a Product Requirement Document (PRD). A PRD captures *what the product should be, for whom, and why* — at a level that aligns product managers, designers, leadership, and engineering on shared intent before the system is specified or built.

The PRD is the upstream source for system requirements (see SYSTEM-REQ-METAMODEL.md). It does not specify system behavior — that precision belongs to EARS requirements. Instead, it declares the product decisions that justify those requirements: which users matter, what problems they face, what the product does about it, and how success is measured.

A feature without a system requirement is an aspiration. A system requirement without a feature is an orphan that no product decision justifies. The `source` field on system requirements (defined in SYSTEM-REQ-METAMODEL.md) creates this traceability bridge.


## Convention

Every concept in this metamodel carries a name, a description, and a metadata map (a set of arbitrary key/value pairs). These attributes are implicit and not repeated in each definition below.

This metamodel is upstream of SYSTEM-REQ-METAMODEL.md and independent of DOMAIN-METAMODEL.md. It speaks the language of product management — personas, goals, features, metrics — not the language of domain modeling.


## Position in the traceability chain

```
PRODUCT-REQ-METAMODEL.md                    ← you are here
  Product → Persona, Goal, Feature, User Story, Journey
      ↓  source (provenance)
SYSTEM-REQ-METAMODEL.md
  EARS Requirement → Satisfaction Link
      ↓  satisfied-by
DOMAIN-METAMODEL.md
  Entity, Operation, Invariant, Reaction, Event
      ↓  realized in
  Code
```

Each layer adds precision. The PRD says *"riders should be able to cancel for free before a driver is assigned"*. The system requirement formalizes it into a testable EARS statement. The domain model implements it as a state guard, a command, and an event. The PRD never mentions state machines; the domain model never mentions user frustration. Each layer speaks its own language to its own audience.


## Product

The top-level container for a product's strategic context. A product groups everything the PRD describes: the problem, the users, the goals, the features, and the plan.

A product has:
- **vision**: a one-to-three sentence statement of the product's purpose and differentiation — what it does, for whom, and why it matters more than alternatives.
- **scope**: what is included and, critically, what is explicitly excluded from this product.
- **non-goals**: explicit declarations of what the product deliberately does not aim to do — by design, not by deferral. Non-goals are permanent strategic boundaries that prevent scope creep. They differ from `wont` features (which are deferred, not excluded) and from scope exclusions (which are general boundaries, not strategic intent). A non-goal answers: "someone will propose this — here is why we say no."

Relations:
- 1..1 "addresses" relation with a problem statement
- 1..n "serves" relation with personas
- 1..n "pursues" relation with goals
- 0..n "offers" relation with features
- 0..n "plans" relation with releases
- 0..n "assumes" relation with assumptions
- 0..n "faces" relation with risks
- 0..n "bounded by" relation with constraints
- 0..n "raises" relation with open questions


## Problem Statement

The problem the product exists to solve. A well-formed problem statement describes the current pain without prescribing a solution.

A problem statement has:
- **situation**: what is happening today — the context and the actors involved.
- **complication**: why the situation is painful, costly, or unsustainable.
- **question**: the key question the product answers — framed from the user's perspective, not the builder's.

The problem statement is not a feature list. It is the *why* behind every feature. When a feature cannot be traced back to the problem statement, either the feature is out of scope or the problem statement is incomplete.

Relations:
- 1..1 "addressed by" relation with a product
- 0..n "supported by" relation with supporting evidence


## Supporting Evidence

Data, research, or analysis that grounds the problem statement and product decisions in fact rather than opinion. Supporting evidence transforms "we believe riders are frustrated" into "rider NPS dropped 15 points in Q3; exit surveys cite unpredictable wait times as the #1 reason."

A supporting evidence item has:
- **type**: the kind of evidence — `user-research` (interviews, surveys, usability tests), `analytics` (product metrics, usage data), `market-research` (competitive analysis, market sizing, industry reports), `customer-feedback` (support tickets, reviews, NPS verbatims), or `domain-expertise` (expert judgment, regulatory guidance).
- **summary**: a one-to-three sentence description of what the evidence shows.
- **source reference**: where the evidence comes from — a research report, analytics dashboard, survey, or expert name. Specific enough to be verifiable.
- **date**: when the evidence was collected or published. Evidence ages — stale data should be flagged.
- **confidence**: how reliable this evidence is — `strong` (large sample, rigorous method), `moderate` (reasonable sample, some bias), `weak` (anecdotal, small sample, outdated).

Supporting evidence is not proof — it is the best available information at the time of the product decision. The confidence level makes this explicit: a product decision built on `weak` evidence should carry higher risk and an assumption with a validation plan.

Relations:
- 0..n "supports" relation with problem statement, goals, or features (the product decisions this evidence informs)


## Persona

An archetype of a target user, grounded in research or domain expertise. A persona is not a demographic profile — it is a behavioral model: what the person is trying to accomplish, what frustrates them, and what context shapes their decisions.

A persona has:
- **role**: a short label that identifies the persona in the ubiquitous language (e.g., "Daily commuter rider", "Part-time driver", "Fleet operations manager").
- **goals**: what this persona is trying to achieve — stated as outcomes, not features (e.g., "Get to work reliably within 30 minutes", not "Request a ride").
- **frustrations**: what blocks or degrades the persona's experience today.
- **context**: the environment, constraints, and habits that shape how this persona interacts with the product (device, time pressure, technical literacy, frequency of use).
- **weight**: how important this persona is to the product's success — `primary` (the product is built for them), `secondary` (the product serves them but is not optimized for them), or `excluded` (explicitly not served — documented to prevent scope creep).

Relations:
- 0..n "has" relation with jobs (the jobs this persona is trying to get done — situation-triggered, solution-independent)
- 0..n "featured in" relation with user stories (the stories written from this persona's perspective)
- 0..n "walks" relation with user journeys (the journeys this persona takes)
- 1..1 "served by" relation with a product


## Job

A situation-triggered task that a persona is trying to accomplish, stated independently of any solution. A job is stable — it does not change when products or technologies change. People have been "trying to get financing quickly to seize a time-sensitive opportunity" for centuries; only the solutions change.

A job captures *why* a persona acts, rooted in a specific circumstance rather than in the persona's identity. The same persona may have very different jobs depending on the situation: a rider commuting to work at 8 AM has a different job than the same rider heading to the airport with luggage at 4 AM.

A job follows the canonical form:

```
When [situation], I want to [motivation], so I can [expected outcome].
```

This differs from a user story ("As a [persona], I want [action], so that [outcome]") in two ways: it is anchored in a *situation* not a *persona*, and it describes a *motivation* not a *product action*. A user story prescribes what the product should do; a job describes what the person is trying to accomplish regardless of any product.

A job has:
- **statement**: the job in canonical form — situation, motivation, expected outcome.
- **type**: the dimension of the job — `functional` (a practical task the persona needs to accomplish), `emotional` (how the persona wants to feel or avoid feeling during the task), or `social` (how the persona wants to be perceived by others).
- **importance**: how critical this job is to the persona — `critical` (the persona will actively seek a solution), `important` (the persona cares but tolerates imperfection), `nice-to-have` (the persona notices but does not act on it).
- **satisfaction**: how well current solutions (including workarounds, competitors, manual processes) serve this job — `unserved` (no solution exists), `underserved` (solutions exist but fall short on key outcomes), `adequately-served` (current solutions are acceptable), `overserved` (current solutions exceed needs — opportunity to simplify or reduce cost).

The combination of high importance and low satisfaction identifies **underserved jobs** — the primary opportunities for the product to create value. Overserved jobs signal opportunities to simplify or offer a cheaper alternative.

Relations:
- 1..1 "performed by" relation with a persona (the persona who has this job)
- 1..n "measured by" relation with desired outcomes (the criteria the persona uses to judge how well the job is done)
- 0..n "addressed by" relation with features (the features that help get this job done)
- 0..n "related to" relation with other jobs (jobs that are typically performed before, during, or after this job — revealing the broader job chain)


### Job and other PRD concepts

Jobs complement — they do not replace — other PRD concepts. Each serves a different purpose:

| Concept | Lens | Answers |
|---|---|---|
| **Problem statement** | Pain | Why is the status quo unacceptable? |
| **Persona** | Actor | Who is trying to act, and what shapes their behavior? |
| **Job** | Demand | What is the persona trying to accomplish, in what situation? |
| **Goal** | Business outcome | What measurable result does the product pursue? |
| **Feature** | Supply | What capability does the product offer? |
| **User story** | Interaction | How does the persona use a specific feature? |

Jobs sit between personas and goals: a persona *has* jobs; the product *pursues* goals that address those jobs; features *address* jobs by delivering capabilities. Jobs are demand-side (what the customer wants); goals are supply-side (what the business measures). A well-formed PRD connects both sides: every goal should trace to one or more jobs, and every job should be addressable by one or more features.

Jobs are optional in the PRD — a product team may choose to work with personas and goals alone. But when jobs are present, they provide a stable demand-side architecture that survives product pivots and technology changes.


## Desired Outcome

A measurable criterion from the persona's perspective for how well a job is getting done. Unlike success metrics (which measure business objectives), desired outcomes measure *customer satisfaction* with the job execution. They are the persona's yardstick for whether a solution is worth hiring.

A desired outcome follows the canonical form:

```
[Direction] + [metric] + [object of control] + [contextual clarifier]
```

Examples:
- "Minimize the time it takes to know whether my financing request will be approved"
- "Minimize the likelihood of being surprised by hidden fees after committing to a ride"
- "Maximize the confidence that my payment will arrive on the expected day"

A desired outcome has:
- **statement**: the outcome in canonical form.
- **importance**: how much the persona cares about this outcome — `high`, `medium`, `low`.
- **current-satisfaction**: how well current solutions deliver on this outcome — `low` (big gap — opportunity), `medium` (adequate but improvable), `high` (already well-served).

The combination of high importance and low current satisfaction identifies an **underserved outcome** — the most promising target for product investment. This is the core of Outcome-Driven Innovation (Ulwick): prioritize features that address underserved outcomes on important jobs.

Relations:
- 1..1 "measures" relation with a job (the job this outcome evaluates)
- 0..n "informs" relation with success metrics (a business success metric may be derived from or inspired by a customer desired outcome)


## Goal

A measurable business objective the product pursues. Goals are not features — they are outcomes. A feature is a *means* to a goal; the goal is the *end*.

A goal has:
- **statement**: what the product aims to achieve, stated as a measurable outcome (e.g., "Reduce average rider wait time to under 4 minutes in served markets").
- **horizon**: the timeframe over which the goal is pursued — `short-term` (this quarter), `mid-term` (this year), `long-term` (multi-year).
- **owner**: the person or team accountable for this goal.

Relations:
- 1..n "measured by" relation with success metrics
- 0..n "advanced by" relation with features (the features that move the needle on this goal)
- 1..1 "pursued by" relation with a product


## Success Metric

A quantitative indicator that determines whether a goal is being met. A success metric is not a vanity number — it is a decision criterion. If the metric moves in the wrong direction, the team changes course.

A success metric has:
- **indicator**: what is measured (e.g., "Average time from ride request to driver assignment").
- **target**: the threshold that defines success (e.g., "< 10 seconds at p95").
- **baseline**: the current value before the product intervention — if known.
- **measurement method**: how the metric is collected (e.g., "Computed from RideRequested → RideRequestMatched event timestamps in production").

Relations:
- 1..1 "measures" relation with a goal


## Hypothesis

A testable causal claim about how a feature will advance a goal. A hypothesis makes the bet explicit: "if we do X (intervention), then Y (outcome) will happen, because Z (mechanism)." Without a hypothesis, the connection between a feature and a goal is an assertion; with one, it is a testable prediction.

A hypothesis has:
- **intervention**: what the product will do — typically a feature or a change to an existing feature.
- **expected outcome**: the measurable result — stated in terms of a success metric moving in the desired direction.
- **mechanism**: why the intervention should produce the outcome — the causal reasoning.
- **validation method**: how the hypothesis will be tested — A/B test, pilot, user research, analytics comparison.
- **status**: `proposed` (not yet tested), `testing` (experiment in progress), `validated` (evidence supports it), `invalidated` (evidence contradicts it), `inconclusive` (not enough signal).

A hypothesis is not a requirement — it is a bet. Validated hypotheses justify features; invalidated ones should trigger feature reconsideration or pivot. A feature without a hypothesis is building on faith; a hypothesis without a feature is theory without action.

Relations:
- 1..1 "proposes" relation with a feature (the intervention)
- 1..1 "predicts movement on" relation with a goal or success metric (the expected outcome)
- 0..n "supported by" relation with supporting evidence (data that informed the hypothesis)

Example: "If we show fare estimates upfront (intervention), then rider conversion from request to confirmation will increase by 20% (outcome), because eliminating fare uncertainty reduces abandonment at the commitment step (mechanism). Validated via A/B test in pilot market."


## Feature

A named capability the product offers to its users. A feature is the primary unit of product planning — it is scoped, prioritized, and delivered. A feature is not a system requirement — it describes *what the user gets*, not *what the system shall do*.

A feature has:
- **summary**: a one-sentence description of what the feature does for the user.
- **persona**: the primary persona this feature serves.
- **value proposition**: why this feature matters — stated in terms of the persona's goals or frustrations it addresses.
- **priority**: MoSCoW classification (`must`, `should`, `could`, `wont`) — same scale as system requirements for consistent prioritization across layers.
- **status**: the current state of this feature — `proposed` (under discussion), `accepted` (committed), `in-progress` (being built), `delivered` (shipped), `deferred` (postponed with rationale), `rejected` (explicitly declined with rationale).
- **non-goals**: what this feature deliberately does not do — tactical boundaries within the feature's scope (e.g., "This feature does NOT let riders choose a specific driver"). Non-goals at the feature level are narrower than product-level non-goals.
- **design references**: pointers to visual artifacts — wireframes, mockups, prototypes, Figma links, design specifications. The PRD does not contain the designs themselves; it references where they live. Each reference has a label and a URI.

Relations:
- 1..n "described by" relation with user stories (the persona-specific narratives within this feature)
- 0..n "illustrated by" relation with user journeys (the end-to-end flows this feature participates in)
- 0..n "addresses" relation with jobs (the persona jobs this feature helps get done)
- 0..n "advances" relation with goals (which business objectives this feature serves)
- 0..1 "tested by" relation with a hypothesis (the causal claim this feature is built on)
- 0..1 "planned in" relation with a release
- 1..1 "belongs to" relation with a product
- 0..n "sourced by" relation with system requirements (the EARS requirements in SYSTEM-REQ-METAMODEL.md whose `source` field references this feature — the traceability bridge)


## User Story

A persona-specific narrative that describes one way a feature delivers value. A user story follows the canonical form:

```
As a <persona>, I want <action>, so that <outcome>.
```

A user story has:
- **persona**: the persona whose perspective this story represents.
- **action**: what the persona wants to do — stated as a verb from the persona's vocabulary.
- **outcome**: the benefit the persona expects — stated as a result, not a system behavior.
- **acceptance criteria**: a set of conditions that must be true for the story to be considered complete. Each criterion is a testable statement — these are the primary candidates for formalization into EARS requirements.

Relations:
- 1..1 "belongs to" relation with a feature
- 1..1 "told from perspective of" relation with a persona
- 0..n "sourced by" relation with system requirements (the EARS requirements whose `source` field references this story)


## User Journey

A sequence of steps a persona takes to accomplish a goal across one or more features. A journey is broader than a story — it spans the entire experience, including steps the product does not control (e.g., "rider walks to the pickup point").

A user journey has:
- **persona**: the persona who walks this journey.
- **trigger**: what initiates the journey (e.g., "Rider needs to get to work").
- **outcome**: the desired end state (e.g., "Rider arrives at destination, receipt in inbox").
- **design references**: pointers to journey maps, flow diagrams, or prototypes that visualize this journey.

Relations:
- 1..n "has" relation with journey steps
- 1..1 "walked by" relation with a persona
- 0..n "spans" relation with features (the features involved in this journey)
- 1..1 "belongs to" relation with a product


### Journey Step

A single interaction within a user journey. A step describes what happens from the persona's perspective — not the system's.

A journey step has:
- **action**: what the persona does or experiences (e.g., "Opens app and enters destination").
- **system response**: what the product does in response — if anything (e.g., "Shows fare estimate and available ride types").
- **channel**: where this interaction happens — `app`, `web`, `sms`, `email`, `physical`, `backoffice`, or `external` (outside the product).
- **emotional tone**: optional — how the persona feels at this step (`confident`, `anxious`, `frustrated`, `delighted`, `neutral`). Emotional tone surfaces UX-critical moments that may not be visible in functional requirements.
- **order**: the position of this step in the journey sequence.

A journey step where `channel = external` marks a moment the product does not control but must account for (e.g., "Rider waits at curb for driver"). These steps often reveal requirements for notifications, status updates, or timeout handling.

Relations:
- 1..1 "belongs to" relation with a user journey
- 0..n "involves" relation with features


## Assumption

Something believed to be true but not yet validated. Assumptions are the hidden load-bearing walls of product decisions — if an assumption proves wrong, the features built on it may collapse.

An assumption has:
- **statement**: what is believed (e.g., "Drivers in our target market have smartphones with GPS accuracy within 20 meters").
- **impact if wrong**: what happens to the product if this assumption is false (e.g., "Matching accuracy degrades, ETA becomes unreliable, driver no-show rate increases").
- **validation plan**: how this assumption will be tested (e.g., "Measure GPS accuracy on 100 driver devices in first pilot market").
- **status**: `unvalidated`, `validated`, `invalidated`.

Relations:
- 0..n "underpins" relation with features (the features that depend on this assumption being true)
- 1..1 "made by" relation with a product


## Risk

Something that could go wrong and damage the product, the users, or the business. Unlike assumptions (which are about beliefs), risks are about threats.

A risk has:
- **statement**: what could happen (e.g., "Regulatory change bans surge pricing in key markets").
- **likelihood**: `low`, `medium`, `high`.
- **impact**: `low`, `medium`, `high`, `critical`.
- **mitigation**: what the team plans to do about it — `accept` (monitor), `mitigate` (reduce probability or impact), `avoid` (change approach), `transfer` (insurance, contractual).
- **owner**: who is responsible for monitoring and responding.

Relations:
- 0..n "threatens" relation with features or goals
- 1..1 "faced by" relation with a product


## Constraint

A non-negotiable boundary that limits product decisions. Constraints are facts, not choices — they come from regulation, contracts, technology, or organizational reality.

A constraint has:
- **statement**: the constraint itself (e.g., "Payment card data must comply with PCI-DSS Level 1").
- **source**: where this constraint comes from — `regulatory`, `contractual`, `technical`, `organizational`, `market`.
- **impact**: which features or goals this constraint affects.

Constraints often generate system requirements directly. A regulatory constraint like "GDPR right to erasure within 30 days" becomes an EARS requirement scoped to the organization. The `source` field on the system requirement references this constraint.

Relations:
- 0..n "constrains" relation with features or goals
- 1..1 "bounds" relation with a product


## Open Question

An acknowledged unknown that the team needs to resolve before a decision can be made. Open questions differ from assumptions (beliefs to validate) and risks (threats to mitigate). An open question is an explicit gap in understanding — the team knows it doesn't know, and it names the gap rather than hiding it.

An open question has:
- **question**: the specific unknown, stated as a question (e.g., "Should we charge cancellation fees in markets where competitors don't?", "What is the minimum driver density needed to guarantee < 5 minute wait times?").
- **context**: why this question matters — what decision is blocked until it's answered.
- **owner**: who is responsible for finding the answer.
- **deadline**: when the answer is needed — typically tied to a release or feature decision point.
- **status**: `open` (not yet answered), `investigating` (actively being researched), `resolved` (answer found — recorded below), `deferred` (deliberately postponed with rationale).
- **resolution**: when resolved, the answer and the evidence that supports it.

Open questions are living artifacts — they should be reviewed regularly and closed or escalated. A PRD with many long-standing open questions is a signal that the team is building on uncertain ground.

Relations:
- 0..n "blocks" relation with features or goals (the product decisions that depend on the answer)
- 1..1 "raised by" relation with a product


## Release

A planned delivery milestone that groups features into a shippable unit. Releases structure the roadmap — they answer "what ships when" and "what comes first."

A release has:
- **target date**: when this release is planned to ship (absolute date or relative — e.g., "Q2 2026" or "3 months after beta launch").
- **theme**: a one-sentence label that captures the strategic intent of this release (e.g., "Core ride loop", "Driver retention", "Enterprise expansion").
- **status**: `planned`, `in-progress`, `shipped`, `cancelled`.
- **entry criteria**: what must be true before this release starts (e.g., "All must-have features from R1 are shipped and stable").
- **exit criteria**: what must be true before this release ships (e.g., "All must features pass acceptance, no P0 bugs open").

Relations:
- 1..n "includes" relation with features
- 0..n "depends on" relation with other releases (sequencing — R2 depends on R1)
- 1..1 "planned by" relation with a product


## Traceability to system requirements

The PRD is the upstream source for system requirements. The traceability bridge works through the `source` field defined in SYSTEM-REQ-METAMODEL.md: each EARS requirement optionally declares where it came from — a feature, user story, acceptance criterion, constraint, or goal in the PRD.

```
PRD Feature: "Free cancellation before driver assignment"
  └── User Story: "As a rider, I want to cancel without penalty before a driver accepts,
       so that I don't feel locked in."
       └── Acceptance criterion: "Cancellation before driver assignment incurs no fee"
            ↓ source
       EARS Requirement: REQ-RIDE-020 "Rider cancellation before assignment"
         source "Feature: Free cancellation — Story: Rider cancel without penalty — AC: No fee before assignment"
            ↓ satisfied-by
       Domain: CancelRequestByRider command, RideRequestCancelledByRider event
```

This chain is not enforced mechanically — the `source` field is a free-text reference. But the structure is consistent enough to enable two analyses:


### Feature-to-requirement coverage

**Question**: Which features have no system requirements referencing them?

A feature with zero `sourced by` links to system requirements is either:
- Not yet formalized (the EARS requirements haven't been written), or
- Purely experiential (e.g., a visual design feature that has no system behavior — no requirement needed).

Both cases should be explicit.


### Impact analysis

**Question**: If a feature changes, which system requirements are affected?

Follow the `source` references: every EARS requirement whose `source` field mentions this feature is a candidate for revision. From there, follow satisfaction links to identify affected domain model elements.

This enables the full change propagation chain:
```
Product decision changes
  → Which features are affected?
    → Which system requirements reference those features?
      → Which domain model elements satisfy those requirements?
        → Which code realizes those elements?
```


