# Flow Constructs — Index

During Phase 3 (Extraction: flow), load the relevant construct files for rules, examples, and anti-patterns.

## Shared construct reference

The definitions, skeletons, rules, and examples for all 10 constructs (entity, value, enum, command, event, interaction, service, repository, policy, invariant) are in `grammars/constructs.md` — shared across all three skills.

## Always load

| File                        | Content                                                                                 |
|-----------------------------|-----------------------------------------------------------------------------------------|
| `constructs/expressions.md` | Transverse rules for `when`/`must` expressions, expressible vs unexpressible conditions |

## Load per construct

| Construct     | File                        |
|---------------|-----------------------------|
| `interaction` | `constructs/interaction.md` |
| `service`     | `constructs/service.md`     |
| `repository`  | `constructs/repository.md`  |
| `policy`      | `constructs/policy.md`      |
| `invariant`   | `constructs/invariant.md`   |
