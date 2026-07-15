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
