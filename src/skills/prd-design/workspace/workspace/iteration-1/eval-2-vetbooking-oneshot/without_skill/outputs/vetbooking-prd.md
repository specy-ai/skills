# Product Requirement Document: VetBook - Veterinary Appointment Booking Platform

| Field             | Value                                      |
|-------------------|--------------------------------------------|
| **Product Name**  | VetBook                                    |
| **Version**       | 1.0                                        |
| **Date**          | 2026-03-26                                 |
| **Author**        | Product Team                               |
| **Status**        | Draft                                      |
| **Target Launch** | France                                     |

---

## 1. Executive Summary

VetBook is an online platform that connects pet owners with veterinary clinics, enabling seamless appointment booking, schedule management, and pet health record access. The platform addresses a clear gap in the French market: while Doctolib has transformed human healthcare appointment booking, no equivalent solution exists for veterinary care. VetBook aims to become the reference platform for veterinary appointment management in France, with a goal of onboarding 500 clinics within the first 12 months of launch.

---

## 2. Problem Statement

### For Pet Owners
- Finding a nearby veterinarian with availability is time-consuming and relies on phone calls during business hours.
- There is no centralized way to view and compare veterinary clinics by location, specialty, reviews, or availability.
- Pet medical history is fragmented across paper records, different clinics, and lost documents.
- Appointment reminders depend on individual clinic practices (often inconsistent or absent).
- Booking outside of business hours is impossible when relying on phone-only scheduling.

### For Veterinary Clinics
- Staff spend significant time on phone-based scheduling, confirmations, and rescheduling.
- No-show rates are high due to lack of automated reminders.
- Patient record management is often paper-based or siloed in legacy software with no client-facing portal.
- Clinics have limited online visibility and no standardized way to attract new clients digitally.
- Managing multi-practitioner schedules across services (consultation, surgery, vaccination) is complex.

### Market Gap
The French market has over 19,000 veterinary practitioners and approximately 80 million pets (cats, dogs, and NAC -- nouveaux animaux de compagnie). Despite the maturity of platforms like Doctolib for human healthcare, no dominant digital booking solution exists for veterinary care. Existing tools are either clinic-internal management systems or generic scheduling tools not tailored to veterinary workflows.

---

## 3. Product Vision and Goals

### Vision
To become the leading veterinary care platform in France, making it as easy to book a vet appointment as it is to book a doctor appointment.

### Primary Goals

| Goal | Metric | Target | Timeframe |
|------|--------|--------|-----------|
| Clinic onboarding | Number of active clinics | 500 | 12 months |
| Pet owner adoption | Registered pet owners | 50,000 | 12 months |
| Booking volume | Monthly appointments booked | 20,000 | Month 12 |
| No-show reduction | No-show rate for clinics using reminders | < 10% | Month 6+ |
| Client satisfaction | NPS score (pet owners) | > 50 | Month 12 |

### Success Criteria
- 500 veterinary clinics actively using the platform within 12 months.
- Measurable reduction in phone-based booking for onboarded clinics.
- Positive clinic retention rate (> 85% after 6 months of usage).
- Platform rated 4+ stars on app stores.

---

## 4. Target Users and Personas

### Persona 1: Pet Owner -- "Sophie"
- **Age:** 32
- **Location:** Lyon, France
- **Pets:** 1 dog (Golden Retriever, 3 years old), 1 cat (European Shorthair, 6 years old)
- **Behavior:** Digitally native, uses Doctolib for her own appointments, expects the same convenience for her pets.
- **Pain points:** Cannot find a vet with weekend availability; lost her cat's vaccination booklet; had to call three clinics to find an available emergency slot.
- **Goals:** Book appointments quickly, keep all pet records in one place, receive reminders for upcoming vaccinations.

### Persona 2: Veterinary Clinic Manager -- "Dr. Marc Lefebvre"
- **Role:** Veterinarian and clinic owner
- **Clinic:** 3 practitioners, 1 receptionist, suburban area near Bordeaux
- **Pain points:** Receptionist overwhelmed by phone calls; 20% no-show rate; difficulty managing three different practitioner schedules; wants to attract new clients.
- **Goals:** Reduce administrative overhead, fill empty slots, reduce no-shows, modernize client communication.

### Persona 3: Veterinary Receptionist -- "Amina"
- **Role:** Front desk / administrative staff
- **Clinic:** Urban clinic in Paris, 5 practitioners
- **Pain points:** Spends 60% of her time on the phone managing appointments; manual reminder calls; double-bookings when practitioners update availability informally.
- **Goals:** Centralized schedule view, automated reminders, fewer phone interruptions, easy rescheduling.

---

## 5. Scope

### In Scope (v1.0)
- Pet owner registration and pet profile management.
- Clinic registration, profile, and schedule configuration.
- Search and discovery of veterinary clinics (location, availability, specialty).
- Online appointment booking, rescheduling, and cancellation.
- Automated appointment reminders (email and SMS).
- Pet medical history (basic: vaccination records, visit summaries, prescriptions).
- Clinic dashboard for schedule and patient management.
- GDPR-compliant data handling.
- Web application (responsive) and mobile apps (iOS/Android).
- French language and France geography.

### Out of Scope (v1.0)
- Telemedicine / video consultation.
- Online payment and invoicing.
- Insurance integration.
- Pharmacy / medication ordering.
- Multi-country support (beyond France).
- AI-based symptom checker or triage.
- Integration with existing veterinary practice management software (considered for v2).
- Marketplace for pet products or services.

---

## 6. Functional Requirements

### 6.1 Pet Owner Features

#### 6.1.1 Account and Pet Profile Management
| ID | Requirement | Priority |
|----|-------------|----------|
| PO-001 | Pet owners can register using email, phone number, or France Connect. | Must Have |
| PO-002 | Pet owners can create and manage multiple pet profiles (name, species, breed, date of birth, weight, photo, microchip number). | Must Have |
| PO-003 | Pet owners can edit their personal information (name, address, phone, email). | Must Have |
| PO-004 | Pet owners can delete their account and all associated data (GDPR right to erasure). | Must Have |
| PO-005 | Pet owners can export their data in a machine-readable format (GDPR data portability). | Must Have |

#### 6.1.2 Search and Discovery
| ID | Requirement | Priority |
|----|-------------|----------|
| PO-010 | Pet owners can search for clinics by location (address, city, or "near me" geolocation). | Must Have |
| PO-011 | Search results display clinic name, address, distance, next available slot, average rating, and accepted animal types. | Must Have |
| PO-012 | Pet owners can filter results by: species treated, specialty (dentistry, orthopedics, dermatology, etc.), availability (today, this week, next available), distance radius. | Must Have |
| PO-013 | Pet owners can view a clinic's detailed profile: practitioners, services offered, opening hours, photos, reviews, and map location. | Must Have |
| PO-014 | Pet owners can view practitioner profiles within a clinic (name, photo, specialties, languages spoken). | Should Have |
| PO-015 | Search results can be displayed on a map view or list view. | Should Have |

#### 6.1.3 Appointment Booking
| ID | Requirement | Priority |
|----|-------------|----------|
| PO-020 | Pet owners can view available time slots for a selected clinic/practitioner. | Must Have |
| PO-021 | Pet owners can book an appointment by selecting a time slot, a pet, and a visit reason (consultation, vaccination, surgery, emergency, follow-up, other). | Must Have |
| PO-022 | Pet owners receive an immediate booking confirmation via email and/or SMS. | Must Have |
| PO-023 | Pet owners can cancel an appointment up to a configurable deadline (set by the clinic, default: 24 hours before). | Must Have |
| PO-024 | Pet owners can reschedule an appointment (cancel + rebook flow). | Must Have |
| PO-025 | Pet owners can add notes or describe symptoms when booking. | Should Have |
| PO-026 | Pet owners can book appointments for multiple pets in consecutive slots. | Nice to Have |

#### 6.1.4 Reminders and Notifications
| ID | Requirement | Priority |
|----|-------------|----------|
| PO-030 | Pet owners receive automated appointment reminders at configurable intervals (default: 48h and 2h before). | Must Have |
| PO-031 | Pet owners receive notifications for upcoming vaccination due dates or periodic health check reminders (set by clinic). | Should Have |
| PO-032 | Pet owners can configure their notification preferences (email, SMS, push, or combination). | Must Have |
| PO-033 | Pet owners can opt out of non-essential notifications. | Must Have |

#### 6.1.5 Pet Medical History
| ID | Requirement | Priority |
|----|-------------|----------|
| PO-040 | Pet owners can view a timeline of past visits, including date, clinic, practitioner, and visit summary. | Must Have |
| PO-041 | Pet owners can view vaccination records with dates and next due dates. | Must Have |
| PO-042 | Pet owners can download visit summaries and vaccination records as PDF. | Should Have |
| PO-043 | Pet owners can manually add historical records (e.g., past vaccinations from another clinic). | Nice to Have |

#### 6.1.6 Reviews and Ratings
| ID | Requirement | Priority |
|----|-------------|----------|
| PO-050 | Pet owners can rate a clinic (1-5 stars) and leave a written review after a completed appointment. | Should Have |
| PO-051 | Reviews are moderated for inappropriate content before publication. | Should Have |
| PO-052 | Clinics can respond to reviews publicly. | Should Have |

---

### 6.2 Clinic Features

#### 6.2.1 Clinic Registration and Profile
| ID | Requirement | Priority |
|----|-------------|----------|
| CL-001 | Clinics can register by providing business information (SIRET number, clinic name, address, phone, email). | Must Have |
| CL-002 | Clinic registration requires identity verification (SIRET validation, Ordre national des veterinaires number). | Must Have |
| CL-003 | Clinics can manage their public profile: description, photos, services offered, animal types treated, specialties, opening hours, parking availability. | Must Have |
| CL-004 | Clinics can add and manage multiple practitioners with individual profiles. | Must Have |
| CL-005 | Clinics can designate multiple staff roles: admin, practitioner, receptionist (with different permission levels). | Must Have |

#### 6.2.2 Schedule Management
| ID | Requirement | Priority |
|----|-------------|----------|
| CL-010 | Clinics can configure recurring weekly availability per practitioner. | Must Have |
| CL-011 | Clinics can define appointment types with specific durations (e.g., consultation: 20 min, vaccination: 15 min, surgery: 60 min). | Must Have |
| CL-012 | Clinics can block time slots (holidays, breaks, meetings, surgery blocks). | Must Have |
| CL-013 | Clinics can set buffer time between appointments. | Should Have |
| CL-014 | The platform prevents double-booking automatically. | Must Have |
| CL-015 | Clinics can view a unified calendar showing all practitioners' schedules. | Must Have |
| CL-016 | Clinics can manually add walk-in or phone-booked appointments to the schedule. | Must Have |
| CL-017 | Clinics can configure cancellation policy (minimum notice period, maximum cancellations per client). | Should Have |
| CL-018 | Clinics can set a maximum number of online bookings per day to reserve slots for phone/walk-in. | Should Have |

#### 6.2.3 Appointment Management
| ID | Requirement | Priority |
|----|-------------|----------|
| CL-020 | Clinics receive real-time notifications for new bookings, cancellations, and reschedules. | Must Have |
| CL-021 | Clinics can confirm, cancel, or reschedule appointments from the dashboard. | Must Have |
| CL-022 | Clinics can view upcoming appointments with pet owner details, pet information, and visit reason. | Must Have |
| CL-023 | Clinics can mark appointments as completed, no-show, or cancelled. | Must Have |
| CL-024 | Clinics can access a waiting list: when a slot opens, the next person on the list is notified. | Nice to Have |

#### 6.2.4 Reminders
| ID | Requirement | Priority |
|----|-------------|----------|
| CL-030 | Clinics can configure automated reminder schedules per appointment type. | Must Have |
| CL-031 | Clinics can send manual reminders or messages to specific pet owners. | Should Have |
| CL-032 | Clinics can send bulk vaccination or health check reminders to eligible pets. | Should Have |

#### 6.2.5 Patient Records
| ID | Requirement | Priority |
|----|-------------|----------|
| CL-040 | Clinics can create and update visit records for each appointment (diagnosis, treatment, prescriptions, notes). | Must Have |
| CL-041 | Clinics can record and update vaccination history for each pet. | Must Have |
| CL-042 | Clinics can upload documents (lab results, X-rays) to a pet's record. | Should Have |
| CL-043 | Clinics can view a pet's full history across all visits at their clinic. | Must Have |
| CL-044 | Clinics can share specific records with the pet owner (visible in the pet owner's history view). | Must Have |

#### 6.2.6 Analytics Dashboard
| ID | Requirement | Priority |
|----|-------------|----------|
| CL-050 | Clinics can view booking statistics: appointments per day/week/month, busiest times, no-show rate. | Should Have |
| CL-051 | Clinics can view client acquisition metrics: new clients via platform vs. existing clients. | Should Have |
| CL-052 | Clinics can export appointment and analytics data as CSV. | Nice to Have |

---

### 6.3 Platform Administration

| ID | Requirement | Priority |
|----|-------------|----------|
| AD-001 | Admin dashboard for managing clinic registrations (approve, suspend, remove). | Must Have |
| AD-002 | Admin dashboard for reviewing flagged content (reviews, profiles). | Must Have |
| AD-003 | Platform-wide analytics: total clinics, total users, total bookings, growth metrics. | Must Have |
| AD-004 | Ability to send platform-wide announcements to clinics or pet owners. | Should Have |
| AD-005 | Admin tools for GDPR compliance: data deletion requests processing, audit logs. | Must Have |

---

## 7. Non-Functional Requirements

### 7.1 Performance
| ID | Requirement | Target |
|----|-------------|--------|
| NF-001 | Page load time | < 2 seconds (95th percentile) |
| NF-002 | Search results response time | < 1 second |
| NF-003 | Booking confirmation time | < 3 seconds end-to-end |
| NF-004 | System uptime | 99.9% availability |
| NF-005 | Concurrent users supported | 10,000 at launch, scalable to 100,000 |

### 7.2 Security and GDPR Compliance
| ID | Requirement | Priority |
|----|-------------|----------|
| NF-010 | All personal data must be encrypted at rest (AES-256) and in transit (TLS 1.3). | Must Have |
| NF-011 | GDPR-compliant consent management: explicit opt-in for data collection, clear privacy policy, granular consent for marketing communications. | Must Have |
| NF-012 | Right to access: users can request and receive a copy of all their personal data. | Must Have |
| NF-013 | Right to erasure: users can request deletion of their account and all associated data, with processing within 30 days. | Must Have |
| NF-014 | Right to data portability: users can export their data in a standard machine-readable format (JSON/CSV). | Must Have |
| NF-015 | Data Processing Agreement (DPA) in place with all sub-processors. | Must Have |
| NF-016 | Appointment a Data Protection Officer (DPO) and register with the CNIL. | Must Have |
| NF-017 | Data retention policy: personal data deleted or anonymized after account deletion; medical records retained per applicable veterinary regulations. | Must Have |
| NF-018 | Regular security audits and penetration testing (at least annually). | Must Have |
| NF-019 | Two-factor authentication (2FA) available for clinic accounts. | Must Have |
| NF-020 | Role-based access control for clinic staff. | Must Have |
| NF-021 | Audit logging of all data access and modifications. | Must Have |
| NF-022 | Data breach notification process: notify CNIL within 72 hours, notify affected users without undue delay. | Must Have |
| NF-023 | All data hosted within the EU (France preferred). | Must Have |
| NF-024 | Cookie consent banner compliant with CNIL guidelines. | Must Have |

### 7.3 Accessibility
| ID | Requirement | Target |
|----|-------------|--------|
| NF-030 | WCAG 2.1 Level AA compliance. | Must Have |
| NF-031 | Full keyboard navigation support. | Must Have |
| NF-032 | Screen reader compatibility. | Must Have |

### 7.4 Localization
| ID | Requirement | Target |
|----|-------------|--------|
| NF-040 | French language as primary and only language for v1. | Must Have |
| NF-041 | Architecture supports future multi-language expansion. | Should Have |
| NF-042 | French date, time, address, and phone number formats. | Must Have |

### 7.5 Reliability
| ID | Requirement | Target |
|----|-------------|--------|
| NF-050 | Automated backups every 6 hours with 30-day retention. | Must Have |
| NF-051 | Disaster recovery: RPO < 6 hours, RTO < 4 hours. | Must Have |
| NF-052 | Graceful degradation: if SMS service is unavailable, fall back to email for reminders. | Should Have |

---

## 8. User Flows

### 8.1 Pet Owner: Book an Appointment

```
1. Pet owner opens VetBook (web or mobile app).
2. Pet owner enters location or allows geolocation.
3. System displays nearby clinics with availability summary.
4. Pet owner filters by species, specialty, or date.
5. Pet owner selects a clinic and views available slots.
6. Pet owner selects a time slot.
7. If not logged in, pet owner is prompted to log in or register.
8. Pet owner selects a pet profile (or creates one).
9. Pet owner selects visit reason and optionally adds notes.
10. Pet owner confirms booking.
11. System validates slot availability (real-time).
12. System creates the appointment and sends confirmation (email + SMS).
13. System schedules automated reminders.
14. Clinic receives new booking notification.
```

### 8.2 Clinic: Daily Schedule Management

```
1. Clinic staff logs in to the dashboard.
2. Dashboard displays today's schedule for all practitioners.
3. Staff can switch between day, week, and month views.
4. Staff can click on an appointment to view details (pet owner, pet, visit reason).
5. Staff can mark appointments as arrived, in progress, completed, or no-show.
6. Staff can add a walk-in appointment to an available slot.
7. Staff can block a slot for a break or emergency.
8. At end of day, practitioner completes visit records for each appointment.
```

### 8.3 Clinic: Onboarding

```
1. Clinic representative visits VetBook registration page.
2. Fills in business information (SIRET, Ordre des veterinaires number, address, etc.).
3. Uploads required verification documents.
4. VetBook admin team reviews and approves the registration (target: within 48 hours).
5. Clinic receives approval notification with setup guide.
6. Clinic configures: practitioners, services, appointment types and durations, weekly availability.
7. Clinic publishes profile.
8. Clinic appears in search results and can receive online bookings.
```

---

## 9. Information Architecture

### Pet Owner App/Web
```
Home
  +-- Search (location-based)
  |     +-- Search Results (list / map)
  |     +-- Clinic Profile
  |           +-- Practitioner Profile
  |           +-- Available Slots
  |           +-- Book Appointment
  +-- My Appointments
  |     +-- Upcoming
  |     +-- Past
  |     +-- Cancelled
  +-- My Pets
  |     +-- Pet Profile
  |     +-- Medical History
  |     +-- Vaccination Record
  +-- Notifications
  +-- My Account
        +-- Personal Information
        +-- Notification Preferences
        +-- Privacy & Data
        +-- Help & Support
```

### Clinic Dashboard
```
Dashboard (today's overview)
  +-- Calendar
  |     +-- Day / Week / Month View
  |     +-- Appointment Detail
  +-- Appointments
  |     +-- Upcoming
  |     +-- Past
  |     +-- Cancellations / No-shows
  +-- Patients
  |     +-- Pet Owner Directory
  |     +-- Pet Records
  |           +-- Visit History
  |           +-- Vaccination Record
  |           +-- Documents
  +-- Reminders
  |     +-- Automated Reminders Settings
  |     +-- Bulk Reminders
  +-- Clinic Settings
  |     +-- Profile & Services
  |     +-- Practitioners
  |     +-- Schedule & Availability
  |     +-- Appointment Types
  |     +-- Cancellation Policy
  |     +-- Staff & Permissions
  +-- Analytics
  +-- Help & Support
```

---

## 10. Technical Considerations

### 10.1 Architecture
- Cloud-native architecture hosted on a European cloud provider (e.g., OVHcloud, Scaleway, or AWS eu-west-3 Paris region) to ensure GDPR-compliant data residency.
- Microservices or modular monolith architecture to allow independent scaling of booking, search, notification, and records services.
- RESTful API backend serving web frontend (responsive SPA) and native mobile apps.

### 10.2 Key Technical Components
| Component | Description |
|-----------|-------------|
| **Search & Geolocation** | Geospatial indexing for location-based clinic search (PostGIS or Elasticsearch geo queries). |
| **Real-time Availability** | Optimistic locking or reservation-based system to prevent double bookings under concurrent access. |
| **Notification Service** | Multi-channel notification engine (email via transactional provider, SMS via French-compliant provider, push notifications). |
| **Calendar Engine** | Recurring availability rules, exception handling, timezone-aware scheduling. |
| **Document Storage** | Encrypted object storage for medical documents and images (S3-compatible, EU-hosted). |
| **Authentication** | OAuth 2.0 / OpenID Connect; France Connect integration for pet owners; 2FA for clinic accounts. |

### 10.3 Integrations (v1)
| Integration | Purpose |
|-------------|---------|
| **SMS Provider** (e.g., OVH SMS, Twilio EU) | Appointment reminders and confirmations. |
| **Email Provider** (e.g., Brevo/Sendinblue) | Transactional emails and notifications. |
| **France Connect** | Optional authentication for pet owners. |
| **SIRET API** (INSEE) | Clinic business registration verification. |
| **Map Provider** (e.g., Mapbox, Google Maps) | Clinic search and map display. |

### 10.4 Integrations (Future - v2+)
- Veterinary practice management software (e.g., Vetup, Gmvet) for two-way sync.
- I-CAD (national pet identification database) for microchip verification.
- Payment provider for online pre-payment or deposits.

---

## 11. Business Model

### Revenue Streams
| Stream | Description | Pricing (indicative) |
|--------|-------------|---------------------|
| **Clinic Subscription** | Monthly SaaS fee per clinic for access to the platform. Tiered by number of practitioners. | Solo (1 practitioner): 49 EUR/month. Standard (2-3): 99 EUR/month. Premium (4+): 149 EUR/month. |
| **Freemium Onboarding** | First 3 months free for early adopter clinics to drive the 500-clinic target. | 0 EUR for 3 months. |
| **Premium Visibility** | Promoted placement in search results. | 30-80 EUR/month add-on. |

### Pet Owner Pricing
- Free for pet owners. No booking fees. This is essential for adoption and network effects.

---

## 12. Go-to-Market Strategy (Summary)

### Phase 1: Seed (Months 1-3)
- Target 5 pilot cities: Paris, Lyon, Bordeaux, Toulouse, Nantes.
- Personal outreach to 100 clinics; offer 3-month free trial.
- Onboard 50 clinics.

### Phase 2: Growth (Months 4-8)
- Expand to 15 cities.
- Launch digital marketing campaigns targeting pet owners (social media, SEO, pet community partnerships).
- Veterinary conference presence (e.g., AFVAC congress).
- Onboard 250 clinics (cumulative).

### Phase 3: Scale (Months 9-12)
- Nationwide availability.
- Referral program for clinics (refer a colleague, get 1 month free).
- PR and media coverage targeting pet lifestyle publications.
- Reach 500 clinics.

---

## 13. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low clinic adoption -- vets resist digital tools. | Medium | High | Free trial period; dedicated onboarding support; demonstrate ROI (reduced no-shows, new clients). |
| Cold start problem -- pet owners find no clinics nearby. | High | High | Geographic concentration strategy (city-by-city launch); seed with clinic directory data (non-bookable profiles). |
| GDPR non-compliance leading to CNIL sanctions. | Low | Very High | Hire DPO from day one; engage privacy counsel; conduct Data Protection Impact Assessment (DPIA) before launch; regular audits. |
| Competition from Doctolib expanding into veterinary. | Medium | High | First-mover advantage; build veterinary-specific features they cannot easily replicate; strong clinic relationships. |
| Data breach exposing personal or medical records. | Low | Very High | Security-by-design; encryption everywhere; penetration testing; incident response plan; cyber insurance. |
| SMS/notification delivery failures. | Medium | Medium | Multi-provider fallback; delivery monitoring and alerting; email as backup channel. |

---

## 14. Metrics and KPIs

### Acquisition
- Number of registered clinics (target: 500 at month 12).
- Number of registered pet owners (target: 50,000 at month 12).
- Clinic activation rate (% of registered clinics with at least 1 booking in first 30 days).

### Engagement
- Monthly active pet owners.
- Appointments booked per month.
- Average bookings per pet owner per quarter.
- Clinic calendar fill rate (booked slots / available slots).

### Retention
- Clinic churn rate (monthly).
- Pet owner return booking rate (% who book again within 6 months).

### Operational
- No-show rate (target: < 10%).
- Average time from search to confirmed booking.
- Reminder delivery rate (SMS + email).
- Platform uptime.

### Satisfaction
- Net Promoter Score (pet owners and clinics, measured quarterly).
- App store rating.
- Support ticket volume and resolution time.

---

## 15. Release Plan

### MVP (v1.0) -- Target: Month 6 after development start
**Core capabilities:**
- Pet owner registration, pet profiles, clinic search, appointment booking, automated reminders (email + SMS), basic medical history view.
- Clinic registration, profile management, schedule configuration, appointment management, visit records, reminder configuration.
- Admin panel for clinic approval and platform monitoring.
- GDPR compliance (consent, data access, erasure, portability).
- Responsive web application.

### v1.1 -- Target: Month 8
- iOS and Android native apps for pet owners.
- Reviews and ratings.
- Clinic analytics dashboard.
- Waiting list functionality.

### v1.2 -- Target: Month 11
- Document upload (lab results, X-rays).
- Bulk vaccination reminders.
- Premium visibility for clinics.
- Enhanced search filters and recommendations.

### v2.0 -- Target: Month 15+
- Practice management software integrations.
- Online pre-payment / deposits.
- Telemedicine (video consultations).
- Multi-language support (English, Spanish, German) for international expansion.

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | What is the legal framework for sharing veterinary medical records between clinics with pet owner consent? | Legal | Open |
| 2 | Should we support emergency/urgent appointment flow differently from standard bookings? | Product | Open |
| 3 | What is the minimum viable onboarding flow to get a clinic live in under 30 minutes? | Product + Design | Open |
| 4 | Should France Connect be a launch requirement or a post-launch addition? | Engineering | Open |
| 5 | What veterinary record retention obligations apply under French law? | Legal | Open |
| 6 | Do we need I-CAD integration at launch for microchip-based pet identification? | Product | Open |

---

## 17. Glossary

| Term | Definition |
|------|-----------|
| **NAC** | Nouveaux Animaux de Compagnie -- non-traditional pets (rabbits, reptiles, birds, etc.). |
| **SIRET** | French business registration number (Systeme d'Identification du Repertoire des Etablissements). |
| **CNIL** | Commission Nationale de l'Informatique et des Libertes -- French data protection authority. |
| **DPO** | Data Protection Officer, required under GDPR for certain organizations. |
| **DPIA** | Data Protection Impact Assessment -- mandatory analysis for high-risk data processing. |
| **I-CAD** | Fichier national d'identification des carnivores domestiques -- French national pet identification database. |
| **AFVAC** | Association Francaise des Veterinaires pour Animaux de Compagnie. |
| **France Connect** | French government digital identity service for citizen authentication. |
| **NPS** | Net Promoter Score -- metric measuring customer loyalty and satisfaction. |

---

## Appendix A: GDPR Compliance Checklist

- [ ] Privacy policy published (clear, accessible, in French).
- [ ] Cookie consent mechanism implemented (CNIL-compliant).
- [ ] Consent records stored with timestamp and scope.
- [ ] Data Processing Agreement (DPA) signed with all sub-processors.
- [ ] Data Protection Impact Assessment (DPIA) completed.
- [ ] DPO appointed and registered with CNIL.
- [ ] Right to access implemented and tested.
- [ ] Right to erasure implemented and tested.
- [ ] Right to data portability implemented and tested.
- [ ] Right to rectification implemented and tested.
- [ ] Right to object to processing implemented.
- [ ] Data breach notification procedure documented and tested.
- [ ] Employee data protection training completed.
- [ ] Data retention and deletion schedules defined and automated.
- [ ] All data hosted within EU borders confirmed.
- [ ] Encryption at rest and in transit verified.
- [ ] Access controls and audit logging operational.
- [ ] Third-party security audit completed before launch.
