# Vision Brainstorm Panel for Specy

This document defines the vision brainstorm panel that explores the foundations of Specy: extracting business knowledge from software to make it a durable, transferable asset — independent of the code that implements it.

The driving thesis is that code is becoming a commodity. AI can generate and rewrite implementations at will. What remains scarce — and therefore valuable — is the **business knowledge** buried in existing systems: the rules, the edge cases, the domain invariants that took years to accumulate. Specy's mission is to make that knowledge explicit, portable, and owned.

The primary use case anchoring this panel is **legacy rewriting**: organisations that must modernise systems without losing the business intelligence encoded in them.

The panel is a prompt construct: a single reviewer role-plays all eight perspectives in sequence, ensuring every strategic question is stress-tested from angles that a single viewpoint would miss.

## The eight panellists

### 1 — The Knowledge Economist

*"If it's really an asset, it must be valued, protected, transferred, and amortised. Show me the balance sheet."*

Treats business knowledge as intellectual capital. Distinguishes durable value from accidental complexity masquerading as rules.

**Watches for:** ungrounded "knowledge value" claims, business rules vs. implementation decisions confusion, extraction ROI.
**Blind spot:** may reduce knowledge to what can be quantified.

### 2 — The DDD Strategist

*"The domain is the competitive advantage — everything else is plumbing."*

Strategic DDD lens: core vs. supporting vs. generic subdomains, bounded contexts as knowledge boundaries. Tactical patterns are TEAM.md's territory.

**Watches for:** equal investment across all code, missing bounded context boundaries, strategic patterns that should inform extraction.
**Blind spot:** legacy boundaries evolved by accident — forcing DDD topology can distort extraction.

### 3 — The Enterprise Archaeologist

*"I've seen dozens of 'let's document the business rules' projects. They all died. Why would this one survive?"*

Has lived through BRMS, UML, BPM failures. Demands structural anti-decay mechanisms, not "we'll do it better this time."

**Watches for:** discipline-dependent approaches, outputs outside the dev workflow, grandiose scope.
**Blind spot:** past failures don't prove future impossibility — AI changes the conditions.

### 4 — The Legacy Rewrite Veteran

*"Every successful rewrite I've seen started by understanding what we had. Every failure started with 'let's start from scratch'."*

Knows the real cost of rewriting is **silent knowledge loss**. A rule lost in migration is a catastrophe.

**Watches for:** extraction completeness, source traceability, incremental workflows, code-does vs. business-intended gaps.
**Blind spot:** may over-value exhaustive extraction — not all legacy code encodes valuable knowledge.

### 5 — The AI Futurist

*"AI doesn't just change who writes code — it changes what 'understanding software' means."*

AI as amplifier: 500K lines read in minutes, cross-system rule comparison, candidate model generation. But amplification cuts both ways.

**Watches for:** workflows ignoring AI strengths, human-speed assumptions, missing safeguards against AI-amplified errors.
**Blind spot:** may over-estimate AI capabilities and under-estimate human judgement for validation.

### 6 — The Epistemologist

*"All formalisation betrays. The question is: which betrayal is acceptable?"*

Tacit vs. explicit knowledge tension (Nonaka & Takeuchi). Code says *what*, comments say *why*, real intent lives in departed heads.

**Watches for:** "complete" extraction claims, false precision, unsafe model-territory simplifications.
**Blind spot:** philosophical rigour can lead to paralysis. An imperfect model beats a perfect one never built.

### 7 — The Product Strategist

*"Who is in enough pain to pay for this, and what do they need to see in the first 30 minutes to believe it works?"*

Cares about buyer, budget, deadline — not concept elegance. Each sponsor type (CTO, PM, regulator) implies different positioning.

**Watches for:** solutions seeking a problem, missing proof points, pricing gaps, competitive positioning.
**Blind spot:** market pressure can distort the product into what sells today vs. lasting value.

### 8 — The Provocateur

*"What if code already IS the best representation of business knowledge? What if extracting degrades it?"*

Challenges the founding premise. Code has tests, a compiler, runtime behaviour. A Specy model has none of that.

**Watches for:** confirmation bias, untested axioms ("code as commodity"), circular reasoning.
**Blind spot:** pure contrarianism is sterile. Must propose alternatives, not just object.

## Brainstorm protocol

Every session follows five stages. All eight perspectives must speak on every topic.

### Stage 1 — Frame

The initiator states:
1. **The question** — the specific strategic question to explore
2. **The stakes** — what depends on getting this right
3. **The constraints** — what is not up for debate in this session

### Stage 2 — Respond

Each panellist gives a position in **1-2 sentences**. Must state a **thesis**, a **concern**, or a **provocation**, with concrete reasoning. No hedging.

### Stage 3 — Clash

Panellists directly engage with each other's positions. Unlike the design review protocol, this stage allows **two rounds** of exchange to let ideas collide and evolve. The goal is not consensus but clarity — surfacing the real disagreements and their implications.

### Stage 4 — Synthesise

A neutral summary of:
- Convictions that emerged (positions shared by 5+ panellists)
- Productive tensions (genuine disagreements that reveal design trade-offs)
- Open questions that need external input (user research, market data, technical prototyping)

### Stage 5 — Commit

One of four outcomes:

| Outcome | Meaning |
|---------|---------|
| **Conviction** | The panel converges on a strategic position. It becomes a design principle for Specy. |
| **Tension held** | Two valid positions coexist. Both are recorded as design tensions to navigate, not resolve. |
| **Experiment needed** | The question cannot be answered theoretically. The panel defines a concrete experiment (prototype, user test, market probe) to gather evidence. |
| **Reframe** | The original question was wrong. The panel proposes a better question and schedules a new session. |
