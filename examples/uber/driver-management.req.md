# Driver Management — Requirements

Bounded Context: **Driver Management** (DRV)

Responsibility: Onboarding, identity verification, vehicle registration, availability, ratings, suspension.

---

```
requirements "Driver Onboarding & Identity" scoped-to DriverManagement {

  REQ-DRV-001 "Driver registration" : event-driven
    :: "Every driver must go through onboarding before earning"
    "When a person submits a driver application, the Driver Management
     system shall create a driver profile in pending-verification status."
    priority must

  REQ-DRV-002 "Identity document upload" : event-driven
    :: "Regulatory requirement — drivers must prove identity before activation"
    "When a driver uploads an identity document, the Driver Management
     system shall store the document and initiate identity verification."
    priority must

  REQ-DRV-003 "Background check completion" : event-driven
    :: "Safety obligation — no driver on the road without a cleared background check"
    "When the background check returns a clear result, the Driver Management
     system shall transition the driver to verified status."
    priority must

  REQ-DRV-004 "Background check failure" : unwanted
    :: "Protect riders from drivers who fail safety screening"
    "If the background check returns a negative result, then the Driver
     Management system shall reject the driver application and notify
     the applicant."
    priority must

  REQ-DRV-005 "Vehicle registration" : event-driven
    :: "Insurance and regulatory compliance require known vehicles"
    "When a driver registers a vehicle, the Driver Management system
     shall record the vehicle details and associate it with the driver."
    priority must

  REQ-DRV-006 "Vehicle inspection requirement" : ubiquitous
    :: "Fleet safety — every active vehicle must pass inspection"
    "The Driver Management system shall reject activation of a driver
     whose vehicle has not passed inspection."
    priority must

  REQ-DRV-007 "Driver document expiry" : unwanted
    :: "Expired documents create legal liability"
    "If a driver's identity document or vehicle inspection expires, then
     the Driver Management system shall suspend the driver and notify them
     to upload renewed documents."
    priority must
}


requirements "Driver Availability & Status" scoped-to DriverManagement {

  REQ-DRV-010 "Go online" : complex
    :: "Only verified, non-suspended drivers can accept rides"
    "While the driver is in verified status and not suspended, when
     the driver signals availability, the Driver Management system shall
     transition the driver to online status and publish a DriverWentOnline
     event."
    priority must

  REQ-DRV-011 "Go offline" : event-driven
    :: "Drivers control their own working hours"
    "When an online driver signals unavailability, the Driver Management
     system shall transition the driver to offline status and publish
     a DriverWentOffline event."
    priority must

  REQ-DRV-012 "Suspended driver cannot go online" : state-driven
    :: "Safety enforcement — suspended drivers must not reach riders"
    "While the driver is suspended, the Driver Management system shall
     reject any attempt to go online."
    priority must

  REQ-DRV-013 "Automatic offline on inactivity" : complex
    :: "Ghost online drivers degrade matching — remove them after timeout"
    "While the driver is online, if no location update is received
     for more than five minutes, then the Driver Management system shall
     transition the driver to offline and publish a DriverWentOffline event."
    priority should
}


requirements "Driver Ratings & Suspension" scoped-to DriverManagement {

  REQ-DRV-020 "Driver rating submission" : event-driven
    :: "Rider feedback drives quality — collected after every completed ride"
    "When a rider submits a rating for a completed ride, the Driver
     Management system shall record the rating and recompute the driver's
     average rating."
    priority must

  REQ-DRV-021 "Rating floor" : ubiquitous
    :: "Rating must be between 1 and 5 — no gaming"
    "The Driver Management system shall accept only ratings between
     1 and 5 inclusive."
    priority must

  REQ-DRV-022 "Low rating suspension" : complex
    :: "Chronic low quality endangers riders and brand"
    "While the driver has completed more than 20 rides, if the driver's
     average rating drops below 4.2, then the Driver Management system
     shall suspend the driver and notify them of the reason."
    priority must

  REQ-DRV-023 "Driver suspension appeal" : event-driven
    :: "Due process — drivers can contest suspension"
    "When a suspended driver submits an appeal, the Driver Management
     system shall record the appeal and transition the driver to
     appeal-in-review status."
    priority should

  REQ-DRV-024 "Appeal resolution" : event-driven
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
