# Payment — Domain Model

Bounded Context: **Payment** (PAY)

Responsibility: Fare calculation, payment processing, driver payouts, refunds, promotional credits, invoicing.

---

## Context Map

| Relationship | Direction | Pattern | Description |
|---|---|---|---|
| Payment → Ride Management | upstream | OHS | Payment exposes fare calculation and payment processing APIs consumed by Ride Management. Ride Management triggers fare estimates, authorization holds, captures, and cancellation fees through Payment's published interface. |
| Payment → Driver Management | downstream | ACL | Payment reads driver bank account details and commission tier from Driver Management. An anti-corruption layer translates Driver Management's model into Payment's own `DriverBalance` and `BankAccount` representations. |
| Payment → Notification | downstream | C/S | Payment requests delivery of receipts, payment failure alerts, payout confirmations, and refund notifications through the Notification bounded context. |

---

## Value Types

### Money
realizes: REQ-PAY-001, REQ-PAY-002, REQ-PAY-003, REQ-PAY-004

Immutable monetary amount with currency. All fare calculations, charges, refunds, and payouts are expressed as `Money`.

| Field | Type | Constraints |
|---|---|---|
| amount | decimal | min(0) |
| currency | string | maxLength(3), default("USD") |

**Invariant — nonNegativeAmount**: "A monetary amount must not be negative" — `amount >= 0`.

---

### Currency
realizes: REQ-PAY-001

Enumeration of supported ISO 4217 currency codes.

| Value |
|---|
| usd |
| eur |
| gbp |

---

### FareBreakdown
realizes: REQ-PAY-004, REQ-PAY-040

Immutable decomposition of a fare into its constituent charges. Used in receipts and rider-facing displays.

| Field | Type | Constraints |
|---|---|---|
| baseFare | Money | required |
| distanceCharge | Money | required |
| timeCharge | Money | required |
| surgeCharge | Money | required |
| tolls | Money | required |
| promotionDiscount | Money | required |
| cancellationFee | Money | optional |
| total | Money | required |

**Invariant — totalConsistency**: "Total must equal the sum of all components minus promotions" — `total.amount = baseFare.amount + distanceCharge.amount + timeCharge.amount + surgeCharge.amount + tolls.amount - promotionDiscount.amount + cancellationFee.amount`.

---

### CommissionRate
realizes: REQ-PAY-021

Immutable platform commission percentage applied to a fare.

| Field | Type | Constraints |
|---|---|---|
| percentage | decimal | min(0), max(100) |

**Invariant — validPercentage**: "Commission rate must be between 0 and 100" — `percentage >= 0 AND percentage <= 100`.

---

### FareParameters
realizes: REQ-PAY-001, REQ-PAY-002

Immutable set of parameters used by `FareCalculationService` to compute a fare.

| Field | Type | Constraints |
|---|---|---|
| baseFare | Money | required |
| perKmRate | Money | required |
| perMinuteRate | Money | required |
| surgeMultiplier | decimal | min(1.0), default(1.0) |
| minimumFare | Money | required |

---

### PaymentMethodInfo
realizes: REQ-PAY-010, REQ-PAY-015

Immutable snapshot of a payment method used in a transaction.

| Field | Type | Constraints |
|---|---|---|
| paymentMethodId | uuid | required |
| type | PaymentMethodType | required |
| last4 | string | maxLength(4) |
| isDefault | boolean | required |
| priority | int | min(1) |

---

### PayoutDetails
realizes: REQ-PAY-022, REQ-PAY-023

Immutable record of a single payout transfer.

| Field | Type | Constraints |
|---|---|---|
| payoutId | uuid | required |
| amount | Money | required |
| fee | Money | required |
| netAmount | Money | required |
| transferredAt | datetime | required |

**Invariant — netAmountConsistency**: "Net amount must equal amount minus fee" — `netAmount.amount = amount.amount - fee.amount`.

---

## Enums

### PaymentStatus
realizes: REQ-PAY-010, REQ-PAY-011, REQ-PAY-012

| Value | Description |
|---|---|
| authorized | Hold placed on rider's payment method for estimated fare |
| captured | Final fare charged successfully |
| failed | Charge attempt failed after all retries and fallbacks |
| partiallyRefunded | A partial refund has been issued |
| fullyRefunded | The full amount has been refunded |

---

### PaymentMethodType
realizes: REQ-PAY-010, REQ-PAY-015

| Value |
|---|
| creditCard |
| debitCard |
| paypal |
| applePay |
| googlePay |

---

### RefundRequestStatus
realizes: REQ-PAY-030, REQ-PAY-031, REQ-PAY-032

| Value | Description |
|---|---|
| pending | Submitted, awaiting review |
| underReview | Assigned to a backoffice agent |
| approved | Refund approved — processing |
| rejected | Refund denied |
| processed | Refund executed on payment method |

---

### RefundFaultType
realizes: REQ-PAY-032, REQ-PAY-033

| Value | Description |
|---|---|
| driverFault | Driver caused the issue — deducted from driver balance |
| platformFault | Platform caused the issue — absorbed by platform |
| disputed | Fault undetermined — under review |

---

### PromotionalCreditStatus
realizes: REQ-PAY-034, REQ-PAY-035

| Value |
|---|
| active |
| applied |
| expired |
| voided |

---

### PayoutType
realizes: REQ-PAY-022, REQ-PAY-023

| Value |
|---|
| weekly |
| instant |

---

### ReceiptStatus
realizes: REQ-PAY-040, REQ-PAY-042

| Value |
|---|
| generated |
| corrected |

---

## Entities

### Payment
realizes: REQ-PAY-010, REQ-PAY-011, REQ-PAY-012, REQ-PAY-014, REQ-PAY-015

The core entity tracking a financial transaction for a ride. Follows a state machine from authorization through capture to potential refund. Each ride has exactly one Payment.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | identifier |
| rideId | uuid | required, immutable |
| riderId | uuid | required, immutable |
| status | PaymentStatus | default("authorized") |
| estimatedAmount | Money | required |
| finalAmount | Money | optional |
| fareBreakdown | FareBreakdown | optional |
| paymentMethodUsed | PaymentMethodInfo | required |
| refundedAmount | Money | optional |
| retryCount | int | default(0), min(0), max(3) |
| debtRecorded | boolean | default(false) |
| authorizedAt | datetime | required, immutable |
| capturedAt | datetime | optional |
| failedAt | datetime | optional |
| failureReason | string | optional, maxLength(500) |
| createdAt | datetime | immutable |

**References:**

| Reference | Target | Cardinality |
|---|---|---|
| riderAccount | RiderAccount | 1..1 |

**Policies:**

- **paymentMustBeAuthorized**(payment: Payment) — realizes: REQ-PAY-010 — "Payment must be in authorized status to capture" — `payment.status = authorized`.
- **retryLimitNotExceeded**(payment: Payment) — realizes: REQ-PAY-014 — "Payment retry count must not exceed 3" — `payment.retryCount < 3`.
- **riderHasNoOutstandingDebt**(riderAccount: RiderAccount) — realizes: REQ-PAY-013 — "Rider must not have outstanding debt to authorize new payments" — `riderAccount.outstandingDebt.amount = 0`.

**Invariants:**

- **finalAmountNonNegative**: "Final amount must not be negative" — `if finalAmount is defined { finalAmount.amount >= 0 }`.
- **refundDoesNotExceedCapture**: "Refunded amount must not exceed captured amount" — `if refundedAmount is defined AND finalAmount is defined { refundedAmount.amount <= finalAmount.amount }`.

**State Machine:**

```
[*] --> authorized          on "Authorize payment for ride"
authorized --> captured     on "Capture payment after ride completion"
authorized --> fullyRefunded on "Release hold on system cancellation"
captured --> partiallyRefunded on "Process partial refund"
captured --> fullyRefunded  on "Process full refund"
captured --> failed         on "Record payment failure"
authorized --> failed       on "Record payment failure"
partiallyRefunded --> fullyRefunded on "Process full refund"
```

**Operations:**

#### "Authorize payment for ride" on AuthorizePayment
realizes: REQ-PAY-011, REQ-PAY-013

```
resolves RiderAccount from authorizePayment.riderId
precondition riderHasNoOutstandingDebt(RiderAccount)

creates Payment {
    rideId = authorizePayment.rideId
    riderId = authorizePayment.riderId
    status = authorized
    estimatedAmount = authorizePayment.estimatedAmount
    paymentMethodUsed = RiderAccount.defaultPaymentMethod
    authorizedAt = now()
}

PaymentGateway.placeHold(Payment.paymentMethodUsed, Payment.estimatedAmount)

emits PaymentAuthorized {
    paymentId = Payment.id
    rideId = Payment.rideId
    riderId = Payment.riderId
    amount = Payment.estimatedAmount
    authorizedAt = Payment.authorizedAt
}
```

#### "Capture payment after ride completion" on CapturePayment
realizes: REQ-PAY-010, REQ-PAY-002, REQ-PAY-003, REQ-PAY-004

```
resolves Payment from capturePayment.paymentId
resolves RiderAccount from Payment.riderId

precondition paymentMustBeAuthorized(Payment)

sets Payment {
    status = captured
    finalAmount = capturePayment.finalAmount
    fareBreakdown = capturePayment.fareBreakdown
    capturedAt = now()
}

PaymentGateway.captureCharge(Payment.paymentMethodUsed, Payment.finalAmount)

emits PaymentCaptured {
    paymentId = Payment.id
    rideId = Payment.rideId
    riderId = Payment.riderId
    amount = Payment.finalAmount
    fareBreakdown = Payment.fareBreakdown
    capturedAt = Payment.capturedAt
}
```

#### "Retry failed payment" on RetryPayment
realizes: REQ-PAY-014, REQ-PAY-015

```
resolves Payment from retryPayment.paymentId
resolves RiderAccount from Payment.riderId

precondition retryLimitNotExceeded(Payment)

sets Payment {
    retryCount = Payment.retryCount + 1
}

PaymentGateway.captureCharge(Payment.paymentMethodUsed, Payment.finalAmount)
// NOTE: on transient failure, exponential backoff is handled by infrastructure
// NOTE: on permanent failure after retries, falls back to next payment method per REQ-PAY-015

emits PaymentRetryAttempted {
    paymentId = Payment.id
    retryCount = Payment.retryCount
    attemptedAt = now()
}
```

#### "Fall back to next payment method" when PaymentRetryExhausted then FallbackPaymentMethod
realizes: REQ-PAY-015

```
resolves Payment from fallbackPaymentMethod.paymentId
resolves RiderAccount from Payment.riderId

sets Payment {
    paymentMethodUsed = RiderAccount.nextActivePaymentMethod(Payment.paymentMethodUsed)
    retryCount = 0
}

PaymentGateway.captureCharge(Payment.paymentMethodUsed, Payment.finalAmount)

emits PaymentMethodFallback {
    paymentId = Payment.id
    newPaymentMethodId = Payment.paymentMethodUsed.paymentMethodId
    attemptedAt = now()
}
```

#### "Record payment failure" when AllPaymentMethodsExhausted then RecordPaymentFailure
realizes: REQ-PAY-012

```
resolves Payment from recordPaymentFailure.paymentId
resolves RiderAccount from Payment.riderId

sets Payment {
    status = failed
    debtRecorded = true
    failedAt = now()
    failureReason = recordPaymentFailure.reason
}

sets RiderAccount {
    outstandingDebt = RiderAccount.outstandingDebt.amount + Payment.finalAmount.amount
}

emits PaymentFailed {
    paymentId = Payment.id
    rideId = Payment.rideId
    riderId = Payment.riderId
    amount = Payment.finalAmount
    reason = Payment.failureReason
    failedAt = Payment.failedAt
}
```

#### "Release hold on system cancellation" when RideCancelledBySystem then ReleasePaymentHold
realizes: REQ-PAY-031

```
resolves Payment from releasePaymentHold.paymentId

sets Payment {
    status = fullyRefunded
    refundedAmount = Payment.estimatedAmount
}

PaymentGateway.releaseHold(Payment.paymentMethodUsed, Payment.estimatedAmount)

emits PaymentHoldReleased {
    paymentId = Payment.id
    rideId = Payment.rideId
    riderId = Payment.riderId
    amount = Payment.estimatedAmount
    releasedAt = now()
}
```

#### "Process partial refund" on ProcessPartialRefund
realizes: REQ-PAY-032

```
resolves Payment from processPartialRefund.paymentId

sets Payment {
    status = partiallyRefunded
    refundedAmount = processPartialRefund.refundAmount
}

PaymentGateway.refund(Payment.paymentMethodUsed, processPartialRefund.refundAmount)

emits PartialRefundProcessed {
    paymentId = Payment.id
    rideId = Payment.rideId
    riderId = Payment.riderId
    refundAmount = processPartialRefund.refundAmount
    refundedAt = now()
}
```

#### "Process full refund" on ProcessFullRefund
realizes: REQ-PAY-031

```
resolves Payment from processFullRefund.paymentId

sets Payment {
    status = fullyRefunded
    refundedAmount = Payment.finalAmount
}

PaymentGateway.refund(Payment.paymentMethodUsed, Payment.finalAmount)

emits FullRefundProcessed {
    paymentId = Payment.id
    rideId = Payment.rideId
    riderId = Payment.riderId
    refundAmount = Payment.finalAmount
    refundedAt = now()
}
```

---

### RiderAccount
realizes: REQ-PAY-012, REQ-PAY-013, REQ-PAY-015, REQ-PAY-034

Tracks a rider's payment methods, outstanding debt, and promotional credits. The `outstandingDebt` field gates new ride authorizations.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | identifier |
| riderId | uuid | required, unique, immutable |
| outstandingDebt | Money | default(0) |
| createdAt | datetime | immutable |

**References:**

| Reference | Target | Cardinality |
|---|---|---|
| paymentMethods | PaymentMethodInfo | 1..N |
| promotionalCredits | PromotionalCredit | 0..N |

**Policies:**

- **hasAtLeastOnePaymentMethod**(riderAccount: RiderAccount) — realizes: REQ-PAY-010 — "Rider must have at least one active payment method" — `isNotEmpty(riderAccount.paymentMethods)`.

**Invariants:**

- **debtNonNegative**: "Outstanding debt must not be negative" — `outstandingDebt.amount >= 0`.

**Operations:**

#### "Add payment method" on AddPaymentMethod
realizes: REQ-PAY-015

```
resolves RiderAccount from addPaymentMethod.riderId

sets RiderAccount {
    paymentMethods = append(RiderAccount.paymentMethods, addPaymentMethod.paymentMethod)
}

emits PaymentMethodAdded {
    riderId = RiderAccount.riderId
    paymentMethodId = addPaymentMethod.paymentMethod.paymentMethodId
    addedAt = now()
}
```

#### "Settle outstanding debt" on SettleDebt
realizes: REQ-PAY-013

```
resolves RiderAccount from settleDebt.riderId

sets RiderAccount {
    outstandingDebt = Money { amount = 0, currency = RiderAccount.outstandingDebt.currency }
}

PaymentGateway.captureCharge(RiderAccount.defaultPaymentMethod, settleDebt.amount)

emits DebtSettled {
    riderId = RiderAccount.riderId
    amount = settleDebt.amount
    settledAt = now()
}
```

---

### PromotionalCredit
realizes: REQ-PAY-034, REQ-PAY-035

A time-limited credit on a rider's account. Auto-applied to the next eligible ride fare. Voided on expiry.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | identifier |
| riderId | uuid | required, immutable |
| amount | Money | required |
| remainingAmount | Money | required |
| status | PromotionalCreditStatus | default("active") |
| reason | string | maxLength(200) |
| expiresAt | datetime | required |
| appliedAt | datetime | optional |
| voidedAt | datetime | optional |
| createdAt | datetime | immutable |

**Invariants:**

- **remainingDoesNotExceedOriginal**: "Remaining amount must not exceed original credit amount" — `remainingAmount.amount <= amount.amount`.
- **expiryInFuture**: "Credit expiry must be in the future at creation" — `expiresAt > createdAt`.

**State Machine:**

```
[*] --> active      on "Grant promotional credit"
active --> applied  on "Apply promotional credit to fare"
active --> expired  on "Expire promotional credit"
active --> voided   on "Void promotional credit"
```

**Operations:**

#### "Grant promotional credit" on GrantPromotionalCredit
realizes: REQ-PAY-034

```
resolves RiderAccount from grantPromotionalCredit.riderId

creates PromotionalCredit {
    riderId = grantPromotionalCredit.riderId
    amount = grantPromotionalCredit.amount
    remainingAmount = grantPromotionalCredit.amount
    status = active
    reason = grantPromotionalCredit.reason
    expiresAt = grantPromotionalCredit.expiresAt
}

emits PromotionalCreditGranted {
    creditId = PromotionalCredit.id
    riderId = PromotionalCredit.riderId
    amount = PromotionalCredit.amount
    expiresAt = PromotionalCredit.expiresAt
    grantedAt = now()
}
```

#### "Apply promotional credit to fare" on ApplyPromotionalCredit
realizes: REQ-PAY-034

```
resolves PromotionalCredit from applyPromotionalCredit.creditId

sets PromotionalCredit {
    status = applied
    remainingAmount = PromotionalCredit.remainingAmount.amount - applyPromotionalCredit.appliedAmount.amount
    appliedAt = now()
}

emits PromotionalCreditApplied {
    creditId = PromotionalCredit.id
    riderId = PromotionalCredit.riderId
    appliedAmount = applyPromotionalCredit.appliedAmount
    remainingAmount = PromotionalCredit.remainingAmount
    rideId = applyPromotionalCredit.rideId
    appliedAt = PromotionalCredit.appliedAt
}
```

#### "Expire promotional credit" when CreditExpiryReached then ExpirePromotionalCredit
realizes: REQ-PAY-035

```
resolves PromotionalCredit from expirePromotionalCredit.creditId

sets PromotionalCredit {
    status = expired
    voidedAt = now()
}

emits PromotionalCreditExpired {
    creditId = PromotionalCredit.id
    riderId = PromotionalCredit.riderId
    amount = PromotionalCredit.remainingAmount
    expiredAt = now()
}
```

#### "Void promotional credit" on VoidPromotionalCredit
realizes: REQ-PAY-035

```
resolves PromotionalCredit from voidPromotionalCredit.creditId

sets PromotionalCredit {
    status = voided
    voidedAt = now()
}

emits PromotionalCreditVoided {
    creditId = PromotionalCredit.id
    riderId = PromotionalCredit.riderId
    amount = PromotionalCredit.remainingAmount
    voidedAt = now()
}
```

---

### DriverBalance
realizes: REQ-PAY-020, REQ-PAY-021, REQ-PAY-022, REQ-PAY-023, REQ-PAY-024, REQ-PAY-033

Tracks a driver's accumulated earnings from completed rides. Handles weekly and instant payouts. Driver-fault refunds deduct from this balance.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | identifier |
| driverId | uuid | required, unique, immutable |
| availableBalance | Money | default(0) |
| pendingBalance | Money | default(0) |
| totalEarnings | Money | default(0) |
| totalPayouts | Money | default(0) |
| lastPayoutAt | datetime | optional |
| createdAt | datetime | immutable |

**References:**

| Reference | Target | Cardinality |
|---|---|---|
| bankAccount | BankAccount | 1..1 |

**Policies:**

- **balanceExceedsPayoutMinimum**(driverBalance: DriverBalance, minimumThreshold: Money) — realizes: REQ-PAY-024 — "Driver balance must exceed the minimum payout threshold" — `driverBalance.availableBalance.amount >= minimumThreshold.amount`.
- **hasSufficientBalance**(driverBalance: DriverBalance, amount: Money) — realizes: REQ-PAY-033 — "Driver must have sufficient balance for deduction" — `driverBalance.availableBalance.amount >= amount.amount`.

**Invariants:**

- **balanceNonNegative**: "Available balance must not be negative" — `availableBalance.amount >= 0`.
- **earningsConsistency**: "Total earnings must equal available balance plus total payouts plus pending balance" — `totalEarnings.amount = availableBalance.amount + totalPayouts.amount + pendingBalance.amount`.

**Operations:**

#### "Credit driver earnings for ride" on CreditDriverEarnings
realizes: REQ-PAY-020, REQ-PAY-021

```
resolves DriverBalance from creditDriverEarnings.driverId

sets DriverBalance {
    availableBalance = DriverBalance.availableBalance.amount + creditDriverEarnings.driverEarnings.amount
    totalEarnings = DriverBalance.totalEarnings.amount + creditDriverEarnings.driverEarnings.amount
}

emits DriverEarningsCredited {
    driverId = DriverBalance.driverId
    rideId = creditDriverEarnings.rideId
    fareAmount = creditDriverEarnings.fareAmount
    commissionDeducted = creditDriverEarnings.commissionAmount
    driverEarnings = creditDriverEarnings.driverEarnings
    newBalance = DriverBalance.availableBalance
    creditedAt = now()
}
```

#### "Process weekly payout" on ProcessWeeklyPayout
realizes: REQ-PAY-022, REQ-PAY-024

```
resolves DriverBalance from processWeeklyPayout.driverId

precondition balanceExceedsPayoutMinimum(DriverBalance, processWeeklyPayout.minimumThreshold)

sets DriverBalance {
    pendingBalance = DriverBalance.availableBalance
    availableBalance = Money { amount = 0, currency = DriverBalance.availableBalance.currency }
}

BankTransferService.transferToBank(DriverBalance.bankAccount, DriverBalance.pendingBalance)

emits WeeklyPayoutInitiated {
    driverId = DriverBalance.driverId
    amount = DriverBalance.pendingBalance
    initiatedAt = now()
}
```

#### "Complete payout" when BankTransferCompleted then CompletePayout
realizes: REQ-PAY-022

```
resolves DriverBalance from completePayout.driverId

sets DriverBalance {
    totalPayouts = DriverBalance.totalPayouts.amount + completePayout.transferredAmount.amount
    pendingBalance = Money { amount = 0, currency = DriverBalance.pendingBalance.currency }
    lastPayoutAt = now()
}

emits PayoutCompleted {
    driverId = DriverBalance.driverId
    amount = completePayout.transferredAmount
    payoutType = weekly
    completedAt = now()
}
```

#### "Process instant payout" on ProcessInstantPayout
realizes: REQ-PAY-023, REQ-PAY-024

```
resolves DriverBalance from processInstantPayout.driverId

precondition balanceExceedsPayoutMinimum(DriverBalance, processInstantPayout.minimumThreshold)

sets DriverBalance {
    availableBalance = Money { amount = 0, currency = DriverBalance.availableBalance.currency }
    totalPayouts = DriverBalance.totalPayouts.amount + DriverBalance.availableBalance.amount - processInstantPayout.instantPayoutFee.amount
}

BankTransferService.transferToBank(DriverBalance.bankAccount, DriverBalance.availableBalance - processInstantPayout.instantPayoutFee)

emits InstantPayoutProcessed {
    driverId = DriverBalance.driverId
    grossAmount = DriverBalance.availableBalance
    fee = processInstantPayout.instantPayoutFee
    netAmount = DriverBalance.availableBalance.amount - processInstantPayout.instantPayoutFee.amount
    payoutType = instant
    processedAt = now()
}
```

#### "Deduct driver balance for driver-fault refund" on DeductDriverBalance
realizes: REQ-PAY-033

```
resolves DriverBalance from deductDriverBalance.driverId

precondition hasSufficientBalance(DriverBalance, deductDriverBalance.amount)

sets DriverBalance {
    availableBalance = DriverBalance.availableBalance.amount - deductDriverBalance.amount.amount
    totalEarnings = DriverBalance.totalEarnings.amount - deductDriverBalance.amount.amount
}

emits DriverBalanceDeducted {
    driverId = DriverBalance.driverId
    rideId = deductDriverBalance.rideId
    amount = deductDriverBalance.amount
    reason = "driver-fault refund"
    deductedAt = now()
}
```

---

### RefundRequest
realizes: REQ-PAY-030, REQ-PAY-031, REQ-PAY-032, REQ-PAY-033

A rider's request for a refund on a completed ride. Follows a review state machine. Approved refunds trigger payment refunds and driver balance adjustments.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | identifier |
| rideId | uuid | required, immutable |
| riderId | uuid | required, immutable |
| paymentId | uuid | required, immutable |
| driverId | uuid | required, immutable |
| requestedAmount | Money | required |
| approvedAmount | Money | optional |
| status | RefundRequestStatus | default("pending") |
| faultType | RefundFaultType | optional |
| reason | string | maxLength(500) |
| reviewerNotes | string | optional, maxLength(1000) |
| requestedAt | datetime | immutable |
| reviewedAt | datetime | optional |
| processedAt | datetime | optional |

**Policies:**

- **refundMustBePending**(refundRequest: RefundRequest) — realizes: REQ-PAY-030 — "Refund must be in pending status to begin review" — `refundRequest.status = pending`.
- **refundMustBeUnderReview**(refundRequest: RefundRequest) — realizes: REQ-PAY-032 — "Refund must be under review to approve or reject" — `refundRequest.status = underReview`.
- **approvedAmountDoesNotExceedRequested**(refundRequest: RefundRequest) — realizes: REQ-PAY-032 — "Approved amount must not exceed the requested refund" — `refundRequest.approvedAmount.amount <= refundRequest.requestedAmount.amount`.

**State Machine:**

```
[*] --> pending              on "Request refund"
pending --> underReview      on "Begin refund review"
underReview --> approved     on "Approve refund"
underReview --> rejected     on "Reject refund"
approved --> processed       on "Execute approved refund"
```

**Operations:**

#### "Request refund" on RequestRefund
realizes: REQ-PAY-030

```
creates RefundRequest {
    rideId = requestRefund.rideId
    riderId = requestRefund.riderId
    paymentId = requestRefund.paymentId
    driverId = requestRefund.driverId
    requestedAmount = requestRefund.requestedAmount
    status = pending
    reason = requestRefund.reason
    requestedAt = now()
}

emits RefundRequested {
    refundRequestId = RefundRequest.id
    rideId = RefundRequest.rideId
    riderId = RefundRequest.riderId
    requestedAmount = RefundRequest.requestedAmount
    requestedAt = RefundRequest.requestedAt
}
```

#### "Begin refund review" on BeginRefundReview
realizes: REQ-PAY-030

```
resolves RefundRequest from beginRefundReview.refundRequestId

precondition refundMustBePending(RefundRequest)

sets RefundRequest {
    status = underReview
}

emits RefundReviewStarted {
    refundRequestId = RefundRequest.id
    startedAt = now()
}
```

#### "Approve refund" on ApproveRefund
realizes: REQ-PAY-032, REQ-PAY-033

```
resolves RefundRequest from approveRefund.refundRequestId

precondition refundMustBeUnderReview(RefundRequest)

sets RefundRequest {
    status = approved
    approvedAmount = approveRefund.approvedAmount
    faultType = approveRefund.faultType
    reviewerNotes = approveRefund.reviewerNotes
    reviewedAt = now()
}

precondition approvedAmountDoesNotExceedRequested(RefundRequest)

emits RefundApproved {
    refundRequestId = RefundRequest.id
    rideId = RefundRequest.rideId
    riderId = RefundRequest.riderId
    paymentId = RefundRequest.paymentId
    approvedAmount = RefundRequest.approvedAmount
    faultType = RefundRequest.faultType
    approvedAt = RefundRequest.reviewedAt
}
```

#### "Reject refund" on RejectRefund
realizes: REQ-PAY-030

```
resolves RefundRequest from rejectRefund.refundRequestId

precondition refundMustBeUnderReview(RefundRequest)

sets RefundRequest {
    status = rejected
    reviewerNotes = rejectRefund.reviewerNotes
    reviewedAt = now()
}

emits RefundRejected {
    refundRequestId = RefundRequest.id
    rideId = RefundRequest.rideId
    riderId = RefundRequest.riderId
    rejectedAt = RefundRequest.reviewedAt
}
```

#### "Execute approved refund" when RefundApproved then ExecuteRefund
realizes: REQ-PAY-032, REQ-PAY-033

```
resolves RefundRequest from executeRefund.refundRequestId
resolves Payment from RefundRequest.paymentId

sets RefundRequest {
    status = processed
    processedAt = now()
}

// Determine if partial or full refund and process accordingly
if RefundRequest.approvedAmount.amount < Payment.finalAmount.amount {
    Payment.processPartialRefund(RefundRequest.approvedAmount)
} else {
    Payment.processFullRefund()
}

// If driver-fault, deduct from driver balance
if RefundRequest.faultType = driverFault {
    DriverBalance.deductDriverBalance(RefundRequest.driverId, RefundRequest.approvedAmount, RefundRequest.rideId)
}

emits RefundExecuted {
    refundRequestId = RefundRequest.id
    paymentId = RefundRequest.paymentId
    amount = RefundRequest.approvedAmount
    faultType = RefundRequest.faultType
    processedAt = RefundRequest.processedAt
}
```

---

### Receipt
realizes: REQ-PAY-040, REQ-PAY-041, REQ-PAY-042

A financial document generated after payment capture. Contains fare breakdown, route, driver details, and payment method. Can be corrected after a refund.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | identifier |
| rideId | uuid | required, immutable |
| riderId | uuid | required, immutable |
| driverId | uuid | required, immutable |
| paymentId | uuid | required, immutable |
| fareBreakdown | FareBreakdown | required |
| routeSummary | string | required, maxLength(2000) |
| driverName | string | required, maxLength(200) |
| driverLicensePlate | string | required, maxLength(20) |
| paymentMethodUsed | PaymentMethodInfo | required |
| originalTotal | Money | required |
| adjustedTotal | Money | optional |
| refundAmount | Money | optional |
| status | ReceiptStatus | default("generated") |
| generatedAt | datetime | immutable |
| correctedAt | datetime | optional |

**Invariants:**

- **adjustedTotalConsistency**: "Adjusted total must equal original total minus refund amount" — `if adjustedTotal is defined AND refundAmount is defined { adjustedTotal.amount = originalTotal.amount - refundAmount.amount }`.

**State Machine:**

```
[*] --> generated   on "Generate ride receipt"
generated --> corrected on "Correct receipt after refund"
```

**Operations:**

#### "Generate ride receipt" when PaymentCaptured then GenerateReceipt
realizes: REQ-PAY-040

```
creates Receipt {
    rideId = generateReceipt.rideId
    riderId = generateReceipt.riderId
    driverId = generateReceipt.driverId
    paymentId = generateReceipt.paymentId
    fareBreakdown = generateReceipt.fareBreakdown
    routeSummary = generateReceipt.routeSummary
    driverName = generateReceipt.driverName
    driverLicensePlate = generateReceipt.driverLicensePlate
    paymentMethodUsed = generateReceipt.paymentMethodUsed
    originalTotal = generateReceipt.fareBreakdown.total
    status = generated
    generatedAt = now()
}

// NOTE: receipt delivery to rider handled by Notification BC

emits ReceiptGenerated {
    receiptId = Receipt.id
    rideId = Receipt.rideId
    riderId = Receipt.riderId
    generatedAt = Receipt.generatedAt
}
```

#### "Correct receipt after refund" when RefundExecuted then CorrectReceipt
realizes: REQ-PAY-042

```
resolves Receipt from correctReceipt.paymentId

sets Receipt {
    status = corrected
    refundAmount = correctReceipt.refundAmount
    adjustedTotal = Receipt.originalTotal.amount - correctReceipt.refundAmount.amount
    correctedAt = now()
}

// NOTE: corrected receipt delivery to rider handled by Notification BC

emits ReceiptCorrected {
    receiptId = Receipt.id
    rideId = Receipt.rideId
    riderId = Receipt.riderId
    originalTotal = Receipt.originalTotal
    adjustedTotal = Receipt.adjustedTotal
    refundAmount = Receipt.refundAmount
    correctedAt = Receipt.correctedAt
}
```

---

## Aggregates

### PaymentAggregate
Root: **Payment**
Contains: Payment

The Payment entity is its own aggregate root. Each payment is an independent transactional boundary scoped to one ride.

---

### RiderAccountAggregate
Root: **RiderAccount**
Contains: RiderAccount, PromotionalCredit

The RiderAccount owns the rider's payment methods, debt, and promotional credits. PromotionalCredit lifecycle is managed through the RiderAccount boundary.

---

### DriverBalanceAggregate
Root: **DriverBalance**
Contains: DriverBalance

Each driver's financial balance is an independent aggregate. Earnings, deductions, and payouts are all managed through the DriverBalance root.

---

### RefundRequestAggregate
Root: **RefundRequest**
Contains: RefundRequest

Each refund request is an independent aggregate with its own review lifecycle.

---

### ReceiptAggregate
Root: **Receipt**
Contains: Receipt

Each receipt is an independent aggregate. Correction creates a new version within the same aggregate.

---

## Commands

### AuthorizePayment
realizes: REQ-PAY-011

| Field | Type | Constraints |
|---|---|---|
| rideId | uuid | required |
| riderId | uuid | required |
| estimatedAmount | Money | required |

---

### CapturePayment
realizes: REQ-PAY-010

| Field | Type | Constraints |
|---|---|---|
| paymentId | uuid | required |
| finalAmount | Money | required |
| fareBreakdown | FareBreakdown | required |

---

### RetryPayment
realizes: REQ-PAY-014

| Field | Type | Constraints |
|---|---|---|
| paymentId | uuid | required |

---

### FallbackPaymentMethod
realizes: REQ-PAY-015

| Field | Type | Constraints |
|---|---|---|
| paymentId | uuid | required |

---

### RecordPaymentFailure
realizes: REQ-PAY-012

| Field | Type | Constraints |
|---|---|---|
| paymentId | uuid | required |
| reason | string | maxLength(500) |

---

### ReleasePaymentHold
realizes: REQ-PAY-031

| Field | Type | Constraints |
|---|---|---|
| paymentId | uuid | required |

---

### ProcessPartialRefund
realizes: REQ-PAY-032

| Field | Type | Constraints |
|---|---|---|
| paymentId | uuid | required |
| refundAmount | Money | required |

---

### ProcessFullRefund
realizes: REQ-PAY-031

| Field | Type | Constraints |
|---|---|---|
| paymentId | uuid | required |

---

### AddPaymentMethod
realizes: REQ-PAY-015

| Field | Type | Constraints |
|---|---|---|
| riderId | uuid | required |
| paymentMethod | PaymentMethodInfo | required |

---

### SettleDebt
realizes: REQ-PAY-013

| Field | Type | Constraints |
|---|---|---|
| riderId | uuid | required |
| amount | Money | required |

---

### GrantPromotionalCredit
realizes: REQ-PAY-034

| Field | Type | Constraints |
|---|---|---|
| riderId | uuid | required |
| amount | Money | required |
| reason | string | maxLength(200) |
| expiresAt | datetime | required, future |

---

### ApplyPromotionalCredit
realizes: REQ-PAY-034

| Field | Type | Constraints |
|---|---|---|
| creditId | uuid | required |
| rideId | uuid | required |
| appliedAmount | Money | required |

---

### ExpirePromotionalCredit
realizes: REQ-PAY-035

| Field | Type | Constraints |
|---|---|---|
| creditId | uuid | required |

---

### VoidPromotionalCredit
realizes: REQ-PAY-035

| Field | Type | Constraints |
|---|---|---|
| creditId | uuid | required |

---

### CreditDriverEarnings
realizes: REQ-PAY-020, REQ-PAY-021

| Field | Type | Constraints |
|---|---|---|
| driverId | uuid | required |
| rideId | uuid | required |
| fareAmount | Money | required |
| commissionAmount | Money | required |
| driverEarnings | Money | required |

---

### ProcessWeeklyPayout
realizes: REQ-PAY-022, REQ-PAY-024

| Field | Type | Constraints |
|---|---|---|
| driverId | uuid | required |
| minimumThreshold | Money | required |

---

### CompletePayout
realizes: REQ-PAY-022

| Field | Type | Constraints |
|---|---|---|
| driverId | uuid | required |
| transferredAmount | Money | required |

---

### ProcessInstantPayout
realizes: REQ-PAY-023, REQ-PAY-024

| Field | Type | Constraints |
|---|---|---|
| driverId | uuid | required |
| minimumThreshold | Money | required |
| instantPayoutFee | Money | required |

---

### DeductDriverBalance
realizes: REQ-PAY-033

| Field | Type | Constraints |
|---|---|---|
| driverId | uuid | required |
| rideId | uuid | required |
| amount | Money | required |

---

### RequestRefund
realizes: REQ-PAY-030

| Field | Type | Constraints |
|---|---|---|
| rideId | uuid | required |
| riderId | uuid | required |
| paymentId | uuid | required |
| driverId | uuid | required |
| requestedAmount | Money | required |
| reason | string | maxLength(500) |

---

### BeginRefundReview
realizes: REQ-PAY-030

| Field | Type | Constraints |
|---|---|---|
| refundRequestId | uuid | required |

---

### ApproveRefund
realizes: REQ-PAY-032, REQ-PAY-033

| Field | Type | Constraints |
|---|---|---|
| refundRequestId | uuid | required |
| approvedAmount | Money | required |
| faultType | RefundFaultType | required |
| reviewerNotes | string | optional, maxLength(1000) |

---

### RejectRefund
realizes: REQ-PAY-030

| Field | Type | Constraints |
|---|---|---|
| refundRequestId | uuid | required |
| reviewerNotes | string | optional, maxLength(1000) |

---

### ExecuteRefund
realizes: REQ-PAY-032

| Field | Type | Constraints |
|---|---|---|
| refundRequestId | uuid | required |

---

### GenerateReceipt
realizes: REQ-PAY-040

| Field | Type | Constraints |
|---|---|---|
| rideId | uuid | required |
| riderId | uuid | required |
| driverId | uuid | required |
| paymentId | uuid | required |
| fareBreakdown | FareBreakdown | required |
| routeSummary | string | maxLength(2000) |
| driverName | string | maxLength(200) |
| driverLicensePlate | string | maxLength(20) |
| paymentMethodUsed | PaymentMethodInfo | required |

---

### CorrectReceipt
realizes: REQ-PAY-042

| Field | Type | Constraints |
|---|---|---|
| paymentId | uuid | required |
| refundAmount | Money | required |

---

### ComputeFareEstimate
realizes: REQ-PAY-001

| Field | Type | Constraints |
|---|---|---|
| pickupLocation | string | required |
| dropoffLocation | string | required |
| rideType | string | required |
| distanceKm | decimal | required, min(0) |
| estimatedMinutes | decimal | required, min(0) |
| fareParameters | FareParameters | required |

---

### ComputeFinalFare
realizes: REQ-PAY-002

| Field | Type | Constraints |
|---|---|---|
| rideId | uuid | required |
| actualDistanceKm | decimal | required, min(0) |
| actualMinutes | decimal | required, min(0) |
| fareParameters | FareParameters | required |
| tolls | Money | optional |
| promotionDiscount | Money | optional |

---

### ComputeCancellationFee
realizes: REQ-PAY-005

| Field | Type | Constraints |
|---|---|---|
| rideId | uuid | required |
| minutesSinceAssignment | decimal | required, min(0) |
| cancellationPolicy | string | required |

---

## Events

### PaymentAuthorized
realizes: REQ-PAY-011

| Field | Type |
|---|---|
| paymentId | uuid |
| rideId | uuid |
| riderId | uuid |
| amount | Money |
| authorizedAt | datetime |

---

### PaymentCaptured
realizes: REQ-PAY-010

| Field | Type |
|---|---|
| paymentId | uuid |
| rideId | uuid |
| riderId | uuid |
| amount | Money |
| fareBreakdown | FareBreakdown |
| capturedAt | datetime |

---

### PaymentRetryAttempted
realizes: REQ-PAY-014

| Field | Type |
|---|---|
| paymentId | uuid |
| retryCount | int |
| attemptedAt | datetime |

---

### PaymentRetryExhausted
realizes: REQ-PAY-014, REQ-PAY-015

| Field | Type |
|---|---|
| paymentId | uuid |
| totalRetries | int |
| exhaustedAt | datetime |

---

### PaymentMethodFallback
realizes: REQ-PAY-015

| Field | Type |
|---|---|
| paymentId | uuid |
| newPaymentMethodId | uuid |
| attemptedAt | datetime |

---

### AllPaymentMethodsExhausted
realizes: REQ-PAY-012

| Field | Type |
|---|---|
| paymentId | uuid |
| reason | string |
| exhaustedAt | datetime |

---

### PaymentFailed
realizes: REQ-PAY-012

| Field | Type |
|---|---|
| paymentId | uuid |
| rideId | uuid |
| riderId | uuid |
| amount | Money |
| reason | string |
| failedAt | datetime |

---

### PaymentHoldReleased
realizes: REQ-PAY-031

| Field | Type |
|---|---|
| paymentId | uuid |
| rideId | uuid |
| riderId | uuid |
| amount | Money |
| releasedAt | datetime |

---

### PartialRefundProcessed
realizes: REQ-PAY-032

| Field | Type |
|---|---|
| paymentId | uuid |
| rideId | uuid |
| riderId | uuid |
| refundAmount | Money |
| refundedAt | datetime |

---

### FullRefundProcessed
realizes: REQ-PAY-031

| Field | Type |
|---|---|
| paymentId | uuid |
| rideId | uuid |
| riderId | uuid |
| refundAmount | Money |
| refundedAt | datetime |

---

### PaymentMethodAdded
realizes: REQ-PAY-015

| Field | Type |
|---|---|
| riderId | uuid |
| paymentMethodId | uuid |
| addedAt | datetime |

---

### DebtSettled
realizes: REQ-PAY-013

| Field | Type |
|---|---|
| riderId | uuid |
| amount | Money |
| settledAt | datetime |

---

### PromotionalCreditGranted
realizes: REQ-PAY-034

| Field | Type |
|---|---|
| creditId | uuid |
| riderId | uuid |
| amount | Money |
| expiresAt | datetime |
| grantedAt | datetime |

---

### PromotionalCreditApplied
realizes: REQ-PAY-034

| Field | Type |
|---|---|
| creditId | uuid |
| riderId | uuid |
| appliedAmount | Money |
| remainingAmount | Money |
| rideId | uuid |
| appliedAt | datetime |

---

### PromotionalCreditExpired
realizes: REQ-PAY-035

| Field | Type |
|---|---|
| creditId | uuid |
| riderId | uuid |
| amount | Money |
| expiredAt | datetime |

---

### PromotionalCreditVoided
realizes: REQ-PAY-035

| Field | Type |
|---|---|
| creditId | uuid |
| riderId | uuid |
| amount | Money |
| voidedAt | datetime |

---

### DriverEarningsCredited
realizes: REQ-PAY-020, REQ-PAY-021

| Field | Type |
|---|---|
| driverId | uuid |
| rideId | uuid |
| fareAmount | Money |
| commissionDeducted | Money |
| driverEarnings | Money |
| newBalance | Money |
| creditedAt | datetime |

---

### WeeklyPayoutInitiated
realizes: REQ-PAY-022

| Field | Type |
|---|---|
| driverId | uuid |
| amount | Money |
| initiatedAt | datetime |

---

### PayoutCompleted
realizes: REQ-PAY-022

| Field | Type |
|---|---|
| driverId | uuid |
| amount | Money |
| payoutType | PayoutType |
| completedAt | datetime |

---

### InstantPayoutProcessed
realizes: REQ-PAY-023

| Field | Type |
|---|---|
| driverId | uuid |
| grossAmount | Money |
| fee | Money |
| netAmount | Money |
| payoutType | PayoutType |
| processedAt | datetime |

---

### BankTransferCompleted
realizes: REQ-PAY-022

External event from BankTransferService infrastructure.

| Field | Type |
|---|---|
| driverId | uuid |
| transferredAmount | Money |
| completedAt | datetime |

---

### DriverBalanceDeducted
realizes: REQ-PAY-033

| Field | Type |
|---|---|
| driverId | uuid |
| rideId | uuid |
| amount | Money |
| reason | string |
| deductedAt | datetime |

---

### RefundRequested
realizes: REQ-PAY-030

| Field | Type |
|---|---|
| refundRequestId | uuid |
| rideId | uuid |
| riderId | uuid |
| requestedAmount | Money |
| requestedAt | datetime |

---

### RefundReviewStarted
realizes: REQ-PAY-030

| Field | Type |
|---|---|
| refundRequestId | uuid |
| startedAt | datetime |

---

### RefundApproved
realizes: REQ-PAY-032, REQ-PAY-033

| Field | Type |
|---|---|
| refundRequestId | uuid |
| rideId | uuid |
| riderId | uuid |
| paymentId | uuid |
| approvedAmount | Money |
| faultType | RefundFaultType |
| approvedAt | datetime |

---

### RefundRejected
realizes: REQ-PAY-030

| Field | Type |
|---|---|
| refundRequestId | uuid |
| rideId | uuid |
| riderId | uuid |
| rejectedAt | datetime |

---

### RefundExecuted
realizes: REQ-PAY-032

| Field | Type |
|---|---|
| refundRequestId | uuid |
| paymentId | uuid |
| amount | Money |
| faultType | RefundFaultType |
| processedAt | datetime |

---

### ReceiptGenerated
realizes: REQ-PAY-040

| Field | Type |
|---|---|
| receiptId | uuid |
| rideId | uuid |
| riderId | uuid |
| generatedAt | datetime |

---

### ReceiptCorrected
realizes: REQ-PAY-042

| Field | Type |
|---|---|
| receiptId | uuid |
| rideId | uuid |
| riderId | uuid |
| originalTotal | Money |
| adjustedTotal | Money |
| refundAmount | Money |
| correctedAt | datetime |

---

### RideCancelledBySystem
realizes: REQ-PAY-031

External event from Ride Management BC.

| Field | Type |
|---|---|
| rideId | uuid |
| paymentId | uuid |
| reason | string |
| cancelledAt | datetime |

---

### CreditExpiryReached
realizes: REQ-PAY-035

**This is now modeled as a temporal event** — see Temporal Events section below.

---

## Temporal Events

```
// =============================================================================
// Temporal Events — time-triggered domain facts
// =============================================================================

// realizes: REQ-PAY-035
// Fires when a promotional credit reaches its expiry date.
// Replaces the previous "Scheduler-triggered event" modeling.
temporal event CreditExpiryReached {
    trigger : absolute
    instant : credit.expiresAt
    guard   : credit.status = active
    // If the credit was already applied or voided, the guard is false → suppressed
}

// realizes: REQ-PAY-022
// Fires every Monday at midnight UTC to trigger the weekly payout cycle.
temporal event WeeklyPayoutCycleDue {
    trigger  : recurring
    schedule : "0 0 * * MON"       // every Monday at 00:00 UTC
    guard    : true                 // always fires on schedule
}
```

### Temporal event → reaction → command chains

| Temporal Event | Triggers Policy | Policy Effects Command |
|---|---|---|
| `CreditExpiryReached` | `ExpirePromotionalCreditsOnSchedule` | `ExpirePromotionalCredit` |
| `WeeklyPayoutCycleDue` | `initiateWeeklyPayouts` | `ProcessWeeklyPayout` (for each eligible driver) |

```
// realizes: REQ-PAY-035
// Already defined in Policies section as ExpirePromotionalCreditsOnSchedule.
// Trigger updated from "scheduled event" to temporal event CreditExpiryReached.

// realizes: REQ-PAY-022
reaction initiateWeeklyPayouts {
    trigger : WeeklyPayoutCycleDue
    guard   : true
    effect  : ProcessWeeklyPayout { for each DriverBalance where balance > minimumPayoutThreshold }
    :: "Weekly payout cycle — transfer accumulated balances to drivers"
}
```

---

## Queries

### GetFareEstimate
realizes: REQ-PAY-001

Returns the estimated fare breakdown for a prospective ride.

| Parameter | Type |
|---|---|
| pickupLocation | string |
| dropoffLocation | string |
| rideType | string |

Returns: `FareBreakdown`

---

### GetPaymentByRide
realizes: REQ-PAY-010

Returns the payment record for a given ride.

| Parameter | Type |
|---|---|
| rideId | uuid |

Returns: `Payment`

---

### GetFareBreakdown
realizes: REQ-PAY-004

Returns the detailed fare breakdown for a completed ride payment.

| Parameter | Type |
|---|---|
| paymentId | uuid |

Returns: `FareBreakdown`

---

### GetDriverBalance
realizes: REQ-PAY-020

Returns the current balance and earnings summary for a driver.

| Parameter | Type |
|---|---|
| driverId | uuid |

Returns: `DriverBalance`

---

### GetDriverPayoutHistory
realizes: REQ-PAY-022, REQ-PAY-023

Returns the list of completed payouts for a driver.

| Parameter | Type |
|---|---|
| driverId | uuid |
| fromDate | datetime |
| toDate | datetime |

Returns: `list<PayoutDetails>`

---

### GetRiderOutstandingDebt
realizes: REQ-PAY-013

Returns the rider's current outstanding debt amount.

| Parameter | Type |
|---|---|
| riderId | uuid |

Returns: `Money`

---

### GetRefundRequest
realizes: REQ-PAY-030

Returns a refund request by its identifier.

| Parameter | Type |
|---|---|
| refundRequestId | uuid |

Returns: `RefundRequest`

---

### FindPendingRefundRequests
realizes: REQ-PAY-030

Returns all refund requests in the review queue (pending or under review).

| Parameter | Type |
|---|---|
| status | RefundRequestStatus | optional |
| page | int |
| pageSize | int |

Returns: `list<RefundRequest>`

---

### GetReceipt
realizes: REQ-PAY-040

Returns the receipt for a given ride.

| Parameter | Type |
|---|---|
| rideId | uuid |

Returns: `Receipt`

---

### GetRiderPromotionalCredits
realizes: REQ-PAY-034

Returns all active promotional credits for a rider.

| Parameter | Type |
|---|---|
| riderId | uuid |

Returns: `list<PromotionalCredit>`

---

### GetMonthlyInvoice
realizes: REQ-PAY-041

Returns a consolidated monthly invoice for a business account.

| Parameter | Type |
|---|---|
| businessAccountId | uuid |
| month | int |
| year | int |

Returns: `MonthlyInvoice`

---

## Domain Services

### FareCalculationService
realizes: REQ-PAY-001, REQ-PAY-002, REQ-PAY-003, REQ-PAY-004, REQ-PAY-005

Stateless service that computes fare estimates, final fares, and cancellation fees. Enforces minimum fare and produces fare breakdowns.

**Operations:**

#### computeEstimate(distanceKm: decimal, estimatedMinutes: decimal, fareParameters: FareParameters): FareBreakdown
realizes: REQ-PAY-001, REQ-PAY-003, REQ-PAY-004

"Compute an upfront fare estimate for a prospective ride."

```
baseFare = fareParameters.baseFare
distanceCharge = fareParameters.perKmRate.amount * distanceKm
timeCharge = fareParameters.perMinuteRate.amount * estimatedMinutes
surgeCharge = (baseFare.amount + distanceCharge + timeCharge) * (fareParameters.surgeMultiplier - 1)
rawTotal = baseFare.amount + distanceCharge + timeCharge + surgeCharge

// REQ-PAY-003: enforce minimum fare
total = max(rawTotal, fareParameters.minimumFare.amount)

returns FareBreakdown {
    baseFare = fareParameters.baseFare
    distanceCharge = Money { amount = distanceCharge, currency = fareParameters.baseFare.currency }
    timeCharge = Money { amount = timeCharge, currency = fareParameters.baseFare.currency }
    surgeCharge = Money { amount = surgeCharge, currency = fareParameters.baseFare.currency }
    tolls = Money { amount = 0, currency = fareParameters.baseFare.currency }
    promotionDiscount = Money { amount = 0, currency = fareParameters.baseFare.currency }
    total = Money { amount = total, currency = fareParameters.baseFare.currency }
}
```

---

#### computeFinalFare(actualDistanceKm: decimal, actualMinutes: decimal, fareParameters: FareParameters, tolls: Money, promotionDiscount: Money): FareBreakdown
realizes: REQ-PAY-002, REQ-PAY-003, REQ-PAY-004

"Compute the final fare after ride completion using actual distance and duration."

```
baseFare = fareParameters.baseFare
distanceCharge = fareParameters.perKmRate.amount * actualDistanceKm
timeCharge = fareParameters.perMinuteRate.amount * actualMinutes
surgeCharge = (baseFare.amount + distanceCharge + timeCharge) * (fareParameters.surgeMultiplier - 1)
rawTotal = baseFare.amount + distanceCharge + timeCharge + surgeCharge + tolls.amount - promotionDiscount.amount

// REQ-PAY-003: enforce minimum fare
total = max(rawTotal, fareParameters.minimumFare.amount)

returns FareBreakdown {
    baseFare = fareParameters.baseFare
    distanceCharge = Money { amount = distanceCharge, currency = fareParameters.baseFare.currency }
    timeCharge = Money { amount = timeCharge, currency = fareParameters.baseFare.currency }
    surgeCharge = Money { amount = surgeCharge, currency = fareParameters.baseFare.currency }
    tolls = tolls
    promotionDiscount = promotionDiscount
    total = Money { amount = total, currency = fareParameters.baseFare.currency }
}
```

---

#### computeCancellationFee(minutesSinceAssignment: decimal, cancellationPolicy: string): Money
realizes: REQ-PAY-005

"Compute the cancellation fee based on elapsed time and the applicable cancellation policy."

```
// NOTE: cancellation policy details (grace period, fee tiers) are configuration-driven
// Typical: no fee if cancelled within 2 minutes, flat fee otherwise
returns Money { amount = computedFee, currency = "USD" }
```

---

#### computeDriverEarnings(fareAmount: Money, commissionRate: CommissionRate): Money
realizes: REQ-PAY-020, REQ-PAY-021

"Compute driver earnings by deducting the platform commission from the fare."

```
commissionAmount = fareAmount.amount * (commissionRate.percentage / 100)
driverEarnings = fareAmount.amount - commissionAmount

returns Money { amount = driverEarnings, currency = fareAmount.currency }
```

---

## Policies

### AutoApplyPromotionalCredit
realizes: REQ-PAY-034

**Trigger:** PaymentAuthorized
**Guard:** RiderAccount has at least one active PromotionalCredit not yet expired.
**Effect:** ApplyPromotionalCredit — apply the oldest active credit to the fare, reducing the capture amount.

---

### RecordDebtOnPaymentFailure
realizes: REQ-PAY-012

**Trigger:** PaymentFailed
**Guard:** Payment.debtRecorded = true.
**Effect:** Notification BC is invoked to notify the rider of the outstanding debt and available settlement options.

---

### BlockNewRidesOnDebt
realizes: REQ-PAY-013

**Trigger:** AuthorizePayment (precondition)
**Guard:** RiderAccount.outstandingDebt.amount > 0.
**Effect:** Reject the authorization — the rider must settle the debt before requesting a new ride.

---

### AutoRefundOnSystemCancellation
realizes: REQ-PAY-031

**Trigger:** RideCancelledBySystem (external event from Ride Management)
**Guard:** Payment exists and status = authorized.
**Effect:** ReleasePaymentHold — release the authorization hold and, if a charge occurred, issue a full refund.

---

### CreditDriverAfterCapture
realizes: REQ-PAY-020, REQ-PAY-021

**Trigger:** PaymentCaptured
**Guard:** Always fires.
**Effect:** CreditDriverEarnings — compute driver earnings (fare minus commission) and credit the driver's balance.

---

### DeductDriverOnFaultRefund
realizes: REQ-PAY-033

**Trigger:** RefundApproved where faultType = driverFault.
**Guard:** RefundRequest.faultType = driverFault.
**Effect:** DeductDriverBalance — deduct the refund amount from the driver's available balance.

---

### GenerateReceiptAfterCapture
realizes: REQ-PAY-040

**Trigger:** PaymentCaptured
**Guard:** Always fires.
**Effect:** GenerateReceipt — create a receipt with fare breakdown, route, driver details, and payment method.

---

### CorrectReceiptAfterRefund
realizes: REQ-PAY-042

**Trigger:** RefundExecuted
**Guard:** Receipt exists for the payment.
**Effect:** CorrectReceipt — generate a corrected receipt reflecting the adjusted fare.

---

### ExpirePromotionalCreditsOnSchedule
realizes: REQ-PAY-035

**Trigger:** CreditExpiryReached (scheduled event)
**Guard:** PromotionalCredit.status = active AND PromotionalCredit.expiresAt <= now().
**Effect:** ExpirePromotionalCredit — void the credit and remove it from the rider's available balance.

---

### RetryPaymentOnTransientFailure
realizes: REQ-PAY-014

**Trigger:** PaymentRetryAttempted (when capture fails with transient error)
**Guard:** Payment.retryCount < 3.
**Effect:** RetryPayment — retry the charge with exponential backoff (infrastructure-managed delay).

---

### FallbackOnRetryExhaustion
realizes: REQ-PAY-015

**Trigger:** PaymentRetryExhausted
**Guard:** RiderAccount has additional active payment methods.
**Effect:** FallbackPaymentMethod — switch to the next active payment method and reset retry count.

---

## Infrastructure Services

### PaymentGateway
realizes: REQ-PAY-010, REQ-PAY-011, REQ-PAY-014, REQ-PAY-015, REQ-PAY-031, REQ-PAY-032

External payment processor adapter (Stripe, Braintree, Adyen, etc.). Handles authorization holds, charge captures, refunds, and payment method validation.

**Operations:**

| Operation | Signature | Description |
|---|---|---|
| placeHold | (paymentMethod: PaymentMethodInfo, amount: Money): void | Place an authorization hold on the rider's payment method for the estimated fare. |
| captureCharge | (paymentMethod: PaymentMethodInfo, amount: Money): void | Capture (finalize) a charge on the rider's payment method. |
| releaseHold | (paymentMethod: PaymentMethodInfo, amount: Money): void | Release a previously placed authorization hold without charging. |
| refund | (paymentMethod: PaymentMethodInfo, amount: Money): void | Refund a specified amount to the rider's original payment method. |
| validatePaymentMethod | (paymentMethod: PaymentMethodInfo): boolean | Verify that a payment method is valid and active with the payment processor. |

---

### BankTransferService
realizes: REQ-PAY-022, REQ-PAY-023

External banking adapter for driver payouts. Handles ACH transfers, wire transfers, and instant transfer providers.

**Operations:**

| Operation | Signature | Description |
|---|---|---|
| transferToBank | (bankAccount: BankAccount, amount: Money): void | Initiate a bank transfer of the specified amount to the driver's registered bank account. Publishes BankTransferCompleted on success. |
| getTransferStatus | (transferId: uuid): string | Query the status of a pending bank transfer. |

---

### InvoicingService
realizes: REQ-PAY-041

External or internal invoicing adapter for generating consolidated monthly invoices for business accounts.

**Operations:**

| Operation | Signature | Description |
|---|---|---|
| generateMonthlyInvoice | (businessAccountId: uuid, month: int, year: int): MonthlyInvoice | Generate a consolidated invoice covering all rides for a business account in the given month. |

---

## Requirements Traceability Matrix

| Requirement | Realized By |
|---|---|
| REQ-PAY-001 | FareCalculationService.computeEstimate, FareParameters, FareBreakdown, GetFareEstimate, ComputeFareEstimate |
| REQ-PAY-002 | FareCalculationService.computeFinalFare, CapturePayment, ComputeFinalFare |
| REQ-PAY-003 | FareCalculationService.computeEstimate, FareCalculationService.computeFinalFare (minimum fare enforcement) |
| REQ-PAY-004 | FareBreakdown, FareCalculationService, GetFareBreakdown |
| REQ-PAY-005 | FareCalculationService.computeCancellationFee, ComputeCancellationFee |
| REQ-PAY-010 | Payment, CapturePayment, PaymentCaptured, PaymentGateway.captureCharge |
| REQ-PAY-011 | Payment, AuthorizePayment, PaymentAuthorized, PaymentGateway.placeHold |
| REQ-PAY-012 | Payment (RecordPaymentFailure), RiderAccount (outstandingDebt), PaymentFailed, RecordDebtOnPaymentFailure |
| REQ-PAY-013 | RiderAccount (outstandingDebt), riderHasNoOutstandingDebt precondition, BlockNewRidesOnDebt, SettleDebt |
| REQ-PAY-014 | Payment (RetryPayment), retryLimitNotExceeded precondition, RetryPaymentOnTransientFailure |
| REQ-PAY-015 | Payment (FallbackPaymentMethod), RiderAccount (paymentMethods), FallbackOnRetryExhaustion |
| REQ-PAY-020 | DriverBalance (CreditDriverEarnings), FareCalculationService.computeDriverEarnings, CreditDriverAfterCapture |
| REQ-PAY-021 | CommissionRate, FareCalculationService.computeDriverEarnings, DriverBalance (CreditDriverEarnings) |
| REQ-PAY-022 | DriverBalance (ProcessWeeklyPayout, CompletePayout), PayoutCompleted, BankTransferService |
| REQ-PAY-023 | DriverBalance (ProcessInstantPayout), InstantPayoutProcessed, BankTransferService |
| REQ-PAY-024 | balanceExceedsPayoutMinimum precondition, ProcessWeeklyPayout, ProcessInstantPayout |
| REQ-PAY-030 | RefundRequest (RequestRefund, BeginRefundReview, RejectRefund), FindPendingRefundRequests |
| REQ-PAY-031 | Payment (ReleasePaymentHold, ProcessFullRefund), AutoRefundOnSystemCancellation |
| REQ-PAY-032 | Payment (ProcessPartialRefund), RefundRequest (ApproveRefund, ExecuteRefund), PartialRefundProcessed |
| REQ-PAY-033 | DriverBalance (DeductDriverBalance), RefundRequest (faultType = driverFault), DeductDriverOnFaultRefund |
| REQ-PAY-034 | PromotionalCredit (GrantPromotionalCredit, ApplyPromotionalCredit), AutoApplyPromotionalCredit |
| REQ-PAY-035 | PromotionalCredit (ExpirePromotionalCredit, VoidPromotionalCredit), ExpirePromotionalCreditsOnSchedule |
| REQ-PAY-040 | Receipt (GenerateReceipt), GenerateReceiptAfterCapture, GetReceipt |
| REQ-PAY-041 | InvoicingService.generateMonthlyInvoice, GetMonthlyInvoice |
| REQ-PAY-042 | Receipt (CorrectReceipt), CorrectReceiptAfterRefund, ReceiptCorrected |
