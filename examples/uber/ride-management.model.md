# Ride Management — Domain Model

Bounded Context: **Ride Management** (RIDE)

Responsibility: Ride lifecycle from request to completion — matching, dispatch, tracking, cancellation, completion, safety.

**Design decision**: The ride lifecycle is split into two aggregates for complexity management:
- **RideRequest** handles the demand side — from rider intent through driver matching. Its lifecycle ends when both parties agree (driver accepts) or when matching fails.
- **Ride** handles the fulfillment side — from driver assignment through transportation to completion. A Ride is created when a RideRequest is matched.

This separation ensures that matching logic (offers, timeouts, retries) does not pollute the trip execution model (tracking, safety, fare finalization), and vice versa.

---

## Context Map

| Relationship | Upstream BC | Downstream BC | Pattern | Requirement |
|---|---|---|---|---|
| Nearby driver query | Geolocation & Routing | Ride Management | ACL (GeolocationGateway) | REQ-RIDE-004, REQ-RIDE-013 |
| Fare estimate computation | Payment | Ride Management | ACL (PaymentGateway) | REQ-RIDE-003 |
| Final fare computation | Payment | Ride Management | ACL (PaymentGateway) | REQ-RIDE-015 |
| Payment capture | Payment | Ride Management | ACL (PaymentGateway) | REQ-RIDE-016 |
| Cancellation fee charge | Payment | Ride Management | ACL (PaymentGateway) | REQ-RIDE-011, REQ-RIDE-021 |
| Rider status verification | Rider Management | Ride Management | ACL | REQ-RIDE-002 |
| Driver suspension | Driver Management | Ride Management | Published Language (event) | REQ-RIDE-023, REQ-RIDE-026 |
| Driver reliability signal | Ride Management | Driver Management | Published Language (event) | REQ-RIDE-027 |
| Notification delivery | Notification (generic) | Ride Management | OHS | REQ-RIDE-006, REQ-RIDE-007, REQ-RIDE-010, REQ-RIDE-025, REQ-RIDE-030, REQ-RIDE-031, REQ-RIDE-032 |

---

## Value Types

```
// =============================================================================
// Enums
// =============================================================================

// realizes: REQ-RIDE-001, REQ-RIDE-004, REQ-RIDE-006, REQ-RIDE-007, REQ-RIDE-020
enum RideRequestStatus {
    searching       // actively matching — offers being sent to drivers
    matched         // a driver accepted — terminal success, Ride will be created
    cancelled       // matching failed or rider cancelled — terminal failure
}

// realizes: REQ-RIDE-007, REQ-RIDE-010, REQ-RIDE-012, REQ-RIDE-014,
//           REQ-RIDE-021, REQ-RIDE-022
enum RideStatus {
    driverEnRoute   // driver accepted, heading to pickup
    driverArrived   // driver at pickup location, waiting for rider
    inProgress      // rider aboard, trip underway
    completed       // arrived at destination — terminal
    cancelled       // cancelled after match (no-show, rider/driver cancel) — terminal
}

// realizes: REQ-RIDE-005, REQ-RIDE-007
enum RideOfferStatus {
    pending
    accepted
    rejected
    timeout
    retracted
}

// realizes: REQ-RIDE-006, REQ-RIDE-011, REQ-RIDE-020, REQ-RIDE-021, REQ-RIDE-022, REQ-RIDE-024
enum CancellationReason {
    // RideRequest-scoped reasons
    riderCancelledBeforeMatch
    noDriverAvailable
    // Ride-scoped reasons
    riderCancelledAfterMatch
    driverCancelled
    riderNoShow
    driverNoShow            // driver failed to arrive within ETA + grace period
}

// realizes: REQ-RIDE-030, REQ-RIDE-033
enum SafetyReportSeverity { low, medium, high, critical }

// realizes: REQ-RIDE-030
enum EmergencyEventType { riderEmergency, driverEmergency }

// realizes: REQ-RIDE-008
enum RideScheduleType { immediate, scheduled }

// =============================================================================
// Value Objects
// =============================================================================

// realizes: REQ-RIDE-001, REQ-RIDE-010, REQ-RIDE-012, REQ-RIDE-014
value Location {
    fields {
        latitude  : decimal min(-90) max(90)
        longitude : decimal min(-180) max(180)
    }
}

// realizes: REQ-RIDE-013
value Route {
    fields {
        waypoints      : list<Location>
        distanceMeters : int min(0)
        durationSeconds: int min(0)
    }
}

// realizes: REQ-RIDE-003
value FareEstimate {
    fields {
        amount          : decimal min(0)
        currency        : string maxLength(3) default("USD")
        surgeMultiplier : decimal min(1) default("1.0")
        distanceMeters  : int min(0)
        durationSeconds : int min(0)
    }
    invariants {
        amountNonNegative :: "Fare estimate must be non-negative" {
            amount >= 0
        }
    }
}

// realizes: REQ-RIDE-015
value FinalFare {
    fields {
        amount               : decimal min(0)
        currency             : string maxLength(3) default("USD")
        surgeMultiplier      : decimal min(1)
        actualDistanceMeters : int min(0)
        actualDurationSeconds: int min(0)
    }
}

// realizes: REQ-RIDE-020, REQ-RIDE-021, REQ-RIDE-022, REQ-RIDE-011
value CancellationDetail {
    fields {
        reason      : CancellationReason
        cancelledBy : string         // "rider", "driver", "system"
        cancelledAt : datetime
        feeCharged  : boolean default("false")
        feeAmount   : decimal optional min(0)
    }
}

// realizes: REQ-RIDE-031
value TripSharingLink {
    fields {
        linkToken    : string
        contactName  : string maxLength(100)
        contactPhone : string maxLength(20)
        activatedAt  : datetime
        expiresAt    : datetime
    }
}
```

---

## Entities

```
// =============================================================================
// RideOffer — child entity of RideRequest
// =============================================================================

// realizes: REQ-RIDE-004, REQ-RIDE-005, REQ-RIDE-007
entity RideOffer :: "An offer made to a specific driver during matching" {
    identifier id : UUID
    fields {
        driverId       : uuid
        status         : RideOfferStatus default("pending")
        offeredAt      : datetime immutable pastOrPresent
        respondedAt    : datetime optional pastOrPresent
        timeoutSeconds : int default("15") min(1)
    }
    references {
        rideRequest : RideRequest 1..1
    }
    invariants {
        responseAfterOffer :: "Response must be after offer" {
            if respondedAt is defined { respondedAt >= offeredAt }
        }
    }
}

// =============================================================================
// EmergencyEvent — child entity of Ride
// =============================================================================

// realizes: REQ-RIDE-030
entity EmergencyEvent :: "An emergency triggered during a ride" {
    identifier id : UUID
    fields {
        type        : EmergencyEventType
        triggeredBy : string
        triggeredAt : datetime immutable pastOrPresent
        location    : Location
        resolved    : boolean default("false")
        resolvedAt  : datetime optional
    }
    references {
        ride : Ride 1..1
    }
}

// =============================================================================
// SafetyReport — child entity of Ride
// =============================================================================

// realizes: REQ-RIDE-033
entity SafetyReport :: "A post-ride safety report filed by rider or driver" {
    identifier id : UUID
    fields {
        reportedBy  : string
        severity    : SafetyReportSeverity
        description : string maxLength(2000)
        reportedAt  : datetime immutable pastOrPresent
        escalated   : boolean default("false")
        escalatedAt : datetime optional
    }
    references {
        ride : Ride 1..1
    }
}
```

---

## Aggregates

### RideRequest — Demand-Side Aggregate

The **RideRequest** aggregate manages everything from the rider's intent to the moment both parties agree. It owns the matching lifecycle.

```
// realizes: REQ-RIDE-001, REQ-RIDE-002, REQ-RIDE-003, REQ-RIDE-004, REQ-RIDE-005,
//           REQ-RIDE-006, REQ-RIDE-007, REQ-RIDE-008, REQ-RIDE-020
entity RideRequest :: "A rider's request for transportation, covering matching until a driver accepts" {
    identifier id : UUID
    fields {
        riderId              : uuid
        status               : RideRequestStatus default("searching")
        scheduleType         : RideScheduleType default("immediate")
        scheduledPickupTime  : datetime optional futureOrPresent
        pickupLocation       : Location
        dropoffLocation      : Location
        fareEstimate         : FareEstimate optional
        cancellation         : CancellationDetail optional
        matchedDriverId      : uuid optional
        matchedAt            : datetime optional
        createdAt            : datetime immutable pastOrPresent
        updatedAt            : datetime pastOrPresent
    }
    references {
        offers : RideOffer 0..N
    }

    policies {
        // realizes: REQ-RIDE-002
        riderMustBeActive(riderId: uuid) :: "Only active riders can request rides" {
            // Verified via Rider Management ACL — rider status must be active
        }

        // realizes: REQ-RIDE-004
        requestMustBeSearching(rideRequest: RideRequest) :: "Can only match while searching" {
            rideRequest.status = searching
        }

        // realizes: REQ-RIDE-020
        requestCanBeCancelledByRider(rideRequest: RideRequest) :: "Rider can cancel while searching" {
            rideRequest.status = searching
        }
    }

    invariants {
        // realizes: REQ-RIDE-001
        pickupAndDropoffRequired :: "Must have both pickup and dropoff" {
            pickupLocation is defined and dropoffLocation is defined
        }

        // realizes: REQ-RIDE-008
        scheduledRideHasPickupTime :: "Scheduled ride must have future pickup time" {
            if scheduleType = scheduled { scheduledPickupTime is defined }
        }

        // realizes: REQ-RIDE-007
        matchedRequestHasDriver :: "A matched request must have a driver" {
            if status = matched { matchedDriverId is defined }
        }
    }

    operations {
        // realizes: REQ-RIDE-001, REQ-RIDE-002, REQ-RIDE-003
        "Request a ride" on RequestRide {
            policy riderMustBeActive(requestRide.riderId)

            creates RideRequest {
                riderId         = requestRide.riderId
                status          = searching
                scheduleType    = requestRide.scheduleType
                scheduledPickupTime = requestRide.scheduledPickupTime
                pickupLocation  = requestRide.pickupLocation
                dropoffLocation = requestRide.dropoffLocation
                fareEstimate    = PaymentGateway.computeFareEstimate(
                                    requestRide.pickupLocation, requestRide.dropoffLocation)
                createdAt       = now()
                updatedAt       = now()
            }

            emits RideRequested {
                rideRequestId   = RideRequest.id
                riderId         = RideRequest.riderId
                pickupLocation  = RideRequest.pickupLocation
                dropoffLocation = RideRequest.dropoffLocation
                fareEstimate    = RideRequest.fareEstimate
                scheduleType    = RideRequest.scheduleType
                requestedAt     = RideRequest.createdAt
            }
        }

        // realizes: REQ-RIDE-004
        "Initiate driver matching" when RideRequested then InitiateMatching {
            resolves RideRequest from initiateMatching.rideRequestId

            policy requestMustBeSearching(RideRequest)

            MatchingService.findAndOfferDriver(RideRequest)
              :: "Query Geo for nearby drivers and offer to closest"
        }

        // realizes: REQ-RIDE-005
        "Handle driver offer timeout" on HandleOfferTimeout {
            resolves RideRequest from handleOfferTimeout.rideRequestId

            policy requestMustBeSearching(RideRequest)

            sets RideOffer {
                status      = timeout
                respondedAt = now()
            }

            emits RideOfferTimedOut {
                rideRequestId = RideRequest.id
                offerId       = RideOffer.id
                driverId      = RideOffer.driverId
                timedOutAt    = now()
            }

            MatchingService.findAndOfferDriver(RideRequest)
              :: "Offer to next closest eligible driver"
        }

        // realizes: REQ-RIDE-006
        "Cancel request — no driver available" on CancelRequestNoDriver {
            resolves RideRequest from cancelRequestNoDriver.rideRequestId

            policy requestMustBeSearching(RideRequest)

            sets RideRequest {
                status = cancelled
                cancellation = CancellationDetail {
                    reason      = noDriverAvailable
                    cancelledBy = "system"
                    cancelledAt = now()
                    feeCharged  = false
                }
                updatedAt = now()
            }

            NotificationService.notifyRider(RideRequest.riderId,
              "No drivers available nearby. Your ride request has been cancelled.")

            emits RideRequestCancelled {
                rideRequestId = RideRequest.id
                riderId       = RideRequest.riderId
                reason        = noDriverAvailable
                cancelledAt   = now()
            }
        }

        // realizes: REQ-RIDE-007
        "Driver accepts ride offer" on AcceptRideOffer {
            resolves RideRequest from acceptRideOffer.rideRequestId

            policy requestMustBeSearching(RideRequest)

            sets RideOffer {
                status      = accepted
                respondedAt = now()
            }

            sets RideRequest {
                status          = matched
                matchedDriverId = acceptRideOffer.driverId
                matchedAt       = now()
                updatedAt       = now()
            }

            emits RideRequestMatched {
                rideRequestId   = RideRequest.id
                riderId         = RideRequest.riderId
                driverId        = RideRequest.matchedDriverId
                pickupLocation  = RideRequest.pickupLocation
                dropoffLocation = RideRequest.dropoffLocation
                fareEstimate    = RideRequest.fareEstimate
                matchedAt       = RideRequest.matchedAt
            }
        }

        // realizes: REQ-RIDE-020
        "Rider cancels request" on CancelRequestByRider {
            resolves RideRequest from cancelRequestByRider.rideRequestId

            policy requestCanBeCancelledByRider(RideRequest)

            sets RideRequest {
                status = cancelled
                cancellation = CancellationDetail {
                    reason      = riderCancelledBeforeMatch
                    cancelledBy = "rider"
                    cancelledAt = now()
                    feeCharged  = false
                }
                updatedAt = now()
            }

            emits RideRequestCancelledByRider {
                rideRequestId = RideRequest.id
                riderId       = RideRequest.riderId
                cancelledAt   = now()
            }
        }
    }

    // State Machine
    transitions {
        [*] --> searching on "Request a ride"
        searching --> matched on "Driver accepts ride offer"
        searching --> cancelled on "Rider cancels request", "Cancel request — no driver available"
    }
}
```

---

### Ride — Fulfillment-Side Aggregate

The **Ride** aggregate manages the actual transportation — from driver heading to pickup through trip completion. A Ride is created when a RideRequest reaches `matched` status.

```
// realizes: REQ-RIDE-007, REQ-RIDE-010, REQ-RIDE-011, REQ-RIDE-012, REQ-RIDE-013,
//           REQ-RIDE-014, REQ-RIDE-015, REQ-RIDE-016, REQ-RIDE-021, REQ-RIDE-022,
//           REQ-RIDE-023, REQ-RIDE-030, REQ-RIDE-031, REQ-RIDE-032, REQ-RIDE-033
entity Ride :: "The actual ride from driver assignment through trip completion" {
    identifier id : UUID
    fields {
        rideRequestId          : uuid immutable
        riderId                : uuid immutable
        driverId               : uuid
        status                 : RideStatus default("driverEnRoute")
        pickupLocation         : Location immutable
        dropoffLocation        : Location immutable
        fareEstimate           : FareEstimate immutable
        actualPickupLocation   : Location optional
        actualPickupTime       : datetime optional pastOrPresent
        actualDropoffLocation  : Location optional
        actualDropoffTime      : datetime optional pastOrPresent
        finalFare              : FinalFare optional
        currentRoute           : Route optional
        cancellation           : CancellationDetail optional
        tripSharingActive      : boolean default("false")
        createdAt              : datetime immutable pastOrPresent
        updatedAt              : datetime pastOrPresent
    }
    references {
        emergencyEvents   : EmergencyEvent 0..N
        safetyReports     : SafetyReport 0..N
        tripSharingLinks  : TripSharingLink 0..N
    }

    policies {
        // realizes: REQ-RIDE-010
        rideMustBeDriverEnRoute(ride: Ride) :: "Driver must be en route to signal arrival" {
            ride.status = driverEnRoute
        }

        // realizes: REQ-RIDE-012
        rideMustBeDriverArrived(ride: Ride) :: "Driver must have arrived to start ride" {
            ride.status = driverArrived
        }

        // realizes: REQ-RIDE-014
        rideMustBeInProgress(ride: Ride) :: "Ride must be in progress to complete" {
            ride.status = inProgress
        }

        // realizes: REQ-RIDE-021
        rideCanBeCancelledByRider(ride: Ride) :: "Rider can cancel while driver en route or arrived" {
            ride.status in { driverEnRoute, driverArrived }
        }

        // realizes: REQ-RIDE-022
        rideCanBeCancelledByDriver(ride: Ride) :: "Driver can cancel while en route" {
            ride.status = driverEnRoute
        }

        // realizes: REQ-RIDE-011
        rideMustBeDriverArrivedForNoShow(ride: Ride) :: "No-show only when driver arrived" {
            ride.status = driverArrived
        }

        // realizes: REQ-RIDE-030
        rideMustBeActiveForEmergency(ride: Ride) :: "Emergency requires an active ride" {
            ride.status in { driverEnRoute, driverArrived, inProgress }
        }

        // realizes: REQ-RIDE-033
        rideMustBeCompletedForSafetyReport(ride: Ride) :: "Safety reports filed after completion" {
            ride.status = completed
        }
    }

    invariants {
        // realizes: REQ-RIDE-014
        completedRideHasActualTimes :: "Completed ride must have actual pickup and dropoff data" {
            if status = completed {
                actualPickupTime is defined and actualDropoffTime is defined
                and actualPickupLocation is defined and actualDropoffLocation is defined
            }
        }

        // realizes: REQ-RIDE-015
        completedRideHasFinalFare :: "Completed ride must have a final fare" {
            if status = completed { finalFare is defined }
        }
    }

    operations {
        // =====================================================================
        // Ride Creation — triggered by RideRequestMatched event
        // =====================================================================

        // realizes: REQ-RIDE-007
        "Create ride from matched request" when RideRequestMatched then CreateRide {
            creates Ride {
                rideRequestId   = createRide.rideRequestId
                riderId         = createRide.riderId
                driverId        = createRide.driverId
                status          = driverEnRoute
                pickupLocation  = createRide.pickupLocation
                dropoffLocation = createRide.dropoffLocation
                fareEstimate    = createRide.fareEstimate
                createdAt       = now()
                updatedAt       = now()
            }

            NotificationService.notifyRider(Ride.riderId,
              "A driver has been assigned. They are on their way.")

            emits RideCreated {
                rideId          = Ride.id
                rideRequestId   = Ride.rideRequestId
                riderId         = Ride.riderId
                driverId        = Ride.driverId
                pickupLocation  = Ride.pickupLocation
                dropoffLocation = Ride.dropoffLocation
                fareEstimate    = Ride.fareEstimate
                createdAt       = Ride.createdAt
            }
        }

        // =====================================================================
        // Pickup Phase
        // =====================================================================

        // realizes: REQ-RIDE-010
        "Driver arrives at pickup" on SignalDriverArrival {
            resolves Ride from signalDriverArrival.rideId

            policy rideMustBeDriverEnRoute(Ride)

            sets Ride {
                status    = driverArrived
                updatedAt = now()
            }

            NotificationService.notifyRider(Ride.riderId,
              "Your driver has arrived at the pickup point.")

            emits DriverArrived {
                rideId    = Ride.id
                riderId   = Ride.riderId
                driverId  = Ride.driverId
                arrivedAt = now()
            }
        }

        // realizes: REQ-RIDE-011
        "Cancel ride — rider no-show" on CancelRideNoShow {
            resolves Ride from cancelRideNoShow.rideId

            policy rideMustBeDriverArrivedForNoShow(Ride)
            // Caused by: temporal event RiderBoardingDeadlineElapsed → cancelOnRiderNoShow policy

            sets Ride {
                status = cancelled
                cancellation = CancellationDetail {
                    reason      = riderNoShow
                    cancelledBy = "system"
                    cancelledAt = now()
                    feeCharged  = true
                    feeAmount   = PaymentGateway.computeCancellationFee(Ride.rideRequestId)
                }
                updatedAt = now()
            }

            PaymentGateway.chargeCancellationFee(Ride.riderId, Ride.cancellation.feeAmount)

            emits RideCancelledNoShow {
                rideId    = Ride.id
                riderId   = Ride.riderId
                driverId  = Ride.driverId
                feeAmount = Ride.cancellation.feeAmount
                cancelledAt = now()
            }
        }

        // realizes: REQ-RIDE-024, REQ-RIDE-025
        "Cancel ride — driver no-show" on CancelRideDriverNoShow {
            resolves Ride from cancelRideDriverNoShow.rideId

            policy rideMustBeDriverEnRoute(Ride)
            // Caused by: temporal event DriverArrivalDeadlineElapsed → cancelOnDriverNoShow policy

            sets Ride {
                status = cancelled
                cancellation = CancellationDetail {
                    reason      = driverNoShow
                    cancelledBy = "system"
                    cancelledAt = now()
                    feeCharged  = false
                }
                updatedAt = now()
            }

            NotificationService.notifyRider(Ride.riderId,
              "Your driver did not arrive. We are finding you a new driver.")

            emits RideCancelledDriverNoShow {
                rideId   = Ride.id
                riderId  = Ride.riderId
                driverId = Ride.driverId
                cancelledAt = now()
            }
        }

        // =====================================================================
        // Trip Phase
        // =====================================================================

        // realizes: REQ-RIDE-012
        "Start the ride" on StartRide {
            resolves Ride from startRide.rideId

            policy rideMustBeDriverArrived(Ride)

            sets Ride {
                status               = inProgress
                actualPickupLocation = startRide.pickupLocation
                actualPickupTime     = now()
                updatedAt            = now()
            }

            emits RideStarted {
                rideId               = Ride.id
                riderId              = Ride.riderId
                driverId             = Ride.driverId
                actualPickupLocation = Ride.actualPickupLocation
                startedAt            = Ride.actualPickupTime
            }
        }

        // realizes: REQ-RIDE-013
        "Update ride tracking" on UpdateRideTracking {
            resolves Ride from updateRideTracking.rideId

            policy rideMustBeInProgress(Ride)

            sets Ride {
                currentRoute = GeolocationGateway.getCurrentRoute(Ride.id)
                updatedAt    = now()
            }

            emits RideLocationUpdated {
                rideId          = Ride.id
                currentLocation = updateRideTracking.currentLocation
                updatedAt       = now()
            }
        }

        // realizes: REQ-RIDE-014, REQ-RIDE-015, REQ-RIDE-016
        "Complete the ride" on CompleteRide {
            resolves Ride from completeRide.rideId

            policy rideMustBeInProgress(Ride)

            sets Ride {
                status                = completed
                actualDropoffLocation = completeRide.dropoffLocation
                actualDropoffTime     = now()
                finalFare             = PaymentGateway.computeFinalFare(
                                          Ride.rideRequestId,
                                          Ride.actualPickupLocation,
                                          completeRide.dropoffLocation,
                                          Ride.actualPickupTime, now())
                updatedAt             = now()
            }

            PaymentGateway.capturePayment(Ride.riderId, Ride.finalFare)

            emits RideCompleted {
                rideId               = Ride.id
                riderId              = Ride.riderId
                driverId             = Ride.driverId
                actualDropoffLocation = Ride.actualDropoffLocation
                finalFare            = Ride.finalFare
                completedAt          = Ride.actualDropoffTime
            }
        }

        // =====================================================================
        // Cancellation (post-match)
        // =====================================================================

        // realizes: REQ-RIDE-021
        "Rider cancels ride after match" on CancelRideByRider {
            resolves Ride from cancelRideByRider.rideId

            policy rideCanBeCancelledByRider(Ride)

            sets Ride {
                status = cancelled
                cancellation = CancellationDetail {
                    reason      = riderCancelledAfterMatch
                    cancelledBy = "rider"
                    cancelledAt = now()
                    feeCharged  = true
                    feeAmount   = PaymentGateway.computeCancellationFee(Ride.rideRequestId)
                }
                updatedAt = now()
            }

            PaymentGateway.chargeCancellationFee(Ride.riderId, Ride.cancellation.feeAmount)

            emits RideCancelledByRider {
                rideId    = Ride.id
                riderId   = Ride.riderId
                driverId  = Ride.driverId
                feeAmount = Ride.cancellation.feeAmount
                cancelledAt = now()
            }
        }

        // realizes: REQ-RIDE-022, REQ-RIDE-023
        "Driver cancels ride" on CancelRideByDriver {
            resolves Ride from cancelRideByDriver.rideId

            policy rideCanBeCancelledByDriver(Ride)

            sets Ride {
                status = cancelled
                cancellation = CancellationDetail {
                    reason      = driverCancelled
                    cancelledBy = "driver"
                    cancelledAt = now()
                    feeCharged  = false
                }
                updatedAt = now()
            }

            emits RideCancelledByDriver {
                rideId   = Ride.id
                riderId  = Ride.riderId
                driverId = cancelRideByDriver.driverId
                cancelledAt = now()
            }
        }

        // =====================================================================
        // Safety
        // =====================================================================

        // realizes: REQ-RIDE-030
        "Trigger emergency" on TriggerEmergency {
            resolves Ride from triggerEmergency.rideId

            policy rideMustBeActiveForEmergency(Ride)

            creates EmergencyEvent {
                type        = triggerEmergency.emergencyType
                triggeredBy = triggerEmergency.triggeredBy
                triggeredAt = now()
                location    = GeolocationGateway.getCurrentLocation(Ride.id)
                ride        = Ride
            }

            NotificationService.shareLocationWithEmergencyServices(Ride.id, EmergencyEvent.location)
            NotificationService.notifySafetyTeam(Ride.id, EmergencyEvent)

            emits EmergencyTriggered {
                rideId      = Ride.id
                emergencyId = EmergencyEvent.id
                type        = EmergencyEvent.type
                triggeredBy = EmergencyEvent.triggeredBy
                location    = EmergencyEvent.location
                triggeredAt = EmergencyEvent.triggeredAt
            }
        }

        // realizes: REQ-RIDE-031
        "Activate trip sharing" on ActivateTripSharing {
            resolves Ride from activateTripSharing.rideId

            sets Ride {
                tripSharingActive = true
                updatedAt         = now()
            }

            NotificationService.sendTrackingLink(activateTripSharing.contacts, Ride.id)

            emits TripSharingActivated {
                rideId      = Ride.id
                riderId     = Ride.riderId
                activatedAt = now()
            }
        }

        // realizes: REQ-RIDE-032
        "Detect unusual stop" on DetectUnusualStop {
            resolves Ride from detectUnusualStop.rideId

            policy rideMustBeInProgress(Ride)

            NotificationService.sendSafetyCheck(Ride.riderId, Ride.id,
              detectUnusualStop.stopLocation)

            emits UnusualStopDetected {
                rideId       = Ride.id
                riderId      = Ride.riderId
                driverId     = Ride.driverId
                stopLocation = detectUnusualStop.stopLocation
                detectedAt   = now()
            }
        }

        // realizes: REQ-RIDE-033
        "File safety report" on FileSafetyReport {
            resolves Ride from fileSafetyReport.rideId

            policy rideMustBeCompletedForSafetyReport(Ride)

            creates SafetyReport {
                ride        = Ride
                reportedBy  = fileSafetyReport.reportedBy
                severity    = fileSafetyReport.severity
                description = fileSafetyReport.description
                reportedAt  = now()
                escalated   = true
                escalatedAt = now()
            }

            NotificationService.escalateToSafetyTeam(Ride.id, SafetyReport)

            emits SafetyReportFiled {
                rideId     = Ride.id
                reportId   = SafetyReport.id
                reportedBy = SafetyReport.reportedBy
                severity   = SafetyReport.severity
                reportedAt = SafetyReport.reportedAt
            }
        }
    }

    // State Machine
    transitions {
        [*] --> driverEnRoute on "Create ride from matched request"
        driverEnRoute --> driverArrived on "Driver arrives at pickup"
        driverEnRoute --> cancelled on "Rider cancels ride after match", "Driver cancels ride", "Cancel ride — driver no-show"
        driverArrived --> inProgress on "Start the ride"
        driverArrived --> cancelled on "Rider cancels ride after match", "Cancel ride — rider no-show"
        inProgress --> completed on "Complete the ride"
    }
}
```

---

## Commands

```
// =============================================================================
// RideRequest Commands
// =============================================================================

// realizes: REQ-RIDE-001, REQ-RIDE-002, REQ-RIDE-003, REQ-RIDE-008
command RequestRide {
    fields {
        riderId             : uuid
        pickupLocation      : Location
        dropoffLocation     : Location
        scheduleType        : RideScheduleType default("immediate")
        scheduledPickupTime : datetime optional
    }
}

// realizes: REQ-RIDE-004
command InitiateMatching {
    fields {
        rideRequestId : uuid
    }
}

// realizes: REQ-RIDE-005
command HandleOfferTimeout {
    fields {
        rideRequestId : uuid
        offerId       : uuid
        driverId      : uuid
    }
}

// realizes: REQ-RIDE-006
command CancelRequestNoDriver {
    fields {
        rideRequestId : uuid
    }
}

// realizes: REQ-RIDE-007
command AcceptRideOffer {
    fields {
        rideRequestId : uuid
        offerId       : uuid
        driverId      : uuid
    }
}

// realizes: REQ-RIDE-020
command CancelRequestByRider {
    fields {
        rideRequestId : uuid
        riderId       : uuid
    }
}

// =============================================================================
// Ride Commands
// =============================================================================

// realizes: REQ-RIDE-007
command CreateRide {
    fields {
        rideRequestId   : uuid
        riderId         : uuid
        driverId        : uuid
        pickupLocation  : Location
        dropoffLocation : Location
        fareEstimate    : FareEstimate
    }
}

// realizes: REQ-RIDE-010
command SignalDriverArrival {
    fields {
        rideId   : uuid
        driverId : uuid
    }
}

// realizes: REQ-RIDE-011
command CancelRideNoShow {
    fields {
        rideId : uuid
    }
}

// realizes: REQ-RIDE-012
command StartRide {
    fields {
        rideId         : uuid
        pickupLocation : Location
    }
}

// realizes: REQ-RIDE-013
command UpdateRideTracking {
    fields {
        rideId          : uuid
        currentLocation : Location
    }
}

// realizes: REQ-RIDE-014, REQ-RIDE-015, REQ-RIDE-016
command CompleteRide {
    fields {
        rideId          : uuid
        dropoffLocation : Location
    }
}

// realizes: REQ-RIDE-021
command CancelRideByRider {
    fields {
        rideId  : uuid
        riderId : uuid
    }
}

// realizes: REQ-RIDE-022
command CancelRideByDriver {
    fields {
        rideId   : uuid
        driverId : uuid
    }
}

// realizes: REQ-RIDE-024
command CancelRideDriverNoShow {
    fields {
        rideId : uuid
    }
}

// realizes: REQ-RIDE-030
command TriggerEmergency {
    fields {
        rideId        : uuid
        triggeredBy   : string
        emergencyType : EmergencyEventType
    }
}

// realizes: REQ-RIDE-031
command ActivateTripSharing {
    fields {
        rideId   : uuid
        contacts : list<TripSharingLink>
    }
}

// realizes: REQ-RIDE-032
command DetectUnusualStop {
    fields {
        rideId              : uuid
        stopLocation        : Location
        stoppedSinceSeconds : int
    }
}

// realizes: REQ-RIDE-033
command FileSafetyReport {
    fields {
        rideId      : uuid
        reportedBy  : string
        severity    : SafetyReportSeverity
        description : string maxLength(2000)
    }
}
```

---

## Events

```
// =============================================================================
// RideRequest Events
// =============================================================================

// realizes: REQ-RIDE-001, REQ-RIDE-003
event RideRequested {
    fields {
        rideRequestId   : uuid
        riderId         : uuid
        pickupLocation  : Location
        dropoffLocation : Location
        fareEstimate    : FareEstimate
        scheduleType    : RideScheduleType
        requestedAt     : datetime
    }
}

// realizes: REQ-RIDE-005
event RideOfferTimedOut {
    fields {
        rideRequestId : uuid
        offerId       : uuid
        driverId      : uuid
        timedOutAt    : datetime
    }
}

// realizes: REQ-RIDE-007
// KEY EVENT: bridges RideRequest → Ride. Triggers Ride creation.
event RideRequestMatched {
    fields {
        rideRequestId   : uuid
        riderId         : uuid
        driverId        : uuid
        pickupLocation  : Location
        dropoffLocation : Location
        fareEstimate    : FareEstimate
        matchedAt       : datetime
    }
}

// realizes: REQ-RIDE-006
event RideRequestCancelled {
    fields {
        rideRequestId : uuid
        riderId       : uuid
        reason        : CancellationReason
        cancelledAt   : datetime
    }
}

// realizes: REQ-RIDE-020
event RideRequestCancelledByRider {
    fields {
        rideRequestId : uuid
        riderId       : uuid
        cancelledAt   : datetime
    }
}

// =============================================================================
// Ride Events
// =============================================================================

// realizes: REQ-RIDE-007
event RideCreated {
    fields {
        rideId          : uuid
        rideRequestId   : uuid
        riderId         : uuid
        driverId        : uuid
        pickupLocation  : Location
        dropoffLocation : Location
        fareEstimate    : FareEstimate
        createdAt       : datetime
    }
}

// realizes: REQ-RIDE-010
event DriverArrived {
    fields {
        rideId    : uuid
        riderId   : uuid
        driverId  : uuid
        arrivedAt : datetime
    }
}

// realizes: REQ-RIDE-012
event RideStarted {
    fields {
        rideId               : uuid
        riderId              : uuid
        driverId             : uuid
        actualPickupLocation : Location
        startedAt            : datetime
    }
}

// realizes: REQ-RIDE-013
event RideLocationUpdated {
    fields {
        rideId          : uuid
        currentLocation : Location
        updatedAt       : datetime
    }
}

// realizes: REQ-RIDE-014
event RideCompleted {
    fields {
        rideId                : uuid
        riderId               : uuid
        driverId              : uuid
        actualDropoffLocation : Location
        finalFare             : FinalFare
        completedAt           : datetime
    }
}

// realizes: REQ-RIDE-011
event RideCancelledNoShow {
    fields {
        rideId      : uuid
        riderId     : uuid
        driverId    : uuid
        feeAmount   : decimal
        cancelledAt : datetime
    }
}

// realizes: REQ-RIDE-021
event RideCancelledByRider {
    fields {
        rideId      : uuid
        riderId     : uuid
        driverId    : uuid
        feeAmount   : decimal
        cancelledAt : datetime
    }
}

// realizes: REQ-RIDE-022
event RideCancelledByDriver {
    fields {
        rideId      : uuid
        riderId     : uuid
        driverId    : uuid
        cancelledAt : datetime
    }
}

// realizes: REQ-RIDE-024, REQ-RIDE-025
event RideCancelledDriverNoShow {
    fields {
        rideId      : uuid
        riderId     : uuid
        driverId    : uuid
        cancelledAt : datetime
    }
}

// realizes: REQ-RIDE-027
event DriverNoShowRecorded {
    fields {
        driverId     : uuid
        rideId       : uuid
        rideRequestId: uuid
        recordedAt   : datetime
    }
}

// realizes: REQ-RIDE-030
event EmergencyTriggered {
    fields {
        rideId      : uuid
        emergencyId : uuid
        type        : EmergencyEventType
        triggeredBy : string
        location    : Location
        triggeredAt : datetime
    }
}

// realizes: REQ-RIDE-031
event TripSharingActivated {
    fields {
        rideId      : uuid
        riderId     : uuid
        activatedAt : datetime
    }
}

// realizes: REQ-RIDE-032
event UnusualStopDetected {
    fields {
        rideId       : uuid
        riderId      : uuid
        driverId     : uuid
        stopLocation : Location
        detectedAt   : datetime
    }
}

// realizes: REQ-RIDE-033
event SafetyReportFiled {
    fields {
        rideId     : uuid
        reportId   : uuid
        reportedBy : string
        severity   : SafetyReportSeverity
        reportedAt : datetime
    }
}
```

---

## Temporal Events

```
// =============================================================================
// Temporal Events — time-triggered domain facts
// =============================================================================

// realizes: REQ-RIDE-005
// Fires when a driver does not respond to a ride offer within the timeout period.
// Replaces the previous "// NOTE: 15-second timeout timer is scheduled via infrastructure"
temporal event RideOfferDeadlineElapsed {
    trigger   : relative
    reference : RideOffer.offeredAt     // the moment the offer was created
    offset    : 15 seconds
    guard     : rideOffer.status = pending
    // If the driver already accepted or rejected, the guard is false → suppressed
}

// realizes: REQ-RIDE-011
// Fires when the rider does not board within 5 minutes of driver arrival.
// Replaces the previous "// NOTE: 5-minute timer is infrastructure"
temporal event RiderBoardingDeadlineElapsed {
    trigger   : relative
    reference : DriverArrived           // the event that starts the countdown
    offset    : 5 minutes
    guard     : ride.status = driverArrived
    // If the ride already started (status = inProgress), the guard is false → suppressed
}

// realizes: REQ-RIDE-024
// Fires when the driver does not arrive within ETA + 5 minutes of ride creation.
// Replaces the previous "// NOTE: timer is infrastructure — scheduler triggers this command
//                         when ETA + 5 min grace elapses without a DriverArrived event"
temporal event DriverArrivalDeadlineElapsed {
    trigger   : relative
    reference : RideCreated             // the event that starts the countdown
    offset    : ride.estimatedDriverArrivalTime + 5 minutes
    guard     : ride.status = driverEnRoute
    // If the driver already arrived (status = driverArrived), the guard is false → suppressed
    //
    // RECOMPUTATION HEURISTIC: if a RouteRecalculated event changes the ETA,
    // define a recomputation policy that re-arms this deadline with the new ETA + 5 min.
}
```

### Temporal event → policy → command chains

These temporal events replace direct infrastructure-scheduled commands. The causal chain is now explicit:

| Temporal Event | Triggers Policy | Policy Effects Command |
|---|---|---|
| `RideOfferDeadlineElapsed` | `retractExpiredOffer` | `HandleOfferTimeout` |
| `RiderBoardingDeadlineElapsed` | `cancelOnRiderNoShow` | `CancelRideNoShow` |
| `DriverArrivalDeadlineElapsed` | `cancelOnDriverNoShow` | `CancelRideDriverNoShow` |

```
// realizes: REQ-RIDE-005
policy retractExpiredOffer {
    trigger : RideOfferDeadlineElapsed
    guard   : rideOffer.status = pending
    effect  : HandleOfferTimeout {
                  rideRequestId = rideOffer.rideRequest.id
                  offerId       = rideOffer.id
                  driverId      = rideOffer.driverId
              }
    :: "Offer timed out — retract and try next driver"
}

// realizes: REQ-RIDE-011
policy cancelOnRiderNoShow {
    trigger : RiderBoardingDeadlineElapsed
    guard   : ride.status = driverArrived
    effect  : CancelRideNoShow { rideId = ride.id }
    :: "Rider did not board within 5 minutes — cancel and charge fee"
}

// realizes: REQ-RIDE-024
policy cancelOnDriverNoShow {
    trigger : DriverArrivalDeadlineElapsed
    guard   : ride.status = driverEnRoute
    effect  : CancelRideDriverNoShow { rideId = ride.id }
    :: "Driver did not arrive within ETA + 5 min — cancel and re-match"
}
```

---

## Queries

```
// realizes: REQ-RIDE-013
query GetRideStatus {
    fields { rideId : uuid }
    reads-from Ride
    returns { Ride projection: status, driverId, currentRoute, pickupLocation, dropoffLocation }
}

// realizes: REQ-RIDE-031
query GetTripSharingView {
    fields { linkToken : string }
    reads-from Ride
    returns { Ride projection: status, driverId, currentRoute, pickupLocation, dropoffLocation }
}

// realizes: REQ-RIDE-013
query GetActiveRidesForDriver {
    fields { driverId : uuid }
    reads-from Ride
    returns { list of Ride in { driverEnRoute, driverArrived, inProgress } }
}

// realizes: REQ-RIDE-023
query GetDriverCancellationCount {
    fields { driverId : uuid, windowHours : int }
    reads-from Ride
    returns { count : int }
}

// realizes: REQ-RIDE-026
query GetDriverNoShowCount {
    fields { driverId : uuid, windowHours : int }
    reads-from Ride
    returns { count : int }
}
```

---

## Domain Services

```
// realizes: REQ-RIDE-004, REQ-RIDE-005, REQ-RIDE-006
service MatchingService :: "Coordinates finding drivers via Geolocation and offering rides" {
    operations {
        findAndOfferDriver(rideRequest: RideRequest): void
          :: "Find the closest available driver and create a RideOffer" {
            // 1. Query GeolocationGateway for nearby available drivers
            // 2. Filter already-offered drivers (check rideRequest.offers)
            // 3. If no eligible drivers remain → dispatch CancelRequestNoDriver command
            // 4. Otherwise → create RideOffer for closest driver with 15-second timeout
        }
    }
}
```

---

## Policies

```
// =============================================================================
// Reactive Policies
// =============================================================================

// realizes: REQ-RIDE-022
// When a driver cancels a Ride, re-enter matching by creating a new RideRequest
// with the same parameters (pickup, dropoff, rider)
policy reMatchOnDriverCancellation {
    trigger  : RideCancelledByDriver
    guard    : true
    effect   : RequestRide {
                   riderId         = event.riderId
                   pickupLocation  = ride.pickupLocation
                   dropoffLocation = ride.dropoffLocation
               }
    :: "Driver cancelled — re-enter matching for the rider with a new request"
}

// realizes: REQ-RIDE-023
// When a driver cancels, check their recent cancellation rate and suspend if excessive
policy suspendDriverOnExcessiveCancellation {
    trigger  : RideCancelledByDriver
    guard    : GetDriverCancellationCount(event.driverId, 24) > 3
    effect   : DriverManagementGateway.requestTemporarySuspension(event.driverId, 30)
    :: "Driver cancelled >3 rides in 24h — suspend for 30 minutes"
}

// realizes: REQ-RIDE-024, REQ-RIDE-025
// When a driver no-shows, re-enter matching for the rider with a new RideRequest
policy reMatchOnDriverNoShow {
    trigger  : RideCancelledDriverNoShow
    guard    : true
    effect   : RequestRide {
                   riderId         = event.riderId
                   pickupLocation  = ride.pickupLocation
                   dropoffLocation = ride.dropoffLocation
               }
    :: "Driver did not arrive — create a new request to find another driver"
}

// realizes: REQ-RIDE-026
// When a driver no-shows, check their recent no-show count and suspend if excessive
policy suspendDriverOnExcessiveNoShows {
    trigger  : RideCancelledDriverNoShow
    guard    : GetDriverNoShowCount(event.driverId, 24) > 2
    effect   : DriverManagementGateway.requestTemporarySuspension(event.driverId, 60)
    :: "Driver no-showed >2 times in 24h — suspend for 1 hour"
}

// realizes: REQ-RIDE-027
// When a driver no-shows, publish an event so Driver Management can degrade reliability score
policy recordDriverNoShowForReliability {
    trigger  : RideCancelledDriverNoShow
    guard    : true
    effect   : emits DriverNoShowRecorded {
                   driverId      = event.driverId
                   rideId        = event.rideId
                   rideRequestId = ride.rideRequestId
                   recordedAt    = now()
               }
    :: "Notify Driver Management of no-show for reliability scoring"
}
```

---

## Infrastructure Services

```
// realizes: REQ-RIDE-004, REQ-RIDE-013, REQ-RIDE-030, REQ-RIDE-032
// ACL to Geolocation & Routing bounded context
service GeolocationGateway {
    operations {
        findNearbyAvailableDrivers(pickupLocation: Location, radiusMeters: int): list<uuid>
        getCurrentRoute(rideId: uuid): Route
        getCurrentLocation(rideId: uuid): Location
        isStopOffRoute(rideId: uuid, stopLocation: Location): boolean
    }
}

// realizes: REQ-RIDE-003, REQ-RIDE-011, REQ-RIDE-015, REQ-RIDE-016, REQ-RIDE-021
// ACL to Payment bounded context
service PaymentGateway {
    operations {
        computeFareEstimate(pickupLocation: Location, dropoffLocation: Location): FareEstimate
        computeFinalFare(rideRequestId: uuid, pickupLocation: Location, dropoffLocation: Location,
                         startTime: datetime, endTime: datetime): FinalFare
        capturePayment(riderId: uuid, fare: FinalFare): void
        computeCancellationFee(rideRequestId: uuid): decimal
        chargeCancellationFee(riderId: uuid, amount: decimal): void
    }
}

// realizes: REQ-RIDE-006, REQ-RIDE-007, REQ-RIDE-010, REQ-RIDE-011,
//           REQ-RIDE-030, REQ-RIDE-031, REQ-RIDE-032, REQ-RIDE-033
service NotificationService {
    operations {
        notifyRider(riderId: uuid, message: string): void
        notifyDriver(driverId: uuid, message: string): void
        sendTrackingLink(contacts: list<TripSharingLink>, rideId: uuid): void
        sendSafetyCheck(riderId: uuid, rideId: uuid, stopLocation: Location): void
        shareLocationWithEmergencyServices(rideId: uuid, location: Location): void
        notifySafetyTeam(rideId: uuid, event: EmergencyEvent): void
        escalateToSafetyTeam(rideId: uuid, report: SafetyReport): void
    }
}

// realizes: REQ-RIDE-023
// ACL to Driver Management bounded context
service DriverManagementGateway {
    operations {
        requestTemporarySuspension(driverId: uuid, durationMinutes: int): void
    }
}
```

---

## Requirement Traceability Matrix

| Requirement | Aggregate | Model Elements |
|---|---|---|
| REQ-RIDE-001 | RideRequest | `RequestRide` cmd, `"Request a ride"` op, `RideRequested` event, `pickupAndDropoffRequired` invariant |
| REQ-RIDE-002 | RideRequest | `riderMustBeActive` policy |
| REQ-RIDE-003 | RideRequest | `FareEstimate` value, `PaymentGateway.computeFareEstimate`, `"Request a ride"` op |
| REQ-RIDE-004 | RideRequest | `MatchingService.findAndOfferDriver`, `GeolocationGateway.findNearbyAvailableDrivers`, `"Initiate driver matching"` reactor |
| REQ-RIDE-005 | RideRequest | `HandleOfferTimeout` cmd, `RideOfferTimedOut` event, `RideOffer` entity |
| REQ-RIDE-006 | RideRequest | `CancelRequestNoDriver` cmd, `RideRequestCancelled` event, `MatchingService` |
| REQ-RIDE-007 | RideRequest → Ride | `AcceptRideOffer` cmd, `RideRequestMatched` event (bridge), `CreateRide` cmd, `RideCreated` event |
| REQ-RIDE-008 | RideRequest | `RideScheduleType` enum, `scheduledPickupTime` field, `scheduledRideHasPickupTime` invariant |
| REQ-RIDE-010 | Ride | `SignalDriverArrival` cmd, `DriverArrived` event, `rideMustBeDriverEnRoute` policy |
| REQ-RIDE-011 | Ride | `CancelRideNoShow` cmd, `RideCancelledNoShow` event, `rideMustBeDriverArrivedForNoShow` policy |
| REQ-RIDE-012 | Ride | `StartRide` cmd, `RideStarted` event, `actualPickupLocation/Time` fields |
| REQ-RIDE-013 | Ride | `UpdateRideTracking` cmd, `RideLocationUpdated` event, `GeolocationGateway.getCurrentRoute` |
| REQ-RIDE-014 | Ride | `CompleteRide` cmd, `RideCompleted` event, `completedRideHasActualTimes` invariant |
| REQ-RIDE-015 | Ride | `FinalFare` value, `PaymentGateway.computeFinalFare`, `completedRideHasFinalFare` invariant |
| REQ-RIDE-016 | Ride | `PaymentGateway.capturePayment`, `"Complete the ride"` op |
| REQ-RIDE-020 | RideRequest | `CancelRequestByRider` cmd, `RideRequestCancelledByRider` event |
| REQ-RIDE-021 | Ride | `CancelRideByRider` cmd, `RideCancelledByRider` event, `rideCanBeCancelledByRider` policy |
| REQ-RIDE-022 | Ride | `CancelRideByDriver` cmd, `RideCancelledByDriver` event, `reMatchOnDriverCancellation` policy |
| REQ-RIDE-023 | Ride | `suspendDriverOnExcessiveCancellation` policy, `DriverManagementGateway.requestTemporarySuspension` |
| REQ-RIDE-024 | Ride | `CancelRideDriverNoShow` cmd, `"Cancel ride — driver no-show"` op, `RideCancelledDriverNoShow` event, `rideMustBeDriverEnRoute` policy |
| REQ-RIDE-025 | Ride | `RideCancelledDriverNoShow` event, `NotificationService.notifyRider`, `reMatchOnDriverNoShow` policy |
| REQ-RIDE-026 | Ride | `suspendDriverOnExcessiveNoShows` policy, `GetDriverNoShowCount` query, `DriverManagementGateway.requestTemporarySuspension` |
| REQ-RIDE-027 | Ride | `recordDriverNoShowForReliability` policy, `DriverNoShowRecorded` event (published to Driver Management BC) |
| REQ-RIDE-030 | Ride | `TriggerEmergency` cmd, `EmergencyEvent` entity, `EmergencyTriggered` event |
| REQ-RIDE-031 | Ride | `ActivateTripSharing` cmd, `TripSharingLink` value, `TripSharingActivated` event |
| REQ-RIDE-032 | Ride | `DetectUnusualStop` cmd, `UnusualStopDetected` event, `GeolocationGateway.isStopOffRoute` |
| REQ-RIDE-033 | Ride | `FileSafetyReport` cmd, `SafetyReport` entity, `SafetyReportFiled` event |
