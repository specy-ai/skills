## Concrete syntax

In `.domain` files, the `requirements-source` appears at the bounded context or organization level, and the `satisfies` attribute appears as a list after each element declaration:

```
context OrderContext {
  requirements-source "specs/order-requirements.sysreq"

  entity Order {
    satisfies [REQ-ORD-002, REQ-ORD-007]
    ...
  }

  invariant positiveQuantity {
    satisfies [REQ-ORD-001]
    ...
  }

  command PlaceOrder {
    satisfies [REQ-ORD-002]
    ...
  }
}
```

The `requirements-source` path is relative to the `.domain` file's location. Multiple `requirements-source` declarations are allowed when requirements span several files.

## State machine syntax

Model an entity's lifecycle with a top-level `statemachine` block. Prefer this form — it is what the
examples use and what every Specy parser (tree-sitter **and** the Langium CLI) accepts, so the model
validates cleanly. Avoid the mermaid-flavoured `states { machine X { [*] --> S } }` block: although the
canonical grammar allows it, the Langium CLI does not yet parse it, so `specy:domain-build-code` and the
`parse-domain.sh` tooling will reject it.

```
statemachine OrderLifecycle {
  on Order
  start AwaitingPayment

  state AwaitingPayment {
    invariant "unpaid" {
      must { payment is not defined }
      message "An order awaiting payment has no recorded payment"
    }
  }
  state Paid {}
  state Shipped {}
  final Delivered {}
  final Cancelled {}

  transition AwaitingPayment -> Paid triggered-by "pay order"
  transition Paid -> Shipped triggered-by "ship order"
  transition Shipped -> Delivered triggered-by "confirm delivery"
  transition AwaitingPayment -> Cancelled triggered-by "cancel order"
}
```

Key points: `on <Entity>`; exactly one `start` state; zero or more `final` states; each `state` carries
its own state-scoped invariants; each `transition A -> B triggered-by "operation label"` names the
entity operation that drives it (the string must match an operation label on the entity).

## Agent instruction summary

When building or updating a domain model:

1. **Check if system requirements are provided.** Look for a `.sysreq` file, a requirements section, or any input containing EARS statements with identifiers.
2. **If requirements come from a file**: add a `requirements-source` declaration at the bounded context or organization level with the relative path to that file. This is mandatory — it is the provenance link that makes `satisfies` identifiers resolvable.
3. **If requirements exist**: for every domain model element you create or modify, determine which requirement(s) it realizes and populate the `satisfies` list with the corresponding identifier(s). Do not leave `satisfies` empty unless the element genuinely satisfies no requirement — and in that case, question whether the element should exist.
4. **If no requirements exist**: leave `satisfies` empty and omit `requirements-source`. Do not invent requirement identifiers.
5. **After building the model**: verify coverage — every `must` and `should` requirement should appear in at least one element's `satisfies` list. Flag any unsatisfied requirement as a gap.
