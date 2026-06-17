# Orders — refactor rationale

Each decision below maps back to a smell from `refactoring.report`. The redesign
re-derives the model from the business problem (a customer order moving through
placement → payment → shipment → delivery, with cancellation) rather than
transcribing the extracted shapes. Ubiquitous language is preserved: *order*,
*place*, *pay*, *ship*, *deliver*, *cancel*, *tracking number*, *payment ref*.

## Smell → fix

### 1. Anemic entity (logic in `OrderController`)
`Order` is now a behaviour-bearing aggregate root. Every state change happens
through an operation it owns — `PlaceOrder`, `PayOrder`, `ShipOrder`,
`ConfirmDelivery`, `CancelOrder` — each with preconditions and emitted events.
No mutation happens outside the entity, so the controller becomes a thin
dispatcher rather than the home of business rules.

### 2. Primitive obsession
- `totalAmount: decimal` + `currency: string` → a single `Money` value type with
  a `Currency` enum and a `min(0)` constraint, created only if valid.
- `customerEmail: string` → `EmailAddress` value with a format constraint.
- `paymentRef`/`trackingNumber` are no longer loose strings floating on the
  entity; they live inside cohesive `PaymentDetail` / `ShipmentDetail` values.
- Order contents are modelled as `OrderLine` values (product, quantity, captured
  unit price) so `total` can be checked against the lines.

### 3. Illegal states representable (flag soup)
The paired flags and satellites (`isPaid`/`paidAt`/`paymentRef`,
`isShipped`/`shippedAt`/`trackingNumber`, `isCancelled`) plus a free-text
`status` that could contradict them are all removed. Replaced by:
- A single `OrderStatus` enum as the **one** source of lifecycle truth.
- `PaymentDetail`, `ShipmentDetail`, `CancellationDetail` as whole-or-nothing
  bundles — you cannot have a `paidAt` without a `paymentRef` and an amount.
- Invariants (`paidHasPayment`, `shippedHasShipment`, `cancelledHasReason`,
  `totalMatchesLines`, `nonEmpty`) that tie the optional bundles to the status,
  enforced with `reject`. A "paid but no payment" or "shipped but not paid" state
  is unrepresentable.

### 4. Generic event `OrderUpdated`
Replaced by intent-revealing domain events — `OrderPlaced`, `OrderPaid`,
`OrderShipped`, `OrderDelivered`, `OrderCancelled` — each carrying exactly the
facts of the business event that occurred.

### 5. No error paths
Added an explicit failure path: the `RejectPayment` operation `raises` the
`error-event PaymentRejected`, and the `cancelOnPaymentRejected` reaction turns
that failure into an `OrderCancelled` outcome. Failure is now a first-class,
observable part of the model.

### 6. No aggregate / no state machine
Added `OrderAggregate root Order` and the `OrderLifecycle` state machine. The
lifecycle that was implicit in boolean flags is now an explicit, enumerable set
of states (`placed → paid → shipped → delivered`, with `cancelled` reachable from
`placed`/`paid`) with per-state invariants. Each transition is driven by exactly
one entity operation.

## Bonus correctness move
The catch-all `command UpdateOrder { field: string; value: string }` —
effectively reflection-driven mutation with no domain meaning — is replaced by
one intention-revealing command per business action. This restores a clean
command → operation → event chain and lets each action carry a typed,
validated payload.

## Notes
The fixture was reverse-engineered from code and carries no system requirements,
so no `satisfies` lists or `requirements-source` are added. `OrderLine` and the
`totalMatchesLines` invariant are introduced because a `total` with no itemised
basis cannot be validated — if the real business keeps order contents in a
separate context, these can be dropped and `total` taken as authoritative.
