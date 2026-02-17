# Repository — Rules, Examples & Anti-Patterns

A `repository` block models a persistence interface for an aggregate root. Repositories are behavioral — they produce blocks in the `.flow`, not in the `.struct`.

## Structure

```
repository OrderRepository {
  for Order

  operation findById {
    accepts id : uuid
    returns Order
  }

  operation findByCustomerId {
    accepts customerId : uuid
    returns list<Order>
  }

  operation save {
    accepts order : Order
  }

  // NOTE: query-only — not modeled
  // operation searchByDateRange — pagination for dashboard
  // operation countByStatus — aggregation for analytics
}
```

## Rules

### One repository block per repository interface/class

### `for` — the aggregate root

The `for` clause must reference an entity (aggregate root), not a value object or an enum.

```
// GOOD
repository OrderRepository {
  for Order
}

// BAD — Money is a value, not an aggregate root
repository MoneyRepository {
  for Money
}
```

### Operations are pure data access

Repository operations contain only `accepts` and `returns` — never `then`, `fails`, `sets`, or `emits`. Business logic belongs in interactions and services, not repositories.

```
// BAD — business logic in a repository
repository OrderRepository {
  for Order
  operation findById {
    accepts id : uuid
    returns Order
    fails "Order not found" when { Order is not defined }  // <- belongs in interaction
  }
}
```

### Only model operations referenced by interactions

Only model operations that are referenced by at least one `resolves ... via` clause or used in an extracted interaction. Do not model query-only methods (pagination, search, aggregation for UI/dashboard).

**Heuristic:** if an operation is not referenced by any `resolves ... via` in the `.flow`, it does not need to be declared. Annotate omissions with `// NOTE: query-only — not modeled`.

### Linking to interactions via `resolves ... via`

For each `repository.findBy*()` call in a command handler, add `via Repository.operation` in the corresponding `resolves` clause:

```
// In the interaction:
resolves Order via OrderRepository.findById from CancelOrder.orderId

// In the repository:
repository OrderRepository {
  for Order
  operation findById {
    accepts id : uuid
    returns Order
  }
}
```

### Filtering guide

| Operation type | Model? |
|---|---|
| `findById`, `findByField` (used in `resolves`) | Yes |
| `save`, `delete` (used in interactions) | Yes |
| `existsBy*` (used in a guard/check) | Yes |
| `search`, `pagination`, `count` (for dashboards) | No — `// NOTE: query-only` |
| `aggregations` (for UI/analytics) | No — `// NOTE: query-only` |

## Anti-Patterns

### Repository for technical types

Do not create `repository` blocks for audit logs, session tokens, or other purely technical persistence concerns — unless they are used in domain interactions.

```
// BAD — technical persistence
repository SessionTokenRepository {
  for SessionToken
}

// BAD — audit infrastructure
repository AuditLogRepository {
  for AuditLog
}
```

### Business logic inside repository

```
// BAD
repository UserRepository {
  for User
  operation deactivate {
    accepts id : uuid
    then "Sets user status to inactive and revokes tokens"  // <- belongs in interaction
  }
}
```
