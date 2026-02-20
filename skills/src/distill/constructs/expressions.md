# Expressions — Rules, Examples & Anti-Patterns

Transverse rules for all `when { ... }` and `must { ... }` blocks across `fails` clauses, `policy`, and `invariant` constructs.

## Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `isEmpty()`

## Expressible Conditions

Most conditions fall into this category — try to express them **before** resorting to `// UNCLEAR`.

### Status check

```
// Code: if (order.status != "DRAFT") throw ...
fails "Order is not in draft status" when {
  Order.status != draft
}
```

### Empty collection

```
// Code: if (items.length === 0) throw ...
fails "Order has no lines" when {
  isEmpty(Order.lines)
}
```

### String length

```
// Code: if (name.length > 200) throw ...
fails "Product name exceeds 200 characters" when {
  size(CreateProduct.name) > 200
}
```

### Self-reference guard

```
// Code: if (userId === targetUserId) throw ...
fails "Cannot transfer to yourself" when {
  TransferFunds.sourceAccountId = TransferFunds.targetAccountId
}
```

### Ownership check

```
// Code: if (entity.ownerId !== userId) throw ...
fails "Not authorized to cancel this order" when {
  Order.customer.id != CancelOrder.customerId
}
```

### Entity not found

```
// Code: if (!entity) throw ...
fails "Order not found" when {
  Order is not defined
}
```

### Existence / duplicate check

```
// Code: if (await repo.exists(a, b)) throw ...
// Model with resolves + "is defined":
resolves Payment from ProcessPayment.orderId
fails "A payment already exists for this order" when {
  Payment is defined
}
```

## Quick Reference — Expressible Patterns

| Pattern | Expression |
|---|---|
| Self-reference | `Command.fieldA = Command.fieldB` |
| Ownership | `Entity.userId != Command.userId` |
| Status check | `Entity.status != someValue` |
| Duplicate/existence | `resolves` + `fails when { Entity is defined }` |
| Not found | `fails when { Entity is not defined }` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |

## Non-obvious Conditions

When a guard condition does not map directly to an expressible pattern, **run the deliberation panel** (see Deliberation Panel section in the main skill) instead of defaulting to `// UNCLEAR`. Many conditions that appear unexpressible can be modelled with the right approach.

### Conditions that CAN be modelled (common panel resolutions)

| Pattern | Modelling approach |
|---|---|
| Uniqueness check (`repo.existsByEmail`) | `resolves` existing entity via repository operation + `fails when { Entity is defined }` |
| Cross-entity existence (`repo.existsByUserAndTarget`) | same pattern — `resolves` + `is defined` |
| External business check (eligibility, scoring) | `delegates Service.operation` + `fails` on service result |

### Conditions to omit (infrastructure)

| Pattern | Handling |
|---|---|
| Password hashing / strength check | `// NOTE: password validated against strength rules (infrastructure)` |
| Rate limiting | `// NOTE: rate-limited (infrastructure — max N per hour)` |
| MIME type / file size validation | `// NOTE: file validated at upload (infrastructure)` |
| Bot detection / honeypot | `// NOTE: bot detection (infrastructure)` |

### Conditions that remain UNCLEAR (grammar limitation + business-critical)

| Pattern | Why |
|---|---|
| Datetime arithmetic (`now() - createdAt > 5min`) | No duration operator in grammar, but business rule is critical |
| Complex regex with business meaning (banned words) | Algorithmic check with no structural equivalent |

For these: the grammar truly cannot express them **and** the PO voice confirms the rule is too important to omit. Write `// UNCLEAR:` with the full business rule description.

**Never** emit a `fails` clause with a tautological or placeholder expression. If the condition cannot be expressed faithfully, either omit with `// NOTE` (infrastructure) or mark `// UNCLEAR` (grammar gap + business-critical).

## Anti-Patterns

### Tautological expression as placeholder

```
// BAD — email is required, so this is always true
fails "Email already in use" when {
  Register.email is defined
}
```

Never write `field is defined` on a `required` or `immutable` field as a stand-in for a condition you cannot express. A required/immutable field is always defined — this is a tautology. Use `// UNCLEAR:` instead.

### Datetime subtraction with bare number

```
// BAD — the unit is ambiguous
policy OrderModificationWindow {
  when { now() - Order.placedAt > 5 }
  then "Orders can only be modified within 24 hours"
}
```

Use `// UNCLEAR:` with a note about the time window instead.

### Wrong operator for the type

- Never compare a `string` field directly to a number — use `size(field)` for string length checks.
- Never use `count()` on a `string` field — `count()` is for `list<T>` / `set<T>` only.
