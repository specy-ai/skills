# Loan Origination Context -- Domain Model

## Overview

The **LoanOriginationContext** covers the lifecycle of a business loan application from initial intake by a relationship manager through credit scoring, delegation routing, and final decisioning (approval or rejection). It also includes an auto-approval engine for low-risk applications.

This model is derived from requirements REQ-ORI-001 through REQ-ORI-008, REQ-SCO-001 through REQ-SCO-007, and REQ-AUT-001 through REQ-AUT-004.

---

## Ubiquitous Language

| Term | Definition |
|------|-----------|
| Loan Application | The central aggregate representing a borrower's request for a business loan, progressing from draft to decision. |
| Relationship Manager (RM) | The bank employee who initiates and shepherds the application. |
| Credit Analyst | The specialist who reviews financial ratios and scoring output. |
| Decision Authority | The person or committee empowered to approve or reject, determined by the delegation matrix. |
| Composite Credit Score | A single numeric score synthesizing financial ratios, client history, sector risk, and external bureau data. |
| Delegation Matrix | A configurable mapping of (amount tier x score band) to the appropriate decision authority level. |
| Document Checklist | A product-specific list of required and optional documents that must be gathered before submission. |
| Auto-Approval | An automated decisioning path for low-risk applications that meet configurable score and amount thresholds. |
| Scoring Override | A situation where the human decision contradicts the model recommendation, requiring additional rationale. |

---

## Enumerations

### LoanApplicationStatus
```
DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED
                                   -> REJECTED
```

### LoanProductType
- `amortizing`
- `bullet`
- `revolving`
- `leasing`
- `bridge`

### RateStructure
- `fixed`
- `variable`
- `indexed`

### DecisionType
- `MANUAL` -- a human decision authority decided
- `AUTO` -- the auto-approval engine decided
- `COMMITTEE` -- a credit committee decided

### DecisionOutcome
- `approve`
- `reject`

---

## Value Types

### Money
A monetary amount with currency.

| Field | Type | Constraints |
|-------|------|-------------|
| amount | decimal | min(0) |
| currency | string | maxLength(3), default "EUR" |

### Percentage
| Field | Type | Constraints |
|-------|------|-------------|
| value | decimal | min(0), max(100) |

### DateRange
| Field | Type | Constraints |
|-------|------|-------------|
| startDate | date | |
| endDate | date | |

**Invariant:** `startDate <= endDate`

### FinancialRatio
A named financial ratio with its computed value and source data reference.

| Field | Type | Constraints |
|-------|------|-------------|
| name | string | e.g. "DSCR", "leverage", "liquidity", "profitability" |
| value | decimal | |
| computationMethod | string | describes how the ratio was computed |
| sourceReference | string | optional, reference to source financial statement |

### ChecklistItem
An item on a product-specific document checklist.

| Field | Type | Constraints |
|-------|------|-------------|
| label | string | |
| required | boolean | |
| present | boolean | default false |

### CreditDecision
The recorded outcome of a credit decision. [REQ-SCO-006]

| Field | Type | Constraints |
|-------|------|-------------|
| outcome | DecisionOutcome | |
| decisionType | DecisionType | |
| rationale | string | mandatory |
| conditions | list\<string\> | optional |
| approverIdentity | string | |
| scoringOutputRef | string | reference to the CreditAnalysis |
| decidedAt | datetime | |

### DelegationMatrix
A configurable matrix mapping amount tiers and score bands to decision authorities. [REQ-SCO-004]

| Field | Type | Constraints |
|-------|------|-------------|
| amountTiers | list\<Money\> | |
| scoreBands | list\<string\> | |
| authorities | list\<string\> | |
| rules | list\<string\> | routing rules per tier/band combination |

---

## Entities and Aggregates

### LoanApplication (Aggregate Root)

The core aggregate for loan origination. Tracks an application from draft through to credit decision.

**Satisfies:** REQ-ORI-001 through REQ-ORI-008, REQ-AUT-001, REQ-AUT-004

**Identity:** `id: UUID`

#### Fields

| Field | Type | Constraints |
|-------|------|-------------|
| status | LoanApplicationStatus | default DRAFT |
| productType | LoanProductType | |
| borrowerId | UUID | |
| requestedAmount | Money | |
| duration | int | loan term |
| purpose | string | |
| checklist | list\<ChecklistItem\> | product-specific |
| stateHistory | list\<string\> | audit trail of status transitions |
| estimatedDecisionDate | date | optional, based on pipeline position |
| creditDecision | CreditDecision | optional, set on approval/rejection |
| productConfigurationVersion | int | optional, tracks config version used |
| createdAt | datetime | immutable |
| submittedAt | datetime | optional |
| decidedAt | datetime | optional |

#### References

| Reference | Target | Cardinality |
|-----------|--------|-------------|
| creditAnalysis | CreditAnalysis | 0..1 |

#### Invariants

| Name | Description | Satisfies |
|------|-------------|-----------|
| applicationMustBeComplete | All required checklist items must have `present = true` and all mandatory fields must be non-null before submission is allowed. | REQ-ORI-004, REQ-ORI-006 |
| noAutoRejection | If `creditDecision.decisionType = AUTO` then `creditDecision.outcome` must be `approve`. The system shall never reject automatically. | REQ-AUT-004 |

#### Policies

| Name | Description | Satisfies |
|------|-------------|-----------|
| fieldValidationRules | Validate fields in real time as they are entered or modified on a draft application. | REQ-ORI-005 |
| autoApprovalEligibilityCriteria | Application must meet score threshold and amount ceiling from the AutoApprovalConfiguration for the product/branch. | REQ-AUT-001 |

#### Commands and Operations

**Create application** (command: `CreateLoanApplication`) [REQ-ORI-001]
- Pre-condition: RM selects a loan product
- Creates a new LoanApplication with status = DRAFT
- Loads the product-specific document checklist
- Emits: `LoanApplicationCreated`

**Load product checklist** (command: `LoadProductChecklist`) [REQ-ORI-002]
- Resolves the ProductConfiguration for the selected product
- Sets the checklist on the application from the product configuration

**Change product type** (command: `ChangeProductType`) [REQ-ORI-003]
- Pre-condition: application is in DRAFT status
- Updates the productType and recalculates the checklist
- Emits: `ProductTypeChanged`

**Validate field** (command: `ValidateField`) [REQ-ORI-005]
- Enforces fieldValidationRules policy
- Returns inline validation errors immediately

**Submit application** (command: `SubmitLoanApplication`) [REQ-ORI-006]
- Pre-condition: application is in DRAFT status
- Guard: `applicationMustBeComplete` invariant -- rejects submission if missing required items (emits `ApplicationSubmissionRejected` on failure) [REQ-ORI-004]
- Transitions status from DRAFT to SUBMITTED
- Triggers: AML screening (ComplianceContext), exposure limit check, credit scoring initiation
- Emits: `LoanApplicationSubmitted`

**Get application status** (query: `GetApplicationStatus`) [REQ-ORI-007]
- Read-only query returning current status, state history, and estimated decision date

**Record credit decision** (command: `DecideLoanApplication`) [REQ-SCO-006]
- Pre-condition: application is in UNDER_REVIEW status
- Sets the creditDecision, transitions status to APPROVED or REJECTED
- Emits: `LoanApplicationApproved` or `LoanApplicationRejected`

**Auto-approve** (command: `AutoApproveLoanApplication`) [REQ-AUT-001]
- Guard: `autoApprovalEligibilityCriteria` policy (score >= threshold, amount <= ceiling)
- Guard: `noAutoRejection` invariant -- can only approve, never reject
- Must complete within 60 seconds of submission
- Sets creditDecision with decisionType = AUTO, transitions status to APPROVED
- Emits: `LoanApplicationApproved` (with decisionType = AUTO)

---

### CreditAnalysis (Entity)

Encapsulates scoring, financial ratio computation, and delegation routing for an application.

**Satisfies:** REQ-SCO-001 through REQ-SCO-005, REQ-SCO-007

**Identity:** `id: UUID`

#### Fields

| Field | Type | Constraints |
|-------|------|-------------|
| applicationId | UUID | foreign key to LoanApplication |
| financialRatios | list\<FinancialRatio\> | DSCR, leverage, liquidity, profitability |
| compositeScore | decimal | optional, computed from multiple risk dimensions |
| scoreBreakdown | list\<string\> | optional, per-dimension breakdown |
| delegationLevel | string | optional, the resolved decision authority level |
| overrides | list\<string\> | optional, log of overrides applied |
| computedAt | datetime | optional |

#### Invariants

| Name | Description | Satisfies |
|------|-------------|-----------|
| overrideMustHaveJustification | Every financial ratio override must include the original value, new value, analyst identity, and a written justification. | REQ-SCO-003 |
| scoringOverrideMustHaveRationale | When a decision contradicts the scoring recommendation, additional rationale text is mandatory. | REQ-SCO-007 |

#### Commands and Operations

**Compute financial ratios** (command: `ComputeFinancialRatios`) [REQ-SCO-001]
- Triggered when financial statements are uploaded to a submitted application
- Computes DSCR, leverage ratio, liquidity ratio, profitability ratios
- Emits: `FinancialRatiosComputed`

**Compute credit score** (command: `ComputeCreditScore`) [REQ-SCO-002]
- Triggered on application submission
- Synthesizes financial ratios, client history, sector risk, and external bureau data into a composite score
- Records score with full breakdown
- Emits: `CreditScoreComputed`

**Override financial ratio** (command: `OverrideFinancialRatio`) [REQ-SCO-003]
- Guard: `overrideMustHaveJustification` invariant
- Records: original value, new value, analyst identity, justification
- Emits: `FinancialRatioOverridden`

**Route to decision authority** (command: `RouteToDecisionAuthority`) [REQ-SCO-004]
- Triggered when credit score is computed
- Consults the DelegationMatrix (amount tier x score band) to determine the authority level
- Emits: `ApplicationRouted`

**Override delegation routing** (command: `OverrideDelegationRouting`) [REQ-SCO-005]
- Guard: `routingOverrideRequiresHigherAuthority` -- approver must be one level above the target level
- Records the override with justification
- Emits: `DelegationRoutingOverridden`

**Record scoring override** (reactive, triggered by `ScoringOverrideDetected`) [REQ-SCO-007]
- Guard: `scoringOverrideMustHaveRationale`
- Flags the decision as a scoring override
- Emits: `ScoringOverrideRecorded`

---

### ProductConfiguration (Entity)

Defines a loan product type with all its parameters, including the document checklist.

**Satisfies:** REQ-ORI-002, REQ-AUT-002

**Identity:** `id: UUID`

#### Fields

| Field | Type | Constraints |
|-------|------|-------------|
| name | string | |
| productType | LoanProductType | |
| rateStructure | RateStructure | |
| checklist | list\<ChecklistItem\> | product-specific required/optional docs |
| feeSchedule | list\<string\> | |
| collateralRequirements | list\<string\> | optional |
| eligibilityCriteria | list\<string\> | optional |
| version | int | default 1 |
| active | boolean | default false |
| activatedAt | datetime | optional |
| createdAt | datetime | immutable |

---

### AutoApprovalConfiguration (Entity)

Configures auto-approval criteria per product type and per branch.

**Satisfies:** REQ-AUT-001, REQ-AUT-002, REQ-AUT-003

**Identity:** `id: UUID`

#### Fields

| Field | Type | Constraints |
|-------|------|-------------|
| productType | LoanProductType | |
| branchId | string | optional, for branch-level scoping |
| scoreThreshold | decimal | minimum composite score for auto-approval |
| amountCeiling | Money | maximum requested amount for auto-approval |
| enabled | boolean | default true |
| disabledAt | datetime | optional |

#### Commands

**Disable auto-approval** (command: `DisableAutoApproval`) [REQ-AUT-003]
- When an administrator disables auto-approval for a product/branch, all new applications in that scope are routed to manual review
- Emits: `AutoApprovalDisabled`

---

## Domain Services

### ExternalBureauService
Adapter to external credit bureau for retrieving scoring data. [REQ-SCO-002]

| Operation | Description |
|-----------|-------------|
| fetchBureauData(borrowerId) | Retrieve external bureau scoring data for a borrower |

### NotificationService
Sends notifications to borrowers and relationship managers on status changes. [REQ-ORI-008]

| Operation | Description |
|-----------|-------------|
| sendStatusNotification(applicationId, recipientId, status) | Notify borrower/RM on application status change |

---

## Domain Events

| Event | Trigger | Key Payload | Satisfies |
|-------|---------|-------------|-----------|
| LoanApplicationCreated | CreateLoanApplication | applicationId, productType, borrowerId, requestedAmount | REQ-ORI-001 |
| ProductTypeChanged | ChangeProductType | applicationId, oldProductType, newProductType | REQ-ORI-003 |
| ApplicationSubmissionRejected | SubmitLoanApplication (failure) | applicationId, missingItems | REQ-ORI-004 |
| LoanApplicationSubmitted | SubmitLoanApplication | applicationId, borrowerId, productType, requestedAmount, submittedAt | REQ-ORI-006 |
| LoanApplicationApproved | DecideLoanApplication / AutoApproveLoanApplication | applicationId, decisionType, conditions, rationale, approverIdentity | REQ-SCO-006, REQ-AUT-001 |
| LoanApplicationRejected | DecideLoanApplication | applicationId, rationale, approverIdentity | REQ-SCO-006 |
| FinancialRatiosComputed | ComputeFinancialRatios | analysisId, applicationId, ratios | REQ-SCO-001 |
| CreditScoreComputed | ComputeCreditScore | analysisId, applicationId, compositeScore, scoreBreakdown | REQ-SCO-002 |
| FinancialRatioOverridden | OverrideFinancialRatio | analysisId, ratioName, originalValue, newValue, analystIdentity, justification | REQ-SCO-003 |
| ApplicationRouted | RouteToDecisionAuthority | analysisId, applicationId, delegationLevel | REQ-SCO-004 |
| DelegationRoutingOverridden | OverrideDelegationRouting | analysisId, originalLevel, newLevel, approverIdentity, justification | REQ-SCO-005 |
| ScoringOverrideRecorded | ScoringOverrideDetected | analysisId, recommendedOutcome, actualOutcome, additionalRationale | REQ-SCO-007 |
| AutoApprovalDisabled | DisableAutoApproval | configId, productType, branchId | REQ-AUT-003 |

---

## State Machine: LoanApplication

```
                          +------------------+
                          |      DRAFT       |
                          +------------------+
                                  |
                     SubmitLoanApplication
                  (guard: applicationMustBeComplete)
                                  |
                                  v
                          +------------------+
                          |    SUBMITTED     |
                          +------------------+
                           /              \
         [auto-approval          [manual path]
          eligible]                    |
              |                        v
              |               +------------------+
              |               |  UNDER_REVIEW    |
              |               +------------------+
              |                /              \
              v               v                v
      +------------------+              +------------------+
      |    APPROVED      |              |    REJECTED      |
      +------------------+              +------------------+
```

### Transitions

| From | To | Trigger | Guard / Policy |
|------|----|---------|----------------|
| DRAFT | SUBMITTED | SubmitLoanApplication | applicationMustBeComplete |
| SUBMITTED | APPROVED | AutoApproveLoanApplication | autoApprovalEligibilityCriteria, noAutoRejection |
| SUBMITTED | UNDER_REVIEW | (routing to decision authority) | -- |
| UNDER_REVIEW | APPROVED | DecideLoanApplication (outcome=approve) | -- |
| UNDER_REVIEW | REJECTED | DecideLoanApplication (outcome=reject) | must be human decision (noAutoRejection) |

---

## Invariants Summary

| Invariant | Scope | Rule | Satisfies |
|-----------|-------|------|-----------|
| applicationMustBeComplete | LoanApplication | All required checklist items present and all mandatory fields non-null before submission | REQ-ORI-004, REQ-ORI-006 |
| noAutoRejection | LoanApplication | If decisionType = AUTO then outcome must be approve | REQ-AUT-004 |
| overrideMustHaveJustification | CreditAnalysis | Every ratio override must include written justification | REQ-SCO-003 |
| scoringOverrideMustHaveRationale | CreditAnalysis | Scoring override decisions must carry additional rationale | REQ-SCO-007 |
| routingOverrideRequiresHigherAuthority | CreditAnalysis | Override of routing level requires approval from one level above | REQ-SCO-005 |

---

## Cross-Context Integration Points

| Integration | Target Context | Mechanism | Trigger |
|-------------|---------------|-----------|---------|
| AML/CFT screening | ComplianceContext | Command/async | LoanApplicationSubmitted |
| Exposure limit check | CreditRiskContext | Query | On submission |
| External bureau data | External system | Service adapter (ExternalBureauService) | ComputeCreditScore |
| Borrower/RM notification | (infrastructure) | NotificationService | Status transitions to SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED |
