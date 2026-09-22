# Synthetic Data: Misata, and the Industry Landscape

Notes from a code-level study of [rasinmuhammed/misata](https://github.com/rasinmuhammed/misata)
(v0.9.6.42, ~50k LOC Python, 102 test files, single author), plus a map of how the
industry actually generates synthetic data.

---

## 1. Misata — how it works

### 1.1 The core inversion

Almost every synthetic-data tool is an **imitator**: fit a model to real data, sample
from it. Misata is a **constraint satisfier**: you declare the answer (revenue curve,
fraud rate, group shares, FK integrity), and it manufactures rows whose aggregates
*provably* equal what you declared. No training, no source data, no ML model in the
data path.

The README calls it "outcome-conformant generation." Mechanically it is closer to a
niche of database research called *reverse query processing* — generate a database such
that a given query returns a given result — productised for analytic aggregates.

### 1.2 The one algorithm that matters

Everything else is scaffolding around `misata/engines/fact_engine.py:396`
(`_generate_exact_values`). Stripped down:

```python
total_units = int(round(target * 100))          # work in integer cents, never floats
proportions = self.rng.dirichlet(alpha_array)   # α = "concentration", default 2.0
raw_units   = proportions * magnitude_units
units       = np.floor(raw_units).astype(int)
remainder   = magnitude_units - int(units.sum())
units[np.argsort(-(raw_units - units))[:remainder]] += 1   # largest-remainder apportionment
```

Three ideas stacked:

1. **Dirichlet = Gamma conditioned on its sum.** If you draw `n` independent Gamma
   variates with a common scale, the vector of *proportions* is Dirichlet-distributed and
   statistically **independent of the total** (Lukacs' characterization — the
   "closed-form" in the paper's title). So `T × Dirichlet(α)` gives a sample that *looks*
   like an ordinary skewed transaction distribution, but whose sum is exactly `T` by
   construction. No rejection sampling, no iterative fitting, O(n).
2. **Integer quantization.** All arithmetic happens in cents (`10**decimals`), so
   "exactly $0.00 error" is arithmetic truth, not floating-point luck.
3. **Largest-remainder apportionment** distributes the rounding residual — the method
   used to allocate parliamentary seats. It appears three times in the codebase
   (`fact_engine`, `shares.py`, `waterfall.py`), with a comment at `fact_engine.py:319`
   about a bug where they ranked by the wrong quantity and gave every leftover row to the
   smallest period.

> **Insight — the exactness is structural, not iterative.**
> Most tools that hit a target generate, measure, and rescale — which converges
> approximately and breaks under rounding. Misata never measures its own output for the
> primary guarantee: the sum is fixed *before* the individual values exist, then split.
> Measurement (the Oracle report) is a separate verification layer, not the mechanism.

> **Insight — bounds and aggregates are in genuine tension, resolved honestly.**
> `_fit_units_within_bounds` (`fact_engine.py:463`) clips values into the declared
> `[min, max]` then hands the residual to rows that still have headroom — conserving the
> total exactly. It works iff `lo·n ≤ T ≤ hi·n`. When infeasible, it *keeps the aggregate
> and breaks the bound*, and says so in LIMITATIONS.md. A documented value judgement, not
> a bug.

Sibling guarantees use the same pattern:

- **Rate curves** (`simulator.py:3480`): exactly `round(n_period × rate)` rows per period
  are selected to carry the true value.
- **Group shares** (`shares.py:23`): `round(fraction × total)` per group, residual
  absorbed by the largest-share group — so the parts sum back to the cent.

### 1.3 The pipeline

```
front door → SchemaConfig (pydantic) → feasibility check → topo sort
           → per-table batched generation → ~20 ordered post-passes → Oracle report
```

**Front doors** (all converge on one `SchemaConfig`, `misata/schema.py:1336`, ~30
declaration classes):

| Input | Module | Nature |
|---|---|---|
| Plain English story | `story_parser.py` (3.2k LOC) | regex/rule-based, *no LLM* |
| Structured spec text | same | deterministic — "exactly 4000" means 4000 |
| YAML / Python dict | `yaml_schema.py`, `compat.py` | explicit |
| Live database | `db.py`, `introspect.py` | SQLAlchemy introspection |
| dbt `schema.yml` | `dbt_import.py` | `relationships` → FKs, `accepted_values` → enums |
| Prisma schema | `prisma_import.py` | `@relation` → FKs |
| LLM | `llm_parser.py` | LLM designs the *schema only* |
| MCP server | `misata/mcp/` | agent designs schema, Misata does the math |

That last division of labour is the sharpest product idea in the repo: **the LLM never
generates a row.** It is good at knowing a vet clinic needs a `species` column and
terrible at 50,000 rows with zero orphan FKs. So it emits a schema dict and the
deterministic engine does the rest.

**Generation order**: Kahn's topological sort over declared relationships
(`simulator.py:680`), parents before children, self-referential FKs excepted. Parent PKs
are cached in `_pk_store` and sampled for children — referential integrity is a
*construction property*, not a repair pass.

**Post-passes** (`simulator.py:3073`) run in a deliberate order, each a separate concern:
formulas → informative missingness (MAR/MNAR) → exact incidence → time-series
autocorrelation → state machines → ICC cluster effects → denormalized parent sync →
cross-table temporal causality (a child event cannot predate its parent) → Iman–Conover
rank correlations → scenario events → constraints → re-run formulas → anomalies →
**outcome curves** → rate curves → null rates → noise. The ordering comments are the most
instructive reading in the file; e.g. nulls are applied *last* so the statistical passes
see full values.

### 1.4 Two design ideas worth stealing

**Anchored RNG** (`anchor.py`). Instead of one sequential random stream, each generation
site gets its own stream derived as `blake2b(seed ‖ "column" ‖ table ‖ column ‖ batch)`.
Consequence: adding a column leaves every other column **byte-identical**. Schema edits
produce minimal data diffs, flowing *down* the dependency graph rather than reshuffling
everything. This is the difference between a data generator you can put under version
control and one you cannot.

**Feasibility as a compiler error.** `generate_from_schema(..., strict=True)` calls
`check_feasibility` and raises `InfeasibleSchema` *before generating anything*, "naming
every conflict with the arithmetic that proves it." Comment at `__init__.py:325`:

> *"A declarative engine owes the user a compiler error here, not a warning followed by a
> specification it substituted on their behalf."*

### 1.5 The Oracle report

`reporting.py:897`. Deliberately split into two tiers:

- **Hard guarantees** — schema validation, referential integrity, row-count fulfillment,
  declared constraints, KPI conformance, seed reproducibility. These gate `passed: true`.
- **Advisory heuristics** — quality score, privacy heuristics, fidelity vs. schema,
  locale/domain fit (does a Brazilian dataset have plausible city/phone/CPF shapes?),
  coherence audit, data card.

Keeping these separate is more intellectually honest than the single "quality score: 94"
most vendors ship.

### 1.6 Mimic mode (the imitation path) — and where it is thin

`misata.mimic(df)` runs `profiler.py`: per-column semantic detection (regex + name hints
for email/phone/geo/etc.), character-class shape reproduction for code columns like
`"A/5 21171"`, and distribution fitting — lognormal for skewed-positive, normal
otherwise, empirical frequencies for categoricals under 50 levels. `hybrid.py` adds scipy
distribution fitting and pairwise correlations. `sdv` is an optional extra.

LIMITATIONS.md states it plainly: **"No learned correlation structure. Misata does not fit
a copula or a neural model to real data."** So mimic preserves *marginals* and
declared/name-inferred correlations, not the joint distribution. Against SDV/CTGAN/TabDDPM
on a fidelity benchmark it will lose. That is not the fight it is picking.

### 1.7 Honest assessment

**Strong**: the core algorithm is genuinely elegant and correct; the determinism story is
best-in-class; LIMITATIONS.md is unusually candid (aggregate targets override declared
bounds; row-count clamps silently distort marginals; declared rates are subject to integer
rounding); the MCP/agent framing is well-judged.

**Watch for**: 50k LOC and ~90 modules from one author at v0.9.x — the surface (Spark,
dbt, SCD2, degradation models, evalpacks, capsules, geo, documents, streaming) is far
wider than the core. The arXiv preprint is self-cited and its headline comparison
("imitation synthesisers miss the declared aggregate by 74–86%") is close to a category
error: it scores distribution-learners on a conformance metric they were never designed to
optimise. The correct reading is "these are different tools," not "Misata is 80% better."

---

## 2. The moat — declarative generation with exact aggregates

### 2.1 The problem it sits on: every test fixture has an oracle problem

To test a transform — a dbt model, a Spark job, a dashboard tile — you need:

1. **Input data** that exercises the logic
2. **An expected output** you know independently of the code under test
3. **Confidence that (2) is right**

Teams get (1) easily and (2) almost never. The three available strategies all fail:

| Strategy | Failure |
|---|---|
| **Copy production data** | You do not know the right answer — you compute it *with the code under test*. The test asserts "the code still does what it did." Tautological. Plus: legal exposure, slow, unavailable pre-launch. |
| **Hand-write fixtures** | They rot and, worse, **disagree with each other**. `dbt_unit.py:8`: *"Someone writes `customers` with ids 1, 2, 3 and `orders` referencing `customer_id` 7, the join produces zero rows, and the test either passes vacuously or fails for a reason that has nothing to do with the model."* |
| **Faker/random generators** | Referential integrity is your problem, and the expected aggregate is unknowable — you must compute it from the generated data, which is (1) again. |

Shared root: **in all three cases the expected answer is derived from the data.** Which
puts the oracle downstream of the thing it is supposed to check.

### 2.2 The inversion

**Make the specification the ground truth, and the data the derived artifact.**

You declare "March revenue is $210,000." Misata manufactures rows summing to exactly
$210,000. Now `SELECT SUM(amount) WHERE month=3` has a *known answer that existed before
the data did*. Your dbt model, Spark job, or BI tile either returns 210000.00 or it has a
bug. The test has an oracle logically prior to both the data and the code.

> **Insight — the lineage.**
> This is **property-based testing** (QuickCheck/Hypothesis) one level up the stack.
> Hypothesis generates inputs and checks an invariant you declared about outputs; Misata
> generates a *database* and the invariant is an aggregate you declared. Both replace "I
> computed the expected value by hand and hope I was right" with "the expected value is a
> premise, not a conclusion."
>
> The deeper lineage is **reverse query processing** (QAGen, RQP, circa 2007): given query
> Q and desired result R, generate a database D such that Q(D) = R. That literature never
> shipped as a product because the general case is NP-hard. Misata restricts the query
> class to *declared aggregates* (sums, rates, shares, ledger identities), which makes it
> closed-form and O(n) — then wraps it in the workflows where people actually need it.

### 2.3 What the moat is NOT: the exact-sum algorithm

The author knows this and proves it against himself.
`research/specbench/baselines.py:197`:

```python
class NaiveRescaleBaseline(Baseline):
    """Faker scaffold + per-period multiply to hit each aggregate exactly.

    The point (review B2): this ALSO achieves AME = 0 — proving hitting one
    aggregate is trivial. What it does NOT do: respect *other* declared hard
    constraints (range / inequality → CSAT), and it needs a hand-built schema,
    not a natural-language spec. It isolates exactly what is, and is not,
    the contribution."""
```

Generate anything, multiply each period by `target / current_sum`. Aggregate error: zero.
Forty lines. **So "exact aggregates" alone is not a moat** — and to his credit, the
benchmark ships that baseline rather than hiding it.

### 2.4 What it IS: the conjunction

The aggregate must hold **simultaneously with everything else you declared**, and blind
rescaling destroys every one of those:

| Declaration | What naive rescale does to it |
|---|---|
| `amount between 5 and 500` | Multiplying by 1.7 pushes rows past 500 |
| FK zero orphans | Untouched, but never established in the first place |
| `fraud_rate = 3% in Q1, 8% in Q4` | Rescaling a numeric does not touch it; enforcing it afterwards perturbs the sum |
| `Electronics = 40% of revenue` | Rescaling the period breaks the within-period split |
| `visit_date >= enroll_date` | Untouched by rescale, but nothing enforces it |
| debits = credits per entry, trial balance = 0 | Rescale breaks the ledger identity outright |
| Same seed → same bytes | Rescale is fine; the *pipeline* around it usually is not |

Each pairwise interaction is where the engineering lives. `_fit_units_within_bounds`
(`fact_engine.py:463`) is canonical: clip into `[lo, hi]` in integer units, then
iteratively hand the residual to rows with remaining headroom — **aggregate stays exact,
bounds now hold**. `simulator.py:3073` orders ~20 such passes with comments explaining why
each sits where it does (rate curves run *after* outcome curves "so numeric aggregates are
untouched"; nulls run last so statistical passes see full values).

That ordering is a *specification of precedence between competing declarations*. It took
~50k LOC and a lot of bug reports to arrive at. Not a weekend's work to replicate.

### 2.5 What it IS, most of all: the answer-key-first artifact chain

Three layers of self-checking, each independent of the last.

**(1) Feasibility as a compiler error — before generation.** `feasibility.py` refuses
contradictory declarations rather than silently picking a winner:

> *"The behaviour that separates a declarative engine from a generator with a lot of
> options is what it does when two declarations cannot both hold. A generator picks one
> and carries on. A declarative engine refuses, names both declarations, shows the
> arithmetic, and says what to change — the way a compiler does."*
>
> ```
> declared:  smb .6 / mid .6 / ent .3   (sums to 1.5)
> realised:  smb .4 / mid .4 / ent .2   ← a specification nobody wrote
> ```

A `Conflict` carries `declarations`, `arithmetic` (the sum that proves impossibility), and
`remedy`. `conformance.py::conformance_preview` is a pure planning pass showing period
targets, estimated row counts, and clamping warnings **without generating a row**, exposing
`ame_achievable` as a boolean you can branch on. Scope discipline is explicit: refuse only
on *arithmetic* impossibility, never on "unusual," because false refusals are worse than
the warnings they replace.

**(2) The Oracle report — hard guarantees separated from advisory heuristics.**
`passed: true` requires *only* falsifiable checks. Quality scores, privacy heuristics,
fidelity, locale fit, coherence all live under `advisory` and **cannot** make a run pass.
The tier split is what makes this usable as a CI gate. Note `reporting.py:803`:
`bounds_passed` is reported *separately* from `passed`, with a comment — "aggregate targets
take precedence over marginal bounds by design." The known tradeoff is surfaced in the
artifact, not buried.

**(3) Evalpacks — the strongest single idea in the repo.** `evalpack.py`:

> *"An evalpack inverts the usual benchmark-construction order. Instead of taking a
> database and annotating question/answer pairs afterwards (**the step where published
> text-to-SQL benchmarks pick up pervasive answer-key errors**), the ground truth is the
> specification... every question shipped is then verified by executing its gold SQL
> against the written files with DuckDB — **an engine that shares no code with the
> generator**. Questions whose observed answer does not exactly match the declared answer
> are never shipped."*

Pipeline: declared curve/rate/share/FK/ledger → derived question + gold SQL + expected
answer (from the *declaration*, `_curve_questions:177`) → generate data → write CSVs → load
into DuckDB → execute gold SQL → **ship only exact matches, record the rest as
`dropped_questions` in the manifest**.

Question kinds derived automatically: `outcome_curve_period`, `outcome_curve_total`,
`outcome_curve_argmax`, `plan_row_count`, `rate_curve_anchor`, `fk_integrity`,
`ledger_entry_balance`, `ledger_trial_balance`, `waterfall_net`, group-share splits.

The emitted pack ships `tables/`, `questions.jsonl`, `certificate.json`, `manifest.json`
(spec hash, seed, versions), and a standalone `verify.py` needing only duckdb.

> **Insight — independent verification is the load-bearing detail.**
> DuckDB shares no code with the generator, so a bug in Misata's arithmetic cannot produce
> a self-consistent-but-wrong answer key — it produces a *dropped question*. The failure
> mode degrades to "fewer questions," never "a confidently wrong benchmark."
>
> This makes the output a **portable, falsifiable artifact** rather than a claim. You can
> hand `certificate.json` + `verify.py` to an auditor, a regulator, or a customer's
> security team and they can re-run it without trusting you or installing Misata. That is
> the difference between a feature and an asset: a competitor can copy the Dirichlet trick
> in an afternoon; the certificate *format*, once it is in someone's CI pipeline and
> compliance evidence folder, is switching cost.

### 2.6 The economic layer

**Anchored RNG → fixtures under version control.** Adding a column leaves every other
column byte-identical, so a fixture change produces a reviewable diff instead of a
50,000-row reshuffle. Without this, generated fixtures cannot live in git; if they cannot
live in git they cannot be the substrate of a test suite. Quietly the enabling constraint
for the whole moat.

**Distribution at the point of need.** `misata dbt-seed` reads your existing `schema.yml`
(`relationships` → FKs, `accepted_values` → enum pools, `unique`/`not_null` → hard
constraints), `misata prisma-seed` reads `schema.prisma`, `schema_from_db()` introspects a
live Postgres. Zero authoring for the schema; you only declare the *outcomes*. Then
`dbt build` runs the tests you already wrote — passing on day zero.

### 2.7 What it unlocks, concretely

```
1. Declare:   "invoices.amount by issued_on — Jan 180000, Feb 195000, Mar 210000"
              "fraud_flag: 3% in Q1 rising to 8% in Q4"
              "Electronics 40% of revenue, Home 25%"
2. Generate:  misata generate  →  CSVs + oracle_report.json + certificate.json
3. Assert:    your dbt model / Spark job / dashboard tile returns 210000.00
```

Step 3 is a **red/green test with a real oracle, written before any production data
exists.** Applications:

- **Pre-launch pipeline development** — build and test the warehouse before the product has users
- **CI regression gates** — a refactor that silently changes an aggregation fails loudly
- **Dashboard acceptance** — "the Q4 tile must read $200k"; the data is constructed so it must
- **Text-to-SQL / data-agent evaluation** — an answer key correct *by construction*,
  addressing the known annotation-error problem in Spider/BIRD-class benchmarks
- **Onboarding & demos** — a domain-shaped dataset with coherent numbers, no PII, no DPA

### 2.8 Where the moat ends

**1. Known *inputs with known aggregate properties*, not known *outputs of arbitrary
SQL*.** `dbt_unit.py:29` refuses to invent expected rows:

> *"It does not invent the `expect` rows. Knowing the expected output requires knowing what
> the SQL does, and this module does not parse or execute SQL... A fixture that silently
> asserts the wrong answer is worse than no fixture."*

So the oracle covers transforms whose result is (a function of) a declared aggregate. A
model with a window function, a semi-additive measure, a slowly-changing join, or business
logic Misata cannot invert gets **good, coherent, FK-valid inputs** — but you are back to
hand-authoring the expected output. The known-answer guarantee is *narrower than "test your
pipeline"*; it is "test your aggregations, rates, splits, integrity, and ledger identities."

**2. Aggregate beats bound.** When `min·rows > target`, the sum wins and the declared bound
breaks — with a warning and a separate `bounds_passed` flag, but it breaks.

**3. Integer rounding caps rate exactness.** 2% of 4,824 rows is 96 (1.99%) or 97 (2.01%).
Evalpacks drop such questions rather than ship an approximate answer key — correct
behaviour, but coverage silently thins on awkward numbers.

**4. Row-count clamps distort marginals silently.** When a period needs more rows than
`max_transactions_per_period` allows, per-row values inflate to preserve the sum. *"Every
aggregate check still passes while the row-level distribution shifts."* Your test goes
green on data that no longer looks like your business.

**5. No learned joint structure.** Correlations exist only where declared or name-inferred.
Fine for a pipeline oracle, disqualifying for ML training data — do not let success in
domain 1 imply domain 2.

**6. Durability risk.** v0.9.x, one author, ~90 modules, surface far wider than the core.
The math is copyable in a day; the integrations and certificate format are copyable in a
quarter by dbt Labs, Tonic, Gretel, or a warehouse vendor. **The defensible asset is
adoption of the certificate as evidence**, not the algorithm.

### 2.9 The one-sentence version

> Misata's moat is not that it hits an aggregate exactly — its own benchmark ships a
> 40-line baseline that also does — but that it satisfies a *conjunction* of declared
> outcomes, bounds, rates, shares, and referential integrity **simultaneously**, refuses
> arithmetically impossible specs like a compiler, and emits an answer key that was true
> before the data existed and is re-verifiable by an engine that shares no code with it.

Everything else in the repo is distribution for that.

---

## 3. What is an "aggregate" in this domain?

**An aggregate is a single number that summarises many rows** — the output of a reduction
over a set of rows, usually with a grouping key. The analytics/SQL sense of the word.

### 3.1 Mechanical definition

```
many rows  →  one scalar
```

`SUM`, `COUNT`, `AVG`, `MIN`, `MAX`, `STDDEV`, `COUNT(DISTINCT …)` — optionally sliced by
a `GROUP BY` key, which turns it into *one scalar per group*:

```sql
SELECT date_trunc('month', order_date) AS m, SUM(amount)
FROM orders
GROUP BY 1;
--  m         sum
--  2024-01   50000.00     ← each row of this result is one aggregate
--  2024-02   61000.00
```

Three properties make aggregates the currency of the field:

1. **Many-to-one.** Astronomically many row-sets sum to $50,000. That slack is the freedom
   a generator exploits — fix the aggregate and a huge space of plausible rows remains.
   (Misata's Dirichlet split *is* a way of sampling inside that space.)
2. **They are what people actually look at.** Nobody stares at row 47,213. They stare at
   MRR, churn rate, fraud rate, category mix. A dashboard is a wall of aggregates; a KPI
   *is* an aggregate.
3. **Cheap to check.** One `GROUP BY` and you have a falsifiable pass/fail. Which is why
   they can serve as a test oracle at all.

### 3.2 The taxonomy: marginal / aggregate / joint

| Level | What it constrains | Example | Who cares |
|---|---|---|---|
| **Marginal** | one column's distribution, ignoring all others | `amount` is lognormal, mean 120 | fidelity benchmarks |
| **Aggregate** | a reduction over a *group* of rows | Jan revenue = $50,000; fraud = 3% in Q1 | **pipeline/KPI testing** |
| **Joint** | the full multivariate dependence structure | `amount ⟂̸ region ⟂̸ tenure ⟂̸ season` | ML training data |

Marginals say nothing about groups; aggregates say nothing about the shape within a group;
joints subsume both and are the expensive thing GANs/diffusion/copulas chase. Misata's bet
is that for *testing* you need the middle row exactly and the other two only approximately
— the inverse of what an imitation synthesiser optimises.

### 3.3 The forms an aggregate declaration takes

| Kind | Declaration | The aggregate being pinned |
|---|---|---|
| **Level / curve** | `Jan 180000, Feb 195000, Mar 210000` | `SUM(amount)` per period |
| **Rate / incidence** | `fraud 3% in Q1 → 8% in Q4` | `AVG(flag::int)` per period, i.e. `COUNT(flag)/COUNT(*)` |
| **Share / mix** | `Electronics 40% of revenue` | `SUM(amount) WHERE cat=X / SUM(amount)` |
| **Cardinality** | `exactly 3200 rows` | `COUNT(*)` |
| **Roll-up identity** | `customer.total_spent = SUM(orders.amount)` | a *cross-table* aggregate — parent column must equal child reduction |
| **Ledger identity** | `SUM(debits) = SUM(credits)` | an aggregate constrained to a constant (zero) rather than a target |

The last pair is where it stops being "a summary statistic" and becomes **a structural
invariant of the dataset**.

### 3.4 The homonym to watch (DDD vs. analytics)

> **"Aggregate" means two unrelated things in the two halves of the stack, and both are
> live in Specy.**
>
> - **DDD aggregate** (`.domain` files): a *cluster of entities and value objects* with a
>   root, forming a transactional consistency boundary. A **structural** noun — a thing in
>   the model.
> - **Analytics aggregate** (Misata, dbt, BI): a *scalar reduction over rows*. A
>   **computational** noun — a number derived from data.
>
> An `Order` aggregate-root with its `LineItem`s is the first. `SUM(order.total) BY month`
> is the second. Nothing connects them etymologically beyond "gathering things together."
>
> **But there is a real bridge.** A classic DDD invariant —
> `Order.total == sum(lineItems.amount)` — is *both*: an invariant scoped to the DDD
> aggregate boundary, **and** an analytic aggregate identity (a roll-up). Misata calls that
> a cross-table roll-up constraint (`crosstable.py:30`, `sum_lte_parent` and friends) and
> enforces it during generation with child values reconciling upward to the parent.
>
> So a `.domain` `invariant` of roll-up shape is directly compilable to a Misata
> declaration — and once it is, you get test data that *satisfies your domain invariants by
> construction*, plus a certificate proving it. A far stronger fixture story than "we wrote
> a seed script and hope it respects the aggregate boundary."

### 3.5 Why "aggregate" is the pivot of the whole argument

Imitation tools reproduce aggregates only *incidentally* — if the model fits well, sums
come out roughly right, and "roughly" is unbounded because nothing in the loss function
looks at your `GROUP BY`. Declarative tools treat the aggregate as the input, not the
output, and individual rows become the free variables.

So when the Misata paper says imitation synthesisers "miss the declared aggregate by
74–86%," it is really saying: *nothing in a CTGAN's objective ever mentioned your monthly
revenue curve, so of course it does not hit it.* Less a benchmark result than a restatement
of what the two families optimise. The genuinely interesting claim is the narrower one —
that you can pin a whole *conjunction* of aggregates (levels + rates + shares + roll-ups +
integrity) at once and still get rows that look like transactions.

---

## 4. The industry landscape

The right axis is not the algorithm — it is **what you are holding when you start**.

### 4.1 You have only a spec (cold start, no data)

| Approach | Representative tools | What it buys / costs |
|---|---|---|
| **Rule + fake-value generators** | Faker, Mimesis, factory_boy / FactoryBot, Snowfakery (Salesforce), `dbldatagen` (Databricks), Synth | Trivial, zero privacy risk. No joint structure, no aggregates, FK integrity is your problem. |
| **Declarative / constraint solving** | **Misata**, Benerator, academic reverse-query-processing (QAGen/RQP), SMT-based DB test generation | Known-answer testing: assert a pipeline returns a number you chose. Requires you to know what you want. |
| **Simulation / agent-based** | SimPy, discrete-event sims, digital twins, market/order-book simulators, process-mining event-log generators | Causally coherent histories, arbitrary counterfactuals. Expensive to build; realism = the modeller's skill. |
| **Rendered / engine-based** (non-tabular) | NVIDIA Omniverse Replicator, Unity Perception, CARLA, Blender pipelines | Pixel-perfect labels for free. Where synthetic data is genuinely dominant in production (AV, robotics, industrial vision). |
| **LLM generation from spec** | Direct prompting; self-instruct / Evol-Instruct / Magpie for instruction data; teacher-model distillation | Best-in-class for text, dialogue, eval sets, edge cases. Costly at volume, non-deterministic, mode collapse, distributions hallucinated not grounded, licensing questions. |

### 4.2 You have a real dataset (imitation / privacy-safe twin)

Ascending fidelity and cost:

1. **Profiling + resampling** — fit marginals per column, regenerate. (Misata's mimic, most
   vendor "quick mode".) Fast, no joint structure.
2. **Statistical / copula / sequential** — SDV `GaussianCopulaSynthesizer`, `synthpop` (R,
   sequential CART), Bayesian networks (DataSynthesizer, PrivBayes). Still the best
   accuracy-per-compute for mid-size tabular, and the most interpretable.
3. **Deep generative** — CTGAN / TVAE (SDV), CTAB-GAN, **TabDDPM** (diffusion), and
   LLM-based tabular synthesis (GReaT, REaLTabFormer, Tabula). Diffusion and
   autoregressive-LLM approaches are currently SOTA on tabular fidelity; GANs have largely
   lost on tabular. Commercial: MOSTLY AI, Gretel, Tonic, Hazy, Syntho, YData.
4. **Multi-table / relational** — SDV `HMASynthesizer`, RCTGAN, ClavaDDPM, plus relational
   modes from Gretel/MOSTLY AI. **Where nearly everything degrades**: per-table fidelity
   stays fine while cross-table cardinality and key structure fall apart. Precisely the gap
   Misata attacks from the other side.
5. **Sequential / time series** — PAR (SDV), TimeGAN, DoppelGANger, Fourier flows.
6. **Text / documents** — LLM paraphrase-and-regenerate, or NER-driven detect-then-replace.

### 4.3 You have real data and a hard privacy bar

- **Differentially private synthesis**: marginal-based methods (MST, AIM, PrivBayes) — these
  *won* the NIST DP synthetic-data challenges and still beat DP-GANs (DP-CTGAN, PATE-GAN)
  on tabular at realistic ε.
- **The non-synthetic alternative that dominates enterprise practice**: production
  subsetting + masking/tokenization (Tonic, Delphix, Redgate, Broadcom TDM). Cheaper,
  legally better-understood, but it *is* real data with a costume on.
- **Non-negotiable**: synthetic ≠ private. An overfit generator memorizes. Anything serious
  ships membership-inference AUC, distance-to-closest-record, and nearest-neighbour distance
  ratio — or a formal ε.

### 4.4 Hybrid — where mature teams land

Learn *marginals and correlations* from real data; **declare** the scenario you want on top
(fraud at 8% instead of the real 0.3%; a recession quarter that never happened; a launch
market with no history). Also: SMOTE-family upsampling for class imbalance, and conditional
generation to fill rare cells. Misata's `hybrid.py` + `__outcome_curves__` is exactly this
shape; so is Gretel's conditional generation.

### 4.5 How the industry judges any of it

Four axes; tools are usually strong on one and quiet about the rest:

- **Fidelity** — per-column KS/TVD, pairwise correlation delta, and the joint test that
  matters: **discriminator AUC** (can a classifier tell real from synthetic? 0.5 is perfect).
- **Utility** — **TSTR**: train on synthetic, test on real, compare to
  train-real/test-real. The only number a business should care about for ML use cases.
- **Privacy** — DCR/NNDR distributions, membership inference, ε.
- **Conformance** — FK integrity, business rules, declared aggregates. Almost nobody
  measures this except the declarative camp; it is the axis that decides whether the data is
  usable as a *test fixture* rather than as *training data*.

### 4.6 Choosing, compressed

| Your situation | Use |
|---|---|
| No data yet; need dev/staging/CI fixtures with real FK integrity | Declarative (Misata, Snowfakery, Benerator) |
| Test a pipeline/dashboard against a **known answer** | Declarative with exact aggregates — Misata's actual moat |
| Have production data; need a privacy-safe analytics copy | Copula/diffusion synthesis + a privacy report (SDV, MOSTLY AI, Gretel) |
| Have data; need it under a regulator's eye | DP marginal methods (MST/AIM/PrivBayes), or masking + subsetting |
| Need rare events / class balance / counterfactual scenarios | Hybrid: learn marginals, declare the scenario |
| Text, instructions, evals, edge cases | LLM generation + dedup + quality filtering |
| Vision, perception, robotics | Rendered engines (Omniverse, Unity, CARLA) |

> **Insight — the two camps optimise incompatible objectives.**
> Imitation maximises *statistical indistinguishability from the past*. Declaration
> maximises *conformance to a stated future*. A test fixture wants the second (you need to
> know the answer); a model training set wants the first (you need the joint distribution).
> Asking which is "better" is asking whether a compiler beats a photocopier.

---

## 5. Relevance to Specy

A `.domain` model is already a richer version of Misata's `SchemaConfig`:

| Specy `.domain` construct | Misata equivalent |
|---|---|
| entity / aggregate | table |
| `identity` | primary key |
| value type with bounds | column `min`/`max`, enum `choices` |
| `invariant` (roll-up shape) | `__constraints__`, `crosstable.py` roll-up |
| `invariant` (inequality shape) | `{"type": "inequality", ...}` |
| `states { machine }` | `__state_machine__` / `lifecycle` |
| reaction (`triggered-by` → `effects`) | cross-table temporal causality |
| association / reference | `relationships` (FK), topologically ordered |

Misata's YAML/dict schema is a plausible **compile target** for a `.domain` file:
`specy:domain-build-code` generates the code; a companion `domain-build-fixtures` step
could generate conformant test data for it from the same model — with FK integrity and
domain invariants guaranteed by construction rather than by a hand-written seed script,
plus an Oracle/evalpack certificate proving it.

---

## References

- Repo: https://github.com/rasinmuhammed/misata (MIT, v0.9.6.42)
- Preprint: *Declarative Outcome-Conformant Synthesis: Exact, Closed-Form Specification
  Satisfaction and a Conformance Benchmark*, arXiv:2606.08736 — self-cited; read its
  headline comparison critically (see §1.7)
- Key files: `misata/engines/fact_engine.py` (the algorithm), `misata/anchor.py`
  (determinism design), `misata/evalpack.py` (answer-key-first benchmarks),
  `misata/feasibility.py` (compiler-error semantics), `LIMITATIONS.md` (the honesty)
