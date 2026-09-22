# Specy — Website Marketing Content & Refactor Plan

Source material: the 8 shipped skills (`src/skills/`), the three metamodels
(`src/metamodels/`), `README.md`, `VISION.md`, and the four worked examples in
`examples/`. Everything below is either ready-to-paste copy or a decision the site
needs to make. Claims are traceable to what the repo actually ships — where the copy
would over-promise, it says so.

---

## Part 0 — The three findings that should drive the refactor

**1. The site is selling a toolkit; the market buys an outcome.**
Current README opens with *"Specy is a Domain-Driven Design toolkit that ships as a
Claude Code plugin."* That is a category description, not a promise. The 8 skills
compose into one outcome nobody else sells: **your business logic becomes an artifact
you can version, diff, verify, and regenerate from — instead of a thing buried in code
and prompts.** Lead with that.

**2. The strongest asset on the site is currently invisible: the round trip.**
Specy is the only DDD tooling that runs the loop in both directions — `domain-design`
+ `domain-build-code` go intent → code; `domain-extract-from-code` +
`sysreq-extract-from-code` + `domain-refactor` go code → intent. Legacy in, clean model
out, clean code back. **That round trip is the product.** It should be the hero, not a
bullet in a skills table.

**3. VISION.md and the shipped product have drifted — and the site inherits it.**
VISION markets `.struct`, `.flow`, `.journey`, "three circles", and a 5-level
verification stack (reverse-DOM, probing, navigate sessions). What ships today is
`.prd`, `.sysreq`, `.domain` and 8 skills. Journeys, probing and the observe loop are
**roadmap, not product.** Marketing that mixes them will (a) fail the first evaluation
and (b) burn the credibility that the very real, very deep metamodel has earned.
→ **Rule for the site: everything above the fold must be runnable today. Everything
aspirational goes under an explicitly labeled "Where we're going".**

---

## Part 1 — Positioning

### Category

Don't fight for "DDD tool" (small, academic, crowded with dead UML tooling) or "AI
coding assistant" (impossibly crowded, and you'd be competing with your own host).

**Claim this instead: *the specification layer for AI-assisted engineering.***
The place where business intent lives, so that AI has something to be correct
*against*.

### One-line positioning

> **Specy turns your business logic into a verifiable, versioned model — the source of
> truth that AI-generated code is built from and checked against.**

### The wedge (why now)

AI made writing code cheap. It did not make *knowing what the code should do* cheap. As
generation volume goes up, the bottleneck moves from typing to **intent**: every team
now produces plausible code faster than they can verify it means the right thing.
Specy is the artifact that makes intent explicit enough for a machine to build from and
check against.

### Positioning statement (internal, for the team)

> For engineering leaders modernizing complex business systems with AI, who find that
> AI-generated code is fast but unverifiable and quietly drifts from business reality,
> **Specy** is a specification layer that captures product intent, system requirements,
> and the domain model as machine-readable, traceable artifacts. Unlike prompt libraries
> and AI coding assistants — which are ephemeral and verify nothing — Specy produces a
> durable model that code is generated from, checked against, and recovered back into.

---

## Part 2 — Audiences and what each one needs to see

The site currently speaks to one persona (the DDD-literate developer). There are three,
and they enter through different doors.

| Persona | Their actual pain | The proof they need | Their entry page |
|---|---|---|---|
| **The Modernizer** (CTO / architect on a legacy rewrite) — *primary ICP* | "We're rewriting a 12-year-old system and nobody knows all the rules it enforces. If we lose one, we lose money or get fined." | An extraction on a real legacy codebase → a model + a gaps report they can read in a meeting | `/legacy` |
| **The AI-Skeptic Lead** (staff eng / tech lead already shipping AI code) | "Copilot/Claude gives me plausible code. I have no way to prove it's *right* — review is now my bottleneck." | The build → check loop: generated code traced line-by-line back to a requirement ID | `/` (home) |
| **The Modeler** (DDD practitioner, event-storming crowd) | "I run great event storming sessions and the outputs die in Miro." | The metamodel depth: temporal events, invariants with enforcement, agreements/reconciliation, context maps | `/metamodel` |

**Where to spend first:** The Modernizer. Biggest budget, most acute pain, and it's the
use case the skill set is genuinely strongest at (`domain-extract-from-code` →
`domain-refactor` → `domain-build-code` is a complete, differentiated pipeline that no
competitor has end-to-end).

---

## Part 3 — Ready-to-use copy

### Hero (recommended)

> # Your business logic deserves better than a prompt.
>
> Specy captures what your system *actually does* — product intent, testable
> requirements, and a full domain model — as versioned files that AI builds from and
> gets checked against.
>
> **Extract it from legacy code. Refine it with your experts. Generate clean code from
> it. Prove the code still means it.**
>
> `[ Install the Claude Code plugin ]`   `[ See a real model → ]`

*Sub-hero credibility strip:* `8 agent skills · 3 DSLs · 4 complete worked examples ·
MIT`

### Hero — alternates to A/B

**A. The loss-aversion cut (aimed at the Modernizer):**
> # Rewrites don't fail on code. They fail on the rules nobody wrote down.
> Specy extracts the business knowledge buried in your legacy system — every rule,
> invariant, and edge case — into a model you can read, verify, and rebuild from.

**B. The AI-drift cut (aimed at the Skeptic Lead):**
> # AI can write the code. It can't tell you the code is right.
> Specy is the specification your AI builds from — and the oracle it gets checked
> against. Explicit intent in. Traceable code out. No drift.

**C. The plain-truth cut (shortest, most confident):**
> # Code is a derivation. Knowledge is the asset.
> Make your domain explicit, executable, and impossible to lose.

### The three-sentence explainer (for the section right under the hero)

> Specy is a set of 8 AI agent skills that work on three plain-text file formats: a
> **`.prd`** for product intent, a **`.sysreq`** for testable EARS requirements, and a
> **`.domain`** for the domain model itself. Every element carries an ID and a
> `satisfies` link, so any line of generated code traces back to the requirement — and
> the product decision — that justifies it. It runs inside Claude Code, so the model
> lives in your repo, in your PRs, next to the code it governs.

### Section: "The round trip" — this is the money section

> ## Both directions. That's the whole point.
>
> Most tools go one way: spec → code (and rot), or code → docs (and rot). Specy closes
> the loop.
>
> **Forward — intent to code**
> `specy:prd-design` → `specy:sysreq-design` → `specy:domain-design` →
> `specy:domain-build-code`
> A product idea becomes a PRD, becomes testable EARS requirements, becomes a domain
> model, becomes hexagonal Java/Spring, TypeScript/NestJS, or Clojure — with the
> requirement ID attached to every artifact along the way.
>
> **Backward — code to intent**
> `specy:domain-extract-from-code` → `specy:domain-refactor` →
> `specy:sysreq-extract-from-code`
> A legacy codebase becomes a faithful domain model (design debt and all), then a
> *properly designed* one — anemic entities fixed, primitive obsession resolved, illegal
> states made unrepresentable — plus the EARS requirements describing what the system
> was really doing all along.
>
> **The loop is the product.** Extract what you have. See what you'd have lost. Rebuild
> it on purpose.

### Section: "What makes the model worth trusting"

Sell the metamodel's *depth* — it's the real moat and the site barely mentions it.

> ## A model that can hold what your business actually does
>
> Anyone can model an `Order` with a `status` field. Real systems break on the parts
> most tools can't express:
>
> - **Time as a first-class cause.** Deadlines, expiries, and recurring cycles are
>   modeled as *temporal events* with guards — "the driver-arrival deadline fires 5
>   minutes after ETA, *unless* the driver already arrived." Not a cron job hidden in
>   infra. A domain fact.
> - **Rules that say what happens when they're broken.** Every invariant declares its
>   enforcement: reject, compensate, or alert. The rule and its consequence live
>   together.
> - **Truths no single transaction can guarantee.** Cross-aggregate *agreements* with
>   explicit *reconciliation* and *escalation chains* — because the real question was
>   never "is this consistent," it was "who fixes it when it isn't, and what happens if
>   that fails too."
> - **Strategic design that survives contact with reality.** Full context mapping — OHS,
>   ACL, Conformist, Shared Kernel, Published Language — with the behavioral obligations
>   each pattern imposes, not just arrows on a diagram.
> - **Traceability that goes all the way up.** Every entity, invariant, and event carries
>   a `satisfies [REQ-...]`. Ask "why does this code exist?" and get an answer that ends
>   at a product decision, not a shrug.
>
> `[ Read the metamodel → ]`

### Section: "See it work" — show, don't claim

Put a real diff on the page. Suggested three-panel scroller using the **url-shortener**
or **business-loan** example (both are complete `.prd` → `.sysreq` → `.domain`):

**Panel 1 — the requirement**
```
REQ-LNK-004 "Slug format" : ubiquitous
  :: "URL-safe identifiers keep short links portable across channels"
  "The system shall accept only alphanumeric characters and hyphens in a slug."
  priority must
```
**Panel 2 — the model**
```
value Slug {
  satisfies [REQ-LNK-004, REQ-LNK-005]
  :: "A URL-safe identifier that forms the path segment of a short link"
  value : String
  invariant "alphanumeric-and-hyphens" {
    must { value matches [a-zA-Z0-9-]+ }
    message "A slug must contain only alphanumeric characters and hyphens"
    enforcement reject
  }
}
```
**Panel 3 — the code** (generated, with the trace comment intact)

Caption:
> Three files. One chain. Change the requirement and you can find every line of code
> that has to change with it — before the AI touches any of them.

### Section: "Why not just prompt?"

Keep this — it's the sharpest existing copy — but tighten and add the missing beat:

> ## Why not just prompt?
>
> Because a prompt is a conversation and a model is an artifact.
>
> | | Prompts | Specy |
> |---|---|---|
> | Lives in | A chat window | Your repo, your PR, your git history |
> | Reviewable by | Whoever's watching | A product owner, in 10 lines of DSL, *before* code exists |
> | Verifiable | No | Yes — the model is the oracle the code is checked against |
> | Survives a rewrite | No | It's what you rewrite *from* |
> | Diffable | No | `git diff` on your business rules |
>
> The point isn't that prompting is bad. It's that **something has to be true when the
> prompt is gone.**

### CTAs (in priority order)

1. **`Install the plugin`** — 3 commands, works in 60 seconds. Show them inline; do not
   hide behind a docs link.
2. **`Extract a model from your codebase`** — the highest-intent action a Modernizer can
   take. This is the demo that sells.
3. **`Browse a complete model`** — link straight into `examples/business-loan/` (75KB
   `.domain`, 50KB `.sysreq`, 52KB `.prd` — the scale itself is the proof).

---

## Part 4 — Proposed site structure

Current README tries to be homepage, docs, reference, and manifesto at once. Split it.

```
/                    Home — the round trip, the metamodel depth, 60-second install
/legacy              "Modernize without losing the rules"  ← primary ICP landing page
/skills              The 8 skills: input → output, one card each
/metamodel           The depth play. Concepts, why each exists, the DDD lineage
/examples            4 complete projects, browsable in-page (not just a repo link)
/vision              Where this goes — clearly labeled as roadmap
/docs                Install, build, grammar reference, tree-sitter
```

### The `/skills` cards — copy for each (use the "input → output" frame; it's already
the skills' own idiom and it's unusually clear)

| Skill | Card headline | Input → Output |
|---|---|---|
| `prd-design` | **Start with why.** | An idea, a brief, meeting notes → a `.prd` with personas, jobs-to-be-done, goals, hypotheses, and non-goals |
| `sysreq-design` | **Make it testable.** | A `.prd` or prose → `.sysreq` in EARS syntax — every requirement unambiguous, prioritized, and traceable to the product decision behind it |
| `domain-design` | **Model the business.** | Requirements or prose → a `.domain` with entities, aggregates, events, state machines, invariants, and reactions |
| `domain-build-code` | **Ship it.** | A `.domain` → idiomatic hexagonal code in Java/Spring, TypeScript/NestJS, or Clojure — domain layer free of framework concerns |
| `domain-extract-from-code` | **Find out what you actually built.** | A codebase → a `.domain`, derived `.sysreq`, and a gaps report marking every rule the grammar couldn't express |
| `domain-refactor` | **Fix what the code taught you.** | An extracted (honest but ugly) model → a redesigned one: anemic entities enriched, primitive obsession resolved, illegal states made unrepresentable |
| `sysreq-extract-from-code` | **Answer "what does this system do?"** | A codebase → formal EARS requirements per bounded context — for audits, migrations, and onboarding |
| `domain-dialogue` | **Interrogate the model.** | An existing `.domain` → a conversation. Read-only. It will tell you what the model *doesn't* say — which is usually the thing you needed to know. |

### `/legacy` — the ICP landing page (outline + key copy)

> # You can't rewrite what you can't read.
>
> Twelve years of business rules. Three generations of developers, two of them gone. A
> `timeout: 30s` that's actually a partner SLA. A field order that's actually a
> regulation. Rewriting means either preserving all of it — or finding out which parts
> mattered in production.
>
> **Specy extracts it. Explicitly. In three phases.**
>
> 1. **Distill** — Point the extractor at the source. Get a `.domain` model, the EARS
>    requirements the code actually enforces, and a gaps report flagging every rule the
>    model *couldn't* express cleanly. No running environment, no DBA, no instrumentation
>    required. Source access is enough.
> 2. **Review** — Read the model with your domain experts. The `// UNCLEAR:` markers are
>    the meeting agenda: these are the places where the code does something and nobody
>    left a note saying why.
> 3. **Rebuild** — Refactor the model into the design you'd have chosen if you'd known
>    then what you know now. Generate the new system from it. Every new line traces back
>    to a rule the old system enforced.
>
> **The deliverable a CTO can act on:** three columns — *the intent*, *where the old
> system materializes it*, *whether the new one still does.*

Proof asset needed for this page: **one public extraction case study.** Run the pipeline
on a well-known OSS business system, publish the model + gaps report. This single asset
will do more selling than the rest of the site combined.

---

## Part 5 — Messaging discipline: what to say, what to stop saying

### Say this

- "Extract the business knowledge buried in your legacy code." *(concrete, ownable)*
- "Every line of generated code traces to a requirement, and every requirement traces to
  a product decision." *(true, verifiable, and unusual)*
- "The model is in your repo, in your PR, in your git history." *(kills the 'another tool
  to maintain' objection before it's raised)*
- "Time, failure, and cross-aggregate consistency are first-class." *(the metamodel's
  genuine differentiators — temporal events, error events, agreements)*
- "It can't rot, because it's the mechanism, not the documentation." *(the single best
  line in VISION.md — promote it to the site)*

### Stop saying this

- **"Toolkit."** It's a passive word for a product whose whole claim is that it's in the
  critical path.
- **"DDD toolkit."** DDD is the *how*, not the *why anyone buys*. It also narrows the
  market to people who already read Evans. Keep DDD as the credibility layer on
  `/metamodel`, not as the headline.
- **`.struct` / `.flow` / `.journey` / "three circles."** These are not what ships.
  Anywhere they appear publicly, they create a promise the download breaks. Fix VISION.md
  or clearly stamp it *roadmap*.
- **"Three verification loops" as a present-tense capability.** Build works. Check is
  partial. **Observe does not exist yet.** Sell Build honestly, describe Check accurately,
  and put Observe on the roadmap where it belongs — it's a great story *as a roadmap*, and
  a liability as a claim.
- **"AI-native," "revolutionary," "seamless."** The product is specific enough that
  vague superlatives actively cheapen it.

### Objection handling (put these on the page — as an FAQ or inline)

| Objection | Response |
|---|---|
| *"Another model to keep in sync."* | It isn't a side artifact. Code is generated from it and checked against it — if it drifts, your build tells you. It can't rot because it's the mechanism, not the documentation. |
| *"We tried UML/MDA. It died."* | Those models lived *beside* the workflow, and maintenance depended on discipline. Discipline decays. Specy sits *in* the workflow: no model, no generation, no check. |
| *"Our domain is too complex for a DSL."* | The metamodel handles temporal events, guards, cross-aggregate agreements, reconciliation with escalation chains, and full context mapping. Open `examples/business-loan/` — 75KB of real model — and tell us what's missing. (Genuinely: what's missing goes in the gaps backlog.) |
| *"Isn't this just prompting with extra steps?"* | The extra step is the one that makes the output verifiable. A prompt produces code you have to trust. A model produces code you can check. |
| *"Why do I need this if the AI keeps getting better?"* | Better models write better code *against whatever intent you gave them*. They don't know what your compliance officer decided in 2019. Nothing about model capability makes implicit knowledge explicit. |

---

## Part 6 — Proof and credibility assets (ranked by impact per unit of effort)

1. **A public legacy-extraction case study.** Real OSS codebase → `.domain` + gaps report
   + "here are 6 business rules that were only in the code." *This is the whole pitch,
   demonstrated.* Highest priority by a wide margin.
2. **An interactive example browser on the site.** The four examples (business-loan,
   ride-now, url-shortener, ecommerce) are extraordinary proof of depth and are currently
   one repo link away — meaning nobody sees them. Render them in-page with the traceability
   chain clickable: click `satisfies [REQ-LNK-004]` and jump to the requirement.
3. **A 90-second screen recording of the round trip.** Extract → refactor → generate.
   No narration needed; the file diffs tell the story.
4. **The gaps backlog, published.** `proposals/grammar-gaps-backlog.md` is an unusual
   credibility asset: a tool that publicly tracks what it *can't* yet express reads as
   serious engineering, not marketing. Very few dev-tool companies are confident enough
   to do this. Do it.
5. **The metamodel diagram** (`specy-DDD-metamodel.png`, `metamodel-comparison.svg`) — 
   already exists, is genuinely impressive, deserves to be a page not a README image.

---

## Part 7 — SEO / discovery

The audience doesn't search "DDD DSL." They search their pain.

**Primary intent clusters to own:**
- *legacy modernization* — "extract business rules from legacy code", "document what a
  legacy system does", "reverse engineer domain model from code", "legacy rewrite
  without losing business logic"
- *AI code trust* — "verify AI generated code correctness", "AI code drift",
  "specification for AI coding agents", "how to stop AI hallucinating business logic"
- *DDD practice* — "event storming to code", "domain model DSL", "bounded context
  mapping tool", "EARS requirements example" *(EARS has real search volume and almost no
  good tooling content — a cheap win)*
- *Claude Code ecosystem* — "Claude Code plugin", "Claude Code skills", "Claude Code
  DDD"

**Content that would rank and convert (write these, in order):**
1. "We extracted the domain model from [well-known OSS system]. Here's what nobody
   documented." *(the case study, as a post)*
2. "EARS requirements: a practical guide with a real 500-requirement example." *(pure
   SEO capture; the `examples/` folder already contains the artifact)*
3. "Why AI-generated code drifts — and what a specification layer actually fixes."
4. "Temporal events: the domain concept most models are missing." *(genuinely novel
   technical content; the metamodel's treatment of time is the most original thing in it)*

---

## Part 8 — Concrete refactor checklist

**Do first (highest leverage):**
- [ ] Rewrite the hero: lead with the outcome (verifiable business logic), not the
      category (DDD toolkit).
- [ ] Build the **round-trip** section — forward *and* backward pipelines side by side.
      This is the differentiator and it's currently unstated.
- [ ] Create `/legacy` as a dedicated ICP landing page.
- [ ] Purge `.struct` / `.flow` / `.journey` / "three circles" / "observe loop" from all
      present-tense public copy; move to a clearly-labeled `/vision`.
- [ ] Put a real traceability chain on the homepage (requirement → model → code, three
      panels).

**Do next:**
- [ ] Publish one legacy-extraction case study.
- [ ] Render `examples/` in-browser with clickable `satisfies` links.
- [ ] Split README: homepage copy vs. `/docs` reference. The current 30KB README is
      doing four jobs and none of them well.
- [ ] Add the objection FAQ (Part 5) — the "another model to maintain" and "UML died"
      objections *will* be raised and the answers are strong.

**Do when there's time:**
- [ ] `/metamodel` as a standalone page (the depth play for the DDD crowd).
- [ ] 90-second round-trip screen recording.
- [ ] The four SEO posts.

---

## Part 9 — The one-paragraph version, if you only refactor one thing

> Every company now generates code faster than it can verify the code means the right
> thing. Specy is the missing artifact: a versioned, machine-readable model of what your
> business actually does — extracted from the legacy system that already does it, refined
> with the people who understand it, and used as both the source that AI generates from
> and the oracle it gets checked against. Code is a derivation. Knowledge is the asset.
> Stop keeping the asset in your developers' heads.

---

*Written 2026-07-11 from a full read of the 8 skill definitions, the three metamodels,
README.md, VISION.md, and the four worked examples. Every capability claim in the
suggested copy is traceable to a shipped skill; every aspirational claim is flagged as
such.*
