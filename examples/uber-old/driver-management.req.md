# Driver Management — Requirements

Bounded Context: **Driver Management** (DRV)

Responsibility: Onboarding, identity verification, vehicle registration, availability, ratings, suspension.

---

```
requirements "Driver Onboarding & Identity" scoped-to DriverManagement {
  prd-source "specs/driver-management.prd"

  REQ-DRV-001 "Driver registration" : event-driven
    source "Feature: Driver onboarding — Story: Apply to drive — AC: Profile created in pending-verification"
    :: "Every driver must go through onboarding before earning"
    "When a person submits a driver application, the Driver Management
     system shall create a driver profile in pending-verification status."
    priority must

  REQ-DRV-002 "Identity document upload" : event-driven
    source "Feature: Driver onboarding — Story: Upload identity documents — AC: Document stored and verification initiated"
    :: "Regulatory requirement — drivers must prove identity before activation"
    "When a driver uploads an identity document, the Driver Management
     system shall store the document and initiate identity verification."
    priority must

  REQ-DRV-003 "Background check completion" : event-driven
    source "Feature: Driver onboarding — Story: Background check outcome — AC: Clear transitions to verified"
    :: "Safety obligation — no driver on the road without a cleared background check"
    "When the background check returns a clear result, the Driver Management
     system shall transition the driver to verified status."
    priority must

  REQ-DRV-004 "Background check failure" : unwanted
    source "Feature: Driver onboarding — Story: Background check outcome — AC: Negative rejects application and notifies"
    :: "Protect riders from drivers who fail safety screening"
    "If the background check returns a negative result, then the Driver
     Management system shall reject the driver application and notify
     the applicant."
    priority must

  REQ-DRV-005 "Vehicle registration" : event-driven
    source "Feature: Vehicle registration and inspection — Story: Register a vehicle — AC: Details recorded and linked to driver"
    :: "Insurance and regulatory compliance require known vehicles"
    "When a driver registers a vehicle, the Driver Management system
     shall record the vehicle details and associate it with the driver."
    priority must

  REQ-DRV-006 "Vehicle inspection requirement" : ubiquitous
    source "Feature: Vehicle registration and inspection — Story: Vehicle must pass inspection — AC: Activation refused without passing inspection"
    :: "Fleet safety — every active vehicle must pass inspection"
    "The Driver Management system shall reject activation of a driver
     whose vehicle has not passed inspection."
    priority must

  REQ-DRV-007 "Driver document expiry" : unwanted
    source "Feature: Document expiry monitoring — Story: Be suspended on document expiry — AC: Suspension and renewal notification"
    :: "Expired documents create legal liability"
    "If a driver's identity document or vehicle inspection expires, then
     the Driver Management system shall suspend the driver and notify them
     to upload renewed documents."
    priority must
}


requirements "Driver Availability & Status" scoped-to DriverManagement {
  prd-source "specs/driver-management.prd"

  REQ-DRV-010 "Go online" : complex
    source "Feature: Go online / go offline — Story: Go online — AC: Verified non-suspended drivers transition to online with event"
    :: "Only verified, non-suspended drivers can accept rides"
    "While the driver is in verified status and not suspended, when
     the driver signals availability, the Driver Management system shall
     transition the driver to online status and publish a DriverWentOnline
     event."
    priority must

  REQ-DRV-011 "Go offline" : event-driven
    source "Feature: Go online / go offline — Story: Go offline — AC: Online driver transitions to offline with event"
    :: "Drivers control their own working hours"
    "When an online driver signals unavailability, the Driver Management
     system shall transition the driver to offline status and publish
     a DriverWentOffline event."
    priority must

  REQ-DRV-012 "Suspended driver cannot go online" : state-driven
    source "Feature: Go online / go offline — Story: Suspended drivers cannot drive — AC: Go-online attempt rejected while suspended"
    :: "Safety enforcement — suspended drivers must not reach riders"
    "While the driver is suspended, the Driver Management system shall
     reject any attempt to go online."
    priority must

  REQ-DRV-013 "Automatic offline on inactivity" : complex
    source "Feature: Go online / go offline — Story: Idle drivers are taken offline — AC: >5 min stale location triggers transition"
    :: "Ghost online drivers degrade matching — remove them after timeout"
    "While the driver is online, if no location update is received
     for more than five minutes, then the Driver Management system shall
     transition the driver to offline and publish a DriverWentOffline event."
    priority should
}


requirements "Driver Ratings & Suspension" scoped-to DriverManagement {
  prd-source "specs/driver-management.prd"

  REQ-DRV-020 "Driver rating submission" : event-driven
    source "Feature: Rating-driven suspension with appeal — Story: Be rated after every ride — AC: Rating recorded and average recomputed"
    :: "Rider feedback drives quality — collected after every completed ride"
    "When a rider submits a rating for a completed ride, the Driver
     Management system shall record the rating and recompute the driver's
     average rating."
    priority must

  REQ-DRV-021 "Rating floor" : ubiquitous
    source "Feature: Rating-driven suspension with appeal — Story: Be rated after every ride — AC: Ratings outside 1-5 rejected"
    :: "Rating must be between 1 and 5 — no gaming"
    "The Driver Management system shall accept only ratings between
     1 and 5 inclusive."
    priority must

  REQ-DRV-022 "Low rating suspension" : complex
    source "Feature: Rating-driven suspension with appeal — Story: Low-quality drivers are suspended — AC: Suspension at avg < 4.2 after > 20 rides"
    :: "Chronic low quality endangers riders and brand"
    "While the driver has completed more than 20 rides, if the driver's
     average rating drops below 4.2, then the Driver Management system
     shall suspend the driver and notify them of the reason."
    priority must

  REQ-DRV-023 "Driver suspension appeal" : event-driven
    source "Feature: Rating-driven suspension with appeal — Story: Appeal a suspension — AC: Driver transitions to appeal-in-review"
    :: "Due process — drivers can contest suspension"
    "When a suspended driver submits an appeal, the Driver Management
     system shall record the appeal and transition the driver to
     appeal-in-review status."
    priority should

  REQ-DRV-024 "Appeal resolution" : event-driven
    source "Feature: Rating-driven suspension with appeal — Story: Appeal resolution — AC: Reinstate or permanently suspend with notification"
    :: "Backoffice resolves appeals — reinstate or confirm suspension"
    "When a backoffice agent resolves an appeal, the Driver Management
     system shall transition the driver to either verified or
     permanently-suspended status and notify the driver."
    priority should
}
```

## Summary

| Pattern | Count |
|---|---|
| ubiquitous | 2 |
| state-driven | 1 |
| event-driven | 7 |
| unwanted | 2 |
| complex | 3 |
| **Total** | **14** (10 must, 4 should) |
