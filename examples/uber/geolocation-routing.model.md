# Geolocation & Routing — Domain Model

Bounded Context: **Geolocation & Routing** (GEO)

Responsibility: Real-time driver positioning, ETA computation, route calculation, surge zone detection.

---

```
module GeolocationRouting

// =============================================================================
// Context Map
// =============================================================================

// Upstream: RideManagement (consumes NearbyDriverQuery, ETA, Route, SurgeZone info)
// Downstream: TrafficDataProvider (infrastructure — external traffic API)
// Downstream: MappingProvider (infrastructure — external maps/geocoding API)

// =============================================================================
// Enums
// =============================================================================

enum SurgeZoneStatus {
    inactive
    active
}

enum DriverAvailability {
    online
    offline
    onTrip
}

// =============================================================================
// Value Objects
// =============================================================================

value GeoCoordinate :: "A geographic point on the Earth's surface" {
    realizes: REQ-GEO-001
    fields {
        latitude : decimal min(-90) max(90)
        longitude : decimal min(-180) max(180)
    }
}

value BoundingBox :: "A rectangular geographic area defined by two corners" {
    realizes: REQ-GEO-010
    fields {
        southWest : GeoCoordinate
        northEast : GeoCoordinate
    }
}

value Polyline :: "An encoded sequence of coordinates representing a route path" {
    realizes: REQ-GEO-012
    fields {
        encodedPath : string
        coordinates : list<GeoCoordinate>
    }
}

value Distance :: "A physical distance measurement" {
    realizes: REQ-GEO-012
    fields {
        meters : decimal min(0)
    }
}

value Duration :: "A time duration measurement" {
    realizes: REQ-GEO-011, REQ-GEO-012
    fields {
        seconds : int min(0)
    }
}

value ETA :: "Estimated time of arrival between two points" {
    realizes: REQ-GEO-011
    fields {
        origin : GeoCoordinate
        destination : GeoCoordinate
        duration : Duration
        computedAt : datetime
    }
}

value SurgeMultiplier :: "A pricing multiplier applied during high-demand periods" {
    realizes: REQ-GEO-020, REQ-GEO-022
    fields {
        value : decimal min(1.0) max(5.0)
    }

    invariants {
        surgeMultiplierCap :: "Surge multiplier must never exceed 5.0x" {
            value <= 5.0
        }
    }
}

value Route :: "A computed route between two points with metadata" {
    realizes: REQ-GEO-012
    fields {
        origin : GeoCoordinate
        destination : GeoCoordinate
        polyline : Polyline
        distance : Distance
        duration : Duration
        computedAt : datetime
    }
}

value LocationAccuracy :: "Horizontal accuracy of a GPS fix in meters" {
    realizes: REQ-GEO-004
    fields {
        horizontalAccuracyMeters : decimal min(0)
    }
}

// =============================================================================
// Entities
// =============================================================================

entity DriverPosition :: "Real-time geographic position of a driver — continuously updated projection" {
    realizes: REQ-GEO-001, REQ-GEO-002, REQ-GEO-003, REQ-GEO-004
    identifier driverId : UUID
    fields {
        position : GeoCoordinate
        accuracy : LocationAccuracy
        heading : decimal optional min(0) max(360)
        speed : decimal optional min(0)
        availability : DriverAvailability default("online")
        recordedAt : datetime
        receivedAt : datetime
    }

    policies {
        locationMustBeFresh(recordedAt: datetime) :: "Discard location updates older than 30 seconds" {
            realizes: REQ-GEO-003
            now() - recordedAt <= 30s
        }

        locationMustBeAccurate(accuracy: LocationAccuracy) :: "Discard location updates with horizontal accuracy worse than 100 meters" {
            realizes: REQ-GEO-004
            accuracy.horizontalAccuracyMeters <= 100
        }
    }

    invariants {
        positionHasTimestamp :: "Every driver position must have a recording timestamp" {
            recordedAt is defined
        }
    }

    operations {
        "Update driver location" on UpdateDriverLocation {
            realizes: REQ-GEO-001, REQ-GEO-002

            policy locationMustBeFresh(updateDriverLocation.recordedAt)
            policy locationMustBeAccurate(updateDriverLocation.accuracy)

            sets DriverPosition {
                position = updateDriverLocation.position
                accuracy = updateDriverLocation.accuracy
                heading = updateDriverLocation.heading
                speed = updateDriverLocation.speed
                recordedAt = updateDriverLocation.recordedAt
                receivedAt = now()
            }

            emits DriverLocationUpdated {
                driverId = DriverPosition.driverId
                position = DriverPosition.position
                accuracy = DriverPosition.accuracy
                recordedAt = DriverPosition.recordedAt
            }
        }

        "Set driver availability" on SetDriverAvailability {
            sets DriverPosition {
                availability = setDriverAvailability.availability
            }

            emits DriverAvailabilityChanged {
                driverId = DriverPosition.driverId
                availability = DriverPosition.availability
                changedAt = now()
            }
        }
    }
}

entity SurgeZone :: "A geographic zone where demand/supply imbalance triggers surge pricing" {
    realizes: REQ-GEO-020, REQ-GEO-021, REQ-GEO-022, REQ-GEO-023
    identifier zoneId : UUID
    fields {
        name : string maxLength(200)
        boundary : BoundingBox
        status : SurgeZoneStatus default("inactive")
        currentMultiplier : SurgeMultiplier optional
        demandSupplyRatio : decimal optional min(0)
        surgeThreshold : decimal min(0) default("2.0")
        activatedAt : datetime optional
        deactivatedAt : datetime optional
    }

    policies {
        ratioExceedsThreshold(zone: SurgeZone) :: "Demand/supply ratio must exceed surge threshold to activate" {
            realizes: REQ-GEO-020
            zone.demandSupplyRatio > zone.surgeThreshold
        }

        ratioBelowThreshold(zone: SurgeZone) :: "Demand/supply ratio must be below surge threshold to deactivate" {
            realizes: REQ-GEO-021
            zone.demandSupplyRatio <= zone.surgeThreshold
        }

        multiplierWithinCap(multiplier: SurgeMultiplier) :: "Surge multiplier must not exceed the maximum of 5.0x" {
            realizes: REQ-GEO-022
            multiplier.value <= 5.0
        }

        zoneMustBeInactive(zone: SurgeZone) :: "Zone must be inactive to activate surge" {
            zone.status = inactive
        }

        zoneMustBeActive(zone: SurgeZone) :: "Zone must be active to deactivate surge" {
            zone.status = active
        }
    }

    invariants {
        activeZoneHasMultiplier :: "An active surge zone must have a multiplier" {
            realizes: REQ-GEO-020
            if status = active {
                currentMultiplier is defined
            }
        }

        multiplierNeverExceedsCap :: "Surge multiplier must never exceed 5.0x" {
            realizes: REQ-GEO-022
            if currentMultiplier is defined {
                currentMultiplier.value <= 5.0
            }
        }
    }

    operations {
        "Activate surge in zone" on ActivateSurge {
            realizes: REQ-GEO-020, REQ-GEO-022

            resolves SurgeZone from activateSurge.zoneId

            policy zoneMustBeInactive(SurgeZone)
            policy ratioExceedsThreshold(SurgeZone)
            policy multiplierWithinCap(activateSurge.multiplier)

            sets SurgeZone {
                status = active
                currentMultiplier = activateSurge.multiplier
                demandSupplyRatio = activateSurge.demandSupplyRatio
                activatedAt = now()
            }

            emits SurgeActivated {
                zoneId = SurgeZone.zoneId
                zoneName = SurgeZone.name
                multiplier = SurgeZone.currentMultiplier
                demandSupplyRatio = SurgeZone.demandSupplyRatio
                activatedAt = SurgeZone.activatedAt
            }
        }

        "Deactivate surge in zone" on DeactivateSurge {
            realizes: REQ-GEO-021

            resolves SurgeZone from deactivateSurge.zoneId

            policy zoneMustBeActive(SurgeZone)
            policy ratioBelowThreshold(SurgeZone)

            sets SurgeZone {
                status = inactive
                currentMultiplier = deactivateSurge.multiplier
                demandSupplyRatio = deactivateSurge.demandSupplyRatio
                deactivatedAt = now()
            }

            emits SurgeDeactivated {
                zoneId = SurgeZone.zoneId
                zoneName = SurgeZone.name
                previousMultiplier = deactivateSurge.previousMultiplier
                deactivatedAt = SurgeZone.deactivatedAt
            }
        }

        "Update surge multiplier" on UpdateSurgeMultiplier {
            realizes: REQ-GEO-022

            resolves SurgeZone from updateSurgeMultiplier.zoneId

            policy zoneMustBeActive(SurgeZone)
            policy multiplierWithinCap(updateSurgeMultiplier.multiplier)

            sets SurgeZone {
                currentMultiplier = updateSurgeMultiplier.multiplier
                demandSupplyRatio = updateSurgeMultiplier.demandSupplyRatio
            }

            emits SurgeMultiplierUpdated {
                zoneId = SurgeZone.zoneId
                previousMultiplier = updateSurgeMultiplier.previousMultiplier
                newMultiplier = SurgeZone.currentMultiplier
                updatedAt = now()
            }
        }
    }

    transitions {
        [*] --> inactive
        inactive --> active on "Activate surge in zone"
        active --> inactive on "Deactivate surge in zone"
    }
}

// =============================================================================
// Domain Services
// =============================================================================

service ProximityService :: "Spatial queries over real-time driver positions" {
    realizes: REQ-GEO-010
    operations {
        findNearbyDrivers(pickup: GeoCoordinate, radiusMeters: decimal, maxResults: int) : list<DriverPosition> :: "Find online drivers within radius, ordered by distance" {
            realizes: REQ-GEO-010
            // NOTE: uses spatial index over DriverPosition records
            // Filters: availability = online, position within radius
            // Orders results by ascending distance from pickup
            returns list<DriverPosition>
        }
    }
}

service RoutingService :: "Route and ETA computation using traffic-aware algorithms" {
    realizes: REQ-GEO-011, REQ-GEO-012, REQ-GEO-013
    operations {
        computeETA(origin: GeoCoordinate, destination: GeoCoordinate) : ETA :: "Compute estimated travel time considering current traffic" {
            realizes: REQ-GEO-011
            TrafficDataProvider.getCurrentTraffic(origin, destination)
            MappingProvider.computeRoute(origin, destination)
            returns ETA
        }

        computeRoute(origin: GeoCoordinate, destination: GeoCoordinate) : Route :: "Compute optimal route with polyline, distance, and duration" {
            realizes: REQ-GEO-012
            TrafficDataProvider.getCurrentTraffic(origin, destination)
            MappingProvider.computeRoute(origin, destination)
            returns Route
        }

        recalculateRoute(rideId: uuid, currentPosition: GeoCoordinate, destination: GeoCoordinate) : Route :: "Recompute route when traffic conditions change significantly" {
            realizes: REQ-GEO-013
            TrafficDataProvider.getCurrentTraffic(currentPosition, destination)
            MappingProvider.computeRoute(currentPosition, destination)
            returns Route
        }
    }
}

service SurgeDetectionService :: "Monitors demand/supply ratios and triggers surge zone activation" {
    realizes: REQ-GEO-020, REQ-GEO-021
    operations {
        evaluateZone(zoneId: uuid, requestCount: int, availableDriverCount: int) : void :: "Evaluate demand/supply ratio and activate or deactivate surge" {
            realizes: REQ-GEO-020, REQ-GEO-021
            resolves SurgeZone from zoneId
            // NOTE: computes demandSupplyRatio = requestCount / availableDriverCount
            // If ratio > threshold and zone inactive → SurgeZone.ActivateSurge
            // If ratio <= threshold and zone active → SurgeZone.DeactivateSurge
        }

        computeMultiplier(demandSupplyRatio: decimal) : SurgeMultiplier :: "Derive surge multiplier from demand/supply ratio, capped at 5.0x" {
            realizes: REQ-GEO-020, REQ-GEO-022
            // NOTE: multiplier = min(demandSupplyRatio, 5.0)
            returns SurgeMultiplier
        }
    }
}

// =============================================================================
// Infrastructure Services
// =============================================================================

// NOTE: TrafficDataProvider is an infrastructure service wrapping an external traffic API
service TrafficDataProvider :: "External traffic data provider — infrastructure boundary" {
    realizes: REQ-GEO-011, REQ-GEO-013
    operations {
        getCurrentTraffic(origin: GeoCoordinate, destination: GeoCoordinate) : void :: "Fetch real-time traffic conditions between two points" {
            // NOTE: infrastructure — delegates to external traffic API (e.g., Google Maps, HERE, Mapbox)
        }
    }
}

// NOTE: MappingProvider is an infrastructure service wrapping an external maps/geocoding API
service MappingProvider :: "External mapping and geocoding provider — infrastructure boundary" {
    realizes: REQ-GEO-012
    operations {
        computeRoute(origin: GeoCoordinate, destination: GeoCoordinate) : Route :: "Compute route via external mapping API" {
            // NOTE: infrastructure — delegates to external maps API
            returns Route
        }
    }
}

// =============================================================================
// File-level Policies (cross-entity)
// =============================================================================

policy surgeConfirmationRequired(zone: SurgeZone) :: "Rider must see surge multiplier and confirm before ride request proceeds" {
    realizes: REQ-GEO-023
    if zone.status = active {
        zone.currentMultiplier is defined
    }
}

// =============================================================================
// Commands
// =============================================================================

command UpdateDriverLocation {
    realizes: REQ-GEO-001, REQ-GEO-002
    fields {
        driverId : uuid
        position : GeoCoordinate
        accuracy : LocationAccuracy
        heading : decimal optional
        speed : decimal optional
        recordedAt : datetime
    }
}

command SetDriverAvailability {
    fields {
        driverId : uuid
        availability : DriverAvailability
    }
}

command ActivateSurge {
    realizes: REQ-GEO-020
    fields {
        zoneId : uuid
        multiplier : SurgeMultiplier
        demandSupplyRatio : decimal
    }
}

command DeactivateSurge {
    realizes: REQ-GEO-021
    fields {
        zoneId : uuid
        multiplier : SurgeMultiplier
        demandSupplyRatio : decimal
        previousMultiplier : SurgeMultiplier
    }
}

command UpdateSurgeMultiplier {
    realizes: REQ-GEO-022
    fields {
        zoneId : uuid
        multiplier : SurgeMultiplier
        demandSupplyRatio : decimal
        previousMultiplier : SurgeMultiplier
    }
}

// =============================================================================
// Queries
// =============================================================================

// NOTE: Queries are read-only requests — they do not mutate state

query FindNearbyDrivers {
    realizes: REQ-GEO-010
    fields {
        pickupLocation : GeoCoordinate
        radiusMeters : decimal default("5000")
        maxResults : int default("20")
    }
    returns : list<DriverPosition>
}

query ComputeETA {
    realizes: REQ-GEO-011
    fields {
        origin : GeoCoordinate
        destination : GeoCoordinate
    }
    returns : ETA
}

query ComputeRoute {
    realizes: REQ-GEO-012
    fields {
        origin : GeoCoordinate
        destination : GeoCoordinate
    }
    returns : Route
}

query GetSurgeZoneInfo {
    realizes: REQ-GEO-023
    fields {
        zoneId : uuid
    }
    returns : SurgeZone
}

// =============================================================================
// Events
// =============================================================================

event DriverLocationUpdated {
    realizes: REQ-GEO-001
    fields {
        driverId : uuid
        position : GeoCoordinate
        accuracy : LocationAccuracy
        recordedAt : datetime
    }
}

event DriverAvailabilityChanged {
    fields {
        driverId : uuid
        availability : DriverAvailability
        changedAt : datetime
    }
}

event SurgeActivated {
    realizes: REQ-GEO-020
    fields {
        zoneId : uuid
        zoneName : string
        multiplier : SurgeMultiplier
        demandSupplyRatio : decimal
        activatedAt : datetime
    }
}

event SurgeDeactivated {
    realizes: REQ-GEO-021
    fields {
        zoneId : uuid
        zoneName : string
        previousMultiplier : SurgeMultiplier
        deactivatedAt : datetime
    }
}

event SurgeMultiplierUpdated {
    realizes: REQ-GEO-022
    fields {
        zoneId : uuid
        previousMultiplier : SurgeMultiplier
        newMultiplier : SurgeMultiplier
        updatedAt : datetime
    }
}

event RouteRecalculated {
    realizes: REQ-GEO-013
    fields {
        rideId : uuid
        newRoute : Route
        recalculatedAt : datetime
    }
}
```

---

## Traceability Matrix

| Requirement | Realized By |
|---|---|
| REQ-GEO-001 | GeoCoordinate, DriverPosition, UpdateDriverLocation (cmd + op), DriverLocationUpdated |
| REQ-GEO-002 | DriverPosition, UpdateDriverLocation (cmd + op) |
| REQ-GEO-003 | DriverPosition.locationMustBeFresh (policy) |
| REQ-GEO-004 | LocationAccuracy, DriverPosition.locationMustBeAccurate (policy) |
| REQ-GEO-010 | BoundingBox, ProximityService.findNearbyDrivers, FindNearbyDrivers (query) |
| REQ-GEO-011 | ETA, Duration, RoutingService.computeETA, TrafficDataProvider, ComputeETA (query) |
| REQ-GEO-012 | Route, Polyline, Distance, Duration, RoutingService.computeRoute, MappingProvider, ComputeRoute (query) |
| REQ-GEO-013 | RoutingService.recalculateRoute, TrafficDataProvider, RouteRecalculated (event) |
| REQ-GEO-020 | SurgeMultiplier, SurgeZone, SurgeDetectionService.evaluateZone, ActivateSurge (cmd + op), SurgeActivated |
| REQ-GEO-021 | SurgeZone, SurgeDetectionService.evaluateZone, DeactivateSurge (cmd + op), SurgeDeactivated |
| REQ-GEO-022 | SurgeMultiplier (invariant: max 5.0), SurgeZone.multiplierWithinCap (policy), UpdateSurgeMultiplier (cmd + op), SurgeMultiplierUpdated |
| REQ-GEO-023 | surgeConfirmationRequired (file-level policy), GetSurgeZoneInfo (query) |
