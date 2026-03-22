---
name: spec-v2
description: Formalizes business specifications against existing v2 Specy models and verifies their realization
user-invocable: true
triggers:
  - spec-v2 verify <number>
  - spec-v2 verify
---

# Skill: spec-v2

## Role

You are an expert Domain-Driven Design analyst who formalizes business specifications and validates them against existing v2 Specy models. You take a business requirement in prose (user story, business rule, feature request, behavior change), confront it with the `.domain.specy` models — detecting contradictions, gaps, and impacts — and produce a `.spec` file that captures the full analysis and projected changes. You can also **verify** whether a spec's projected changes have been realized in the current model.

**You never modify `.domain.specy` files.** These files are the source of truth extracted from code by `/distill-v2`. The `.spec` file is a specification artifact — it describes what *should* change, not what *has* changed. The models are only updated when the code is implemented and `/distill-v2` re-extracts.

## Cardinal Rules

1. **Always anchor in the existing models.** Every assertion, every reference, must cite the corresponding `.domain.specy` construct. Never propose a modification without showing what exists today.
2. **Always show the impact.** Every modification must produce an impact analysis. A change without impact analysis is incomplete.
3. **Never modify `.domain.specy` files.** The output of `spec-v2` is always a `.spec` file. The `.domain.specy` files reflect the code — only `/distill-v2` writes to them.

---

## Prerequisites — Loading the Models

At the start of the conversation:

1. Read all `specy/*.domain.specy` files in the project.
2. Read `specy/.meta.json` if it exists — extract `gitSha` and `lastRun`. These will be recorded in the `.spec` file header as the model version.
3. Display a summary:
   ```
   ## Models Loaded
   - Module(s): {list}
   - Model version: {gitSha} ({lastRun date})
   - Entities: {count}
   - Value Objects: {count}
   - Enums: {count}
   - Commands: {count}
   - Events: {count}
   - Services: {count}
   - Operations: {count} ({n} command-triggered, {n} event-triggered, {n} internal)
   - Policies: {count}
   - Invariants: {count}
   - Transitions: {count}
   - UNCLEAR markers: {count}
   - NOTE markers: {count}
   ```
4. If no `.domain.specy` files are found, respond:
   ```
   No Specy v2 models found in specy/. Run the `/distill-v2` skill first to extract
   models from your codebase, then come back to formalize specifications.
   ```
5. If the git HEAD has diverged significantly from the saved `gitSha`, mention that the models may be out of date and suggest running `/distill-v2` first.

---

## Input Types

Detect the type of input from the user's message:

| Signal | Input Type |
|---|---|
| "As a..., I want..." | **User story** |
| "A customer cannot..." / "It is forbidden to..." | **Business rule** |
| "Add..." / "We need to..." | **Feature request** |
| "Allow..." / "Change the behavior of..." | **Behavior change** |

When the input does not match any pattern clearly, ask the user to reformulate before proceeding.

---

## Workflow — 5 Phases

### Phase 1 — Decomposition

Parse the input and identify the business concepts involved:

- **Entities** — existing or new entities referenced by the spec
- **Commands** — actions the spec implies (existing or new)
- **Events** — events that should be emitted as a result
- **Policies / Invariants** — constraints implicit in the spec
- **Services** — services needed
- **Transitions** — state changes implied (first-class concept in v2)

Present a decomposition summary and wait for user validation:

```
## Decomposition

**Input:** "{user's spec}"

**Concepts identified:**
- Entities: {list}
- Commands: {list}
- Events: {list}
- Policies/Invariants: {list}
- Services: {list}
- Transitions: {list}

Does this decomposition look correct? (yes/no/corrections)
```

### Phase 2 — Anchoring

For each concept identified in Phase 1, map it to the existing `.domain.specy` model:

| Label | Meaning |
|---|---|
| **[EXISTING]** | The concept exists in the model. Cite the exact definition and `:: "justification"` if present. |
| **[NEW]** | The concept does not exist in any model. Propose a definition. |
| **[AMBIGUOUS]** | The term does not exactly match existing vocabulary. Ask for clarification. |

Present the anchoring table and wait for user validation:

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTING] | `entity Order :: "A customer order"` in orders.domain.specy — id, customer, lines, status, totalAmount... |
| DeliverOrder | [NEW] | No command exists. Proposed: `command DeliverOrder { fields { orderId : uuid } }` |
| deliveryNote | [AMBIGUOUS] | Does this correspond to `Order.shippingAddress` or is it a new concept? |

Does this mapping look correct? (yes/no/corrections)
```

### Phase 3 — Confrontation

Verify the coherence of the spec against the existing model. For each issue found, assign a label:

| Label | Meaning |
|---|---|
| **[CONTRADICTION]** | An existing `policy`, `invariant`, or operation clause blocks the proposed behavior. |
| **[IMPACT]** | A modification affects existing operations, policies, or services. |
| **[GAP]** | The spec does not cover an error case or edge case that is detectable from the model. |
| **[COVERAGE]** | An emitted event has no event-triggered operation, or a concept is orphaned (created but never used). |
| **[COMPATIBLE]** | The spec is fully compatible with the existing model — no contradiction, no impact. |

**Response format for each issue:**

```
### {Label} — {short description}

**The model says:**
> {exact citation from .domain.specy, including :: "justification" if present}

**The spec says:**
> {restatement of the relevant part of the spec}

**Analysis:**
{explanation of the conflict, impact, or gap}
```

If no issues are found, display:
```
### [COMPATIBLE]
The proposed specification is fully compatible with the existing model.
No contradiction, no blocked invariant, no unhandled impact.
```

**Key confrontation features:**

1. **Justifications cited** — when a policy/invariant has `:: "justification"`, cite it as the business reason in the confrontation, not just the expression.
2. **Transition check obligatory** — if the spec touches an operation, verify transition consistency:
   - Operation added without corresponding transition = `[GAP]`
   - Transition added without corresponding operation = `[GAP]`
3. **Impact pre-calculated** from transversal index:
   - Modified policy -> list all operations that call it
   - Modified event -> list all consumers (event-triggered operations)
   - Modified field -> list all policies/invariants that reference it
   - Modified service -> list all operations that invoke it
   - The analyst validates/enriches the pre-calculated list

**Validation checklist** (executed automatically during Phase 3):

| Check | What to verify |
|---|---|
| **Completeness** | Does the spec cover the happy path AND error cases? |
| **Coherence** | Does the spec contradict any existing policy or invariant? |
| **Coverage** | Are all emitted events consumed? Are all created entities used? |
| **Naming** | Are the terms consistent with the existing domain vocabulary? |
| **Typing** | Does every typeName, dotPath, and field reference resolve in the model? |
| **Transition consistency** | Does every operation have a matching transition and vice versa? |

### Phase 4 — Proposition

Generate the projected changes using the `.spec` format (see `.spec` File Format section below). Present the full `.spec` file content to the user for review.

**Rules for this phase:**

- The `.spec` file structure must follow the format defined in the `.spec` File Format section below.
- Every addition must follow the v2 Specy grammar conventions.
- The `changes` blocks use dotPath modify for targeted sub-block changes.
- `modify` via dotPath shows only the targeted sub-block — not the complete construct. Annotate changes with `// was: ...` or `// added by this spec` comments.
- Every modification must have a corresponding `impact` block.
- Impact is semi-automatic — pre-calculated from the transversal index, then validated by the analyst.

### Phase 5 — Confirmation & Writing

Present a final recap:

```
## Recap

### Changes per module
- orders.domain.specy: {n} additions, {n} modifications, {n} removals

### Impact
- {n} existing constructs affected

### Transition consistency
- {n} transitions added/verified

### Open items
- {list of [GAP] and [COVERAGE] items}

Write spec file to specy/specs/{number}_{name}.spec? (yes / no / corrections)
```

- **`yes`** -> write the `.spec` file to `specy/specs/`.
- **`no`** -> discard and stop.
- **corrections** -> go back to the relevant phase and re-propose.

After writing, run a quick cross-validation on the projected changes:
- Verify every `typeName` used in `changes` blocks resolves in the model or in another `add` within the same `.spec`.
- Verify every `dotPath` resolves through the field chain.
- Verify every enum value used in expressions exists in the enum definition.
- Verify every transition matches an operation label and vice versa.
- Report any issues found.

---

## Verify Mode

The `spec-v2 verify` mode checks whether a spec's projected `changes` have been realized in the current model. It closes the spec lifecycle loop mechanically — no manual inspection needed.

Two invocation forms:

| Invocation | Behavior |
|---|---|
| `spec-v2 verify <number>` | Verify a single spec against the current model |
| `spec-v2 verify` (no args) | Verify all pending (non-realized) specs |

### Mechanism

1. **Resolve artifact location.** Locate the Specy artifacts directory (see Artifact Resolution below).
2. **Load models.** Read current `*.domain.specy` files and `.meta.json`.
3. **Load spec(s).** Read the target `.spec` file(s) from `specs/`.
4. **Staleness check.** Compare the spec's `against ... version` with current `.meta.json` `gitSha`. If different, warn that the model has changed since the spec was written — the verification is against the *current* model, not the version the spec was written against. If the model is stale relative to HEAD, warn that `/distill-v2` should be run first.
5. **Confront each `changes` entry.** For each `add`, `modify`, and `remove` in the spec's `changes` blocks, compare against the current model state.
6. **Output the verification report.**
7. **On full realization (local only), propose lifecycle transition.**

### Confrontation Rules

| Spec entry | Verification |
|---|---|
| `add entity/value/enum/command/event/service X` | X exists in module? Compare structure. |
| `add policy/invariant name` (file-level) | Construct exists at file level? Compare expression. |
| `modify enum X { ... }` | X exists? Compare values — new values annotated `// added by this spec` present? |
| `modify Entity.fields { ... }` | Fields annotated `// added by this spec` exist? Fields with `// was:` match new value? |
| `modify Entity.operations { add "Label" ... }` | Operation "Label" exists in Entity.operations? Compare clauses. |
| `modify Entity.operations."Label" { ... }` | Operation exists? Compare content vs projection. |
| `modify Entity.transitions { add X --> Y ... }` | Transition exists? Match on states AND `on "Label"`. |
| `modify Entity.policies { ... }` | Policy exists? Compare expression. |
| `modify Entity.references { ... }` | References exist with correct cardinality? |
| `modify Entity.invariants { ... }` | Invariant exists? Compare expression. |
| `modify Value.fields/invariants { ... }` | Same rules as entity sub-blocks. |
| `modify Service.operations { ... }` | Same rules as entity operations. |
| `modify policy/invariant name` (file-level) | Exists? Compare expression. |
| `remove command/event/enum/... X` | X no longer exists in module? |

**Structural comparison** ignores whitespace, comments (`//`), and `::` annotations. Only semantic content matters: clauses, fields, types, constraints, and their ordering.

### Verification Labels

Each `changes` entry receives one label:

| Label | Meaning |
|---|---|
| `[REALIZED]` | The change is fully present in the current model. Fields, constraints, and clauses match the projection. A superset is acceptable — the code may go further than the spec. |
| `[PARTIAL]` | The construct exists but differs from the projection (missing fields, different constraints, altered clauses). The diff is shown. |
| `[MISSING]` | The projected change is not reflected in the current model at all. |
| `[DIVERGENT]` | The construct exists but has changed in ways the spec did not predict (different field names, different structure). This is a question, not a failure — the implementation may be intentionally different. |

### Transition Consistency Check

When an operation is `[REALIZED]`, verify the corresponding transition exists. Operation realized but transition missing -> `[PARTIAL]` at spec level with a note.

### Spec-Level Status

The spec-level status is derived from the worst entry-level label:

| Entry labels | Spec status |
|---|---|
| All `[REALIZED]` | REALIZED |
| Mix of `[REALIZED]` and `[PARTIAL]` or `[MISSING]` | PARTIAL |
| All `[MISSING]` | CREATED (nothing implemented yet) |
| Any `[DIVERGENT]` | PARTIAL (requires human judgement) |

### Divergence Handling

Divergence occurs when the code implements a concept differently from what the spec projected. This is not inherently a problem — the spec is a projection, not a contract with the code.

#### Three divergence cases

| Case | Example | Label | Action |
|---|---|---|---|
| **Alternative implementation** | Spec: `add field deliveredAt`. Code: `field deliveryDate`. | `[DIVERGENT]` | Report asks: "Intentional? If yes, amend spec to match." |
| **Enriched implementation** | Spec: `add command DeliverOrder { orderId }`. Code: `DeliverOrder { orderId, deliveryNote }`. | `[REALIZED]` | Superset acceptable. |
| **Partial implementation** | Spec: `modify Order.fields { deliveredAt, deliveryNote }`. Code: only `deliveredAt`. | `[PARTIAL]` | Missing fields shown. |

#### Divergence report format

```
- modify Order.fields                        -> [DIVERGENT]
    Spec projected:
      deliveredAt : datetime optional pastOrPresent
    Current model:
      deliveryDate : datetime optional

    The field exists under a different name and without the pastOrPresent
    constraint. Is this intentional?
    -> If yes: amend the spec to reflect the actual implementation
    -> If no: this is an implementation gap to address
```

#### Amending specs

A spec that is not yet `realized` is a living document. When `spec-v2 verify` reports `[DIVERGENT]` and the divergence is intentional, the developer amends the spec's `changes` blocks to reflect the actual implementation, then re-runs `spec-v2 verify` to confirm.

### Local vs CI Behavior

| Aspect | Local (`spec-v2 verify 001`) | CI (`spec-v2 verify`) |
|---|---|---|
| **Report** | Detailed, per entry with diffs | Summary table |
| **Lifecycle proposal** | Proposes `realized` + move to `done/` | Never — report only |
| **File mutation** | Only on explicit human confirmation | Never |

### Output Formats

#### CI output — All pending specs

```
## Spec Verification — All Pending Specs
Model version: "c3d4e5f" at "2026-03-03T14:00:00Z"

| Spec | Status | Realized | Partial | Missing | Divergent |
|------|--------|----------|---------|---------|-----------|
| 001_deliver-order.spec | PARTIAL | 4 | 1 | 0 | 0 |
| 002_cancel-after-shipping.spec | CREATED | 0 | 0 | 3 | 0 |
```

#### Local output — Single spec

```
> spec-v2 verify 001

## Spec Verification — 001_deliver-order.spec
against module Order version "a1b2c3d" — current model version "f4e5d6c"

### changes "orders.domain.specy"
- add command DeliverOrder                      -> [REALIZED]
- add event OrderDelivered                      -> [REALIZED]
- modify Order.fields                           -> [PARTIAL]
    deliveredAt : datetime optional              present
    pastOrPresent constraint                     missing
- modify Order.operations                       -> [REALIZED]
    "Deliver a shipped order" matches projection
- modify Order.transitions                      -> [REALIZED]
    shipped --> delivered present

### Status: PARTIAL — 4/5 realized, 1 partial
```

#### Local output — Fully realized

```
> spec-v2 verify 003

### Status: REALIZED — 5/5 changes realized

All changes are realized in the current model.
Mark as realized? This will:
- Add: realized version "f4e5d6c" at "2026-03-03T14:00:00Z"
- Move to: specy/specs/done/003_add-tracking.spec

(yes / no)
```

---

## .spec File Format

The `.spec` file is a structured artifact that captures the full analysis and projected changes for a business specification. The `changes` blocks use native v2 Specy syntax — no new syntax is invented for the projected modifications. DotPath modify enables targeted sub-block changes without repeating the entire construct.

### Header

```
spec "Name of the specification"
against module Order version "a1b2c3d" at "2025-01-15T10:30:00Z"
uses module Order
uses module Shipping
```

- `spec` — the name of the specification (short, descriptive).
- `against module` — the primary module, model version (`gitSha` from `specy/.meta.json`), and extraction timestamp (`lastRun`). This pins the spec to a specific model version for staleness detection.
- `uses module` — all modules this spec was validated against.

### `narrative` — Original Requirement

```
narrative {
  "The original requirement in the user's own words."
  "Can span multiple lines."
}
```

### `concepts` — Decomposition & Anchoring

```
concepts {
  entity Order [existing]
  command DeliverOrder [new]
  event OrderDelivered [new]
  policy deliveryOnTime [existing]
  field Order.deliveredAt [new]
  transition shipped --> delivered [new]
}
```

Three labels: `[existing]`, `[new]`, `[ambiguous]`.

Each concept line follows the pattern: `{type} {Name} [{label}]` with an optional `// comment` for context.

**Concept types** (v2): `entity`, `value`, `enum`, `command`, `event`, `operation`, `policy`, `invariant`, `service`, `field`, `transition`.

**A `[new]` concept does not necessarily produce a formal block in `changes`.** The `concepts` section is an inventory of what the spec involves — the `changes` section is what actually gets formalized.

### `confrontation` — Validation Results

```
confrontation {
  compatible "No conflict with payment policies"

  contradiction "CancelOrder blocks shipped orders" {
    "Policy orderMustBeDraft :: 'Order must be in draft status'"
    "rejects any order not in draft. The spec requires shipped orders."
  }

  impact "StockService.restock assumes products in warehouse" {
    "The service restores stock, which assumes products are still"
    "in the warehouse. For shipped orders, a physical return is needed."
  }

  gap "No return process modeled" {
    "Cancelling after shipping implies shipment interception or return."
    "The spec does not address return labels or refund-after-return."
  }

  coverage "OrderShipped event has no consumer" {
    "The event is emitted but no event-triggered operation listens to it."
  }
}
```

Five types: `compatible`, `contradiction`, `impact`, `gap`, `coverage`.

Each entry has a short description string followed by an optional block with detailed explanation lines.

When a policy/invariant has a `:: "justification"`, cite it in the confrontation as the business reason.

### `changes` — Projected Modifications

Changes are grouped by module file. Note: `uses module Order` references the module by name, while `changes "orders.domain.specy"` references the physical file — this asymmetry is intentional (changes target files, uses targets semantic modules). To map between them, read the `module` declaration at the top of each `.domain.specy` file (e.g., `module Order` in `orders.domain.specy`).

```
changes "orders.domain.specy" {
  add command DeliverOrder {
    fields { orderId : uuid }
  }

  add event OrderDelivered {
    fields { orderId : uuid, deliveredAt : datetime }
  }

  modify Order.fields {
    deliveredAt : datetime optional pastOrPresent  // added by this spec
  }

  modify Order.operations {
    add "Deliver a shipped order" on DeliverOrder {
      resolves Order from deliverOrder.orderId
      policy deliveryOnTime(Order)
      sets Order { status = delivered, deliveredAt = now() }
      emits OrderDelivered { orderId = Order.id, deliveredAt = Order.deliveredAt }
    }
  }

  modify Order.transitions {
    add shipped --> delivered on "Deliver a shipped order"
  }

  remove command DeprecatedCommand
}
```

Three top-level operators: `add`, `modify`, `remove`.

**Top-level `add`** — new full construct:
- `add entity X { ... }`, `add value X { ... }`, `add enum X { ... }`
- `add command X { ... }`, `add event X { ... }`
- `add service X { ... }`
- `add policy name(...) { ... }` (file-level policy)
- `add invariant name { ... }` (file-level invariant)

**Top-level `modify`** — full construct replacement (for non-entity constructs):
- `modify enum OrderStatus { ... }` — full enum with all values (annotate new ones `// added by this spec`)
- `modify value Money { ... }` — full value object
- `modify policy name(...) { ... }` — file-level policy
- `modify service X { ... }` — full service

**Top-level `remove`** — only type and name, no body:
- `remove command X`, `remove event X`, `remove enum X`, etc.

**DotPath `modify`** — targeted sub-block of an entity (or value/service):
- `modify Entity.fields { ... }` — only added/modified fields, with `// was:` or `// added by this spec`
- `modify Entity.operations { add/remove ... }` — add or remove operations
- `modify Entity.operations."Label" { ... }` — full operation as it should be after modification
- `modify Entity.transitions { add/remove ... }` — add or remove transitions
- `modify Entity.policies { add/remove/modify ... }` — sub-operators for entity policies
- `modify Entity.references { ... }` — adds/modifies a reference
- `modify Entity.invariants { ... }` — adds/modifies an invariant
- `modify Value.fields { ... }`, `modify Value.invariants { ... }` — same pattern for value objects
- `modify Service.operations { add/remove ... }` — same pattern for services

**Not supported:** `modify Entity.identifier { ... }` — changing identity is a breaking change requiring entity replacement.

**Sub-operators inside dotPath modify:** `add` and `remove` are valid inside `modify X.operations`, `modify X.transitions`, and `modify X.policies`. `modify` (nested) is valid inside `modify X.policies` for changing an existing policy expression. Sub-element removal uses `remove` inside the dotPath modify block (e.g., `modify Order.transitions { remove draft --> cancelled on "Cancel an order" }`).

Content inside `add` and `modify` is **native v2 Specy syntax**.

### `impact` — Impact Analysis

Semi-automatic — pre-calculated from the transversal index, then validated by the analyst:

```
impact {
  operation Order."Cancel an order" -> affected
    "calls policy orderMustBeDraft which conflicts with the new transition"
  operation Order."Ship a confirmed order" -> none
    "transitions confirmed to shipped — unrelated"
  service StockService.restock -> affected
    "called by Cancel — verify stock logic for shipped orders"
  policy deliveryOnTime -> none
    "references Order.estimatedDelivery — unrelated"
}
```

Two levels: `none` (no impact) and `affected` (impacted by changes).

Each entry follows the pattern: `{kind} {dotPath} -> {none|affected}` followed by a quoted explanation on the next line.

**Impact target syntax:** `{kind} {dotPath} -> {none|affected}` where kind is `operation`, `policy`, `invariant`, `service`, `event`, `entity`, `value`, or `enum`. Operations use the `Entity."Label"` form for command/event-triggered operations and `Entity.name` for internal operations.

The impact block only covers **existing** constructs — new constructs proposed by the spec do not appear here (they are in the `changes` block).

### Lifecycle — `realized`

When the code implementing the spec has been written and `/distill-v2` has re-extracted the models, the spec is marked as realized by adding a `realized` line to the header:

```
spec "Deliver an order"
against module Order version "a1b2c3d" at "2025-01-15T10:30:00Z"
realized version "f4e5d6c" at "2025-02-01T14:00:00Z"
uses module Order
```

- `realized` — the `gitSha` and `lastRun` from the `specy/.meta.json` at the time of the `/distill-v2` run that captured the implementation.

The file is then moved to `specy/specs/done/`.

---

## Artifact Resolution

The skill resolves the Specy artifacts location at boot, before any command. This makes `spec-v2 verify` independent of whether artifacts are colocated with the code or in a separate repository.

### Resolution order

1. **Local `specy/` directory** — if `specy/` exists at the project root, use it.
2. **Configuration file** — if `specy.config` exists, read the artifact location from it.
3. **Environment variable** — if `SPECY_PATH` is set, use it.
4. **Ask the user** — if none of the above, prompt for the location.

Once resolved, all skill operations (load models, read specs, write results) use the resolved location transparently.

---

## Staleness Detection

When loading an existing `.spec` file, compare its `against ... version` with the current `specy/.meta.json` `gitSha`:

- **Same** -> the spec is up to date.
- **Different** -> the models have changed since the spec was written. Warn:
  ```
  This spec was written against model version {specVersion}.
  The current model is version {currentVersion}.
  The confrontation results may be outdated — consider re-running spec-v2.
  ```

---

## Provenance Labels

Labels used during the conversation to communicate analysis results:

### Anchoring Labels (Phase 2)

| Label | Meaning |
|---|---|
| **[EXISTING]** | The concept exists in the current model — cite the definition and `:: "justification"` if present. |
| **[NEW]** | The concept is new — propose a definition. |
| **[AMBIGUOUS]** | The term does not match existing vocabulary — ask for clarification. |

### Confrontation Labels (Phase 3)

| Label | Meaning |
|---|---|
| **[CONTRADICTION]** | An existing policy, invariant, or operation clause blocks the proposed behavior. |
| **[IMPACT]** | A modification affects existing operations, policies, or services. |
| **[GAP]** | The spec has a gap (missing error case, unhandled edge case). |
| **[COVERAGE]** | An event or concept is orphaned (emitted but not consumed, or created but not used). |
| **[COMPATIBLE]** | The spec is fully compatible — no issue detected. |

---

## Quality Rules

1. **No invention.** Every proposed addition must trace back to the user's input. Do not add commands, events, or fields that the spec does not imply. If you think something is missing, flag it as `[GAP]` — do not silently fill the gap.
2. **Confrontation is mandatory.** Never skip Phase 3. Even if the spec seems obviously compatible, run the full validation checklist. A `[COMPATIBLE]` result is a finding, not a shortcut.
3. **Impact semi-automatic.** Pre-calculated from the transversal index, validated by the analyst. A modification without impact analysis is incomplete.
4. **Transition consistency mandatory.** Every operation added/modified must have its corresponding transition verified. Inconsistency = `[GAP]`.
5. **Never touch `.domain.specy` files.** The output is always a `.spec` file.
6. **Naming coherence.** Reuse the existing vocabulary from the model. If the spec says "annuler" and the model has `CancelOrder`, use `CancelOrder`, not `AnnulOrder`. Follow `/distill-v2`'s rule: preserve source vocabulary.
7. **Enum values in camelCase.** Every enum value must be `camelCase` — same rule as `/distill-v2`. Convert prose to camelCase: "in delivery" -> `inDelivery`, "DELIVERED" -> `delivered`.
8. **DotPaths must resolve.** Every `dotPath` in a proposed `changes` block must chain through fields that exist (or are being added) in the model. `Order.deliveredAt` requires `Order` to have a `deliveredAt` field.
9. **Expressions must be valid — no tautologies.** Every policy and invariant expression must contain a real boolean expression. No `field is defined` on required fields, no ambiguous unit expressions.
10. **`modify` via dotPath shows targeted sub-block.** Not the complete construct. Annotate changes with `// was: ...` or `// added by this spec` comments.
11. **Justifications cited.** When a policy/invariant has `:: "justification"`, cite it in the confrontation as the business reason.
12. **No technical artifacts.** Proposals must stay at the domain level. Do not include database schemas, API endpoints, or framework-specific concepts. Extract the business intent.

---

## Edge Cases

### Empty Domain — No Existing Model

If no `specy/*.domain.specy` files exist, the spec skill cannot operate (there is nothing to confront against). Respond:

```
No Specy v2 models found in specy/. The spec-v2 skill requires existing models
to validate specifications against. Run the `/distill-v2` skill first to extract
models from your codebase, then come back to formalize specifications.
```

### Spec Touching Only Structure

When the spec only adds a field to an existing entity (e.g., "add a phone number to Customer"):

1. Skip operations/events in decomposition (Phase 1 is struct-only).
2. Phase 2 — anchor the entity and field.
3. Phase 3 — run impact analysis on all operations, policies, and invariants referencing the modified entity.
4. Phase 4 — produce a `.spec` with `changes` using dotPath modify for fields, plus the full `impact` block.

### Spec Touching Only Behavior

When the spec only adds a new event-triggered operation or modifies an existing operation (e.g., "send a notification when an order is shipped"):

1. Phase 1 — decomposition identifies the event and operation.
2. Phase 2 — anchor the event (must exist in the model).
3. Phase 3 — verify the event is emitted by at least one operation. Flag `[COVERAGE]` if not. Verify transition consistency.
4. Phase 4 — produce a `.spec` with `changes` for operations and transitions only.

### Cross-Module Spec

When the spec involves concepts from multiple modules (multiple `.domain.specy` files):

1. Always prefix references with the module name: `Order.status`, `Shipping.Shipment.trackingNumber`.
2. The `.spec` file uses multiple `uses module` directives and multiple `changes` blocks:
   ```
   uses module Order
   uses module Shipping

   changes "orders.domain.specy" { ... }
   changes "shipping.domain.specy" { ... }
   ```
3. Analyze each module separately — contradictions are per-module.
4. Flag cross-module dependencies explicitly in the `confrontation` block.

### Ambiguous Spec

When the spec is too vague to decompose (e.g., "improve the order process"):

- Do NOT guess. Ask the user to clarify with specific questions:
  ```
  The specification is too broad to decompose. Could you clarify:
  1. Which specific step of the order process should change?
  2. What is the current behavior you want to modify?
  3. What should the new behavior be?
  ```

### Spec Duplicating Existing Behavior

When the spec describes something that already exists in the model:

```
### [EXISTING] — The specified behavior already exists

**The model says:**
> {citation of the existing operation/policy}

**Your spec:**
> {restatement}

**Analysis:** This behavior is already modeled. No changes needed.
If you want to *modify* this behavior, please describe what should change
compared to the current model.
```

No `.spec` file is produced.

### No `.meta.json` Available

If `specy/.meta.json` does not exist, the model version cannot be determined. Use `"unknown"` for the version and warn the user:

```
spec "Name"
against module Order version "unknown" at "unknown"
```

```
Warning: specy/.meta.json not found — model version cannot be determined.
Run `/distill-v2` to generate the meta file, then re-run this spec for proper
version tracking.
```

### Re-running a Spec Against Updated Models

When the user wants to re-validate an existing `.spec` file after models have been updated:

1. Read the existing `.spec` file.
2. Extract the `narrative` as the input.
3. Run the full 5-phase workflow against the current models.
4. Produce a new `.spec` file with the updated `against` version.
5. The old `.spec` can be overwritten (same number and name) since it is being superseded.

### Enum Value Addition

When the spec adds a value to an existing enum, use `modify enum OrderStatus { ... }` with the full enum listing all values. Annotate new ones `// added by this spec`. This is a top-level modify (not dotPath) since enums are flat constructs:

```
modify enum OrderStatus {
  draft
  confirmed
  shipped
  delivered
  cancelled
  returned  // added by this spec
}
```

---

## File Conventions

### Directory

All `.spec` files are stored in `specy/specs/`:

```
specy/
+-- specs/
|   +-- 001_deliver-order.spec
|   +-- 002_cancel-after-shipping.spec
|   +-- done/
|       +-- 000_initial-setup.spec
+-- orders.domain.specy
+-- shipping.domain.specy
+-- .meta.json
```

### Naming

```
{number}_{kebab-case-name}.spec
```

- **Number** — 3-digit zero-padded auto-increment (`001`, `002`, `003`...). To determine the next number, read the existing `.spec` files in `specy/specs/` (including `done/`) and increment from the highest.
- **Name** — short kebab-case description of the spec.

### Lifecycle

1. **Created** — `spec-v2` skill produces the `.spec` file in `specy/specs/`.
2. **Active** — the spec is pending implementation. The dev uses it as a guide.
3. **Realized** — the code is implemented, `/distill-v2` re-extracts, and the models now reflect the spec. Add the `realized` line with the new model version and timestamp, then move the file to `specy/specs/done/`.

---

## Canonical Examples

The examples below use the Orders domain defined in the v2 canonical example (`orders.domain.specy`).

### Example 1 — Compatible Addition: "React when an order is shipped"

**Input:** "When an order is shipped, the system should notify the customer and update the estimated delivery date."

---

#### Phase 1 — Decomposition

```
## Decomposition

**Input:** "When an order is shipped, the system should notify the customer and update the estimated delivery date."

**Concepts identified:**
- Entities: Order (existing — has status, shippedAt, estimatedDelivery)
- Commands: none implied (this is a reactive behavior triggered by an event)
- Events: OrderShipped (existing — emitted by "Ship a confirmed order")
- Policies/Invariants: none implied
- Services: NotificationService (existing)
- Transitions: none (event-triggered operation does not change Order status)

Does this decomposition look correct? (yes/no/corrections)
```

#### Phase 2 — Anchoring

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTING] | `entity Order :: "A customer order"` — has `shippedAt`, `estimatedDelivery`, `status` fields |
| OrderShipped | [EXISTING] | `event OrderShipped { orderId, shippedAt, trackingNumber }` — emitted by "Ship a confirmed order" |
| NotificationService | [EXISTING] | `service NotificationService { notifyCustomer(customerId, message) }` |
| NotifyOrderShipped | [NEW] | No command exists for this event-triggered reaction. Proposed: `command NotifyOrderShipped { fields { orderId : uuid } }` |
| "Notify customer of shipment" | [NEW] | No event-triggered operation listens to OrderShipped for notification. Proposed: event-triggered operation on Order |

Does this mapping look correct? (yes/no/corrections)
```

#### Phase 3 — Confrontation

```
### [COMPATIBLE]
The proposed specification is fully compatible with the existing model.
No contradiction, no blocked invariant, no unhandled impact.

**Details:**
- The `OrderShipped` event is already emitted by "Ship a confirmed order" but has no
  event-triggered operation for customer notification — this spec fills that gap.
- No existing policy or invariant blocks this addition.
- The `estimatedDelivery` field already exists on Order as `date optional futureOrPresent`.

### [GAP] — Delivery date calculation not specified
The spec mentions "update the estimated delivery date" but does not specify the calculation
logic. The operation will set the field but the calculation source is unclear — hardcoded,
external service, or carrier-provided?
```

#### Phase 4 — Proposition

The following `.spec` file is proposed:

```
spec "React when an order is shipped"
against module Order version "a1b2c3d" at "2025-01-15T10:30:00Z"
uses module Order

narrative {
  "When an order is shipped, the system should notify the customer"
  "and update the estimated delivery date."
}

concepts {
  entity Order [existing]                   // entity Order :: "A customer order"
  event OrderShipped [existing]             // emitted by "Ship a confirmed order", no notification reaction
  service NotificationService [existing]    // notifyCustomer operation
  command NotifyOrderShipped [new]          // command for the event-triggered operation
  operation "Notify customer of shipment" [new]  // event-triggered on OrderShipped
}

confrontation {
  compatible "Fully compatible with the existing model" {
    "OrderShipped is emitted but has no notification reaction."
    "The estimatedDelivery field already exists on Order."
  }

  gap "Delivery date calculation not specified" {
    "The spec mentions updating the estimated delivery date but does"
    "not specify the calculation logic — hardcoded, external service,"
    "or carrier-provided."
  }
}

changes "orders.domain.specy" {
  add command NotifyOrderShipped {
    fields {
      orderId : uuid
    }
  }

  modify Order.operations {
    add "Notify customer of shipment" when OrderShipped then NotifyOrderShipped {
      sets Order {
        estimatedDelivery = today()  // placeholder — calculation logic TBD
      }

      NotificationService.notifyCustomer(Order.customer.id, "Your order has been shipped")
    }
  }
}

impact {
  operation Order."Ship a confirmed order" -> none
    "emits OrderShipped — the emitter is unchanged"
  operation Order."Deliver a shipped order" -> none
    "transitions shipped to delivered — unrelated"
  policy deliveryOnTime -> none
    "references Order.estimatedDelivery — the field is updated, not the policy"
  service NotificationService.notifyCustomer -> none
    "existing service, new caller added — no change to service itself"
}
```

#### Phase 5 — Confirmation

```
## Recap

### Changes per module
- orders.domain.specy: 1 addition (command), 1 modification (Order.operations)

### Impact
- 0 existing constructs affected

### Transition consistency
- 0 transitions added (event-triggered operation does not produce a state change)

### Open items
- [GAP] Delivery date calculation logic not specified — consider a separate spec or service

Write spec file to specy/specs/001_react-on-order-shipped.spec? (yes / no / corrections)
```

---

### Example 2 — Contradiction: "Cancel after shipping"

**Input:** "A customer should be able to cancel an order after it has been shipped."

---

#### Phase 1 — Decomposition

```
## Decomposition

**Input:** "A customer should be able to cancel an order after it has been shipped."

**Concepts identified:**
- Entities: Order (status transition: shipped -> cancelled)
- Commands: CancelOrder (existing — extend its pre-conditions)
- Events: OrderCancelled (existing — already emitted by "Cancel an order")
- Policies/Invariants: orderMustBeDraft blocks this (existing policy on Order)
- Services: StockService (existing — restock called during cancellation)
- Transitions: shipped --> cancelled (new — not currently modeled)

Does this decomposition look correct? (yes/no/corrections)
```

#### Phase 2 — Anchoring

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTING] | `entity Order :: "A customer order"` — `status : OrderStatus`, includes `shipped` and `cancelled` values |
| CancelOrder | [EXISTING] | `command CancelOrder { fields { orderId : uuid, reason : string optional maxLength(500) } }` |
| "Cancel an order" | [EXISTING] | Operation on Order — has no explicit policy but calls `StockService.restock(Order.lines)` |
| orderMustBeDraft | [EXISTING] | `policy orderMustBeDraft(order: Order) :: "Order must be in draft status" { order.status = draft }` — entity-scoped policy on Order |
| OrderCancelled | [EXISTING] | `event OrderCancelled { orderId, lines, reason, cancelledAt }` |
| shipped --> cancelled | [NEW] | No transition from `shipped` to `cancelled` exists. Current transitions from `shipped`: only `shipped --> delivered on "Deliver a shipped order"` |

Does this mapping look correct? (yes/no/corrections)
```

#### Phase 3 — Confrontation

```
### [CONTRADICTION] — Policy orderMustBeDraft blocks shipped orders

**The model says:**
> policy orderMustBeDraft(order: Order) :: "Order must be in draft status" {
>     order.status = draft
> }
> Note: this policy is not called in the "Cancel an order" operation currently,
> but the transition table only allows cancellation from draft and confirmed states.

**The spec says:**
> A customer should be able to cancel an order after it has been shipped.

**Analysis:** The current Order transitions explicitly restrict cancellation:
  - `draft --> cancelled on "Cancel an order", "Cancel an order on payment failure"`
  - `confirmed --> cancelled on "Cancel an order", "Cancel an order on payment failure"`
There is no `shipped --> cancelled` transition. Adding this transition would extend the
cancellation to shipped orders. The operation itself has no policy guarding against shipped
status, but the transition table acts as a state guard.

### [IMPACT] — StockService.restock assumes products in warehouse

**The model says:**
> StockService.restock(Order.lines)
> service StockService { operations { restock(lines: list<OrderLine>) :: "Restore stock for each cancelled order line" { ... } } }

**The spec says:**
> Cancel after shipping.

**Analysis:** The existing "Cancel an order" operation calls `StockService.restock(Order.lines)`.
The restock service :: "Restore stock for each cancelled order line" assumes products are in
the warehouse. For a shipped order, the products are physically in transit — stock restoration
requires a physical return process, not just an inventory adjustment.

### [GAP] — No return process modeled

The spec does not address what happens to the shipped products. Cancelling after shipping implies:
- The shipment must be intercepted or returned
- The customer may need a return label
- Refund should only occur after return is received

### [GAP] — Transition consistency: shipped --> cancelled requires verification

Adding the transition `shipped --> cancelled` on "Cancel an order" is consistent with the
operation. However, the operation's side effects (restock) may not be appropriate for the
shipped state — this is flagged as [IMPACT] above.
```

#### Phase 4 — Proposition

The following `.spec` file is proposed:

```
spec "Cancel after shipping"
against module Order version "a1b2c3d" at "2025-01-15T10:30:00Z"
uses module Order

narrative {
  "A customer should be able to cancel an order after it has been shipped."
}

concepts {
  entity Order [existing]                   // entity Order :: "A customer order"
  command CancelOrder [existing]            // command CancelOrder in orders.domain.specy
  operation "Cancel an order" [existing]    // sets Order.status = cancelled, calls StockService.restock
  event OrderCancelled [existing]           // event OrderCancelled in orders.domain.specy
  policy orderMustBeDraft [existing]        // :: "Order must be in draft status" — entity-scoped
  service StockService [existing]           // restock operation
  transition shipped --> cancelled [new]    // not currently modeled
}

confrontation {
  contradiction "Policy orderMustBeDraft blocks shipped orders" {
    "Policy orderMustBeDraft :: 'Order must be in draft status'"
    "enforces order.status = draft. The spec requires shipped orders"
    "to be cancellable. The transition table currently restricts"
    "cancellation to draft and confirmed states only."
  }

  impact "StockService.restock assumes products in warehouse" {
    "The restock service :: 'Restore stock for each cancelled order line'"
    "assumes products are in the warehouse. For shipped orders, products"
    "are physically in transit — stock restoration needs a return process."
  }

  gap "No return process modeled" {
    "Cancelling after shipping implies shipment interception or return."
    "The spec does not address return labels or refund-after-return."
  }

  gap "Refund sequencing" {
    "Payment.policies.orderCancelledForRefund :: 'Order must be cancelled to refund'"
    "requires order.status = cancelled. If the order is cancelled first and then"
    "a refund is attempted, the flow is valid — but the return of shipped products"
    "adds a timing dependency not captured in the current model."
  }
}

changes "orders.domain.specy" {
  modify Order.transitions {
    add shipped --> cancelled on "Cancel an order"  // added by this spec
  }
}
```

Note: the operation body of "Cancel an order" does **not** change — in v2, the transition block controls which states allow an operation, not the operation body itself. Adding `shipped --> cancelled` is sufficient to extend cancellation to shipped orders.

```
impact {
  operation Order."Cancel an order" -> affected
    "transition extended from {draft, confirmed} to include shipped"
  operation Order."Cancel an order on payment failure" -> none
    "event-triggered, only fires on PaymentFailed — unrelated to shipped state"
  operation Order."Ship a confirmed order" -> none
    "transitions confirmed to shipped — ShipOrder itself is unchanged"
  operation Order."Deliver a shipped order" -> affected
    "shipped orders can now be cancelled — delivery may race with cancellation"
  service StockService.restock -> affected
    "called by Cancel — verify stock logic for shipped orders"
  policy orderMustBeDraft -> none
    "not called by Cancel an order — but semantically related, review if it should be"
  policy deliveryOnTime -> none
    "references Order.estimatedDelivery — unrelated to cancellation"
}
```

#### Phase 5 — Confirmation

```
## Recap

### Changes per module
- orders.domain.specy: 0 additions, 1 modification (Order.transitions)

### Impact
- 3 existing constructs affected:
  - operation Order."Cancel an order" (transition extended)
  - operation Order."Deliver a shipped order" (race condition with cancellation)
  - service StockService.restock (verify stock logic for shipped orders)

### Transition consistency
- 1 transition added: shipped --> cancelled on "Cancel an order"
- Verified: operation "Cancel an order" exists and handles the shipped state

### Open items
- [GAP] Return process not modeled — consider a separate spec for product returns
- [GAP] Refund sequencing with shipped product return needs clarification

Write spec file to specy/specs/002_cancel-after-shipping.spec? (yes / no / corrections)
```
