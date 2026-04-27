# Rider Management — Requirements

Bounded Context: **Rider Management** (RDR)

Responsibility: Rider registration, profile, preferences, ratings, bans.

---

```
requirements "Rider Registration & Profile" scoped-to RiderManagement {
  prd-source "specs/rider-management.prd"

  REQ-RDR-001 "Rider registration" : event-driven
    source "Feature: Frictionless signup and verification — Story: Sign up with a phone number — AC: Create profile and send code"
    :: "Frictionless signup — minimum barrier to first ride"
    "When a person signs up with a phone number, the Rider Management
     system shall create a rider profile and send a verification code."
    priority must

  REQ-RDR-002 "Phone verification" : event-driven
    source "Feature: Frictionless signup and verification — Story: Verify my phone — AC: Valid code activates rider"
    :: "Verified phone is the minimum identity for accountability"
    "When the rider submits the correct verification code, the Rider
     Management system shall activate the rider profile."
    priority must

  REQ-RDR-003 "Invalid verification code" : unwanted
    source "Feature: Frictionless signup and verification — Story: Verify my phone — AC: Three incorrect codes lock verification for 15 minutes"
    :: "Prevent brute-force verification bypass"
    "If the rider submits an incorrect verification code three times,
     then the Rider Management system shall lock the verification
     attempt for 15 minutes."
    priority must

  REQ-RDR-004 "Saved addresses" : event-driven
    source "Feature: Saved addresses — Story: Save an address — AC: Address stored with label"
    :: "Convenience — riders reuse home, work, favorite places"
    "When a rider saves an address, the Rider Management system shall
     store the address in the rider's profile with a label."
    priority should

  REQ-RDR-005 "Payment method association" : event-driven
    source "Feature: Payment method setup before first ride — Story: Add a payment method — AC: Validated before association"
    :: "A rider needs at least one payment method before requesting a ride"
    "When a rider adds a payment method, the Rider Management system
     shall validate the method with the Payment system and associate
     it with the rider profile."
    priority must

  REQ-RDR-006 "Rider profile completeness" : ubiquitous
    source "Feature: Payment method setup before first ride — AC: No ride request without verified phone + active payment method"
    :: "Minimum viable profile — phone verified and payment method present"
    "The Rider Management system shall prevent a rider from requesting
     a ride unless the rider has a verified phone and at least one
     active payment method."
    priority must
}


requirements "Rider Ratings & Bans" scoped-to RiderManagement {
  prd-source "specs/rider-management.prd"

  REQ-RDR-010 "Rider rating submission" : event-driven
    source "Feature: Rating-driven behavior management — AC: Each completed ride produces a rating; average recomputed"
    :: "Drivers rate riders — abusive riders degrade driver retention"
    "When a driver submits a rating for a completed ride, the Rider
     Management system shall record the rating and recompute the
     rider's average rating."
    priority must

  REQ-RDR-011 "Low rating warning" : complex
    source "Feature: Rating-driven behavior management — Story: Get warned before banned — AC: Warning at avg < 4.0 after > 10 rides"
    :: "Give riders a chance to improve before banning"
    "While the rider has completed more than 10 rides, if the rider's
     average rating drops below 4.0, then the Rider Management system
     shall send the rider a warning notification."
    priority should

  REQ-RDR-012 "Rider ban" : complex
    source "Feature: Rating-driven behavior management — Story: Be banned for chronic low ratings — AC: Ban at avg < 3.5 after > 10 rides"
    :: "Protect drivers from chronically abusive riders"
    "While the rider has completed more than 10 rides, if the rider's
     average rating drops below 3.5, then the Rider Management system
     shall ban the rider and notify them."
    priority must

  REQ-RDR-013 "Rider ban appeal" : event-driven
    source "Feature: Rating-driven behavior management — Story: Appeal a ban — AC: Appeal with reason (10–2000 chars) queued for review"
    :: "Due process — riders can contest bans"
    "When a banned rider submits an appeal, the Rider Management
     system shall record the appeal and place it in review queue."
    priority should
}
```

## Summary

| Pattern | Count |
|---|---|
| ubiquitous | 1 |
| event-driven | 5 |
| unwanted | 1 |
| complex | 2 |
| **Total** | **9** (6 must, 3 should) |

## Cross-Context Dependencies

| Requirement | Depends on | Nature |
|---|---|---|
| REQ-RDR-005 (Payment method association) | Payment | Rider → Payment: validate payment method |
