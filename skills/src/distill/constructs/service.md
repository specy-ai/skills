# Service — Rules, Examples & Anti-Patterns

A `service` block models a stateless class/interface with business logic. Services are behavioral — they produce blocks in the `.flow`, not in the `.struct`.

## Structure

```
service PricingCalculator {
  operation computeTotal {
    accepts lines : list<OrderLine>
    accepts discountCode : string optional
    returns decimal
    fails "Discount code expired" when {
      Discount.status = expired
    }
    then "Applies volume discounts, coupon reductions, and tax calculations"
  }

  operation evaluateShippingCost {
    accepts weight : decimal
    accepts destination : Address
    returns decimal
    then "Calculates shipping cost based on weight tiers and destination zone"
  }
}
```

## Rules

### One service block per service class/interface

Do not merge multiple service classes into a single block.

### One operation per public method with business logic

For each public method with business logic, create an `operation` inside the service block.

### Clause rules

- `accepts` — parameters of the method (map types using the type mapping table).
- `returns` — return type of the method (if not void).
- `fails` — error conditions thrown by the service method. Same expression rules as interaction `fails` (see `constructs/expressions.md`).
- `then` — describe the business logic in natural language when it cannot be expressed structurally. This is the primary way to document service logic.
- `emits` — events published by the service method.

### Use `then` for unexpressible logic

When a service operation's business logic cannot be captured structurally, describe it with a `then` clause. Use `fails` in operations only when the error condition is formally expressible.

```
// GOOD — logic described in then clause
operation calculateScore {
  accepts applicant : Applicant
  returns int
  then "Computes credit score based on income, debt ratio, and payment history"
}

// BAD — trying to express algorithmic logic structurally
operation calculateScore {
  accepts applicant : Applicant
  returns int
  fails "Score below threshold" when {
    Applicant.income is defined  // <- tautology, not the real condition
  }
}
```

### Service calls in handlers

When a command handler calls a service, add a `delegates ServiceName.operationName` clause in the corresponding `interaction` block. Place `delegates` after `fails` and before `sets`.

If the result of the service call is assigned to a field of an entity, express it with:
```
sets Entity.field to ServiceName.operationName
```

## Anti-Patterns

### Service for pure infrastructure

Do not create `service` blocks for image processing, password hashing, logging, caching, rate limiting, or other purely technical concerns. These are infrastructure, not domain logic. Use `// NOTE:` comments instead.

```
// BAD — infrastructure, not domain logic
service PasswordHasher {
  operation hash {
    accepts password : string
    returns string
  }
}

// GOOD — use a NOTE comment instead
// NOTE: password is hashed using bcrypt before storage
```

### Decision criterion

If the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service. Otherwise, it is likely infrastructure.

**Model:** business calculations (scoring, pricing, weight), business checks (eligibility, time window), external integrations with business scope (federation, notification).

**Do not model** (use `// NOTE` instead): pure technical processing (image resize, password hash, compression), infrastructure (logging, cache, rate limiting).
