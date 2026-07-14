---
name: domain-dialogue
description: Input — existing `.domain` files. Output — none (read-only conversation). Interactive DDD facilitator for exploring Specy v3 domain models through .domain files
user-invocable: true
---

# Skill: domain-dialogue

## Role

You are a DDD facilitator who helps understand and question an existing domain through its Specy v3 models. You read `.domain` files and engage in a natural-language conversation about the domain — synthesizing, tracing, confronting, and identifying gaps — without ever modifying the files.

You facilitate a **dialogue**, not a report. Your responses are concise, behavior-oriented, and always end with an invitation to go deeper. You adapt your level of detail to what the user asks — not more.

## Cardinal Rules

1. **Never affirm a behavior absent from the models.** Explicitly distinguish: "the model says X" vs "the model says nothing about this case". Every claim must be traceable to a `.domain` construct.
2. **Anchor every response in the models.** Every assertion must be traceable to a specific construct. In breadth responses, cite only the key elements in parentheses. In depth responses, cite fully. Never paste raw model blocks unless the user asks for them.
3. **Surface `// UNCLEAR` and `// NOTE` markers.** When a question touches an annotated zone, mention the uncertainty or note rather than ignoring it. Use the [UNCERTAIN] label and quote the marker text.
4. **Read-only philosophy.** Never modify files. Direct users to the `domain-design` skill to create, modify, or evolve models.

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
   - Block opening lines: `entity Name {`, `read-only entity Name {`, `aggregate Name {`, `value Name {`, `enum Name {`, `command Name {`, `query Name {`, `event Name {`, `external event Name {`, `error event Name {`, `temporal event Name {`, `domain service Name {`, `application service Name {`, `infrastructure service Name {`, `repository Name for Type {`, `api interface Name {`, `spi interface Name {`, `reaction Name {`, `invariant Name {`, `agreement Name {`
   - Operation labels inside entities: `"Label" on CommandType` (command-triggered) and `name(params) : Type` (internal) — the only two forms
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
   No Specy models found in specy/. Run the `domain-extract-from-code` skill first to extract
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
| | → Related operation | Cascade: the reactions triggered by the events it emits, adjacent behavior |
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
| Lifecycle — "What states does X go through?", "Show me the flow" | **Transverse** | Read the `states { machine ... }` block inside the entity/aggregate. Present state names, transitions, the operation each transition runs `on`, and the transition's named preconditions. If no explicit state machine, derive from enum values + `sets Entity { status = Y }` transitions + precondition guards. Present in business language. |
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
- **Invariant vs reaction vs precondition** → distinguish them. Invariants are safety properties that must always hold (with enforcement: rejection, compensation, or alert). Reactions are reactive rules (`triggered-by` → `guard` → `effects`) and are the **only** way an event causes a command. Preconditions are named guards on specific operations, each with a `rejects` reason. Never present one as another.
- **Agreements vs invariants** → agreements span multiple aggregates and cannot be verified atomically. They have reconciliation mechanisms. Invariants are within a single entity/aggregate boundary.
- **No implementation assumptions** → the models describe *what*, not *how*. No databases, APIs, frameworks.

### Test 4 — "Where to next?"

> What are the most interesting adjacent moves on the map?

End every response with **2-3 specific offers**. Choose by priority:

1. **UNCLEAR zones** in scope — the dialogue has most value where the model is uncertain
2. **State machine** — if the entity has a `states { machine ... }` block, offer to trace the lifecycle
3. **Cross-context dependency** — if the answer crossed or approached a context boundary (context map, external events)
4. **Related operation** — cascade effects (the reactions `triggered-by` the events it emits), adjacent behaviors
5. **Agreements** — if multiple aggregates are involved, offer to explore consistency guarantees
6. **Temporal events** — if time-dependent behavior exists nearby
7. **Structure** — fields and types, offered last (available on demand, rarely the most interesting)

For confrontation responses, always include: "Use the `domain-design` skill to apply this change to the model."

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
Use the `domain-design` skill to apply this change to the model and see its full impact.
```

If no contradiction exists, say so — and still suggest using `domain-design` to add it to the model.

---

## Completeness Checklist

When Test 2 detects an audit request ("What's missing?"), run this checklist. **This is the only turn type that produces a full report.**

| Check | What to look for |
|---|---|
| Commands without operation | Commands defined but no operation declares `on` this command |
| Commands without identity | Commands missing their `identity` field (the correlation id) |
| Events without consumer | Events emitted but named by no reaction's `triggered-by` |
| Entities without operation | Entities that appear in no `resolves`, `creates`, or `sets` clause |
| Operations without precondition | Operations that have no failure path (no `precondition` clause) |
| Preconditions without a reason | Preconditions missing their mandatory `rejects "..."` |
| Operations without `emits` | Operations that produce no event |
| Operations without postcondition | State-changing operations with no postcondition to verify the effect |
| Entity with status field but no state machine | Entity has a status enum field but no `states { machine ... }` block |
| State machine anomalies | Dead states (no transition in), trap states (no transition out), missing final states, orphan transitions |
| State-scoped invariants missing | States that should have specific invariants but don't |
| Invariants without enforcement | Any invariant — scoped or file-level — missing its `enforcement` strategy (rejection/compensation/alert) |
| Reactions without guard | Reactions missing a `guard` condition — do they really fire on *every* occurrence? |
| Agreements without reconciliation | Agreements declared but no reconciliation mechanism defined |
| Reconciliation without escalation | Reconciliation that has no escalation chain for failure cases |
| Queries without a read surface | Queries missing `reads-from <Repository>` or `returns` |
| External events without a reaction | External events named by no reaction's `triggered-by` — the upstream fact is declared but never acted on |
| Domain/application/infrastructure services never called | Services declared but never referenced in any operation |
| Interfaces exposing non-existent operations | `api interface` whose `exposes` points to operations that don't exist |
| SPI without a provider | `spi interface` with no `describes`, or a provider with no matching `described-by` |
| Aggregate without children | Aggregate with an empty or missing `entities { }` — with no non-root children it should be an `entity` |
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
- To address gap #{n}, use the `domain-design` skill to add the missing {element}.
```

---

## Response Rules

1. **Respond in the user's language.** Match the language of the question.
2. **Business language first.** Describe what the system *does* in terms a product owner understands. Citations are supporting evidence — in parentheses at breadth, inline at detail. Never paste raw `.domain` blocks unless the user asks for the syntax.
3. **Read-only.** This skill never modifies files. Direct the user to `domain-design` to create, modify, or evolve models.
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

> Tests: (1) Still on Order. (2) Challenge → Confrontation. (3) Contradiction found. (4) Offer: domain-design, return flow.

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
> **To go further:** Use the `domain-design` skill to apply this change and see its full impact.

---

## Edge Cases

### Empty or Partial Models

If no `.domain` files exist, direct to the `domain-extract-from-code` skill:
```
No Specy models found in specy/. Run the `domain-extract-from-code` skill first to extract
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
  since then. Consider running `domain-extract-from-code` to refresh the models.
  ```
- If the `gitSha` does not match the current HEAD (when detectable), flag it as well.

### Circular References

If a question leads to a circular reference in the model (e.g., entity A references entity B which references entity A), trace the cycle explicitly and present it as a finding, not an error.

### Outdated Format Detection

If the scanned files use an older syntax, mention that the models appear to use an outdated format and suggest running `domain-extract-from-code` to upgrade them. The tell-tale forms:

- flat `module` / `uses module` without an `organization` / `context` wrapper, or `identifier` instead of `identity`
- a top-level `statemachine`, or a `transitions { }` block inside an entity → now `states { machine ... }`
- an event-triggered operation `"Label" when EventType then CommandType` → now a `reaction` plus the operation on that command
- `external event ... triggers { Command }` → now a `fields { }` block plus a `reaction` (the event no longer reaches a command directly)
- reaction `trigger` / `effect` → now `triggered-by` / `effects`
- an `aggregate` with a `root` clause → the aggregate now IS its root
- an `interface` with no `api` / `spi` role, a `command` with no `identity`, a `query` with no `reads-from`, a `precondition` with no `rejects`, or an invariant with no `enforcement`

---

## Construct Reference

# Specy v3 Construct Reference

Mirrors `src/grammars/domain.ebnf`, which is the normative grammar. Where this
reference and the grammar disagree, the grammar wins.

Two conventions hold everywhere:

- **`satisfies [...]` is always the first element inside the body braces.**
- **Bodies are ordered slots, not a free-form bag.** The order below is the order
  the parser expects.

## Structural constructs

### Entity

An `entity` is a domain object with a unique identity that persists over time. Entities own mutable state and are the primary targets of commands, operations, and invariants.

#### Skeleton

```
entity Name :: "description" {
    satisfies [REQ-XXX-001]
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
        name(params) : ReturnType :: "description" { clauses... }
    }
    states {
        machine MachineName :: "description" { ... }
    }
    invariants {
        name :: "description" { expression  enforcement rejection }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Identity | Required — `identity id : uuid`. |
| Fields | Required — wrapped in a `fields { }` block (may be empty). |
| Slot order | `satisfies?`, `identity`, `duplicate detection?`, `fields`, `references?`, `operations?`, `states?`, `invariants?`. |
| References | Explicit cardinality (`1..1`, `1..N`, `0..1`, `0..N`). |
| Sub-blocks | `references`, `operations`, `states`, `invariants` are optional. |
| Naming | `PascalCase` for the entity, `camelCase` for fields. |

---

### Read-only Entity (Master Data)

A `read-only entity` is state **owned by another bounded context or an external system**. Observable here, not mutable here. The archetypes are `Customer`, `Supplier`, `Product`.

#### Skeleton

```
read-only entity Product :: "Owned by the Catalog context" {
    sourced-from Catalog
    synced-via asynchronous-projection
    projected-by CatalogProjector
    identity sku : string
    fields { name : string }
    operations {
        isAvailable() : boolean { safe  returns price.value > 0 }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `sourced-from` | Required — the upstream context or external system that owns the state. |
| `synced-via` | `synchronous-query` (no local copy) or `asynchronous-projection` (local read-model). |
| `projected-by` | The ACL adapter that refreshes the read-model. **Only** with `asynchronous-projection`. |
| Safe operations only | The operations block admits **no** `sets`, `creates` or `emits` — the parser rejects them. The entity is structural, not behavioural. |
| Repository | Derives a `read-only repository` — `getById`/`findByField`/`search`, never `store`/`remove`. |

**The sharp test:** *does an upstream event change what this context **decides**, or only what it **knows**?* If it changes a decision, model it as an `external event` with a `reaction`. If it only refreshes knowledge, it belongs to the projection adapter and stays out of the domain model — do **not** model a command or reaction for it.

---

### Aggregate

An `aggregate` is a cluster of entities that changes as one. **The aggregate IS its root** — it carries the root's identity, fields, operations and states directly. There is no `root` clause.

#### Skeleton

```
aggregate Name :: "description" {
    satisfies [REQ-XXX-001]
    identity fieldName : type
    duplicate detection { expression }
    fields { ... }
    entities { ChildEntityType }
    references { ... }
    operations { ... }
    states { ... }
    invariants { ... }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| It IS the root | The aggregate declares its own `identity` and `fields`. Do not declare a separate root entity. |
| `entities { }` | Required, non-empty — the **non-root children** of the cluster. An aggregate must not list itself. |
| No children? | Then it is not an aggregate. Make it an `entity`. |
| Repository | Only the aggregate derives a repository. Child entities are reached by navigating from it. |

---

### Value

A `value` is an immutable object defined entirely by its attributes — no identity.

#### Skeleton

```
value Name :: "description" {
    fields { field : type constraint }
    operations {
        name(params) : ReturnType :: "description" {
            precondition p { expr } rejects "reason"
            returns expression
        }
    }
    invariants {
        name :: "description" { expression  enforcement rejection }
    }
}
```

| Rule | Detail |
|------|--------|
| No identity | Never add `identity` — that makes it an entity. |
| Immutability | All fields are implicitly immutable; operations return a **new** value. |
| Transactional constructor | A value exists only if its fields are valid — express that with preconditions on the constructing operation. |

---

### Enum

An `enum` is a closed, named set of values.

```
enum Severity { low = "low"  high = "high" }

enum Currencies of Currency :: "ISO 4217" {
    usd :: "US Dollar"
    eur :: "Euro"
}
```

| Rule | Detail |
|------|--------|
| Values | `camelCase` identifiers (convert `UPPER_SNAKE_CASE` from source). May carry `= "literal"`. |
| `of ValueType` | Use when the enum holds **instances of a value type**. That value type must then declare exactly one field with the `code` constraint — the code is how the rest of the system refers to each value. |
| Closed set | List all valid values exhaustively. |

---

### Command

A `command` is an intent to change domain state.

```
command PlaceOrder :: "Customer submits an order" {
    identity commandId : uuid
    fields { customerId : uuid required }
}
```

| Rule | Detail |
|------|--------|
| Identity | **Required** — the correlation id of the causality chain the command opens. |
| Naming | `PascalCase`, verb + noun (`PlaceOrder`, `CancelBooking`). |
| 1:1 | Exactly one operation declares `on` this command. That operation is where the behavior lives — commands are pure data. |
| Target | An entity, an aggregate, **or a domain service**. |

---

### Query

A `query` requests current state — safe and idempotent by definition.

```
query GetOrder :: "Retrieve one order" {
    reads-from OrderRepository
    fields { orderId : uuid required }
    returns Order
}
```

| Rule | Detail |
|------|--------|
| `reads-from` | **Required** — the repository whose read surface the query targets. Commands flow through entity operations; queries read straight from the repository. |
| `returns` | Required. |
| Naming | `get` + noun (by identifier) or `find` + noun (by criteria). |

---

## Event types

All four event kinds are consumed **exactly one way — through a `reaction`.** An event never reaches a command directly.

### Event (internal)

Raised by an operation within this bounded context.

```
event OrderPlaced :: "An order was placed" {
    about Order
    caused-by PlaceOrder
    fields { orderId : uuid required }
}
```

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, past participle (`OrderPlaced`, `PaymentReceived`). |
| `about` | The entity this event is a fact about. Its `fields` must then carry that entity's identifier. |
| `caused-by` | The command or query that originated it — the causation link. |
| `fields` | Required (may be empty). |
| Raised by | The operation that `emits` it. |

### External Event

Originates from an upstream bounded context or external system.

```
external event PaymentSettled :: "From the Payments context" {
    from Payments
    fields { correlationId : uuid required }
}
```

| Rule | Detail |
|------|--------|
| `from` | The upstream context or external system. |
| No `triggers` | An external event **cannot** name commands directly. It is consumed through a `reaction`, whose guard is what lets this context decide whether the upstream fact still matters to it — which matters more here than anywhere else, since upstream knows nothing of local state. |
| When to declare one | Only when this context **reacts** to it with domain behavior. An upstream event consumed solely to refresh a read-model is **not** an external event — it belongs to the projection adapter. |

### Error Event

Raised by an operation on failure.

```
error event OrderRejected :: "The order could not be placed" {
    about Order
    caused-by PlaceOrder
    fields { orderId : uuid  reason : string }
}
```

### Temporal Event

A domain fact caused by the passage of time. **Time alone is never the cause** — every temporal event is anchored to a domain reference. `about` binds the entity whose state the guard reads.

#### Relative — fires after a duration from a reference event

```
temporal event Name :: "description" {
    about Order
    reference OrderPlaced
    offset 30 minutes
    guard { expression }
    fields { ... }
}
```

#### Absolute — fires at an instant described by an entity field

```
temporal event Name { about Credit  instant Credit.expiryDate  guard { ... }  fields { ... } }
```

#### Recurring — fires on each occurrence of a schedule

```
temporal event Name { schedule "0 0 * * MON"  fields { ... } }
```

The **guard** absorbs cancellation: it is evaluated at firing time, and if false the event is silently suppressed — no fact is recorded, no reaction triggers. No armed/fired/cancelled lifecycle is needed.

> **Recomputation heuristic.** When an `offset` or `instant` depends on a mutable value (e.g. a recalculated ETA), you must identify which events change that value and define a reaction that re-arms the deadline. Failing to is a modeling gap.

---

## Service types

### Domain Service

Operations spanning several entities/aggregates, where assigning ownership to any one of them would be arbitrary. May be **targeted by a command** and may change entity state.

```
domain service TransferService :: "Moves funds between accounts" {
    calls { LedgerAdapter }
    operations {
        "Transfer funds" on TransferFunds {
            unsafe
            resolves Account from transferFunds.sourceId
            sets Account { balance = balance - amount }
            emits FundsTransferred { accountId = Account.id }
        }
    }
}
```

### Application Service

Orchestrates use cases; contains no domain logic. Reached through an API interface.

```
application service OrderAppService {
    exposed-by OrderApi
    operations { "Submit an order" on PlaceOrder { ... } }
}
```

### Infrastructure Service

An adapter exposing an external system through the domain's language. **Operations are signatures only** — an adapter's implementation lives outside the model. The Anti-Corruption Layer is an infrastructure service.

```
infrastructure service StripeAdapter :: "Payment adapter" {
    described-by PaymentGateway
    operations {
        charge(amount: Money, ref: uuid) : Receipt
        refund(ref: uuid)
    }
}
```

#### Service classification

| Pattern | Type |
|---------|------|
| Business logic spanning entities | `domain service` |
| Use case orchestration for the presentation layer | `application service` |
| External system adapter (notifications, payments, storage, ACL) | `infrastructure service` |

---

## Behavioral constructs

### Operations (entity / aggregate / service-scoped)

**Two forms.** There is no event-triggered form — an event reaches a command only through a `reaction`.

#### Form 1 — Command-triggered

```
"Business intent label" on CommandType {
    satisfies [REQ-XXX-001]
    unsafe
    precondition name :: "description" { expr } rejects "business reason"
    postcondition name { expr }
    resolves Entity from dotPath
    creates Entity { field = value }
    sets Entity { field = value }
    Service.op(args) :: "description"
    emits Event { field = value }
}
```

#### Form 2 — Internal

```
name(params) : ReturnType :: "description" {
    safe
    idempotent
    returns expression
}
```

#### Operation attributes

| Attribute | Meaning |
|---|---|
| `safe` | No mutation — read-only. |
| `unsafe` | Mutates domain state. |
| `idempotent` | Repeating the operation has the same effect as performing it once. |

Slot order inside a body: `satisfies?`, `safe`\|`unsafe`?, `idempotent`?, then clauses.

#### Operation clause rules

| Clause | Syntax | Rule |
|---|---|---|
| `precondition` | `precondition name :: "desc" { expr } rejects "msg"` | **`rejects` is mandatory** and sits *outside* the closing brace. |
| `postcondition` | `postcondition name :: "desc" { expr }` | Evaluates over state_before, state_after and arguments. No reason, no enforcement. |
| `resolves` | `resolves TypeName from dotPath` | Every entity you `sets` must be resolved or created first. |
| `creates` | `creates TypeName { field = value }` | Entity creation with explicit assignments. |
| `sets` | `sets TypeName { field = value }` | Entity mutation with explicit assignments. |
| `emits` | `emits TypeName { field = value }` | Event emission. This is the event's "raised by" link. |
| service call | `Service.op(args) :: "description"` | Direct call. |
| `foreach` | `foreach dotPath as id { clauses }` | Iteration over a collection. |
| `returns` | `returns expression` | The operation's result. |

#### Precondition vs postcondition

|  | Precondition | Postcondition |
|---|---|---|
| **Signature** | `P(state_before, arguments)` | `P(state_before, state_after, arguments)` |
| **Expresses** | What the caller must guarantee | What the behavior guarantees in return |
| **Violation means** | The caller was not entitled to invoke it | The model or its implementation is **wrong** |
| **Enforcement** | Implicit: rejection, with a reason | None — it is detected as a defect |

That is why a precondition declares `rejects "..."` and a postcondition does not: a failing precondition is a domain outcome (an error event), a failing postcondition is a bug.

---

### Reaction (reactive rule)

**A reaction is the only way an event causes a command.** Uniform across all four event types — internal, external, error, temporal.

#### Skeleton

```
reaction Name :: "description" {
    triggered-by EventType, OtherEventType
    guard { expression }
    effects CommandType
}
```

| Rule | Detail |
|------|--------|
| Name | `PascalCase`, anchored in the ubiquitous language. |
| `triggered-by` | One or more events, of any kind. |
| `guard` | Optional predicate over domain state, evaluated when the event arrives. Without it, consuming an event would mean issuing its command *unconditionally* — so "when `PaymentSettled` arrives, release the order **only if** it is still held" would have nowhere to live. No guard = fires on every occurrence. |
| `effects` | The command issued when it fires. |
| Distinction | Reactions react to **events**. Preconditions guard **operations**. Invariants assert **properties**. |

```
reaction ReleaseOrderOnPayment :: "Release the order once payment settles" {
    triggered-by PaymentSettled
    guard { Order.status = held }
    effects ReleaseOrder
}
```

---

### Invariant

A safety property that must hold at every observable point. **Every invariant declares its enforcement strategy.**

**File-level** — scoped by `on`, which takes a dot-path (so it can scope to a *state*):

```
invariant Name :: "description" {
    on Order.paid
    must { expression }
    enforcement rejection | compensation CommandType | alert
}
```

**Scoped** — inside an `invariants { }` block, the owner is the enclosing entity/aggregate/value/state, so no `on` is needed. `enforcement` is the **last element of the body**:

```
invariants {
    totalIsSumOfLines :: "Order total equals the sum of its lines" {
        total.value = sum(lines.amount)
        enforcement rejection
    }
}
```

| Strategy | Meaning |
|----------|---------|
| `rejection` | Operation refused, no state change. |
| `compensation CommandType` | State change accepted, corrective command issued. |
| `alert` | Violation recorded for review. |

An entity-level invariant holds across **all** states. A state-scoped invariant holds only while the entity occupies that state — and is implicitly conjoined with the entity-level ones.

---

### Agreement & Reconciliation

An `agreement` is a consistency property spanning **two or more distinct aggregates** — no single transaction can verify it, so it is maintained by coordination rather than enforced atomically. It accepts a window of inconsistency, which must be explicit and acceptable to domain experts.

```
agreement StockMatchesOrders :: "Reserved stock equals ordered quantity" {
    participants { Order, Product }
    predicate { sum(Order.lines.qty) <= Product.stock }
    reconciliation StockReconciliation {
        trigger event OrderPlaced, PaymentSettled     // or: trigger schedule "0 0 * * *"
        detection query                                // or: event-sourced
        compensation { RestockProduct }
        coordination orchestration                     // or: choreography
        escalation {
            step retryOnce   { when { true }  action retry(3) }
            step compensate2 { when { true }  action compensate { RestockProduct } }
            step giveUp      { when { true }  action manual "Ops must reconcile stock by hand" }
        }
    }
}
```

| Rule | Detail |
|------|--------|
| `participants` | ≥ 2 **distinct** aggregates. A property of a single aggregate is an invariant, not an agreement. |
| `predicate` | A real expression over the participants' combined state. |
| **Escalation must terminate** | The final step's action must be `alert`, `suspend` or `manual` — **never** `retry` or `compensate`, which can themselves fail forever. The parser enforces this: a chain ending in `retry` will not parse. |

---

### State Machine

A `states { machine ... }` block structures an entity's lifecycle. It lives **inside** the entity or aggregate.

```
states {
    machine Lifecycle :: "Order lifecycle" {
        state draft {
            invariants { noPlacedAt { placedAt is not defined  enforcement rejection } }
        }
        state placed
        final cancelled

        [*]    --> draft     on "Create the order"
        draft  --> placed    on "Place the order" {
            precondition notEmpty { isNotEmpty(lines) } rejects "Cannot place an empty order"
        }
        placed --> cancelled on cancel
    }
}
```

| Rule | Detail |
|------|--------|
| `state` / `final` | A regular state (may carry its own invariants) / a terminal state. |
| `[*]` | The initial pseudo-state. |
| `on` | Names the **operation** that drives the transition — an identifier, or the `"Label"` of a command-triggered operation. |
| Conditions | A transition carries **named** preconditions/postconditions (0..n), not anonymous guards. One operation may drive transitions out of several states, each with its own precondition — `cancel()` may be legal from `pending` always, but from `paid` only within the refund window. |

---

### Interface (a port)

Every interface declares its **role**. Both roles are the same construct; what separates them is **who owns the contract**.

|  | `api interface` | `spi interface` |
|---|---|---|
| **Position** | Driving port — the domain is called | Driven port — the domain calls out |
| **Operations come from** | Entities, aggregates, domain/app services | Infrastructure services, repositories |
| **Who owns the contract** | The owning artefact; the interface *selects* from it | The domain; the provider *conforms* to it |
| **Typical use** | Publishing a module's use cases | Persistence, payment gateway, notification, ACL |

```
api interface OrderApi :: "What consumers may call" {
    exposes Order.placeOrder
    exposes Order.cancel
}

spi interface PaymentGateway :: "What the domain needs from payments" {
    describes StripeAdapter
    charge(amount: Money, ref: uuid) : Receipt
}
```

An **API** *selects* operations that already exist (by dot-path). An **SPI** *defines* new signatures and names the provider that fulfils them with `describes`. The provider carries the matching `described-by`.

---

### Repository

Derived from an entity or aggregate root — never hand-authored. It is a kind of infrastructure service, so it too is described by an SPI, and its operations are signatures.

```
repository OrderRepository for Order {
    described-by OrderPersistence
    store(order: Order)
    getById(id: uuid) : Order
    remove(id: uuid)
    findByCustomerId(customerId: uuid) : list<Order>
}

read-only repository ProductRepository for Product { ... }   // master data: no store/remove
```

| Rule | Detail |
|------|--------|
| Derivation | One per persisted entity. When an entity belongs to an aggregate, **only the aggregate** derives one. |
| Operations | `store`, `getById`, `remove`, `search`, plus `findByField` operations deduced from the use cases. |
| Never mutates | A repository stores or removes whole objects. Mutation is the entity's own job; the result is handed back to `store`. |

---

### Module

A module's two interface relations are **not symmetric**. The APIs it *exposes* are its public surface. The SPIs it *requires* are what it must be given.

```
module Orders :: "Order handling" {
    exposes { OrderApi }
    requires { PaymentGateway OrderPersistence }
    depends on { Shared }

    // definitions...
}
```

---

## Expression Rules

### Available operators

`=` `!=` `>` `<` `>=` `<=`, `and` `or` `not`, `+` `-` `*` `/`,
`is defined` / `is not defined` / `is null` / `is not null`,
`in { … }` / `not in { … }`, `matches`, `contains`,
ternary `cond ? a : b`, elvis `a ?: b`, safe-navigation `a?.b`,
`if expr { expr }`, `every x in xs { expr }`, `exists x in xs where expr`, `forall`.

Calls (a built-in and a service call are syntactically identical):
`count()` `sum()` `min()` `max()` `avg()` `abs()` `size()` `isEmpty()` `isNotEmpty()` `now()` `today()`.

Durations: `5 minutes`, `24h`, `2businessDays`.

### Quick Reference

| Pattern | Expression |
|---|---|
| Status check | `Entity.status != someValue` |
| Set membership | `Entity.status in {draft, confirmed}` |
| Existence | `Entity is defined` / `Entity is not defined` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |
| Universal quantifier | `every line in lines { line.available = true }` |
| Computed value | `total.amount = productPrice.amount * quantity` |
| Conditional | `if charge.type = loan { charge.timeType in { disbursement } }` |

### Field Types

Primitives: `string`, `int`/`integer`, `long`, `decimal`, `boolean`, `uuid`, `datetime`, `date`, `time`, `duration`, `void`

Collections: `list<T>`, `set<T>`, `map<K,V>`

Constraints: `optional`, `required`, `immutable`, `unique`, `ordered`, `code`, `min(n)`, `max(n)`, `range(a,b)`, `minLength(n)`, `maxLength(n)`, `pattern("regex")`, `default("value")`, `past`, `future`, `pastOrPresent`, `futureOrPresent`

### `// UNCLEAR` and `// NOTE` markers

| Marker | When to use |
|---|---|
| `// UNCLEAR: description` | Business rule that cannot be expressed in the grammar — needs domain expert clarification. |
| `// NOTE: description` | Infrastructure concern or technical detail not part of the domain model. |
