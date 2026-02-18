# Interaction — Rules, Examples & Anti-Patterns

An `interaction` block models a handler triggered by a command (intentional) or an event (reactive). The trigger type is determined by the `on` clause: if it references a `command` defined in the `.struct`, it is intentional; if it references an `event`, it is reactive.

The interaction name is a **string literal** describing the business intent in plain language.

## Structure

### Command-triggered (intentional)

```
interaction "Place a new order" {
  on PlaceOrder
  resolves Customer via CustomerRepository.findById from PlaceOrder.customerId
  creates Order
  fails "Customer is inactive" when {
    Customer.status = inactive
  }
  delegates PricingCalculator.computeTotal
  sets Order.totalAmount to PricingCalculator.computeTotal
  sets Order.status to pending
  emits OrderPlaced
}
```

### Event-triggered (reactive)

```
interaction "Handle payment failure" {
  on PaymentFailed
  resolves Payment from PaymentFailed.paymentId
  then "Notify customer of payment failure"
  then "Allow retry with a different payment method"
  sets Payment.status to failed
}
```

## Clause Rules

### `on` — the trigger typeName

The `on` clause references a `command` or `event` defined in the `.struct`.

**Cardinality:**
- **Command trigger:** exactly one interaction per command (1:1). Never merge multiple commands into one interaction.
- **Event trigger:** zero to many interactions per event (1:N). Multiple handlers for the same event are allowed.

### String label — the interaction name

The string literal after `interaction` describes the business intent in plain language. It is a human-readable label, not a formal identifier. The formal identity of an interaction is its trigger (the `on` typeName).

**Label generation rules for `distill`:**
- Use the method name, javadoc, or class-level comment from the source code when available.
- If nothing meaningful is available, use a default pattern:
  - Command trigger: `"Handle {CommandName}"` (e.g. `"Handle PlaceOrder"`)
  - Event trigger: `"React to {EventName}"` (e.g. `"React to OrderConfirmed"`)
- Labels must be in business language, not technical jargon.

### `resolves` — entities loaded/fetched

There are three resolution patterns. The `from` dotPath identifies the source; the optional `via` clause specifies how the resolution is performed.

#### Pattern 1 — Direct resolution

The `from` dotPath points to a field on the command or event that carries the entity's identity.

```
// Direct — lookup by identity field:
resolves Order from CancelOrder.orderId

// Direct with repository — same lookup, explicit infrastructure path:
resolves User via UserRepository.findById from UpdateProfile.userId
```

#### Pattern 2 — Indirect resolution (forward ref)

The `from` dotPath points to a field on an already-resolved entity. That field carries the identity of the entity to resolve.

```
// The resolved Order has a field that identifies the Payment:
resolves Order via OrderRepository.findById from ShipOrder.orderId
resolves Payment from Order.paymentId

// Chained through a token — each step uses a field from the previous entity:
resolves PasswordResetToken from ResetPassword.token
resolves Customer from PasswordResetToken.customerId
```

#### Pattern 3 — Indirect resolution (reverse ref)

The resolved entity has a field that references the `from` entity. Use `via Entity.field` to name the relationship field explicitly.

```
// Payment has a field `order : Order` — navigate the reverse relationship:
resolves Order from ConfirmOrder.orderId
resolves Payment via Payment.order from Order

// Subscription has a field `customer : Customer` — reverse lookup:
resolves Customer from DeactivateSubscription.customerId
resolves Subscription via Subscription.customer from Customer

// Invoice has a field `order : Order` — reverse lookup:
resolves Order from CloseOrder.orderId
resolves Invoice via Invoice.order from Order
```

#### Decision rule

| Situation | Pattern | Example |
|---|---|---|
| Command/event carries the entity's ID | Direct | `resolves Order from PlaceOrder.orderId` |
| An already-resolved entity carries the ID | Indirect (forward) | `resolves Payment from Order.paymentId` |
| The entity to resolve has a field pointing back to an already-resolved entity | Indirect (reverse) | `resolves Payment via Payment.order from Order` |

#### `via` clause — two uses

The optional `via` clause serves two purposes depending on the dotPath shape:

- **Repository operation:** `via Repository.operation` — specifies the infrastructure method used to load the entity.
- **Relationship field:** `via Entity.field` — specifies the field on the resolved entity that references the `from` entity (reverse-ref pattern).

The two are distinguishable: a repository `via` references a `Repository.operation`, while a relationship `via` references `ResolvedEntity.field` where the entity name matches the `resolves` typeName.

**Every entity you `sets` or reference in a `fails` expression must be explicitly resolved or created.** A `// NOTE: resolved indirectly` comment is NOT a substitute for a `resolves` clause — if the code loads the entity, model it with `resolves`.

This rule applies equally to command-triggered and event-triggered interactions. An event-triggered interaction that `sets Payment.status to failed` must `resolves Payment from PaymentFailed.paymentId`.

### `creates` — entities instantiated

Entities instantiated via `new Entity`, `.save()` on new objects. Every interaction that creates a new entity instance must list it in a `creates` clause — do not omit the primary entity being created.

### `fails` — error conditions

Guard clauses, validation failures, `if (...) throw`. Use a business-language message, not the technical exception name. The `when { expression }` must be a real, evaluable boolean condition — never a tautology.

**Event-triggered interactions can also `fails`.** A reactive handler may fail to process an event (entity not found, condition not met). This reflects the reality of process managers and sagas.

See `constructs/expressions.md` for full expression rules and examples.

### `delegates` — service calls

Place `delegates` after `fails` and before `then`/`sets`. If the result of the service call is assigned to a field, express it with `sets Entity.field to ServiceName.operationName`.

### `then` — informal side effects

Describe the side effect in business language when it cannot be expressed structurally with `sets`/`emits`. Available for both command-triggered and event-triggered interactions.

```
interaction "Notify customer when order is confirmed" {
  on OrderConfirmed
  then "Notify customer that order is confirmed"
  then "Trigger shipment preparation"
}
```

### `sets` — field mutations

Every entity referenced in a `sets` clause must appear in a `resolves` or `creates` clause of the same interaction. If the code updates entities that are not directly resolved (e.g. bulk updates on related records), do not emit a `sets` clause — use a `// NOTE:` comment to describe the side effect instead.

### `emits` — events published/dispatched

List all events published by the handler.

## Clause Ordering

Within an interaction block, clauses follow this order:

1. `on`
2. `resolves`
3. `creates`
4. `fails`
5. `delegates`
6. `then`
7. `sets`
8. `emits`

## Examples

### Command-triggered — full interaction

```
interaction "Place a new order" {
  on PlaceOrder
  resolves Customer from PlaceOrder.customerId
  creates Order
  fails "Customer not found or inactive" when {
    Customer.status != active
  }
  fails "Order has no lines" when {
    isEmpty(PlaceOrder.lines)
  }
  sets Order.status to draft
  sets Order.placedAt to now()
  sets Order.totalAmount to sum(Order.lines.lineTotal)
  emits OrderPlaced
}
```

### Event-triggered — simple notification

```
interaction "Notify customer when order is confirmed" {
  on OrderConfirmed
  then "Notify customer that order is confirmed"
  then "Trigger shipment preparation"
}
```

### Event-triggered — with state mutation

```
interaction "Handle payment failure" {
  on PaymentFailed
  resolves Payment from PaymentFailed.paymentId
  then "Notify customer of payment failure"
  then "Allow retry with a different payment method"
  sets Payment.status to failed
}
```

### Event-triggered — with delegation and chained event

```
interaction "Send shipping notification" {
  on OrderShipped
  resolves Customer from OrderShipped.customerId
  delegates NotificationService.sendShippingNotification
  emits ShippingNotificationSent
}
```

## Anti-Patterns

### Bogus `resolves from` dotPath

```
// BAD — Customer is not resolved from a payment method
resolves Customer from ProcessPayment.method

// BAD — Order is not resolved from a reason text
resolves Order from CancelOrder.reason
```

If the entity is resolved from a field that is not in the command (e.g. only available in the session), add that field to the command first (see Phase 2 rule on command fields), then use it in `resolves`.

### Missing indirect resolution

```
// BAD — sets Customer fields but Customer is not resolved
interaction "Reset user password" {
  on ResetPassword
  resolves PasswordResetToken from ResetPassword.token
  // NOTE: Customer resolved indirectly via token  <- NOT ENOUGH
  sets Customer.password to ResetPassword.newPassword  // <- Customer not in resolves/creates
  sets PasswordResetToken.usedAt to now()
}

// GOOD — Customer explicitly resolved via indirect dotPath
interaction "Reset user password" {
  on ResetPassword
  resolves PasswordResetToken from ResetPassword.token
  resolves Customer from PasswordResetToken.customerId
  sets PasswordResetToken.usedAt to now()
  // NOTE: Customer.password is set to hashed value of ResetPassword.newPassword
}
```

### Merging multiple commands into one interaction

Each command type gets exactly one `interaction` block. Never merge `PlaceOrder` and `ConfirmOrder` into a single interaction.

### Inventing logic not in source code

Every `resolves`, `fails`, `sets`, and `emits` clause must trace to something explicit in the source handler. If you cannot find evidence, do not emit it.

### Event-triggered interaction without an event source

Every event-triggered interaction must have an `on` clause pointing to an existing event in the `.struct`. If the source code does not have an event listener, do not create an interaction. Annotate the missing event pattern with `// UNCLEAR: no event listener found`.

### Technical listeners as interactions

Do not model technical listeners (logging, metrics, cache invalidation) as interactions. Use `// NOTE:` comments instead.

```
// BAD — infrastructure concern
interaction "Log order metrics" {
  on OrderPlaced
  then "Increments order counter in Prometheus"
}

// GOOD — use a comment
// NOTE: OrderPlaced triggers metric recording (infrastructure — not modeled)
```
