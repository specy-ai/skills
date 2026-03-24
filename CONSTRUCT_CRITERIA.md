# Construct Legitimacy Criteria

This grid enables the Core Team to quickly decide whether a construct deserves a place in the Specy language. It is a human judgment tool, not an automated score — each panellist evaluates the axes relevant to their perspective.

> This grid is an entry filter. Periodic review of existing constructs is a separate concern.

## Eliminatory axes

A failure on an eliminatory axis **rejects the construct** — no compensation possible.

| Axis | Guiding question |
|------|-----------------|
| **Irreducible** | Can this construct be expressed with existing constructs or derived from the model? |
| **Unambiguous** | Does this construct have a single interpretation in every context? |
| **Knowledge-bearing** | Does this construct capture business knowledge that would otherwise remain implicit? |

## Discriminating axes

A failure on a discriminating axis is a strong signal that demands justification, but does not automatically block.

| Axis | Guiding question |
|------|-----------------|
| **Non-conflicting** | Does this construct create a contradiction or semantic overlap with existing ones? |
| **Proof-derivable** | Can a mechanical verification be derived from it? |
| **Actionable** | Does this construct make the model more actionable (generation, verification, business conversation)? |
| **Readable** | Can a product owner read and validate this construct without technical help? |
| **Cross-file coherent** | Does this construct integrate cleanly into the `.struct`/`.flow`/`.spec`/`.journey` reference system? |
| **Extractable** | Can the skills produce and consume this construct? |

### Special rule: Proof-derivable

Some narrative constructs (e.g. `::` justification) do not produce mechanical proofs but carry valuable business knowledge. A failure on "Proof-derivable" triggers reinforced scrutiny: the construct must then score strongly on "Knowledge-bearing" to compensate.

## Panellist → axis mapping

Each panellist focuses on their primary axes, not all 9 systematically.

| Panellist | Primary axes | Secondary axes |
|-----------|-------------|---------------|
| Simplicity Advocate | Irreducible, Non-conflicting | Actionable |
| Domain Readability Advocate | Readable, Unambiguous | Knowledge-bearing |
| Machine Reasoning Advocate | Unambiguous, Proof-derivable | Cross-file coherent |
| Cross-File Coherence Advocate | Cross-file coherent | Non-conflicting |
| Skill Experience Advocate | Extractable | Readable |
| Vision Guardian | Proof-derivable, Knowledge-bearing | Actionable |
| Provocateur | Irreducible, Actionable | _(all — cross-cutting role)_ |

## Worked example

### `policy` — adopted (9/9)

| Axis | Verdict | Reason |
|------|---------|--------|
| Irreducible | **pass** | An automatic reaction to an event is expressible neither as an interaction nor as an invariant |
| Unambiguous | **pass** | `on EventX → triggers "interaction Y"` has only one reading |
| Knowledge-bearing | **pass** | Without policy, "when payment confirmed → issue invoice" stays buried in an event handler |
| Non-conflicting | **pass** | Distinct from `invariant` (static constraint) and `interaction` (actor-triggered) |
| Proof-derivable | **pass** | One can verify the trigger event exists and the emitted command is a valid interaction |
| Actionable | **pass** | Makes invisible business automations explicit in the model |
| Readable | **pass** | A PO understands "when PaymentConfirmed then trigger invoice issuance" |
| Cross-file coherent | **pass** | Event comes from `.flow`, command targets a `.flow` interaction, types come from `.struct` |
| Extractable | **pass** | `/distill` identifies event listeners and translates them into policies |

### `logging` — rejected (eliminatory)

| Axis | Verdict | Reason |
|------|---------|--------|
| Irreducible | **fail** | Infrastructure concern, expressible via annotation |
| Knowledge-bearing | **fail** | Does not capture business knowledge |

Immediate rejection on two eliminatory axes — no need to evaluate discriminating axes.
