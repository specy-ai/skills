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
