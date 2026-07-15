# Grammar Gaps Backlog — `tree-sitter-specy-domain`

Tracks divergences between what the metamodel and authored examples treat as legal Specy v3 syntax, and what the `tree-sitter-specy-domain` parser currently accepts. Each gap carries a unique `GAP-0xx` ID, severity, evidence, and a proposed grammar change.

## Severity scale

| Severity | Meaning |
|---|---|
| **critical** | Top-level construct fails to parse; cascades errors over the rest of the file. |
| **high** | A widely used inner construct fails — file parses partially. |
| **medium** | Niche construct, used in 1–2 examples. AST has localized ERROR nodes. |
| **low** | Cosmetic or rare; tooling can degrade gracefully. |

## Status

| ID | Severity | Construct | Status |
|---|---|---|---|
| GAP-001 | critical | `shortname Identifier` (no parens) | **resolved** |
| GAP-002 | high | `format(identifier)` field constraint | **resolved** |
| GAP-003 | high | `:: "rationale"` operator on headers | resolved-by-investigation (already supported) |
| GAP-004 | high | `aggregate Name root EntityName { contains [E1, E2] }` short form | **resolved** |
| GAP-005 | medium | Natural-language invariant body — `is one-way hash` | **resolved** (example rewritten to a structured predicate) |
| GAP-006 | medium | `forall X : exists Y where …` quantified predicate in `agreement` | **resolved** (opaque `text_predicate` fallback) |
| GAP-007 | medium | `enum Name { … }` at context level | resolved-by-investigation (already supported) |
| GAP-008 | medium | `infrastructure-service` hyphenated keyword | resolved-by-investigation (already supported) |
| GAP-009 | low | `temporal-event … { recurring "<cron>" per-market }` and `relative-to … offset …` | **resolved** |
| GAP-010 | low | `external-event Name from OtherContext` shorthand | **resolved** |
| GAP-011 | high | `;`/`,`-separated fields in `fields { a:T; b:T }` | **resolved** |
| GAP-012 | high | Compound-prefix requirement IDs (`REQ-DRV-NFR-005`) | **resolved** |
| GAP-013 | high | `enforcement reject` clause on `scoped_invariant_def` | **resolved** |
| GAP-014 | high | `precondition X { … }` without trailing `rejects "msg"` | **resolved** |
| GAP-015 | high | Compact duration literals (`60s`, `5min`, `1businessDay`) | **resolved** |
| GAP-016 | high | `statemachine X on Entity { … }` header form | **resolved** |
| GAP-017 | high | camelCase state names (`pendingVerification`) | **resolved** |
| GAP-018 | high | `transition X -> Y on EventName` | **resolved** |
| GAP-019 | high | `state X { invariant identifier { expr } }` | **resolved** |
| GAP-020 | high | `function_name` closed list — needed for constructors and helpers | **resolved** |
| GAP-021 | high | `if X then Y else Z` ternary expression | **resolved** |
| GAP-022 | medium | `is null` / `is not null` predicates | **resolved** |
| GAP-023 | medium | `null` literal | **resolved** |
| GAP-024 | medium | Quantifier expression `exists/forall VAR in COLLECTION where …` (in regular expressions, not just `predicate {}`) | **resolved** |
| GAP-025 | high | `reaction Name :: "…" { trigger T, guard E, effect F }` (modern reaction form) | **resolved** |
| GAP-026 | medium | Block comments `/* … */` | **resolved** |
| GAP-027 | medium | `;` / `,` after `=` assignments in `sets { … }` blocks | **resolved** |
| GAP-028 | low | `bytes`, `any` primitive types | **resolved** |
| GAP-029 | medium | Safe-navigation `fee?.amount` and null-coalescing `expr ?: default` | **resolved** |
| GAP-030 | medium | Member access chained after function/service call (`f().member`, `Svc.fn().member`) | **resolved** |
| GAP-031 | medium | `agreement` block — bracketed `participants [...]`, `escalation [...]`, identifier-named `reconciliation`, freeform `detection "..."`, `response <id>` | **resolved** |
| GAP-032 | high | Multi-line precondition/postcondition bodies (implicit-conjunction style) | **resolved** |
| GAP-033 | high | `tree-sitter-specy-prd`: `//` and `/* */` comments | **resolved** |
| GAP-034 | high | `tree-sitter-specy-sysreq`: `source` / `depends-on` / `decomposed-into` allowed before statement (any order with rationale) | **resolved** |
| GAP-035 | medium | `tree-sitter-specy-prd`: journey step body — fields in any order, `action` optional (step name doubles as action) | **resolved** |
| GAP-036 | medium | `tree-sitter-specy-prd`: release body — fields in any order; remove rigid `target-date / theme / status` sequencing | **resolved** |

## Smoke-test snapshot

| File | Before patches | After patches |
|---|---|---|
| `business-loan.{prd,sysreq,domain}` | 0 | **0 ✓** |
| `url-shortener.{prd,sysreq}` | 0 | **0 ✓** |
| `url-shortener.domain` | 8 | **0 ✓** |
| `ride-now/driver-management.domain` | 217 | **0 ✓** |
| `ride-now/rider-management.domain` | 135 | **0 ✓** |
| `ride-now/geolocation-routing.domain` | 79 | **0 ✓** |
| `ride-now/payment.domain` | 390 | **0 ✓** |
| `ride-now/ride-management.domain` | 329 | **0 ✓** |
| **ride-now total** | **1150** | **0 (100% clean)** |

## Resolution priority for remaining open gaps

1. **GAP-004** (aggregate short form) — single grammar change, frequent in ride-now.
2. **GAP-008** (`infrastructure-service` token) — verify whether the keyword tokenization is correct; small fix if not.
3. **GAP-009 / GAP-010** (temporal-event recurring/per-market, external-event from-import) — both small additions.

_All predicate sub-grammar gaps (GAP-005/006) are now resolved — see change log._

---

## Resolved gaps — change log

### GAP-001 — `shortname` requires parentheses *(resolved)*

**Patch (`grammar.js:64`):**
```js
shortname: $ => choice(
  seq('shortname', $.identifier),
  seq('shortname', '(', $.identifier, ')'),
  seq('(', $.identifier, ')'),
),
```

Accepts `shortname X`, `shortname (X)`, and the legacy bare `(X)` form for backward compatibility.

### GAP-002 — `format(identifier)` field constraint *(resolved)*

**Patch (`grammar.js`, in `constraint` choice):**
```js
seq('format', '(', $.identifier, ')'),
```

Now accepts `string format(email)`, `string format(uri)`, etc.

### GAP-011 — `;` / `,` separated fields *(resolved)*

**Patch (`grammar.js:field_decl`):**
```js
field_decl: $ => seq(
  field('name', $._field_name),
  ':',
  $.field_type_opt,
  repeat($.constraint),
  optional(choice(';', ',')),
),
```

Inline fields like `fields { a : string; b : int }` and `fields { a : string, b : int }` now parse.

### GAP-012 — Compound-prefix requirement IDs *(resolved)*

**Patch (`grammar.js:requirement_id`):**
```js
requirement_id: $ => token(/REQ-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-\d{3}/),
```

Now matches `REQ-DRV-NFR-005`, `REQ-RDR-NFR-001`, `REQ-PAY-NFR-006`, etc.

### GAP-013 — `enforcement` clause on scoped invariants *(resolved)*

**Patch (`grammar.js:scoped_invariant_def`):**
Added `optional(seq('enforcement', choice('reject', 'warn', 'rejection', 'compensation', 'alert')))` between description and metadata.

### GAP-014 — `rejects "msg"` made optional on preconditions *(resolved)*

**Patch (`grammar.js:precondition_clause`):**
```js
optional(seq('rejects', $.string_literal)),
```

Preconditions can now omit the trailing rejection message.

### GAP-015 — Compact duration literals *(resolved)*

**Patch (`grammar.js:duration_literal`):**
```js
duration_literal: $ => choice(
  seq($.number, choice('months', 'days', 'years', 'hours', 'minutes', 'seconds', 'weeks')),
  seq($.number, token.immediate(/(?:businessDays|businessDay|seconds|minutes|months|hours|weeks|years|days|min|ms|s|h|d|w|y)/)),
),
```

`60s`, `5min`, `30days`, `1businessDay`, `2businessDays` parse via `token.immediate` (zero whitespace between number and unit).

### GAP-016 / 017 / 018 / 019 — Statemachine modernization *(resolved)*

**Patches in `grammar.js`:**
```js
statemachine_def: $ => seq(
  'statemachine',
  field('name', $.type_name),
  optional(seq('on', field('entity', $.type_name))),     // GAP-016
  '{', repeat($._statemachine_item), '}',
),

_state_name: $ => choice($.type_name, $.identifier),     // GAP-017

state_def_simple: $ => seq(
  'state',
  field('name', $._state_name),
  optional(seq(
    '{',
    repeat(choice($.inline_invariant, $.scoped_invariant_def)),  // GAP-019
    '}',
  )),
),

transition_inline: $ => seq(
  'transition',
  field('from', $._state_name),
  '->',
  field('to', $._state_name),
  choice(
    seq('triggered-by', field('trigger', $.string_literal)),
    seq('on', field('trigger', $.type_name)),            // GAP-018
  ),
),

final_state: $ => seq('final', $._state_name),
```

---

## Open gaps — proposed patches

### GAP-004 — `aggregate Name root EntityName { contains [...] }` short form

**Used syntax:**
```
aggregate DriverAggregate root Driver { contains [Vehicle, IdentityDocument] }
aggregate PaymentAggregate root Payment
```

**Proposed:**
```js
aggregate_def: $ => seq(
  'aggregate',
  field('name', $.type_name),
  optional($.description),
  optional($.metadata_block),
  choice(
    // long form
    seq('{', repeat($._aggregate_body_item), '}'),
    // short form: with optional contains block
    seq('root', field('root', $.type_name),
        optional(seq('{', $.aggregate_contains_decl, '}'))),
  ),
),
```

### GAP-006 — Predicate sub-grammar (agreement prose) *(resolved)*

**Resolution — Option 2 (text fallback).** `agreement`/`reconciliation` predicate bodies are authored as freeform business prose (`forall deleted Publisher : no … references … within 30 days`, `count(Click where shortLinkId)`). The structured expression grammar cannot express these, and tree-sitter's lexer cannot conditionally fall back (lexical precedence is all-or-nothing — a `choice(expr, text_predicate)` never forks, since the structured tokens always win the lexer). So `predicate { … }` bodies are parsed as opaque text:

```js
predicate_block: $ => seq('predicate', '{', $.text_predicate, '}'),

// Excludes braces so it stops at the closing `}`.
text_predicate: $ => token(prec(-1, /[^{}]+/)),
```

Authors keep prose predicates as documentation; semantic validation is deferred to the LSP/checker. The four `predicate {}` bodies in url-shortener.domain now parse cleanly as `text_predicate`.

### GAP-005 — Natural-language invariant body *(resolved)*

**Resolution — fix the example, keep `must {}` strict.** Unlike agreement predicates, `must { … }` invariant bodies almost always hold real boolean expressions (`balance >= 0`) that should retain structured `comparison`/`is_*` ASTs for highlighting and checking. Making `must {}` opaque to absorb one prose line would regress every invariant repo-wide. The single offender —

```
must { apiKeyHash is one-way hash }   // not an expression — "one-way hash" is prose
```

— was rewritten to a structured predicate, with the one-way-hashing intent moved to the `::` rationale and `message`:

```
must { apiKeyHash is not null }   // is_not_null_expr (GAP-022)
message "API keys must never be stored in plaintext; persist only a one-way hash"
```

`must {}` therefore stays structured. `url-shortener.domain` now parses with **0 errors**.

---

# Gaps opened by the 2026-07-11 normative-grammar migration

`src/grammars/domain.ebnf` was rewritten to faithfully express `DOMAIN-METAMODEL.md`, and
the 9-file example corpus was migrated to it. Both parsers are clean on all 9 files, but the
migration left **27 `// UNCLEAR:` markers**. They are not one-offs — they cluster into nine
families, each a genuine limitation of the grammar (not of the corpus).

| ID | Severity | Gap | Occurrences |
|---|---|---|---|
| GAP-037 | **high** | A command handled by an adapter has no operation to target it | 7 |
| GAP-038 | **high** | `effects` cannot carry argument bindings | ~12 |
| GAP-039 | medium | A command-triggered operation cannot declare a return type | 3 |
| GAP-040 | medium | Invariants scoped to something other than an entity/aggregate/value | 3 |
| GAP-041 | medium | A reaction cannot effect a *published event* to another context | 3 |
| GAP-042 | medium | A relative temporal event cannot anchor on an entity timestamp field | 1 |
| GAP-043 | medium | Predicates cannot express a temporal bound (grace period / window) | 3 |
| GAP-044 | low | No structural predicate over fields (`no field contains PII`) | 2 |
| GAP-045 | low | A state machine's start transition must name an operation | 1 |

### GAP-037 — a command handled by an adapter has no operation to target it — **high**

The metamodel says a command `1..1 "triggers"` an operation owned by an entity, aggregate or
domain service. But `NotifyDriver`, `SendVerificationCode`, `ExportAnalyticsCsv` and friends are
handled *entirely by an infrastructure adapter* — there is no domain state change, so there is no
domain operation to own them. Today the modeler must either invent a hollow operation or leave the
command dangling (which is what all 7 sites do, with an `// UNCLEAR:`).

Desired syntax — let a command name the infrastructure service that handles it:

```
command NotifyDriver { handled-by NotificationGateway  identity commandId : uuid  fields { … } }
```

Occurrences: `url-shortener` ×4, `ride-management` ×1 (covering 4 commands), `payment` ×1 (3 commands),
`rider-management` ×1 (2 commands), `driver-management` ×1.

### GAP-038 — `effects` cannot carry argument bindings — **high**

`reactionDef`'s `effects` names a command type and nothing else, so a reaction cannot say *what*
command instance it issues. Every reaction that carried real content — a notification's subject and
body, a suspension's duration — lost it in migration; the ride-now agent had to move that content into
the reaction's `::` description, where no tool can read it.

Desired syntax (mirroring `emits`):

```
reaction SuspendDriverOnFraud {
    triggered-by FraudDetected
    effects RequestTemporaryDriverSuspension { driverId = FraudDetected.driverId  duration = 7 days }
}
```

This is the single highest-value gap: it is the difference between a reaction that a code generator
can emit and one it cannot.

### GAP-039 — a command-triggered operation cannot declare a return type — medium

`commandTriggeredOp = stringLiteral , "on" , typeName , … ` has no `: ReturnType` slot, so
`returns netInterest : Money` was lost at 3 sites in `business-loan`. Arguably correct — a command
produces *events*, not a return value — but the corpus disagrees, and the lost type is real
information. Either add the slot, or state the prohibition in the metamodel so the modeler knows to
model the result as an event.

### GAP-040 — invariants scoped to something other than an entity/aggregate/value — medium

The metamodel scopes an invariant to a consistency boundary (entity, aggregate, value, state).
`business-loan` needed three that belong to *neither*: `EventImmutability` (a property of the event
store), `ReportConsistencyWithEventStore` (of the reporting pipeline), `RbacPolicy` (an operation-level
authorisation policy). All three were hoisted to top-level invariants pointed at an arbitrary entity.
This is a metamodel question before it is a grammar one.

### GAP-041 — a reaction cannot effect a published event — medium

Three reactions in `geolocation-routing` / `ride-management` had `effect publish X to OtherContext`.
The metamodel is explicit that a reaction's effect is a **command**, so publication had to be re-modelled
on the consuming side; two reactions were deleted outright (their text preserved in a `// NOTE:`).
If cross-context publication is a first-class act, the metamodel should say so.

### GAP-042 — a relative temporal event cannot anchor on an entity timestamp field — medium

`relativeTemporalEvent`'s `reference` takes a `typeName` — an **event**. `ride-management` needed
`relative-to RideOffer.offeredAt offset 15s`, i.e. an offset from an entity *field*. There is no
"offer made" event to reference, so the anchor was faked. `instant` takes a dot-path but admits no
offset. Desired: allow `reference <dotPath> offset <duration>`.

### GAP-043 — predicates cannot express a temporal bound — medium

Three agreement/invariant predicates were prose carrying a time window: a 60-second matching grace
period, a 30-second analytics consistency bound, a 30-day GDPR erasure deadline. The expression
language has durations but no way to say "within D of event E". The bounds now survive only in
reconciliation triggers and comments.

### GAP-044 — no structural predicate over fields — low

`url-shortener` has two predicates of the form "no field of this type contains PII". This quantifies
over *fields*, not values — the expression language has no such quantifier. (The old tree-sitter
grammar had a `no field contains` production; the normative grammar dropped it as unprincipled. It
should return as a designed construct or be declared out of scope.)

### GAP-045 — a state machine's start transition must name an operation — low

`transitionDef` requires `on <operationRef>`, including for `[*] --> s`. `SurgeZone` is created by an
external process, so no operation drives its start transition, and it has none. Either allow the start
transition to omit `on`, or require every entity to declare its creating operation.
