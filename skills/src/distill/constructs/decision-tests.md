# Decision Tests

Run these 4 tests **in sequence** on every element you are about to emit. If any test fails, apply the indicated action instead.

## Test 1 — "Is it real?"

> Can I point to a line of production code **or** test code that evidences this element?

- **Yes (production code)** → proceed to Test 2.
- **Yes (test code only)** → proceed to Test 2, but annotate with `// NOTE: evidenced by test ({test file})`.
- **No** → **do not emit**. Never invent logic absent from code.

### Evidence weight

Production code establishes **what exists** — the implementation. Test code establishes **what is expected** — the intent. When both sources converge on the same element, confidence is high. When a test reveals a behaviour not obvious in production code (e.g. an assertion on a side-effect buried in a helper), the test is sufficient evidence to emit, but the annotation signals reduced traceability.

**Non-regression rule:** absence of tests must never degrade extraction. When no test files exist or no test correlates to a handler, `distill` extracts from production code exactly as before. Tests improve confidence; they do not condition it.

## Test 2 — "Is it domain?"

> Would this element still exist if we swapped the technical stack (framework, database, transport)?

- **Yes** (business calculation, domain rule, business status) → proceed to Test 3.
- **No** (password hashing, MIME validation, rate limiting, caching, logging, token storage, metrics) → **omit** with `// NOTE: {description} (infrastructure)`.

### Grey-zone heuristic

If the result affects an entity field via `sets` or conditions the flow via `fails`, it is domain. Otherwise it is likely infrastructure.

### Separate the authorization mechanism from the protected action

A role check (`user.isAdmin`, `requirePermission`) is an **authorization mechanism** — infrastructure. But the action it protects (freeze a user, delete content, manage tokens) may be a **domain operation** that changes entity state. Evaluate the action independently of its guard: if the action passes Test 2, model the interaction; annotate the role check with `// UNCLEAR: admin role authorization`.

## Test 3 — "Is it faithful?"

> Does the expression I am about to write accurately reflect the actual condition in the code?

- **Yes** → proceed to Test 4.
- **No, but the rule is not business-critical** → **omit** with `// NOTE`.
- **No, and the rule is business-critical** → emit `// UNCLEAR: {full business rule description} ({why unexpressible})`.

### Common faithfulness traps

| Trap | Why it fails | Action |
|---|---|---|
| `field is defined` on a required/immutable field (in `fails` or `must`) | Always true → tautology | Use the real condition or `// UNCLEAR` |
| `now() - Entity.createdAt > 5` | No duration operator → ambiguous | `// UNCLEAR` with business rule |
| Status check masking a cross-aggregate rule | Real condition involves another aggregate | Model the cross-aggregate lookup or `// UNCLEAR` |
| Placeholder `when { totalAmount > 0 }` for fraud check | Real logic is an external API call | `// NOTE` (infrastructure) |

## Test 4 — "Is it the right construct?"

> Am I placing this element in the correct Specy construct type?

| Element is... | Correct construct |
|---|---|
| Has identity + mutable lifecycle | `entity` |
| No identity, immutable, equality by content | `value` |
| Fixed set of named constants | `enum` |
| Input DTO triggering a write | `command` |
| Record of something that happened | `event` |
| Stateless class with business logic | `service` (in `.flow`) |
| Persistence interface for aggregate root | `repository` (in `.flow`) |
| Handler for a command → write operation | `interaction` (command-triggered) |
| Handler for an event → side effects | `interaction` (event-triggered) |
| Precondition that must hold before one or more interactions execute | `policy` (with `on "interaction"`) |
| Property always true after any successful mutation of an entity | `invariant` (with `on Entity` — entities only, never commands/events/values) |
