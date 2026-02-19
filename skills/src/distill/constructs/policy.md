# Policy — Rules, Examples & Anti-Patterns

A `policy` block models a cross-cutting domain rule that spans multiple operations or guards multiple commands.

## Structure

```
policy MaxOrderAmount {
  when { Order.totalAmount > 10000 }
  then "Orders exceeding 10,000 require manager approval"
}
```

## Rules

### `when` — evaluable boolean expression

The `when` condition must be a real, evaluable boolean expression — the same tautology prohibition as `fails` applies here. See `constructs/expressions.md` for full expression rules.

If the policy's real condition is unexpressible (datetime arithmetic, cross-context queries, external lookups), do NOT emit a `policy` block with a placeholder `when` clause. Instead, write a standalone `// UNCLEAR:` comment:

```
// UNCLEAR: policy not expressible — orders can only be modified within 24 hours of placement (datetime arithmetic)
// UNCLEAR: policy not expressible — payment gateway must confirm card validity before capture (external service call)
```

### `then` — consequence in business language

Use domain vocabulary, not technical jargon.

### Scope

Policies are for rules that:
- Span multiple operations (not tied to a single interaction)
- Guard multiple commands with the same condition
- Express domain-wide constraints that don't fit in a single `fails` clause

If a rule only applies to one command handler, it should be a `fails` clause in the corresponding `interaction`, not a policy.

## Examples

### Amount threshold policy

```
policy MaxOrderAmount {
  when { Order.totalAmount > 10000 }
  then "Orders exceeding 10,000 require manager approval"
}
```

### Membership restriction

```
policy PremiumContentAccess {
  when { Customer.membershipLevel = free }
  then "Free members cannot access premium content"
}
```

### Status-based restriction

```
policy SuspendedAccountRestriction {
  when { Account.status = suspended }
  then "Suspended accounts cannot initiate transactions"
}
```

## Anti-Patterns

### Tautological `when` clause — field always defined

```
// BAD — createdAt is immutable pastOrPresent, always defined
policy OrderModificationWindow {
  when { Order.createdAt is defined }
  then "Orders can only be modified within 24 hours of placement"
}
```

The real condition is datetime arithmetic (`now() - createdAt < 24h`) which is unexpressible. Use `// UNCLEAR:` instead.

### Tautological `when` clause — always-true field

```
// BAD — updatedAt being defined does not capture the time window
policy OrderEditDeadline {
  when { Order.updatedAt is defined }
  then "Orders can only be edited within 1 hour"
}
```

### Status check masking a cross-aggregate rule

```
// BAD — condition is a status check, not the actual cross-aggregate rule
policy PaymentRequiredForShipping {
  when { Order.status = confirmed }
  then "A captured payment is required before shipping"
}
```

The real rule involves checking the Payment aggregate, not just Order status. If it requires a cross-aggregate lookup, use `// UNCLEAR:`.

### Placeholder expression for complex conditions

```
// BAD — the real condition involves an external API call
policy FraudDetection {
  when { Order.totalAmount > 0 }
  then "Orders must pass fraud screening"
}
```

Use `// UNCLEAR: policy not expressible — fraud screening via external API` instead.
