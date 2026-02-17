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

## Unexpressible Conditions

The check involves something the grammar truly cannot represent: complex business logic with no structural equivalent, external service calls, or algorithmic checks. **Do NOT emit a `fails` clause with a fake expression.** Drop the clause entirely and write a `// UNCLEAR:` comment.

```
// Code: if (isCommonPassword(pw)) throw "Too common"
// UNCLEAR: condition not expressible — checks password against common passwords list

// Code: if (rateLimiter.isExceeded(userId)) throw "Rate limit"
// UNCLEAR: condition not expressible — per-user rate limiting (max N per hour)

// Code: if (bannedWords.match(text)) throw "Banned content"
// UNCLEAR: condition not expressible — checks text against forbidden words list with leetspeak detection
```

### Common Unexpressible Categories

- **Uniqueness checks** (`if (await repo.existsByEmail(email))`)
- **Password strength** (common password lists, entropy checks)
- **Rate limiting** (in-memory or Redis-based throttling)
- **External API validation** (OAuth token verification, payment gateway)
- **Complex regex matching** (email format, URL validation, banned word lists with leetspeak)
- **Cross-entity lookups** (checking existence in another aggregate)
- **Datetime arithmetic** (`now() - Order.placedAt > 24h` — unit is ambiguous)

For all of these: do not emit a `fails` clause with a placeholder expression. A `// UNCLEAR:` comment preserves the information without producing invalid output.

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
