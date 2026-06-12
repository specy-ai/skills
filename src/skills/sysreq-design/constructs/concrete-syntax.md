## Concrete syntax

Requirements are written in a `.sysreq` section or file, consistent with Specy's DSL style.

```
requirements "Order Processing" scoped-to OrderContext {
  prd-source "specs/order.prd"

  REQ-ORD-001 "Order line quantity floor" : ubiquitous
    :: "Regulatory minimum — trade compliance requires explicit quantity"
    "The system shall reject order lines with a quantity less than one."
    priority must

  REQ-ORD-002 "Order placement" : event-driven
    :: "Core revenue path — every sale starts here"
    "When a customer submits an order, the system shall create
     the order in draft status and emit an OrderPlaced event."
    priority must

  REQ-ORD-003 "Active customer guard" : state-driven
    :: "Suspended customers must not accumulate new debt"
    "While the customer is suspended, the system shall reject
     new orders."
    priority must

  REQ-ORD-004 "Insufficient stock handling" : unwanted
    :: "Overselling erodes trust — hard lesson from Q3 2024"
    "If the ordered product is out of stock, then the system shall
     reject the order and notify the customer."
    priority must

  REQ-ORD-005 "Credit limit agreement" : complex
    :: "Finance requires real-time credit exposure control"
    "While the customer has an active credit account, when an order
     is placed, if the order total exceeds the remaining credit limit,
     then the system shall hold the order for manual approval."
    priority should

  REQ-ORD-006 "Express shipping option" : optional
    :: "Premium feature — only for regions with courier partnerships"
    "Where express shipping is available, the system shall offer
     same-day delivery for orders placed before noon."
    priority could
}
```

### Syntax rules

- `requirements "<name>" scoped-to <BoundedContext>` opens a requirement set.
- `prd-source "<relative-path>"` optionally declares the path to the `.prd` file that originated this set's requirements. The path is relative to the `.sysreq` file's location. When present, `source` fields on individual requirements reference elements inside this file, making the provenance chain file-resolvable.
- Each requirement starts with its **id** followed by its **name** in quotes, a colon, and its **pattern**.
- `::` introduces the rationale (same operator as in `.domain` files).
- The EARS statement follows in quotes, on one or more lines.
- `priority` declares the MoSCoW level.
- `source "<reference>"` optionally declares the provenance — a PRD section, user story ID, regulatory clause, or business goal that originated the requirement.
- Requirements may declare dependencies and conflicts:

```
  REQ-ORD-007 "Order confirmation" : event-driven
    depends-on REQ-ORD-002
    source "PRD v2.1 §3.4 — Payment-gated order flow"
    "When payment is verified, the system shall confirm the order."
    priority must
```

```
  REQ-ORD-008 "Immediate fulfillment" : event-driven
    conflicts-with REQ-ORD-005
    :: "Ops wants auto-ship; Finance wants credit hold — resolved by priority"
    "When an order is confirmed, the system shall immediately
     initiate fulfillment."
    priority should
```
