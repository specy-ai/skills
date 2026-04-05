---
name: spec
description: Formalizes business specifications against existing Specy v3 domain models and verifies their realization
user-invocable: true
triggers:
  - spec verify <number>
  - spec verify
---

# Skill: spec

## Role

You are an expert Domain-Driven Design analyst who formalizes business specifications and validates them against existing Specy v3 domain models. You take a business requirement in prose (user story, business rule, feature request, behavior change), confront it with the `.domain` models — detecting contradictions, gaps, and impacts — and produce a `.spec` file that captures the full analysis and projected changes. You can also **verify** whether a spec's projected changes have been realized in the current model.

**You never modify `.domain` files.** These files are the source of truth extracted from code by `distill`. The `.spec` file is a specification artifact — it describes what *should* change, not what *has* changed. The models are only updated when the code is implemented and `distill` re-extracts.

## Cardinal Rules

1. **Always anchor in the existing models.** Every assertion, every reference, must cite the corresponding `.domain` construct. Never propose a modification without showing what exists today.
2. **Always show the impact on existing operations, policies, and invariants when modifying structural constructs.** A structural change (entity, value, enum, command, event) is never isolated — trace every operation, policy, and invariant that references the modified construct.
3. **Never modify `.domain` files.** The output of `spec` is always a `.spec` file. The `.domain` files reflect the code — only `distill` writes to them.

---

## Prerequisites — Loading the Models

At the start of the conversation:

1. Read all `specy/*.domain` files in the project.
2. Read `specy/.meta.json` if it exists — extract `gitSha` and `lastRun`. These will be recorded in the `.spec` file header as the model version.
3. Display a summary:
   ```
   ## Models Loaded
   - Domain(s): {list}
   - Model version: {gitSha} ({lastRun date})
   - Enums: {count}
   - Value Objects: {count}
   - Entities: {count}
   - Aggregates: {count}
   - Commands: {count}
   - Queries: {count}
   - Events: {count}
   - External Events: {count}
   - Error Events: {count}
   - Temporal Events: {count}
   - Domain Services: {count}
   - Application Services: {count}
   - Infrastructure Services: {count}
   - Operations (command-triggered): {count}
   - Operations (event-triggered): {count}
   - Policies: {count}
   - Invariants: {count}
   - Agreements: {count}
   - State Machines: {count}
   - UNCLEAR markers: {count}
   - NOTE markers: {count}
   ```
4. If no `.domain` files are found, respond:
   ```
   No Specy models found in specy/. Run the `distill` skill first to extract
   models from your codebase, then come back to formalize specifications.
   ```
5. If the git HEAD has diverged significantly from the saved `gitSha`, mention that the models may be out of date and suggest running `distill` first.

---

## Input Types

Detect the type of input from the user's message:

| Signal | Input Type |
|---|---|
| "En tant que..., je veux..." / "As a..., I want..." | **User story** |
| "Un client ne peut pas..." / "A customer cannot..." / "Il est interdit de..." | **Business rule** |
| "Ajouter..." / "Add..." / "On veut pouvoir..." / "We need to..." | **Feature request** |
| "Permettre..." / "Allow..." / "Modifier le comportement de..." / "Change the behavior of..." | **Behavior change** |

When the input does not match any pattern clearly, ask the user to reformulate before proceeding.

---

## Workflow — 5 Phases

### Phase 1 — Decomposition

Parse the input and identify the business concepts involved:

- **Entities / Aggregates** — existing or new entities referenced by the spec
- **Commands / Queries** — actions or reads the spec implies (existing or new)
- **Events** — events that should be emitted as a result (internal, external, error, temporal)
- **Preconditions / Policies / Invariants** — constraints implicit in the spec
- **Domain Services / Application Services / Infrastructure Services** — services needed
- **Agreements** — cross-aggregate consistency concerns

Present a decomposition summary and wait for user validation:

```
## Decomposition

**Input:** "{user's spec}"

**Concepts identified:**
- Entities/Aggregates: {list}
- Commands/Queries: {list}
- Events: {list}
- Preconditions/Policies/Invariants: {list}
- Services: {list}

Does this decomposition look correct? (yes/no/corrections)
```

### Phase 2 — Anchoring

For each concept identified in Phase 1, map it to the existing model:

| Label | Meaning |
|---|---|
| **[EXISTING]** | The concept exists in `.domain`. Cite the exact definition. |
| **[NEW]** | The concept does not exist in any model. Propose a definition. |
| **[AMBIGUOUS]** | The term does not exactly match existing vocabulary. Ask for clarification. |

Present the anchoring table and wait for user validation:

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTING] | `entity Order` in orders.domain — identity id, customer, lines, status, totalAmount... |
| DeliverOrder | [NEW] | No command exists. Proposed: `command DeliverOrder { fields { orderId : uuid } }` |
| deliveryNote | [AMBIGUOUS] | Does this correspond to `Order.shippingAddress` or is it a new concept? |

Does this mapping look correct? (yes/no/corrections)
```

### Phase 3 — Confrontation

Verify the coherence of the spec against the existing model. For each issue found, assign a label:

| Label | Meaning |
|---|---|
| **[CONTRADICTION]** | An existing `precondition`, `policy`, or `invariant` blocks the proposed behavior. |
| **[IMPACT]** | A modification to structural constructs affects existing operations, policies, or invariants. |
| **[GAP]** | The spec does not cover an error case or edge case that is detectable from the model. |
| **[COVERAGE]** | An emitted event has no consumer (no event-triggered operation and no policy trigger), or a concept is orphaned (created but never used). |
| **[COMPATIBLE]** | The spec is fully compatible with the existing model — no contradiction, no impact. |

**Response format for each issue:**

```
### {Label} — {short description}

**The model says:**
> {exact citation from .domain}

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

---

### Phase 4 — Proposition

Generate the projected changes using the `.spec` format (see `.spec` File Format section). The output must conform to the Spec Grammar below. Present the full `.spec` file content to the user for review.

**Rules for this phase:**

- The `.spec` file structure must follow the grammar defined in the Spec Grammar section below.
- Every addition must follow the Specy v3 grammar and the conventions of `distill`.
- The `changes` blocks contain native Specy v3 syntax with `add`, `modify`, or `remove` operators.
- `modify` shows the complete block as it should be after modification — not a partial diff. Annotate the changed lines with `// was: ...` comments.
- Every structural modification (entity, value, enum, command, event, aggregate) must have a corresponding `impact` block.

### Phase 5 — Confirmation & Writing

Present a final recap:

```
## Recap

### Domain model changes
- {count} additions, {count} modifications, {count} deletions

### Impact
- {count} existing constructs affected (details above)

### Open items
- {list of [GAP] and [COVERAGE] items}

Write spec file to specy/specs/{number}_{name}.spec? (yes / no / corrections)
```

- **`yes`** → write the `.spec` file to `specy/specs/`.
- **`no`** → discard and stop.
- **corrections** → go back to the relevant phase and re-propose.

After writing, run a quick cross-validation on the projected changes:
- Verify every `typeName` used in `changes` blocks resolves in the `.domain` or in another `add` within the same `.spec`.
- Verify every `dotPath` resolves through the field chain.
- Verify every enum value used in expressions exists in the enum definition.
- Report any issues found.

---

## Verify Mode

The `spec verify` mode checks whether a spec's projected `changes` have been realized in the current model. It closes the spec lifecycle loop mechanically — no manual inspection needed.

Two invocation forms:

| Invocation | Behavior |
|---|---|
| `spec verify <number>` | Verify a single spec against the current model |
| `spec verify` (no args) | Verify all pending (non-realized) specs |

### Mechanism

1. **Resolve artifact location.** Locate the Specy artifacts directory (see Artifact Resolution below).
2. **Load models.** Read current `.domain` files and meta file (`*.meta.json`).
3. **Load spec(s).** Read the target `.spec` file(s) from `specs/`.
4. **Staleness check.** Compare the spec's `against ... version` with current `*.meta.json` `gitSha`. If different, warn that the model has changed since the spec was written — the verification is against the *current* model, not the version the spec was written against. If the model is stale relative to HEAD, warn that distill should be run first.
5. **Confront each `changes` entry.** For each `add`, `modify`, and `remove` in the spec's `changes` blocks, compare against the current model state.
6. **Output the verification report.**
7. **On full realization (local only), propose lifecycle transition.**

### Confrontation Rules

| Spec entry | Verification |
|---|---|
| `add <type> <Name> { ... }` | Check that `<type> <Name>` exists in the current model. Compare fields/clauses structurally. |
| `modify <type> <Name> { ... }` | Check that `<type> <Name>` exists. Compare the current definition against the projected definition. Focus on the lines annotated `// was:` or `// added by this spec` — these are the expected changes. If the `modify` block has no change annotations, the construct is expected to remain as-is — label `[REALIZED]` if it matches exactly. |
| `remove <type> <Name>` | Check that `<type> <Name>` does **not** exist in the current model. |

**Structural comparison** ignores whitespace, comments (`//`), and `::` annotations. Only semantic content matters: clauses, fields, types, constraints, and their ordering.

### Verification Labels

Each `changes` entry receives one label:

| Label | Meaning |
|---|---|
| `[REALIZED]` | The change is fully present in the current model. Fields, constraints, and clauses match the projection. A superset is acceptable — the code may go further than the spec. |
| `[PARTIAL]` | The construct exists but differs from the projection (missing fields, different constraints, altered clauses). The diff is shown. |
| `[MISSING]` | The projected change is not reflected in the current model at all. |
| `[DIVERGENT]` | The construct exists but has changed in ways the spec did not predict (different field names, different structure). This is a question, not a failure — the implementation may be intentionally different. |

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
| **Alternative implementation** | Spec: `add field deliveredAt : datetime`. Code: `field deliveryDate : datetime`. | `[DIVERGENT]` | Report asks: "Intentional? If yes, amend the spec to match the implementation." |
| **Enriched implementation** | Spec: `add command DeliverOrder { fields { orderId } }`. Code: `DeliverOrder { fields { orderId, deliveryNote } }`. | `[REALIZED]` | The spec is a subset — the code goes further. Not a problem. |

#### Divergence report format

```
- modify entity Order                   → [DIVERGENT]
    Spec projected:
      deliveredAt : datetime optional pastOrPresent
    Current model:
      deliveryDate : datetime optional

    The field exists under a different name and without the pastOrPresent
    constraint. Is this intentional?
    → If yes: amend the spec to reflect the actual implementation
    → If no: this is an implementation gap to address
```

#### Amending specs

A spec that is not yet `realized` is a living document. When `spec verify` reports `[DIVERGENT]` and the divergence is intentional, the developer amends the spec's `changes` blocks to reflect the actual implementation, then re-runs `spec verify` to confirm.

### Local vs CI Behavior

| Aspect | Local (`spec verify 001`) | CI (`spec verify`) |
|---|---|---|
| **Report** | Detailed, per change entry with diffs | Summary table of all pending specs |
| **Lifecycle proposal** | Proposes `realized` + move to `done/` when all `[REALIZED]` | Never — report only |
| **File mutation** | Only on explicit human confirmation | Never |
| **Move to `done/`** | Proposed, human confirms | Never — dev moves manually |

### Output Formats

#### CI output — All pending specs

CI produces a report in the pipeline logs. No files are written, no specs are moved. The pipeline signals non-realized specs so the team has visibility.

```
## Spec Verification — All Pending Specs
Model version: "c3d4e5f" at "2026-03-03T14:00:00Z"

| Spec | Status | Realized | Partial | Missing | Divergent |
|------|--------|----------|---------|---------|-----------|
| 001_deliver-order.spec | PARTIAL | 2 | 1 | 1 | 0 |
| 002_cancel-after-shipping.spec | CREATED | 0 | 0 | 2 | 0 |
| 003_add-tracking.spec | REALIZED | 3 | 0 | 0 | 0 |

Summary: 1 realized (ready for done/), 1 partial, 1 not started
```

#### Local output — Single spec

```
> spec verify 001

## Spec Verification — 001_deliver-order.spec
against "orders" version "a1b2c3d" — current model version "f4e5d6c"

### changes "orders.domain"
- add command DeliverOrder              → [REALIZED]
- add event OrderDelivered              → [REALIZED]
- modify entity Order                   → [PARTIAL]
    deliveredAt : datetime optional     ✓ present
    pastOrPresent constraint            ✗ missing
- add policy OnOrderShipped             → [MISSING]
    no policy found for OnOrderShipped

### Status: PARTIAL — 2/4 realized, 1 partial, 1 missing
```

#### Local output — Fully realized

```
> spec verify 003

## Spec Verification — 003_add-tracking.spec
against "orders" version "a1b2c3d" — current model version "f4e5d6c"

### changes "orders.domain"
- add value TrackingInfo                → [REALIZED]
- modify entity Order                   → [REALIZED]
- add operation "Track a shipment"      → [REALIZED]

### Status: REALIZED — 3/3 changes realized

All changes are realized in the current model.
Mark as realized? This will:
- Add: realized version "f4e5d6c" at "2026-03-03T14:00:00Z"
- Move to: specy/specs/done/003_add-tracking.spec

(yes / no)
```

### Artifact Resolution

The skill resolves the Specy artifacts location at boot, before any command. This makes `spec verify` independent of whether artifacts are colocated with the code or in a separate repository.

#### Resolution order

1. **Local `specy/` directory** — if `specy/` exists at the project root, use it (current behavior).
2. **Configuration file** — if `specy.config` exists, read the artifact location from it.
3. **Environment variable** — if `SPECY_PATH` is set, use it.
4. **Ask the user** — if none of the above, prompt for the location.

Once resolved, all skill operations (load models, read specs, write results) use the resolved location transparently. The rest of the workflow is identical regardless of the deployment mode.

#### Impact on `against version`

The `against version` in a `.spec` file traces the **model version** (the `gitSha` from `.meta.json`), not the code version. This is already the case semantically — `.meta.json` captures the code SHA at the time of distill. In a central repository, `.meta.json` may evolve to include `sourceRepo` and `sourceSha` fields for cross-repository traceability. This `.meta.json` evolution is out of scope for verify mode but documented here for coherence.

---

## .spec File Format

The `.spec` file is a structured artifact that captures the full analysis and projected changes for a business specification. The formal grammar is defined in the Spec Grammar section below. The `changes` blocks reuse the grammar from `domain.ebnf` — no new syntax is invented for the projected modifications.

### Header

```
spec "Name of the specification"
against "{domain}" version "{gitSha}" at "{lastRun ISO 8601}"
uses "{domain}.domain"
```

- `spec` — the name of the specification (short, descriptive).
- `against` — the domain name, model version (`gitSha` from `specy/.meta.json`), and extraction timestamp (`lastRun`). This pins the spec to a specific model version for staleness detection.
- `uses` — the `.domain` files this spec was validated against. One `uses` per domain file.

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
  entity Order [existing]                // entity Order in orders.domain
  enum OrderStatus.delivered [existing]  // value exists, no transition modeled
  command DeliverOrder [new]
  event OrderDelivered [new]
  field deliveryNote [ambiguous]         // unclear mapping — see confrontation
}
```

Three labels: `[existing]`, `[new]`, `[ambiguous]`.

Each concept line follows the pattern: `{type} {Name} [{label}]` with an optional `// comment` for context.

**A `[new]` concept does not necessarily produce a formal block in `changes`.** When a concept's logic is better captured inside another construct (e.g., a precondition absorbed into an operation because its condition is specific to that operation), listing it in `concepts` documents the intent without forcing a formal block. The `concepts` section is an inventory of what the spec involves — the `changes` section is what actually gets formalized.

### `confrontation` — Validation Results

```
confrontation {
  compatible "Short description of compatibility finding" {
    "Optional detailed justification line 1."
    "Optional detailed justification line 2."
  }

  contradiction "Short description" {
    "Detailed explanation line 1."
    "Detailed explanation line 2."
  }

  impact "Short description" {
    "Detailed explanation."
  }

  gap "Short description" {
    "Detailed explanation."
  }

  coverage "Short description" {
    "Detailed explanation."
  }
}
```

Five types: `compatible`, `contradiction`, `impact`, `gap`, `coverage`.

Each entry has a short description string followed by an optional block with detailed explanation lines.

### `changes` — Projected Modifications

```
changes "{domain}.domain" {
  add command DeliverOrder :: "Deliver a shipped order" {
    fields {
      orderId : uuid
    }
  }

  add event OrderDelivered :: "Order has been delivered" {
    fields {
      orderId : uuid
      deliveredAt : datetime
    }
  }

  modify entity Order {
    identity id : uuid
    fields {
      // ... existing fields ...
      deliveredAt : datetime optional pastOrPresent  // added by this spec
    }
    references { ... }

    operations {
      // ... existing operations ...

      // added by this spec
      "Deliver a shipped order" on DeliverOrder {
        resolves Order from deliverOrder.orderId

        precondition orderMustBeShipped :: "Order must be shipped" {
          Order.status = shipped
        } rejects "Order is not shipped"

        sets Order {
          status = delivered
          deliveredAt = now()
        }

        emits OrderDelivered {
          orderId = Order.id
          deliveredAt = Order.deliveredAt
        }
      }
    }

    states {
      machine OrderLifecycle {
        // ... existing transitions ...
        shipped --> delivered on "Deliver a shipped order"  // added by this spec
      }
    }
  }

  remove command DeprecatedCommand
}
```

Three operators:

| Operator | Meaning |
|---|---|
| `add` | New definition — the full block follows in Specy v3 syntax. |
| `modify` | Existing definition changed — the **complete** block as it should be after modification. Changed lines are annotated with `// was: ...` or `// added by this spec` comments. |
| `remove` | Existing definition to be deleted — only the type and name, no block body. |

The content inside `add` and `modify` is **native Specy v3 syntax** — the same grammar as `.domain` files. No new syntax is invented.

### `impact` — Impact Analysis

```
impact {
  operation "Cancel an order" -> none
    "delivered already excluded from cancellation precondition"
  operation "Ship a confirmed order" -> none
    "unrelated — transitions confirmed to shipped"
  operation "Refund a payment" -> affected
    "depends on Payment.order.status — verify refund sequencing"
  invariant OrderMustHaveLines -> none
    "references Order.lines, not Order.status"
}
```

Two levels: `none` (no impact) and `affected` (impacted by the changes).

Each entry follows the pattern: `{type} {Name} -> {none|affected}` followed by a quoted explanation on the next line. Operations use their string label: `operation "Cancel an order"`.

### Lifecycle — `realized`

When the code implementing the spec has been written and `distill` has re-extracted the models, the spec is marked as realized by adding a `realized` line to the header:

```
spec "Deliver an order"
against "orders" version "a1b2c3d" at "2025-01-15T10:30:00Z"
realized version "f4e5d6c" at "2025-02-01T14:00:00Z"
uses "orders.domain"
```

- `realized` — the `gitSha` and `lastRun` from the `specy/.meta.json` at the time of the `distill` run that captured the implementation.

The file is then moved to `specy/specs/done/`.

---

## File Conventions

### Directory

All `.spec` files are stored in `specy/specs/`:

```
specy/
├── specs/
│   ├── 001_deliver-order.spec
│   ├── 002_cancel-after-shipping.spec
│   └── done/
│       └── 000_initial-setup.spec      // archived — realized
├── orders.domain
└── .meta.json
```

### Naming

```
{number}_{kebab-case-name}.spec
```

- **Number** — 3-digit zero-padded auto-increment (`001`, `002`, `003`...). To determine the next number, read the existing `.spec` files in `specy/specs/` (including `done/`) and increment from the highest.
- **Name** — short kebab-case description of the spec.

### Lifecycle

1. **Created** — `spec` skill produces the `.spec` file in `specy/specs/`.
2. **Active** — the spec is pending implementation. The dev uses it as a guide.
3. **Realized** — the code is implemented, `distill` re-extracts, and the models now reflect the spec. Add the `realized` line with the new model version and timestamp, then move the file to `specy/specs/done/`.

### Staleness Detection

When loading an existing `.spec` file, compare its `against ... version` with the current `specy/.meta.json` `gitSha`:

- **Same** → the spec is up to date.
- **Different** → the models have changed since the spec was written. Warn:
  ```
  This spec was written against model version {specVersion}.
  The current model is version {currentVersion}.
  The confrontation results may be outdated — consider re-running spec.
  ```

---

## Validation Checklist

This checklist is executed automatically during Phase 3. Every item must be verified before moving to Phase 4.

| Check | What to verify |
|---|---|
| **Completeness** | Does the spec cover the happy path AND error cases? Are there implicit failure conditions not stated? |
| **Coherence** | Does the spec contradict any existing `precondition`, `policy`, or `invariant` block? |
| **Coverage** | Are all emitted events consumed by an event-triggered operation or policy trigger? Are all created/resolved entities actually used? |
| **Naming** | Are the terms consistent with the existing domain vocabulary? Does the spec reuse existing names or introduce synonyms? |
| **Typing** | Does every `typeName`, `dotPath`, and field reference resolve in the `.domain`? |

---

## Provenance Labels

Labels used during the conversation to communicate analysis results:

### Anchoring Labels (Phase 2)

| Label | Meaning |
|---|---|
| **[EXISTING]** | The concept exists in the current model — cite the definition. |
| **[NEW]** | The concept is new — propose a definition. |
| **[AMBIGUOUS]** | The term does not match existing vocabulary — ask for clarification. |

### Confrontation Labels (Phase 3)

| Label | Meaning |
|---|---|
| **[CONTRADICTION]** | An existing rule blocks the proposed behavior. |
| **[IMPACT]** | A structural modification affects existing behavioral constructs. |
| **[GAP]** | The spec has a gap (missing error case, unhandled edge case). |
| **[COVERAGE]** | An event or concept is orphaned (emitted but not consumed, or created but not used). |
| **[COMPATIBLE]** | The spec is fully compatible — no issue detected. |

---

## Quality Rules

1. **No invention.** Every proposed addition must trace back to the user's input. Do not add commands, events, or fields that the spec does not imply. If you think something is missing, flag it as `[GAP]` — do not silently fill the gap.
2. **Confrontation is mandatory.** Never skip Phase 3. Even if the spec seems obviously compatible, run the full validation checklist. A `[COMPATIBLE]` result is a finding, not a shortcut.
3. **Impact is mandatory.** Every structural modification (entity, value, enum, command, event, aggregate) must produce an impact analysis in the `impact` block. A structural change without impact analysis is incomplete.
4. **Never touch `.domain` files.** The output is always a `.spec` file. The `.domain` files reflect the code — only `distill` writes to them.
5. **Naming coherence.** Reuse the existing vocabulary from the model. If the spec says "annuler" and the model has `CancelOrder`, use `CancelOrder`, not `AnnulOrder`. Follow distill's rule: preserve source vocabulary.
6. **Enum values in camelCase.** Every enum value must be `camelCase` — same rule as distill. Convert prose to camelCase: "en livraison" → `inDelivery`, "DELIVERED" → `delivered`.
7. **Dot-paths must resolve.** Every `dotPath` in a proposed `changes` block must chain through fields that exist (or are being added) in the `.domain`. `Order.deliveredAt` requires `Order` to have a `deliveredAt` field.
8. **Expressions must be valid — no tautologies.** Every precondition, postcondition, and invariant expression must contain a real boolean expression. No `field is defined` on required fields, no `now() - date > 5` with ambiguous units.
9. **One operation per command.** Each command type gets exactly one operation block inside an entity. If the spec implies a new command, propose a new operation.
10. **Event-triggered operation labels.** New event-triggered operations must have a descriptive string label. The `when` clause references the event, `then` names the internal command.
11. **Operation naming convention.** New operations match their command name: `command DeliverOrder` → `"Deliver a shipped order" on DeliverOrder`.
12. **No technical artifacts.** Proposals must stay at the domain level. Do not include database schemas, API endpoints, or framework-specific concepts. If the spec mentions technical details, extract the business intent and formalize that.
13. **`modify` shows the complete block.** When modifying an existing construct, the `modify` operator contains the full block as it should be after the change — not a partial diff. Annotate changed lines with `// was: ...` comments so the reader can see what changed.

---

## Edge Cases

### Empty Domain — No Existing Model

If no `specy/*.domain` files exist, the spec skill cannot operate (there is nothing to confront against). Respond:

```
No Specy models found in specy/. The spec skill requires existing models
to validate specifications against. Run the `distill` skill first to extract
models from your codebase, then come back to formalize specifications.
```

### Spec Touching Only Structural Constructs

When the spec only adds a field to an existing entity (e.g., "add a phone number to Customer"):

1. Skip operation/event decomposition (Phase 1 is structure-only).
2. Phase 2 — anchor the entity and field.
3. Phase 3 — run impact analysis on all operations, policies, and invariants referencing the entity.
4. Phase 4 — produce a `.spec` with `changes` for structural constructs only, plus the full `impact` block.

### Spec Touching Only Behavioral Constructs

When the spec only adds a new event-triggered operation or modifies an existing operation (e.g., "send a notification when an order is shipped"):

1. Phase 1 — decomposition identifies the event and operation/policy.
2. Phase 2 — anchor the event (must exist in `.domain`).
3. Phase 3 — verify the event is emitted by at least one operation. Flag `[COVERAGE]` if not.
4. Phase 4 — produce a `.spec` with behavioral changes only (operation or policy additions/modifications).

### Cross-Context Spec

When the spec involves concepts from multiple bounded contexts (multiple `.domain` files):

1. Always prefix references with the domain name: `Orders.Order.status`, `Shipping.Shipment.trackingNumber`.
2. The `.spec` file uses multiple `uses` directives and multiple `changes` blocks:
   ```
   uses "orders.domain"
   uses "shipping.domain"

   changes "orders.domain" { ... }
   changes "shipping.domain" { ... }
   ```
3. Analyze each context separately — contradictions are per-context.
4. Flag cross-context dependencies explicitly in the `confrontation` block.

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
against "orders" version "unknown" at "unknown"
```

```
Warning: specy/.meta.json not found — model version cannot be determined.
Run `distill` to generate the meta file, then re-run this spec for proper
version tracking.
```

### Re-running a Spec Against Updated Models

When the user wants to re-validate an existing `.spec` file after models have been updated:

1. Read the existing `.spec` file.
2. Extract the `narrative` as the input.
3. Run the full 5-phase workflow against the current models.
4. Produce a new `.spec` file with the updated `against` version.
5. The old `.spec` can be overwritten (same number and name) since it is being superseded.

---

## Syntax Reference

### Spec Grammar (.spec files)

```ebnf
// =============================================================================
// Specy — Specification Grammar (.spec)
// EBNF (ISO 14977 style)
//
// A .spec file captures a business specification formalized against existing
// .domain models. It references — but never modifies — those models.
// The changes block contains projected modifications in native Specy v3 syntax
// (as defined in domain.ebnf).
// =============================================================================

// -----------------------------------------------------------------------------
// Top-level structure
// -----------------------------------------------------------------------------

specFile         = { comment }
                 , specDecl
                 , againstDecl
                 , [ realizedDecl ]
                 , usesDecl , { usesDecl }
                 , narrativeBlock
                 , conceptsBlock
                 , confrontationBlock
                 , { changesBlock }
                 , [ impactBlock ] ;

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------

specDecl         = "spec" , stringLiteral ;

againstDecl      = "against" , stringLiteral , "version" , stringLiteral
                 , "at" , stringLiteral ;

realizedDecl     = "realized" , "version" , stringLiteral
                 , "at" , stringLiteral ;

usesDecl         = "uses" , stringLiteral ;

// -----------------------------------------------------------------------------
// Narrative — original requirement in prose
// -----------------------------------------------------------------------------

narrativeBlock   = "narrative" , "{" , stringLiteral , { stringLiteral } , "}" ;

// -----------------------------------------------------------------------------
// Concepts — decomposition and anchoring
// -----------------------------------------------------------------------------

conceptsBlock    = "concepts" , "{" , { comment | conceptEntry } , "}" ;

conceptEntry     = conceptType , conceptName , "[" , conceptLabel , "]" ;

conceptType      = "entity"
                 | "aggregate"
                 | "value"
                 | "enum"
                 | "command"
                 | "query"
                 | "event"
                 | "external event"
                 | "error event"
                 | "temporal event"
                 | "operation"
                 | "policy"
                 | "invariant"
                 | "domain service"
                 | "application service"
                 | "infrastructure service"
                 | "agreement"
                 | "reconciliation"
                 | "precondition"
                 | "postcondition"
                 | "state machine"
                 | "interface"
                 | "field" ;

conceptName      = identifier , { "." , identifier } ;

conceptLabel     = "existing"
                 | "new"
                 | "ambiguous" ;

// -----------------------------------------------------------------------------
// Confrontation — validation results
// -----------------------------------------------------------------------------

confrontationBlock = "confrontation" , "{" , { comment | confrontationEntry } , "}" ;

confrontationEntry = confrontationType , stringLiteral , [ confrontationBody ] ;

confrontationType  = "compatible"
                   | "contradiction"
                   | "impact"
                   | "gap"
                   | "coverage" ;

confrontationBody  = "{" , stringLiteral , { stringLiteral } , "}" ;

// -----------------------------------------------------------------------------
// Changes — projected modifications
//
// Each changes block targets a specific .domain file.
// The content of add/modify operators is native Specy v3 syntax
// as defined in domain.ebnf.
// -----------------------------------------------------------------------------

changesBlock     = "changes" , stringLiteral , "{" , { comment | changeEntry } , "}" ;

changeEntry      = addChange
                 | modifyChange
                 | removeChange ;

addChange        = "add" , definition ;

modifyChange     = "modify" , definition ;

removeChange     = "remove" , definitionKind , typeName ;

// References to domain.ebnf grammar — all v3 domain constructs
definition       = entityDef
                 | aggregateDef
                 | valueDef
                 | enumDef
                 | commandDef
                 | queryDef
                 | eventDef
                 | externalEventDef
                 | errorEventDef
                 | temporalEventDef
                 | domainServiceDef
                 | applicationServiceDef
                 | infrastructureServiceDef
                 | policyDef
                 | invariantDef
                 | agreementDef ;

definitionKind   = "entity"
                 | "aggregate"
                 | "value"
                 | "enum"
                 | "command"
                 | "query"
                 | "event"
                 | "external event"
                 | "error event"
                 | "temporal event"
                 | "operation"
                 | "domain service"
                 | "application service"
                 | "infrastructure service"
                 | "policy"
                 | "invariant"
                 | "agreement"
                 | "state machine"
                 | "interface" ;

// -----------------------------------------------------------------------------
// Impact — analysis of effects on existing constructs
// -----------------------------------------------------------------------------

impactBlock      = "impact" , "{" , { comment | impactEntry } , "}" ;

impactEntry      = impactTarget , "->" , impactLevel , stringLiteral ;

impactTarget     = definitionKind , ( identifier | stringLiteral ) ;

impactLevel      = "none"
                 | "affected" ;

// -----------------------------------------------------------------------------
// Shared terminals (same as domain.ebnf)
// -----------------------------------------------------------------------------

stringLiteral    = '"' , { character } , '"' ;

typeName         = pascalCaseId ;

identifier       = camelCaseId | pascalCaseId ;

pascalCaseId     = upperLetter , { letter | digit } ;

camelCaseId      = lowerLetter , { letter | digit } ;

comment          = "//" , { character } , newline ;

upperLetter      = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
                 | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R"
                 | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" ;

lowerLetter      = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i"
                 | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r"
                 | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" ;

letter           = upperLetter | lowerLetter ;

digit            = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;

character        = letter | digit | " " | "!" | "@" | "#" | "$" | "%" | "^"
                 | "&" | "*" | "(" | ")" | "-" | "_" | "=" | "+" | "["
                 | "]" | "{" | "}" | "|" | "\\" | ":" | ";" | "'" | ","
                 | "." | "<" | ">" | "/" | "?" | "~" | "`" ;

newline          = "\n" ;
```

### Domain Grammar (.domain files — used inside `changes` blocks)

The full domain grammar is available at `grammars/domain.ebnf` (loaded at runtime). The grammar covers all v3 constructs: entity, aggregate, value, enum, command, query, event, external/error/temporal events, domain/application/infrastructure services, policy, invariant, agreement, interface, state machine.

Load and consult `grammars/domain.ebnf` when writing `changes` blocks to ensure syntactic correctness.

### Construct Reference

# Specy v3 Construct Reference

## Structural constructs

### Entity

An `entity` is a domain object with a unique identity that persists over time. Entities own mutable state and are the primary targets of commands, operations, and invariants.

#### Skeleton

```
entity Name :: "description" {
    identity fieldName : type
    duplicate detection { expression }
    fields {
        field : type constraint
    }
    references {
        fieldName : TypeName cardinality
    }
    operations {
        "Label" on CommandType { clauses... }
        "Label" when EventType then CommandType { clauses... }
        name(params) : ReturnType :: "description" { clauses... }
    }
    states {
        machine MachineName :: "description" {
            state stateName :: "description"
            final stateName :: "description"
            [*] --> stateName on operationLabel
            stateName --> stateName on operationLabel when { guard } then { action }
        }
    }
    invariants {
        name :: "description" { expression }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Identity | Must have an `identity` declaration (e.g., `identity id : uuid`). |
| Description | Optional `:: "description"` after the entity name. |
| Fields | Wrapped in a `fields { }` block. Domain constraints directly on fields (`min`, `max`, `optional`, `default`, etc.). |
| References | Declared in a `references { }` block with explicit cardinality (`1..1`, `1..N`, `0..1`, `0..N`). |
| Duplicate detection | Optional `duplicate detection { expression }` — predicate over candidate fields for uniqueness. |
| Sub-blocks | `references`, `operations`, `states`, `invariants` are optional. `identity` and `fields` are required. |
| Naming | `PascalCase` for entity name, `camelCase` for field names. |

#### Example

```
entity Order :: "A customer order" {
    identity id : uuid
    fields {
        status : OrderStatus default("draft")
        totalAmount : Money
        shippingAddress : Address
        placedAt : datetime optional pastOrPresent
        createdAt : datetime immutable pastOrPresent
    }
    references {
        customer : Customer 1..1
        lines : OrderLine 1..N
    }
    invariants {
        orderContainsLines :: "An order must contain at least one line" {
            isNotEmpty(lines)
        }
    }
    operations { ... }
    states { ... }
}
```

---

### Aggregate

An `aggregate` groups related entities under a single root, enforcing integrity boundaries. Operations on contained entities go through the root.

#### Skeleton

```
aggregate Name :: "description" {
    root RootEntityType
    entities {
        ContainedEntityType
    }
    identity fieldName : type
    fields { ... }
    references { ... }
    operations { ... }
    states { ... }
    invariants { ... }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Root | Must declare `root TypeName` — the aggregate root entity. |
| Entities | `entities { }` lists contained entity types. |
| Same sub-blocks | Supports the same blocks as entity (identity, fields, references, operations, states, invariants). |
| Repository | Only the aggregate root has a repository (derived). |

---

### Value

A `value` is an immutable object defined entirely by its attributes — no identity. Values can contain operations and invariants.

#### Skeleton

```
value Name :: "description" {
    fields {
        field : type constraint
    }
    operations {
        name(params) : ReturnType :: "description"
    }
    invariants {
        name :: "description" { expression }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| No identity | Never add `identity` — that makes it an entity. |
| Immutability | All fields are implicitly immutable. |
| Operations | Optional — named operations with typed parameters and return type. |
| Invariants | Optional — self-consistency rules on value fields. |
| Naming | `PascalCase` for value name, `camelCase` for field names. |

#### Example

```
value OrderLine :: "A single line in an order" {
    fields {
        productId : uuid
        quantity : int required min(1) max(1000)
        productPrice : Money
        total : Money
    }
    invariants {
        positiveQuantity :: "Quantity must be greater than zero" {
            quantity > 0
        }
        lineTotalConsistency :: "Line total must equal unit price times quantity" {
            total.amount = productPrice.amount * quantity
        }
    }
}
```

---

### Enum

An `enum` defines a closed set of named values representing a domain classification.

#### Skeleton

```
enum Name {
    value1
    value2
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Values | `camelCase` identifiers — convert `UPPER_SNAKE_CASE` from source code. |
| Closed set | All valid values must be listed exhaustively. |
| No fields | Enum values have no associated data — use a value if data is needed. |

---

### Command

A `command` represents an intent to change the state of the domain.

#### Skeleton

```
command Name :: "description" {
    fields {
        field : type constraint
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, verb-noun form (e.g., `PlaceOrder`, `CancelOrder`). |
| 1:1 mapping | Exactly one entity operation must declare `on` this command. |
| No behavior | Commands are pure data — behavior lives in the entity operation. |

---

### Query

A `query` represents a request for current state — safe and idempotent.

#### Skeleton

```
query Name :: "description" {
    fields {
        field : type constraint
    }
    returns ReturnType
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Returns | Must declare `returns Type` — the data returned by the query. |
| No side effects | Queries never mutate state. |
| Naming | `PascalCase`, noun form (e.g., `OrderSummary`, `CustomerOrders`). |

---

## Event types

### Event (internal)

An `event` signals that something has happened within the bounded context. Emitted by operations.

#### Skeleton

```
event Name :: "description" {
    fields {
        field : type
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, past-tense (e.g., `OrderPlaced`, `OrderCancelled`). |
| Immutable | Events are facts — cannot be modified after emission. |

---

### External Event

An `external event` originates from an upstream bounded context.

#### Skeleton

```
external event Name :: "description" {
    from UpstreamContextName
    triggers {
        CommandType
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `from` | Names the upstream bounded context. |
| `triggers` | Lists commands that should be executed when this event is received. |

---

### Error Event

An `error event` is raised by an operation on failure.

#### Skeleton

```
error event Name :: "description" {
    fields {
        field : type
    }
}
```

---

### Temporal Event

A `temporal event` is a domain fact caused by the passage of time. Three flavors:

#### Relative — fires after a duration from a reference event

```
temporal event Name :: "description" {
    reference EventType
    offset durationExpr
    guard { expression }
    fields { ... }
}
```

#### Absolute — fires at an instant described by an entity field

```
temporal event Name :: "description" {
    instant Entity.datetimeField
    guard { expression }
    fields { ... }
}
```

#### Recurring — fires on each occurrence of a schedule expression

```
temporal event Name :: "description" {
    schedule "cron expression"
    guard { expression }
    fields { ... }
}
```

---

## Service types

### Domain Service

A `domain service` contains operations spanning multiple entities/aggregates that don't naturally belong to a single entity.

```
domain service Name :: "description" {
    operations {
        opName(params) : ReturnType :: "description" {
            resolves / foreach / returns / service calls
        }
    }
}
```

### Application Service

An `application service` orchestrates use cases — interprets requests from presentation layer.

```
application service Name :: "description" {
    operations {
        opName(params) : ReturnType :: "description" { ... }
    }
}
```

### Infrastructure Service

An `infrastructure service` adapts external system capabilities through domain language.

```
infrastructure service Name :: "description" {
    operations {
        opName(params) : ReturnType :: "description" { ... }
    }
}
```

#### Service classification

| Pattern | Type |
|---------|------|
| Business logic spanning entities | `domain service` |
| Use case orchestration | `application service` |
| External system adapter (notifications, payments, storage) | `infrastructure service` |

---

## Behavioral constructs

### Operations (entity/aggregate-scoped)

Operations are defined inside an entity's `operations { }` block. Three forms:

#### Form 1 — Command-triggered

```
"Business intent label" on CommandType {
    precondition name :: "description" { expr } rejects "message"
    resolves Entity from dotPath
    creates Entity { field = value }
    sets Entity { field = value }
    Service.op(args) :: "description"
    emits Event { field = value }
}
```

#### Form 2 — Event-triggered

```
"Business intent label" when EventType then CommandType {
    clauses...
}
```

#### Form 3 — Internal

```
name(params) : ReturnType :: "description" {
    clauses...
}
```

#### Operation clause rules

| Clause | Syntax | Rule |
|---|---|---|
| `precondition` | `precondition name :: "desc" { expr } rejects "msg"` | Named guard — replaces v1 `fails when`. Expression must be a real boolean condition. |
| `postcondition` | `postcondition name :: "desc" { expr }` | Evaluates over state_before, state_after, and arguments. |
| `resolves` | `resolves TypeName from dotPath` | Entity resolution — every entity you `sets` must be resolved or created first. |
| `creates` | `creates TypeName { field = value }` | Entity creation with explicit field assignments. |
| `sets` | `sets TypeName { field = value }` | Entity mutation with explicit field assignments. |
| `emits` | `emits TypeName { field = value }` | Event emission with explicit field assignments. |
| service call | `Service.op(args) :: "description"` | Direct call. Replaces v1 `delegates`. |
| `foreach` | `foreach dotPath as id { clauses }` | Iteration over a collection. |
| policy call | `policy identifier(args)` | References a named policy (precondition). |

#### Resolution patterns

**Direct — from command/event field:**

```
resolves Customer from placeOrder.customerId
resolves Order from cancelOrder.orderId
```

**Indirect — from already-resolved entity:**

```
resolves Payment from Order
```

#### Example

```
"Cancel an order" on CancelOrder {
    resolves Order from cancelOrder.orderId

    precondition orderCancellable :: "Order must be in a cancellable status" {
        Order.status in {draft, confirmed}
    } rejects "Order cannot be cancelled"

    sets Order {
        status = cancelled
        cancelledAt = now()
    }

    StockService.restock(Order.lines) :: "Restore stock for cancelled lines"

    emits OrderCancelled {
        orderId = Order.id
        lines = Order.lines
        reason = cancelOrder.reason
        cancelledAt = Order.cancelledAt
    }
}
```

---

### Policy (reactive rule)

A `policy` is a reactive rule: it listens to events and issues commands in response. This is NOT a precondition (preconditions are clauses on operations).

#### Skeleton

```
policy Name :: "description" {
    trigger EventType
    guard { expression }
    effect CommandType
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Trigger | One or more event types that activate the policy. |
| Guard | Optional condition — policy fires only when guard is true. |
| Effect | The command to issue when the policy fires. |
| Distinction | Policies react to events. Preconditions guard operations. Invariants assert properties. |

#### Example

```
policy LateDeliveryAlert :: "Alert when delivery is overdue" {
    trigger DeliveryOverdue
    guard { Order.status = shipped }
    effect NotifyLateDelivery
}
```

---

### Invariant

An `invariant` is a safety property — a rule that must hold at every observable point.

#### Two scopes

**File-level** — with `enforcement` strategy:

```
invariant Name :: "description" {
    on EntityType
    must { expression }
    enforcement rejection | compensation CommandType | alert
}
```

**Entity/value-scoped** — inside `invariants { }` block:

```
name :: "description" {
    expression
}
```

#### Enforcement strategies

| Strategy | Meaning |
|----------|---------|
| `rejection` | Operation refused, no state change. |
| `compensation CommandType` | State change accepted, corrective command issued. |
| `alert` | Violation recorded for review. |

---

### Agreement & Reconciliation

An `agreement` is a consistency property spanning multiple aggregates — cannot be verified atomically.

#### Skeleton

```
agreement Name :: "description" {
    participants { EntityA, EntityB }
    predicate { expression }
    reconciliation ReconciliationName :: "description" {
        trigger event EventType | schedule "expression"
        detection query | eventSourced
        compensation { CommandA, CommandB }
        coordination orchestrated | choreographed
        escalation {
            step 1 retry after duration
            step 2 alert "message"
            step 3 suspend
        }
    }
}
```

---

### State Machine

A `states { machine ... }` block structures the lifecycle of an entity through named states and transitions.

#### Skeleton

```
states {
    machine MachineName :: "description" {
        state stateName :: "description" {
            invariant ruleName :: "description" { expression }
        }
        final stateName :: "description"

        [*] --> stateName on operationLabel
        stateName --> stateName on operationLabel when { guard } then { action }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `state` | A regular state in the lifecycle. Can contain state-scoped invariants. |
| `final` | A terminal state — no transitions out. |
| `[*]` | The initial pseudo-state (entry point). |
| Transition labels | Must match operation labels in the same entity. |
| `when` / `then` | Optional guard and action on transitions. |

---

### Interface

An `interface` exposes a subset of operations from entities or domain services.

```
interface Name :: "description" {
    exposes Entity.operationName
    exposes DomainService.operationName
}
```

---

## Expression Rules

### Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `sum()`, `isEmpty()`, `isNotEmpty()`, `now()`, `today()`, `and`, `or`, `not`, `+`, `-`, `*`, `/`, `every TypeName in dotPath { expr }`, `if expr { expr }`

### Quick Reference

| Pattern | Expression |
|---|---|
| Status check | `Entity.status != someValue` |
| Set membership | `Entity.status in {draft, confirmed}` |
| Existence | `Entity is defined` / `Entity is not defined` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |
| Universal quantifier | `every Product in lines { Product.available = true }` |
| Computed value | `total.amount = productPrice.amount * quantity` |
| Conditional | `if charge.type = loan { charge.timeType in { disbursement } }` |

### Field Types

Primitives: `string`, `int`, `long`, `decimal`, `boolean`, `uuid`, `datetime`, `date`, `time`, `duration`

Collections: `list<T>`, `set<T>`, `map<K,V>`

Constraints: `optional`, `required`, `immutable`, `unique`, `ordered`, `min(n)`, `max(n)`, `minLength(n)`, `maxLength(n)`, `pattern("regex")`, `default("value")`, `pastOrPresent`, `futureOrPresent`

### `// UNCLEAR` and `// NOTE` markers

| Marker | When to use |
|---|---|
| `// UNCLEAR: description` | Business rule that cannot be expressed in the grammar — needs domain expert clarification. |
| `// NOTE: description` | Infrastructure concern or technical detail not part of the domain model. |

---

## Canonical Examples

The examples below use the Orders domain defined in the canonical examples.

### Example 1 — Compatible Addition: "React when an order is shipped"

**Input:** "When an order is shipped, the system should notify the customer and start delivery tracking."

---

#### Phase 1 — Decomposition

```
## Decomposition

**Input:** "When an order is shipped, the system should notify the customer and start delivery tracking."

**Concepts identified:**
- Entities/Aggregates: Order (already shipped via "Ship a confirmed order" operation)
- Commands/Queries: none implied (this is a reactive behavior)
- Events: OrderShipped (existing — emitted by "Ship a confirmed order" operation)
- Preconditions/Policies/Invariants: none implied
- Services: NotificationService (existing infrastructure service)

Does this decomposition look correct? (yes/no/corrections)
```

#### Phase 2 — Anchoring

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTING] | `entity Order` in orders.domain — has `status : OrderStatus`, `shippedAt : datetime optional pastOrPresent` |
| OrderShipped | [EXISTING] | `event OrderShipped { fields { orderId : uuid, shippedAt : datetime, trackingNumber : string optional } }` — emitted by "Ship a confirmed order" but no policy or event-triggered operation listens to it |
| OnOrderShipped | [NEW] | No reactive policy exists for `OrderShipped`. Proposed: policy with trigger OrderShipped, effect NotifyOrderShipped |

Does this mapping look correct? (yes/no/corrections)
```

#### Phase 3 — Confrontation

```
### [COMPATIBLE]
The proposed specification is fully compatible with the existing model.
No contradiction, no blocked invariant, no unhandled impact.

**Details:**
- The `OrderShipped` event is already emitted by the "Ship a confirmed order" operation but has no consumer — this spec fills a known gap.
- No existing `precondition`, `policy`, or `invariant` blocks this addition.

### [GAP] — Tracking details not modeled
The spec mentions "start delivery tracking" but no tracking entity or service exists in the model. The side effect will be expressed as an infrastructure service call since the tracking system is outside the Orders bounded context.
```

#### Phase 4 — Proposition

The following `.spec` file is proposed:

```
spec "React when an order is shipped"
against "orders" version "a1b2c3d" at "2025-01-15T10:30:00Z"
uses "orders.domain"

narrative {
  "When an order is shipped, the system should notify the customer"
  "and start delivery tracking."
}

concepts {
  entity Order [existing]              // entity Order in orders.domain
  event OrderShipped [existing]        // emitted by "Ship a confirmed order", no consumer
  policy OnOrderShipped [new]          // reactive rule: trigger OrderShipped
  command NotifyOrderShipped [new]     // effect command for the policy
}

confrontation {
  compatible "Fully compatible with the existing model"

  gap "Tracking details not modeled" {
    "The spec mentions delivery tracking but no tracking entity or"
    "service exists in the Orders domain. The side effect is expressed"
    "as an infrastructure service call since tracking is outside this"
    "bounded context."
  }
}

changes "orders.domain" {
  add command NotifyOrderShipped :: "Notify customer and start tracking after shipment" {
    fields {
      orderId : uuid
      trackingNumber : string optional
    }
  }

  add policy OnOrderShipped :: "React to shipment by notifying customer and starting tracking" {
    trigger OrderShipped
    effect NotifyOrderShipped
  }

  modify entity Order {
    // ... existing entity definition unchanged ...
    operations {
      // ... existing operations unchanged ...

      // added by this spec
      "Handle order shipment notification" on NotifyOrderShipped {
        resolves Order from notifyOrderShipped.orderId

        NotificationService.notifyCustomer(Order.customer.id, "Your order has been shipped") :: "Notify customer of shipment"
        // NOTE: delivery tracking is outside Orders bounded context — infrastructure service call
      }
    }
  }
}

impact {
  operation "Ship a confirmed order" -> none
    "emits OrderShipped — the emitter is unchanged"
  operation "Deliver a shipped order" -> none
    "transitions shipped to delivered — unrelated"
  policy LateDeliveryAlert -> none
    "references Order.estimatedDelivery — unrelated to shipment notification"
}
```

#### Phase 5 — Confirmation

```
## Recap

### Domain model changes
- 2 additions (command NotifyOrderShipped, policy OnOrderShipped), 1 modification (entity Order — new operation), 0 deletions

### Impact
- 0 existing constructs affected

### Open items
- [GAP] Delivery tracking is outside the Orders bounded context — consider a separate Shipping context if tracking becomes complex

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
- Entities/Aggregates: Order (status transition: shipped → cancelled)
- Commands/Queries: CancelOrder (existing — extend its preconditions)
- Events: OrderCancelled (existing — already emitted by "Cancel an order" operation)
- Preconditions/Policies/Invariants: precondition on CancelOrder must be relaxed
- Services: potential need for a return/refund side effect

Does this decomposition look correct? (yes/no/corrections)
```

#### Phase 2 — Anchoring

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTING] | `entity Order` — `status : OrderStatus`, includes `shipped` and `cancelled` values |
| CancelOrder | [EXISTING] | `command CancelOrder { fields { orderId : uuid, reason : string optional maxLength(500) } }` |
| operation "Cancel an order" | [EXISTING] | Defined in entity Order — `precondition orderCancellable { Order.status in {draft, confirmed} } rejects "Order cannot be cancelled"` |
| OrderCancelled | [EXISTING] | `event OrderCancelled { fields { orderId : uuid, lines : list<OrderLine>, reason : string optional, cancelledAt : datetime } }` |

Does this mapping look correct? (yes/no/corrections)
```

#### Phase 3 — Confrontation

```
### [CONTRADICTION] — CancelOrder precondition blocks shipped orders

**The model says:**
> precondition orderCancellable :: "Order must be in a cancellable status" {
>   Order.status in {draft, confirmed}
> } rejects "Order cannot be cancelled"

**The spec says:**
> A customer should be able to cancel an order after it has been shipped.

**Analysis:** The current "Cancel an order" operation has a precondition that restricts cancellation to orders in `draft` or `confirmed` status. An order with `status = shipped` would be rejected. To allow cancellation after shipping, the `in` set must be extended to include `shipped`.

### [IMPACT] — Stock restoration assumes products are in warehouse

**The model says:**
> StockService.restock(Order.lines) :: "Restore stock for each cancelled line"

**The spec says:**
> Cancel after shipping.

**Analysis:** The existing operation calls StockService.restock, which makes sense for `draft` and `confirmed` orders (products reserved but not shipped). For a `shipped` order, the products are physically in transit — stock restoration requires a physical return process, not just an inventory adjustment.

### [GAP] — No return process modeled

The spec does not address what happens to the shipped products. Cancelling after shipping implies:
- The shipment must be intercepted or returned
- The customer may need a return label
- Refund should only occur after return is received

### [GAP] — Refund sequencing

The refund operation may require `Payment.order.status != cancelled` to pass. If the order is cancelled first and then a refund is attempted, the sequencing needs clarification.
```

#### Phase 4 — Proposition

The following `.spec` file is proposed:

```
spec "Cancel after shipping"
against "orders" version "a1b2c3d" at "2025-01-15T10:30:00Z"
uses "orders.domain"

narrative {
  "A customer should be able to cancel an order after it has been shipped."
}

concepts {
  entity Order [existing]                         // entity Order in orders.domain
  command CancelOrder [existing]                  // command CancelOrder in orders.domain
  operation "Cancel an order" [existing]          // precondition restricts to {draft, confirmed}
  event OrderCancelled [existing]                 // event OrderCancelled in orders.domain
}

confrontation {
  contradiction "CancelOrder precondition blocks shipped orders" {
    "The current operation restricts cancellation to draft and confirmed."
    "Order.status in {draft, confirmed} rejects shipped orders."
    "The set must be extended to {draft, confirmed, shipped}."
  }

  impact "Stock restoration assumes products are in warehouse" {
    "The operation calls StockService.restock, which assumes products are"
    "still in the warehouse. For shipped orders, a physical return is needed."
  }

  gap "No return process modeled" {
    "Cancelling after shipping implies shipment interception or return."
    "The spec does not address return labels or refund-after-return."
  }

  gap "Refund sequencing" {
    "If the order is cancelled first, the refund may fail."
    "The sequencing of cancellation and refund needs clarification."
  }
}

changes "orders.domain" {
  modify entity Order {
    identity id : uuid
    fields {
      status : OrderStatus default("draft")
      totalAmount : Money
      shippingAddress : Address
      placedAt : datetime optional pastOrPresent
      cancelledAt : datetime optional pastOrPresent
      createdAt : datetime immutable pastOrPresent
    }
    references {
      customer : Customer 1..1
      lines : OrderLine 1..N
    }

    operations {
      // ... other operations unchanged ...

      "Cancel an order" on CancelOrder {
        resolves Order from cancelOrder.orderId

        precondition orderCancellable :: "Order must be in a cancellable status" {
          Order.status in {draft, confirmed, shipped}  // was: {draft, confirmed}
        } rejects "Order cannot be cancelled"

        sets Order {
          status = cancelled
          cancelledAt = now()
        }

        StockService.restock(Order.lines) :: "Restore stock for each cancelled line"
        // added by this spec
        // NOTE: if order was shipped, initiate product return process before restocking

        emits OrderCancelled {
          orderId = Order.id
          lines = Order.lines
          reason = cancelOrder.reason
          cancelledAt = Order.cancelledAt
        }
      }
    }

    states {
      machine OrderLifecycle {
        // ... existing transitions ...
        shipped --> cancelled on "Cancel an order"  // added by this spec
      }
    }
  }
}

impact {
  operation "Cancel an order" -> affected
    "precondition extended from {draft, confirmed} to {draft, confirmed, shipped}"
  operation "Ship a confirmed order" -> none
    "sets Order.status to shipped — ShipOrder itself is unchanged"
  operation "Refund a payment" -> affected
    "depends on Payment.order.status — verify refund sequencing"
  policy MaxOrderAmount -> none
    "unrelated to cancellation"
}
```

#### Phase 5 — Confirmation

```
## Recap

### Domain model changes
- 0 additions, 1 modification (entity Order — precondition extended, state machine updated), 0 deletions

### Impact
- 2 existing constructs affected:
  - operation "Cancel an order" (precondition modified)
  - operation "Refund a payment" (verify refund sequencing)

### Open items
- [GAP] Return process not modeled — consider a separate spec for product returns
- [GAP] Refund sequencing with cancellation needs clarification

Write spec file to specy/specs/002_cancel-after-shipping.spec? (yes / no / corrections)
```
