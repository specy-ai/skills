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
  then "side effect in business language"
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
| `then` | Irreducibly narrative side effects not expressible with `sets`/`emits`/`triggers`. |
| `sets` | Target dot-path must be reachable from an entity in `resolves` or `creates`. Cross-aggregate targets (via dot-path navigation) are allowed. Use `::` justification on cross-aggregate mutations where the business reason is not obvious. |
| `foreach` | Iterates over a `list<T>` field. Body allows `sets`, `emits`, `fails`, `then`, `triggers notification`, `triggers Context.Command`. The alias can be used as the root of dot-paths inside the body. |
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
- Body allows: `sets`, `emits`, `fails`, `then` — same constructs as an interaction body (minus `resolves`, `creates`, `delegates`, `foreach`).
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
- If the target context's `.struct` is not available, fall back to `then "description"` with `// NOTE: cross-context trigger — target .struct not yet extracted`.
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
    then "business logic description"
    emits Event
  }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Scope | One service block per service class/interface. |
| Operations | One operation per public method with business logic. |
| `then` | Use for logic that cannot be captured structurally. |
| Exclusion | Do not create services for pure infrastructure (password hashing, image processing, logging, caching). Use `// NOTE` instead. |
| Decision criterion | If the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service. |

#### Example

```
service PricingCalculator {
  operation computeTotal {
    accepts lines : list<OrderLine>
    returns decimal
    then "Applies volume discounts and tax calculations"
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
| Operations | Contain only `accepts` and `returns` — never `then`, `fails`, `sets`, `emits`. |
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

A `policy` block models a cross-cutting domain rule spanning multiple operations.

#### Skeleton

```
policy Name {
  when { expression }
  then "consequence in business language"
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `when` | Must be a real, evaluable boolean expression — never a tautology, never empty (apply Test 3). |
| Empty guard | **Never emit a policy block with an empty or commented-out `when`.** If the condition cannot be expressed, use an inline `// UNCLEAR` comment instead. |
| Scope | If the rule applies to only one command handler, use `fails` in the interaction instead. |
| Infrastructure | If the real condition is infrastructure → `// NOTE`. |

#### Example

```
policy MaxOrderAmount {
  when {
    Order.totalAmount.amount > 10000
  }
  then "Orders above 10000 require manual approval before confirmation"
}
```

---

### Invariant

An `invariant` block models a structural constraint that must always be true for an entity.

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
