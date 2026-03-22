# Specy v2 Construct Reference

## Structural constructs

### Entity

An `entity` is a domain object with a unique identity that persists over time. Entities are aggregate roots or members of an aggregate — they own mutable state and are the primary targets of commands, operations, and invariants.

#### Skeleton

```
entity Name :: "justification" {
    identifier fieldName : type
    fields {
        field : type constraint
    }
    references {
        fieldName : TypeName cardinality
    }
    policies {
        name(params) :: "justification" { expression }
    }
    invariants {
        name :: "justification" { expression }
    }
    operations {
        "Label" on CommandType { clauses... }
        "Label" when EventType then CommandType { clauses... }
        name(params) :: "justification" { clauses... }
    }
    transitions {
        [*] --> state on "label"
        state --> state on "label"
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Identity | Must have an `identifier` declaration (e.g., `identifier id : UUID`). Replaces the v1 `id : uuid unique immutable` convention. |
| Justification | Optional `:: "justification"` after the entity name describes the entity's purpose. |
| Fields | Wrapped in a `fields { }` block. Apply domain constraints directly on fields (`min`, `max`, `optional`, `default`, etc.). |
| References | Declared in a separate `references { }` block with explicit cardinality (`1..1`, `1..N`). |
| Sub-blocks | `references`, `policies`, `invariants`, `operations`, and `transitions` are all optional. `identifier` and `fields` are required. |
| Naming | `PascalCase` for the entity name, `camelCase` for field names. |

#### Example

```
entity Order :: "A customer order" {
    identifier id: UUID
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
    transitions { ... }
}
```

---

### Value

A `value` is an immutable object defined entirely by its attributes — it has no identity. Two values with the same fields are considered equal. In v2, values can contain an `invariants` block to express self-consistency rules.

#### Skeleton

```
value Name {
    fields {
        field : type constraint
    }
    invariants {
        name :: "justification" { expression }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| No identity | Never add an `identifier` — that makes it an entity. |
| Immutability | All fields are implicitly immutable. |
| Fields block | Fields are wrapped in a `fields { }` block. |
| Invariants | Optional `invariants { }` block for self-consistency rules on value fields. |
| Composability | Values can be embedded inside entities, other values, commands, and events. |
| Naming | `PascalCase` for the value name, `camelCase` for field names. |

#### Example

```
value OrderLine {
    fields {
        productId : uuid
        quantity : int required min(1) max(1000)
        productPrice : Money
        total : Money
    }

    invariants {
        positiveQuantity :: "Order line quantity must be greater than zero" {
            quantity > 0
        }
        lineTotalConsistency :: "Line total must equal unit price multiplied by quantity" {
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
    value3
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Values | `camelCase` identifiers — convert `UPPER_SNAKE_CASE` from source code. |
| Closed set | All valid values must be listed exhaustively. |
| No fields | Enum values have no associated data — use a value object if data is needed. |
| Referenced by | Entities, values, commands, and events reference enums as field types. |

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

A `command` represents an intent to change the state of the domain. Each command triggers exactly one operation inside an entity.

#### Skeleton

```
command Name {
    fields {
        field : type constraint
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, verb-noun form (e.g., `PlaceOrder`, `CancelOrder`). |
| Fields block | Fields are wrapped in a `fields { }` block. Carry the data needed to fulfill the intent. |
| 1:1 mapping | Exactly one entity operation must declare `on` this command. |
| No behavior | Commands are pure data — behavior lives in the entity operation. |

#### Example

```
command CancelOrder {
    fields {
        orderId : uuid
        reason : string optional maxLength(500)
    }
}
```

---

### Event

An `event` signals that something has happened in the domain. Events are emitted by operations and can trigger zero or more reactive operations.

#### Skeleton

```
event Name {
    fields {
        field : type
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Naming | `PascalCase`, past-tense (e.g., `OrderPlaced`, `OrderCancelled`). |
| Fields block | Fields are wrapped in a `fields { }` block. Carry the facts of what happened. |
| 0:N mapping | Zero or more operations may declare `when` this event. |
| Immutable | Events are facts — they cannot be modified after emission. |

#### Example

```
event OrderCancelled {
    fields {
        orderId : uuid
        lines : list<OrderLine>
        reason : string optional
        cancelledAt : datetime
    }
}
```

---

## Behavioral constructs

### Operations (entity-scoped)

Operations are defined inside an entity's `operations { }` block. They model command handlers, event reactors, and internal behaviors. There are three forms.

#### Form 1 — Command-triggered

Triggered by a command. Exactly one operation per command.

```
"Business intent label" on CommandType {
    clauses...
}
```

#### Form 2 — Event-triggered

Triggered by an event. Zero or more operations per event.

```
"Business intent label" when EventType then CommandType {
    clauses...
}
```

The `then CommandType` names the internal command that carries the event data into this handler.

#### Form 3 — Internal

A named operation callable from other operations or services. Not directly triggered by a command or event.

```
name(params) :: "justification" {
    clauses...
}
```

#### Operation clause rules

| Clause | Syntax | Rule |
|---|---|---|
| `resolves` | `resolves TypeName from dotPath` | Every entity you `sets` or reference must be resolved or created first. No more `via Repository.op` — resolution is direct. |
| policy call | `policy identifier(args)` | Replaces `fails when { }`. References a named policy — either file-level or entity-scoped. |
| `creates` | `creates TypeName { field = valueExpr ... }` | Entity creation with explicit field assignments. |
| `sets` | `sets TypeName { field = valueExpr ... }` | Entity mutation with explicit field assignments. Target must appear in `resolves` or `creates`. |
| `emits` | `emits TypeName { field = valueExpr ... }` | Event emission with explicit field assignments. |
| service call | `dotPath(args) :: "justification"` | Direct call to a service operation. Replaces `delegates`. Optional justification via `::`. |
| `foreach` | `foreach dotPath as identifier { clauses... }` | Iteration over a collection. Body allows: `resolves`, `sets`, `emits`, entity calls, service calls, policy calls. |

#### Resolution patterns

The `resolves` clause identifies which entity to load and from where. Two patterns:

**Direct — from command/event field:**

```
resolves Customer from placeOrder.customerId
resolves Order from cancelOrder.orderId
```

**Indirect — from already-resolved entity:**

```
resolves Payment from Order
```

| Situation | Pattern |
|---|---|
| Command/event carries the entity's ID | Direct |
| An already-resolved entity carries the reference | Indirect |

#### Example

```
"Place a new order" on PlaceOrder {
    resolves Customer from placeOrder.customerId

    policy customerMustBeActive(Customer)
    policy orderMustContainsLines(placeOrder.lines)
    policy productMustBeAvailable(placeOrder.lines)

    creates Order {
        status = draft
        customer = Customer
        shippingAddress = placeOrder.shippingAddress
        lines = placeOrder.lines
        placedAt = now()
        totalAmount = PricingCalculator.computeTotal(placeOrder.lines)
    }

    policy minimumOrderAmount(Order)
    policy maxOrderAmount(Order)

    emits OrderPlaced {
        orderId = Order.id
        totalAmount = Order.totalAmount
        placedAt = Order.placedAt
        customerId = Customer.id
    }
}
```

---

### Service

A `service` block models a stateless class/interface with business logic. Operations have typed parameters in their signature and an optional return type.

#### Skeleton

```
service Name {
    operations {
        opName(params) : returnType :: "justification" {
            foreach / resolves / entityCall / returns
        }
    }
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Operations block | All operations are wrapped in an `operations { }` block. |
| Signature | Typed parameters in parentheses. Optional return type after `)` with `:`. |
| Justification | Optional `:: "justification"` on the operation signature. |
| Body | Can contain `foreach`, `resolves`, entity calls (`Entity.op(args)`), and `returns`. |
| No accepts/returns | No more separate `accepts` / `returns` declarations — parameters and return type are in the signature. |
| Exclusion | Do not create services for pure infrastructure (password hashing, logging, caching). Use `// NOTE` instead. |

#### Example

```
service PricingCalculator {
    operations {
        computeTotal(lines: list<OrderLine>) :: "Compute total from order lines" {
            returns sum(lines.total)
        }
    }
}

service StockService {
    operations {
        restock(lines: list<OrderLine>): void :: "Restore stock for each cancelled order line" {
            foreach lines as line {
                resolves Product from line.productId
                Product.increase(line.quantity)
            }
        }
    }
}
```

---

### Policy

A `policy` models a precondition — a state requirement that must be true **before** an operation can proceed. Policies are called inline from operations via `policy name(args)`.

#### Two scopes

**File-level** — cross-entity concerns, uses the `policy` keyword:

```
policy name(params) :: "justification" {
    expression
}
```

**Entity-scoped** — inside an entity's `policies { }` block, NO `policy` keyword:

```
name(params) :: "justification" {
    expression
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Parameters | Explicit typed parameters — the policy receives the data it needs. |
| Justification | `:: "justification"` describes the business reason. |
| Expression body | The precondition expression directly — no more `must { }` / `message` wrappers. |
| Conditional expression | Use `if condition { expression }` for field-dependent validation rules (logical implication: holds when condition is false or when both condition and body are true). |
| Inline calls | Policies are called from operations via `policy name(args)`. No more `on "interaction label"`. |
| Scope decision | Use file-level for cross-entity concerns shared across multiple entities. Use entity-scoped for rules specific to one entity. |
| Empty guard | Never emit a policy with an empty body. If the condition cannot be expressed, use `// UNCLEAR` instead. |

#### Example

File-level:

```
policy customerMustBeActive(customer: Customer) :: "Customer should be active" {
    customer.status = active
}

policy maxOrderAmount(order: Order) :: "Orders above 10000 require manual approval" {
    order.totalAmount.amount <= 10000
}

policy deliveryOnTime(order: Order) :: "Orders past their estimated delivery date require attention" {
    if order.estimatedDelivery is defined {
        order.estimatedDelivery > today()
    }
}

policy bankTransferMinimum(order: Order, payment: Payment) :: "Bank transfers require a minimum of 50" {
    if payment.method = bankTransfer {
        order.totalAmount.amount >= 50
    }
}
```

Entity-scoped (inside Order):

```
policies {
    orderMustBeDraft(order: Order) :: "Order must be in draft status" {
        order.status = draft
    }

    productMustBeAvailable(lines: list<OrderLine>) :: "Every order line must be available" {
        every Product in lines {
            Product.available = true
        }
    }
}
```

Entity-scoped with conditional (inside Charge):

```
policies {
    chargeTimeTypeMustBeValidForLoan(charge: Charge) :: "Loan charges have restricted time types" {
        if charge.chargeAppliesTo = loan {
            charge.chargeTimeType in { disbursement, specifiedDueDate, instalmentFee,
                                        overdueInstallment, trancheDisbursement }
        }
    }

    penaltyCannotBeDueAtDisbursement(charge: Charge) :: "A penalty cannot be due at disbursement" {
        if charge.penalty = true {
            charge.chargeTimeType not in { disbursement, trancheDisbursement }
        }
    }
}
```

---

### Invariant

An `invariant` models a property that is always guaranteed to be true **after** any successful mutation. In v2, invariants can be placed on entities AND values (not on commands or events).

#### Two scopes

**File-level** — uses the `invariant` keyword:

```
invariant name :: "justification" {
    expression
}
```

**Entity/value-scoped** — inside an `invariants { }` block, NO `invariant` keyword:

```
name :: "justification" {
    expression
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Scope | Determined by placement — no more `on Entity`. File-level for cross-entity rules. Scoped for entity- or value-specific rules. |
| No parameters | Invariants have no parameters — they reference fields of their enclosing entity or value directly. |
| Expression body | The condition directly — no more `must { }` / `message` wrappers. |
| Justification | `:: "justification"` describes the business reason. |
| Applicable to | Entities and values. Never on commands or events. |
| Unexpressible | If the condition cannot be expressed faithfully, use `// UNCLEAR` instead of creating a tautological invariant. |

#### Example

Entity-scoped (inside Order):

```
invariants {
    orderContainsLines :: "An order must contain at least one line" {
        isNotEmpty(lines)
    }
    orderTotalPositive :: "Order total amount must not be negative" {
        totalAmount.amount >= 0
    }
}
```

Value-scoped (inside OrderLine):

```
invariants {
    positiveQuantity :: "Order line quantity must be greater than zero" {
        quantity > 0
    }
    lineTotalConsistency :: "Line total must equal unit price multiplied by quantity" {
        total.amount = productPrice.amount * quantity
    }
}
```

---

## Structural blocks (inside entities)

### References

A `references` block declares structural relationships between an entity and other entities or values, with explicit cardinality.

#### Skeleton

```
references {
    fieldName : TypeName cardinality
}
```

#### Rules

| Rule | Detail |
|------|--------|
| Cardinality | `N..M` notation where N and M are integers or `N` (unbounded). Common: `1..1` (required single), `1..N` (required collection), `0..1` (optional single), `0..N` (optional collection). |
| Replaces inline refs | In v1, references were inline fields (`customer : Customer`, `lines : list<OrderLine>`). In v2, they are declared in a dedicated block with cardinality. |
| Cross-module references | When the target type is modelled in another module, declare it as a normal reference and add `uses module` at file level. Do not use `// NOTE` for business types that exist in another module. Reserve `// NOTE` for unmodelled technical types (CodeValue, AppUser, Staff, etc.). |
| Naming | `camelCase` for field names, `PascalCase` for type names. |

#### Example

```
references {
    customer : Customer 1..1
    lines : OrderLine 1..N
    office : Office 1..1           // cross-module — requires `uses module Office`
    // NOTE: staff : Staff 0..1 (not modelled)
}
```

---

### Transitions

A `transitions` block declares a prescriptive state machine for an entity's status field. Labels must match operation labels in the same entity.

#### Skeleton

```
transitions {
    [*] --> state on "operation label"
    state --> state on "label", "label"
}
```

#### Rules

| Rule | Detail |
|------|--------|
| `[*]` | Represents the initial state (entry point). |
| Labels | Must match operation labels (`"Label"` in `"Label" on Command` or `"Label" when Event then Command`) in the same entity. |
| Multiple labels | Multiple operation labels on a single transition are comma-separated. |
| Completeness | Every operation that mutates the status field should have a corresponding transition. |

#### Example

```
transitions {
    [*] --> draft on "Place a new order"
    draft --> confirmed on "Confirm an order after payment"
    draft --> cancelled on "Cancel an order", "Cancel an order on payment failure"
    confirmed --> shipped on "Ship a confirmed order"
    confirmed --> cancelled on "Cancel an order", "Cancel an order on payment failure"
    shipped --> delivered on "Deliver a shipped order"
}
```

---

## Removed constructs (vs v1)

- **`repository`** — eliminated. Resolution is direct via `resolves Entity from dotPath`.
- **`interaction`** (top-level) — replaced by entity-scoped `operations`.
- **`fails when { }`** — replaced by named `policy` calls.
- **`delegates`** — replaced by direct service calls.
- **`triggers notification`** — replaced by service calls to notification services.
