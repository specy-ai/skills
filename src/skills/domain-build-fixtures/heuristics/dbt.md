# Fixtures heuristic — dbt

dbt already has everything the certificate needs: seeds hold the tables, singular tests hold the
questions. `synthy export --to dbt` writes both.

## Destination and export

```
synthy export <out> --to dbt --dest <dbt project root>          # --prefix raw_ to change the seed names
```

| Written | What |
|---|---|
| `seeds/synthy/<seed>.csv` | one seed per table: `synthy_<entity in snake case>` (`Order` → `synthy_order`, `OrderLine` → `synthy_order_line`); the log tables keep their names (`synthy_events`, `synthy_transitions`, `synthy_commands`, `synthy_rejections`) |
| `seeds/synthy/_synthy__seeds.yml` | `column_types` for every seed, so dbt does not guess them |
| `tests/synthy/synthy_q0001.sql` … | one singular test per certificate question: it selects a row when the observed answer differs from the expected one; hard questions have `severity: error`, advisory and plausibility ones `warn` (a plausibility test compares within its tolerance); tags `synthy`, `synthy_hard`/`synthy_advisory`/`synthy_plausibility`; `meta.satisfies` carries requirement ids |
| `synthy/` | `manifest.json`, `questions.json`, `certificate.json`, `traceability.json`, `README.md` |

The project's `seed-paths` and `test-paths` must include `seeds` and `tests` (the defaults).

## Running

```
dbt seed --select path:seeds/synthy
dbt test --select tag:synthy                 # or: dbt build --select path:seeds/synthy tag:synthy
```

Verified with dbt-core 1.x and dbt-duckdb on the orders example: 9 seeds, 115 tests, 114 pass and 1
warns, exactly the certificate (111 hard, 3 of 4 advisory). Editing one seed cell makes the matching
hard tests fail.

## Warehouse dialect

The questions are DuckDB SQL (`arg_max`, `INTERVAL '60 seconds'`, `strftime`). On dbt-duckdb they run
as written. On another warehouse, keep the seeds and run the synthy tests against a DuckDB target:

```yaml
# profiles.yml: a target used only to verify fixtures
my_project:
  outputs:
    synthy:
      type: duckdb
      path: target/synthy.duckdb
```

```
dbt build --target synthy --select path:seeds/synthy tag:synthy
```

and exclude them from the warehouse runs (`--exclude tag:synthy`).

## Models that read the fixtures

Point staging models at the seeds in development and CI, at the sources in production:

```sql
-- models/staging/stg_orders.sql
select * from {% if target.name in ('dev', 'synthy') %}{{ ref('synthy_order') }}{% else %}{{ source('shop', 'orders') }}{% endif %}
```

Column names are synthy's (`totalAmount_amount`, `customer_id`); rename them in the staging model, not
in the seed. Then a model's own tests (or a dbt unit test) can assert figures the scenario declared:
a monthly revenue mart must return the curve's values to the cent.

## Regeneration

```make
fixtures:
	synthy generate fixtures/scenario.synth --out target/synthy-out
	synthy export target/synthy-out --to dbt --dest .
```

Keep `fixtures/scenario.synth` (and its `.domain`) in the repository; the generated seeds and tests
are reproducible from them (same seed, same bytes).
