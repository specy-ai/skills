## Concrete syntax

A PRD is written in a `.prd` file, using structured markdown consistent with the Specy ecosystem.

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

  job "Get to destination quickly when running late" {
    persona "Daily commuter rider"
    statement "When I'm running late for work and need to get there fast,
               I want to get a ride confirmed within minutes,
               so I can arrive on time without the stress of uncertain transportation."
    type functional
    importance critical
    satisfaction underserved
    related-to "Know total cost before committing to a ride"
    desired-outcomes {
      "Minimize the time between opening the app and having a confirmed ride" {
        importance high
        current-satisfaction low
      }
      "Minimize the likelihood of the ride being cancelled after confirmation" {
        importance high
        current-satisfaction low
      }
      "Minimize the uncertainty about arrival time at destination" {
        importance high
        current-satisfaction medium
      }
    }
  }

  job "Know total cost before committing to a ride" {
    persona "Daily commuter rider"
    statement "When I need a ride but have a limited budget,
               I want to know the exact fare before I commit,
               so I can decide whether to ride or take a cheaper alternative."
    type functional
    importance critical
    satisfaction underserved
    desired-outcomes {
      "Minimize the difference between estimated fare and actual fare" {
        importance high
        current-satisfaction low
      }
      "Minimize the likelihood of being surprised by surge pricing" {
        importance high
        current-satisfaction low
      }
    }
  }

  job "Feel safe cancelling without penalty" {
    persona "Daily commuter rider"
    statement "When I've requested a ride but my plans change before a driver is assigned,
               I want to cancel without being charged,
               so I can explore options freely without feeling locked in."
    type emotional
    importance important
    satisfaction underserved
    desired-outcomes {
      "Minimize the anxiety about committing to a ride request" {
        importance high
        current-satisfaction low
      }
    }
  }

  job "Earn predictably during chosen hours" {
    persona "Part-time driver"
    statement "When I have a few free hours and want to earn money,
               I want to receive ride requests consistently and know my earnings per ride,
               so I can predict my income for that session."
    type functional
    importance critical
    satisfaction underserved
    desired-outcomes {
      "Minimize the idle time between ride completions" {
        importance high
        current-satisfaction low
      }
      "Minimize the time between completing a ride and seeing the earnings breakdown" {
        importance high
        current-satisfaction medium
      }
    }
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
    addresses "Get to destination quickly when running late", "Know total cost before committing to a ride"
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
    addresses "Feel safe cancelling without penalty"
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
    addresses "Earn predictably during chosen hours"
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
- `job "<name>" { persona, statement, type, importance, satisfaction, related-to, desired-outcomes { ... } }` defines a situation-triggered task a persona is trying to accomplish. Type is `functional`, `emotional`, `social`. Importance is `critical`, `important`, `nice-to-have`. Satisfaction is `unserved`, `underserved`, `adequately-served`, `overserved`. Jobs are optional — they enrich the demand-side model but are not required for a valid PRD.
- `desired-outcomes { "<statement>" { importance, current-satisfaction } }` embeds desired outcomes within a job. Each outcome follows the canonical form: direction + metric + object + clarifier. Importance is `high`, `medium`, `low`. Current-satisfaction is `low`, `medium`, `high`. High importance + low satisfaction = underserved outcome = opportunity.
- `addresses "<job name>", ...` inside a feature references the jobs that feature helps get done.
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
// In a .sysreq file (SYSTEM-REQ-METAMODEL instance):
REQ-RIDE-020 "Rider cancellation before assignment" : complex
  source "Feature: Free cancellation before driver assignment — AC: No cancellation fee"
  ...
```

The `source` value is a free-text reference into the PRD. By convention, it follows the pattern:
```
source "Feature: <feature name>"
source "Feature: <feature name> — Story: <story summary>"
source "Feature: <feature name> — AC: <acceptance criterion>"
source "Job: <job name>"
source "Job: <job name> — Outcome: <desired outcome statement>"
source "Constraint: <constraint name>"
source "Goal: <goal name>"
```

This convention enables grep-level traceability without requiring a formal ID system in the PRD. If a formal ID system is desired, features, stories, and constraints may carry optional IDs (e.g., `FEAT-001`, `STORY-001`, `CONS-001`) and the `source` field references those IDs instead.
