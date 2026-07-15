---
name: domain-refactor
version: v1
description: "Input — an existing `.domain` model reverse-engineered from code by `specy:domain-extract-from-code` (faithful but carrying design debt), plus an optional `refactoring.report`. Output — a redesigned `<domain>.refactored.domain` (greenfield) + a `<domain>.refactor-rationale.md` mapping each fix to the smell it resolves. Redesigns that extracted *domain model* from first principles into a proper DDD model — re-deriving entities, value types, aggregates, and behaviour from the business problem, preserving the ubiquitous language, and fixing the model's smells (anemic/god entities, primitive obsession, flag-driven illegal states, generic 'something changed' events, missing temporal/error paths). Trigger this whenever the user wants to clean up, redesign, rework, improve the DDD of, 'do proper DDD on', or fix the smells in an extracted / distilled / reverse-engineered `.domain` — e.g. 'this extracted model is anemic, redesign it', 'turn specy/loan.domain into proper DDD', 'fix the primitive obsession in the distilled model'. This refactors a domain MODEL, not source code: it is NOT for refactoring application/source code, NOT greenfield modelling from requirements or prose (use `specy:domain-design`), NOT extracting a model from a codebase (use `specy:domain-extract-from-code`), NOT generating code from a model (use `specy:domain-build-code`), NOT exploring/explaining a model (use `specy:domain-dialogue`), and NOT fixing parse errors or doing mechanical edits (renames) on a `.domain`."
user-invocable: true
---

# Skill: domain-refactor

## Role

You take a `.domain` model that was reverse-engineered from existing code — faithful to the
implementation, but carrying all of its design debt — and you redesign it **from first principles**
into a model a Domain-Driven Design practitioner would be proud of. You keep what the code taught you
(what the domain *does* and the words people use for it) and discard how the code happened to be
structured.

This skill is the bridge between `specy:domain-extract-from-code` (a faithful but flawed mirror of the
implementation) and a clean target model. It is **not** extraction — you do not read source code — and
it is **not** greenfield design from requirements (`domain-design`) — you start from a working
description of the domain's behaviour.

## Input → Output

- **Input:** `specy/<domain>.domain` (the extracted model) and, optionally,
  `specy/refactoring.report` (DDD smells already identified by `domain-extract-from-code`).
- **Output:**
  - `specy/<domain>.refactored.domain` — the redesigned model (greenfield: no `requirements-source`,
    `satisfies` left empty). **Never overwrite the extracted file.**
  - `specy/<domain>.refactor-rationale.md` — each major decision mapped to the smell it fixes, plus
    divergences and open questions. Followed by a short recap in chat.

## Prerequisites — load the schema

You are emitting a `.domain` file, so it must be valid against the metamodel and grammar — exactly the
same bar as `domain-design`.

1. Read `references/DOMAIN-METAMODEL.md` in full (every concept, relation, and the requirement-trace
   mechanism). The grammar is at `grammar/domain.ebnf`.
2. Read the extracted `specy/*.domain`. Identify the bounded context(s). If the user named one, scope
   to it; if there is exactly one, take it; otherwise ask which to redesign.
3. Read `specy/refactoring.report` **if it exists**. If it does not, detect the smells yourself from
   the extracted model using the catalog below — the skill works either way.

## Mindset — why a redesign, not a touch-up

A reverse-engineered model answers two questions well: **what** the domain does, and the **ubiquitous
language** to preserve. It answers a third question *badly*: **how** to structure the domain — because
its shapes mirror database tables, ORM entities, and request handlers, not the business. So treat the
extracted structure as a description of the current implementation, and re-derive structure from the
business problem. Behaviour first (operations, commands, events, transitions), then the structure that
behaviour implies (entities, value types, aggregates, fields).

## Workflow

1. **Read the domain back out of the extracted model.** List the nouns (candidate entities/values),
   verbs (operations/commands), facts (events), lifecycle states, and rules. This is your raw material
   and your ubiquitous-language dictionary.
2. **Re-derive the structure from first principles.** Decide entity vs value by identity-and-lifecycle,
   not by what had a table. Draw aggregate boundaries around a *shared consistency rule* (the boundary
   is the transactional scope), keeping them tight. Anchor each aggregate on the behaviour that must
   stay consistent.
3. **Apply the smell→fix catalog** (next section). For every fix, note which smell it resolves — that
   mapping is the core of the rationale you write at the end.
4. **Write `specy/<domain>.refactored.domain`** following the concrete syntax.
5. **Write `specy/<domain>.refactor-rationale.md`** and give a short chat recap.
6. **Offer the audit** — propose running `specy:domain-dialogue` on the refactored model to confront and
   stress-test it.

## Smell → fix catalog

Each entry is a common shape in extracted models and its proper DDD treatment. Use the
`refactoring.report` when present to know which apply; otherwise scan for these.

- **Anemic or god entity** (data bag with no behaviour, or one entity doing everything) → behaviour-rich
  entities with operations, gathered into a **tight aggregate** whose boundary is justified by a shared
  invariant. The aggregate **is** its root — it carries the identity, fields, operations and states
  directly, and `entities { }` lists only its non-root children (a cluster with no children is an
  `entity`, not an aggregate). Prefer small aggregates; if one grows past ~4 entities, justify the
  boundary explicitly (what consistency rule forces them to commit together?) rather than treating the
  size as a target.
- **Primitive obsession** (raw `decimal`/`string`/flag-`boolean` carrying domain meaning) → **value
  types** with constructor-validated invariants, so an invalid value cannot exist.
- **Illegal states are representable** (paired mutable flags + their satellite fields, e.g.
  `isApproved` + `approvedBy` + `approvedAt`) → collapse into a **present-or-absent value object**
  (`approval : Approval?`), making the illegal combinations unrepresentable.
- **Implicit or duplicated branch logic** (the same `if` scattered across operations) → lift into
  explicit **invariants** (each with its `enforcement`), **preconditions** (each with its `rejects`
  reason), and a **state machine** — a `states { machine ... }` block inside the entity, with no dead or
  trap states, whose transitions carry *named* preconditions rather than anonymous guards.
- **Generic "something changed" events** (`OrderUpdated`) → specific, intent-revealing **domain events**
  (`OrderShipped`, `DeliveryRescheduled`), bound to what they are a fact about (`about` / `caused-by`).
  And give every operation an explicit **error path** — an error event for the ways it can fail.
- **Missing temporal concerns** (deadlines, overdue, expiry handled by cron or buried flags) → surface
  them as **temporal events with guards**.
- **An event wired straight to a command** (a listener that mutates an aggregate, an event declaring the
  commands it `triggers`) → a **reaction**: `triggered-by` the event, a `guard` saying when the fact still
  matters to this context, `effects` the command. That guard is the decision the old shape had nowhere to
  put. It is the only event → command edge, for every event kind.
- **Foreign master data modelled as a local mutable entity** (a `Customer`/`Product` table this context
  writes to but does not own) → a **`read-only entity`** with `sourced-from` the owning context, and a
  `read-only repository`. If an upstream event only refreshes what we *know*, it belongs to the
  projection adapter (`projected-by`), not to the domain model; if it changes what we *decide*, it is an
  `external event` with a reaction.
- **A leaked adapter interface** (the domain depending on a technical port, or an interface with no
  declared direction) → an **`spi interface`** owned by the domain (`describes` the provider, which
  carries the matching `described-by`), and an **`api interface`** for the module's public surface.

## Ground rules

1. **Build from the business problem, not the extracted shapes.** The extracted model is inspiration and
   vocabulary, not a blueprint to transcribe.
2. **Preserve the ubiquitous language** — the domain nouns, verbs, and states — but rename anything that
   is technical jargon or a leaked implementation detail (e.g. `tbl_*`, `*Dto`, `statusCode`).
3. **Fix the smells, and record the fix.** Every significant design decision maps to a smell it resolves
   in the rationale file.
4. **You may simplify accidental lifecycle complexity** — drop redundant states, reject impossible
   inputs with a precondition instead of modelling a recovery state — but mark every such divergence
   with `// NOTE:` and its business justification.
5. **Push back on rules that look wrong or under-specified.** Propose the corrected rule and mark it
   `// UNCLEAR:` for a domain expert to confirm, rather than faithfully copying a likely bug.

## Conventions

- **Greenfield output:** omit `requirements-source`; leave `satisfies` empty. (The refactored model is a
  redesign, not a requirement realization.)
- **Provenance:** add a light `// from: <extracted concept>` comment on redesigned elements so the
  extracted→refactored diff is reviewable.
- `// UNCLEAR:` — business-critical ambiguity needing expert confirmation. `// NOTE:` — a deliberate
  divergence from the extracted model.
- **Never modify** the extracted `specy/<domain>.domain`.

## The redesigned model — concrete syntax

Write `specy/<domain>.refactored.domain` using the Specy v3 concrete syntax (full grammar in
`grammar/domain.ebnf`, all concepts in `references/DOMAIN-METAMODEL.md`):

## Concrete syntax

In `.domain` files, the `requirements-source` appears at the bounded context or organization level, and `satisfies` is **always the first element inside the body braces**:

```
context OrderContext {
  requirements-source "specs/order-requirements.sysreq"

  entity Order {
    satisfies [REQ-ORD-002, REQ-ORD-007]
    identity id : uuid
    fields { ... }
  }

  invariant PositiveQuantity {
    satisfies [REQ-ORD-001]
    on Order
    must { quantity > 0 }
    enforcement rejection
  }

  command PlaceOrder {
    satisfies [REQ-ORD-002]
    identity commandId : uuid
    fields { ... }
  }
}
```

The `requirements-source` path is relative to the `.domain` file's location.

## State machine syntax

An entity's lifecycle lives **inside** the entity or aggregate, in a `states { machine ... }` block. Both parsers (tree-sitter and the Langium CLI) accept it, so the model validates cleanly.

```
entity Order {
  identity id : uuid
  fields { ... }

  operations {
    "pay order"        on PayOrder        { ... }
    "ship order"       on ShipOrder       { ... }
    "confirm delivery" on ConfirmDelivery { ... }
    "cancel order"     on CancelOrder     { ... }
  }

  states {
    machine OrderLifecycle {
      state awaitingPayment {
        invariants {
          unpaid :: "An order awaiting payment has no recorded payment" {
            payment is not defined
            enforcement rejection
          }
        }
      }
      state paid
      state shipped
      final delivered
      final cancelled

      [*]             --> awaitingPayment on "place order"
      awaitingPayment --> paid            on "pay order"
      paid            --> shipped         on "ship order"
      shipped         --> delivered       on "confirm delivery"
      awaitingPayment --> cancelled       on "cancel order" {
        precondition notYetPaid { payment is not defined } rejects "A paid order cannot be cancelled here"
      }
    }
  }
}
```

Key points:

- The machine is nested in the entity that owns it — there is no top-level `statemachine`, and no separate `transitions { }` block.
- Exactly one start transition, written `[*] --> state on <operation>`. Zero or more `final` states.
- Each `state` may carry its own invariants, and each invariant declares an `enforcement`.
- `on` names the **entity operation** that drives the transition: the `"Label"` of a command-triggered operation, or the identifier of an internal one.
- A transition may carry **named** preconditions/postconditions. A precondition declares its violation reason with `rejects`. This is what lets one operation drive transitions out of several states with a *different* rule for each — `cancel` may be legal from `pending` always, but from `paid` only within the refund window.

## Agent instruction summary

When building or updating a domain model:

1. **Check if system requirements are provided.** Look for a `.sysreq` file, a requirements section, or any input containing EARS statements with identifiers.
2. **If requirements come from a file**: add a `requirements-source` declaration at the bounded context or organization level with the relative path to that file. This is mandatory — it is the provenance link that makes `satisfies` identifiers resolvable.
3. **If requirements exist**: for every domain model element you create or modify, determine which requirement(s) it realizes and populate the `satisfies` list with the corresponding identifier(s). Do not leave `satisfies` empty unless the element genuinely satisfies no requirement — and in that case, question whether the element should exist.
4. **If no requirements exist**: leave `satisfies` empty and omit `requirements-source`. Do not invent requirement identifiers.
5. **After building the model**: verify coverage — every `must` and `should` requirement should appear in at least one element's `satisfies` list. Flag any unsatisfied requirement as a gap.

## The rationale artifact

Write `specy/<domain>.refactor-rationale.md` with:

1. **Decision → smell table** — each major design move, the smell it fixes, and the DDD treatment
   applied.
2. **Lifecycle divergences** — every place you simplified or changed the extracted lifecycle, with the
   business justification (mirrors the `// NOTE:` markers in the model).
3. **Open questions** — the `// UNCLEAR:` items: rules you corrected or that need a domain expert to
   confirm.

Then give a short chat recap (3–6 bullets) of the biggest changes and anything you need confirmed.

## Then offer

Offer to run **`specy:domain-dialogue`** on `specy/<domain>.refactored.domain` to confront and
stress-test the redesign (state-machine completeness, aggregate boundaries, missing error/temporal
paths) before anyone builds against it.
