# Invariant — Rules, Examples & Anti-Patterns

An `invariant` block models a structural constraint that must always be true for an entity.

## Structure

```
invariant OrderMustHaveLines {
  on Order
  must { !isEmpty(Order.lines) }
  message "An order must contain at least one line"
}
```

## Rules

### `on` — entities only

The `on` clause must reference an `entity` type, never a `command`, `event`, or `value`. Validation rules on command inputs belong in `fails` clauses of the corresponding `interaction`, not in invariants.

```
// GOOD — invariant on an entity
invariant OrderMustHaveLines {
  on Order
  must { !isEmpty(Order.lines) }
  message "An order must contain at least one line"
}

// BAD — invariant on a command
invariant PlaceOrderMustHaveLines {
  on PlaceOrder
  must { !isEmpty(PlaceOrder.lines) }
  message "Must provide at least one line"
}
```

### `must` — always-true condition

The `must` expression must be a real, evaluable boolean condition that makes sense as a structural guarantee. See `constructs/expressions.md` for expression rules.

### `message` — domain language

Use business vocabulary, not technical jargon.

## Examples

### Non-empty collection

```
invariant OrderMustHaveLines {
  on Order
  must { !isEmpty(Order.lines) }
  message "An order must contain at least one line"
}
```

### Positive amount

```
invariant OrderTotalMustBePositive {
  on Order
  must { Order.totalAmount > 0 }
  message "Order total must be a positive amount"
}
```

### Status consistency

```
invariant ShippedOrderMustHaveTrackingNumber {
  on Order
  must { Order.status != shipped || Order.trackingNumber is defined }
  message "A shipped order must have a tracking number"
}
```

### Balance constraint

```
invariant AccountBalanceNonNegative {
  on Account
  must { Account.balance >= 0 }
  message "Account balance cannot be negative"
}
```

## Anti-Patterns

### Invariant on a command

```
// BAD — input validation belongs in fails clause of the interaction
invariant CreateProductNameRequired {
  on CreateProduct
  must { CreateProduct.name is defined }
  message "Product name is required"
}
```

This should be a `fails` clause in `interaction CreateProduct` instead.

### Invariant on a value object

```
// BAD — value objects are immutable, constraints belong in the struct definition
invariant MoneyMustBePositive {
  on Money
  must { Money.amount > 0 }
  message "Amount must be positive"
}
```

Use a `min(0)` constraint on the field in the `.struct` instead.

### Tautological must clause

```
// BAD — id is a required field, always defined
invariant OrderMustHaveId {
  on Order
  must { Order.id is defined }
  message "Order must have an identifier"
}
```

### Unexpressible invariant

If the invariant's condition cannot be expressed with available operators, do not create an `invariant` block. Use `// UNCLEAR:` instead.

```
// BAD — regex validation cannot be modeled
invariant ValidEmailFormat {
  on Customer
  must { Customer.email is defined }  // <- tautology, not the real check
  message "Email must be valid"
}

// GOOD
// UNCLEAR: invariant not expressible — email must match RFC 5322 format
```
