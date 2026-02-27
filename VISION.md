# Specy Vision

## Thesis

Business knowledge is the real asset. Code is becoming a commodity — a derivation of business intent that AI can generate, rewrite, and discard. What remains scarce is the **knowledge** buried in existing systems: the rules, edge cases, domain invariants, regulatory constraints, and operational decisions that took years to accumulate.

Developers have always been the translators between business intent and code. AI amplifies this role but also amplifies the chaos: prompts filled with implicit assumptions produce plausible but incorrect code. Without explicit intent, AI-generated code drifts from business reality at scale.

Specy makes business knowledge explicit, portable, and verifiable — so it can evolve with the business, survive rewrites, and anchor AI-generated code to real intent.

## The problem with code as knowledge carrier

Code encodes business knowledge, but it does so implicitly. A `timeout: 30s` hides a partner SLA. A field ordering in a form hides a regulatory obligation. A retry policy hides a business continuity decision. When code is rewritten — by humans or by AI — this implicit knowledge is silently lost.

The cost is not the rewrite itself. It is the **silent knowledge loss** during transition: rules that were correct in the old system but got dropped in the new one.

## Three circles of business knowledge

Business knowledge does not live in the domain alone. It lives in three layers, each with its own autonomy:

### Circle 1 — Domain (deep modeling)

What exists and what happens. The concepts, their relationships, their constraints, and the interactions that change them.

- **Captured in:** `.struct` (structural model) and `.flow` (behavioral model)
- **Proof type:** structural (types, fields, constraints exist in code) and behavioral (interactions emit correct events, policies are enforced)
- **Verification:** AST comparison, generated integration tests

### Circle 2 — Experience (described)

What the user lives. The journeys, the step sequences, the presentation constraints that encode business rules, the feedback that materialises domain states. This knowledge is **not derivable from the domain** — a regulatory field ordering, a mandatory confirmation step, a specific error message exist only in the interface layer.

The Naked Objects pattern (Pawson, 2004) tried to derive UI from domain objects. It failed because interface carries autonomous business knowledge that the domain does not express. An AI generating UI from a domain model commits the same error — it produces a *plausible* interface, not a *correct* one.

- **Captured in:** `.journey` file (grammar stabilised — see `skills/src/examples/orders.journey`)
- **Proof type:** experiential (journeys respected, field ordering preserved, feedback present)
- **Verification:** see Verification strategy below

### Circle 3 — Infrastructure (annotated)

The operational constraints that materialise business commitments. A timeout encodes a SLA. A circuit breaker encodes a fallback strategy. A batch schedule encodes a business process. These are not modeled in depth — they are **traced back** to business intentions via annotations.

- **Captured in:** annotations within `.flow` and `.struct` files
- **Proof type:** operational (configurations match declared SLA and constraints)
- **Verification:** configuration validation, generated infrastructure tests

### Inclusion criterion

A piece of knowledge enters Specy if and only if it **materialises a business intention** — whether it lives in domain, interface, or infrastructure. Pure technical detail stays in the code.

## Specy as validation oracle

Specy artifacts are not documents to read. They are **verifiable contracts** against which code — generated or handwritten — is validated. Each file is a type of proof.

### The AI workflow

```
1. AI reads existing Specy artifacts
   → understands domain, interactions, journeys, constraints

2. AI proposes Specy modifications BEFORE touching code
   → 10 lines of readable DSL, validatable by a PO

3. PO/developer validates the Specy change
   → business intent confirmed before a single line of code is written

4. AI generates code from updated Specy (builder)
   → anchored in explicit, validated intent

5. Independent AI checker verifies against Specy
   → builder and checker are separate processes with separate prompts
   → the checker never sees the builder's prompt — only the .journey and the code

6. Developer reviews only the gaps
   → effort focused on the 20% that requires human judgement
```

### Builder/Checker principle

A system that verifies itself verifies nothing. The builder (AI that generates code from Specy) and the checker (AI that verifies code against Specy) must be **independent processes**. The checker reads the `.journey` as an unknown specification and the code as an unknown artefact, then confronts the two. This separation prevents the builder from confirming its own biases.

### Three verification loops

Specy verification is not a single check — it is three independent loops that catch drift at different levels:

```
              .journey (declared)
              ↙              ↖
    BUILD                      CHECK
    (generate)                 (verify)
              ↘              ↗
              Code (source)
                   ↓
              Application (runtime)
                   ↓
              OBSERVE (reverse)
                   ↓
              .journey (observed)
                   ↕ diff
              .journey (declared)
```

| Loop | Direction | What it catches |
|------|-----------|-----------------|
| **Build** | `.journey` → code | Generates conforming code from intent |
| **Check** | code → `.journey` | Detects construction gaps — code that doesn't match declared intent |
| **Observe** | application → `.journey` | Detects runtime gaps — deployed behaviour that doesn't match declared intent |

An artefact that survives all three loops is **proven** at three levels: intention, construction, and observable behaviour.

### Verification strategy (5 levels)

| Level | Mechanism | Mode | Phase |
|-------|-----------|------|-------|
| 0 | **Lint Specy** — cross-artefact coherence (dot-paths resolve, commands exist, `.journey` validations match `.flow` fails) | Static | Build time |
| 1 | **Checker AI** — independent AI reads code + `.journey`, reports gaps (separate prompt from builder) | Static | Post-generation |
| 2 | **Contract assertions** — generated unit/component tests from `.journey` constructs (validates, presents, field order, warns when, visible when) | Tests | CI |
| 3 | **Reverse DOM** — AI inspects rendered DOM, produces observed `.journey`, diffs against declared `.journey` | Dynamic | CI / post-deploy |
| 4 | **Reverse visual navigation** — AI navigates live application via screenshots/OCR, discovers journeys from scratch | Semi-automatic | Legacy extraction / audit |

Levels 0-2 verify **construction** (code matches intent). Levels 3-4 verify **observable behaviour** (running application matches intent). Level 4 doubles as a **discovery tool** for legacy extraction.

### Reverse as knowledge detector

The reverse loop (levels 3-4) does more than verify conformity. It **discovers unmodeled knowledge**:
- A field displayed on screen that doesn't exist in the `.struct` → unmodeled computed value or phantom field
- A UI validation without a corresponding `fails` in the `.flow` → business rule captured only in the interface
- A step sequence that differs from the declared `.journey` → runtime behaviour that has drifted from intent

These gaps are precisely the dangerous points in a rewrite — where knowledge is fragmented across layers.

### Why this survives where others died

Every previous attempt at capturing business knowledge (BRMS, UML, enterprise wikis, BPM tools) failed because the model lived **beside** the development workflow, not **inside** it. Maintenance depended on discipline, and discipline decays.

Specy survives because it is **in the critical path**:
- You cannot generate code without Specy (it is the prompt anchor)
- You cannot validate code without Specy (it is the proof oracle)
- You cannot deploy without the checker confirming conformity
- The model cannot rot because it is the mechanism, not the documentation

### Proof derivation

| Circle | Specy artifact | Proof type | Example |
|--------|---------------|------------|---------|
| Domain | `.struct` | Structural | `TransferType` contains `instant` value |
| Domain | `.flow` | Behavioral | `"initiate transfer"` emits `TransferInitiated` event |
| Experience | `.journey` | Experiential | Field order is IBAN → amount → reason (regulatory) |
| Infrastructure | annotations | Operational | Timeout is 5s (instant transfer SLA) |

The generated proofs carry their **business justification** — not just `expect(fields[0]).toBe('iban')` but *why* IBAN must come first. This is what no test framework provides today.

## DDD: core, not boundary

DDD remains the foundation for domain modeling — `.struct` and `.flow` speak its language. But DDD is the core of Specy, not its boundary. The tactical patterns (entities, aggregates, commands, events) structure the domain circle. The strategic patterns (bounded contexts, context mapping) inform the extraction approach. But Specy extends beyond what DDD covers, because business knowledge extends beyond the domain.

## Primary use case: legacy evolution with AI

The first application is organisations that must modernise legacy systems without losing the business intelligence encoded in them. The value proposition:

> "Here is what your system does, here is what you risk losing by rewriting, here is what is business knowledge and what is accidental complexity."

Three columns a CTO can read: **Intention** — **Domain materialisation** — **Interface materialisation**. The cost of extraction is repaid the moment the first AI-generated module is validated against the model instead of requiring full human review.

### Legacy extraction workflow

For legacy systems with a user interface, extraction starts from what the user sees — not from the code:

```
1. OBSERVE — AI navigates the live application (screenshots/OCR)
   → produces a candidate .journey (what the user experiences)

2. DISTILL — AI reads the source code
   → produces .struct and .flow (what the code does)

3. CONFRONT — diff between observed journey and extracted domain
   → surfaces fragmented knowledge:
     - UI rules with no domain counterpart
     - Domain rules with no UI manifestation
     - Behaviour gaps between what is shown and what is enforced

4. RECONCILE — human reviews the gaps
   → decides what is business knowledge (enters Specy)
     vs. accidental complexity (stays in code or is discarded)
```

For legacy systems without a user interface (APIs, batch jobs, backend services), extraction starts at step 2 (distill) directly.

## Design principles (from brainstorm)

1. **Three circles, decreasing depth.** Domain is modeled. Experience is described. Infrastructure is annotated. Each layer's cost of extraction is proportional to its knowledge value.
2. **Inclusion by intention.** Only business knowledge enters Specy. The criterion: does this materialise a business intention? If yes, it belongs. If no, it stays in the code.
3. **Three-loop verification (build/check/observe).** The builder generates, an independent checker verifies, and the reverse observer detects drift in the running application. A system that verifies itself verifies nothing — builder and checker must be separate processes.
4. **Proofs, not documentation.** Every Specy artifact must be mechanically verifiable against code. If it cannot produce a proof, it is not earning its place. The `::` operator carries business justification — the proof says *what*, the justification says *why*.
5. **AI as amplifier, human as validator.** AI extracts, generates, and validates at scale. Humans confirm intent and review gaps. The 80/20 split: 80% mechanical verification, 20% human judgement.
6. **Reverse as discovery, not just verification.** The observe loop (reverse UI→journey) is both a checker and a detector of unmodeled knowledge. Gaps between observed and declared journeys reveal where business knowledge is fragmented across layers.

## Open questions

1. **`.journey` EBNF grammar.** ~~The formal EBNF grammar remains to be written.~~ **Resolved.** The formal grammar is defined in `skills/src/grammars/journey.ebnf`. Core constructs: `journey`, `step`, `presents`/`with`, `collects`/`maps to`, `validates`, `confirms`, `precondition`, `field order`, `warns when`, `visible when`, `constraint`, `::` as justification operator. Panel refinement: `then` in `on success/failure` blocks is typed (`then presents`, `then navigates to`, `then notifies`) for proof derivability.
2. **Infrastructure annotation syntax.** Is `// materializes: <intention>` sufficient, or does a more structured mechanism need to exist within the grammar?
3. **Proof coverage threshold.** Hypothesis: mechanical verification covers 70%+ of business conformity. This needs validation on a real legacy extraction.
4. **Reverse tooling.** Two modes identified (DOM inspection for CI, visual navigation for legacy extraction). Technical feasibility and accuracy thresholds need prototyping.
5. **Journey variants.** Deferred to V2. Current approach: one journey per variant (`"Place an order (B2B)"`, `"Place an order (B2C)"`). If the pattern repeats enough, a variant mechanism will be introduced.
