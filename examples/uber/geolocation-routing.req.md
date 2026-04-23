# Geolocation & Routing — Requirements

Bounded Context: **Geolocation & Routing** (GEO)

Responsibility: Real-time driver positioning, ETA computation, route calculation, surge zone detection.

---

```
requirements "Driver Location Tracking" scoped-to GeolocationRouting {
  prd-source "specs/geolocation-routing.prd"

  REQ-GEO-001 "Driver location update" : event-driven
    source "Feature: Driver location tracking — Story: Driver-device location update — AC: Position recorded with timestamp"
    :: "Real-time positioning is the foundation of matching and ETA"
    "When the driver's device sends a location update, the Geolocation
     system shall record the position with a timestamp and make it
     available for proximity queries."
    priority must

  REQ-GEO-002 "Location update frequency" : state-driven
    source "Feature: Driver location tracking — Story: Driver-device location update — AC: One update every 4s while online"
    :: "Balance accuracy against battery and bandwidth"
    "While the driver is online, the Geolocation system shall accept
     location updates at a minimum frequency of one every four seconds."
    priority must

  REQ-GEO-003 "Stale location filtering" : unwanted
    source "Feature: Driver location tracking — Story: Filter stale and low-quality updates — AC: Discard timestamps > 30s old"
    :: "Old positions corrupt matching — discard them"
    "If a location update has a timestamp older than 30 seconds, then
     the Geolocation system shall discard the update."
    priority must

  REQ-GEO-004 "Location accuracy threshold" : unwanted
    source "Feature: Driver location tracking — Story: Filter stale and low-quality updates — AC: Discard accuracy > 100m"
    :: "Low-accuracy GPS fixes produce wrong ETAs and matching"
    "If a location update has horizontal accuracy worse than 100 meters,
     then the Geolocation system shall discard the update."
    priority should
}


requirements "Proximity & Matching Support" scoped-to GeolocationRouting {
  prd-source "specs/geolocation-routing.prd"

  REQ-GEO-010 "Nearby driver query" : event-driven
    source "Feature: Proximity queries and routing — Story: Nearby driver query — AC: Return online drivers within radius ordered by distance"
    :: "Matching needs to find the closest drivers fast"
    "When the Ride Management system queries for nearby available
     drivers given a pickup location and a search radius, the
     Geolocation system shall return the list of online drivers
     within the radius, ordered by distance."
    priority must

  REQ-GEO-011 "ETA computation" : event-driven
    source "Feature: Proximity queries and routing — Story: ETA computation — AC: Traffic-aware travel time"
    :: "Riders see ETA before and during ride — core UX"
    "When an ETA is requested between two points, the Geolocation
     system shall compute the estimated travel time using current
     traffic conditions and return it."
    priority must

  REQ-GEO-012 "Route computation" : event-driven
    source "Feature: Proximity queries and routing — Story: Route computation — AC: Polyline with distance and duration"
    :: "Turn-by-turn navigation for drivers and route tracking for riders"
    "When a route is requested between pickup and dropoff locations,
     the Geolocation system shall compute the optimal route and return
     the polyline with distance and estimated duration."
    priority must

  REQ-GEO-013 "Dynamic route recalculation" : complex
    source "Feature: Proximity queries and routing — Story: Dynamic route recalculation — AC: Recompute on significant traffic change and notify"
    :: "Traffic changes — keep the driver on the best path"
    "While a ride is in progress, when traffic conditions change
     significantly on the current route, the Geolocation system
     shall recompute the route and notify the Ride Management system."
    priority should
}


requirements "Surge Zones" scoped-to GeolocationRouting {
  prd-source "specs/geolocation-routing.prd"

  REQ-GEO-020 "Surge zone detection" : event-driven
    source "Feature: Surge zones — Story: Detect and declare a surge zone — AC: SurgeActivated event published with multiplier"
    :: "Supply-demand imbalance — incentivize drivers to move to high-demand areas"
    "When the ratio of ride requests to available drivers in a
     geographic zone exceeds the surge threshold, the Geolocation
     system shall declare the zone as surging and publish a
     SurgeActivated event with the surge multiplier."
    priority must

  REQ-GEO-021 "Surge zone deactivation" : event-driven
    source "Feature: Surge zones — Story: Deactivate the surge when supply catches up — AC: SurgeDeactivated event published"
    :: "Surge must end when supply catches up — riders should not overpay"
    "When the supply-demand ratio in a surging zone returns below
     the surge threshold, the Geolocation system shall deactivate
     the surge and publish a SurgeDeactivated event."
    priority must

  REQ-GEO-022 "Surge multiplier cap" : ubiquitous
    source "Feature: Surge zones — Story: Hard cap on surge multiplier — AC: Maximum multiplier 5.0x"
    :: "Regulatory and PR risk — surge must not be predatory"
    "The Geolocation system shall enforce a maximum surge multiplier
     of 5.0x."
    priority must

  REQ-GEO-023 "Surge transparency" : event-driven
    source "Feature: Surge zones — Story: Surge transparency to the rider — AC: Display multiplier and require explicit confirmation"
    :: "Riders must consent to surge pricing before committing"
    "When a rider requests a ride in a surging zone, the Ride
     Management system shall display the surge multiplier and
     require explicit rider confirmation before proceeding."
    priority must
}
```

## Summary

| Pattern | Count |
|---|---|
| ubiquitous | 1 |
| state-driven | 1 |
| event-driven | 6 |
| unwanted | 2 |
| complex | 1 |
| **Total** | **10** (7 must, 3 should) |

## Cross-Context Dependencies

| Requirement | Depends on | Nature |
|---|---|---|
| REQ-GEO-023 (Surge transparency) | Ride Management | Geo → Ride: display surge to rider |

Note: REQ-GEO-010 (Nearby driver query) and REQ-GEO-011/012 (ETA/Route) are services *consumed by* Ride Management — the dependency flows from Ride → Geo (documented in ride-management.sysreq.md).
