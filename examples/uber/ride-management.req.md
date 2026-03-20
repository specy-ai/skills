# Ride Management — Requirements

Bounded Context: **Ride Management** (RIDE)

Responsibility: Ride lifecycle from request to completion — matching, dispatch, tracking, cancellation, completion, safety.

---

```
requirements "Ride Request & Matching" scoped-to RideManagement {

  REQ-RIDE-001 "Ride request" : event-driven
    :: "The core transaction — rider wants to go somewhere"
    "When a rider submits a ride request with pickup and dropoff
     locations, the Ride Management system shall create a ride in
     requested status and initiate driver matching."
    priority must

  REQ-RIDE-002 "Ride request requires active rider" : ubiquitous
    :: "Banned or unverified riders cannot request rides"
    "The Ride Management system shall reject ride requests from
     riders who are not in active status."
    priority must

  REQ-RIDE-003 "Fare estimate at request" : event-driven
    :: "Riders must see the price before committing"
    "When a ride is requested, the Ride Management system shall
     compute a fare estimate using the Payment system and present
     it to the rider before confirming."
    priority must

  REQ-RIDE-004 "Driver matching" : event-driven
    :: "Fast matching is the core competitive advantage"
    "When a ride enters requested status, the Ride Management system
     shall query the Geolocation system for nearby available drivers
     and offer the ride to the closest eligible driver."
    priority must

  REQ-RIDE-005 "Driver offer timeout" : unwanted
    :: "Unresponsive drivers must not block riders"
    "If a driver does not respond to a ride offer within 15 seconds,
     then the Ride Management system shall retract the offer and
     offer the ride to the next closest eligible driver."
    priority must

  REQ-RIDE-006 "No driver available" : unwanted
    :: "Transparency — rider should know when no one is coming"
    "If no driver accepts the ride offer after exhausting all
     eligible drivers within the search radius, then the Ride
     Management system shall cancel the ride with reason
     'no-driver-available' and notify the rider."
    priority must

  REQ-RIDE-007 "Driver accepts ride" : event-driven
    :: "Commitment — driver is now en route to pickup"
    "When a driver accepts a ride offer, the Ride Management system
     shall transition the ride to driver-assigned status, notify
     the rider with driver and vehicle details, and publish
     a RideAccepted event."
    priority must

  REQ-RIDE-008 "Ride request with scheduled time" : optional
    :: "Scheduled rides — not all markets support advance booking"
    "Where scheduled rides are supported, when a rider submits a
     ride request with a future pickup time, the Ride Management
     system shall create a scheduled ride and initiate matching
     15 minutes before the pickup time."
    priority could
}


requirements "Ride Lifecycle — Pickup to Completion" scoped-to RideManagement {

  REQ-RIDE-010 "Driver arrival at pickup" : event-driven
    :: "Rider must know the driver has arrived"
    "When the driver signals arrival at the pickup point, the Ride
     Management system shall transition the ride to driver-arrived
     status and notify the rider."
    priority must

  REQ-RIDE-011 "Rider no-show" : complex
    :: "Drivers should not wait indefinitely — compensate and free them"
    "While the ride is in driver-arrived status, if the rider does
     not board within five minutes, then the Ride Management system
     shall cancel the ride with reason 'rider-no-show', charge the
     rider a cancellation fee, and free the driver."
    priority must

  REQ-RIDE-012 "Ride start" : event-driven
    :: "Meter starts — the ride is now in progress"
    "When the driver starts the ride, the Ride Management system shall
     transition the ride to in-progress status, record the actual pickup
     location and time, and publish a RideStarted event."
    priority must

  REQ-RIDE-013 "Ride tracking during trip" : state-driven
    :: "Real-time safety — know where every active ride is"
    "While the ride is in progress, the Ride Management system shall
     receive location updates from the Geolocation system and track
     the ride route in real time."
    priority must

  REQ-RIDE-014 "Ride completion" : event-driven
    :: "End of trip — trigger fare finalization and payment"
    "When the driver ends the ride, the Ride Management system shall
     transition the ride to completed status, record the actual dropoff
     location and time, and publish a RideCompleted event."
    priority must

  REQ-RIDE-015 "Fare finalization on completion" : event-driven
    depends-on REQ-RIDE-014
    :: "Actual fare may differ from estimate — distance and time are now known"
    "When a ride is completed, the Ride Management system shall request
     final fare computation from the Payment system using actual distance
     and duration."
    priority must

  REQ-RIDE-016 "Automatic payment on completion" : event-driven
    depends-on REQ-RIDE-015
    :: "Cashless — payment happens without rider action"
    "When the final fare is computed, the Ride Management system shall
     initiate payment capture through the Payment system."
    priority must
}


requirements "Ride Cancellation" scoped-to RideManagement {

  REQ-RIDE-020 "Rider cancellation before assignment" : complex
    :: "Free cancellation while no driver is committed"
    "While the ride is in requested status, when the rider cancels,
     the Ride Management system shall cancel the ride with no fee
     and publish a RideCancelledByRider event."
    priority must

  REQ-RIDE-021 "Rider cancellation after assignment" : complex
    :: "Driver already committed — rider pays cancellation fee"
    "While the ride is in driver-assigned or driver-arrived status,
     when the rider cancels, the Ride Management system shall cancel
     the ride, charge a cancellation fee, free the driver, and publish
     a RideCancelledByRider event."
    priority must

  REQ-RIDE-022 "Driver cancellation" : complex
    :: "Excessive driver cancellation hurts reliability — track it"
    "While the ride is in driver-assigned status, when the driver
     cancels, the Ride Management system shall cancel the ride with
     no rider charge, increment the driver's cancellation count,
     re-enter the ride into matching, and publish a RideCancelledByDriver
     event."
    priority must

  REQ-RIDE-023 "Excessive driver cancellation penalty" : complex
    :: "Drivers who cancel too often degrade service quality"
    "While the driver has cancelled more than 3 rides in the last
     24 hours, if the driver cancels again, then the Ride Management
     system shall temporarily suspend the driver for 30 minutes."
    priority should

  REQ-RIDE-024 "Driver no-show" : complex
    :: "Symmetry with rider no-show — drivers who accept then vanish waste rider time"
    "While the ride is in driver-en-route status, if the driver does
     not arrive at the pickup point within the estimated ETA plus
     five minutes, then the Ride Management system shall cancel the
     ride with reason 'driver-no-show', re-enter matching for the
     rider, and increment the driver's no-show count."
    priority must

  REQ-RIDE-025 "Driver no-show notification" : event-driven
    depends-on REQ-RIDE-024
    :: "Rider must know the driver isn't coming so they can get a new one"
    "When a ride is cancelled due to driver no-show, the Ride Management
     system shall notify the rider that a new driver is being found
     and provide an updated ETA."
    priority must

  REQ-RIDE-026 "Excessive driver no-show penalty" : complex
    :: "Chronic no-shows are as damaging as cancellations — same enforcement"
    "While the driver has accumulated more than 2 no-shows in the
     last 24 hours, if the driver no-shows again, then the Ride
     Management system shall suspend the driver for one hour and
     notify the Driver Management system."
    priority must

  REQ-RIDE-027 "Driver no-show impacts rating" : event-driven
    depends-on REQ-RIDE-024
    :: "No-shows degrade service quality — visible in driver's record"
    "When a ride is cancelled due to driver no-show, the Ride Management
     system shall publish a DriverNoShowRecorded event so that the
     Driver Management system can factor it into the driver's
     reliability score."
    priority should
}


requirements "Ride Safety" scoped-to RideManagement {

  REQ-RIDE-030 "Emergency button" : event-driven
    :: "Rider and driver safety — direct line to emergency services"
    "When a rider or driver presses the emergency button during a ride,
     the Ride Management system shall record the emergency event,
     share the ride's real-time location with emergency services,
     and notify the safety team."
    priority must

  REQ-RIDE-031 "Ride sharing with contacts" : event-driven
    :: "Social safety — let someone know where you are"
    "When a rider activates trip sharing, the Ride Management system
     shall send a real-time tracking link to the rider's designated
     emergency contacts."
    priority should

  REQ-RIDE-032 "Unusual stop detection" : complex
    :: "Anomaly detection — flag rides that deviate dangerously"
    "While the ride is in progress, if the vehicle stops for more
     than five minutes at a location not on the route, then the Ride
     Management system shall send a safety check notification to
     the rider."
    priority should

  REQ-RIDE-033 "Post-ride safety report" : event-driven
    :: "Surface incidents that don't trigger real-time alerts"
    "When a rider or driver files a safety report after ride completion,
     the Ride Management system shall record the report, flag the
     ride, and escalate to the safety team."
    priority must
}
```

## Summary

| Pattern | Count |
|---|---|
| ubiquitous | 1 |
| state-driven | 1 |
| event-driven | 11 |
| unwanted | 2 |
| optional | 1 |
| complex | 7 |
| **Total** | **22** (17 must, 4 should, 1 could) |

## Cross-Context Dependencies

| Requirement | Depends on | Nature |
|---|---|---|
| REQ-RIDE-003 (Fare estimate at request) | Payment | Ride → Payment: compute fare estimate |
| REQ-RIDE-004 (Driver matching) | Geolocation | Ride → Geo: nearby driver query |
| REQ-RIDE-013 (Ride tracking) | Geolocation | Ride → Geo: location update stream |
| REQ-RIDE-015 (Fare finalization) | Payment | Ride → Payment: compute final fare |
| REQ-RIDE-016 (Auto payment) | Payment | Ride → Payment: initiate capture |
