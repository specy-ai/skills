# Requirements — RideNow (Uber-like ride-hailing platform)

This directory captures the requirements for a ride-hailing platform organized into five bounded contexts. Requirements follow the EARS syntax defined in the top-level [SYSTEM-REQ-METAMODEL.md](../../SYSTEM-REQ-METAMODEL.md). Satisfaction links are intentionally left empty — they will be populated once the domain model is formalized.

## Bounded Contexts

| Bounded Context | Shortname | File | Responsibility |
|---|---|---|---|
| Driver Management | DRV | [driver-management.sysreq.md](driver-management.sysreq.md) | Onboarding, identity verification, vehicle registration, availability, ratings, suspension |
| Rider Management | RDR | [rider-management.sysreq.md](rider-management.sysreq.md) | Rider registration, profile, preferences, ratings, bans |
| Ride Management | RIDE | [ride-management.sysreq.md](ride-management.sysreq.md) | Ride lifecycle from request to completion — matching, dispatch, tracking, cancellation, completion |
| Geolocation & Routing | GEO | [geolocation-routing.sysreq.md](geolocation-routing.sysreq.md) | Real-time driver positioning, ETA computation, route calculation, surge zone detection |
| Payment | PAY | [payment.sysreq.md](payment.sysreq.md) | Fare calculation, payment processing, driver payouts, refunds, invoicing |

## Requirement Summary

| Bounded Context | Prefix | Count | Must | Should | Could |
|---|---|---|---|---|---|
| Driver Management | DRV | 14 | 10 | 4 | 0 |
| Rider Management | RDR | 9 | 6 | 3 | 0 |
| Ride Management | RIDE | 22 | 17 | 4 | 1 |
| Geolocation & Routing | GEO | 10 | 7 | 3 | 0 |
| Payment | PAY | 21 | 16 | 3 | 2 |
| **Total** | | **76** | **56** | **17** | **3** |

## Cross-Context Dependencies

These requirements create obligations across bounded context boundaries:

| Requirement | Depends on BC | Nature |
|---|---|---|
| REQ-RIDE-003 (Fare estimate at request) | Payment | Ride → Payment: compute estimate |
| REQ-RIDE-004 (Driver matching) | Geolocation | Ride → Geo: nearby driver query |
| REQ-RIDE-013 (Ride tracking) | Geolocation | Ride → Geo: location stream |
| REQ-RIDE-015 (Fare finalization) | Payment | Ride → Payment: compute final fare |
| REQ-RIDE-016 (Auto payment) | Payment | Ride → Payment: capture |
| REQ-RDR-005 (Payment method) | Payment | Rider → Payment: validate method |
| REQ-GEO-023 (Surge transparency) | Ride | Geo → Ride: display surge |
| REQ-PAY-011 (Pre-auth) | Ride | Payment → Ride: hold at request |
| REQ-PAY-020 (Driver earnings) | Ride | Payment → Ride: on completion |
| REQ-PAY-031 (System cancel refund) | Ride | Payment → Ride: on cancellation |
| REQ-PAY-033 (Driver-fault refund) | Driver | Payment → Driver: balance deduction |

These cross-context dependencies will materialize as context map patterns (OHS, ACL, C/S) once the domain model is formalized.
