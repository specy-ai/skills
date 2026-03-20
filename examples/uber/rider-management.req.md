# Rider Management — Requirements

Bounded Context: **Rider Management** (RDR)

Responsibility: Rider registration, profile, preferences, ratings, bans.

---

```
requirements "Rider Registration & Profile" scoped-to RiderManagement {

  REQ-RDR-001 "Rider registration" : event-driven
    :: "Frictionless signup — minimum barrier to first ride"
    "When a person signs up with a phone number, the Rider Management
     system shall create a rider profile and send a verification code."
    priority must

  REQ-RDR-002 "Phone verification" : event-driven
    :: "Verified phone is the minimum identity for accountability"
    "When the rider submits the correct verification code, the Rider
     Management system shall activate the rider profile."
    priority must

  REQ-RDR-003 "Invalid verification code" : unwanted
    :: "Prevent brute-force verification bypass"
    "If the rider submits an incorrect verification code three times,
     then the Rider Management system shall lock the verification
     attempt for 15 minutes."
    priority must

  REQ-RDR-004 "Saved addresses" : event-driven
    :: "Convenience — riders reuse home, work, favorite places"
    "When a rider saves an address, the Rider Management system shall
     store the address in the rider's profile with a label."
    priority should

  REQ-RDR-005 "Payment method association" : event-driven
    :: "A rider needs at least one payment method before requesting a ride"
    "When a rider adds a payment method, the Rider Management system
     shall validate the method with the Payment system and associate
     it with the rider profile."
    priority must

  REQ-RDR-006 "Rider profile completeness" : ubiquitous
    :: "Minimum viable profile — phone verified and payment method present"
    "The Rider Management system shall prevent a rider from requesting
     a ride unless the rider has a verified phone and at least one
     active payment method."
    priority must
}


requirements "Rider Ratings & Bans" scoped-to RiderManagement {

  REQ-RDR-010 "Rider rating submission" : event-driven
    :: "Drivers rate riders — abusive riders degrade driver retention"
    "When a driver submits a rating for a completed ride, the Rider
     Management system shall record the rating and recompute the
     rider's average rating."
    priority must

  REQ-RDR-011 "Low rating warning" : complex
    :: "Give riders a chance to improve before banning"
    "While the rider has completed more than 10 rides, if the rider's
     average rating drops below 4.0, then the Rider Management system
     shall send the rider a warning notification."
    priority should

  REQ-RDR-012 "Rider ban" : complex
    :: "Protect drivers from chronically abusive riders"
    "While the rider has completed more than 10 rides, if the rider's
     average rating drops below 3.5, then the Rider Management system
     shall ban the rider and notify them."
    priority must

  REQ-RDR-013 "Rider ban appeal" : event-driven
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
