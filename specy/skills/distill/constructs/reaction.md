# Reaction — Rules, Examples & Anti-Patterns

A `reaction` block models an event listener — a side effect triggered by a domain event.

## Structure

```
reaction OnOrderPlaced {
  on OrderPlaced
  resolves Customer from OrderPlaced.customerId
  delegates NotificationService.sendOrderConfirmation
  sets Customer.lastOrderDate to now()
  emits OrderConfirmationSent
}
```

## Rules

### Naming convention

The reaction identifier is the event name prefixed with `On`: `event OrderPlaced` -> `reaction OnOrderPlaced`.

### Clause rules

- `on` — the event typeName that triggers this reaction.
- `resolves` — entities loaded in the listener (same rules as interaction `resolves`).
- `then` — describe the side effect in business language when it cannot be expressed structurally.
- `delegates` — if the reaction calls a service, add a `delegates` clause.
- `sets` — any field mutations on resolved entities.
- `emits` — any chained events published by the listener.

### Clause ordering

1. `on`
2. `resolves`
3. `fails` (if applicable)
4. `delegates`
5. `sets`
6. `then`
7. `emits`

## Examples

### Simple notification reaction

```
reaction OnUserRegistered {
  on UserRegistered
  then "Sends welcome email to the new user"
  delegates EmailService.sendWelcome
}
```

### Reaction with state mutation

```
reaction OnPaymentCaptured {
  on PaymentCaptured
  resolves Order from PaymentCaptured.orderId
  sets Order.status to confirmed
  sets Order.paidAt to now()
  emits OrderConfirmed
}
```

### Reaction chaining events

```
reaction OnOrderShipped {
  on OrderShipped
  resolves Customer from OrderShipped.customerId
  delegates NotificationService.sendShippingNotification
  emits ShippingNotificationSent
}
```

## Anti-Patterns

### Reaction without an event source

Every reaction must have an `on` clause pointing to an existing event in the `.struct`.

### Inventing reactions for missing events

If the source code does not have an event listener, do not create a reaction. Annotate the missing event pattern with `// UNCLEAR: no event listener found`.

### Technical listeners as reactions

Do not model technical listeners (logging, metrics, cache invalidation) as reactions. Use `// NOTE:` comments instead.

```
// BAD — infrastructure concern
reaction OnOrderPlacedLogMetrics {
  on OrderPlaced
  then "Increments order counter in Prometheus"
}

// GOOD — use a comment
// NOTE: OrderPlaced triggers metric recording (infrastructure — not modeled)
```
