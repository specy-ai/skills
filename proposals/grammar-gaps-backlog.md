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
| GAP-005 | medium | Natural-language invariant body — `is one-way hash` | open (design needed) |
| GAP-006 | medium | `forall X : exists Y where …` quantified predicate in `agreement` | open (design needed) |
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
| `url-shortener.domain` | 8 | 7 (GAP-005/006 only — predicate sub-grammar) |
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
4. **GAP-005 / GAP-006** (predicate sub-grammar) — design work needed; defer.

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

### GAP-005 / GAP-006 — Predicate sub-grammar

**Discussion:** url-shortener.domain uses freeform natural-language predicate bodies in `must { … }` and `predicate { … }` blocks. Two options:

1. **Structured predicate** — define `forall <type> [as <id>] : exists <type> where <bool-expr>` and equivalents. Coverage: GAP-006 line 2245.
2. **Text fallback** — wrap any unrecognized predicate body in `text_predicate` so it parses as opaque text, leaving structural validation to the LSP/checker. Coverage: GAP-005 + GAP-006 line 2269.

Option 2 is cheaper and lets authors keep prose predicates as documentation while the parser still produces a clean AST.
