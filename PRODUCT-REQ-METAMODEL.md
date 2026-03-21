<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Product requirement metamodel](#product-requirement-metamodel)
  - [Convention](#convention)
  - [Position in the traceability chain](#position-in-the-traceability-chain)
  - [Product](#product)
  - [Problem Statement](#problem-statement)
  - [Persona](#persona)
  - [Supporting Evidence](#supporting-evidence)
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
  - [Concrete syntax](#concrete-syntax)
    - [Syntax rules](#syntax-rules)

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
  Entity, Operation, Invariant, Policy, Event
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
- 0..n "featured in" relation with user stories (the stories written from this persona's perspective)
- 0..n "walks" relation with user journeys (the journeys this persona takes)
- 1..1 "served by" relation with a product


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


## Concrete syntax

A PRD is written in a `.prd.md` file, using structured markdown consistent with the Specy ecosystem.

```
product "RideNow" {

  vision "A ride-hailing platform that connects riders with drivers in real time,
         offering reliable, affordable transportation in urban markets."

  problem {
    situation "Urban commuters and occasional travelers need on-demand transportation."
    complication "Public transit is unreliable, taxis are expensive and hard to find,
                  personal cars are costly to own and park."
    question "How can we provide reliable, affordable door-to-door transportation
              available within minutes?"
  }

  persona "Daily commuter rider" {
    role "A working professional who commutes to the office 5 days a week"
    goals {
      "Get to work reliably within 30 minutes"
      "Know the fare before committing"
      "Avoid cash transactions"
    }
    frustrations {
      "Unpredictable wait times"
      "Surge pricing during peak hours"
      "No recourse when driver cancels"
    }
    context "Uses smartphone, rides during morning and evening rush, price-sensitive"
    weight primary
  }

  persona "Part-time driver" {
    role "A vehicle owner who drives to supplement income on a flexible schedule"
    goals {
      "Earn predictable income during chosen hours"
      "Receive payment reliably and quickly"
      "Avoid problematic riders"
    }
    frustrations {
      "Long idle time between rides"
      "Riders who cancel after driver commits"
      "Opaque commission structure"
    }
    context "Owns car, has smartphone, drives evenings and weekends, values autonomy"
    weight primary
  }

  non-goals {
    "Replace public transit — we complement it, not compete with it"
    "Own the vehicle fleet — we are a marketplace, not a fleet operator"
    "Serve rural areas — unit economics require urban density"
  }

  evidence "Rider NPS drop Q3" {
    type analytics
    summary "Rider NPS dropped 15 points in Q3. Exit surveys cite unpredictable
             wait times (42%) and surge pricing surprises (31%) as top reasons."
    source-reference "Rider Experience Quarterly Report Q3-2025, slide 14"
    date 2025-10-15
    confidence strong
    supports "Reduce rider wait time"
  }

  evidence "Competitive fare transparency" {
    type market-research
    summary "3 of 4 competing platforms now show upfront fare estimates.
             Riders in focus groups cite fare transparency as a switching trigger."
    source-reference "Competitive Analysis Report, Oct 2025 — Section 3.2"
    date 2025-10-20
    confidence moderate
    supports "Ride request and fare estimate"
  }

  goal "Reduce rider wait time" {
    statement "Reduce average time from ride request to driver assignment
               to under 30 seconds in served markets"
    horizon short-term
    owner "Head of Ride Operations"
    metric {
      indicator "p50 time from RideRequested to RideRequestMatched"
      target "< 30 seconds"
      baseline "45 seconds (current)"
      measurement "Event timestamp delta in production"
    }
  }

  goal "Driver earnings transparency" {
    statement "Every driver can see per-ride earnings breakdown within 5 seconds
               of ride completion"
    horizon short-term
    owner "Head of Driver Experience"
    metric {
      indicator "Time from RideCompleted to earnings displayed in driver app"
      target "< 5 seconds"
      measurement "Client-side instrumentation"
    }
  }

  hypothesis "Upfront fare reduces abandonment" {
    intervention "Show fare estimate before rider confirms the ride request"
    expected-outcome "Rider conversion from request to confirmation increases by 20%"
    mechanism "Eliminating fare uncertainty reduces abandonment at the commitment step"
    validation-method "A/B test in pilot market — control: no estimate, variant: upfront estimate"
    status proposed
    proposes "Ride request and fare estimate"
    predicts "Reduce rider wait time"
  }

  feature "Ride request and fare estimate" {
    summary "Rider enters destination and sees an upfront fare estimate before committing"
    persona "Daily commuter rider"
    value-proposition "Eliminates fare anxiety — rider knows the cost before the trip"
    priority must
    status accepted
    advances "Reduce rider wait time"
    tested-by "Upfront fare reduces abandonment"
    design-references {
      "Fare estimate screen — rider app" -> "figma.com/file/abc123/ride-request-flow"
      "Fare breakdown modal" -> "figma.com/file/abc123/fare-breakdown"
    }
    non-goals {
      "Let riders negotiate the fare — pricing is algorithmic only"
      "Show competitor prices — we show our price, not a comparison"
    }
    stories {
      "As a daily commuter rider, I want to see the fare before I confirm,
       so that I can decide if the ride is worth the cost." {
        acceptance-criteria {
          "Fare estimate is displayed within 3 seconds of entering destination"
          "Fare breakdown shows base fare, distance, time, and surge if applicable"
          "Rider can cancel without penalty before confirming"
        }
      }
    }
  }

  feature "Free cancellation before driver assignment" {
    summary "Riders can cancel without fee while no driver has been assigned"
    persona "Daily commuter rider"
    value-proposition "Reduces commitment anxiety — riders explore options freely"
    priority must
    status accepted
    stories {
      "As a daily commuter rider, I want to cancel without penalty before
       a driver accepts, so that I don't feel locked in." {
        acceptance-criteria {
          "No cancellation fee is charged"
          "Ride request is cancelled immediately"
          "Rider is returned to the home screen"
        }
      }
    }
  }

  feature "Driver weekly payout" {
    summary "Drivers receive accumulated earnings every Monday via bank transfer"
    persona "Part-time driver"
    value-proposition "Predictable income cadence — drivers can plan finances"
    priority must
    status accepted
    advances "Driver earnings transparency"
    stories {
      "As a part-time driver, I want my earnings deposited into my bank account
       every Monday, so that I can rely on a regular income schedule." {
        acceptance-criteria {
          "Payout transfers on Monday at 00:00 UTC"
          "Only triggers if balance exceeds minimum threshold"
          "Driver receives confirmation notification"
        }
      }
    }
  }

  feature "Instant payout" {
    summary "Drivers can cash out available earnings immediately for a small fee"
    persona "Part-time driver"
    value-proposition "Financial flexibility for drivers who need cash now"
    priority could
    status proposed
    advances "Driver earnings transparency"
  }

  assumption "GPS accuracy sufficient for matching" {
    statement "Driver smartphones in target markets have GPS accuracy within 20 meters"
    impact-if-wrong "Matching assigns wrong drivers, ETAs are unreliable, no-show rate rises"
    validation-plan "Measure GPS accuracy on 100 driver devices in first pilot market"
    status unvalidated
    underpins "Ride request and fare estimate"
  }

  risk "Regulatory surge pricing ban" {
    statement "Local regulators may ban or cap surge pricing in key markets"
    likelihood medium
    impact high
    mitigation mitigate
    owner "Head of Legal"
    threatens "Reduce rider wait time"
  }

  constraint "PCI-DSS compliance" {
    statement "All payment card data must comply with PCI-DSS Level 1"
    source regulatory
    constrains "Ride request and fare estimate", "Driver weekly payout", "Instant payout"
  }

  open-question "Cancellation fee in competitive markets" {
    question "Should we charge cancellation fees in markets where competitors don't?"
    context "Charging fees protects drivers but may drive riders to competitors.
             Not charging fees exposes drivers to rider abuse."
    owner "Head of Product"
    deadline 2026-04-01
    status open
    blocks "Free cancellation before driver assignment"
  }

  open-question "Minimum driver density for launch" {
    question "What is the minimum driver density needed to guarantee < 5 minute
              average wait times in a new market?"
    context "Launching with too few drivers creates a poor first experience.
             Launching with too many creates idle time and driver churn."
    owner "Head of Ride Operations"
    deadline 2026-03-15
    status resolved
    resolution "Simulation shows 15 drivers per km² sustains < 5 min p50 wait time
                at expected demand levels. Validated in pilot market."
  }

  release "R1 — Core ride loop" {
    target-date "Q2 2026"
    theme "Minimum viable ride-hailing: request, match, ride, pay"
    status planned
    includes {
      "Ride request and fare estimate"
      "Free cancellation before driver assignment"
      "Driver weekly payout"
    }
    exit-criteria {
      "All must features pass acceptance"
      "No P0 bugs open"
      "Pilot market onboarded with 100+ drivers"
    }
  }

  release "R2 — Driver retention" {
    target-date "Q3 2026"
    theme "Features that keep drivers engaged and earning"
    status planned
    depends-on "R1 — Core ride loop"
    includes {
      "Instant payout"
    }
  }
}
```

### Syntax rules

- `product "<name>"` opens the PRD.
- `problem { situation, complication, question }` follows the SCQ (Situation-Complication-Question) framework for problem framing.
- `non-goals { ... }` declares strategic exclusions at product level — what the product deliberately does not aim to do. Also available inside `feature` blocks for tactical exclusions.
- `evidence "<name>" { type, summary, source-reference, date, confidence, supports }` documents data that grounds decisions. Type is `user-research`, `analytics`, `market-research`, `customer-feedback`, `domain-expertise`. Confidence is `strong`, `moderate`, `weak`.
- `persona "<name>" { role, goals, frustrations, context, weight }` defines a user archetype. Weight is `primary`, `secondary`, or `excluded`.
- `goal "<name>" { statement, horizon, owner, metric { ... } }` defines a measurable business objective.
- `hypothesis "<name>" { intervention, expected-outcome, mechanism, validation-method, status, proposes, predicts }` declares a testable causal claim linking a feature to a goal. Status is `proposed`, `testing`, `validated`, `invalidated`, `inconclusive`.
- `feature "<name>" { summary, persona, value-proposition, priority, status, advances, tested-by, design-references, non-goals, stories { ... } }` defines a product capability. Priority uses MoSCoW (`must`, `should`, `could`, `wont`). Status is `proposed`, `accepted`, `in-progress`, `delivered`, `deferred`, `rejected`.
- `design-references { "<label>" -> "<uri>" }` inside a feature or journey points to visual artifacts (Figma, prototypes, wireframes). The PRD references designs; it does not contain them.
- `stories { "<story text>" { acceptance-criteria { ... } } }` embeds user stories within a feature. Each story follows the "As a..., I want..., so that..." form. Acceptance criteria are the primary candidates for formalization into EARS requirements.
- `assumption "<name>" { statement, impact-if-wrong, validation-plan, status, underpins }` documents beliefs. Status is `unvalidated`, `validated`, `invalidated`.
- `risk "<name>" { statement, likelihood, impact, mitigation, owner, threatens }` documents threats. Mitigation is `accept`, `mitigate`, `avoid`, `transfer`.
- `constraint "<name>" { statement, source, constrains }` documents non-negotiable boundaries. Source is `regulatory`, `contractual`, `technical`, `organizational`, `market`.
- `open-question "<name>" { question, context, owner, deadline, status, blocks, resolution }` tracks acknowledged unknowns. Status is `open`, `investigating`, `resolved`, `deferred`. When resolved, the `resolution` field records the answer.
- `release "<name>" { target-date, theme, status, depends-on, includes, exit-criteria }` defines a delivery milestone. Status is `planned`, `in-progress`, `shipped`, `cancelled`.
- `journey "<name>" for "<persona>" { trigger, outcome, design-references, steps { ... } }` defines a user journey (may appear at product level or within a feature).

### Linking PRD to system requirements

The PRD does not contain system requirements. The bridge is the `source` field on EARS requirements in SYSTEM-REQ-METAMODEL.md:

```
// In a .req file (SYSTEM-REQ-METAMODEL instance):
REQ-RIDE-020 "Rider cancellation before assignment" : complex
  source "Feature: Free cancellation before driver assignment — AC: No cancellation fee"
  ...
```

The `source` value is a free-text reference into the PRD. By convention, it follows the pattern:
```
source "Feature: <feature name>"
source "Feature: <feature name> — Story: <story summary>"
source "Feature: <feature name> — AC: <acceptance criterion>"
source "Constraint: <constraint name>"
source "Goal: <goal name>"
```

This convention enables grep-level traceability without requiring a formal ID system in the PRD. If a formal ID system is desired, features, stories, and constraints may carry optional IDs (e.g., `FEAT-001`, `STORY-001`, `CONS-001`) and the `source` field references those IDs instead.
