## Product requirements (`.prd`)

A PRD is the model Markdown fits best: the canonical document reads like the PRD a product team would write, and the reader accepts the way people and language models actually write one. The document is one `# product` heading, the four product-level sections, then one section per element.

### Headings

| Heading | DSL |
|---|---|
| `# product Sniplink` | `product "Sniplink" { … }` |
| `## Vision` + a paragraph | `vision "…"` (tolerated: `**Vision:**`, or the first paragraph under the product when no vision is given, reported as `MD-VISION`) |
| `## Scope` + a bullet list | `scope { "…" "…" }` (tolerated: `In scope`, `**Scope:**` + list) |
| `## Non-goals` + a bullet list | `non-goals { … }` (tolerated: `Out of scope`, `**Non-goals:**` + list) |
| `## Problem` + `**Situation:**`, `**Complication:**`, `**Question:**` | `problem { situation … complication … question … }` (tolerated: `Problem statement`, the three as `###` sub-headings with a paragraph each) |
| `## evidence Application abandonment rate` | `evidence "…" { … }` |
| `## persona Publisher` (tolerated: `user persona`, `actor`) | `persona "Publisher" { … }` |
| `## job Share a clean link quickly` (tolerated: `job to be done`, `jtbd`) | `job "…" { … }` |
| `## goal Drive weekly active publishers` (tolerated: `objective`) | `goal "…" { … }` |
| `## hypothesis Auto-channel detection drives adoption` | `hypothesis "…" { … }` |
| `## feature FEAT-001 Link shortening` (tolerated: `capability`; `## FEAT-001 Link shortening` with no kind word) | `feature FEAT-001 "Link shortening" { … }` — the id is optional and recognized by its pattern |
| `### story US-001 As a publisher, I want …` under a feature (tolerated: `user story`; `### US-001 …`) | `stories { US-001 "…" { acceptance-criteria { … } } }` |
| `## assumption …`, `## risk …`, `## constraint …` | `assumption "…" { … }`, `risk …`, `constraint …` |
| `## open-question Auto-approval threshold` (tolerated: `open question`, `question`) | `open-question "…" { … }` |
| `## release R1 — Core shortener` (tolerated: `milestone`) | `release "R1 — Core shortener" { … }` |
| `## journey Publisher shortens and shares a link` (tolerated: `user journey`) | `journey "…" for "<persona>" { … }` — the persona comes from the `**Persona:**` line |

Group headings, under which a bare-name heading takes the group's kind (`MD-DEFAULT-KIND`): `Evidence`, `Personas` / `Users` / `Actors`, `Jobs` / `Jobs to be done`, `Goals` / `Objectives`, `Hypotheses`, `Features` / `Capabilities`, `Stories` / `User stories` (inside a feature), `Assumptions`, `Risks`, `Constraints`, `Open questions` / `Questions`, `Releases` / `Roadmap` / `Milestones`, `Journeys` / `User journeys`.

The first plain paragraph under an element's heading is its main text when that clause has no label: the `summary` of a feature, the `statement` of a job, goal, assumption, risk or constraint, the `role` of a persona, the `intervention` of a hypothesis, the `question` of an open question, the `theme` of a release, the `summary` of a piece of evidence.

### Labels

Each clause is a `**Label:** value` line (or a `- Label: value` bullet; several labels on one line separated by ` · `). Enumerated values are written as the DSL spells them or in words (`Nice to have` reads as `nice-to-have`, `In progress` as `in-progress`). A required clause that is missing is an `MD-MISSING` error naming the label; a placeholder keeps the model readable.

| Element | Labels (canonical, then aliases) | DSL |
|---|---|---|
| evidence | `Type`; `Summary`; `Source reference` (`Source`, `Reference`); `Date` (YYYY-MM-DD); `Confidence`; `Supports` | `type …`, `summary "…"`, `source-reference "…"`, `date …`, `confidence …`, `supports "…"` |
| persona | `Role` (`Who`); `Goals` + list (`Wants`, `Needs`); `Frustrations` + list (`Pain points`); `Context` (`Environment`); `Weight` (`Priority`) | `role "…"`, `goals { … }`, `frustrations { … }`, `context "…"`, `weight primary` |
| job | `Persona` (`For`, `Actor`); `Statement`; `Type`; `Importance`; `Satisfaction` (`Current satisfaction`); `Related to` (`Related jobs`); `Desired outcomes` + table or list | `persona "…"`, `statement "…"`, `type functional`, `importance critical`, `satisfaction underserved`, `related-to "…", "…"`, `desired-outcomes { … }` |
| goal | `Statement` (`Objective`); `Horizon` (`Term`, `Timeframe`); `Owner`; `Metrics` + table or list (`KPIs`, `Success metrics`) | `statement "…"`, `horizon short-term`, `owner "…"`, `metric { … }` per row |
| hypothesis | `Intervention` (`If`, `We believe`); `Expected outcome` (`Then`, `We expect`); `Mechanism` (`Because`, `Why`); `Validation method` (`How we test`); `Status`; `Proposes` (`Feature`); `Predicts` (`Goal`); `Supported by` (`Evidence`) | the clauses in that order |
| feature | `Summary` (`Description`); `Persona` (`For`, `Target persona`); `Value proposition` (`Value`, `Benefit`); `Priority` (`MoSCoW`); `Status`; `Addresses` (`Jobs`); `Advances` (`Goals`); `Tested by` (`Hypothesis`); `Design references` + list; `Non-goals` + list (`Out of scope`); `Stories` + nested list, or `### story` sub-sections | `summary "…"`, `persona "…"`, `value-proposition "…"`, `priority must`, `status accepted`, `addresses "…"`, `advances "…"`, `tested-by "…"`, `design-references { … }`, `non-goals { … }`, `stories { … }` |
| story | `Acceptance criteria` + list (`Criteria`, `AC`): each item `AC-001-01 text` or plain text (a leading `[ ]` checkbox is ignored) | `US-001 "title" { acceptance-criteria { AC-001-01 "text" } }` |
| assumption | `Statement` (`We assume`); `Impact if wrong` (`Impact`, `Consequence`); `Validation plan` (`How we validate`); `Status`; `Underpins` (`Supports`) | `statement "…"`, `impact-if-wrong "…"`, `validation-plan "…"`, `status unvalidated`, `underpins "…"` |
| risk | `Statement`; `Likelihood` (`Probability`); `Impact` (`Severity`); `Mitigation` (`Strategy`, `Response`); `Owner`; `Threatens` (`Affects`) | `statement "…"`, `likelihood medium`, `impact high`, `mitigation mitigate`, `owner "…"`, `threatens "…"` |
| constraint | `Statement`; `Source` (`Origin`, `Type`); `Constrains` (`Applies to`) | `statement "…"`, `source regulatory`, `constrains "…"` |
| open question | `Question`; `Context` (`Background`); `Owner`; `Deadline` (`Due`, `By`); `Status`; `Blocks`; `Resolution` (`Answer`, `Decision`) | `question "…"`, `context "…"`, `owner "…"`, `deadline 2026-06-01`, `status open`, `blocks "…"`, `resolution "…"` |
| release | `Target date` (`Target`, `When`); `Theme` (`Focus`); `Status`; `Depends on` (`Dependencies`, `After`); `Includes` + list (`Features`, `Ships`); `Entry criteria` + list; `Exit criteria` + list (`Definition of done`) | `target-date "…"`, `theme "…"`, `status planned`, `depends-on "…"`, `includes { … }`, `entry-criteria { … }`, `exit-criteria { … }` |
| journey | `Persona` (`For`, `Actor`, `Who`); `Trigger` (`Starts when`); `Outcome` (`Ends with`, `Result`); `Design references` + list; `Steps` + table or list (`Flow`) | `journey "…" for "…" { trigger "…" outcome "…" design-references { … } steps { … } }` |

A name list (`Addresses`, `Advances`, `Related to`, `Supported by`, `Underpins`, `Threatens`, `Constrains`, `Blocks`, `Depends on`) is written inline, comma-separated, unless a name holds a comma — then one bullet per name; the reader accepts both. A text list (`Scope`, `Non-goals`, `Goals`, `Frustrations`, `Includes`, the criteria) is one bullet per text; inline, texts are separated by `;` or ` · ` so their commas survive.

### Tables, lists and islands

- **Desired outcomes** (job): a table `| outcome | importance | current satisfaction |`; tolerated: a list whose items read `statement — importance: high, current satisfaction: medium` or `statement (importance medium, satisfaction low)`.
- **Metrics** (goal): a table `| indicator | target | baseline | measurement |`; tolerated: a nested list, `- Indicator: …` with `- Target:`, `- Baseline:`, `- Measurement:` beneath it, or `indicator — target: … · baseline: … · measurement: …`.
- **Design references**: a list of `name → url` (also `name -> url`, `[name](url)`).
- **Steps** (journey): a table `| step | action | system response | channel | emotional tone | order |` — the `step` cell is the step's number (`step 1 { … }`) or its name (`"what the persona does" { … }`); tolerated: a list whose items are `step 1` or the step's name, with `- Action:`, `- System response:`, `- Channel:`, `- Emotional tone:`, `- Order:` beneath.
- **Stories**: `### story US-001 Title` sub-sections with their `**Acceptance criteria:**` list; tolerated: a `**Stories:**` nested list, one item per story (`US-001 Title`) whose children are the criteria.
- A sub-heading inside an element named like one of its labels (`#### Acceptance criteria`, `### Non-goals`, `### Steps`) is that label; any other sub-heading is read as part of the element with an `MD-HEADING` warning.
- The PRD has no formal fragments: no `specy` islands.

### Example

```markdown
---
specy: prd
---

# product Sniplink

## Vision

A URL shortener that unifies link sharing, click analytics and bookmark management.

## Scope

- Shorten a URL into a short, memorable link
- Per-channel click analytics without manual tagging

## Problem

**Situation:** Marketers share links across dozens of channels every day.
**Complication:** Existing shorteners treat analytics and bookmarks as separate concerns.
**Question:** How can we give publishers one workspace for every link they share?

## persona Publisher

**Role:** A marketer or developer who shares links professionally
**Goals:**
- Share clean, short, memorable URLs
- Know which channel drives the most clicks
**Frustrations:**
- Manual UTM tagging is tedious and error-prone
**Context:** Desktop browser; shares on Twitter/X, LinkedIn, Slack and newsletters
**Weight:** primary

## goal Drive weekly active publishers

**Statement:** Grow the number of publishers who shorten at least one link a week
**Horizon:** short-term
**Owner:** Head of Product

**Metrics:**

| indicator | target | baseline | measurement |
|---|---|---|---|
| Weekly active publishers | 500 within 6 months | 0 | Product analytics, weekly cohort |

## feature FEAT-001 Link shortening

**Summary:** Publisher pastes a long URL and instantly gets a short, shareable link
**Persona:** Publisher
**Value proposition:** Core utility — the action that brings publishers to the product
**Priority:** must
**Status:** accepted
**Addresses:** Share a clean link quickly
**Advances:** Drive weekly active publishers

### story US-001 As a publisher, I want to paste a URL and get a short link in one click

**Acceptance criteria:**
- AC-001-01 Short link is generated within 1 second of pasting the URL
- AC-001-02 Short link is copied to the clipboard automatically

## journey Publisher shortens and shares a link

**Persona:** Publisher
**Trigger:** Publisher has a blog post URL they want to share
**Outcome:** The link is shared and clicks are tracked per channel

**Steps:**

| step | action | system response | channel | emotional tone | order |
|---|---|---|---|---|---|
| 1 | Publisher pastes the long URL | Displays a short link with the page title | web | confident | |
| 2 | Publisher copies the short link | Link copied to the clipboard | web | delighted | |
```
