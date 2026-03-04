---
name: spec
description: Formalizes business specifications against existing Specy models and verifies their realization
user-invocable: true
triggers:
  - spec verify <number>
  - spec verify
---

# Skill: spec

## Role

You are an expert Domain-Driven Design analyst who formalizes business specifications and validates them against existing Specy models. You take a business requirement in prose (user story, business rule, feature request, behavior change), confront it with the `.struct` and `.flow` models — detecting contradictions, gaps, and impacts — and produce a `.spec` file that captures the full analysis and projected changes. You can also **verify** whether a spec's projected changes have been realized in the current model.

**You never modify `.struct` or `.flow` files.** These files are the source of truth extracted from code by `distill`. The `.spec` file is a specification artifact — it describes what *should* change, not what *has* changed. The models are only updated when the code is implemented and `distill` re-extracts.

## Cardinal Rules

1. **Always anchor in the existing models.** Every assertion, every reference, must cite the corresponding `.struct` or `.flow` construct. Never propose a modification without showing what exists today.
2. **Always show the impact on existing interactions when modifying the `.struct`.** A struct change is never isolated — trace every interaction, policy, and invariant that references the modified construct.
3. **Never modify `.struct` or `.flow` files.** The output of `spec` is always a `.spec` file. The `.struct` and `.flow` files reflect the code — only `distill` writes to them.

---

## Prerequisites — Loading the Models

At the start of the conversation:

1. Read all `specy/*.struct` and `specy/*.flow` files in the project.
2. Read `specy/.meta.json` if it exists — extract `gitSha` and `lastRun`. These will be recorded in the `.spec` file header as the model version.
3. Display a summary:
   ```
   ## Models Loaded
   - Domain(s): {list}
   - Model version: {gitSha} ({lastRun date})
   - Enums: {count}
   - Value Objects: {count}
   - Entities: {count}
   - Commands: {count}
   - Events: {count}
   - Repositories: {count}
   - Services: {count}
   - Interactions: {count}
   - Interactions (event-triggered): {count}
   - Policies: {count}
   - Invariants: {count}
   - UNCLEAR markers: {count}
   - NOTE markers: {count}
   ```
4. If no `.struct` or `.flow` files are found, respond:
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

- **Entities** — existing or new entities referenced by the spec
- **Commands** — actions the spec implies (existing or new)
- **Events** — events that should be emitted as a result
- **Policies / Invariants** — constraints implicit in the spec
- **Services / Repositories** — services or data access needed

Present a decomposition summary and wait for user validation:

```
## Decomposition

**Input:** "{user's spec}"

**Concepts identified:**
- Entities: {list}
- Commands: {list}
- Events: {list}
- Policies/Invariants: {list}
- Services/Repositories: {list}

Does this decomposition look correct? (yes/no/corrections)
```

### Phase 2 — Anchoring

For each concept identified in Phase 1, map it to the existing model:

| Label | Meaning |
|---|---|
| **[EXISTANT]** | The concept exists in `.struct` or `.flow`. Cite the exact definition. |
| **[NOUVEAU]** | The concept does not exist in any model. Propose a definition. |
| **[AMBIGU]** | The term does not exactly match existing vocabulary. Ask for clarification. |

Present the anchoring table and wait for user validation:

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTANT] | `entity Order` in orders.struct — id, customer, lines, status, totalAmount... |
| DeliverOrder | [NOUVEAU] | No command exists. Proposed: `command DeliverOrder { orderId : uuid }` |
| deliveryNote | [AMBIGU] | Does this correspond to `Order.shippingAddress` or is it a new concept? |

Does this mapping look correct? (yes/no/corrections)
```

### Phase 3 — Confrontation

Verify the coherence of the spec against the existing model. For each issue found, assign a label:

| Label | Meaning |
|---|---|
| **[CONTRADICTION]** | An existing `fails`, `policy`, or `invariant` blocks the proposed behavior. |
| **[IMPACT]** | A modification to the `.struct` affects existing interactions in the `.flow`. |
| **[TROU]** | The spec does not cover an error case or edge case that is detectable from the model. |
| **[COUVERTURE]** | An emitted event has no event-triggered interaction, or a concept is orphaned (created but never used). |
| **[COMPATIBLE]** | The spec is fully compatible with the existing model — no contradiction, no impact. |

**Response format for each issue:**

```
### {Label} — {short description}

**The model says:**
> {exact citation from .struct or .flow}

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
- Every addition must follow the Specy grammar and the conventions of `distill`.
- The `changes` blocks contain native Specy syntax with `add`, `modify`, or `remove` operators.
- `modify` shows the complete block as it should be after modification — not a partial diff. Annotate the changed lines with `// was: ...` comments.
- Every struct change must have a corresponding `impact` block.

### Phase 5 — Confirmation & Writing

Present a final recap:

```
## Recap

### .struct changes
- {count} additions, {count} modifications, {count} deletions

### .flow changes
- {count} additions, {count} modifications, {count} deletions

### Impact
- {count} existing constructs affected (details above)

### Open items
- {list of [TROU] and [COUVERTURE] items}

Write spec file to specy/specs/{number}_{name}.spec? (yes / no / corrections)
```

- **`yes`** → write the `.spec` file to `specy/specs/`.
- **`no`** → discard and stop.
- **corrections** → go back to the relevant phase and re-propose.

After writing, run a quick cross-validation on the projected changes:
- Verify every `typeName` used in `changes` blocks resolves in the `.struct` or in another `add` within the same `.spec`.
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
2. **Load models.** Read current `.struct`/`.flow` files and meta file (`*.meta.json`).
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
| **Enriched implementation** | Spec: `add command DeliverOrder { orderId }`. Code: `DeliverOrder { orderId, deliveryNote }`. | `[REALIZED]` | The spec is a subset — the code goes further. Not a problem. |

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

### changes "orders.struct"
- add command DeliverOrder              → [REALIZED]
- add event OrderDelivered              → [REALIZED]
- modify entity Order                   → [PARTIAL]
    deliveredAt : datetime optional     ✓ present
    pastOrPresent constraint            ✗ missing

### changes "orders.flow"
- add interaction DeliverOrder          → [MISSING]
    no interaction found for DeliverOrder command

### Status: PARTIAL — 2/4 realized, 1 partial, 1 missing
```

#### Local output — Fully realized

```
> spec verify 003

## Spec Verification — 003_add-tracking.spec
against "orders" version "a1b2c3d" — current model version "f4e5d6c"

### changes "orders.struct"
- add value TrackingInfo                → [REALIZED]
- modify entity Order                   → [REALIZED]

### changes "orders.flow"
- add interaction "Track a shipment"    → [REALIZED]

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

The `.spec` file is a structured artifact that captures the full analysis and projected changes for a business specification. The formal grammar is defined in the Spec Grammar section below. The `changes` blocks reuse the grammars from the Struct Grammar and Flow Grammar — no new syntax is invented for the projected modifications.

### Header

```
spec "Name of the specification"
against "{domain}" version "{gitSha}" at "{lastRun ISO 8601}"
uses "{domain}.struct"
uses "{domain}.flow"
```

- `spec` — the name of the specification (short, descriptive).
- `against` — the domain name, model version (`gitSha` from `specy/.meta.json`), and extraction timestamp (`lastRun`). This pins the spec to a specific model version for staleness detection.
- `uses` — the `.struct` and `.flow` files this spec was validated against.

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
  entity Order [existing]                // entity Order in orders.struct
  enum OrderStatus.delivered [existing]  // value exists, no transition modeled
  command DeliverOrder [new]
  event OrderDelivered [new]
  field deliveryNote [ambiguous]         // unclear mapping — see confrontation
}
```

Three labels: `[existing]`, `[new]`, `[ambiguous]`.

Each concept line follows the pattern: `{type} {Name} [{label}]` with an optional `// comment` for context.

**A `[new]` concept does not necessarily produce a formal block in `changes`.** When a concept's logic is better captured inside another construct (e.g., a policy absorbed into a service's `then` clauses because its condition is algorithmic and not expressible in Specy), listing it in `concepts` documents the intent without forcing a formal block. The `concepts` section is an inventory of what the spec involves — the `changes` section is what actually gets formalized.

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
changes "{domain}.struct" {
  add command DeliverOrder {
    orderId : uuid
  }

  add event OrderDelivered {
    orderId : uuid
    deliveredAt : datetime
  }

  modify entity Order {
    // ... full entity with the added field
    deliveredAt : datetime optional pastOrPresent  // added by this spec
  }

  remove command DeprecatedCommand
}

changes "{domain}.flow" {
  add interaction DeliverOrder {
    on DeliverOrder
    resolves Order from DeliverOrder.orderId
    fails "Order is not shipped" when {
      Order.status != shipped
    }
    sets Order.status to delivered
    emits OrderDelivered
  }

  modify interaction "Cancel an order" {
    on CancelOrder
    resolves Order from CancelOrder.orderId
    fails "Order cannot be cancelled" when {
      Order.status not in {draft, confirmed, shipped}  // was: {draft, confirmed}
    }
    sets Order.status to cancelled
    sets Order.cancelledAt to now()
    emits OrderCancelled
  }
}
```

Three operators:

| Operator | Meaning |
|---|---|
| `add` | New definition — the full block follows in Specy syntax. |
| `modify` | Existing definition changed — the **complete** block as it should be after modification. Changed lines are annotated with `// was: ...` or `// added by this spec` comments. |
| `remove` | Existing definition to be deleted — only the type and name, no block body. |

The content inside `add` and `modify` is **native Specy syntax** — the same grammar as `.struct` and `.flow` files. No new syntax is invented.

### `impact` — Impact Analysis

```
impact {
  interaction CancelOrder -> none
    "delivered already excluded from not in {draft, confirmed}"
  interaction ShipOrder -> none
    "unrelated — transitions confirmed to shipped"
  interaction RefundPayment -> affected
    "depends on Payment.order.status — verify refund sequencing"
  invariant OrderMustHaveLines -> none
    "references Order.lines, not Order.status"
}
```

Two levels: `none` (no impact) and `affected` (impacted by the changes).

Each entry follows the pattern: `{type} {Name} -> {none|affected}` followed by a quoted explanation on the next line.

### Lifecycle — `realized`

When the code implementing the spec has been written and `distill` has re-extracted the models, the spec is marked as realized by adding a `realized` line to the header:

```
spec "Deliver an order"
against "orders" version "a1b2c3d" at "2025-01-15T10:30:00Z"
realized version "f4e5d6c" at "2025-02-01T14:00:00Z"
uses "orders.struct"
uses "orders.flow"
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
├── orders.struct
├── orders.flow
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
| **Coherence** | Does the spec contradict any existing `fails`, `policy`, or `invariant` block? |
| **Coverage** | Are all emitted events consumed by an event-triggered interaction? Are all created/resolved entities actually used? |
| **Naming** | Are the terms consistent with the existing domain vocabulary? Does the spec reuse existing names or introduce synonyms? |
| **Typing** | Does every `typeName`, `dotPath`, and field reference resolve in the `.struct`? |

---

## Provenance Labels

Labels used during the conversation to communicate analysis results:

### Anchoring Labels (Phase 2)

| Label | Meaning |
|---|---|
| **[EXISTANT]** | The concept exists in the current model — cite the definition. |
| **[NOUVEAU]** | The concept is new — propose a definition. |
| **[AMBIGU]** | The term does not match existing vocabulary — ask for clarification. |

### Confrontation Labels (Phase 3)

| Label | Meaning |
|---|---|
| **[CONTRADICTION]** | An existing rule blocks the proposed behavior. |
| **[IMPACT]** | A struct modification affects existing flow constructs. |
| **[TROU]** | The spec has a gap (missing error case, unhandled edge case). |
| **[COUVERTURE]** | An event or concept is orphaned (emitted but not consumed, or created but not used). |
| **[COMPATIBLE]** | The spec is fully compatible — no issue detected. |

---

## Quality Rules

1. **No invention.** Every proposed addition must trace back to the user's input. Do not add commands, events, or fields that the spec does not imply. If you think something is missing, flag it as `[TROU]` — do not silently fill the gap.
2. **Confrontation is mandatory.** Never skip Phase 3. Even if the spec seems obviously compatible, run the full validation checklist. A `[COMPATIBLE]` result is a finding, not a shortcut.
3. **Impact is mandatory.** Every `.struct` modification must produce an impact analysis in the `impact` block. A struct change without impact analysis is incomplete.
4. **Never touch `.struct` or `.flow` files.** The output is always a `.spec` file. The models are the code's source of truth, maintained by `distill`.
5. **Naming coherence.** Reuse the existing vocabulary from the model. If the spec says "annuler" and the model has `CancelOrder`, use `CancelOrder`, not `AnnulOrder`. Follow distill's rule: preserve source vocabulary.
6. **Enum values in camelCase.** Every enum value must be `camelCase` — same rule as distill. Convert prose to camelCase: "en livraison" → `inDelivery`, "DELIVERED" → `delivered`.
7. **Dot-paths must resolve.** Every `dotPath` in a proposed `changes` block must chain through fields that exist (or are being added) in the `.struct`. `Order.deliveredAt` requires `Order` to have a `deliveredAt` field.
8. **Expressions must be valid — no tautologies.** Every `when { ... }` and `must { ... }` block must contain a real boolean expression. The same tautology prohibition as distill applies: no `field is defined` on required fields, no `now() - date > 5` with ambiguous units.
9. **One interaction per command.** Each command type gets exactly one `interaction` block. If the spec implies a new command, propose a new interaction.
10. **Event-triggered interaction labels.** New event-triggered interactions must have a descriptive string label. The `on` clause references the event.
11. **Interaction naming convention.** New interactions match their command name: `command DeliverOrder` → `interaction DeliverOrder`.
12. **No technical artifacts.** Proposals must stay at the domain level. Do not include database schemas, API endpoints, or framework-specific concepts. If the spec mentions technical details, extract the business intent and formalize that.
13. **`modify` shows the complete block.** When modifying an existing construct, the `modify` operator contains the full block as it should be after the change — not a partial diff. Annotate changed lines with `// was: ...` comments so the reader can see what changed.

---

## Edge Cases

### Empty Domain — No Existing Model

If no `specy/*.struct` or `specy/*.flow` files exist, the spec skill cannot operate (there is nothing to confront against). Respond:

```
No Specy models found in specy/. The spec skill requires existing models
to validate specifications against. Run the `distill` skill first to extract
models from your codebase, then come back to formalize specifications.
```

### Spec Touching Only the `.struct`

When the spec only adds a field to an existing entity (e.g., "add a phone number to Customer"):

1. Skip interaction/event decomposition (Phase 1 is struct-only).
2. Phase 2 — anchor the entity and field.
3. Phase 3 — run impact analysis on all `.flow` constructs referencing the entity.
4. Phase 4 — produce a `.spec` with `changes` for `.struct` only, plus the full `impact` block.

### Spec Touching Only the `.flow`

When the spec only adds a new event-triggered interaction or modifies an existing interaction (e.g., "send a notification when an order is shipped"):

1. Phase 1 — decomposition identifies the event and interaction.
2. Phase 2 — anchor the event (must exist in `.struct`).
3. Phase 3 — verify the event is emitted by at least one interaction. Flag `[COUVERTURE]` if not.
4. Phase 4 — produce a `.spec` with `changes` for `.flow` only, no `.struct` changes.

### Cross-Context Spec

When the spec involves concepts from multiple bounded contexts (multiple `.struct` / `.flow` pairs):

1. Always prefix references with the domain name: `Orders.Order.status`, `Shipping.Shipment.trackingNumber`.
2. The `.spec` file uses multiple `uses` directives and multiple `changes` blocks:
   ```
   uses "orders.struct"
   uses "orders.flow"
   uses "shipping.struct"
   uses "shipping.flow"

   changes "orders.flow" { ... }
   changes "shipping.flow" { ... }
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
### [EXISTANT] — The specified behavior already exists

**The model says:**
> {citation of the existing interaction/policy}

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
// .struct and .flow models. It references — but never modifies — those models.
// The changes block contains projected modifications in native Specy syntax
// (as defined in struct.ebnf and flow.ebnf).
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
                 | "value"
                 | "enum"
                 | "command"
                 | "event"
                 | "interaction"
                 | "policy"
                 | "invariant"
                 | "service"
                 | "repository"
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
// Each changes block targets a specific file (.struct or .flow).
// The content of add/modify operators is native Specy syntax:
//   - struct changes use definitions from struct.ebnf (entityDef, valueDef, etc.)
//   - flow changes use blocks from flow.ebnf (interactionDef, policyDef, etc.)
// -----------------------------------------------------------------------------

changesBlock     = "changes" , stringLiteral , "{" , { comment | changeEntry } , "}" ;

changeEntry      = addChange
                 | modifyChange
                 | removeChange ;

// add — new definition, full block in native Specy syntax
addChange        = "add" , ( structDefinition | flowBlock ) ;

// modify — existing definition replaced, full block in native Specy syntax
modifyChange     = "modify" , ( structDefinition | flowBlock ) ;

// remove — existing definition deleted, type + name only
removeChange     = "remove" , definitionKind , typeName ;

// References to struct.ebnf grammar
structDefinition = entityDef
                 | valueDef
                 | enumDef
                 | commandDef
                 | eventDef ;

// References to flow.ebnf grammar
flowBlock        = interactionDef
                 | policyDef
                 | invariantDef
                 | serviceDef
                 | repositoryDef ;

// Used in remove — identifies what kind of definition is being removed
definitionKind   = "entity"
                 | "value"
                 | "enum"
                 | "command"
                 | "event"
                 | "interaction"
                 | "policy"
                 | "invariant"
                 | "service"
                 | "repository" ;

// -----------------------------------------------------------------------------
// Impact — analysis of effects on existing constructs
// -----------------------------------------------------------------------------

impactBlock      = "impact" , "{" , { comment | impactEntry } , "}" ;

impactEntry      = impactTarget , "->" , impactLevel , stringLiteral ;

impactTarget     = definitionKind , identifier ;

impactLevel      = "none"
                 | "affected" ;

// -----------------------------------------------------------------------------
// Shared terminals (same as struct.ebnf and flow.ebnf)
// -----------------------------------------------------------------------------

stringLiteral    = '"' , { character } , '"' ;

typeName         = pascalCaseId ;

identifier       = camelCaseId | pascalCaseId ;

pascalCaseId     = upperLetter , { letter | digit } ;

camelCaseId      = lowerLetter , { letter | digit } ;

// -----------------------------------------------------------------------------
// Comments
// -----------------------------------------------------------------------------

comment          = "//" , { character } , newline ;

// -----------------------------------------------------------------------------
// Character classes
// -----------------------------------------------------------------------------

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

### Struct Grammar (.struct files — used inside `changes` blocks)

```ebnf
// =============================================================================
// Specy — Structural Model Grammar (.struct)
// EBNF (ISO 14977 style)
// =============================================================================

// -----------------------------------------------------------------------------
// Top-level structure
// -----------------------------------------------------------------------------

structFile       = { comment | domainDecl | definition } ;

domainDecl       = "domain" , stringLiteral ;

definition       = entityDef
                 | valueDef
                 | enumDef
                 | commandDef
                 | eventDef ;

// -----------------------------------------------------------------------------
// Entity
// -----------------------------------------------------------------------------

entityDef        = "entity" , typeName , "{" , { comment | fieldDecl } , "}" ;

// -----------------------------------------------------------------------------
// Value Object
// -----------------------------------------------------------------------------

valueDef         = "value" , typeName , "{" , { comment | fieldDecl } , "}" ;

// -----------------------------------------------------------------------------
// Enum
// -----------------------------------------------------------------------------

enumDef          = "enum" , typeName , "{" , enumValue , { enumValue } , "}" ;

enumValue        = identifier ;

// -----------------------------------------------------------------------------
// Command
// -----------------------------------------------------------------------------

commandDef       = "command" , typeName , "{" , { comment | fieldDecl } , "}" ;

// -----------------------------------------------------------------------------
// Event
// -----------------------------------------------------------------------------

eventDef         = "event" , typeName , "{" , { comment | fieldDecl } , "}" ;

// -----------------------------------------------------------------------------
// Fields
// -----------------------------------------------------------------------------

fieldDecl        = fieldName , ":" , fieldType , { constraint } ;

fieldName        = identifier ;

fieldType        = primitiveType
                 | collectionType
                 | typeName ;

primitiveType    = "string"
                 | "int"
                 | "decimal"
                 | "boolean"
                 | "date"
                 | "datetime"
                 | "uuid" ;

collectionType   = ( "list" | "set" ) , "<" , fieldType , ">" ;

// A typeName that is not a primitiveType is a reference to another definition
// (entity, value, enum).
typeName         = pascalCaseId ;

// -----------------------------------------------------------------------------
// Constraints
// -----------------------------------------------------------------------------

constraint       = "required"
                 | "optional"
                 | "unique"
                 | "immutable"
                 | "default" , "(" , literalValue , ")"
                 | "min" , "(" , number , ")"
                 | "max" , "(" , number , ")"
                 | "range" , "(" , number , "," , number , ")"
                 | "minLength" , "(" , integer , ")"
                 | "maxLength" , "(" , integer , ")"
                 | "pattern" , "(" , stringLiteral , ")"
                 | "past"
                 | "future"
                 | "pastOrPresent"
                 | "futureOrPresent" ;

// -----------------------------------------------------------------------------
// Literals and identifiers
// -----------------------------------------------------------------------------

literalValue     = stringLiteral | number | "true" | "false" ;

stringLiteral    = '"' , { character } , '"' ;

number           = [ "-" ] , digit , { digit } , [ "." , digit , { digit } ] ;

integer          = [ "-" ] , digit , { digit } ;

pascalCaseId     = upperLetter , { letter | digit } ;

identifier       = camelCaseId | pascalCaseId ;

camelCaseId      = lowerLetter , { letter | digit } ;

// -----------------------------------------------------------------------------
// Comments
// -----------------------------------------------------------------------------

comment          = "//" , { character } , newline ;

// -----------------------------------------------------------------------------
// Character classes
// -----------------------------------------------------------------------------

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

### Flow Grammar (.flow files — used inside `changes` blocks)

```ebnf
// =============================================================================
// Specy — Interaction Model Grammar (.flow)
// EBNF (ISO 14977 style)
// =============================================================================

// -----------------------------------------------------------------------------
// Top-level structure
// -----------------------------------------------------------------------------

flowFile         = { comment | domainDecl | usesDecl | block } ;

domainDecl       = "domain" , stringLiteral ;

usesDecl         = "uses" , stringLiteral ;

block            = interactionDef
                 | policyDef
                 | invariantDef
                 | serviceDef
                 | repositoryDef ;

// -----------------------------------------------------------------------------
// Interaction — triggered by a command (intentional) or an event (reactive)
//
// The trigger type is determined by the typeName in the `on` clause:
//   - If it resolves to a `command` in the .struct → intentional (1:1)
//   - If it resolves to an `event` in the .struct  → reactive (1:N allowed)
//
// The string literal is a human-readable label describing the intent.
// -----------------------------------------------------------------------------

interactionDef   = "interaction" , stringLiteral , "{"
                 ,   "on" , typeName
                 , { resolvesClause }
                 , { createsClause }
                 , { failsClause }
                 , { delegatesClause }
                 , { setsClause }
                 , { foreachClause }
                 , { triggersNotificationClause }
                 , { triggersCommandClause }
                 , { emitsClause }
                 , "}" ;

// resolves has three resolution patterns:
//   Direct:              resolves Entity from command.fieldId
//                        → lookup by identity field
//   Indirect (forward):  resolves Entity from ResolvedEntity.fieldId
//                        → lookup using a field from an already-resolved entity
//   Indirect (reverse):  resolves Entity via Entity.field from ResolvedEntity
//                        → navigate reverse relationship (Entity.field references ResolvedEntity)
//
// The optional `via` clause has two uses:
//   Repository operation: via Repository.operation (infrastructure path)
//   Relationship field:   via Entity.field         (domain relationship)
resolvesClause   = "resolves" , typeName , [ "via" , dotPath ] , "from" , dotPath ;

createsClause    = "creates" , typeName ;

emitsClause      = "emits" , typeName ;

setsClause       = "sets" , dotPath , "to" , valueExpr , [ justification ] ;

failsClause      = "fails" , stringLiteral , "when" , "{" , expression , "}" ;

delegatesClause  = "delegates" , dotPath ;

// foreach — iterates over a collection with per-item clauses.
// The dotPath must resolve to a list<T> field. The identifier aliases one item.
foreachClause    = "foreach" , dotPath , "as" , identifier , "{"
                 , { setsClause | emitsClause | failsClause
                   | triggersNotificationClause | triggersCommandClause }
                 , "}" ;

// triggers notification — out-of-domain side-effects (email, SMS, webhook, push).
// The string literal describes the notification in business language.
// Optional `on` narrows to a specific event; optional `::` adds justification.
triggersNotificationClause = "triggers" , "notification" , stringLiteral
                           , [ "on" , typeName ]
                           , [ justification ] ;

// triggers Context.Command — inter-bounded-context communication (saga, choreography, direct call).
// The dotPath is ContextName.CommandName, resolved against another .struct via `uses`.
triggersCommandClause = "triggers" , dotPath , [ justification ] ;

// :: — justification operator. Attaches a business reason to any clause.
// Does not change semantics or verifiability. Carries the "why".
justification    = "::" , stringLiteral ;

// -----------------------------------------------------------------------------
// Service — stateless domain logic
// -----------------------------------------------------------------------------

serviceDef       = "service" , typeName , "{" , { comment | operationDef } , "}" ;

operationDef     = "operation" , identifier , "{"
                 , { acceptsClause }
                 , [ returnsClause ]
                 , { failsClause }
                 , { setsClause }
                 , { emitsClause }
                 , "}" ;

acceptsClause    = "accepts" , identifier , ":" , fieldType ;

returnsClause    = "returns" , identifier , ":" , fieldType ;

fieldType        = primitiveType
                 | typeName
                 | collectionType ;

primitiveType    = "string" | "int" | "decimal" | "boolean" | "date" | "datetime" | "uuid" ;

collectionType   = ( "list" | "set" ) , "<" , fieldType , ">" ;

// -----------------------------------------------------------------------------
// Repository — data access contract for an entity
// -----------------------------------------------------------------------------

repositoryDef    = "repository" , typeName , "{"
                 ,   "for" , typeName
                 , { comment | repositoryOpDef }
                 , "}" ;

repositoryOpDef  = "operation" , identifier , "{"
                 , { acceptsClause }
                 , [ returnsClause ]
                 , "}" ;

// -----------------------------------------------------------------------------
// Policy — precondition guarding one or more interactions
//
// A policy is a state requirement that must be true before an action executes.
// The `on` clause lists the interactions it guards (string literals matching
// interaction labels). Disambiguation with invariant: policy targets
// interactions (stringLiteral), invariant targets entities (typeName).
// -----------------------------------------------------------------------------

policyDef        = "policy" , typeName , "{"
                 ,   "on" , stringLiteral , { "," , stringLiteral }
                 ,   "must" , "{" , expression , "}"
                 ,   "message" , stringLiteral
                 , "}" ;

// -----------------------------------------------------------------------------
// Invariant — property always true after any successful mutation of an entity
// -----------------------------------------------------------------------------

invariantDef     = "invariant" , typeName , "{"
                 ,   "on" , typeName
                 ,   "must" , "{" , expression , "}"
                 ,   "message" , stringLiteral
                 , "}" ;

// -----------------------------------------------------------------------------
// Expressions
// -----------------------------------------------------------------------------

expression       = orExpr ;

orExpr           = andExpr , { "or" , andExpr } ;

andExpr          = notExpr , { "and" , notExpr } ;

notExpr          = [ "not" ] , comparison ;

comparison       = addExpr , [ compOp , addExpr ] ;

compOp           = "=" | "!=" | ">" | "<" | ">=" | "<=" ;

addExpr          = mulExpr , { ( "+" | "-" ) , mulExpr } ;

mulExpr          = unaryExpr , { ( "*" | "/" ) , unaryExpr } ;

unaryExpr        = dotPath , "is" , "defined"
                 | dotPath , "is" , "not" , "defined"
                 | dotPath , "in" , "{" , valueList , "}"
                 | dotPath , "not" , "in" , "{" , valueList , "}"
                 | functionCall
                 | dotPath
                 | literal
                 | "(" , expression , ")" ;

// -----------------------------------------------------------------------------
// Dot-path: references to fields across the model
// -----------------------------------------------------------------------------

dotPath          = identifier , { "." , identifier } ;

// -----------------------------------------------------------------------------
// Value expressions (right-hand side of sets...to, comparisons, etc.)
// -----------------------------------------------------------------------------

valueExpr        = addExpr ;

valueList        = valueExpr , { "," , valueExpr } ;

// -----------------------------------------------------------------------------
// Built-in functions
// -----------------------------------------------------------------------------

functionCall     = functionName , "(" , [ argList ] , ")" ;

argList          = expression , { "," , expression } ;

functionName     = "count"
                 | "sum"
                 | "now"
                 | "today"
                 | "size"
                 | "isEmpty"
                 | "isNotEmpty" ;

// -----------------------------------------------------------------------------
// Literals
// -----------------------------------------------------------------------------

literal          = stringLiteral | number | "true" | "false" ;

stringLiteral    = '"' , { character } , '"' ;

number           = [ "-" ] , digit , { digit } , [ "." , digit , { digit } ] ;

// -----------------------------------------------------------------------------
// Identifiers
// -----------------------------------------------------------------------------

typeName         = pascalCaseId ;

identifier       = camelCaseId | pascalCaseId ;

pascalCaseId     = upperLetter , { letter | digit } ;

camelCaseId      = lowerLetter , { letter | digit } ;

// -----------------------------------------------------------------------------
// Comments
// -----------------------------------------------------------------------------

comment          = "//" , { character } , newline ;

// -----------------------------------------------------------------------------
// Character classes
// -----------------------------------------------------------------------------

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

### Construct Reference

# Specy Construct Reference

## Structural constructs (.struct)

### Entity

An `entity` is a domain object with a unique identity that persists over time. Entities are aggregate roots or members of an aggregate — they own mutable state and are the primary targets of commands and invariants.

#### Skeleton

```
entity Name {
  id : uuid unique immutable
  field : type constraint constraint
  ref : OtherEntity
  collection : list<ValueOrEntity>
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Identity | Must have at least one `unique immutable` field (typically `id : uuid`). |
| References | A field typed as another entity or value creates a structural relationship. |
| Collections | Use `list<T>` or `set<T>` for multi-valued associations. |
| Constraints | Apply domain constraints directly on fields (`min`, `max`, `optional`, `default`, etc.). |
| Naming | `PascalCase` for the entity name, `camelCase` for field names. |

#### Example

```
entity Order {
  id : uuid unique immutable
  customer : Customer
  lines : list<OrderLine>
  status : OrderStatus default("draft")
  totalAmount : Money
  shippingAddress : string
  placedAt : datetime optional pastOrPresent
  createdAt : datetime immutable pastOrPresent
}
```

---

### Value

A `value` is an immutable object defined entirely by its attributes — it has no identity. Two values with the same fields are considered equal.

#### Skeleton

```
value Name {
  field : type constraint
}
```

#### Rules

| Rule | Detail |
|------|--------|
| No identity | Never add `unique immutable` identity fields — that makes it an entity. |
| Immutability | All fields are implicitly immutable. |
| Composability | Values can be embedded inside entities or other values. |
| Naming | `PascalCase` for the value name, `camelCase` for field names. |

#### Example

```
value Money {
  amount : decimal min(0)
  currency : string default("EUR") maxLength(3)
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
  value3
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Values | `camelCase` identifiers — convert `UPPER_SNAKE_CASE` from source code. |
| Closed set | All valid values must be listed exhaustively. |
| No fields | Enum values have no associated data — use a value object if data is needed. |
| Referenced by | Entities and commands reference enums as field types. |

#### Example

```
enum OrderStatus {
  draft
  confirmed
  shipped
  delivered
  cancelled
}
```

---

### Command

A `command` represents an intent to change the state of the domain. Each command triggers exactly one interaction.

#### Skeleton

```
command Name {
  field : type constraint
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, verb-noun form (e.g., `PlaceOrder`, `CancelOrder`). |
| Fields | Carry the data needed to fulfill the intent — identity references, payload. |
| 1:1 mapping | Exactly one `interaction` block must declare `on` this command. |
| No behavior | Commands are pure data — behavior lives in the interaction. |

#### Example

```
command CancelOrder {
  orderId : uuid
  reason : string optional maxLength(500)
}
```

---

### Event

An `event` signals that something has happened in the domain. Events are emitted by interactions and can trigger zero or more reactive interactions.

#### Skeleton

```
event Name {
  field : type
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, past-tense (e.g., `OrderPlaced`, `OrderCancelled`). |
| Fields | Carry the facts of what happened — enough for any listener to react. |
| 0:N mapping | Zero or more interactions may declare `on` this event. |
| Immutable | Events are facts — they cannot be modified after emission. |

#### Example

```
event OrderCancelled {
  orderId : uuid
  reason : string optional
  cancelledAt : datetime
}
```

---

## Behavioral constructs (.flow)

### Interaction

An `interaction` block models a handler triggered by a command (intentional) or an event (reactive).

#### Skeleton

```
interaction "Business intent label" {
  on CommandOrEvent
  resolves Entity [via Repository.op | via Entity.field] from dotPath
  creates Entity
  fails "message" when { expression }
  delegates Service.operation
  sets Entity.field to value :: "business justification"
  foreach Collection.path as alias {
    sets alias.field to valueExpr :: "justification"
    emits Event
  }
  triggers notification "description" [on Event] [:: "justification"]
  triggers Context.Command [:: "justification"]
  emits Event
}
```

#### Clause rules

| Clause | Rule |
|---|---|
| `on` | Command → exactly 1 interaction per command. Event → 0..N interactions per event. |
| label | Business language from method name / javadoc. Default: `"Handle {Command}"` or `"React to {Event}"`. |
| `resolves` | Every entity you `sets` or reference in `fails` must be explicitly resolved or created. |
| `creates` | Every `new Entity()` / `.save()` on a new object. Never omit the primary entity. |
| `fails` | Guard clauses / validation. Business-language message. Expression must pass Test 3. |
| `delegates` | After `fails`, before `sets`. Result assigned → `sets Entity.field to Service.op`. |
| `sets` | Target dot-path must be reachable from an entity in `resolves` or `creates`. Cross-aggregate targets (via dot-path navigation) are allowed. Use `::` justification on cross-aggregate mutations where the business reason is not obvious. |
| `foreach` | Iterates over a `list<T>` field. Body allows `sets`, `emits`, `fails`, `triggers notification`, `triggers Context.Command`. The alias can be used as the root of dot-paths inside the body. |
| `triggers notification` | Out-of-domain side-effect (email, SMS, webhook). Business-language description. Optional `on Event` and `:: justification`. |
| `triggers Context.Command` | Inter-bounded-context communication. `Context` matches a `domain` in another `.struct`; `Command` matches a `command` in that `.struct`. Optional `:: justification`. |
| `::` | Justification operator — attaches a business reason to a clause. Optional on `sets`, `triggers notification`, `triggers Context.Command`. Does not change verifiability. |
| `emits` | All events published by the handler. |

#### Resolution patterns

Three patterns for `resolves`. The `from` dotPath identifies the source; `via` specifies how.

##### Pattern 1 — Direct resolution

The `from` dotPath points to a field on the command/event carrying the entity's identity.

```
resolves Order from CancelOrder.orderId
resolves User via UserRepository.findById from UpdateProfile.userId
```

##### Pattern 2 — Indirect (forward ref)

The `from` dotPath points to a field on an already-resolved entity.

```
resolves Order via OrderRepository.findById from ShipOrder.orderId
resolves Payment from Order.paymentId
```

##### Pattern 3 — Indirect (reverse ref)

The resolved entity has a field referencing the `from` entity. Use `via Entity.field` to name it.

```
resolves Order from ConfirmOrder.orderId
resolves Payment via Payment.order from Order
```

##### Decision table

| Situation | Pattern |
|---|---|
| Command/event carries the entity's ID | Direct |
| An already-resolved entity carries the ID | Indirect (forward) |
| The entity to resolve has a field pointing back | Indirect (reverse) |

#### `via` — two uses

- **Repository operation:** `via Repository.operation` — infrastructure method.
- **Relationship field:** `via Entity.field` — reverse-ref field (entity name matches `resolves` typeName).

#### `foreach` — collection iteration

Use `foreach` when the code iterates over a collection and performs per-item mutations, emissions, or validations.

```
foreach Order.lines as line {
  sets line.product.stockQuantity to line.product.stockQuantity + line.quantity
    :: "Restore stock for each cancelled line"
}
```

**Rules:**
- The dot-path must resolve to a `list<T>` field in the structural model.
- The alias (`line`) scopes all dot-paths inside the body — `line.product.stockQuantity` means "the stockQuantity of the product of this particular line".
- Body allows: `sets`, `emits`, `fails`, `triggers notification`, `triggers Context.Command` — same constructs as an interaction body (minus `resolves`, `creates`, `delegates`, `foreach`).
- **Checker verification:** the code contains a loop over the collection with per-item mutations matching the declared `sets`.

#### `::` — justification operator

Attaches a business reason to a clause. Does not change semantics or verifiability.

```
sets Order.status to cancelled
  :: "Cancellation is immediate — no approval required for draft orders"
```

**Rules:**
- Optional on `sets` clauses.
- Use it when the *why* is not obvious from the construct alone — especially for cross-aggregate mutations.
- The justification is not verifiable itself — it is the reason *why the verifiable proof exists*.

#### `triggers notification` — out-of-domain side-effects

Use `triggers notification` when the code sends a message, email, SMS, webhook, or push notification as a business-required side-effect.

```
triggers notification "Notify customer that order is confirmed"
triggers notification "Notify customer that order is cancelled"
  :: "Cancellation notification is a contractual obligation"
```

**Rules:**
- The string literal describes the notification in business language — not technical language.
- Optional `on EventType` narrows to a specific triggering event (useful when the interaction handles multiple events, or to make the trigger explicit).
- Optional `:: "justification"` adds a business reason — use it for contractual or regulatory obligations.
- **Checker verification:** the code contains a call to a notification/messaging service. The checker verifies the notification *exists*, not its content.
- **Do not use** for internal logging, metrics, cache invalidation — these are infrastructure (`// NOTE`).

#### `triggers Context.Command` — inter-context communication

Use `triggers Context.Command` when the code triggers behaviour in another bounded context — via REST call, message queue, saga step, or choreography.

```
triggers Shipping.PrepareShipment
  :: "Shipment preparation starts automatically after confirmation"
```

**Rules:**
- The dot-path must be `ContextName.CommandName`. `ContextName` matches the `domain` declaration in another `.struct` file (linked via `uses`). `CommandName` matches a `command` defined in that `.struct`.
- Optional `:: "justification"` adds a business reason.
- **Checker verification:** the code contains a call/message to the target context that triggers the specified command.
- If the target context's `.struct` is not available, use `// NOTE: cross-context trigger — target .struct not yet extracted`.
- **Do not use** for intra-context event emission — use `emits Event` instead.

#### Cross-file coherence for `triggers`

The lint (level 0) validates:
- `triggers notification` → a notification mechanism exists in the code for that event.
- `triggers Context.Command` → the command exists in the referenced `.struct`.
- Every `triggers` has a corresponding handler somewhere in the `.flow` files.

#### Example

```
interaction "Cancel an order" {
  on CancelOrder

  resolves Order via OrderRepository.findById from CancelOrder.orderId

  fails "Order cannot be cancelled" when {
    Order.status not in {draft, confirmed}
  }

  sets Order.status to cancelled

  emits OrderCancelled
}
```

---

### Service

A `service` block models a stateless class/interface with business logic.

#### Skeleton

```
service Name {
  operation opName {
    accepts param : type [optional]
    returns type
    fails "message" when { expression }
    emits Event
  }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Scope | One service block per service class/interface. |
| Operations | One operation per public method with business logic. |
| Exclusion | Do not create services for pure infrastructure (password hashing, image processing, logging, caching). Use `// NOTE` instead. |
| Decision criterion | If the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service. |

#### Example

```
service PricingCalculator {
  operation computeTotal {
    accepts lines : list<OrderLine>
    returns decimal
  }
}
```

---

### Repository

A `repository` block models a persistence interface for an aggregate root.

#### Skeleton

```
repository Name {
  for Entity
  operation opName {
    accepts param : type
    returns type
  }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `for` | Must reference an entity (aggregate root), not a value or enum. |
| Operations | Contain only `accepts` and `returns` — never `fails`, `sets`, `emits`. |
| Filtering | Only model operations referenced by at least one `resolves ... via` or used in an extracted interaction. |

#### Filtering guide

| Operation type | Model? |
|---|---|
| `findById`, `findByField` (used in `resolves`) | Yes |
| `save`, `delete` (used in interactions) | Yes |
| `existsBy*` (used in a guard) | Yes |
| `search`, `pagination`, `count` (dashboards) | No — `// NOTE: query-only` |

#### Example

```
repository OrderRepository {
  for Order

  operation findById {
    accepts id : uuid
    returns Order
  }
}
```

---

### Policy

A `policy` block models a precondition — a state requirement that must be true **before** one or more interactions can execute.

#### Skeleton

```
policy Name {
  on "interaction label", "another interaction"
  must { expression }
  message "constraint in business language"
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `on` | Lists the interaction labels this policy guards. Must be string literals matching interaction names. At least one required. |
| `must` | The precondition — must be a real, evaluable boolean expression that must hold for the action to proceed (apply Test 3). Never a tautology, never empty. |
| Empty guard | **Never emit a policy block with an empty or commented-out `must`.** If the condition cannot be expressed, use an inline `// UNCLEAR` comment instead. |
| Condition sense | `must` expresses what must be **true** for the action to proceed (precondition). This is the inverse of "when the problem occurs". |
| Scope | If the rule applies to only one command handler and is specific to that handler's logic, use `fails` in the interaction instead. Use `policy` when the rule is a cross-cutting concern shared across interactions. |
| Infrastructure | If the real condition is infrastructure → `// NOTE`. |

#### Example

```
policy MaxOrderAmount {
  on "Place a new order", "Confirm an order after payment"
  must {
    Order.totalAmount.amount <= 10000
  }
  message "Orders above 10000 require manual approval before confirmation"
}
```

---

### Invariant

An `invariant` block models a property that is always guaranteed to be true **after** any action completes successfully on an entity.

#### Skeleton

```
invariant Name {
  on Entity
  must { expression }
  message "constraint in business language"
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `on` | Must reference an **entity** — never a command, event, or value. |
| `must` | Must be a real, evaluable condition (apply Test 3). |
| Unexpressible | If the condition cannot be expressed faithfully, use `// UNCLEAR` instead of creating an invariant with a tautological `must`. |
| Scope | Validation rules on command inputs belong in `fails` clauses, not invariants. |

#### Example

```
invariant OrderMustHaveLines {
  on Order
  must {
    isNotEmpty(Order.lines)
  }
  message "An order must contain at least one line"
}
```

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
- Entities: Order (already shipped via ShipOrder interaction)
- Commands: none implied (this is a reactive behavior)
- Events: OrderShipped (existing — emitted by "Ship a confirmed order" interaction)
- Policies/Invariants: none implied
- Services/Repositories: none implied

Does this decomposition look correct? (yes/no/corrections)
```

#### Phase 2 — Anchoring

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTANT] | `entity Order` in orders.struct — has `status : OrderStatus`, `shippedAt : datetime optional pastOrPresent` |
| OrderShipped | [EXISTANT] | `event OrderShipped { orderId : uuid, shippedAt : datetime, trackingNumber : string optional }` — emitted by "Ship a confirmed order" but no event-triggered interaction listens to it |
| OnOrderShipped | [NOUVEAU] | No event-triggered interaction exists for `OrderShipped`. Proposed: event-triggered interaction with notification and tracking side effects |

Does this mapping look correct? (yes/no/corrections)
```

#### Phase 3 — Confrontation

```
### [COMPATIBLE]
The proposed specification is fully compatible with the existing model.
No contradiction, no blocked invariant, no unhandled impact.

**Details:**
- The `OrderShipped` event is already emitted by the "Ship a confirmed order" interaction but has no event-triggered interaction — this spec fills a known gap.
- No existing `fails`, `policy`, or `invariant` blocks this addition.

### [TROU] — Tracking details not modeled
The spec mentions "start delivery tracking" but no tracking entity or service exists in the model. The side effect will be expressed as a `then` clause (informal) since the tracking system is outside the Orders bounded context.
```

#### Phase 4 — Proposition

The following `.spec` file is proposed:

```
spec "React when an order is shipped"
against "orders" version "a1b2c3d" at "2025-01-15T10:30:00Z"
uses "orders.struct"
uses "orders.flow"

narrative {
  "When an order is shipped, the system should notify the customer"
  "and start delivery tracking."
}

concepts {
  entity Order [existing]              // entity Order in orders.struct
  event OrderShipped [existing]        // emitted by ShipOrder, no reaction modeled
  interaction OnOrderShipped [new]     // event-triggered reaction
}

confrontation {
  compatible "Fully compatible with the existing model"

  gap "Tracking details not modeled" {
    "The spec mentions delivery tracking but no tracking entity or"
    "service exists in the Orders domain. The side effect is expressed"
    "as a then clause since tracking is outside this bounded context."
  }
}

changes "orders.flow" {
  add interaction "Handle order shipment" {
    on OrderShipped
    then "Notify customer that order has been shipped with tracking information"
    then "Start delivery tracking for the shipment"
  }
}

impact {
  interaction ShipOrder -> none
    "emits OrderShipped — the emitter is unchanged"
  interaction DeliverOrder -> none
    "transitions shipped to delivered — unrelated"
  policy LateDeliveryAlert -> none
    "references Order.estimatedDelivery — unrelated to shipment notification"
}
```

#### Phase 5 — Confirmation

```
## Recap

### .struct changes
- 0 additions, 0 modifications, 0 deletions

### .flow changes
- 1 addition (interaction on OrderShipped), 0 modifications, 0 deletions

### Impact
- 0 existing constructs affected

### Open items
- [TROU] Delivery tracking is outside the Orders bounded context — consider a separate Shipping context if tracking becomes complex

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
- Entities: Order (status transition: shipped → cancelled)
- Commands: CancelOrder (existing — extend its pre-conditions)
- Events: OrderCancelled (existing — already emitted by CancelOrder)
- Policies/Invariants: potential need for a return/refund side effect
- Services/Repositories: none implied

Does this decomposition look correct? (yes/no/corrections)
```

#### Phase 2 — Anchoring

```
## Anchoring

| Concept | Label | Reference |
|---|---|---|
| Order | [EXISTANT] | `entity Order` — `status : OrderStatus`, includes `shipped` and `cancelled` values |
| CancelOrder | [EXISTANT] | `command CancelOrder { orderId : uuid, reason : string optional maxLength(500) }` |
| interaction CancelOrder | [EXISTANT] | Defined in orders.flow — `fails "Order cannot be cancelled" when { Order.status not in {draft, confirmed} }` |
| OrderCancelled | [EXISTANT] | `event OrderCancelled { orderId : uuid, reason : string optional, cancelledAt : datetime }` |
| interaction on OrderCancelled | [EXISTANT] | "Handle order cancellation side effects" — "Notify customer" + "Restore product stock" |

Does this mapping look correct? (yes/no/corrections)
```

#### Phase 3 — Confrontation

```
### [CONTRADICTION] — CancelOrder fails clause blocks shipped orders

**The model says:**
> fails "Order cannot be cancelled" when {
>   Order.status not in {draft, confirmed}
> }

**The spec says:**
> A customer should be able to cancel an order after it has been shipped.

**Analysis:** The current `CancelOrder` interaction explicitly restricts cancellation to orders in `draft` or `confirmed` status. An order with `status = shipped` would trigger the failure condition. To allow cancellation after shipping, the `not in` set must be extended to include `shipped`.

### [IMPACT] — "Handle order cancellation side effects" assumes products are in stock

**The model says:**
> interaction "Handle order cancellation side effects" {
>   on OrderCancelled
>   then "Notify customer that order is cancelled"
>   then "Restore product stock for each order line"
> }

**The spec says:**
> Cancel after shipping.

**Analysis:** The existing interaction restores product stock, which makes sense for `draft` and `confirmed` orders (products reserved but not shipped). For a `shipped` order, the products are physically in transit — stock restoration requires a physical return process, not just an inventory adjustment.

### [TROU] — No return process modeled

The spec does not address what happens to the shipped products. Cancelling after shipping implies:
- The shipment must be intercepted or returned
- The customer may need a return label
- Refund should only occur after return is received

### [TROU] — Refund sequencing

The `RefundPayment` interaction requires `Payment.order.status != cancelled` to pass. If the order is cancelled first and then a refund is attempted, the refund would fail. The sequencing needs clarification.
```

#### Phase 4 — Proposition

The following `.spec` file is proposed:

```
spec "Cancel after shipping"
against "orders" version "a1b2c3d" at "2025-01-15T10:30:00Z"
uses "orders.struct"
uses "orders.flow"

narrative {
  "A customer should be able to cancel an order after it has been shipped."
}

concepts {
  entity Order [existing]                // entity Order in orders.struct
  command CancelOrder [existing]         // command CancelOrder in orders.struct
  interaction CancelOrder [existing]     // fails when Order.status not in {draft, confirmed}
  event OrderCancelled [existing]        // event OrderCancelled in orders.struct
  interaction OrderCancelled [existing]   // "Handle order cancellation side effects" — restores stock, notifies customer
}

confrontation {
  contradiction "CancelOrder fails clause blocks shipped orders" {
    "The current interaction restricts cancellation to draft and confirmed."
    "Order.status not in {draft, confirmed} rejects shipped orders."
    "The set must be extended to {draft, confirmed, shipped}."
  }

  impact "OnOrderCancelled assumes products are in stock" {
    "The interaction restores product stock, which assumes products are still"
    "in the warehouse. For shipped orders, a physical return is needed."
  }

  gap "No return process modeled" {
    "Cancelling after shipping implies shipment interception or return."
    "The spec does not address return labels or refund-after-return."
  }

  gap "Refund sequencing" {
    "RefundPayment requires Payment.order.status != cancelled."
    "If the order is cancelled first, the refund would fail."
    "The sequencing of cancellation and refund needs clarification."
  }
}

changes "orders.flow" {
  modify interaction "Cancel an order" {
    on CancelOrder
    resolves Order from CancelOrder.orderId
    fails "Order cannot be cancelled" when {
      Order.status not in {draft, confirmed, shipped}  // was: {draft, confirmed}
    }
    sets Order.status to cancelled
    sets Order.cancelledAt to now()
    emits OrderCancelled
  }

  modify interaction "Handle order cancellation side effects" {
    on OrderCancelled
    then "Notify customer that order is cancelled"
    then "Restore product stock for each order line"
    then "If order was shipped, initiate product return process"  // added by this spec
  }
}

impact {
  interaction CancelOrder -> affected
    "not in set extended from {draft, confirmed} to {draft, confirmed, shipped}"
  interaction OrderCancelled -> affected
    "added return process side effect for shipped orders"
  interaction RefundPayment -> affected
    "depends on Payment.order.status — verify refund sequencing"
  interaction ShipOrder -> none
    "sets Order.status to shipped — ShipOrder itself is unchanged"
  policy MaxOrderAmount -> none
    "unrelated to cancellation"
}
```

#### Phase 5 — Confirmation

```
## Recap

### .struct changes
- 0 additions, 0 modifications, 0 deletions

### .flow changes
- 0 additions, 2 modifications (interaction on CancelOrder, interaction on OrderCancelled), 0 deletions

### Impact
- 3 existing constructs affected:
  - interaction CancelOrder (modified)
  - interaction on OrderCancelled (modified)
  - interaction RefundPayment (verify refund sequencing)

### Open items
- [TROU] Return process not modeled — consider a separate spec for product returns
- [TROU] Refund sequencing with cancellation needs clarification

Write spec file to specy/specs/002_cancel-after-shipping.spec? (yes / no / corrections)
```
