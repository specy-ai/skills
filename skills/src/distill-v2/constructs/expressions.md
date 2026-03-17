# Expression Rules

Rules for expression bodies in policy and invariant blocks. In v2, expressions appear directly inside the construct body — there are no wrapping `when { }` or `must { }` blocks.

## Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `sum()`, `isEmpty()`, `isNotEmpty()`, `now()`, `today()`, `and`, `or`, `not`, `+`, `-`, `*`, `/`, `every TypeName in dotPath { expr }`, `if expr { expr }`

## Quick Reference — Expressible Patterns

| Pattern | Expression |
|---|---|
| Self-reference | `placeOrder.fieldA = placeOrder.fieldB` |
| Ownership | `Entity.userId != placeOrder.userId` |
| Status check | `Entity.status != someValue` |
| Duplicate/existence | `resolves Entity from dotPath` + policy with `Entity is defined` |
| Not found | policy with `Entity is not defined` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |
| Universal quantifier | `every Product in lines { Product.available = true }` |
| Computed value | `total.amount = productPrice.amount * quantity` |
| Conditional validation | `if charge.chargeAppliesTo = loan { charge.chargeTimeType in { disbursement, specifiedDueDate } }` |
| Conditional with optional | `if order.estimatedDelivery is defined { order.estimatedDelivery > today() }` |
| Compound conditional | `if charge.chargeAppliesTo = savings and charge.chargeCalculation = percentOfAmount { charge.chargeTimeType in { withdrawalFee, savingsNoActivityFee } }` |

## Conditional Expressions (`if`)

The `if` expression is a logical implication: `if A { B }` ≡ `¬A ∨ B`. The policy holds when the condition is false (vacuous truth) or when both condition and body are true.

**Use `if` when:**
- A validation rule applies only under a specific condition (e.g., "loan charges only allow these time types")
- A field constraint depends on the value of another field (e.g., "if penalty, cannot be at disbursement")
- A field must be defined only when another field has a specific value (e.g., "monthly fees require feeOnMonthDay")

**Do NOT use `if` for:**
- Operation-level branching (two execution paths from the same command) — this is not yet supported in operations
- Simple unconditional checks — use direct expressions instead

**Common source patterns that map to `if`:**

| Source Pattern | Specy Expression |
|---|---|
| `if (entity.isX()) { validate(entity.fieldY); }` | `if entity.type = x { entity.fieldY ... }` |
| `switch (appliesTo) { case LOAN: validValues = [...]; }` | `if entity.appliesTo = loan { entity.field in { ... } }` |
| `if (isPenalty && isAtDisbursement) throw ...` | `if entity.penalty = true { entity.timeType not in { disbursement } }` |
| `if (isMonthlyFee()) { requireNotNull(feeOnMonthDay); }` | `if entity.timeType = monthlyFee { entity.feeOnDay is defined and ... }` |

## Non-obvious Conditions

When a guard does not map directly to an expressible pattern, apply Decision Test 3 ("Is it faithful?") instead of defaulting to `// UNCLEAR`.

Common resolutions:

| Pattern | Approach |
|---|---|
| Uniqueness check (`repo.existsByEmail`) | `resolves` entity from dotPath + policy with `Entity is defined` |
| Cross-entity existence | Same — `resolves` + `is defined` in policy |
| External business check | `Service.op(args)` direct call + policy on result |

If the condition cannot be expressed faithfully: infrastructure → `// NOTE`; business-critical grammar gap → `// UNCLEAR: {full rule}`.
