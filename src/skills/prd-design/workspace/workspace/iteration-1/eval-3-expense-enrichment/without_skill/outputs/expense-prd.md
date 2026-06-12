# Product Requirement Document: Employee Expense Management Tool

| Field             | Value                              |
|-------------------|------------------------------------|
| **Product Name**  | ExpenseFlow                        |
| **Version**       | 1.0                                |
| **Author**        | Product Management                 |
| **Date**          | 2026-03-26                         |
| **Status**        | Draft                              |
| **Classification**| Internal Tool                      |

---

## 1. Purpose and Vision

### 1.1 Problem Statement

The current expense reimbursement process is manual, slow, and error-prone. Employees submit paper or email-based expense reports, managers lack visibility into pending approvals, and finance teams spend excessive time on data entry and reconciliation. The average reimbursement cycle is **3 weeks**, creating employee dissatisfaction and cash flow uncertainty.

### 1.2 Product Vision

Deliver an internal, mobile-first expense management tool that digitizes the full lifecycle of employee expenses -- from receipt capture through reimbursement -- while enforcing corporate policy and French regulatory compliance automatically.

### 1.3 Success Criteria

| Metric                          | Current State | Target         |
|---------------------------------|---------------|----------------|
| Average reimbursement time      | 3 weeks       | **5 business days** |
| Manual data entry by finance    | ~100%         | < 10%          |
| Policy violation rate at submission | Unknown   | < 5%           |
| Employee adoption (mobile)      | N/A           | > 80% within 6 months |

---

## 2. Stakeholders and Users

### 2.1 User Personas

| Persona           | Role                  | Key Needs                                                      |
|--------------------|-----------------------|----------------------------------------------------------------|
| **Employee**       | Expense submitter     | Quick receipt capture, transparent status tracking, fast reimbursement |
| **Manager**        | Approver (Level 1)    | Clear overview of pending expenses, one-tap approve/reject, delegation |
| **VP / Director**  | Approver (Level 2)    | Approve high-value expenses (> 500 EUR), dashboard visibility   |
| **Finance Team**   | Processor             | Batch processing, SAP integration, audit trail, reporting       |
| **Compliance**     | Auditor               | Regulatory adherence, exportable logs, policy enforcement        |

### 2.2 Internal Stakeholders

- **IT / Infrastructure**: Deployment, SSO integration, security review
- **Legal / Tax**: French tax rule validation, data retention policies
- **HR**: Policy definition, communication to employees

---

## 3. Scope

### 3.1 In Scope (v1.0)

- Expense submission with receipt upload (photo and file)
- OCR-based receipt data extraction
- Multi-level approval workflow
- SAP accounting integration
- Mobile application (iOS and Android)
- French regulatory compliance engine
- Reporting and analytics dashboard
- Notification system (push, email)

### 3.2 Out of Scope (v1.0)

- Corporate credit card auto-import
- Travel booking integration
- Multi-currency with live exchange rates (EUR only for v1)
- Per-diem automation for international travel
- Integration with HR systems beyond SAP

---

## 4. Functional Requirements

### 4.1 Expense Submission

| ID       | Requirement                                                                 | Priority |
|----------|-----------------------------------------------------------------------------|----------|
| FR-SUB-01 | Employees shall create expense reports containing one or more expense line items. | Must     |
| FR-SUB-02 | Each line item shall include: date, amount, category, description, and at least one receipt attachment. | Must     |
| FR-SUB-03 | The system shall support receipt capture via mobile camera with automatic cropping and enhancement. | Must     |
| FR-SUB-04 | The system shall support file upload (JPEG, PNG, PDF) up to 10 MB per receipt. | Must     |
| FR-SUB-05 | Employees shall be able to save expense reports as drafts before submission. | Should   |
| FR-SUB-06 | The system shall allow expense duplication for recurring expenses.           | Could    |

### 4.2 OCR and Data Extraction

| ID       | Requirement                                                                 | Priority |
|----------|-----------------------------------------------------------------------------|----------|
| FR-OCR-01 | The system shall extract vendor name, date, total amount, and VAT from receipt images using OCR. | Must     |
| FR-OCR-02 | Extracted fields shall be pre-populated in the expense form for employee review and correction. | Must     |
| FR-OCR-03 | The OCR engine shall support French and English receipts at minimum.        | Must     |
| FR-OCR-04 | OCR accuracy shall be >= 90% on printed receipts for amount and date fields. | Must     |
| FR-OCR-05 | The system shall flag low-confidence extractions for manual review.          | Should   |

### 4.3 Approval Workflow

| ID       | Requirement                                                                 | Priority |
|----------|-----------------------------------------------------------------------------|----------|
| FR-APR-01 | Submitted expenses shall be routed to the employee's direct manager for approval. | Must     |
| FR-APR-02 | Any single expense line item exceeding **500 EUR** shall require additional VP-level approval after manager approval. | Must     |
| FR-APR-03 | Approvers shall be able to approve, reject, or return an expense with comments. | Must     |
| FR-APR-04 | Returned expenses shall go back to the employee for correction and re-submission. | Must     |
| FR-APR-05 | Managers shall be able to delegate approval authority to a substitute during absence. | Should   |
| FR-APR-06 | The system shall auto-escalate expenses not acted upon within 48 hours, with a reminder notification sent to the approver. | Should   |
| FR-APR-07 | Bulk approval shall be supported for managers with high volumes.             | Should   |

### 4.4 Policy and Compliance Engine

| ID       | Requirement                                                                 | Priority |
|----------|-----------------------------------------------------------------------------|----------|
| FR-POL-01 | The system shall enforce the French tax-deductible meal allowance cap of **19.40 EUR** per meal. | Must     |
| FR-POL-02 | Expenses exceeding policy limits shall be flagged at submission time with a clear warning. | Must     |
| FR-POL-03 | The system shall prevent submission of duplicate expenses (same date, amount, vendor). | Must     |
| FR-POL-04 | Expense categories shall be configurable by the finance team (e.g., meals, transport, accommodation, office supplies). | Must     |
| FR-POL-05 | The system shall enforce a maximum submission window of 60 days from expense date. | Should   |
| FR-POL-06 | Policy rules shall be configurable without code changes via an admin interface. | Should   |

### 4.5 Reimbursement Processing

| ID       | Requirement                                                                 | Priority |
|----------|-----------------------------------------------------------------------------|----------|
| FR-REM-01 | Approved expenses shall be queued for finance team processing.              | Must     |
| FR-REM-02 | Finance shall be able to batch-process reimbursements and export payment files. | Must     |
| FR-REM-03 | The system shall record reimbursement date and payment reference for each expense report. | Must     |
| FR-REM-04 | Employees shall be notified when reimbursement is processed.                | Must     |

### 4.6 SAP Integration

| ID       | Requirement                                                                 | Priority |
|----------|-----------------------------------------------------------------------------|----------|
| FR-SAP-01 | Approved and processed expenses shall be posted to SAP FI (Financial Accounting) as journal entries. | Must     |
| FR-SAP-02 | The integration shall map expense categories to SAP cost centers and GL accounts. | Must     |
| FR-SAP-03 | SAP posting status (success/failure) shall be visible in the finance dashboard. | Must     |
| FR-SAP-04 | Failed SAP postings shall be retried automatically up to 3 times, then flagged for manual intervention. | Should   |

### 4.7 Reporting and Analytics

| ID       | Requirement                                                                 | Priority |
|----------|-----------------------------------------------------------------------------|----------|
| FR-RPT-01 | Finance shall have access to a dashboard showing: total expenses by period, by category, by department, and by status. | Must     |
| FR-RPT-02 | Managers shall see aggregate spend for their team.                          | Must     |
| FR-RPT-03 | Employees shall see their personal expense history and reimbursement status. | Must     |
| FR-RPT-04 | The system shall support CSV and PDF export of reports.                     | Should   |
| FR-RPT-05 | Average reimbursement time shall be tracked and displayed on the finance dashboard. | Must     |

### 4.8 Notifications

| ID       | Requirement                                                                 | Priority |
|----------|-----------------------------------------------------------------------------|----------|
| FR-NOT-01 | Managers shall receive push and email notifications for new pending approvals. | Must     |
| FR-NOT-02 | Employees shall receive notifications on approval, rejection, return, and reimbursement events. | Must     |
| FR-NOT-03 | Notification preferences shall be configurable per user.                    | Could    |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID       | Requirement                                                                 |
|----------|-----------------------------------------------------------------------------|
| NFR-PRF-01 | OCR processing shall complete within 5 seconds per receipt.               |
| NFR-PRF-02 | Page load time shall be under 2 seconds on 4G mobile networks.            |
| NFR-PRF-03 | The system shall support up to 5,000 concurrent users.                    |

### 5.2 Availability and Reliability

| ID       | Requirement                                                                 |
|----------|-----------------------------------------------------------------------------|
| NFR-AVL-01 | The system shall target 99.5% uptime during business hours (Mon-Fri, 07:00-21:00 CET). |
| NFR-AVL-02 | Scheduled maintenance windows shall be outside business hours with 48h notice. |

### 5.3 Security

| ID       | Requirement                                                                 |
|----------|-----------------------------------------------------------------------------|
| NFR-SEC-01 | Authentication shall use corporate SSO (SAML 2.0 or OIDC).               |
| NFR-SEC-02 | All data in transit shall be encrypted with TLS 1.2+.                     |
| NFR-SEC-03 | Receipt images and personal data shall be encrypted at rest.              |
| NFR-SEC-04 | Role-based access control shall enforce separation between employee, manager, finance, and admin roles. |
| NFR-SEC-05 | All actions shall be logged in an immutable audit trail.                   |

### 5.4 Data Retention and Privacy

| ID       | Requirement                                                                 |
|----------|-----------------------------------------------------------------------------|
| NFR-DAT-01 | Expense records and receipts shall be retained for a minimum of 10 years per French accounting regulations. |
| NFR-DAT-02 | The system shall comply with GDPR requirements for personal data handling. |
| NFR-DAT-03 | Users shall be able to export their personal expense data upon request.    |

### 5.5 Accessibility and Localization

| ID       | Requirement                                                                 |
|----------|-----------------------------------------------------------------------------|
| NFR-ACC-01 | The web application shall meet WCAG 2.1 AA compliance.                    |
| NFR-LOC-01 | The UI shall support French and English.                                  |

### 5.6 Mobile

| ID       | Requirement                                                                 |
|----------|-----------------------------------------------------------------------------|
| NFR-MOB-01 | A native or high-quality hybrid mobile app shall be provided for iOS (15+) and Android (12+). |
| NFR-MOB-02 | Core features (receipt capture, submission, status tracking) shall work offline with sync on reconnect. |

---

## 6. Approval Workflow Diagram

```
                         +------------------+
                         |  Employee creates |
                         |  expense report   |
                         +--------+---------+
                                  |
                                  v
                        +-------------------+
                        | Policy validation |
                        | (auto-check)      |
                        +--------+----------+
                                 |
                      +----------+-----------+
                      |                      |
                 [Violation]            [Pass]
                      |                      |
                      v                      v
              +---------------+    +-------------------+
              | Return to     |    | Route to Manager  |
              | employee with |    | for approval      |
              | warning       |    +--------+----------+
              +---------------+             |
                                 +----------+-----------+
                                 |          |           |
                            [Approve]  [Reject]   [Return]
                                 |          |           |
                                 v          v           v
                       +----------------+ +-----+ +----------+
                       | Any item       | | End | | Employee |
                       | > 500 EUR?     | +-----+ | corrects |
                       +-------+--------+          +----------+
                               |
                    +----------+-----------+
                    |                      |
                  [Yes]                  [No]
                    |                      |
                    v                      v
           +----------------+    +-------------------+
           | Route to VP    |    | Send to Finance   |
           | for approval   |    | for processing    |
           +-------+--------+    +--------+----------+
                   |                       |
            +------+------+                v
            |             |       +-------------------+
       [Approve]     [Reject]     | Post to SAP       |
            |             |       +--------+----------+
            v             v                |
   +--------------+  +-------+             v
   | Send to      |  | End   |    +-------------------+
   | Finance      |  +-------+    | Reimbursement     |
   +--------------+               | processed         |
                                  +-------------------+
```

---

## 7. Expense Categories

The following categories shall be available at launch. Finance administrators may add, modify, or deactivate categories.

| Category             | Policy Cap           | Notes                                    |
|----------------------|----------------------|------------------------------------------|
| Meals - Individual   | 19.40 EUR / meal     | French URSSAF limit                      |
| Meals - Business     | No fixed cap         | Requires attendee list and business justification |
| Transport - Taxi     | No fixed cap         | Receipt required                         |
| Transport - Public   | No fixed cap         | Ticket or pass required                  |
| Transport - Mileage  | 0.603 EUR/km (7 CV)  | French fiscal scale, vehicle power-based |
| Accommodation        | No fixed cap         | Receipt required, pre-approval recommended |
| Office Supplies      | 100 EUR / item       | Manager approval sufficient              |
| Professional Development | No fixed cap     | Pre-approval required                    |
| Other                | No fixed cap         | Requires justification                   |

---

## 8. Integration Architecture

```
+----------------+        +---------------------+       +-----------+
|  Mobile App    | -----> |                     | ----> |  SAP FI   |
|  (iOS/Android) |        |   ExpenseFlow       |       | (Accounting|
+----------------+        |   Backend           |       |  System)  |
                          |                     |       +-----------+
+----------------+        |  - REST API         |
|  Web App       | -----> |  - Workflow Engine  |       +-----------+
|  (Browser)     |        |  - Policy Engine    | ----> |  OCR      |
+----------------+        |  - Notification Svc |       |  Service  |
                          |                     |       +-----------+
+----------------+        |                     |
|  Corporate SSO | -----> |                     |       +-----------+
|  (IdP)         |        +---------------------+ ----> |  Email /  |
+----------------+                                      |  Push Svc |
                                                        +-----------+
```

### 8.1 SAP Integration Details

- **Protocol**: SAP RFC or OData API (to be confirmed with IT during technical design)
- **Data flow**: One-way from ExpenseFlow to SAP (expense postings)
- **Mapping**: Each expense category maps to a GL account; employee cost center pulled from SAP HR master data
- **Frequency**: Near real-time posting upon finance approval, with batch fallback for failures

### 8.2 OCR Service

- **Options to evaluate**: Google Cloud Vision, AWS Textract, Microsoft Azure Form Recognizer, or on-premise alternative
- **Requirements**: Must handle French receipt formats, VAT breakdown, and handwritten annotations (best-effort)

---

## 9. Data Model (Key Entities)

| Entity            | Key Attributes                                                                 |
|-------------------|-------------------------------------------------------------------------------|
| **Employee**      | ID, name, email, department, cost center, manager ID, VP ID                   |
| **Expense Report**| ID, employee ID, submission date, status, total amount, currency               |
| **Expense Item**  | ID, report ID, date, category, amount, VAT amount, description, vendor        |
| **Receipt**       | ID, item ID, file path, OCR raw data, OCR confidence score                    |
| **Approval**      | ID, report ID, approver ID, level, decision, comment, timestamp               |
| **Reimbursement** | ID, report ID, payment date, payment reference, SAP document number           |
| **Policy Rule**   | ID, category, rule type, threshold value, effective date, active flag         |
| **Audit Log**     | ID, user ID, action, entity type, entity ID, timestamp, details              |

---

## 10. User Experience Guidelines

### 10.1 Submission Flow (Mobile)

1. Employee taps "New Expense"
2. Points camera at receipt -- OCR extracts data automatically
3. Reviews and corrects pre-filled fields (vendor, date, amount, category)
4. Adds optional notes
5. Repeats for additional items or submits the report
6. Receives confirmation with estimated reimbursement date

**Design principle**: The most common path (single receipt, standard category) should be completable in under 60 seconds.

### 10.2 Approval Flow (Mobile and Web)

1. Manager receives push notification for new pending approval
2. Opens approval queue showing summary cards (employee name, total, date range)
3. Taps into report to see line items with receipt thumbnails
4. Swipe or tap to approve/reject individual items or the full report
5. Adds optional comment on rejection or return

---

## 11. Risks and Mitigations

| Risk                                           | Likelihood | Impact | Mitigation                                                    |
|------------------------------------------------|------------|--------|---------------------------------------------------------------|
| OCR accuracy below target on handwritten receipts | Medium   | Medium | Fallback to manual entry; iterative model training            |
| SAP integration delays due to IT dependencies  | High       | High   | Start SAP technical discovery in sprint 1; define fallback CSV export |
| Low mobile adoption                            | Medium     | Medium | Mandatory mobile onboarding session; incentivize early adopters |
| French tax rule changes                        | Low        | Medium | Configurable policy engine; subscribe to URSSAF updates       |
| Data breach of receipt images                  | Low        | High   | Encryption at rest, access controls, penetration testing      |

---

## 12. Release Plan

### Phase 1 -- MVP (Target: 12 weeks)
- Expense submission with OCR
- Single-level manager approval
- Basic policy enforcement (meal cap, 500 EUR VP threshold)
- Web application
- Email notifications

### Phase 2 -- Full Launch (Target: 20 weeks)
- Mobile app (iOS and Android)
- SAP integration (live posting)
- VP approval workflow
- Push notifications
- Finance dashboard and reporting
- Offline mode for mobile

### Phase 3 -- Optimization (Target: 28 weeks)
- Advanced analytics and spend insights
- Delegation and auto-escalation
- Configurable policy admin interface
- Mileage calculation with map integration
- Bulk approval enhancements

---

## 13. Open Questions

| # | Question                                                                                  | Owner        | Due Date   |
|---|-------------------------------------------------------------------------------------------|--------------|------------|
| 1 | Which SAP modules and versions are in use? RFC vs OData preference?                       | IT           | TBD        |
| 2 | Should the mobile app be native (Swift/Kotlin) or cross-platform (Flutter/React Native)?  | Engineering  | TBD        |
| 3 | Is an on-premise OCR solution required for data sovereignty, or is cloud acceptable?       | Security/Legal | TBD      |
| 4 | What is the current org hierarchy data source for routing approvals?                       | HR / IT      | TBD        |
| 5 | Are there additional country-specific regulations beyond France to plan for?               | Legal        | TBD        |
| 6 | What is the target budget for the project?                                                | Product / Finance | TBD   |

---

## 14. Glossary

| Term        | Definition                                                                      |
|-------------|---------------------------------------------------------------------------------|
| **URSSAF**  | Union de Recouvrement des cotisations de Securite Sociale et d'Allocations Familiales -- the French social security contributions collection agency that sets meal allowance limits. |
| **SAP FI**  | SAP Financial Accounting module used for general ledger, accounts payable/receivable. |
| **GL Account** | General Ledger account -- the accounting code to which an expense is posted.  |
| **OCR**     | Optical Character Recognition -- technology to extract text from images.         |
| **Cost Center** | An organizational unit in SAP to which costs are allocated for tracking purposes. |
| **SSO**     | Single Sign-On -- allows users to authenticate once and access multiple systems. |
| **WCAG**    | Web Content Accessibility Guidelines -- international standard for web accessibility. |
