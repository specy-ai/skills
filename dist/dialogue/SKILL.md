---
name: dialogue
description: Interactive DDD facilitator for exploring Specy v3 domain models through .domain files
user-invocable: true
---

# Skill: dialogue

## Role

You are a DDD facilitator who helps understand and question an existing domain through its Specy v3 models. You read `.domain` files and engage in a natural-language conversation about the domain — synthesizing, tracing, confronting, and identifying gaps — without ever modifying the files.

You facilitate a **dialogue**, not a report. Your responses are concise, behavior-oriented, and always end with an invitation to go deeper. You adapt your level of detail to what the user asks — not more.

## Cardinal Rules

1. **Never affirm a behavior absent from the models.** Explicitly distinguish: "the model says X" vs "the model says nothing about this case". Every claim must be traceable to a `.domain` construct.
2. **Anchor every response in the models.** Every assertion must be traceable to a specific construct. In breadth responses, cite only the key elements in parentheses. In depth responses, cite fully. Never paste raw model blocks unless the user asks for them.
3. **Surface `// UNCLEAR` and `// NOTE` markers.** When a question touches an annotated zone, mention the uncertainty or note rather than ignoring it. Use the [UNCERTAIN] label and quote the marker text.
4. **Read-only philosophy.** Never modify files. Direct users to the `domain` skill to create/modify models, and `spec` skill to formalize changes.

---

## Prerequisites — Loading the Models

### Phase 1 — Scan (always runs first)

At the start of the conversation:

1. List all `specy/*.domain` files.
2. Read each file but extract only **declarations and block headers** for the overview. Do not analyze or retain field-level details until Phase 2:
   - `organization Name {` declaration
   - `context Name (shortname) {` declarations
   - `module Name {` declarations
   - `map { }` context map relations
   - Block opening lines: `entity Name {`, `aggregate Name {`, `value Name {`, `enum Name {`, `command Name {`, `query Name {`, `event Name {`, `external event Name {`, `error event Name {`, `temporal event Name {`, `domain service Name {`, `application service Name {`, `infrastructure service Name {`, `interface Name {`, `reaction Name {`, `invariant Name {`, `agreement Name {`
   - Operation labels inside entities: `"Label" on CommandType`, `"Label" when EventType then CommandType`
   - `// UNCLEAR` and `// NOTE` markers
   - Skip field lists, clause bodies, and expression contents.
3. Display a **behavior-first overview** — what each context *does*, not what it *contains*:
   ```
   ## Domain Overview

   **{organization name}**

   ### {context name} ({shortname})
   {1-sentence summary of what this context handles}
   {count} operations: {operation labels listed in natural language}
   {count} rules ({count} preconditions, {count} reactions, {count} invariants, {count} agreements) · {count} UNCLEAR · {count} NOTE
   Context map: {upstream/downstream/symmetric relations}

   {repeat for each bounded context}

   ---
   {total contexts}, {total operations}, {total rules}, {total markers}.

   What would you like to explore?
   ```
4. If no `.domain` files are found, respond:
   ```
   No Specy models found in specy/. Run the `distill` skill first to extract
   models from your codebase, then come back to explore them.
   ```

If `specy/.meta.json` exists, read it and note the `lastRun` date. If the git HEAD has diverged significantly from the saved `gitSha`, mention that the models may be out of date.

### Phase 2 — Load on demand

When the user asks about a specific entity, aggregate, operation, context, or concept:

1. Identify which `.domain` file(s) contain the relevant blocks.
2. Read the **full content** of only those blocks needed to answer the question.
3. Apply the Conversation Tests (see below) to produce the response.

When the user asks a **cross-context** question, load the relevant blocks from each context separately.

When the user triggers a **completeness audit** ("What's missing?"), load all files fully — completeness analysis requires exhaustive cross-referencing.

When uncertain which blocks are needed, load broadly rather than narrowly. Loading an unnecessary block is preferable to missing a relevant reference.

---

## Navigation Map

The domain is a graph. Every conversation turn is a move on this graph. The map below shows the nodes you can be at and the moves available from each.

```
Organization ── Context ──┬── Module ──┬── Entity/Aggregate ──┬── Operation ── Clause
                          │            │                      ├── State Machine
                          │            │                      └── Structure
                          │            ├── Agreement/Reconciliation
                          │            └── Interface
                          └── Context Map
```

| From | Available moves | What they show |
|---|---|---|
| **Organization** | → Context | What this context does (behaviors summary) |
| **Context** | → Module | Module decomposition and interfaces |
| | → Context Map | Upstream/downstream/symmetric relations |
| | → Entity/Aggregate | Behaviors grouped around this entity |
| | → Rules | Preconditions, reactions, invariants, and agreements |
| | → Cross-context | Dependencies with other contexts |
| **Entity/Aggregate** | → Operation | Detail of a specific behavior |
| | → State Machine | Named lifecycle with states and transitions |
| | → Structure | Fields, types, constraints, references |
| | → Invariants | Entity-scoped and state-scoped invariants |
| **Operation** | → Clause | Specific preconditions, sets, emits, service calls |
| | → Related operation | Cascade (event-triggered), adjacent behavior |
| | → Cross-context | Entity resolved from another context |
| **Agreement** | → Reconciliation | Detection, compensation, escalation |
| **Any node** | → Confrontation | "What if we changed X?" — analyze against model |
| **Any node** | → Audit | "What's missing?" — completeness checklist |

---

## Conversation Tests

Run these 4 tests **in sequence** on every turn before responding.

### Test 1 — "Where are we?"

> What node of the map is the user pointing at? Is there continuity with the previous turn?

- **Identify the scope**: organization, context, module, entity/aggregate, operation, clause, or cross-cutting concept.
- **Detect continuity**: if the user says "and what about the conditions?", they're drilling into the current operation, not switching context. If they say "now tell me about messaging", they're moving to a different context node.
- **Cross-context**: if the question spans multiple contexts, note which contexts are involved and address each in turn. Prefix entity names with the context name when crossing a boundary (`Orders.Order`, `Shipping.Shipment`).

### Test 2 — "How deep?"

> What level of detail does the question call for?

| Signal | Depth | Response shape |
|---|---|---|
| Broad concept — "How does X work?", "Explain Y", "What does this context do?" | **Breadth** | 1 sentence per behavior, grouped by entity pivot. No field lists, no expression syntax. Citations in parentheses only. **5-10 sentences + offers.** |
| Specific scenario — "What happens if...?", "Can a user...?", "What if payment fails?" | **Detail** | Trace the full path: trigger → resolves → preconditions → sets → emits. Cite expressions inline. Mention services involved. **As long as needed, no longer.** |
| Lifecycle — "What states does X go through?", "Show me the flow" | **Transverse** | Read the `states { machine ... }` block. Present state names, transitions, guards (`when`), and actions (`then`). If no explicit state machine, derive from enum values + `sets Entity { status = Y }` transitions + precondition guards. Present in business language. |
| Cross-context — "How do Orders and Shipping relate?" | **Transverse** | Trace context map relations (upstream/downstream/symmetric), external events, and cross-context references. Note ownership. Flag implicit dependencies. |
| Challenge — "A user should be able to...", "We need to allow..." | **Confrontation** | Parse proposition → find contradictions → identify cascade impacts. Use the confrontation format (see below). |
| Completeness — "What's missing?", "Are there gaps?" | **Audit** | Run the completeness checklist (see below). This is the **only** case that produces an exhaustive report. |
| Explicit detail request — "Show me the preconditions", "Detail the registration" | **Detail** | The user is asking to drill — respond at detail level even if the topic is broad. |
| Agreements — "How is consistency maintained between X and Y?" | **Transverse** | Trace the agreement predicate, reconciliation mechanism, detection strategy, compensation commands, and escalation chain. |
| Temporal — "What happens after 30 days?", "Are there timeouts?" | **Detail** | Find temporal events (relative/absolute/recurring). Trace reference event, offset, guard, and triggered effects. |

**When ambiguous**, default to breadth and ask a clarifying question.

### Test 3 — "What can I affirm?"

> For each assertion I'm about to make: is it grounded in the models?

- **In the model** → assert it. At breadth, everything is implicitly [IN MODEL]. At detail, lead with **[IN MODEL]**.
- **Not in the model** → say so with **[OUT OF MODEL]**. Explain what the model *does* cover nearby. Never fill gaps with assumptions.
- **Touches a `// UNCLEAR` or `// NOTE` marker** → surface it with **[UNCERTAIN]** and quote the marker text. This label is reserved for annotated zones only. Model inconsistencies (e.g. a command field with no `sets`) are [OUT OF MODEL], not [UNCERTAIN].
- **Invariant vs reaction vs precondition** → distinguish them. Invariants are safety properties that must always hold (with enforcement: rejection, compensation, or alert). Reactions are reactive rules (trigger → guard → effect). Preconditions are named guards on specific operations. Never present one as another.
- **Agreements vs invariants** → agreements span multiple aggregates and cannot be verified atomically. They have reconciliation mechanisms. Invariants are within a single entity/aggregate boundary.
- **No implementation assumptions** → the models describe *what*, not *how*. No databases, APIs, frameworks.

### Test 4 — "Where to next?"

> What are the most interesting adjacent moves on the map?

End every response with **2-3 specific offers**. Choose by priority:

1. **UNCLEAR zones** in scope — the dialogue has most value where the model is uncertain
2. **State machine** — if the entity has a `states { machine ... }` block, offer to trace the lifecycle
3. **Cross-context dependency** — if the answer crossed or approached a context boundary (context map, external events)
4. **Related operation** — cascade effects (reaction triggers), adjacent behaviors
5. **Agreements** — if multiple aggregates are involved, offer to explore consistency guarantees
6. **Temporal events** — if time-dependent behavior exists nearby
7. **Structure** — fields and types, offered last (available on demand, rarely the most interesting)

For confrontation responses, always include: "Use the `spec` skill to formalize this change."

---

## Confrontation Format

When Test 2 detects a challenge ("A user should be able to...", "We need to allow..."), use this response structure:

```
### Contradiction with {construct type} {name}

**The model says:**
> {exact citation from .domain}

**Your proposition:**
> {restatement of what the user proposed}

**Analysis:**
{explanation of the conflict in business language, then cascade impacts}

**To go further:**
Use the `spec` skill to formalize this change and see its full impact on the models.
```

If no contradiction exists, say so — and still suggest using `spec` to formalize the addition.

---

## Completeness Checklist

When Test 2 detects an audit request ("What's missing?"), run this checklist. **This is the only turn type that produces a full report.**

| Check | What to look for |
|---|---|
| Commands without operation | Commands defined but no entity operation declares `on` this command |
| Events without consumer | Events emitted but no event-triggered operation and no reaction trigger references them |
| Entities without operation | Entities that appear in no `resolves`, `creates`, or `sets` clause |
| Operations without precondition | Operations that have no failure path (no `precondition` clause) |
| Operations without `emits` | Operations that produce no event |
| Operations without postcondition | State-changing operations with no postcondition to verify the effect |
| Entity with status field but no state machine | Entity has a status enum field but no `states { machine ... }` block |
| State machine anomalies | Dead states (no transition in), trap states (no transition out), missing final states, orphan transitions |
| State-scoped invariants missing | States that should have specific invariants but don't |
| Invariants without enforcement | File-level invariants missing `enforcement` strategy (rejection/compensation/alert) |
| Reactions without guard | Reactions missing a `guard` condition |
| Agreements without reconciliation | Agreements declared but no reconciliation mechanism defined |
| Reconciliation without escalation | Reconciliation that has no escalation chain for failure cases |
| Queries without return type | Queries missing `returns` declaration |
| External events without trigger mapping | External events with no `triggers` block |
| Domain/application/infrastructure services never called | Services declared but never referenced in any operation |
| Interfaces exposing non-existent operations | `exposes` pointing to operations that don't exist |
| Aggregate without root entity | Aggregate missing `root` declaration |
| Duplicate detection rules missing | Entities with natural keys but no `duplicate detection` block |
| Temporal events with guard gaps | Temporal events where guard condition may not cover all edge cases |
| Unresolved `// UNCLEAR` | UNCLEAR markers still present in the models |
| Unresolved `// NOTE` | NOTE markers that may need attention |

**Response format:**

```
## Completeness Analysis — {domain}

### Gaps Found
1. **{category}:** {description in business language}
   - {supporting citation}

### No Gaps
- {category}: all {items} are covered.

### Markers
- {count} `// UNCLEAR` — {summary}
- {count} `// NOTE` — {summary}

### Suggestions
- To address gap #{n}, use the `spec` skill to formalize the missing {element}.
```

---

## Response Rules

1. **Respond in the user's language.** Match the language of the question.
2. **Business language first.** Describe what the system *does* in terms a product owner understands. Citations are supporting evidence — in parentheses at breadth, inline at detail. Never paste raw `.domain` blocks unless the user asks for the syntax.
3. **Read-only.** The dialogue skill never modifies files. Direct the user to `domain` to create/modify models, or `spec` to formalize changes.
4. **Concision by default.** Answer at the minimum depth the question calls for. Never dump adjacent information the user didn't ask about.
5. **Never dead-end.** Every response ends with follow-up offers (Test 4).

---

## Conversation Example

The following shows how the 4 tests produce different responses to a sequence of questions on the Orders domain.

**Turn 1 — "How does the Order lifecycle work?"**

> Tests: (1) Entity node → Order. (2) "lifecycle" → Transverse. (3) All in model. (4) Offer: failure cases, cancellation rules, payment dependency.

> An Order moves through 5 states: `draft` → `confirmed` → `shipped` → `delivered`, with `cancelled` as an exit from draft or confirmed.
>
> The state machine `OrderLifecycle` defines:
> - A new order starts in draft when placed ("Place a new order"). Preconditions require an active customer and at least one line.
> - Confirmation requires a captured payment ("Confirm an order after payment").
> - Shipping requires a shipping address ("Ship a confirmed order").
> - Delivery closes the lifecycle ("Deliver a shipped order") — `delivered` is a final state.
> - Cancellation is only possible before shipping ("Cancel an order") and triggers stock restoration via `StockService.restock`.
>
> Want to explore:
> - What happens if the payment fails before confirmation?
> - The cancellation preconditions in detail?
> - How Payment and Order depend on each other across their lifecycles?

**Turn 2 — "What happens if the payment fails?"**

> Tests: (1) Drilling from Order lifecycle → Payment, still in Orders context. (2) "What happens if" → Detail. (3) In model + out of model. (4) Offer: retry limits, order timeout.

> **[IN MODEL]** When a payment fails, the "Handle payment failure" operation sets `Payment { status = failed }`, calls `NotificationService.notifyCustomer` to alert the customer, and allows a retry with a different method. Meanwhile, the Order stays in draft — the "Confirm an order" operation has a precondition `paymentCaptured` requiring `Payment.status = captured`, so confirmation is blocked until a successful payment.
>
> **[OUT OF MODEL]** The model doesn't specify a maximum number of retries or a timeout after which the draft order would be cancelled automatically. No temporal event exists for payment expiration.
>
> Want to dig into the payment processing preconditions, or explore what other states block order progression?

**Turn 3 — "We should allow cancellation after shipping"**

> Tests: (1) Still on Order. (2) Challenge → Confrontation. (3) Contradiction found. (4) Offer: spec skill, return flow.

> ### Contradiction with precondition orderCancellable
>
> **The model says:**
> `precondition orderCancellable :: "Order must be in a cancellable status" { Order.status in {draft, confirmed} } rejects "Order cannot be cancelled"`
>
> **Your proposition:** Allow cancellation when the order is already shipped.
>
> **Analysis:** Today, cancellation is restricted to draft and confirmed orders. Extending to shipped raises three questions: stock was already dispatched (the operation calls `StockService.restock`), a refund would need sequencing with the payment operation, and [OUT OF MODEL] no return flow exists for shipped goods. The `OrderLifecycle` state machine has no `shipped → cancelled` transition.
>
> Additionally, if a `LateDeliveryAlert` reaction triggers on `DeliveryOverdue` events for shipped orders, cancellation could conflict with that reactive flow.
>
> **To go further:** Use the `spec` skill to formalize this change and see its full impact.

---

## Edge Cases

### Empty or Partial Models

If no `.domain` files exist, direct to the `distill` skill:
```
No Specy models found in specy/. Run the `distill` skill first to extract
models from your codebase, then come back to explore them.
```

### Ambiguous Names

If the same name appears in multiple bounded contexts (e.g., `Order` in both Orders and Fulfillment contexts), always ask the user to clarify which context they mean before answering.

### Questions Outside the Domain

If the user asks about a concept that does not exist in any loaded model, respond with [OUT OF MODEL]:
```
[OUT OF MODEL] The model does not contain any reference to "{concept}". This may be
outside the scope of the modeled domain(s), or it may not have been extracted yet.
```

### Potentially Outdated Models

If `specy/.meta.json` exists:
- Check the `lastRun` timestamp. If it is significantly in the past, mention it:
  ```
  Note: the models were last extracted on {date}. The source code may have evolved
  since then. Consider running `distill` to refresh the models.
  ```
- If the `gitSha` does not match the current HEAD (when detectable), flag it as well.

### Circular References

If a question leads to a circular reference in the model (e.g., entity A references entity B which references entity A), trace the cycle explicitly and present it as a finding, not an error.

### V2 Format Detection

If the scanned files use v2 syntax (flat `module`/`uses module` without `organization`/`context` wrapper, `identifier` instead of `identity`, `transitions {}` instead of `states { machine }`), mention that the models appear to use an older format and suggest running `distill` to upgrade them to v3.

---

## Construct Reference

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
| reaction call | `reaction identifier(args)` | References a named reaction (precondition). |

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

### Reaction (reactive rule)

A `reaction` is a reactive rule: it listens to events and issues commands in response. This is NOT a precondition (preconditions are clauses on operations).

#### Skeleton

```
reaction Name :: "description" {
    trigger EventType
    guard { expression }
    effect CommandType
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Trigger | One or more event types that activate the reaction. |
| Guard | Optional condition — reaction fires only when guard is true. |
| Effect | The command to issue when the reaction fires. |
| Distinction | Reactions react to events. Preconditions guard operations. Invariants assert properties. |

#### Example

```
reaction LateDeliveryAlert :: "Alert when delivery is overdue" {
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
