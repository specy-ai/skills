# System Requirements — RideNow

This directory captures the **system requirements** for RideNow, organized into 5 bounded contexts plus a cross-cutting NFR set. Requirements follow EARS syntax and trace back to `ride-now.prd` via each requirement's `source` field.

## PRD source

Every requirement set declares `prd-source "ride-now.prd"` — the upstream PRD is the sibling file [`ride-now.prd`](./ride-now.prd).

## Bounded Contexts

| Bounded Context | Prefix | File | Responsibility |
|---|---|---|---|
| Driver Management | DRV | [`driver-management.sysreq`](./driver-management.sysreq) | Onboarding, identity verification, vehicle registration, availability, ratings, suspension, appeals |
| Rider Management | RDR | [`rider-management.sysreq`](./rider-management.sysreq) | Signup, phone verification, saved addresses, ratings, bans, appeals |
| Ride Management | RIDE | [`ride-management.sysreq`](./ride-management.sysreq) | Ride lifecycle — upfront fare, matching, pickup-to-completion, cancellations, safety |
| Geolocation & Routing | GEO | [`geolocation-routing.sysreq`](./geolocation-routing.sysreq) | Positioning, proximity queries, ETA, routing, surge zones |
| Payment | PAY | [`payment.sysreq`](./payment.sysreq) | Method validation, fares, pre-auth & capture, payouts, refunds, receipts |
| Platform NFR (organization) | NFR | [`platform-nfr.sysreq`](./platform-nfr.sysreq) | Cross-cutting: availability, security, compliance, observability, regulation |

## Summary

| Set | File | Must | Should | Could | Total |
|---|---|---|---|---|---|
| Driver Management | `driver-management.sysreq` | 28 | 4 | 0 | 32 |
| Rider Management | `rider-management.sysreq` | 13 | 9 | 0 | 22 |
| Ride Management | `ride-management.sysreq` | 40 | 5 | 3 (scheduled) | 48 |
| Geolocation & Routing | `geolocation-routing.sysreq` | 16 | 3 | 0 | 19 |
| Payment | `payment.sysreq` | 34 | 3 | 3 (instant payout) | 40 |
| Platform NFR | `platform-nfr.sysreq` | 18 | 0 | 0 | 18 |
| **Total** | | **149** | **24** | **6** | **179** |

## Traceability

```
ride-now.prd                        ← product decisions (personas, jobs, features, goals)
  ↓  prd-source
*.sysreq                         ← system obligations (EARS, this directory)
  ↑  satisfies (populated by downstream domain model)
*.domain                            ← realization (not yet authored)
```

Each requirement's `source "Feature: <name> — AC: <text>"` field is a grep-able pointer into `ride-now.prd`.

## Cross-Context Dependency Matrix

Cross-context obligations — these materialize as context map patterns (OHS, ACL, C/S, Partnership) once the domain model is authored.

| Requirement | Context | Depends on | Nature |
|---|---|---|---|
| REQ-RIDE-003 (Upfront fare display) | RIDE | PAY | RIDE → PAY: compute estimate |
| REQ-RIDE-020 (Nearby driver query) | RIDE | GEO | RIDE → GEO: proximity query |
| REQ-RIDE-045 (Tracking during trip) | RIDE | GEO | RIDE → GEO: location stream |
| REQ-RIDE-048 (Fare finalization) | RIDE | PAY | RIDE → PAY: final fare |
| REQ-RIDE-049 (Automatic payment) | RIDE | PAY | RIDE → PAY: capture |
| REQ-RIDE-060 (Cancel before assignment) | RIDE | PAY | RIDE → PAY: hold release |
| REQ-RIDE-064/066 (Driver penalties) | RIDE | DRV | RIDE → DRV: suspension |
| REQ-RIDE-067 (Rider rematch) | RIDE | (internal) | |
| REQ-RIDE-002 (Ready-to-ride gate) | RIDE | RDR | RIDE ← RDR: gate check |
| REQ-RDR-006 (Payment method association) | RDR | PAY | RDR → PAY: validate method |
| REQ-DRV-032 (Match-eligibility) | DRV | RIDE/GEO | DRV → RIDE/GEO: expose availability |
| REQ-GEO-003 (Stale ineligibility) | GEO | DRV | GEO → DRV: notify eligibility change |
| REQ-GEO-023 (Surge visible) | GEO | RIDE/PAY | GEO → RIDE → PAY: surge in estimate |
| REQ-PAY-020 (Pre-auth) | PAY | RIDE | PAY ← RIDE: on confirm |
| REQ-PAY-040 (Earnings) | PAY | RIDE | PAY ← RIDE: on completion |
| REQ-PAY-060 (Auto refund) | PAY | RIDE | PAY ← RIDE: on system cancel |
| REQ-PAY-064 (Driver-fault refund) | PAY | DRV | PAY → DRV: balance deduction |

## PRD Feature Coverage

Every `must` and `should` feature in `ride-now.prd` is covered by at least one requirement:

| PRD Feature | Primary BC | Requirements |
|---|---|---|
| Driver onboarding and identity verification | DRV | REQ-DRV-001 through REQ-DRV-008 |
| Vehicle registration and inspection | DRV | REQ-DRV-020 through REQ-DRV-023 |
| Driver availability | DRV | REQ-DRV-030 through REQ-DRV-034 |
| Driver rating and suspension | DRV | REQ-DRV-040 through REQ-DRV-049 |
| Frictionless rider signup | RDR | REQ-RDR-001 through REQ-RDR-005 |
| Saved addresses and preferences | RDR | REQ-RDR-010 through REQ-RDR-013 |
| Rider rating and ban policy | RDR | REQ-RDR-020 through REQ-RDR-027 |
| Request a ride | RIDE | REQ-RIDE-001 through REQ-RIDE-009 |
| Driver matching | RIDE | REQ-RIDE-020 through REQ-RIDE-026 |
| Pickup to completion | RIDE | REQ-RIDE-040 through REQ-RIDE-050 |
| Cancellations with fair fees and penalties | RIDE | REQ-RIDE-060 through REQ-RIDE-067 |
| Safety during and after the ride | RIDE | REQ-RIDE-080 through REQ-RIDE-086 |
| Real-time driver positioning | GEO | REQ-GEO-001 through REQ-GEO-004 |
| ETA and routing | GEO | REQ-GEO-010 through REQ-GEO-015 |
| Surge zone transparency | GEO | REQ-GEO-020 through REQ-GEO-024 |
| Payment method validation | PAY | REQ-PAY-001 through REQ-PAY-003 |
| Pre-authorization at request | PAY | REQ-PAY-020 through REQ-PAY-026 |
| Auto-charge on completion | PAY | REQ-PAY-012 through REQ-PAY-015, REQ-PAY-080 |
| Driver weekly payout | PAY | REQ-PAY-043 through REQ-PAY-046 |
| Instant payout | PAY (could) | REQ-PAY-047 through REQ-PAY-049 |
| Refunds on cancellation and disputes | PAY | REQ-PAY-060 through REQ-PAY-065, REQ-PAY-081 |

## Gaps and placeholders

- **Domain layer not yet authored.** No `.domain` files exist in this directory. The `satisfies` backward trace from domain → requirement is therefore empty — this is expected; next step is `/domain`.
- **Fabricated data.** Operator names, market counts, and specific thresholds (100m pickup radius, 5.0x surge cap, 7-year audit retention, processor fail-over within 30s) are reasonable defaults copied from the PRD or common industry practice. These should be confirmed with legal, ops, and finance before becoming binding.
- **Cross-cutting NFR tuning.** Several NFRs (disaster recovery RPO 5min / RTO 1hr, availability 99.9%, data sovereignty per market) are plausible targets, not negotiated contracts. Review with platform SRE before contractually committing.
