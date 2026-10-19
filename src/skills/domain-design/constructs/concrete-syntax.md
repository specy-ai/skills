## Concrete syntax

In `.domain` files, the `requirements-source` appears at the bounded context or organization level, and `satisfies` is **always the first element inside the body braces**:

```
context OrderContext {
  requirements-source "specs/order-requirements.sysreq"

  entity Order {
    satisfies [REQ-ORD-002, REQ-ORD-007]
    identity id : uuid
    fields { ... }
  }

  invariant PositiveQuantity {
    satisfies [REQ-ORD-001]
    on Order
    must { quantity > 0 }
    enforcement rejection
  }

  command PlaceOrder {
    satisfies [REQ-ORD-002]
    identity commandId : uuid
    fields { ... }
  }
}
```

The `requirements-source` path is relative to the `.domain` file's location.

## Subdomain and `models` syntax

A **subdomain** is the problem space: an area of activity the business has to master. It is declared at organization scope (the grammar accepts it before, between or after the contexts; put it before the first `context`), with a mandatory classification and an optional description and metadata. A **bounded context** is the solution space: its `models` clause names the subdomain(s) it models.

```
organization Lendwell :: "Consumer and business lending" {
  subdomain Underwriting core :: "Deciding whether and at what price to lend"
  subdomain IdentityVerification generic
  subdomain Collections supporting :: "Recovering overdue repayments" meta { owner = "Risk" }

  context LoanDecisioning (ldn) :: "Credit decisions on loan applications" {
    requirements-source "loan-decisioning.sysreq"
    models Underwriting
    map {
      downstream IdentityChecks : ACL
    }
    // modules and definitions...
  }

  context IdentityChecks (idc) :: "Thin model around the bought identity-verification product" {
    models IdentityVerification
    // ...
  }

  context Recovery (rec) :: "Dunning and repayment plans" {
    models Collections
    // ...
  }
}
```

Key points:

- The classification is one of `core`, `supporting`, `generic`, and it is mandatory:
  - `core` — where the enterprise differentiates. Built in-house by the strongest team, modeled in depth (aggregates, invariants, state machines).
  - `supporting` — necessary and specific to the business, but not differentiating. Built simply or outsourced.
  - `generic` — every business has it. Bought or adopted; its context is often a thin model or an anti-corruption layer around the product.
- A subdomain name has the same form as a context name. A subdomain has no body.
- `models Name {, Name}` sits after `satisfies` and `requirements-source` and before `map`. A context models one or more subdomains; a subdomain is modeled by zero, one or several contexts.
- A subdomain no context models is legitimate: typically a generic subdomain served by a bought product, reached through an `spi interface` and an `infrastructure service`.
- Once the organization declares at least one subdomain, every context states `models`; a context without it is reported. An organization with no subdomain is unchanged.
- Several contexts modeling one subdomain usually record history (a legacy context next to its replacement). One context modeling several subdomains has grown too large, and a core subdomain never shares a context with a generic one.
- Neither `subdomain` nor `models` names a capability, a team or a system. The enterprise-architecture layer points at the subdomain (`capability … realized-by <Subdomain>`).

## State machine syntax

An entity's lifecycle lives **inside** the entity or aggregate, in a `states { machine ... }` block. Both parsers (tree-sitter and the Langium CLI) accept it, so the model validates cleanly.

```
entity Order {
  identity id : uuid
  fields { ... }

  operations {
    "pay order"        on PayOrder        { ... }
    "ship order"       on ShipOrder       { ... }
    "confirm delivery" on ConfirmDelivery { ... }
    "cancel order"     on CancelOrder     { ... }
  }

  states {
    machine OrderLifecycle {
      state awaitingPayment {
        invariants {
          unpaid :: "An order awaiting payment has no recorded payment" {
            payment is not defined
            enforcement rejection
          }
        }
      }
      state paid
      state shipped
      final delivered
      final cancelled

      [*]             --> awaitingPayment on "place order"
      awaitingPayment --> paid            on "pay order"
      paid            --> shipped         on "ship order"
      shipped         --> delivered       on "confirm delivery"
      awaitingPayment --> cancelled       on "cancel order" {
        precondition notYetPaid { payment is not defined } rejects "A paid order cannot be cancelled here"
      }
    }
  }
}
```

Key points:

- The machine is nested in the entity that owns it — there is no top-level `statemachine`, and no separate `transitions { }` block.
- Exactly one start transition, written `[*] --> state on <operation>`. Zero or more `final` states.
- Each `state` may carry its own invariants, and each invariant declares an `enforcement`.
- `on` names the **entity operation** that drives the transition: the `"Label"` of a command-triggered operation, or the identifier of an internal one.
- A transition may carry **named** preconditions/postconditions. A precondition declares its violation reason with `rejects`. This is what lets one operation drive transitions out of several states with a *different* rule for each — `cancel` may be legal from `pending` always, but from `paid` only within the refund window.

## Agent instruction summary

When building or updating a domain model:

1. **Check if system requirements are provided.** Look for a `.sysreq` file, a requirements section, or any input containing EARS statements with identifiers.
2. **If requirements come from a file**: add a `requirements-source` declaration at the bounded context or organization level with the relative path to that file. This is mandatory — it is the provenance link that makes `satisfies` identifiers resolvable.
3. **If requirements exist**: for every domain model element you create or modify, determine which requirement(s) it realizes and populate the `satisfies` list with the corresponding identifier(s). Do not leave `satisfies` empty unless the element genuinely satisfies no requirement — and in that case, question whether the element should exist.
4. **If no requirements exist**: leave `satisfies` empty and omit `requirements-source`. Do not invent requirement identifiers.
5. **After building the model**: verify coverage — every `must` and `should` requirement should appear in at least one element's `satisfies` list. Flag any unsatisfied requirement as a gap.
