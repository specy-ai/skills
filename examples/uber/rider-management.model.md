# Rider Management — Domain Model

Bounded Context: **Rider Management** (RDR)

Responsibility: Rider registration, profile, preferences, ratings, bans.

---

## Context Map

| Relationship | Partner BC | Pattern | Requirement |
|---|---|---|---|
| Rider Management → Payment | Payment | ACL (Anti-Corruption Layer) | REQ-RDR-005 — validate payment method before association |

---

## Value Types

### PhoneNumber
> realizes: REQ-RDR-001

```
value PhoneNumber {
    fields {
        countryCode : string minLength(1) maxLength(4)
        number : string minLength(6) maxLength(15) pattern("^[0-9]+$")
    }
}
```

### VerificationCode
> realizes: REQ-RDR-001, REQ-RDR-002

```
value VerificationCode {
    fields {
        code : string minLength(4) maxLength(6)
        expiresAt : datetime futureOrPresent
    }
}
```

### VerificationAttempt
> realizes: REQ-RDR-003

Tracks brute-force protection state. Embedded in the Rider aggregate, not a standalone entity.

```
value VerificationAttempt {
    fields {
        failedCount : int default("0") min(0) max(3)
        lockedUntil : datetime optional
    }

    invariants {
        maxFailedAttempts :: "Failed count cannot exceed 3 before lock" {
            failedCount <= 3
        }
    }
}
```

### SavedAddress
> realizes: REQ-RDR-004

```
value SavedAddress {
    fields {
        label : string minLength(1) maxLength(50)
        street : string maxLength(200)
        city : string maxLength(100)
        zipCode : string maxLength(10)
        country : string maxLength(100)
        latitude : decimal optional
        longitude : decimal optional
    }
}
```

### PaymentMethodRef
> realizes: REQ-RDR-005

A reference to a payment method validated and owned by the Payment bounded context. Only the reference is stored here.

```
value PaymentMethodRef {
    fields {
        paymentMethodId : uuid
        type : PaymentMethodType
        label : string maxLength(50)
        isActive : boolean default("true")
        addedAt : datetime immutable pastOrPresent
    }
}
```

### Rating
> realizes: REQ-RDR-010

```
value Rating {
    fields {
        rideId : uuid
        driverId : uuid
        score : int min(1) max(5)
        submittedAt : datetime immutable pastOrPresent
    }

    invariants {
        scoreInRange :: "Rating score must be between 1 and 5" {
            score >= 1 and score <= 5
        }
    }
}
```

### Appeal
> realizes: REQ-RDR-013

```
value Appeal {
    fields {
        reason : string minLength(10) maxLength(2000)
        submittedAt : datetime immutable pastOrPresent
        status : AppealStatus default("pending")
    }
}
```

---

## Enums

### RiderStatus
> realizes: REQ-RDR-001, REQ-RDR-002, REQ-RDR-012, REQ-RDR-013

```
enum RiderStatus {
    unverified
    active
    banned
    appealInReview
}
```

### PaymentMethodType
> realizes: REQ-RDR-005

```
enum PaymentMethodType {
    creditCard
    debitCard
    paypal
    applePay
    googlePay
}
```

### AppealStatus
> realizes: REQ-RDR-013

```
enum AppealStatus {
    pending
    approved
    rejected
}
```

---

## Entities

### Rider (Aggregate Root)
> realizes: REQ-RDR-001, REQ-RDR-002, REQ-RDR-003, REQ-RDR-004, REQ-RDR-005, REQ-RDR-006, REQ-RDR-010, REQ-RDR-011, REQ-RDR-012, REQ-RDR-013

```
entity Rider :: "A person who uses RideNow to request rides" {
    identifier id : UUID

    fields {
        phoneNumber : PhoneNumber
        firstName : string optional maxLength(100)
        lastName : string optional maxLength(100)
        email : string optional maxLength(255)
        status : RiderStatus default("unverified")
        verificationCode : VerificationCode optional
        verificationAttempt : VerificationAttempt default("VerificationAttempt()")
        averageRating : decimal optional min(1) max(5)
        totalRides : int default("0") min(0)
        createdAt : datetime immutable pastOrPresent
        updatedAt : datetime pastOrPresent
    }

    references {
        savedAddresses : SavedAddress 0..N
        paymentMethods : PaymentMethodRef 0..N
        ratings : Rating 0..N
        appeal : Appeal 0..1
    }

    policies {
        riderMustBeUnverified(rider: Rider) :: "Only unverified riders can submit a verification code" {
            rider.status = unverified
        }

        riderMustBeActive(rider: Rider) :: "Rider must be active to perform profile actions" {
            rider.status = active
        }

        verificationNotLocked(rider: Rider) :: "Verification must not be locked due to too many failed attempts" {
            rider.verificationAttempt.lockedUntil is not defined
            or rider.verificationAttempt.lockedUntil < now()
        }

        riderMustBeBanned(rider: Rider) :: "Only banned riders can submit an appeal" {
            rider.status = banned
        }

        riderProfileComplete(rider: Rider) :: "Rider must have a verified phone and at least one active payment method to request a ride" {
            rider.status = active
            and isNotEmpty(rider.paymentMethods)
            and some pm in rider.paymentMethods { pm.isActive = true }
        }

        maxSavedAddresses(rider: Rider) :: "A rider can have at most 20 saved addresses" {
            count(rider.savedAddresses) < 20
        }
    }

    invariants {
        averageRatingRange :: "Average rating must be between 1.0 and 5.0 when defined" {
            if averageRating is defined {
                averageRating >= 1.0 and averageRating <= 5.0
            }
        }

        totalRidesNonNegative :: "Total rides count is never negative" {
            totalRides >= 0
        }

        profileCompletenessForActive :: "An active rider must have a verified phone (status implies verification)" {
            if status = active {
                verificationCode is not defined
            }
        }
    }

    operations {
        "Register a new rider" on RegisterRider {
            creates Rider {
                phoneNumber = registerRider.phoneNumber
                status = unverified
                verificationCode = generateVerificationCode()
                verificationAttempt = VerificationAttempt()
                createdAt = now()
                updatedAt = now()
            }

            NotificationService.sendVerificationCode(Rider.phoneNumber, Rider.verificationCode.code)

            emits RiderRegistered {
                riderId = Rider.id
                phoneNumber = Rider.phoneNumber
                registeredAt = Rider.createdAt
            }
        }

        "Verify rider phone number" on VerifyPhone {
            resolves Rider from verifyPhone.riderId

            policy riderMustBeUnverified(Rider)
            policy verificationNotLocked(Rider)

            // Happy path: code matches
            sets Rider {
                status = active
                verificationCode = cleared
                verificationAttempt = VerificationAttempt()
                updatedAt = now()
            }

            emits RiderPhoneVerified {
                riderId = Rider.id
                verifiedAt = now()
            }
        }

        "Reject invalid verification code" on SubmitInvalidVerificationCode {
            resolves Rider from submitInvalidVerificationCode.riderId

            policy riderMustBeUnverified(Rider)
            policy verificationNotLocked(Rider)

            sets Rider {
                verificationAttempt = VerificationAttempt {
                    failedCount = Rider.verificationAttempt.failedCount + 1
                    lockedUntil = if Rider.verificationAttempt.failedCount + 1 >= 3
                                  then now() + 15 minutes
                                  else Rider.verificationAttempt.lockedUntil
                }
                updatedAt = now()
            }

            emits VerificationFailed {
                riderId = Rider.id
                failedCount = Rider.verificationAttempt.failedCount
                locked = Rider.verificationAttempt.lockedUntil is defined
                failedAt = now()
            }
        }

        "Save an address to rider profile" on SaveAddress {
            resolves Rider from saveAddress.riderId

            policy riderMustBeActive(Rider)
            policy maxSavedAddresses(Rider)

            sets Rider {
                savedAddresses = Rider.savedAddresses + SavedAddress {
                    label = saveAddress.label
                    street = saveAddress.street
                    city = saveAddress.city
                    zipCode = saveAddress.zipCode
                    country = saveAddress.country
                    latitude = saveAddress.latitude
                    longitude = saveAddress.longitude
                }
                updatedAt = now()
            }

            emits AddressSaved {
                riderId = Rider.id
                label = saveAddress.label
                savedAt = now()
            }
        }

        "Add a payment method to rider profile" on AddPaymentMethod {
            resolves Rider from addPaymentMethod.riderId

            policy riderMustBeActive(Rider)

            PaymentValidationService.validatePaymentMethod(addPaymentMethod.paymentMethodId)

            sets Rider {
                paymentMethods = Rider.paymentMethods + PaymentMethodRef {
                    paymentMethodId = addPaymentMethod.paymentMethodId
                    type = addPaymentMethod.type
                    label = addPaymentMethod.label
                    isActive = true
                    addedAt = now()
                }
                updatedAt = now()
            }

            emits PaymentMethodAdded {
                riderId = Rider.id
                paymentMethodId = addPaymentMethod.paymentMethodId
                type = addPaymentMethod.type
                addedAt = now()
            }
        }

        "Record a rating for a rider" on RecordRiderRating {
            resolves Rider from recordRiderRating.riderId

            sets Rider {
                ratings = Rider.ratings + Rating {
                    rideId = recordRiderRating.rideId
                    driverId = recordRiderRating.driverId
                    score = recordRiderRating.score
                    submittedAt = now()
                }
                totalRides = Rider.totalRides + 1
                averageRating = RatingCalculator.computeAverage(Rider.ratings, recordRiderRating.score)
                updatedAt = now()
            }

            emits RiderRated {
                riderId = Rider.id
                rideId = recordRiderRating.rideId
                driverId = recordRiderRating.driverId
                score = recordRiderRating.score
                newAverageRating = Rider.averageRating
                totalRides = Rider.totalRides
                ratedAt = now()
            }
        }

        "Warn rider of low rating" when RiderRated then WarnLowRating {
            resolves Rider from warnLowRating.riderId

            // Guard: only when >10 rides and avg < 4.0 and not yet banned
            policy riderMustBeActive(Rider)

            NotificationService.sendLowRatingWarning(Rider.id, Rider.averageRating)

            emits LowRatingWarningIssued {
                riderId = Rider.id
                averageRating = Rider.averageRating
                totalRides = Rider.totalRides
                warnedAt = now()
            }
        }

        "Ban rider due to critically low rating" when RiderRated then BanRiderForLowRating {
            resolves Rider from banRiderForLowRating.riderId

            policy riderMustBeActive(Rider)

            sets Rider {
                status = banned
                updatedAt = now()
            }

            NotificationService.sendBanNotification(Rider.id, Rider.averageRating)

            emits RiderBanned {
                riderId = Rider.id
                averageRating = Rider.averageRating
                totalRides = Rider.totalRides
                bannedAt = now()
            }
        }

        "Submit a ban appeal" on SubmitBanAppeal {
            resolves Rider from submitBanAppeal.riderId

            policy riderMustBeBanned(Rider)

            sets Rider {
                status = appealInReview
                appeal = Appeal {
                    reason = submitBanAppeal.reason
                    submittedAt = now()
                    status = pending
                }
                updatedAt = now()
            }

            emits BanAppealSubmitted {
                riderId = Rider.id
                reason = submitBanAppeal.reason
                submittedAt = now()
            }
        }
    }

    transitions {
        [*] --> unverified on "Register a new rider"
        unverified --> active on "Verify rider phone number"
        active --> banned on "Ban rider due to critically low rating"
        banned --> appealInReview on "Submit a ban appeal"
    }
}
```

---

## Aggregates

| Aggregate | Root Entity | Owned Values | Rationale |
|---|---|---|---|
| Rider | Rider | SavedAddress, PaymentMethodRef, Rating, VerificationAttempt, VerificationCode, Appeal | Rider is the single aggregate root. All rider-related values are owned by and accessed through the Rider aggregate. Consistency boundary ensures atomic updates to profile, addresses, payment references, ratings, and ban state. |

---

## Commands

### RegisterRider
> realizes: REQ-RDR-001

```
command RegisterRider {
    fields {
        phoneNumber : PhoneNumber
    }
}
```

### VerifyPhone
> realizes: REQ-RDR-002

```
command VerifyPhone {
    fields {
        riderId : uuid
        code : string minLength(4) maxLength(6)
    }
}
```

### SubmitInvalidVerificationCode
> realizes: REQ-RDR-003

```
command SubmitInvalidVerificationCode {
    fields {
        riderId : uuid
        code : string minLength(4) maxLength(6)
    }
}
```

### SaveAddress
> realizes: REQ-RDR-004

```
command SaveAddress {
    fields {
        riderId : uuid
        label : string minLength(1) maxLength(50)
        street : string maxLength(200)
        city : string maxLength(100)
        zipCode : string maxLength(10)
        country : string maxLength(100)
        latitude : decimal optional
        longitude : decimal optional
    }
}
```

### AddPaymentMethod
> realizes: REQ-RDR-005

```
command AddPaymentMethod {
    fields {
        riderId : uuid
        paymentMethodId : uuid
        type : PaymentMethodType
        label : string maxLength(50)
    }
}
```

### RecordRiderRating
> realizes: REQ-RDR-010

```
command RecordRiderRating {
    fields {
        riderId : uuid
        rideId : uuid
        driverId : uuid
        score : int min(1) max(5)
    }
}
```

### WarnLowRating
> realizes: REQ-RDR-011

Internal command triggered by the RiderRated event.

```
command WarnLowRating {
    fields {
        riderId : uuid
        averageRating : decimal
        totalRides : int
    }
}
```

### BanRiderForLowRating
> realizes: REQ-RDR-012

Internal command triggered by the RiderRated event.

```
command BanRiderForLowRating {
    fields {
        riderId : uuid
        averageRating : decimal
        totalRides : int
    }
}
```

### SubmitBanAppeal
> realizes: REQ-RDR-013

```
command SubmitBanAppeal {
    fields {
        riderId : uuid
        reason : string minLength(10) maxLength(2000)
    }
}
```

---

## Events

### RiderRegistered
> realizes: REQ-RDR-001

```
event RiderRegistered {
    fields {
        riderId : uuid
        phoneNumber : PhoneNumber
        registeredAt : datetime
    }
}
```

### RiderPhoneVerified
> realizes: REQ-RDR-002

```
event RiderPhoneVerified {
    fields {
        riderId : uuid
        verifiedAt : datetime
    }
}
```

### VerificationFailed
> realizes: REQ-RDR-003

```
event VerificationFailed {
    fields {
        riderId : uuid
        failedCount : int
        locked : boolean
        failedAt : datetime
    }
}
```

### AddressSaved
> realizes: REQ-RDR-004

```
event AddressSaved {
    fields {
        riderId : uuid
        label : string
        savedAt : datetime
    }
}
```

### PaymentMethodAdded
> realizes: REQ-RDR-005

```
event PaymentMethodAdded {
    fields {
        riderId : uuid
        paymentMethodId : uuid
        type : PaymentMethodType
        addedAt : datetime
    }
}
```

### RiderRated
> realizes: REQ-RDR-010, REQ-RDR-011, REQ-RDR-012

```
event RiderRated {
    fields {
        riderId : uuid
        rideId : uuid
        driverId : uuid
        score : int
        newAverageRating : decimal
        totalRides : int
        ratedAt : datetime
    }
}
```

### LowRatingWarningIssued
> realizes: REQ-RDR-011

```
event LowRatingWarningIssued {
    fields {
        riderId : uuid
        averageRating : decimal
        totalRides : int
        warnedAt : datetime
    }
}
```

### RiderBanned
> realizes: REQ-RDR-012

```
event RiderBanned {
    fields {
        riderId : uuid
        averageRating : decimal
        totalRides : int
        bannedAt : datetime
    }
}
```

### BanAppealSubmitted
> realizes: REQ-RDR-013

```
event BanAppealSubmitted {
    fields {
        riderId : uuid
        reason : string
        submittedAt : datetime
    }
}
```

---

## Queries

### GetRiderProfile
> realizes: REQ-RDR-006

```
query GetRiderProfile {
    fields {
        riderId : uuid
    }
    returns {
        rider : Rider
        isProfileComplete : boolean
    }
}
```

### GetRiderRatingHistory
> realizes: REQ-RDR-010

```
query GetRiderRatingHistory {
    fields {
        riderId : uuid
        limit : int optional default("20")
        offset : int optional default("0")
    }
    returns {
        ratings : list<Rating>
        averageRating : decimal
        totalRides : int
    }
}
```

### GetSavedAddresses
> realizes: REQ-RDR-004

```
query GetSavedAddresses {
    fields {
        riderId : uuid
    }
    returns {
        addresses : list<SavedAddress>
    }
}
```

---

## Domain Services

### RatingCalculator
> realizes: REQ-RDR-010, REQ-RDR-011, REQ-RDR-012

Stateless computation service for rider rating aggregation.

```
service RatingCalculator {
    operations {
        computeAverage(existingRatings: list<Rating>, newScore: int) : decimal
            :: "Recompute the rider average rating including the new score" {
            returns (sum(existingRatings.score) + newScore) / (count(existingRatings) + 1)
        }
    }
}
```

---

## Policies

### File-Level Policies

#### riderEligibleForWarning
> realizes: REQ-RDR-011

```
policy riderEligibleForWarning(rider: Rider) :: "A rider is eligible for a low rating warning when they have completed more than 10 rides and their average rating drops below 4.0" {
    rider.totalRides > 10
    and rider.averageRating < 4.0
    and rider.status = active
}
```

#### riderEligibleForBan
> realizes: REQ-RDR-012

```
policy riderEligibleForBan(rider: Rider) :: "A rider must be banned when they have completed more than 10 rides and their average rating drops below 3.5" {
    rider.totalRides > 10
    and rider.averageRating < 3.5
    and rider.status = active
}
```

#### riderProfileComplete
> realizes: REQ-RDR-006

```
policy riderProfileComplete(rider: Rider) :: "Rider must have a verified phone and at least one active payment method to request a ride" {
    rider.status = active
    and isNotEmpty(rider.paymentMethods)
    and some pm in rider.paymentMethods { pm.isActive = true }
}
```

---

## Infrastructure Services

### PaymentValidationService (ACL to Payment BC)
> realizes: REQ-RDR-005

Anti-Corruption Layer that validates payment methods against the Payment bounded context. Translates Payment BC responses into Rider Management domain language.

```
service PaymentValidationService {
    operations {
        validatePaymentMethod(paymentMethodId: uuid) : boolean
            :: "Validate a payment method with the Payment bounded context" {
            // ACL — calls Payment BC to verify the payment method is valid and active
        }
    }
}
```

### NotificationService
> realizes: REQ-RDR-001, REQ-RDR-011, REQ-RDR-012

Infrastructure service for sending notifications to riders.

```
service NotificationService {
    operations {
        sendVerificationCode(phoneNumber: PhoneNumber, code: string) : void
            :: "Send a verification code via SMS to the rider's phone" {
        }

        sendLowRatingWarning(riderId: uuid, averageRating: decimal) : void
            :: "Notify rider that their rating is below acceptable threshold" {
        }

        sendBanNotification(riderId: uuid, averageRating: decimal) : void
            :: "Notify rider that their account has been banned due to low rating" {
        }
    }
}
```

---

## Traceability Matrix

| Requirement | Realized By |
|---|---|
| REQ-RDR-001 | RegisterRider (command), RiderRegistered (event), Rider."Register a new rider" (operation), PhoneNumber (value), VerificationCode (value), NotificationService.sendVerificationCode |
| REQ-RDR-002 | VerifyPhone (command), RiderPhoneVerified (event), Rider."Verify rider phone number" (operation) |
| REQ-RDR-003 | SubmitInvalidVerificationCode (command), VerificationFailed (event), Rider."Reject invalid verification code" (operation), VerificationAttempt (value), verificationNotLocked (policy) |
| REQ-RDR-004 | SaveAddress (command), AddressSaved (event), Rider."Save an address to rider profile" (operation), SavedAddress (value) |
| REQ-RDR-005 | AddPaymentMethod (command), PaymentMethodAdded (event), Rider."Add a payment method to rider profile" (operation), PaymentMethodRef (value), PaymentValidationService (infrastructure service) |
| REQ-RDR-006 | riderProfileComplete (policy), Rider.riderProfileComplete (entity policy), GetRiderProfile (query) |
| REQ-RDR-010 | RecordRiderRating (command), RiderRated (event), Rider."Record a rating for a rider" (operation), Rating (value), RatingCalculator (domain service) |
| REQ-RDR-011 | WarnLowRating (command), LowRatingWarningIssued (event), Rider."Warn rider of low rating" (operation), riderEligibleForWarning (policy), NotificationService.sendLowRatingWarning |
| REQ-RDR-012 | BanRiderForLowRating (command), RiderBanned (event), Rider."Ban rider due to critically low rating" (operation), riderEligibleForBan (policy), NotificationService.sendBanNotification |
| REQ-RDR-013 | SubmitBanAppeal (command), BanAppealSubmitted (event), Rider."Submit a ban appeal" (operation), Appeal (value), AppealStatus (enum) |
