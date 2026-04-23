# Driver Management — Domain Model

Bounded Context: **Driver Management** (DRV)

Responsibility: Onboarding, identity verification, vehicle registration, availability, ratings, suspension.

---

## Context Map

| Relation | Other Bounded Context | Position | Pattern | Description |
|---|---|---|---|---|
| DRV → RideManagement | Ride Management (RIDE) | upstream | Open Host Service (OHS) | DRV publishes driver availability events (DriverWentOnline, DriverWentOffline) consumed by Ride Management for matching. |
| DRV ← RideManagement | Ride Management (RIDE) | downstream | Anti-Corruption Layer (ACL) | DRV consumes RideCompleted events from Ride Management to trigger rating workflows. The ACL translates ride concepts into DRV's ubiquitous language. |
| DRV → RiderManagement | Rider Management (RDR) | upstream | Open Host Service (OHS) | DRV publishes DriverSuspended events; Rider Management may use them for transparency. |
| DRV ← GeolocationRouting | Geolocation & Routing (GEO) | downstream | Anti-Corruption Layer (ACL) | DRV consumes location updates from GEO to detect inactivity timeouts. |

---

## Value Types

### EmailAddress

- **Fields:**
  - `value`: String
- **Invariants:**
  - `ValidEmailFormat`: `value` must match a valid email pattern — enforcement: rejection
- **Realizes:** (supporting type, no direct requirement)

### PhoneNumber

- **Fields:**
  - `countryCode`: String
  - `number`: String
- **Invariants:**
  - `ValidPhoneFormat`: `countryCode` must be a valid ISO country dial code and `number` must contain only digits — enforcement: rejection
- **Realizes:** (supporting type, no direct requirement)

### FullName

- **Fields:**
  - `firstName`: String
  - `lastName`: String
- **Invariants:**
  - `NonBlankName`: both `firstName` and `lastName` must be non-blank — enforcement: rejection
- **Realizes:** (supporting type, no direct requirement)

### Rating

- **Fields:**
  - `value`: Integer
- **Invariants:**
  - `RatingRange`: `value >= 1 AND value <= 5` — enforcement: rejection
- **Realizes:** REQ-DRV-021

### AverageRating

- **Fields:**
  - `value`: Decimal
  - `totalRatings`: Integer
  - `ratingSum`: Integer
- **Operations:**
  - `incorporate(newRating: Rating) -> AverageRating`: returns a new AverageRating with `totalRatings + 1`, `ratingSum + newRating.value`, and recomputed `value = ratingSum / totalRatings`
- **Invariants:**
  - `NonNegativeTotals`: `totalRatings >= 0 AND ratingSum >= 0` — enforcement: rejection
  - `ConsistentAverage`: `totalRatings == 0 OR value == ratingSum / totalRatings` — enforcement: rejection
- **Realizes:** REQ-DRV-020

### Address

- **Fields:**
  - `street`: String
  - `city`: String
  - `state`: String
  - `zipCode`: String
  - `country`: String
- **Invariants:**
  - `NonBlankRequiredFields`: `street`, `city`, `zipCode`, and `country` must be non-blank — enforcement: rejection
- **Realizes:** (supporting type, no direct requirement)

### DocumentType

- **Fields:**
  - `value`: Enum { DRIVERS_LICENSE, PASSPORT, NATIONAL_ID }
- **Realizes:** REQ-DRV-002

### VehicleDetails

- **Fields:**
  - `make`: String
  - `model`: String
  - `year`: Integer
  - `color`: String
  - `licensePlate`: String
- **Invariants:**
  - `ValidYear`: `year >= 1900 AND year <= currentYear + 1` — enforcement: rejection
  - `NonBlankPlate`: `licensePlate` must be non-blank — enforcement: rejection
- **Realizes:** REQ-DRV-005

### InspectionResult

- **Fields:**
  - `passed`: Boolean
  - `inspectedAt`: DateTime
  - `expiresAt`: DateTime
  - `notes`: String (optional)
- **Invariants:**
  - `ExpiryAfterInspection`: `expiresAt > inspectedAt` — enforcement: rejection
- **Realizes:** REQ-DRV-006

### AppealDetails

- **Fields:**
  - `reason`: String
  - `submittedAt`: DateTime
  - `supportingDocumentIds`: List<String> (optional)
- **Invariants:**
  - `NonBlankReason`: `reason` must be non-blank — enforcement: rejection
- **Realizes:** REQ-DRV-023

### AppealResolution

- **Fields:**
  - `outcome`: Enum { REINSTATED, PERMANENTLY_SUSPENDED }
  - `resolvedBy`: String
  - `resolvedAt`: DateTime
  - `justification`: String
- **Invariants:**
  - `NonBlankJustification`: `justification` must be non-blank — enforcement: rejection
- **Realizes:** REQ-DRV-024

---

## Entities

### IdentityDocument

- **Identity:** `documentId`: UUID
- **Fields:**
  - `driverId`: UUID (reference to Driver)
  - `documentType`: DocumentType
  - `documentNumber`: String
  - `fileUrl`: String
  - `uploadedAt`: DateTime
  - `expiresAt`: DateTime
  - `verified`: Boolean
- **Invariants:**
  - `NonBlankDocumentNumber`: `documentNumber` must be non-blank — enforcement: rejection
  - `NonBlankFileUrl`: `fileUrl` must be non-blank — enforcement: rejection
  - `FutureExpiry`: `expiresAt > uploadedAt` — enforcement: rejection
- **Operations:**
  - `upload(documentType: DocumentType, documentNumber: String, fileUrl: String, expiresAt: DateTime) -> IdentityDocument`
    - Preconditions: `documentNumber` is non-blank; `fileUrl` is non-blank; `expiresAt` is in the future
    - Postconditions: `verified == false`; `uploadedAt` is set to current time
  - `markVerified() -> IdentityDocument`
    - Preconditions: `verified == false`
    - Postconditions: `verified == true`
  - `checkExpiry(now: DateTime) -> IdentityDocument`
    - Preconditions: none
    - Postconditions: returns the document; caller inspects `expiresAt < now`
- **Realizes:** REQ-DRV-002, REQ-DRV-007

### Vehicle

- **Identity:** `vehicleId`: UUID
- **Fields:**
  - `driverId`: UUID (reference to Driver)
  - `details`: VehicleDetails
  - `inspectionResult`: InspectionResult (optional)
  - `registeredAt`: DateTime
- **Invariants:**
  - `InspectionRequiredForActivation`: if the driver requests activation, `inspectionResult` must be present and `inspectionResult.passed == true` and `inspectionResult.expiresAt > now` — enforcement: rejection
- **Operations:**
  - `register(driverId: UUID, details: VehicleDetails) -> Vehicle`
    - Preconditions: `details.licensePlate` is non-blank
    - Postconditions: `registeredAt` is set to current time; `inspectionResult` is null
  - `recordInspection(result: InspectionResult) -> Vehicle`
    - Preconditions: `result.inspectedAt <= now`
    - Postconditions: `inspectionResult == result`
  - `checkInspectionExpiry(now: DateTime) -> Boolean`
    - Preconditions: `inspectionResult` is present
    - Postconditions: returns `inspectionResult.expiresAt < now`
- **Duplicate detection:** `details.licensePlate` — no two vehicles may share the same license plate
- **Realizes:** REQ-DRV-005, REQ-DRV-006, REQ-DRV-007

### Driver (Aggregate Root)

- **Identity:** `driverId`: UUID
- **Fields:**
  - `fullName`: FullName
  - `email`: EmailAddress
  - `phone`: PhoneNumber
  - `address`: Address
  - `identityDocuments`: List<IdentityDocument>
  - `vehicle`: Vehicle (optional)
  - `averageRating`: AverageRating
  - `totalRidesCompleted`: Integer
  - `suspensionReason`: String (optional)
  - `appeal`: AppealDetails (optional)
  - `appealResolution`: AppealResolution (optional)
  - `lastLocationUpdateAt`: DateTime (optional)
  - `registeredAt`: DateTime
  - `verifiedAt`: DateTime (optional)
  - `suspendedAt`: DateTime (optional)

#### State Machine 1: Verification Lifecycle

- **States:**
  - `pending-verification` (start state)
    - Invariants: `identityDocuments` may be empty; `vehicle` may be absent; `verifiedAt` is null
  - `verified`
    - Invariants: at least one `IdentityDocument` with `verified == true`; `verifiedAt` is not null
  - `rejected` (final state)
    - Invariants: driver cannot transition to any other verification state
  - `suspended`
    - Invariants: `suspensionReason` is non-blank; `suspendedAt` is not null
  - `appeal-in-review`
    - Invariants: `appeal` is not null; `suspensionReason` is non-blank
  - `permanently-suspended` (final state)
    - Invariants: `appealResolution.outcome == PERMANENTLY_SUSPENDED`

- **Transitions:**

  | From | To | Triggered by | Guard | Realizes |
  |---|---|---|---|---|
  | pending-verification | verified | completeBackgroundCheck | backgroundCheckResult == CLEAR | REQ-DRV-003 |
  | pending-verification | rejected | rejectApplication | backgroundCheckResult == FAILED | REQ-DRV-004 |
  | verified | suspended | suspend | suspensionReason is provided | REQ-DRV-007, REQ-DRV-022 |
  | suspended | appeal-in-review | submitAppeal | appeal details are provided | REQ-DRV-023 |
  | appeal-in-review | verified | resolveAppeal | resolution.outcome == REINSTATED | REQ-DRV-024 |
  | appeal-in-review | permanently-suspended | resolveAppeal | resolution.outcome == PERMANENTLY_SUSPENDED | REQ-DRV-024 |

#### State Machine 2: Availability

- **States:**
  - `offline` (start state)
    - Invariants: none
  - `online`
    - Invariants: `lastLocationUpdateAt` is not null; verification lifecycle state must be `verified` (not `suspended`, not `appeal-in-review`, not `permanently-suspended`)

- **Transitions:**

  | From | To | Triggered by | Guard | Realizes |
  |---|---|---|---|---|
  | offline | online | goOnline | verification state == `verified` AND driver is not suspended AND vehicle is present AND vehicle inspection is valid | REQ-DRV-010, REQ-DRV-006, REQ-DRV-012 |
  | online | offline | goOffline | none | REQ-DRV-011 |
  | online | offline | timeoutInactivity | `now - lastLocationUpdateAt > 5 minutes` | REQ-DRV-013 |

- **Cross-machine constraint:** When verification lifecycle transitions to `suspended`, if availability is `online`, availability must immediately transition to `offline`.

#### Operations

- **registerDriver(fullName: FullName, email: EmailAddress, phone: PhoneNumber, address: Address) -> Driver**
  - Preconditions: `fullName`, `email`, `phone` are valid value types
  - Postconditions: driver is created with verification state = `pending-verification`, availability state = `offline`, `averageRating` initialized to (value=0.0, totalRatings=0, ratingSum=0), `totalRidesCompleted = 0`
  - Emits: `DriverRegistered`
  - Realizes: REQ-DRV-001

- **uploadIdentityDocument(documentType: DocumentType, documentNumber: String, fileUrl: String, expiresAt: DateTime) -> Driver**
  - Preconditions: verification state is `pending-verification` or `verified`; `documentNumber` is non-blank; `fileUrl` is non-blank; `expiresAt` is in the future
  - Postconditions: new `IdentityDocument` is added to `identityDocuments` with `verified = false`
  - Emits: `IdentityDocumentUploaded`
  - Realizes: REQ-DRV-002

- **completeBackgroundCheck(backgroundCheckResult: Enum { CLEAR, FAILED }) -> Driver**
  - Preconditions: verification state is `pending-verification`
  - Postconditions (CLEAR): verification state = `verified`; `verifiedAt` is set to current time
  - Postconditions (FAILED): verification state = `rejected`
  - Emits: `BackgroundCheckCompleted` (when CLEAR), `BackgroundCheckFailed` (when FAILED)
  - Realizes: REQ-DRV-003, REQ-DRV-004

- **registerVehicle(details: VehicleDetails) -> Driver**
  - Preconditions: verification state is `pending-verification` or `verified`
  - Postconditions: `vehicle` is set with the provided details; `vehicle.inspectionResult` is null
  - Emits: `VehicleRegistered`
  - Realizes: REQ-DRV-005

- **recordVehicleInspection(result: InspectionResult) -> Driver**
  - Preconditions: `vehicle` is present; `result.inspectedAt <= now`
  - Postconditions: `vehicle.inspectionResult == result`
  - Emits: `VehicleInspectionRecorded`
  - Realizes: REQ-DRV-006

- **goOnline() -> Driver**
  - Preconditions: verification state == `verified`; driver is not suspended; `vehicle` is present; `vehicle.inspectionResult` is present and `passed == true` and `expiresAt > now`
  - Postconditions: availability state = `online`; `lastLocationUpdateAt` is set to current time
  - Emits: `DriverWentOnline`
  - Violation reason (suspended): "Suspended drivers cannot go online"
  - Violation reason (no vehicle): "A vehicle with valid inspection is required to go online"
  - Realizes: REQ-DRV-010, REQ-DRV-006, REQ-DRV-012

- **goOffline() -> Driver**
  - Preconditions: availability state == `online`
  - Postconditions: availability state = `offline`
  - Emits: `DriverWentOffline`
  - Realizes: REQ-DRV-011

- **timeoutInactivity(now: DateTime) -> Driver**
  - Preconditions: availability state == `online`; `now - lastLocationUpdateAt > 5 minutes`
  - Postconditions: availability state = `offline`
  - Emits: `DriverWentOffline`
  - Realizes: REQ-DRV-013

- **updateLocation(latitude: Decimal, longitude: Decimal, timestamp: DateTime) -> Driver**
  - Preconditions: availability state == `online`
  - Postconditions: `lastLocationUpdateAt = timestamp`
  - Emits: (none — internal heartbeat)
  - Realizes: REQ-DRV-013

- **submitRating(rating: Rating) -> Driver**
  - Preconditions: `rating.value >= 1 AND rating.value <= 5`
  - Postconditions: `averageRating = averageRating.incorporate(rating)`; `totalRidesCompleted` is incremented by 1
  - Emits: `RatingSubmitted`
  - Realizes: REQ-DRV-020, REQ-DRV-021

- **suspend(reason: String) -> Driver**
  - Preconditions: verification state is `verified`; `reason` is non-blank
  - Postconditions: verification state = `suspended`; `suspensionReason = reason`; `suspendedAt` is set to current time; if availability state was `online`, availability state = `offline`
  - Emits: `DriverSuspended`, and `DriverWentOffline` if was online
  - Realizes: REQ-DRV-007, REQ-DRV-022

- **submitAppeal(appeal: AppealDetails) -> Driver**
  - Preconditions: verification state == `suspended`; `appeal.reason` is non-blank
  - Postconditions: verification state = `appeal-in-review`; `appeal` is set
  - Emits: `AppealSubmitted`
  - Realizes: REQ-DRV-023

- **resolveAppeal(resolution: AppealResolution) -> Driver**
  - Preconditions: verification state == `appeal-in-review`; `resolution.justification` is non-blank
  - Postconditions (REINSTATED): verification state = `verified`; `suspensionReason` is cleared; `suspendedAt` is cleared; `appealResolution = resolution`
  - Postconditions (PERMANENTLY_SUSPENDED): verification state = `permanently-suspended`; `appealResolution = resolution`
  - Emits: `AppealResolved`
  - Realizes: REQ-DRV-024

#### Entity-Level Invariants

- `UniqueEmail`: no two drivers may share the same `email` — enforcement: rejection (via duplicate detection)
- `UniquePhone`: no two drivers may share the same `phone` — enforcement: rejection (via duplicate detection)
- `SingleVehicle`: a driver has at most one active vehicle — enforcement: rejection

#### Duplicate Detection

- Predicate: `email` — evaluated through DriverRepository

---

## Aggregates

### Driver Aggregate

- **Root:** Driver
- **Contains:** Driver, IdentityDocument, Vehicle
- **Invariants:**
  - `DocumentsBelongToDriver`: every `IdentityDocument` in `identityDocuments` must have `driverId == driver.driverId` — enforcement: rejection
  - `VehicleBelongsToDriver`: if `vehicle` is present, `vehicle.driverId == driver.driverId` — enforcement: rejection
  - `InspectionRequiredForOnline`: if availability state is `online`, then `vehicle.inspectionResult` must be present, `passed == true`, and `expiresAt > now` — enforcement: rejection (realizes REQ-DRV-006)
  - `VerifiedForOnline`: if availability state is `online`, then verification state must be `verified` — enforcement: rejection (realizes REQ-DRV-010, REQ-DRV-012)
- **Repository:** DriverRepository
  - `store(driver: Driver) -> void`
  - `getById(driverId: UUID) -> Driver`
  - `remove(driverId: UUID) -> void`
  - `findByEmail(email: EmailAddress) -> Driver?`
  - `findByPhone(phone: PhoneNumber) -> Driver?`
  - `findByVerificationState(state: VerificationState) -> List<Driver>`
  - `findByAvailabilityState(state: AvailabilityState) -> List<Driver>`
  - `findOnlineDriversWithStaleLocation(threshold: DateTime) -> List<Driver>`
  - `findByLicensePlate(licensePlate: String) -> Driver?`
- **Realizes:** REQ-DRV-001, REQ-DRV-002, REQ-DRV-003, REQ-DRV-004, REQ-DRV-005, REQ-DRV-006, REQ-DRV-007, REQ-DRV-010, REQ-DRV-011, REQ-DRV-012, REQ-DRV-013, REQ-DRV-020, REQ-DRV-021, REQ-DRV-022, REQ-DRV-023, REQ-DRV-024

---

## Commands

### RegisterDriver

- **Fields:**
  - `fullName`: FullName
  - `email`: EmailAddress
  - `phone`: PhoneNumber
  - `address`: Address
- **Targets:** Driver (aggregate)
- **Triggers operation:** `registerDriver`
- **Produces events:** `DriverRegistered`
- **Realizes:** REQ-DRV-001

### UploadIdentityDocument

- **Fields:**
  - `driverId`: UUID
  - `documentType`: DocumentType
  - `documentNumber`: String
  - `fileUrl`: String
  - `expiresAt`: DateTime
- **Targets:** Driver (aggregate)
- **Triggers operation:** `uploadIdentityDocument`
- **Produces events:** `IdentityDocumentUploaded`
- **Realizes:** REQ-DRV-002

### CompleteBackgroundCheck

- **Fields:**
  - `driverId`: UUID
  - `backgroundCheckResult`: Enum { CLEAR, FAILED }
  - `checkId`: String
- **Targets:** Driver (aggregate)
- **Triggers operation:** `completeBackgroundCheck`
- **Produces events:** `BackgroundCheckCompleted` | `BackgroundCheckFailed`
- **Realizes:** REQ-DRV-003, REQ-DRV-004

### RegisterVehicle

- **Fields:**
  - `driverId`: UUID
  - `details`: VehicleDetails
- **Targets:** Driver (aggregate)
- **Triggers operation:** `registerVehicle`
- **Produces events:** `VehicleRegistered`
- **Realizes:** REQ-DRV-005

### RecordVehicleInspection

- **Fields:**
  - `driverId`: UUID
  - `vehicleId`: UUID
  - `result`: InspectionResult
- **Targets:** Driver (aggregate)
- **Triggers operation:** `recordVehicleInspection`
- **Produces events:** `VehicleInspectionRecorded`
- **Realizes:** REQ-DRV-006

### GoOnline

- **Fields:**
  - `driverId`: UUID
- **Targets:** Driver (aggregate)
- **Triggers operation:** `goOnline`
- **Produces events:** `DriverWentOnline`
- **Realizes:** REQ-DRV-010, REQ-DRV-006, REQ-DRV-012

### GoOffline

- **Fields:**
  - `driverId`: UUID
- **Targets:** Driver (aggregate)
- **Triggers operation:** `goOffline`
- **Produces events:** `DriverWentOffline`
- **Realizes:** REQ-DRV-011

### TimeoutInactiveDriver

- **Fields:**
  - `driverId`: UUID
  - `now`: DateTime
- **Targets:** Driver (aggregate)
- **Triggers operation:** `timeoutInactivity`
- **Produces events:** `DriverWentOffline`
- **Realizes:** REQ-DRV-013

### SubmitRating

- **Fields:**
  - `driverId`: UUID
  - `rideId`: UUID
  - `rating`: Rating
- **Targets:** Driver (aggregate)
- **Triggers operation:** `submitRating`
- **Produces events:** `RatingSubmitted`
- **Realizes:** REQ-DRV-020, REQ-DRV-021

### SuspendDriver

- **Fields:**
  - `driverId`: UUID
  - `reason`: String
- **Targets:** Driver (aggregate)
- **Triggers operation:** `suspend`
- **Produces events:** `DriverSuspended`
- **Realizes:** REQ-DRV-007, REQ-DRV-022

### SubmitAppeal

- **Fields:**
  - `driverId`: UUID
  - `appeal`: AppealDetails
- **Targets:** Driver (aggregate)
- **Triggers operation:** `submitAppeal`
- **Produces events:** `AppealSubmitted`
- **Realizes:** REQ-DRV-023

### ResolveAppeal

- **Fields:**
  - `driverId`: UUID
  - `resolution`: AppealResolution
- **Targets:** Driver (aggregate)
- **Triggers operation:** `resolveAppeal`
- **Produces events:** `AppealResolved`
- **Realizes:** REQ-DRV-024

### NotifyDriver

- **Fields:**
  - `driverId`: UUID
  - `subject`: String
  - `message`: String
  - `channel`: Enum { EMAIL, SMS, PUSH }
- **Targets:** NotificationService (infrastructure)
- **Triggers operation:** `sendNotification`
- **Produces events:** `DriverNotified`
- **Realizes:** REQ-DRV-004, REQ-DRV-007, REQ-DRV-022, REQ-DRV-024

---

## Events

### DriverRegistered

- **Fields:**
  - `driverId`: UUID
  - `fullName`: FullName
  - `email`: EmailAddress
  - `phone`: PhoneNumber
  - `registeredAt`: DateTime
- **Caused by command:** `RegisterDriver`
- **Raised by operation:** `registerDriver`
- **Type:** Internal
- **Realizes:** REQ-DRV-001

### IdentityDocumentUploaded

- **Fields:**
  - `driverId`: UUID
  - `documentId`: UUID
  - `documentType`: DocumentType
  - `uploadedAt`: DateTime
- **Caused by command:** `UploadIdentityDocument`
- **Raised by operation:** `uploadIdentityDocument`
- **Type:** Internal
- **Triggers reaction:** `InitiateVerificationOnDocumentUpload`
- **Realizes:** REQ-DRV-002

### BackgroundCheckCompleted

- **Fields:**
  - `driverId`: UUID
  - `checkId`: String
  - `result`: CLEAR
  - `completedAt`: DateTime
- **Caused by command:** `CompleteBackgroundCheck`
- **Raised by operation:** `completeBackgroundCheck`
- **Type:** Internal
- **Realizes:** REQ-DRV-003

### BackgroundCheckFailed

- **Fields:**
  - `driverId`: UUID
  - `checkId`: String
  - `result`: FAILED
  - `failureReason`: String
  - `completedAt`: DateTime
- **Caused by command:** `CompleteBackgroundCheck`
- **Raised by operation:** `completeBackgroundCheck`
- **Type:** Internal
- **Triggers reaction:** `NotifyOnBackgroundCheckFailure`
- **Realizes:** REQ-DRV-004

### VehicleRegistered

- **Fields:**
  - `driverId`: UUID
  - `vehicleId`: UUID
  - `details`: VehicleDetails
  - `registeredAt`: DateTime
- **Caused by command:** `RegisterVehicle`
- **Raised by operation:** `registerVehicle`
- **Type:** Internal
- **Realizes:** REQ-DRV-005

### VehicleInspectionRecorded

- **Fields:**
  - `driverId`: UUID
  - `vehicleId`: UUID
  - `result`: InspectionResult
  - `recordedAt`: DateTime
- **Caused by command:** `RecordVehicleInspection`
- **Raised by operation:** `recordVehicleInspection`
- **Type:** Internal
- **Realizes:** REQ-DRV-006

### DriverWentOnline

- **Fields:**
  - `driverId`: UUID
  - `timestamp`: DateTime
- **Caused by command:** `GoOnline`
- **Raised by operation:** `goOnline`
- **Type:** Internal
- **Realizes:** REQ-DRV-010

### DriverWentOffline

- **Fields:**
  - `driverId`: UUID
  - `reason`: Enum { VOLUNTARY, INACTIVITY_TIMEOUT, SUSPENSION }
  - `timestamp`: DateTime
- **Caused by command:** `GoOffline` | `TimeoutInactiveDriver` | `SuspendDriver`
- **Raised by operation:** `goOffline` | `timeoutInactivity` | `suspend`
- **Type:** Internal
- **Realizes:** REQ-DRV-011, REQ-DRV-013

### RatingSubmitted

- **Fields:**
  - `driverId`: UUID
  - `rideId`: UUID
  - `rating`: Rating
  - `newAverageRating`: AverageRating
  - `totalRidesCompleted`: Integer
  - `submittedAt`: DateTime
- **Caused by command:** `SubmitRating`
- **Raised by operation:** `submitRating`
- **Type:** Internal
- **Triggers reaction:** `SuspendOnLowRating`
- **Realizes:** REQ-DRV-020

### DriverSuspended

- **Fields:**
  - `driverId`: UUID
  - `reason`: String
  - `suspendedAt`: DateTime
- **Caused by command:** `SuspendDriver`
- **Raised by operation:** `suspend`
- **Type:** Internal
- **Triggers reaction:** `NotifyOnSuspension`
- **Realizes:** REQ-DRV-007, REQ-DRV-022

### AppealSubmitted

- **Fields:**
  - `driverId`: UUID
  - `appeal`: AppealDetails
- **Caused by command:** `SubmitAppeal`
- **Raised by operation:** `submitAppeal`
- **Type:** Internal
- **Realizes:** REQ-DRV-023

### AppealResolved

- **Fields:**
  - `driverId`: UUID
  - `resolution`: AppealResolution
  - `resolvedAt`: DateTime
- **Caused by command:** `ResolveAppeal`
- **Raised by operation:** `resolveAppeal`
- **Type:** Internal
- **Triggers reaction:** `NotifyOnAppealResolution`
- **Realizes:** REQ-DRV-024

### DriverNotified

- **Fields:**
  - `driverId`: UUID
  - `subject`: String
  - `channel`: Enum { EMAIL, SMS, PUSH }
  - `sentAt`: DateTime
- **Caused by command:** `NotifyDriver`
- **Raised by operation:** `sendNotification`
- **Type:** Internal
- **Realizes:** REQ-DRV-004, REQ-DRV-007, REQ-DRV-022, REQ-DRV-024

### DocumentExpired

- **Fields:**
  - `driverId`: UUID
  - `documentId`: UUID (optional — null if vehicle inspection)
  - `vehicleId`: UUID (optional — null if identity document)
  - `expiryType`: Enum { IDENTITY_DOCUMENT, VEHICLE_INSPECTION }
  - `expiredAt`: DateTime
- **Caused by command:** (raised by scheduled check, not a direct command)
- **Raised by operation:** `checkDocumentExpiry` (domain service)
- **Type:** Internal
- **Triggers reaction:** `SuspendOnDocumentExpiry`
- **Realizes:** REQ-DRV-007

### External: RideCompleted

- **Fields:**
  - `rideId`: UUID
  - `driverId`: UUID
  - `riderId`: UUID
  - `completedAt`: DateTime
- **Origin:** Ride Management (RIDE) bounded context
- **Type:** External
- **Triggers command:** (consumed by Rider Management for rating prompt; rating arrives via `SubmitRating`)
- **Realizes:** REQ-DRV-020

---

## Queries

### GetDriver

- **Fields:**
  - `driverId`: UUID
- **Reads from:** DriverRepository.getById
- **Returns:** Driver
- **Realizes:** (supporting query, no direct requirement)

### FindDriversByVerificationState

- **Fields:**
  - `state`: Enum { PENDING_VERIFICATION, VERIFIED, REJECTED, SUSPENDED, APPEAL_IN_REVIEW, PERMANENTLY_SUSPENDED }
  - `page`: Integer
  - `pageSize`: Integer
- **Reads from:** DriverRepository.findByVerificationState
- **Returns:** Paginated<Driver>
- **Realizes:** (supporting query, no direct requirement)

### FindDriversByAvailabilityState

- **Fields:**
  - `state`: Enum { ONLINE, OFFLINE }
  - `page`: Integer
  - `pageSize`: Integer
- **Reads from:** DriverRepository.findByAvailabilityState
- **Returns:** Paginated<Driver>
- **Realizes:** REQ-DRV-010

### FindOnlineDriversWithStaleLocation

- **Fields:**
  - `threshold`: DateTime
- **Reads from:** DriverRepository.findOnlineDriversWithStaleLocation
- **Returns:** List<Driver>
- **Realizes:** REQ-DRV-013

### GetDriverRating

- **Fields:**
  - `driverId`: UUID
- **Reads from:** DriverRepository.getById (projects `averageRating` and `totalRidesCompleted`)
- **Returns:** { averageRating: AverageRating, totalRidesCompleted: Integer }
- **Realizes:** REQ-DRV-020

---

## Domain Services

### DocumentExpiryChecker

- **Operations:**
  - `checkDocumentExpiry(now: DateTime) -> List<DocumentExpired>`
    - Description: scans all verified drivers for identity documents or vehicle inspections where `expiresAt < now`. Emits a `DocumentExpired` event for each expired document found.
    - Preconditions: none
    - Postconditions: one `DocumentExpired` event per expired document
- **Realizes:** REQ-DRV-007

### InactivityMonitor

- **Operations:**
  - `detectInactiveDrivers(now: DateTime) -> List<UUID>`
    - Description: queries `findOnlineDriversWithStaleLocation(now - 5 minutes)` and issues a `TimeoutInactiveDriver` command for each.
    - Preconditions: none
    - Postconditions: one `TimeoutInactiveDriver` command per stale driver
- **Realizes:** REQ-DRV-013

---

## Policies

### InitiateVerificationOnDocumentUpload

- **Trigger event:** `IdentityDocumentUploaded`
- **Guard:** driver verification state == `pending-verification` and at least one identity document has been uploaded
- **Effect command:** initiates background check via `BackgroundCheckService.requestBackgroundCheck`
- **Realizes:** REQ-DRV-002, REQ-DRV-003

### NotifyOnBackgroundCheckFailure

- **Trigger event:** `BackgroundCheckFailed`
- **Guard:** none (always fires)
- **Effect command:** `NotifyDriver` with subject "Application Rejected" and reason from the failure
- **Realizes:** REQ-DRV-004

### SuspendOnLowRating

- **Trigger event:** `RatingSubmitted`
- **Guard:** `event.totalRidesCompleted > 20 AND event.newAverageRating.value < 4.2`
- **Effect command:** `SuspendDriver` with reason "Average rating below 4.2 after more than 20 rides"
- **Realizes:** REQ-DRV-022

### NotifyOnSuspension

- **Trigger event:** `DriverSuspended`
- **Guard:** none (always fires)
- **Effect command:** `NotifyDriver` with subject "Account Suspended" and the suspension reason
- **Realizes:** REQ-DRV-007, REQ-DRV-022

### SuspendOnDocumentExpiry

- **Trigger event:** `DocumentExpired`
- **Guard:** driver verification state == `verified` (not already suspended)
- **Effect command:** `SuspendDriver` with reason "Document expired: {expiryType}" followed by `NotifyDriver` with subject "Document Expired — Action Required"
- **Realizes:** REQ-DRV-007

### NotifyOnAppealResolution

- **Trigger event:** `AppealResolved`
- **Guard:** none (always fires)
- **Effect command:** `NotifyDriver` with subject "Appeal Decision" and outcome from the resolution
- **Realizes:** REQ-DRV-024

### AutoOfflineOnInactivity

- **Trigger event:** (scheduled — `InactivityMonitor` runs periodically)
- **Guard:** driver is `online` AND `now - lastLocationUpdateAt > 5 minutes`
- **Effect command:** `TimeoutInactiveDriver`
- **Realizes:** REQ-DRV-013

---

## Infrastructure Services

### BackgroundCheckService

- **Interface:**
  - `requestBackgroundCheck(driverId: UUID, fullName: FullName, documentNumber: String) -> BackgroundCheckRequestId`
    - Description: submits a background check request to the external background screening provider. The result will arrive asynchronously as a `CompleteBackgroundCheck` command (callback/webhook from the provider).
    - Preconditions: `driverId` exists; `documentNumber` is non-blank
    - Postconditions: a background check request is initiated; a `BackgroundCheckRequestId` is returned for correlation
  - `getBackgroundCheckStatus(requestId: BackgroundCheckRequestId) -> Enum { PENDING, CLEAR, FAILED }`
    - Description: queries the external provider for the current status of a background check request.
    - Preconditions: `requestId` is valid
    - Postconditions: returns the current status without side effects
- **Realizes:** REQ-DRV-003, REQ-DRV-004

### NotificationService

- **Interface:**
  - `sendNotification(driverId: UUID, subject: String, message: String, channel: Enum { EMAIL, SMS, PUSH }) -> NotificationId`
    - Description: dispatches a notification to the driver through the specified channel. Delegates to external messaging infrastructure (email gateway, SMS provider, push notification service).
    - Preconditions: `driverId` exists; `subject` and `message` are non-blank
    - Postconditions: notification is queued for delivery; `NotificationId` is returned for tracking
- **Realizes:** REQ-DRV-004, REQ-DRV-007, REQ-DRV-022, REQ-DRV-024

### DocumentStorageService

- **Interface:**
  - `storeDocument(driverId: UUID, documentType: DocumentType, fileContent: Binary) -> String`
    - Description: uploads the document to external object storage and returns the file URL.
    - Preconditions: `fileContent` is non-empty
    - Postconditions: file is persisted; URL is returned
  - `getDocumentUrl(fileUrl: String) -> String`
    - Description: returns a time-limited signed URL for accessing the stored document.
    - Preconditions: `fileUrl` is valid
    - Postconditions: returns a signed URL without side effects
- **Realizes:** REQ-DRV-002

---

## Requirements Traceability Matrix

| Requirement | Realized by |
|---|---|
| REQ-DRV-001 | RegisterDriver (command), registerDriver (operation), DriverRegistered (event), Driver entity (pending-verification state) |
| REQ-DRV-002 | UploadIdentityDocument (command), uploadIdentityDocument (operation), IdentityDocumentUploaded (event), IdentityDocument entity, DocumentType (value), DocumentStorageService, InitiateVerificationOnDocumentUpload (reaction) |
| REQ-DRV-003 | CompleteBackgroundCheck (command), completeBackgroundCheck (operation), BackgroundCheckCompleted (event), pending-verification→verified transition, BackgroundCheckService |
| REQ-DRV-004 | CompleteBackgroundCheck (command), completeBackgroundCheck (operation), BackgroundCheckFailed (event), pending-verification→rejected transition, NotifyOnBackgroundCheckFailure (reaction), NotificationService |
| REQ-DRV-005 | RegisterVehicle (command), registerVehicle (operation), VehicleRegistered (event), Vehicle entity, VehicleDetails (value) |
| REQ-DRV-006 | RecordVehicleInspection (command), recordVehicleInspection (operation), VehicleInspectionRecorded (event), InspectionResult (value), InspectionRequiredForActivation (invariant), goOnline guard |
| REQ-DRV-007 | DocumentExpiryChecker (domain service), DocumentExpired (event), SuspendOnDocumentExpiry (reaction), SuspendDriver (command), NotifyOnSuspension (reaction), NotificationService |
| REQ-DRV-010 | GoOnline (command), goOnline (operation), DriverWentOnline (event), offline→online transition, VerifiedForOnline (aggregate invariant) |
| REQ-DRV-011 | GoOffline (command), goOffline (operation), DriverWentOffline (event), online→offline transition |
| REQ-DRV-012 | goOnline precondition (verification state must be verified, not suspended), VerifiedForOnline (aggregate invariant) |
| REQ-DRV-013 | InactivityMonitor (domain service), TimeoutInactiveDriver (command), timeoutInactivity (operation), DriverWentOffline (event), AutoOfflineOnInactivity (reaction), FindOnlineDriversWithStaleLocation (query) |
| REQ-DRV-020 | SubmitRating (command), submitRating (operation), RatingSubmitted (event), AverageRating (value) |
| REQ-DRV-021 | Rating (value type, invariant RatingRange), submitRating precondition |
| REQ-DRV-022 | SuspendOnLowRating (reaction), SuspendDriver (command), suspend (operation), DriverSuspended (event), NotifyOnSuspension (reaction) |
| REQ-DRV-023 | SubmitAppeal (command), submitAppeal (operation), AppealSubmitted (event), AppealDetails (value), suspended→appeal-in-review transition |
| REQ-DRV-024 | ResolveAppeal (command), resolveAppeal (operation), AppealResolved (event), AppealResolution (value), appeal-in-review→verified / permanently-suspended transitions, NotifyOnAppealResolution (reaction) |
