# Expression Rules

Rules for all `when { ... }` and `must { ... }` blocks across `fails`, `policy`, and `invariant`.

## Available Operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `isEmpty()`, `isNotEmpty()`

## Quick Reference — Expressible Patterns

| Pattern | Expression |
|---|---|
| Self-reference | `Command.fieldA = Command.fieldB` |
| Ownership | `Entity.userId != Command.userId` |
| Status check | `Entity.status != someValue` |
| Duplicate/existence | `resolves` + `fails when { Entity is defined }` |
| Not found | `fails when { Entity is not defined }` |
| Length check | `size(field) > n` |
| Empty collection | `isEmpty(Entity.collection)` |

## Non-obvious Conditions

When a guard does not map directly to an expressible pattern, apply Decision Test 3 ("Is it faithful?") instead of defaulting to `// UNCLEAR`.

Common resolutions:

| Pattern | Approach |
|---|---|
| Uniqueness check (`repo.existsByEmail`) | `resolves` entity via repository op + `fails when { Entity is defined }` |
| Cross-entity existence | Same — `resolves` + `is defined` |
| External business check | `delegates Service.op` + `fails` on result |

If the condition cannot be expressed faithfully: infrastructure → `// NOTE`; business-critical grammar gap → `// UNCLEAR: {full rule}`.
