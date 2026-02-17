# Interaction — Rules, Examples & Anti-Patterns

An `interaction` block models a command handler — the entry point for a write operation in the domain.

## Structure

```
interaction PlaceOrder {
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

## Clause Rules

### `on` — the command typeName

One interaction per command. The interaction identifier matches the command name: `command PlaceOrder` -> `interaction PlaceOrder`.

### `resolves` — entities loaded/fetched

The `from` dotPath must point to a field that identifies the entity. When a repository is declared in the `.flow` and the code calls a specific repository operation, add a `via Repository.operation` clause.

```
// Direct resolution with via — entity loaded from a command field through a repository:
resolves User via UserRepository.findById from UpdateProfile.userId

// Direct resolution without via — retrocompatible form:
resolves Order from CancelOrder.orderId

// Indirect resolution — entity loaded via a field of another resolved entity:
resolves Order via OrderRepository.findById from ShipOrder.orderId
resolves Payment from Order.paymentId

// Indirect resolution — chained through a token:
resolves PasswordResetToken from ResetPassword.token
resolves Customer from PasswordResetToken.customerId
```

**Every entity you `sets` or reference in a `fails` expression must be explicitly resolved or created.** A `// NOTE: resolved indirectly` comment is NOT a substitute for a `resolves` clause — if the code loads the entity, model it with `resolves`.

### `creates` — entities instantiated

Entities instantiated via `new Entity`, `.save()` on new objects. Every interaction that creates a new entity instance must list it in a `creates` clause — do not omit the primary entity being created.

### `fails` — error conditions

Guard clauses, validation failures, `if (...) throw`. Use a business-language message, not the technical exception name. The `when { expression }` must be a real, evaluable boolean condition — never a tautology.

See `constructs/expressions.md` for full expression rules and examples.

### `delegates` — service calls

Place `delegates` after `fails` and before `sets`. If the result of the service call is assigned to a field, express it with `sets Entity.field to ServiceName.operationName`.

### `sets` — field mutations

Every entity referenced in a `sets` clause must appear in a `resolves` or `creates` clause of the same interaction. If the code updates entities that are not directly resolved (e.g. bulk updates on related records), do not emit a `sets` clause — use a `// NOTE:` comment to describe the side effect instead.

### `emits` — events published/dispatched

List all events published by the command handler.

## Clause Ordering

Within an interaction block, clauses follow this order:

1. `on`
2. `resolves`
3. `creates`
4. `fails`
5. `delegates`
6. `sets`
7. `emits`

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
interaction ResetPassword {
  on ResetPassword
  resolves PasswordResetToken from ResetPassword.token
  // NOTE: Customer resolved indirectly via token  <- NOT ENOUGH
  sets Customer.password to ResetPassword.newPassword  // <- Customer not in resolves/creates
  sets PasswordResetToken.usedAt to now()
}

// GOOD — Customer explicitly resolved via indirect dotPath
interaction ResetPassword {
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
