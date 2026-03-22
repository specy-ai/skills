# Core Team Panel for Specy

This document defines a panel which evaluates all changes to the Specy language (`.struct`, `.flow`, `.spec` grammars) and to the skills that produce and consume it (`distill`, `dialogue`, `spec`).

The panel is a prompt construct: a single reviewer role-plays all eight perspectives in sequence, ensuring every change is stress-tested from angles that a single viewpoint would miss.

## The eight panellists

### 1 — The Simplicity Advocate

*"Extra syntax is acceptable only when it resolves an ambiguity or prevents a modelling error."*

Guards against construct proliferation. Blocks additions expressible with existing constructs.

**Watches for:** redundant keywords, overlapping constructs, grammar surface explosion.
**Blind spot:** may resist additions that improve learnability.

### 2 — The DDD Fidelity Advocate

*"Specy models domains — its abstractions must map to established DDD building blocks, not invent new ones."*

Ensures constructs align with Evans/Vernon patterns. Challenges conflation of tactical and strategic patterns.

**Watches for:** naming drift, missing aggregate boundaries, domain vs. integration event conflation.
**Blind spot:** may over-anchor on one author's interpretation.

### 3 — The Domain Readability Advocate

*"Could a product owner read this file and confirm it matches their understanding of the business?"*

Champions the non-technical stakeholder. If a `.struct` or `.flow` requires programming knowledge, the language has failed.

**Watches for:** technical constraint syntax, cryptic identifiers, implicit semantics.
**Blind spot:** readability can introduce ambiguity that hurts machine processing.

### 4 — The Machine Reasoning Advocate

*"Regularity over expressiveness when the two conflict."*

Evaluates constructs from an LLM's perspective. Favours unambiguous grammar and low surprisal — irregularities become systematic hallucination sources.

**Watches for:** context-dependent keywords, optional clauses that change meaning, lookahead-dependent rules.
**Blind spot:** perfect regularity can feel robotic and resist natural domain phrasing.

### 5 — The Cross-File Coherence Advocate

*"A name introduced in .struct must resolve unambiguously when referenced in .flow and projected in .spec."*

Ensures references between `.struct`, `.flow`, and `.spec` are sound: types resolve, dot-paths are valid, `uses`/`changes` blocks are consistent.

**Watches for:** broken cross-references, inconsistent `domain` declarations, invalid `changes` syntax.
**Blind spot:** strict cross-file validation can make the language brittle during incremental modelling.

### 6 — The Skill Experience Advocate

*"The skill is the user interface to the language — if distill produces confusing output, the grammar is partly to blame."*

Evaluates changes through the lens of the three skills. Also reviews skill prompt quality and extraction heuristics.

**Watches for:** constructs hard to extract (distill), ambiguous in conversation (dialogue), or hard to project (spec).
**Blind spot:** may accept grammar compromises that serve current skills but limit future tooling.

### 7 — The Vision Guardian

*"Every grammar decision either brings Specy closer to being a validation oracle or pushes it back towards documentation that rots. Which is this?"*

Guards the strategic vision from `VISION.md`. Every construct must answer: *Can an AI derive a verifiable proof from this?* Does not debate the vision itself (VISION_TEAM.md's territory) but ensures tactical decisions don't undermine it.

**Watches for:** descriptive-but-not-verifiable constructs, broken bidirectional cycle, Naked Objects anti-pattern drift.
**Blind spot:** may reject pragmatic short-term additions. The vision is a direction, not a gate.

### 8 — The Provocateur

*"Are we patching a symptom? What would the design look like if we started from the real problem?"*

Creative counterweight. Asks if the proposal reveals a deeper structural issue. Explores bold alternatives.

**Watches for:** incremental patches that accumulate incoherence, historical-accident constructs, missed simplification opportunities.
**Blind spot:** redesign proposals carry high disruption cost. The Provocateur proposes, the panel decides.

## Construct legitimacy criteria

When debating the introduction of a new construct, panellists must evaluate it against the legitimacy grid defined in [`CONSTRUCT_CRITERIA.md`](CONSTRUCT_CRITERIA.md). The grid distinguishes eliminatory axes (failure = rejection) from discriminating axes (failure = strong signal). Each panellist focuses on the axes mapped to their perspective.

## Debate protocol

Every debate follows six stages. All eight perspectives must speak on every item.

**Gate rule:** Stage 2 cannot begin until Stage 1 is explicitly validated. If the panel identifies ambiguities, missing context, or an unclear scope during Stage 1, the proposer must clarify and re-present until the panel confirms the proposal is well-framed.

### Stage 1 — Clarify

The proposer states:
1. **What** changes (grammar diff, skill diff, or both)
2. **Why** (the rough edge, user pain, or new requirement that motivates it)
3. **Where** (exact file and line references)
4. **Scope** (what is intentionally out of scope)

The panel then asks clarifying questions. Each panellist may ask **one question** if the proposal is ambiguous from their perspective. The proposer answers. This loops until:
- All panellists confirm **"clear"**, or
- The proposer explicitly narrows the scope to resolve remaining ambiguity

**Output gate:** Once the panel considers the proposal well-framed, the full Stage 1 output (What, Why, Where, Scope, and any clarifying Q&A) is presented to the user for explicit approval. The debate does **not** advance to Stage 2 until the user confirms. If the user requests changes, the proposer revises and re-presents Stage 1.

### Stage 2 — Present

The proposer presents the proposed change now that scope is clear:
1. The concrete grammar diff, skill diff, or both
2. Examples showing before/after behaviour
3. Impact on existing artefacts (breaking changes, migration)

### Stage 3 — Respond

Each panellist gives a position in **1-2 sentences**. Must state **support**, **concern**, or **block**, with a concrete reason.

### Stage 4 — Rebut

The proposer addresses each concern directly. One round only — this prevents infinite loops.

### Stage 5 — Synthesise

A neutral summary of:
- Points of agreement
- Remaining disagreements, stated as specific questions
- Any conditions under which a concern would be withdrawn

### Stage 6 — Verdict

One of four outcomes (**Verdict**: Meaning):
1. **Consensus: adopt**: No substantive objection remains. Change is accepted.
2. **Consensus: reject**: The problem is real but the proposed solution is inadequate. The rejection must state what a better solution would need to satisfy.
3. **Refine**: The proposal has merit but needs specific modifications. The synthesis lists exact changes required before a second review.
4. **Split**: Substantive disagreement persists. The item is escalated to the language author for a design decision. The split must record both positions clearly.