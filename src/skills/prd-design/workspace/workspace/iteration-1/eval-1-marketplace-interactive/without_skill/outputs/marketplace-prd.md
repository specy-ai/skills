# Product Requirement Document: ConsultConnect

## European B2B Marketplace for Freelance Software Consultants

**Document Version:** 1.0
**Date:** 2026-03-26
**Status:** Draft

---

## 1. Executive Summary

ConsultConnect is a two-sided B2B marketplace connecting European companies seeking software consulting expertise with independent freelance software consultants. Companies post missions (engagements), consultants discover and apply to them, and the platform facilitates matching, contracting, billing, and compliance. The product targets the growing European freelance IT consulting market, estimated at over EUR 50 billion, driven by digital transformation demand and increasing workforce flexibility.

---

## 2. Problem Statement

### For Companies (Demand Side)
- Finding qualified, vetted software consultants is time-consuming and relies heavily on personal networks or expensive staffing agencies (typically 15-25% markup).
- Managing compliance (EU freelance regulations, IR35-equivalent rules, VAT cross-border) is complex and error-prone.
- No transparency on market rates, leading to overpaying or underpaying and losing candidates.

### For Consultants (Supply Side)
- Acquiring new clients requires significant non-billable effort (networking, prospecting, proposal writing).
- Late payments and contractual disputes are common when working without intermediary protections.
- Difficulty building a portable, verified professional reputation across engagements.

---

## 3. Vision and Goals

### Vision
Become the reference marketplace for software consulting engagements in Europe, trusted by both enterprises and independent consultants for its quality of matching, regulatory compliance, and fair economics.

### Goals (First 18 Months)
| Goal | Metric | Target |
|------|--------|--------|
| Supply acquisition | Registered, profile-complete consultants | 5,000 |
| Demand acquisition | Companies with at least one posted mission | 500 |
| Matching efficiency | Missions receiving 3+ qualified applications | 70% |
| Transaction volume | Gross Merchandise Value (monthly) | EUR 2M by month 18 |
| Consultant satisfaction | NPS among active consultants | > 50 |
| Company satisfaction | NPS among active companies | > 45 |
| Time-to-first-application | Median time from mission publish to first application | < 48 hours |

---

## 4. Target Users and Personas

### Persona 1: Hiring Manager (Company Side)
- **Name:** Sophie, VP of Engineering at a mid-size fintech (200 employees, based in Paris)
- **Context:** Needs to staff a 6-month cloud migration project with 3 senior consultants. Budget approved, timeline tight.
- **Pain points:** Previous agency took 4 weeks to present candidates, 2 of 3 dropped out. No visibility into pipeline.
- **Needs:** Fast access to vetted consultants, clear rate benchmarking, compliant contracting.

### Persona 2: Procurement / Legal (Company Side)
- **Name:** Lars, Procurement Lead at an enterprise (2,000 employees, based in Munich)
- **Context:** Must ensure all external contractors are compliant with German Scheinselbstaendigkeit rules and GDPR.
- **Pain points:** Each new freelance engagement requires manual legal review.
- **Needs:** Pre-validated contract templates, automated compliance checks, audit trail.

### Persona 3: Freelance Software Consultant
- **Name:** Ana, independent Java/Cloud architect (10 years experience, based in Lisbon, works across EU)
- **Context:** Currently has 2 months between engagements, wants to find a remote-friendly mission paying EUR 700+/day.
- **Pain points:** Spends 20% of time on business development. Last client paid 45 days late.
- **Needs:** Steady pipeline of relevant missions, fast payment, portable reputation.

### Persona 4: Platform Administrator
- **Name:** Internal operations team
- **Context:** Manages marketplace quality, resolves disputes, monitors compliance.
- **Needs:** Dashboards, moderation tools, fraud detection alerts.

---

## 5. Scope

### In Scope (MVP / V1)
- Consultant registration, profile creation, and skill verification
- Company registration and mission posting
- Search, discovery, and application workflow
- Matching and shortlisting
- Messaging between company and consultant
- Contract generation from templates (French, German, Dutch law initially)
- Time reporting and approval
- Invoicing and payment processing (escrow-based)
- Basic ratings and reviews (bidirectional)
- GDPR-compliant data handling
- Multi-language UI (English, French, German)

### Out of Scope (V1)
- Managed services / Statement of Work (SoW) engagements
- Team/squad composition (placing multiple consultants as a unit)
- Payroll / umbrella company (portage salarial) integration
- Native mobile applications (responsive web only for V1)
- AI-powered auto-matching (manual search and filters for V1)
- Public API for ATS/VMS integration

---

## 6. Functional Requirements

### 6.1 Consultant Registration and Profile

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-C01 | Consultant can register using email or LinkedIn SSO | Must |
| FR-C02 | Consultant can create a profile with: summary, skills (from a controlled taxonomy), years of experience, certifications, spoken languages, location, remote/on-site/hybrid preference, daily rate range | Must |
| FR-C03 | Consultant can upload a CV (PDF) and a profile photo | Must |
| FR-C04 | Consultant can link references from past engagements (client name, duration, description, optional endorsement) | Should |
| FR-C05 | Consultant can set availability (available now, available from date, not available) | Must |
| FR-C06 | Consultant can specify preferred contract types (freelance, portage salarial) and legal entity details (company name, VAT number, country of registration) | Must |
| FR-C07 | Platform verifies consultant identity via government ID check (integration with third-party KYC provider) | Must |
| FR-C08 | Consultant can indicate willingness to travel and specify EU countries where they hold work authorization | Should |

### 6.2 Company Registration and Mission Posting

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-M01 | Company can register with business details (legal name, VAT/SIREN number, address, industry) | Must |
| FR-M02 | Platform verifies company existence via business registry check | Must |
| FR-M03 | Company can invite multiple team members with role-based access (admin, hiring manager, finance) | Must |
| FR-M04 | Company can create a mission with: title, description, required skills, seniority level, start date, estimated duration, location (city + remote policy), daily rate budget (range or fixed), and number of positions | Must |
| FR-M05 | Company can set mission visibility: public (all consultants), private (invite-only), or unlisted (accessible via link) | Should |
| FR-M06 | Company can save mission drafts before publishing | Must |
| FR-M07 | Company can duplicate a past mission as a template | Should |
| FR-M08 | Company can specify mandatory certifications or clearances (e.g., security clearance level) | Should |

### 6.3 Search and Discovery

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-S01 | Consultants can search missions by: skills, location, remote policy, daily rate, duration, start date, industry | Must |
| FR-S02 | Companies can search consultants by: skills, location, availability, daily rate, experience level, languages | Must |
| FR-S03 | Both sides can save searches and receive email/in-app notifications when new matches appear | Should |
| FR-S04 | Search results display a relevance score based on skill match and availability | Should |
| FR-S05 | Consultants see an estimated match percentage on each mission listing | Could |

### 6.4 Application and Selection Workflow

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-A01 | Consultant can apply to a mission with a cover message and proposed daily rate | Must |
| FR-A02 | Company receives notification of new applications and can view applicant profiles | Must |
| FR-A03 | Company can shortlist, reject (with optional reason), or request an interview with applicants | Must |
| FR-A04 | Company can schedule an interview directly through the platform (calendar integration or manual scheduling) | Should |
| FR-A05 | Company can make an offer specifying: daily rate, start date, duration, location, and contract terms | Must |
| FR-A06 | Consultant can accept, negotiate, or decline the offer | Must |
| FR-A07 | Both parties can track the status of all their active applications/missions on a dashboard | Must |
| FR-A08 | Company can invite specific consultants to apply to a mission | Should |

### 6.5 Messaging

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-MSG01 | Company and consultant can exchange messages within the platform once an application is submitted | Must |
| FR-MSG02 | Messages support text and file attachments (max 10 MB) | Must |
| FR-MSG03 | Users receive email notifications for new messages (configurable frequency: immediate, daily digest, off) | Must |
| FR-MSG04 | Platform monitors messages for off-platform contact exchange attempts (phone numbers, external emails) prior to contract signing | Should |

### 6.6 Contracting

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CT01 | Upon offer acceptance, the platform generates a pre-filled service agreement based on the selected legal template (French, German, or Dutch law) | Must |
| FR-CT02 | Both parties can review, request amendments (tracked changes), and digitally sign the contract (eIDAS-compliant electronic signature) | Must |
| FR-CT03 | Signed contracts are stored and accessible to both parties for the duration of the legal retention period (10 years) | Must |
| FR-CT04 | Platform flags potential compliance risks (e.g., engagement duration exceeding local thresholds for reclassification risk) | Should |

### 6.7 Time Reporting and Approval

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-T01 | Consultant can submit weekly or monthly timesheets (days worked, with optional comments) | Must |
| FR-T02 | Company hiring manager can approve or dispute timesheets | Must |
| FR-T03 | If a timesheet is not approved or disputed within 5 business days, it is auto-approved | Should |
| FR-T04 | Both parties can view timesheet history for all engagements | Must |

### 6.8 Invoicing and Payments

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-P01 | Upon timesheet approval, the platform generates an invoice on behalf of the consultant (or the consultant uploads their own invoice) | Must |
| FR-P02 | Company pays the platform (escrow). Payment methods: SEPA direct debit, bank transfer, credit card | Must |
| FR-P03 | Platform releases payment to consultant within 3 business days of receiving company payment | Must |
| FR-P04 | Platform handles VAT reverse-charge mechanism for cross-border EU transactions and generates compliant invoices | Must |
| FR-P05 | Consultant and company can view payment history, outstanding amounts, and download invoices | Must |
| FR-P06 | Platform sends automated payment reminders to companies (at due date, +7 days, +14 days) | Must |
| FR-P07 | Platform offers optional early payment to consultants (within 48 hours of timesheet approval) for a fee | Could |

### 6.9 Ratings and Reviews

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-R01 | At the end of an engagement, both parties are prompted to leave a rating (1-5 stars) and a written review | Must |
| FR-R02 | Reviews are visible on the respective profiles after both parties have submitted theirs (or after 14 days) | Must |
| FR-R03 | Users can flag inappropriate reviews for moderation | Must |
| FR-R04 | Aggregate rating is displayed on profiles | Must |

### 6.10 Administration and Moderation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ADM01 | Admin dashboard with KPIs: registrations, active missions, applications, GMV, disputes | Must |
| FR-ADM02 | Admin can suspend or ban users (with notification and reason) | Must |
| FR-ADM03 | Admin can review and resolve disputes (payment, review, contract) | Must |
| FR-ADM04 | Admin can manage the skill taxonomy (add, merge, deprecate skills) | Must |
| FR-ADM05 | Admin can manage contract templates | Must |
| FR-ADM06 | Automated fraud detection alerts (duplicate accounts, fake reviews, rate manipulation) | Should |

---

## 7. Non-Functional Requirements

| ID | Requirement | Category | Target |
|----|-------------|----------|--------|
| NFR-01 | Page load time | Performance | < 2 seconds (p95) |
| NFR-02 | Search response time | Performance | < 500ms (p95) |
| NFR-03 | System availability | Reliability | 99.5% uptime (monthly) |
| NFR-04 | Data encryption at rest and in transit | Security | AES-256 / TLS 1.3 |
| NFR-05 | GDPR compliance: right to access, rectification, erasure, portability | Compliance | Full compliance |
| NFR-06 | eIDAS-compliant advanced electronic signatures for contracts | Compliance | Full compliance |
| NFR-07 | PSD2 / PCI-DSS compliance for payment processing | Compliance | Full compliance |
| NFR-08 | Support for 10,000 concurrent users | Scalability | V1 target |
| NFR-09 | Multi-language support (English, French, German) | Usability | V1 |
| NFR-10 | WCAG 2.1 AA accessibility | Accessibility | V1 |
| NFR-11 | Automated daily backups with 30-day retention and tested restore procedure | Reliability | Full compliance |
| NFR-12 | Audit log of all sensitive actions (login, contract signing, payment, profile changes) | Security | Full compliance |
| NFR-13 | Data residency within EU (hosting in EU data centers) | Compliance | Full compliance |
| NFR-14 | Responsive design supporting desktop (1024px+) and tablet (768px+) | Usability | V1 |

---

## 8. Business Model

### Revenue Streams

| Stream | Mechanism | Rate |
|--------|-----------|------|
| **Transaction fee** | Commission on each billed day, charged to the company on top of the consultant's rate | 8-12% (tiered: 12% for first EUR 50K GMV per company, 10% for EUR 50-200K, 8% above EUR 200K) |
| **Premium consultant subscription** | Monthly subscription for enhanced visibility, priority in search results, and analytics | EUR 49/month |
| **Premium company subscription** | Monthly subscription for unlimited mission postings, advanced filters, and dedicated support | EUR 299/month |
| **Early payment fee** | Optional accelerated payment to consultants | 1.5% of invoice amount |

### Unit Economics Target (Steady State)
- Average mission duration: 4 months
- Average daily rate: EUR 650
- Average days billed per month: 20
- Revenue per mission: ~EUR 5,200 - 6,240 (at 10% blended rate)
- Target gross margin: > 70% (platform is asset-light)

---

## 9. User Journeys

### Journey 1: Company Posts a Mission and Hires a Consultant

1. Sophie registers her company on ConsultConnect, entering business details and verifying via VAT number lookup.
2. She invites her colleague (hiring manager) and Lars (procurement) to the company account.
3. Sophie creates a new mission: "Senior Cloud Architect - Azure Migration" with required skills, rate range EUR 600-750/day, 6 months, hybrid (Paris 2 days/week).
4. She publishes the mission. It becomes visible to matching consultants.
5. Within 48 hours, 7 consultants apply. Sophie reviews profiles, shortlists 3.
6. She schedules interviews with shortlisted consultants via the platform.
7. After interviews, she makes an offer to Ana at EUR 700/day.
8. Ana accepts. The platform generates a service agreement under French law.
9. Lars reviews the contract terms, both parties sign electronically.
10. Engagement begins. Ana submits weekly timesheets, Sophie approves them.
11. Invoices are generated monthly, the company pays via SEPA, Ana receives payment within 3 business days.
12. After 6 months, both parties leave reviews.

### Journey 2: Consultant Finds and Applies to a Mission

1. Ana registers on ConsultConnect via LinkedIn SSO, completes her profile with skills, experience, and daily rate (EUR 700/day).
2. She completes identity verification.
3. She sets up a saved search: "Cloud Architecture, Remote-first, EUR 650+/day, France or Portugal."
4. She receives a notification about Sophie's mission matching her criteria.
5. She reviews the mission details, checks the company profile and reviews from past consultants.
6. She applies with a cover message highlighting relevant experience and her proposed rate.
7. She is shortlisted, does an interview, receives and accepts the offer.
8. She signs the contract, starts the engagement, submits timesheets, and gets paid on time.

---

## 10. Information Architecture

```
Home
+-- For Companies
|   +-- How It Works
|   +-- Pricing
|   +-- Post a Mission
+-- For Consultants
|   +-- How It Works
|   +-- Browse Missions
|   +-- Pricing
+-- Dashboard (authenticated)
|   +-- My Missions (company) / My Applications (consultant)
|   +-- Messages
|   +-- Contracts
|   +-- Timesheets
|   +-- Payments & Invoices
|   +-- Reviews
|   +-- Settings & Profile
+-- Admin Panel
|   +-- KPI Dashboard
|   +-- User Management
|   +-- Mission Moderation
|   +-- Dispute Resolution
|   +-- Taxonomy Management
|   +-- Contract Templates
```

---

## 11. Key Integration Points

| System | Purpose | Priority |
|--------|---------|----------|
| **KYC/Identity verification provider** (e.g., Onfido, Jumio) | Consultant identity verification | Must |
| **Business registry APIs** (e.g., Societe.com, Handelsregister, KVK) | Company verification | Must |
| **Payment processor** (e.g., Stripe Connect, Mangopay) | Escrow, payouts, SEPA, card processing | Must |
| **Electronic signature** (e.g., DocuSign, Yousign) | eIDAS-compliant contract signing | Must |
| **Email delivery** (e.g., Sendgrid, Postmark) | Transactional and notification emails | Must |
| **LinkedIn OAuth** | SSO and profile import for consultants | Should |
| **Calendar integration** (Google Calendar, Outlook) | Interview scheduling | Should |
| **Analytics** (e.g., Mixpanel, Amplitude) | Product usage tracking | Should |

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Cold start problem** (not enough consultants or missions to attract the other side) | High | High | Launch with a geographic focus (France + Germany), seed supply via partnerships with freelance communities, offer free listings for first 3 months |
| **Disintermediation** (parties bypass the platform after first engagement) | High | High | Deliver ongoing value: payment protection, compliance updates, reputation portability. Contractual non-circumvention clause for 12 months |
| **Regulatory complexity** (varying freelance laws across EU countries) | Medium | High | Start with 3 countries (France, Germany, Netherlands), engage local legal counsel, automate compliance checks incrementally |
| **Payment defaults** (companies fail to pay) | Medium | Medium | Escrow model (company pre-funds or direct debit before work starts), credit checks for enterprise accounts |
| **Quality of supply** (unvetted or underqualified consultants) | Medium | Medium | Mandatory identity verification, skill assessments (optional initially), review system, manual curation for featured consultants |
| **Data breach** | Low | High | Security-by-design, penetration testing, SOC 2 Type II certification roadmap, incident response plan |

---

## 13. Success Metrics and KPIs

### Acquisition
- Monthly new consultant registrations
- Monthly new company registrations
- Profile completion rate (target: > 80%)

### Activation
- Percentage of registered consultants who apply to at least one mission within 30 days (target: > 40%)
- Percentage of registered companies who post at least one mission within 30 days (target: > 50%)

### Engagement
- Average applications per mission (target: > 5)
- Median time-to-first-application (target: < 48 hours)
- Shortlist-to-offer conversion rate (target: > 30%)
- Offer acceptance rate (target: > 70%)

### Revenue
- Monthly Gross Merchandise Value
- Monthly platform revenue (commissions + subscriptions)
- Average revenue per mission

### Retention
- Consultant repeat engagement rate (same consultant, new mission within 6 months) (target: > 40%)
- Company repeat posting rate (new mission within 6 months) (target: > 60%)
- Monthly active users (both sides)

### Satisfaction
- NPS (consultant and company, measured quarterly)
- Dispute rate (target: < 2% of engagements)
- Average payment cycle time (target: < 35 days from work performed to consultant paid)

---

## 14. Release Plan

### Phase 1: MVP (Months 1-4)
- Consultant and company registration with verification
- Mission posting and search
- Application workflow (apply, shortlist, reject, offer, accept)
- In-platform messaging
- Contract generation and e-signature (French law only)
- Timesheet submission and approval
- Basic invoicing and SEPA payment
- Ratings and reviews
- Admin dashboard (basic)

### Phase 2: Growth (Months 5-8)
- German and Dutch law contract templates
- Multi-language UI (French, German)
- Saved searches and notifications
- Calendar integration for interviews
- Premium subscriptions (consultant and company)
- Early payment option
- Enhanced admin tools (fraud detection, dispute resolution)

### Phase 3: Scale (Months 9-14)
- Expand to additional EU countries (Spain, Italy, Belgium)
- AI-assisted matching recommendations
- Skill assessments and badges
- Public API for ATS/VMS integration
- Company analytics dashboard (spending, contractor performance)
- Umbrella company (portage salarial) integration

### Phase 4: Expansion (Months 15-18)
- Team/squad composition features
- Statement of Work (SoW) project engagements
- Native mobile applications
- Expanded payment options (multi-currency for non-Euro EU)
- Marketplace insights and benchmarking reports

---

## 15. Open Questions

| # | Question | Owner | Due Date |
|---|----------|-------|----------|
| 1 | Which KYC provider offers the best coverage across target EU countries at acceptable cost? | Engineering | TBD |
| 2 | Should V1 support portage salarial as a contract type, or defer to Phase 3? | Product + Legal | TBD |
| 3 | What is the minimum viable compliance framework for German Scheinselbstaendigkeit rules? | Legal | TBD |
| 4 | Should the platform generate invoices on behalf of consultants, or only facilitate consultant-generated invoices? | Product + Finance | TBD |
| 5 | What is the pricing elasticity -- will 12% commission deter companies vs. traditional staffing agency rates? | Product + Business | TBD |
| 6 | Should the non-circumvention clause be enforced technically (e.g., contact info masking) or only contractually? | Product + Legal | TBD |

---

## 16. Glossary

| Term | Definition |
|------|-----------|
| **Mission** | A time-and-materials consulting engagement posted by a company, specifying required skills, duration, and rate |
| **Consultant** | An independent freelance software professional registered on the platform |
| **Company** | An organization seeking to hire freelance software consultants |
| **GMV (Gross Merchandise Value)** | Total value of all consulting days billed through the platform |
| **Escrow** | Payment held by the platform on behalf of the consultant until timesheet approval triggers release |
| **Portage salarial** | A French employment arrangement where a freelancer is formally employed by an umbrella company while working for a client |
| **Scheinselbstaendigkeit** | German legal concept of "bogus self-employment" where a freelancer is deemed to be a de facto employee |
| **eIDAS** | EU regulation on electronic identification and trust services, governing legal validity of electronic signatures |
| **SEPA** | Single Euro Payments Area -- standardized Euro payment scheme across EU |
| **Disintermediation** | When marketplace participants bypass the platform to transact directly |
