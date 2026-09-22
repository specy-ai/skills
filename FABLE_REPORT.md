# Metamodel Analysis Report

Analysis of the three metamodels in `src/metamodels/` — `DOMAIN-METAMODEL.md`,
`SYSTEM-REQ-METAMODEL.md`, `PRODUCT-REQ-METAMODEL.md` — covering internal
contradictions, holes in reasoning, blindspots, and improvement opportunities.
Findings are grouped per file, then cross-cutting. Each finding carries a severity:
**critical** (contradiction or broken reference an agent cannot resolve),
**high** (hole that will produce divergent or unrepresentable models),
**medium** (ambiguity or missing capability), **low** (polish).

---

## 1. DOMAIN-METAMODEL.md

### 1.1 CRITICAL — The satisfaction-role vocabulary is a dangling reference

The traceability table (§ "Traceability by concept type", lines 654–664) maps domain
concepts to "typical satisfaction roles… **as defined in SYSTEM-REQ-METAMODEL.md**":
`structured-by`, `enforced-by`, `implemented-by`, `detected-by`, `reconciled-by`,
`quality-constrained-by`, `satisfied-by-infrastructure`.

**SYSTEM-REQ-METAMODEL.md defines none of these.** The words appear nowhere in that
file. Worse, they *cannot* be recorded anywhere: `satisfies` is defined (line 646) as
"a list of requirement identifiers… a string match — no structural link, just the
identifier." A flat ID list has no slot for a role. So the role vocabulary is
(a) defined nowhere, and (b) unrepresentable in the very attribute it is supposed to
qualify.

**Fix**: either define the role taxonomy in SYSTEM-REQ-METAMODEL.md and extend
`satisfies` entries to optional `(id, role)` pairs, or delete the role column and keep
the table as a plain "which concept typically satisfies which kind of requirement"
guide.

### 1.2 CRITICAL — Base Event relations contradict three of the four event subtypes

Event declares (lines 386–388):

- `1..1 "raised by" relation with operation`

But:
- **External events** originate in an upstream BC — there is no local operation.
- **Temporal events** are "asynchronous from clock" (the differentiator table says so
  explicitly) — no operation raises them.
- The Temporal Event section even asserts "It inherits **all** event properties"
  (line 415), which makes the contradiction formal, not incidental.

An agent generating a `.domain` model must either violate the base relation or invent
a phantom operation. **Fix**: move `raised by operation` down to Internal Event and
Error Event; the base Event should only carry the causality/correlation attributes.

### 1.3 CRITICAL — Requirement-set / organization scoping contradiction (shared with § 2.2)

The Convention (line 80) says `requirements-source` is declared "on the organization
or bounded context", and cross-cutting NFRs scope to the organization — yet the
SYSTEM-REQ side pins every requirement set to exactly one bounded context. See § 2.2;
the two files must be reconciled together.

### 1.4 HIGH — External events bypass the Reaction construct, losing guards

The event-handling model is asymmetric with no stated rationale:

| Event type | Handled via |
|---|---|
| Internal | Reaction (has trigger + **guard** + effect) |
| Error | Reaction |
| Temporal | Reaction |
| External | **directly triggers commands** (`1..n "triggers" relation with commands`, line 402) |

Consequences:
1. External-event handling has **no guard** — there is no way to express "when
   `PaymentSettled` arrives, issue `ReleaseOrder` *only if* the order is still held."
   For internal events this is exactly what Reaction's guard is for.
2. The cardinality is `1..n`, i.e. **every consumed external event MUST trigger at
   least one command**. Events consumed only to refresh a read-model projection (see
   1.5) or consumed conditionally cannot be modeled.
3. Reaction's own relations (line 574) say "triggered by… internal events (or error
   events)" — contradicting the Temporal Event section, which says temporal events
   trigger reactions (lines 471, 477). Reaction's trigger relation must list temporal
   events too.

**Fix**: let Reaction be the uniform consumer of all event types (internal, error,
temporal, external), and relax External Event to `0..n triggers`. This also gives
external-event handling a guard for free.

### 1.5 HIGH — Read-only entity projections are unrepresentable

Read-only Entity (line 305) forbids local operations ("the entity is structural, not
behavioural") and its repository has "no `store`, no `delete`, no `update`" (line 314).
Yet the **asynchronous projection** sync pattern (line 312) requires *something* to
update the local read-model when upstream events arrive.

Trace the metamodel's own machinery: external event → triggers command → command
"triggers `1..1` relation with **operation**" → operations are owned by entities or
domain services → the read-only entity owns none, and its repository cannot `store`.
Every path to updating the projection is closed off by the metamodel's own rules.

**Fix**: state explicitly that projection maintenance is an infrastructure-layer
concern outside the domain rules (and exempt the projection writer from the "no store"
rule), or introduce a lightweight `projection` construct that pairs an upstream event
with a read-model update. Note also: `read-only entity` and `synced via` have **zero
support in `src/grammars/domain.ebnf`** — this whole section is metamodel-only,
which belongs in `proposals/grammar-gaps-backlog.md`.

### 1.6 HIGH — Operation ownership is stated as exclusive but violated twice in the same file

Line 249: operations have "1..1 'owned by' relation with entity **or domain service**
(mutually exclusive — an operation has exactly one owner)". But:

- **Value types** "ha[ve]… operations. Operations on a value return a new value"
  (line 486, 493).
- **Repositories** "provide" operations (`store`, `getById`, …) (line 350).

Either value-type and repository operations are a different (undeclared) concept, or
the ownership rule is wrong. An extraction agent hitting a `Money.add()` method has no
rule telling it what to produce. **Fix**: broaden ownership to
entity | domain service | value type | repository, or explicitly name value-type
operations something else (e.g. "value functions") with their own definition.

### 1.7 HIGH — Commands cannot reach domain services

Command: "1..1 'targets' relation with **entity or aggregate**… 1..1 'triggers'
relation with operation (the **entity operation** that handles this command)"
(lines 363–364). But the Domain Service section's own canonical example — a transfer
between two bank accounts (line 518) — is precisely a use case where the inbound
intention targets *no single entity*. `TransferMoney` cannot be a valid Command under
these relations. **Fix**: allow a command to trigger an entity operation *or a domain
service operation*, making `targets` optional (derivable from the operation's owner).

### 1.8 HIGH — Two unrelated "interface" concepts, and no home for commands/queries

- The **Interface** construct (line 230) exposes *operations* from entities/domain
  services within a *module*.
- The **"Software System's Interface"** section (line 677) describes the system's
  message surface: commands, queries, events.

These never reference each other, yet share a name. And no construct connects them:
Interface exposes only operations — not commands, not queries — so the inbound message
surface described at the end of the file has no structural anchor anywhere in the
model. Related hole: **Command, Query, and Event declare no `belongs to` relation with
a module** (every other first-class concept does), so the containment hierarchy is
broken exactly for the message types.

**Fix**: give commands/queries/events module membership, and either rename one of the
two interface concepts or make the module Interface the place where the system's
inbound commands/queries are declared (which is how most hexagonal designs read).

### 1.9 MEDIUM — Command/Operation event-cardinality mismatch

Command "produces `1..n` events" (line 365) but Operation "emits `0..n` events"
(line 251). A command whose triggered operation emits zero events satisfies one rule
and violates the other. Given line 358 ("Success implies at least one state change…
Failure produces an error event"), the intent is clearly ≥1 — so Operation should
either require ≥1 event when unsafe, or Command's rule should be stated as a
constraint on the *pair* (command, operation).

### 1.10 MEDIUM — Queries as event causes contradict query purity

Line 382: "An event may reference the command **or query** identifier that caused it"
and Event has "0..1 'caused by' relation with command or query". But Query is "safe
and idempotent — it produces no side effects" (line 370). An event is a recorded state
change; a side-effect-free message cannot cause one. Either drop queries from the
causation relation, or explicitly introduce the (audit-style) exception being implied.

### 1.11 MEDIUM — Aggregate identity ambiguity

Aggregate "is itself an entity" (so it has its own identity, fields, operations) *and*
"has root relation with entity" (line 328). Is the aggregate's identity the root's
identity, or a distinct one? Do child entities `belong to` the module directly or via
the aggregate? Does the root entity itself carry the aggregate-level invariants or
does the aggregate? Every downstream generator has to guess. The conventional DDD
answer (aggregate ≡ its root; the aggregate name *is* the root entity) should be
stated, or the distinct-identity semantics spelled out.

### 1.12 MEDIUM — State machine states are never anchored to entity state

Entity state is defined as "the complete set of its field values" (line 267), and
guards in examples read `ride.status = driverEnRoute` — implying a `status` field. But
nothing says how a state-machine state maps onto fields: is there an implied
`status`-like discriminator field per machine? Is a state a predicate over fields?
With "multiple state machines… govern disjoint aspects" (line 271), the mapping
question doubles: disjoint *how* — disjoint fields? This is exactly the kind of rule a
code generator needs and prose examples don't provide.

### 1.13 MEDIUM — Duplicate detection reads as mandatory and universal

"An entity **declares** a duplicate detection predicate over candidate fields,
evaluated through its repository" (line 273). As written this is unconditional — every
entity must have one — and it's absent from the Entity relations list. Also,
non-root aggregate children have no repository (line 275), so *their* duplicate
detection is unevaluable by the stated mechanism. Mark it `0..1` and scope it to
repository-bearing entities.

### 1.14 MEDIUM — Reaction can issue exactly one command

`1..1 "effects" relation with command` (line 575). Real reactive rules frequently fan
out ("when `OrderCancelled`: release inventory AND refund payment"). Under the current
rule the modeler must clone the reaction per command, fragmenting one domain rule into
several. Reconciliation already allows `1..n issues commands` — the asymmetry looks
accidental. Suggest `1..n`.

### 1.15 MEDIUM — Invariants cannot be scoped to value types

The Properties preamble says a property's scope is "the entity, domain service, **or
value type** that guarantees the property holds" (line 552), and Value Type prose
mentions "constraints enforced at creation with a 'transactional' constructor"
(line 485). But Invariant's relation permits scoping only to "entity, aggregate, or
state" (line 565). Value-type creation constraints — one of the most common modeling
needs (`Money.amount >= 0`) — have no representable form. Add value type to the
invariant scope (or define a distinct `constraint` on value types).

### 1.16 MEDIUM — Agreements across bounded contexts break the context-map discipline

Agreement "spans multiple aggregates within the same bounded context, **or across
bounded contexts**" (line 587), with a bare `2..n involves aggregates` relation. But
everywhere else, cross-context interaction must pass through a context-map pattern
(OHS, ACL, PL…), and "transactions cannot span across bounded contexts" (line 91). A
cross-context agreement that directly names foreign aggregates leaks the upstream
model — exactly what an ACL exists to prevent. Also, Agreement/Reconciliation declare
no `belongs to` relation at all: who owns a cross-context agreement? Specify that a
cross-context agreement references the *published* representation (per the governing
context-map pattern) and lives in a designated owning context (or the organization).

### 1.17 MEDIUM — No actor/authorization concept anywhere in the domain layer

Commands arrive from "collaborators", personas exist in the PRD, and authorization
appears only as an NFR-discovery question (SYSTEM-REQ § per-operation). There is no
way to state *who may issue a command* in the domain model — no actor, role, or
permission concept. For a toolkit whose examples include loans, payments, and rides,
authorization is domain logic (a rider may cancel only their own ride), not just
infrastructure. Even a minimal `issued-by` actor reference on Command would close the
persona → ??? → command gap in the traceability chain.

### 1.18 LOW — Structural and editorial defects

- **Heading hierarchy**: `# Bounded Context` (line 89) is H1 inside the document body;
  `#### Upstream patterns` and `#### Open Host Service` sit at the same level (the
  pattern should be nested under its group); **`### Read-only Entity` is nested under
  `## State machine`** (line 303) though it is an entity concern — a likely casualty
  of the recent "move state machine after entity" commit.
- **Stale TOC**: doctoc TOC lists neither "Read-only Entity" nor "Enums (Referential)";
  TOC says "Properties - Reaction and Invariant", body says "Reactions".
- **Typos/grammar**: "explicitely" (line 242); "enties" (line 532); "caused it.An
  event" missing space (line 382); "A absolute temporal event" (line 434); "an domain
  reference" (line 413); duplicated sentence "Values may be ordered" (lines 484–485);
  "if the user states it should be context" (line 223) is garbled — probably "unless
  the user states it should be a context".
- **Repository classification**: Infrastructure Service says "The repository is a kind
  of infrastructure service" (line 539) but Repository declares no `is-a` relation and
  lacks the infra service's mandatory `1..1 has interface` relation. Pick one story.
- Domain Service can "call" infrastructure services (line 523) but Entity/Operation
  relations omit the equivalent, even though Infrastructure Service says entity
  operations use it (line 545) — declare the relation on both sides or neither.

---

## 2. SYSTEM-REQ-METAMODEL.md

### 2.1 CRITICAL — The satisfaction-role vocabulary promised here does not exist

Counterpart of § 1.1: DOMAIN-METAMODEL points here for the definitions of
`structured-by`, `enforced-by`, `implemented-by`, `detected-by`, `reconciled-by`,
`quality-constrained-by`, `satisfied-by-infrastructure` — none are defined. Whichever
fix is chosen in § 1.1, this file is where the taxonomy (if kept) must live.

### 2.2 CRITICAL — Requirement Set scoping contradicts the file's own example

Requirement Set: "**1..1 'scoped to' relation with a bounded context**" (line 197).
Forty lines later, the cross-cutting NFR example is a requirement set scoped to an
organization:

```
requirements "Platform Reliability" scoped-to RideNowOrganization { … }
```

Individual Requirements *do* allow org scoping ("scoped to relation with bounded
context or organization", line 179), but the set that contains them cannot. Since a
requirement has `0..1 belongs to` a set, org-level requirements either float setless
or live in a set that violates its own scoping rule. **Fix**: `scoped to: bounded
context or organization` on Requirement Set, mirroring Requirement.

### 2.3 HIGH — Layering paradox: requirements are upstream of the domain model but scoped by it

The file insists it "speaks the language of system obligations… not the language of…
domain modeling (entities, commands, events)" (line 48) and that requirements are "the
parent of domain models" (line 42). Yet:

- Every requirement is "1..1 scoped to bounded context" — a DDD construct from the
  *downstream* layer.
- The EARS "system name" is "the **entity, aggregate, service, or bounded context**
  being specified" (line 74) — four domain-metamodel concepts.
- Requirement IDs' prefixes "anchor the requirement to a bounded context" (line 168).

So you cannot write well-formed system requirements until the bounded contexts (and
apparently entities) exist — but the domain model is supposed to be *derived from* the
requirements. The chicken-and-egg is real in practice (context discovery is iterative)
but the metamodel presents a strict one-way waterfall. **Fix**: scope requirements to
a named *system or capability area* that is later mapped onto bounded contexts (a
`realized-by-context` mapping that can be filled in as the domain model emerges), and
soften the "parent layer" language into an explicitly iterative loop.

### 2.4 HIGH — No verification method, acceptance criteria, or lifecycle status on Requirement

For a metamodel whose stated purpose is "unambiguous, **testable**" requirements
feeding three *verification loops*, Requirement has: id, statement, pattern, rationale,
priority — and nothing about verification. Missing, in rough priority order:

- **verification method** (test / demonstration / analysis / inspection) and/or a
  **fit criterion** — how will `shall` be checked? Especially acute for NFRs where
  the metric "lives in the EARS statement" as free prose ("99.9% availability
  measured monthly" — measured by whom, over what window boundary, excluding what?).
- **status** (draft / approved / implemented / verified / retired). The Observe loop
  cannot report drift against requirements that have no lifecycle state.
- **owner** — cross-cutting NFR prose says "still has an owner" (line 332), but no
  owner attribute exists on Requirement. Another prose/attribute contradiction.
- **stability/version** — "The identifier never changes, even if the statement is
  revised" (line 168) implies revisions, but nothing records a revision.

### 2.5 MEDIUM — `conflicts with` demands a documented resolution but gives it no slot

Line 182: conflicting requirements mean "the model must document the resolution
strategy"; the Traceability section repeats it (line 211). There is no attribute on
the relation (or the requirement) to hold that resolution. Either add
`resolution` to the conflicts-with relation or state where the documentation lives.

### 2.6 MEDIUM — `depends on` vs `decomposed into` semantics blur

`decomposed into` is defined for org → context NFR derivation, but the decomposition
prose says "the organization-level requirement **depends-on (or is-parent-of)**
context-level requirements" (line 315) — mixing the two relations in one sentence.
They have different logic: dependency is *ordering* ("B cannot be satisfied unless A"),
decomposition is *aggregation* ("children collectively satisfy the parent"). Coverage
analysis needs the distinction: a decomposed parent is satisfied iff all children are;
a dependency implies nothing about the parent's satisfaction. Define the semantics of
each for the Check loop explicitly.

### 2.7 MEDIUM — The `Where` pattern has no bridge to PRD features

EARS `Where` scopes requirements to "system variants that include a specific
capability" — conceptually the PRD's Feature. But the `Where` clause is free text and
nothing suggests referencing the feature that gates it. A one-line convention ("the
Where clause names a PRD feature; record it in `source`") would make optional-feature
requirements mechanically traceable to the roadmap.

### 2.8 LOW — Misc

- "Equivalent to the `::` operator on domain constructs" (line 171) references a DSL
  operator defined in neither this file nor DOMAIN-METAMODEL.md — readers of the
  metamodel alone cannot resolve it.
- The NFR discovery heuristic is excellent (genuinely one of the strongest sections in
  the three files) but yields *questions*, not requirement templates. Consider pairing
  each question with an EARS skeleton (e.g. latency → "When <operation> is invoked,
  the <system> shall respond within <budget> at p95") to shorten the path from
  question to artifact.

---

## 3. PRODUCT-REQ-METAMODEL.md

### 3.1 HIGH — PRD elements have no identifiers, so the traceability bridge is name-fragile

Requirements get stable IDs (`REQ-ORD-001`) with an explicit "never changes" rule. PRD
elements get *nothing* — features, stories, acceptance criteria are referenced from the
`source` field by free-text name:

```
source "Feature: Free cancellation — Story: Rider cancel without penalty — AC: No fee before assignment"
```

Renaming a feature (routine in product work) silently severs every downstream `source`
link, and the file's own impact analysis ("follow the `source` references…", § Impact
analysis) becomes grep-over-prose. The fix is cheap and symmetric with the sysreq
layer: ID conventions for features (`FEAT-001`), stories (`US-001`), acceptance
criteria (`AC-001-03`), with the same stability rule. This is the single highest-value
improvement in this file.

### 3.2 MEDIUM — Feature's `sourced by` relation contradicts the declared direction of the bridge

The file states the bridge lives on the *requirement* side ("The `source` field on
system requirements… creates this traceability bridge", line 42) and that this
metamodel is "upstream of SYSTEM-REQ-METAMODEL.md" — yet Feature and User Story each
declare a `0..n "sourced by" relation with system requirements` (lines 287, 307). If
that relation is materialized in the PRD artifact, the PRD now references downstream
IDs and must be edited whenever requirements are written — breaking upstream
independence and inviting drift between the two directions of the same link. If it is
*derived* (computed by scanning requirements' `source` fields), say so explicitly, as
DOMAIN-METAMODEL does for bidirectional traceability. One line fixes it.

### 3.3 MEDIUM — Acceptance criteria are load-bearing but unstructured

Acceptance criteria are "the primary candidates for formalization into EARS
requirements" (line 302) — the actual hinge of the PRD→sysreq pipeline — yet they are
an untyped set of "testable statement[s]" with no identity (see 3.1), no status
(formalized vs pending), and no format guidance. Given/When/Then would map almost
1-to-1 onto EARS While/When/shall and would make the formalization step nearly
mechanical for an agent. At minimum: give criteria IDs and a `formalized-into`
convention.

### 3.4 MEDIUM — Success metrics lack guardrails and counter-metrics

Success Metric models the target that should move. Mature metric practice pairs every
driver metric with **guardrail metrics** that must *not* regress (e.g. "increase
conversion 20%" guarded by "support-ticket rate must not rise"). Without it, the
Hypothesis construct can be "validated" while quietly damaging an unmeasured outcome.
A `0..n "guarded by"` relation from Goal or Hypothesis to metrics-with-thresholds
would close it. (Related nit: Success Metric is `1..1 measures a goal`, but Hypothesis
may "predict movement on a **goal or success metric**" — the indirection is fine, but a
metric with no goal is unrepresentable, which precludes standalone guardrails today.)

### 3.5 MEDIUM — No buyer/stakeholder concept

Persona models *users*. In B2B (fleet operations, lending — both present in the
examples corpus), the economic buyer, the compliance officer, and the admin who
approves rollout are decision-makers who may never touch the product, yet features are
built for them. Persona's `weight: primary|secondary|excluded` cannot express "not a
user at all but decides the purchase." Either broaden Persona with a
`relationship: user|buyer|influencer|operator` axis or note the exclusion as a
deliberate non-goal of the metamodel.

### 3.6 LOW — Misc

- **Hypothesis→Feature status coupling is prose-only**: "invalidated ones should
  trigger feature reconsideration" (line 256) has no modeled consequence; a checker
  could flag `hypothesis.status = invalidated ∧ feature.status ∈ {accepted,
  in-progress}` as an inconsistency — worth stating as a named audit rule.
- **Asymmetric relation declarations**: Supporting Evidence "supports… problem
  statement, goals, or features", but only Problem Statement declares the inverse
  (`supported by`); Goal and Feature don't. Declare inverses consistently or state
  the convention that inverses are implied.
- **Feature `1..n described by` user stories** makes a story mandatory at creation —
  too strict for `status: proposed` features that are one summary line. Consider
  `0..n` with a rule that `accepted` features require ≥1 story.
- **"ubiquitous language"** appears in Persona (line 129) despite the header claim of
  independence from DDD vocabulary — harmless, but it's the exact leakage the file
  says it avoids.
- Open Question / Assumption / Risk / Non-goal are unusually well-differentiated —
  this trio (plus the Job/Outcome ODI section) is the strongest part of the file.

---

## 4. Cross-cutting findings

### 4.1 HIGH — The traceability chain has typed IDs at one link and prose at the other two

The three-layer chain is only as strong as its weakest link:

```
PRD element ──(source: free text)──▶ Requirement ──(satisfies: typed IDs)──▶ Domain element ──(?)──▶ Code
```

- PRD → requirement: free-text `source` (no PRD IDs — § 3.1).
- Requirement → domain: typed `satisfies` IDs — the good link.
- Domain → code: **nothing**. The chain diagram in PRODUCT-REQ (line 61) ends with
  "↓ realized in / Code", and the repo's own DSL convention requires
  `// source: path/to/file.ext` comments — but no metamodel defines that link. For a
  toolkit with `domain-extract-from-code` and `domain-build-code` skills, the
  domain↔code link deserves the same first-class treatment (`realized-by` /
  provenance attribute) instead of living only in skill conventions.

Also, the PRD chain diagram labels the requirement→domain arrow "**satisfied-by**",
while SYSTEM-REQ states requirements "do not reference domain model elements" —
direction and naming should match (`satisfies`, bottom-up) in all three files.

### 4.2 MEDIUM — No change/versioning model in any layer

All three layers describe living artifacts (evidence "ages", open questions are
"living artifacts", requirement statements get "revised", hypotheses flip status), and
the toolkit's stated purpose includes *drift detection* — yet no metamodel has a
notion of revision, supersession, or deprecation. You cannot express "REQ-ORD-003 v2
supersedes v1" or "this feature replaced that one," so drift analysis can only compare
snapshots by re-diffing whole files. Even a minimal `supersedes` relation +
`revision` attribute on Requirement and Feature would enable longitudinal analyses.

### 4.3 MEDIUM — Metamodel↔grammar drift (spot-check)

A keyword scan of `src/grammars/domain.ebnf` against DOMAIN-METAMODEL concepts:

| Concept | In metamodel | In grammar |
|---|---|---|
| Read-only entity / master data / sync pattern | yes (full section) | **no (0 hits)** |
| Enum | yes | yes |
| Agreement / Reconciliation / Escalation | yes | yes |
| Repository | yes | yes (derived) |
| Temporal events, reactions, invariants | yes | yes |

The read-only-entity gap should be logged in `proposals/grammar-gaps-backlog.md`
(it is a whole construct family: `is-a` inheritance, `sourced from`, `synced via`).
Conversely, it's worth a periodic reverse audit: grammar constructs with no metamodel
section (not checked exhaustively here).

### 4.4 LOW — Convention sections drift in shape

DOMAIN's convention adds `satisfies` to the implicit attributes; PRD and SYSTEM-REQ
have name/description/metadata only. Fine — but SYSTEM-REQ requirements also
implicitly need `source`, `priority`, `scoped-to` and those are (correctly) explicit.
Consider a single shared "conventions" preamble included at build time (the repo
already has an include mechanism) so the three files can't drift.

---

## 5. Prioritized recommendations

1. **Define or delete the satisfaction-role taxonomy** (§ 1.1/2.1) — it's currently a
   broken promise between the two files.
2. **Fix the Event relation inheritance** (§ 1.2) — move `raised by operation` to
   internal/error events only.
3. **Unify event consumption through Reaction** (§ 1.4) and make External Event
   `0..n triggers`; add temporal events to Reaction's trigger relation.
4. **Reconcile requirement-set scoping with organization-scoped NFRs** (§ 2.2).
5. **Give PRD elements stable IDs** (§ 3.1) — cheapest, highest-leverage traceability
   fix.
6. **Add verification method + status to Requirement** (§ 2.4) — the verification
   loops need it.
7. **Close the read-model projection hole and log the read-only-entity grammar gap**
   (§ 1.5, § 4.3).
8. **Let commands trigger domain-service operations** (§ 1.7) and give
   commands/queries/events a module home (§ 1.8).
9. Resolve the medium ambiguities that block deterministic generation: aggregate
   identity (§ 1.11), state↔field anchoring (§ 1.12), operation ownership (§ 1.6),
   invariants on value types (§ 1.15).
10. Sweep the editorial defects (§ 1.18) and re-run doctoc.

---

*Report generated 2026-07-10 by Claude (Fable 5) from a full read of the three
metamodels plus a keyword cross-check against `src/grammars/domain.ebnf`. Line numbers
refer to the files as of commit `c7fe4f7`.*
