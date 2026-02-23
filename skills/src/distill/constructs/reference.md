# Flow Construct Reference

## Interaction

An `interaction` block models a handler triggered by a command (intentional) or an event (reactive).

### Skeleton

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
  emits Event
}
```

### Clause rules

| Clause | Rule |
|---|---|
| `on` | Command → exactly 1 interaction per command. Event → 0..N interactions per event. |
| label | Business language from method name / javadoc. Default: `"Handle {Command}"` or `"React to {Event}"`. |
| `resolves` | Every entity you `sets` or reference in `fails` must be explicitly resolved or created. |
| `creates` | Every `new Entity()` / `.save()` on a new object. Never omit the primary entity. |
| `fails` | Guard clauses / validation. Business-language message. Expression must pass Test 3. |
| `delegates` | After `fails`, before `sets`. Result assigned → `sets Entity.field to Service.op`. |
| `then` | Side effects not expressible with `sets`/`emits`. Available for both triggers. |
| `sets` | Target dot-path must be reachable from an entity in `resolves` or `creates`. Cross-aggregate targets (via dot-path navigation) are allowed. Use `::` justification on cross-aggregate mutations where the business reason is not obvious. |
| `foreach` | Iterates over a `list<T>` field. Body allows `sets`, `emits`, `fails`, `then`. The alias can be used as the root of dot-paths inside the body. |
| `::` | Justification operator — attaches a business reason to a clause. Optional on `sets`. Does not change verifiability. |
| `emits` | All events published by the handler. |

### Resolution patterns

Three patterns for `resolves`. The `from` dotPath identifies the source; `via` specifies how.

#### Pattern 1 — Direct resolution

The `from` dotPath points to a field on the command/event carrying the entity's identity.

```
resolves Order from CancelOrder.orderId
resolves User via UserRepository.findById from UpdateProfile.userId
```

#### Pattern 2 — Indirect (forward ref)

The `from` dotPath points to a field on an already-resolved entity.

```
resolves Order via OrderRepository.findById from ShipOrder.orderId
resolves Payment from Order.paymentId
```

#### Pattern 3 — Indirect (reverse ref)

The resolved entity has a field referencing the `from` entity. Use `via Entity.field` to name it.

```
resolves Order from ConfirmOrder.orderId
resolves Payment via Payment.order from Order
```

#### Decision table

| Situation | Pattern |
|---|---|
| Command/event carries the entity's ID | Direct |
| An already-resolved entity carries the ID | Indirect (forward) |
| The entity to resolve has a field pointing back | Indirect (reverse) |

### `via` — two uses

- **Repository operation:** `via Repository.operation` — infrastructure method.
- **Relationship field:** `via Entity.field` — reverse-ref field (entity name matches `resolves` typeName).

### `foreach` — collection iteration

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

### `::` — justification operator

Attaches a business reason to a clause. Does not change semantics or verifiability.

```
sets Order.status to cancelled
  :: "Cancellation is immediate — no approval required for draft orders"
```

**Rules:**
- Optional on `sets` clauses.
- Use it when the *why* is not obvious from the construct alone — especially for cross-aggregate mutations.
- The justification is not verifiable itself — it is the reason *why the verifiable proof exists*.

---

## Service

A `service` block models a stateless class/interface with business logic.

### Skeleton

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

### Rules

- One service block per service class/interface.
- One operation per public method with business logic.
- Use `then` for logic that cannot be captured structurally.
- Do not create services for pure infrastructure (password hashing, image processing, logging, caching). Use `// NOTE` instead.
- **Decision criterion:** if the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service.

---

## Repository

A `repository` block models a persistence interface for an aggregate root.

### Skeleton

```
repository Name {
  for Entity
  operation opName {
    accepts param : type
    returns type
  }
}
```

### Rules

- `for` must reference an entity (aggregate root), not a value or enum.
- Operations contain only `accepts` and `returns` — never `then`, `fails`, `sets`, `emits`.
- Only model operations referenced by at least one `resolves ... via` or used in an extracted interaction.

### Filtering guide

| Operation type | Model? |
|---|---|
| `findById`, `findByField` (used in `resolves`) | Yes |
| `save`, `delete` (used in interactions) | Yes |
| `existsBy*` (used in a guard) | Yes |
| `search`, `pagination`, `count` (dashboards) | No — `// NOTE: query-only` |

---

## Policy

A `policy` block models a cross-cutting domain rule spanning multiple operations.

### Skeleton

```
policy Name {
  when { expression }
  then "consequence in business language"
}
```

### Rules

- `when` must be a real, evaluable boolean expression — never a tautology, never empty (apply Test 3).
- **Never emit a policy block with an empty or commented-out `when`.** If the condition cannot be expressed, use an inline `// UNCLEAR` comment instead of a policy block.
- If the rule applies to only one command handler, use `fails` in the interaction instead.
- If the real condition is infrastructure → `// NOTE`.

---

## Invariant

An `invariant` block models a structural constraint that must always be true for an entity.

### Skeleton

```
invariant Name {
  on Entity
  must { expression }
  message "constraint in business language"
}
```

### Rules

- `on` must reference an **entity** — never a command, event, or value.
- `must` must be a real, evaluable condition (apply Test 3).
- If the condition cannot be expressed faithfully, use `// UNCLEAR` instead of creating an invariant with a tautological `must`.
- Validation rules on command inputs belong in `fails` clauses, not invariants.
