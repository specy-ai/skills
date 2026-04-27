# Payment — Requirements

Bounded Context: **Payment** (PAY)

Responsibility: Fare calculation, payment processing, driver payouts, refunds, invoicing.

---

```
requirements "Fare Calculation" scoped-to Payment {
  prd-source "specs/payment.prd"

  REQ-PAY-001 "Fare estimate" : event-driven
    source "Feature: Fare calculation — Story: Pre-ride fare estimate — AC: Base + per-km + per-minute + surge"
    :: "Riders see the price upfront — builds trust"
    "When a fare estimate is requested with pickup location, dropoff
     location, and ride type, the Payment system shall compute the
     estimated fare using base fare, per-km rate, per-minute rate,
     and applicable surge multiplier."
    priority must

  REQ-PAY-002 "Final fare computation" : event-driven
    source "Feature: Fare calculation — Story: Final fare on completion — AC: Actual distance + duration with promos"
    :: "Actual ride metrics replace estimates after completion"
    "When a final fare is requested with actual distance and duration,
     the Payment system shall compute the final fare and apply any
     applicable promotions or adjustments."
    priority must

  REQ-PAY-003 "Minimum fare" : ubiquitous
    source "Feature: Fare calculation — Story: Minimum fare guard — AC: Minimum fare applies when computed is below"
    :: "Short rides must still cover fixed costs"
    "The Payment system shall enforce a minimum fare — if the computed
     fare is below the minimum, the minimum fare applies."
    priority must

  REQ-PAY-004 "Fare breakdown" : ubiquitous
    source "Feature: Fare calculation — Story: Fare breakdown to the rider — AC: Every fare exposes base/distance/time/surge/tolls/promos/total"
    :: "Transparency — riders must see what they are paying for"
    "The Payment system shall provide a fare breakdown showing base
     fare, distance charge, time charge, surge charge, tolls,
     promotions, and total."
    priority must

  REQ-PAY-005 "Cancellation fee calculation" : event-driven
    source "Feature: Fare calculation — Story: Cancellation fee — AC: Fee computed from policy + time elapsed since assignment"
    :: "Compensate drivers for wasted time on rider cancellations"
    "When a ride is cancelled with a fee, the Payment system shall
     compute the cancellation fee based on the cancellation policy
     and the time elapsed since driver assignment."
    priority must
}


requirements "Payment Processing" scoped-to Payment {
  prd-source "specs/payment.prd"

  REQ-PAY-010 "Payment capture" : event-driven
    source "Feature: Authorize-then-capture payment — Story: Capture on completion — AC: Default method charged for final fare"
    :: "Cashless core — charge happens automatically on ride completion"
    "When a payment capture is initiated for a completed ride, the
     Payment system shall charge the rider's default payment method
     for the final fare amount."
    priority must

  REQ-PAY-011 "Payment authorization at request" : event-driven
    source "Feature: Authorize-then-capture payment — Story: Pre-authorization at request — AC: Hold placed for estimated fare"
    :: "Pre-auth avoids post-ride payment failures"
    "When a ride is requested, the Payment system shall place a
     hold on the rider's payment method for the estimated fare amount."
    priority must

  REQ-PAY-012 "Payment failure" : unwanted
    source "Feature: Authorize-then-capture payment — Story: Graceful failure — AC: Record debt, notify, let ride complete"
    :: "Failed payment must not block the rider in the car"
    "If the payment capture fails, then the Payment system shall
     record the debt on the rider's account, notify the rider, and
     allow the ride to complete normally."
    priority must

  REQ-PAY-013 "Outstanding debt blocks new rides" : state-driven
    source "Feature: Authorize-then-capture payment — Story: Debt blocks new rides — AC: Authorization rejected while debt outstanding"
    :: "Riders with unpaid debt must settle before riding again"
    "While the rider has an outstanding payment debt, the Payment
     system shall reject payment authorization for new ride requests."
    priority must

  REQ-PAY-014 "Payment retry" : event-driven
    source "Feature: Authorize-then-capture payment — Story: Retry with backoff — AC: Up to 3 retries with exponential backoff"
    :: "Transient failures are common — retry before escalating"
    "When a payment capture fails with a transient error, the Payment
     system shall retry the charge up to three times with exponential
     backoff."
    priority must

  REQ-PAY-015 "Multiple payment methods" : event-driven
    source "Feature: Authorize-then-capture payment — Story: Fallback method — AC: Attempt next active method after retries exhausted"
    :: "Fallback payment reduces failed rides"
    "When the primary payment method fails after all retries, the
     Payment system shall attempt to charge the rider's next active
     payment method."
    priority should
}


requirements "Driver Payouts" scoped-to Payment {
  prd-source "specs/payment.prd"

  REQ-PAY-020 "Driver earnings per ride" : event-driven
    source "Feature: Driver earnings and payouts — Story: See earnings after each ride — AC: Earnings = fare − commission credited to balance"
    :: "Drivers see earnings immediately — transparency builds trust"
    "When a ride is completed and fare is finalized, the Payment
     system shall compute the driver's earnings as the fare minus
     the platform commission and record it on the driver's balance."
    priority must

  REQ-PAY-021 "Platform commission" : ubiquitous
    source "Feature: Driver earnings and payouts — Story: Platform commission — AC: Commission deducted before crediting driver"
    :: "Revenue model — platform takes a percentage of each fare"
    "The Payment system shall deduct a platform commission from
     each fare before crediting the driver's balance."
    priority must

  REQ-PAY-022 "Driver payout schedule" : event-driven
    source "Feature: Driver earnings and payouts — Story: Weekly payout — AC: Weekly transfer to registered bank, publish PayoutCompleted"
    :: "Predictable payouts — drivers depend on this income"
    "When the weekly payout cycle triggers, the Payment system shall
     transfer the driver's accumulated balance to their registered
     bank account and publish a PayoutCompleted event."
    priority must

  REQ-PAY-023 "Instant payout" : optional
    source "Feature: Driver earnings and payouts — Story: Instant payout — AC: Immediate transfer minus instant-payout fee"
    :: "Premium feature — drivers pay a fee for immediate cash-out"
    "Where instant payouts are enabled, when a driver requests an
     instant payout, the Payment system shall transfer the available
     balance immediately, minus the instant payout fee."
    priority could

  REQ-PAY-024 "Payout minimum threshold" : ubiquitous
    source "Feature: Driver earnings and payouts — Story: Payout minimum — AC: Payout only if balance exceeds threshold"
    :: "Avoid micro-transfers that cost more in fees than they deliver"
    "The Payment system shall execute a payout only if the driver's
     balance exceeds the minimum payout threshold."
    priority must
}


requirements "Refunds & Adjustments" scoped-to Payment {
  prd-source "specs/payment.prd"

  REQ-PAY-030 "Rider refund request" : event-driven
    source "Feature: Refunds and adjustments — Story: Rider refund request — AC: Request recorded and queued for review"
    :: "Dispute resolution — rider claims they were overcharged"
    "When a rider requests a refund for a completed ride, the Payment
     system shall record the refund request and place it in the
     review queue."
    priority must

  REQ-PAY-031 "Automatic refund for system cancellation" : event-driven
    source "Feature: Refunds and adjustments — Story: Automatic refund for system cancellation — AC: Release hold, full refund if charged"
    :: "If we cancel the ride (no driver available), the rider pays nothing"
    "When a ride is cancelled with reason 'no-driver-available', the
     Payment system shall automatically release any payment hold and
     issue a full refund if a charge occurred."
    priority must

  REQ-PAY-032 "Partial refund" : event-driven
    source "Feature: Refunds and adjustments — Story: Partial refund (review-queued) — AC: Approved amount refunded with driver earnings adjusted"
    :: "Not all disputes warrant a full refund — route deviation, long wait"
    "When a backoffice agent approves a partial refund, the Payment
     system shall refund the specified amount to the rider's original
     payment method and adjust the driver's earnings accordingly."
    priority must

  REQ-PAY-033 "Refund impact on driver earnings" : event-driven
    depends-on REQ-PAY-032
    source "Feature: Refunds and adjustments — Story: Driver-fault refund deduction — AC: Refund amount deducted from driver balance"
    :: "If the refund is due to driver fault, the driver absorbs the cost"
    "When a refund is classified as driver-fault, the Payment system
     shall deduct the refund amount from the driver's balance."
    priority must

  REQ-PAY-034 "Promotional credit" : event-driven
    source "Feature: Promotional credits — Story: Apply a promo credit — AC: Credit recorded with expiry, applied to next eligible ride"
    :: "Growth lever — first ride free, referral credits"
    "When a promotional credit is applied to a rider's account, the
     Payment system shall record the credit with an expiry date and
     apply it automatically to the next eligible ride fare."
    priority should

  REQ-PAY-035 "Promotional credit expiry" : unwanted
    source "Feature: Promotional credits — Story: Expire unused credits — AC: Void credit on expiry, remove from balance"
    :: "Credits must not live forever — financial liability"
    "If a promotional credit reaches its expiry date without being
     used, then the Payment system shall void the credit and remove
     it from the rider's available balance."
    priority should
}


requirements "Invoicing" scoped-to Payment {
  prd-source "specs/payment.prd"

  REQ-PAY-040 "Ride receipt" : event-driven
    source "Feature: Invoicing — Story: Per-ride receipt — AC: Receipt with fare breakdown, route, driver, method"
    :: "Every completed ride produces a receipt — regulatory minimum"
    "When a ride is completed and payment is captured, the Payment
     system shall generate a receipt with fare breakdown, route
     summary, driver details, and payment method and deliver it
     to the rider."
    priority must

  REQ-PAY-041 "Monthly invoice for business accounts" : optional
    source "Feature: Invoicing — Story: Monthly business invoice — AC: Consolidated invoice for all business-account rides"
    :: "B2B feature — companies need consolidated invoices"
    "Where business accounts are enabled, when the monthly billing
     cycle triggers, the Payment system shall generate a consolidated
     invoice for all rides taken by the business account's riders."
    priority could

  REQ-PAY-042 "Receipt correction on refund" : event-driven
    depends-on REQ-PAY-032
    source "Feature: Invoicing — Story: Corrected receipt on refund — AC: Amended receipt reflects adjusted fare"
    :: "Amended receipt must reflect the final amount paid"
    "When a refund is issued for a completed ride, the Payment
     system shall generate a corrected receipt reflecting the
     adjusted fare and deliver it to the rider."
    priority must
}
```

## Summary

| Pattern | Count |
|---|---|
| ubiquitous | 4 |
| state-driven | 1 |
| event-driven | 12 |
| unwanted | 2 |
| optional | 2 |
| **Total** | **21** (16 must, 3 should, 2 could) |

## Cross-Context Dependencies

| Requirement | Depends on | Nature |
|---|---|---|
| REQ-PAY-011 (Pre-auth at request) | Ride Management | Payment → Ride: triggered by ride request |
| REQ-PAY-020 (Driver earnings) | Ride Management | Payment → Ride: triggered by ride completion |
| REQ-PAY-031 (System cancel refund) | Ride Management | Payment → Ride: triggered by system cancellation |
| REQ-PAY-033 (Driver-fault refund) | Driver Management | Payment → Driver: debit driver balance |
