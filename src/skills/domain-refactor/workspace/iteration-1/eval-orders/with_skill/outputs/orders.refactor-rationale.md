# Refactor rationale — orders

Redesign of the reverse-engineered `orders.domain` into a proper DDD model. The extracted model
was treated as a vocabulary source and a description of *what* the domain does, not as a structural
blueprint. Behaviour (commands → operations → events → transitions) was derived first; structure
(aggregate, value types, fields) was derived from that behaviour.

## 1. Decision → smell table

| Design move | Smell fixed | DDD treatment |
|---|---|---|
| `entity Order` (flat data bag) → `aggregate Order` with behaviour-rich operations | Anemic entity; behaviour lived in `OrderController` | Behaviour-rich aggregate root; one entity, so a tight aggregate by construction. Boundary justified by a single shared rule: lifecycle state and payment/shipment facts must commit together. |
| `totalAmount: decimal` + `currency: string` → `Money` value type (with `Currency` + `Currencies` enum) | Primitive obsession; the two loose primitives could disagree | Constructor-validated value type; amount and currency travel together; `nonNegative` invariant makes an invalid amount unconstructable. |
| `customerEmail: string` → `EmailAddress` value type | Primitive obsession | Pattern-validated value type — an invalid address cannot exist. |
| `isPaid` + `paidAt` + `paymentRef` → `payment: Payment?` (present-or-absent) | Illegal states representable (flag/satellite triplet that can contradict) | Optional value object. "Paid but no reference" and "reference but not paid" become unrepresentable. |
| `isShipped` + `shippedAt` + `trackingNumber` → `shipment: Shipment?` | Same flag-triplet illegal-state smell | Optional value object, same collapse. |
| `status: string` free text + boolean flags → `OrderLifecycle` state machine | Illegal/contradictory states; lifecycle implicit in flags | Explicit state machine: `AwaitingPayment → Paid → Shipped → Delivered`, plus `Cancelled`. No dead/trap states; state-scoped invariants pin which facts must be present in each state. |
| `command UpdateOrder { field, value }` → `PlaceOrder`, `PayOrder`, `ShipOrder`, `ConfirmDelivery`, `CancelOrder` | Generic field-setter mutator; no intent | Intent-revealing commands, each triggering one transition; each carries an `orderId` correlation id. |
| `event OrderUpdated { orderId }` → `OrderPlaced`, `OrderPaid`, `OrderShipped`, `OrderDelivered`, `OrderCancelled` | Generic, intent-poor event | Specific past-tense domain events carrying the meaningful payload of each fact. |
| (none) → `OrderPlacementRejected`, `PaymentRejected`, `ShipmentRejected`, `CancellationRejected` | No error paths — operations could not fail explicitly | Explicit error events for every refusable operation. |
| Scattered `if` checks lifted into `precondition`s + invariants | Implicit/duplicated branch logic | Each operation declares preconditions with rejection reasons (`positiveTotal`, `isPaid`, `notYetShipped`, …); aggregate-level `shipmentImpliesPayment` invariant; the temporal-cancel guard prevents double-handling. |
| (none) → `PaymentDeadlineElapsed` temporal event + `expireUnpaidOrder` reaction | Missing temporal concern (unpaid orders never time out) | Relative temporal event off `OrderPlaced`, guarded by `payment is not defined`; reaction issues `CancelOrder`. |
| (none) → `getOrder`, `findOrdersByCustomer` queries | No read surface modelled | Queries reading the derived `OrderRepository`. |

## 2. Lifecycle divergences (the `// NOTE:` markers)

- **Cancellation is a transition, not a standalone flag.** The extracted `isCancelled` boolean could
  be set independently of `isShipped`, permitting "shipped and cancelled" simultaneously. The redesign
  models cancellation as a transition allowed only from `AwaitingPayment` and `Paid`, gated by a
  `notYetShipped` precondition. Post-shipment returns/refunds are treated as a separate concern,
  out of scope of the placement→delivery lifecycle.
- **Payment deadline added.** No temporal/expiry concern was extracted, but an order stuck in
  `AwaitingPayment` forever is a real gap. A `PaymentDeadlineElapsed` temporal event (24h after
  `OrderPlaced`, guarded by still-unpaid) and an `expireUnpaidOrder` reaction were added. Marked NOTE
  because it is an addition beyond the extracted model.

## 3. Open questions (the `// UNCLEAR:` markers)

- **Payment amount matching.** `PayOrder` currently requires the captured `payment.amount` to equal
  the order `total` exactly. A real gateway may settle a different amount (currency conversion,
  partial capture, surcharge). A domain expert should confirm whether exact match is the rule or
  whether a tolerance / partial-payment lifecycle is needed.
- **Payment window.** The 24-hour expiry is assumed; the real SLA needs confirmation.

## 4. Provenance

Every redesigned element carries a `// from:` comment mapping it back to the extracted concept it
replaces, so the extracted→refactored diff is reviewable. Per the greenfield convention, the model
omits `requirements-source` and leaves all `satisfies` lists empty (no requirements were provided).

## Next step

I recommend running **`specy:domain-dialogue`** on `orders.refactored.domain` to stress-test the
redesign — in particular the state-machine completeness (is a `Returned`/refund path needed after
`Delivered`?), the cancellation boundary, and the two UNCLEAR payment rules above — before anyone
builds against it.
