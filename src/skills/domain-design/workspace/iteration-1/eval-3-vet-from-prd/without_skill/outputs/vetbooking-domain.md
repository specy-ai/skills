# VetBooking Domain Model

## Bounded Contexts Overview

The VetBooking platform decomposes into six bounded contexts:

1. **Clinic Directory** -- Clinic identity, profiles, search, and discovery
2. **Scheduling** -- Availability definition, appointment booking lifecycle
3. **Pet Registry** -- Pet owner accounts, pet profiles, ownership
4. **Medical Records** -- Consultation notes, vaccinations, treatment history
5. **Notifications** -- Reminders, confirmations, alerts across channels
6. **Reviews** -- Ratings and written feedback tied to verified visits

---

## 1. Bounded Context: Clinic Directory

Owns the public-facing identity of clinics, their teams, and discoverability.

### Aggregates

#### Clinic (Aggregate Root)
- **clinicId** : ClinicId
- **name** : ClinicName
- **address** : PostalAddress { street, city, postalCode, country, coordinates: GeoCoordinates }
- **phone** : PhoneNumber
- **openingHours** : list of OpeningPeriod { dayOfWeek, openTime, closeTime }
- **animalTypesServed** : set of AnimalType [DOG, CAT, NAC]
- **specialties** : set of Specialty [DERMATOLOGY, SURGERY, DENTISTRY, OPHTHALMOLOGY, CARDIOLOGY, BEHAVIOR, EXOTIC, GENERAL]
- **photos** : list of Photo
- **languages** : set of Language
- **team** : list of VetProfile
- **status** : ClinicStatus [ONBOARDING, ACTIVE, SUSPENDED, DEACTIVATED]
- **createdAt** : Timestamp
- **publishedAt** : Timestamp (nullable)

#### VetProfile (Entity within Clinic)
- **vetProfileId** : VetProfileId
- **firstName** : PersonName
- **lastName** : PersonName
- **title** : VetTitle
- **specialties** : set of Specialty
- **bio** : Text (optional)

### Value Objects
- **GeoCoordinates** { latitude, longitude }
- **PostalAddress** { street, city, postalCode, country, coordinates }
- **OpeningPeriod** { dayOfWeek, openTime, closeTime }
- **Photo** { url, caption }

### Domain Events
- ClinicRegistered
- ClinicProfilePublished
- ClinicProfileUpdated
- ClinicDeactivated
- VetProfileAdded
- VetProfileRemoved

### Key Business Rules
- A clinic must have at least a name, address, phone, opening hours, and one animal type served before it can be published.
- Profile publication makes the clinic discoverable to pet owners.
- Search results are filtered by proximity (default 10 km radius), animal type, and specialty.

---

## 2. Bounded Context: Scheduling

Owns availability, appointment lifecycle, and calendar management.

### Aggregates

#### ClinicSchedule (Aggregate Root)
- **clinicScheduleId** : ClinicScheduleId
- **clinicId** : ClinicId (reference to Clinic Directory)
- **availabilityPatterns** : list of AvailabilityPattern
- **slotOverrides** : list of SlotOverride

#### AvailabilityPattern (Entity)
- **patternId** : PatternId
- **vetProfileId** : VetProfileId
- **dayOfWeek** : DayOfWeek
- **startTime** : LocalTime
- **endTime** : LocalTime
- **slotDuration** : Duration
- **consultationTypes** : set of ConsultationType
- **recurrence** : Recurrence [WEEKLY, ONE_OFF]

#### SlotOverride (Entity)
- **overrideId** : OverrideId
- **date** : LocalDate
- **vetProfileId** : VetProfileId
- **type** : OverrideType [BLOCKED, MODIFIED]
- **modifiedStartTime** : LocalTime (optional)
- **modifiedEndTime** : LocalTime (optional)

#### Appointment (Aggregate Root)
- **appointmentId** : AppointmentId
- **clinicId** : ClinicId
- **vetProfileId** : VetProfileId
- **petOwnerId** : PetOwnerId (reference to Pet Registry)
- **petId** : PetId (reference to Pet Registry)
- **slotDateTime** : DateTime
- **duration** : Duration
- **consultationType** : ConsultationType
- **visitReason** : VisitReason (free text)
- **status** : AppointmentStatus [CONFIRMED, CANCELLED_BY_OWNER, CANCELLED_BY_CLINIC, RESCHEDULED, COMPLETED, NO_SHOW]
- **source** : BookingSource [ONLINE, MANUAL]
- **confirmationStatus** : ConfirmationStatus [PENDING, CONFIRMED_BY_OWNER, UNCONFIRMED]
- **createdAt** : Timestamp
- **cancelledAt** : Timestamp (nullable)
- **cancellationPolicy** : CancellationWindow

### Value Objects
- **ConsultationType** [GENERAL_CONSULTATION, VACCINATION, SURGERY, FOLLOW_UP, EMERGENCY, DENTAL, DERMATOLOGY]
- **CancellationWindow** -- cancellation allowed up to 24 hours before appointment
- **TimeSlot** { date, startTime, endTime, vetProfileId, consultationType, available: boolean }

### Domain Events
- AvailabilityPatternDefined
- SlotBlocked
- AppointmentBooked
- AppointmentCancelled
- AppointmentRescheduled
- AppointmentCompleted
- AppointmentMarkedNoShow
- AppointmentConfirmedByOwner

### Key Business Rules
- A slot that is already booked must not be shown as available.
- Cancellation by the pet owner is only allowed up to 24 hours before the appointment.
- When an appointment is cancelled, the freed slot becomes immediately available.
- Rescheduling creates a cancellation of the original and a new booking.
- Availability is computed by combining recurring patterns minus overrides minus existing bookings.
- Slots should be displayed for at least 14 days ahead.

---

## 3. Bounded Context: Pet Registry

Owns pet owner identity, pet profiles, and the ownership relationship.

### Aggregates

#### PetOwner (Aggregate Root)
- **petOwnerId** : PetOwnerId
- **firstName** : PersonName
- **lastName** : PersonName
- **email** : EmailAddress
- **phone** : PhoneNumber
- **address** : PostalAddress (optional)
- **notificationPreferences** : NotificationPreferences
- **status** : AccountStatus [ACTIVE, SUSPENDED, DELETED]
- **consentRecords** : list of ConsentRecord
- **createdAt** : Timestamp

#### Pet (Aggregate Root)
- **petId** : PetId
- **ownerId** : PetOwnerId
- **name** : PetName
- **species** : Species [DOG, CAT, NAC]
- **breed** : Breed (optional)
- **dateOfBirth** : LocalDate (optional)
- **sex** : Sex [MALE, FEMALE, UNKNOWN]
- **weight** : Weight (optional)
- **microchipNumber** : MicrochipNumber (optional)
- **photoUrl** : Url (optional)
- **status** : PetStatus [ACTIVE, DECEASED, TRANSFERRED]
- **createdAt** : Timestamp

### Value Objects
- **NotificationPreferences** { smsEnabled: boolean, pushEnabled: boolean, emailEnabled: boolean }
- **ConsentRecord** { consentType: ConsentType, grantedAt: Timestamp, revokedAt: Timestamp (nullable) }
- **ConsentType** [BOOKING_REMINDERS, CARE_REMINDERS, DATA_SHARING, MARKETING]

### Domain Events
- PetOwnerRegistered
- PetOwnerProfileUpdated
- PetOwnerAccountDeleted (GDPR right to erasure)
- PetAdded
- PetProfileUpdated
- PetRemoved
- ConsentGranted
- ConsentRevoked

### Key Business Rules
- A pet owner can own one or more pets.
- Opt-in consent must be recorded before sending any SMS or push notifications (CNIL/GDPR).
- Pet owner deletion triggers data erasure across all contexts (GDPR right to erasure).
- Pet species must match one of the animal types served by the clinic at booking time.

---

## 4. Bounded Context: Medical Records

Owns consultation history, vaccination tracking, and treatment records for pets.

### Aggregates

#### PetMedicalRecord (Aggregate Root)
- **medicalRecordId** : MedicalRecordId
- **petId** : PetId (reference to Pet Registry)
- **entries** : list of MedicalEntry (ordered reverse chronologically)

#### MedicalEntry (Entity)
- **entryId** : MedicalEntryId
- **appointmentId** : AppointmentId (reference to Scheduling, optional -- may be manually added)
- **clinicId** : ClinicId
- **vetProfileId** : VetProfileId
- **date** : LocalDate
- **reasonForVisit** : Text
- **summary** : Text
- **diagnoses** : list of Diagnosis
- **treatments** : list of Treatment
- **prescriptions** : list of Prescription
- **vaccinations** : list of VaccinationRecord
- **createdAt** : Timestamp
- **updatedAt** : Timestamp

### Value Objects
- **Diagnosis** { code: DiagnosisCode (optional), description: Text }
- **Treatment** { name: Text, description: Text }
- **Prescription** { medication: Text, dosage: Text, duration: Text, instructions: Text }
- **VaccinationRecord** { vaccineName: Text, dateAdministered: LocalDate, batchNumber: Text (optional), nextDueDate: LocalDate (optional) }
- **SharedRecordLink** { token: Text, expiresAt: Timestamp, createdByOwnerId: PetOwnerId }

### Domain Events
- MedicalEntryAdded
- MedicalEntryUpdated
- VaccinationRecorded
- VaccinationDueDateApproaching
- MedicalRecordShared
- MedicalRecordShareRevoked

### Key Business Rules
- Only veterinarians can create or edit medical entries -- pet owners have read-only access.
- Medical history is accessible across clinics on the platform for the same pet.
- Pet owner can generate a time-limited shareable link or PDF (requires explicit consent under GDPR).
- V1 stores text-based records only -- no diagnostic images.
- Vaccination next-due dates drive proactive care reminders.

---

## 5. Bounded Context: Notifications

Owns the delivery of reminders, confirmations, and alerts across SMS, push, and email channels.

### Aggregates

#### NotificationSchedule (Aggregate Root)
- **scheduleId** : NotificationScheduleId
- **appointmentId** : AppointmentId (reference to Scheduling)
- **recipientId** : PetOwnerId
- **plannedNotifications** : list of PlannedNotification

#### PlannedNotification (Entity)
- **notificationId** : NotificationId
- **triggerType** : NotificationTrigger [APPOINTMENT_CONFIRMATION, REMINDER_48H, REMINDER_2H, VACCINATION_DUE, CANCELLATION_NOTICE, BOOKING_NOTIFICATION_TO_CLINIC]
- **channels** : set of Channel [SMS, PUSH, EMAIL]
- **scheduledAt** : Timestamp
- **status** : NotificationStatus [SCHEDULED, SENT, DELIVERED, FAILED, CANCELLED]
- **sentAt** : Timestamp (nullable)
- **content** : NotificationContent

### Value Objects
- **NotificationContent** { title: Text, body: Text, deepLinkUrl: Url (optional), clinicName: Text, petName: Text, appointmentDateTime: DateTime, directionsUrl: Url (optional) }
- **Channel** [SMS, PUSH, EMAIL]

### Domain Events
- NotificationScheduled
- NotificationSent
- NotificationDeliveryFailed
- NotificationCancelled (when appointment is cancelled)

### Key Business Rules
- Appointment reminders are sent at 48 hours and 2 hours before the appointment.
- The 48-hour reminder includes confirm/cancel actions.
- The 2-hour reminder includes directions to the clinic.
- Vaccination reminders are sent 2 weeks before the due date with a link to book.
- SMS sending requires prior opt-in consent (CNIL compliance).
- Clinic receives notifications for new bookings and cancellations (configurable).
- If an appointment is cancelled, pending reminders for it must be cancelled.

---

## 6. Bounded Context: Reviews

Owns ratings and feedback for clinics, tied to verified completed visits.

### Aggregates

#### ClinicReviewCollection (Aggregate Root)
- **clinicId** : ClinicId
- **reviews** : list of Review
- **averageRating** : Rating
- **reviewCount** : integer

#### Review (Entity)
- **reviewId** : ReviewId
- **petOwnerId** : PetOwnerId
- **appointmentId** : AppointmentId (proof of visit)
- **rating** : Rating (1 to 5)
- **text** : Text (optional)
- **clinicResponse** : ClinicResponse (optional)
- **status** : ReviewStatus [PUBLISHED, FLAGGED, REMOVED]
- **createdAt** : Timestamp

### Value Objects
- **Rating** : integer (1-5)
- **ClinicResponse** { text: Text, respondedAt: Timestamp }

### Domain Events
- ReviewSubmitted
- ReviewPublished
- ReviewFlagged
- ClinicRespondedToReview

### Key Business Rules
- A review can only be submitted after a completed appointment (verified visit).
- Reviews are not anonymous -- they are tied to the pet owner's account.
- Clinics can respond publicly to reviews.
- Average rating is recalculated on each new review.

---

## Context Map

```
+-------------------+          +-------------------+
|  Clinic Directory |<-------->|    Scheduling     |
|                   |  clinicId|                   |
|  (Clinic, Vet     |  vetId   | (ClinicSchedule,  |
|   profiles,       |--------->|  Appointment)     |
|   search)         |          |                   |
+-------------------+          +--------+----------+
        |                               |
        |                               | appointmentId
        |                               | petOwnerId, petId
        v                               v
+-------------------+          +-------------------+
|     Reviews       |          |   Pet Registry    |
|                   |          |                   |
| (Review,          |<---------| (PetOwner, Pet)   |
|  ClinicResponse)  | ownerId  |                   |
+-------------------+          +--------+----------+
                                        |
                                        | petId
                                        v
                               +-------------------+
                               | Medical Records   |
                               |                   |
                               | (PetMedicalRecord,|
                               |  MedicalEntry,    |
                               |  Vaccination)     |
                               +-------------------+
                                        |
                                        | vaccinationDueDate
                                        v
                               +-------------------+
                               |  Notifications    |
                               |                   |
                               | (Notification     |
                               |  Schedule,        |
                               |  Planned          |
                               |  Notification)    |
                               +-------------------+
```

### Integration Relationships

| Upstream Context  | Downstream Context | Relationship       | Data Exchanged                              |
|-------------------|--------------------|--------------------|--------------------------------------------|
| Clinic Directory  | Scheduling         | Conformist         | ClinicId, VetProfileId, animal types served |
| Clinic Directory  | Reviews            | Conformist         | ClinicId, clinic name                       |
| Pet Registry      | Scheduling         | Customer-Supplier  | PetOwnerId, PetId, species                  |
| Pet Registry      | Medical Records    | Customer-Supplier  | PetId, PetOwnerId                           |
| Pet Registry      | Notifications      | Customer-Supplier  | PetOwnerId, contact details, consent status |
| Scheduling        | Notifications      | Customer-Supplier  | AppointmentId, dateTime, status changes     |
| Scheduling        | Medical Records    | Published Language | AppointmentId (links entry to visit)        |
| Scheduling        | Reviews            | Published Language | AppointmentId, completion status             |
| Medical Records   | Notifications      | Domain Events      | VaccinationDueDateApproaching               |

---

## Cross-Cutting Concerns

### GDPR and Data Privacy
- All personal data processing requires a recorded legal basis (consent or legitimate interest).
- Pet owners can exercise right to access, right to erasure, and data portability.
- Data erasure cascades: deleting a pet owner account triggers removal of personal data across Scheduling, Notifications, Reviews, and Medical Records.
- Medical record sharing requires explicit owner consent with time-limited access tokens.
- Breach notification must occur within 72 hours.

### Clinic Analytics (Read Model)
- Profile views, booking counts, no-show rates, and confirmation rates are projected as read models from events in Scheduling and Clinic Directory.
- These are query-side projections, not a separate bounded context.
