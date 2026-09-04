# Codegraph-assisted extraction

Load this file when the corpus is JVM code (`.java`, `pom.xml`, `build.gradle`)
**and** the `codegraph` CLI is reachable. Codegraph turns the codebase into two
machine-readable artifacts you read **instead of** opening every class:

| Artifact | What it is | Evidence weight |
|---|---|---|
| `domain-facts.json` | One dossier per corpus type: fields with declared types, annotations with their written arguments, every operation's calls / field accesses / throw sites, supertypes, framework stereotypes and DI wiring, module imports. A **join of facts the extractor declared** — nothing interpreted. | **Production code** (Decision Test 1: yes) |
| `model.insights.jsonl` | One record per operation, type and module, produced by an LLM that walked the graph bottom-up: a prose `description` plus a structured block **in the Specy vocabulary** (concept, owner, safe/idempotent, handled command, emitted events, preconditions, invariants, SPIs, state machine, APIs/SPIs of a module…). | **Inference** — accept only with a confirming fact (see "Evidence rules") |

The source tree stays the last word: every record carries the file and the
span it was explained from, so a doubtful claim is one `sed -n` away.

---

## 1. Detecting and running the pipeline

```bash
CG="${CODEGRAPH_HOME:+$CODEGRAPH_HOME/bin/codegraph}"; CG="${CG:-$(command -v codegraph || true)}"
JAR="${CODEGRAPH_JAR:-${CODEGRAPH_HOME:-}/extractors/java/target/codegraph-java.jar}"
```

If `$CG` is empty or `$JAR` is absent → **fall back to the manual workflow**
(read the code as before). Say so in the reconnaissance summary. Never guess a
path; never install anything.

All artifacts go to `specy/codegraph/` (create it; add it to `.gitignore` or
commit it — the insights are worth keeping, the `.db` cache is not):

```bash
mkdir -p specy/codegraph
SRC=src/main/java                                   # ONE source root; several modules → run once per root and union later
java -jar "$JAR" --src "$SRC" --out specy/codegraph/model.jsonl
"$CG" validate specy/codegraph/model.jsonl           # exit 3 = findings; the artifacts are still usable, note it
"$CG" domain-facts specy/codegraph/model.jsonl --framework spring --out specy/codegraph/domain-facts.json   # drop --framework when no Spring/Jakarta
"$CG" explain specy/codegraph/model.jsonl --src "$SRC" --estimate --price-in 0.10 --price-out 0.60         # calls, input/output tokens, cost — FREE
"$CG" explain specy/codegraph/model.jsonl --src "$SRC" --dry-run                                            # the full plan: every unit, its layer and status — FREE
```

Read the estimate's `total` row and cost line and **ask the user before
spending** (prices are per million tokens; take them from the provider's model
page). Then:

```bash
OPENROUTER_API_KEY=… "$CG" explain specy/codegraph/model.jsonl --src "$SRC" \
    --out specy/codegraph/model.insights.jsonl [--max-calls N] [--scope java:com.acme.order,…]
# or through Cloudflare AI Gateway (one token authenticates and bills; model names are the same author/model):
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… [CLOUDFLARE_AI_GATEWAY_ID=…] "$CG" explain … --provider cloudflare
```

`--provider auto` (the default) uses whichever of the two is configured in
the environment and prints its choice; with both configured it keeps
OpenRouter unless told otherwise.

- `--max-calls N` runs a dependency-consistent prefix (leaves first); rerun
  without it later — everything already explained is **reused**, not paid twice.
- `--scope` restricts calls to the named modules/types (rendered ids as they
  appear in the plan). Use it to explain one bounded context at a time.
- Re-running after code changes redoes only units whose inputs or
  dependencies changed (Merkle fingerprints); the file is rewritten in place.
- `--concurrency 1` for a fresh OpenRouter account (20 requests a minute); the
  client backs off on a 429 and resumes, but a lower concurrency wastes less.
- `--framework spring` on `domain-facts` adds stereotypes (`controller`,
  `service`, `repository`, `entity`…) and `entryPoint` flags to the facts.

Whole-repository corpora are large (a 250 k-entity monolith plans ~100 M
prompt tokens): always dry-run, always scope.

---

## 2. Reading the artifacts

### `domain-facts.json` (`kind: codegraph.domainFacts/1`)

```
types[]      { id, kind (class|interface|enum|record|annotation), name, module, anchor{file,span}, stereotype?,
               annotations[{name, arguments[{name, value}]}], supertypes[{name, relation, external}],
               fields[{name, declaredTypeName, declaredTypeKind, declaredTypeExternal, value?, annotations[], anchor}],
               operations[{id, kind (method|constructor), name, signature, anchor, entryPoint, annotations[], metrics{sloc,cyclomatic},
                           invocations[{to, targetTypeName, targetStereotype, external, anchor}],
                           accesses[{field, ownerTypeName, isRead, isWrite, external, anchor}],
                           throws[{name, external, anchor}]}],
               injectionPoints[{id, declaredType, candidates[]}] }
modules[]    { id, name, types[], imports[{name, count, external}] }
```

Useful reads (all deterministic, sorted):

```bash
jq -r '.types[] | "\(.kind)\t\(.stereotype // "-")\t\(.name)\t\(.anchor.file)"' specy/codegraph/domain-facts.json
jq -r '.types[] | select(.name=="Order") | .fields[] | "\(.name): \(.declaredTypeName // "?") [\(.declaredTypeKind // "-")] \(.annotations|map(.name)|join(" "))"' specy/codegraph/domain-facts.json
jq -r '.types[] | .operations[] | select(.throws|length>0) | "\(.id) throws \(.throws|map(.name)|join(","))  @\(.anchor.file):\(.anchor.span[0])"' specy/codegraph/domain-facts.json
jq -r '.types[] | .operations[] | select(.entryPoint) | .id' specy/codegraph/domain-facts.json
jq -r '.modules[] | "\(.name) -> \(.imports|map(select(.external|not)|.name)|join(", "))"' specy/codegraph/domain-facts.json
```

### `model.insights.jsonl` (`kind: codegraph.insights/1`, `metamodel: specy.domain/3`)

One JSON per line: a `header`, then `i` records sorted operations → types →
modules, then an `eof` with counts and usage. Every record:

```
{ t:"i", id, key{lang,module,symbol}, level: operation|type|module, kind, name, file, scc?[members],
  origin: llm|template, block{…}, fingerprint, model, usage }
```

- `origin: template` = a trivial accessor/contract described without a model
  call (getter, setter, equals/hashCode/toString, field-assigning constructor).
  Never an operation in the `.domain` — its field is already in the type.
- `scc` = the record belongs to a dependency cycle; every member lists the
  whole group. At module level this is **mutually dependent packages**.
- `block.confidence` ∈ [0,1] is the model's own estimate.

Blocks, by level (the field names ARE the metamodel's):

| Level | Block fields |
|---|---|
| operation | `name`, `description`, `safe`, `idempotent`, `owner` (entity\|aggregate\|domainService\|applicationService\|infrastructureService\|repository\|valueType\|unknown), `handlesCommand`, `emits[{name, kind: internal\|external\|error\|temporal}]`, `preconditions[{name, predicate, violationReason}]`, `postconditions[{name, predicate}]`, `invariantsEnforced[]`, `usesSpi[{name, capability}]`, `domainTerms[]`, `confidence` |
| type | `name`, `description`, `concept` (entity\|readOnlyEntity\|aggregate\|valueType\|enum\|repository\|domainService\|applicationService\|infrastructureService\|event\|command\|query\|interface\|stateMachine\|invariant\|…\|notDomain\|unknown), `eventKind`, `interfaceRole` (API\|SPI), `aggregateRoot`, `containedIn`, `syncPattern`, `identity`, `fields[{name, type, kind: primitive\|valueType\|entityReference\|enum\|collection}]`, `invariants[{name, predicate, enforcement}]`, `stateMachine{states[], transitions[{from,to,operation}]}`, `relatesTo[{name, concept}]`, `exposes[]`, `dependsOn[{name, role}]`, `domainTerms[]`, `confidence` |
| module | `name`, `description`, `apis[{name, operations[]}]`, `spis[{name, capability}]`, `dependsOn[]`, `concepts[{name, concept}]`, `boundedContextHint{name, rationale}`, `sharedKernelHint`, `ubiquitousLanguage[{term, definition}]`, `confidence` |

Useful reads:

```bash
I=specy/codegraph/model.insights.jsonl
jq -r 'select(.t=="i" and .level=="type") | "\(.block.confidence)\t\(.block.concept)\t\(.name)\t\(.file)"' $I | sort -k2
jq -c 'select(.t=="i" and .level=="type" and .block.concept=="entity") | {name, identity: .block.identity, fields: .block.fields, invariants: .block.invariants, sm: .block.stateMachine}' $I
jq -c 'select(.t=="i" and .level=="operation" and .origin=="llm") | {id, safe: .block.safe, owner: .block.owner, cmd: .block.handlesCommand, pre: .block.preconditions, emits: .block.emits, spi: .block.usesSpi, c: .block.confidence}' $I
jq -c 'select(.t=="i" and .level=="module") | {name, ctx: .block.boundedContextHint, apis: .block.apis, spis: .block.spis, deps: .block.dependsOn, ul: .block.ubiquitousLanguage, cycle: .scc}' $I
jq -r 'select(.t=="i" and .block.confidence < 0.5) | "\(.level)\t\(.block.confidence)\t\(.id)"' $I      # what to read by hand
jq -r 'select(.t=="eof") | .counts, .usage' $I
```

---

## 3. From insights to Specy constructs

Insights are already in the metamodel's words; the mapping is mostly a copy,
under the evidence rules of §4.

| Insights | `.domain` construct |
|---|---|
| type `concept: entity` (+ `identity`) | `entity Name { identity … fields { … } }` — fields from **domain-facts** (declared types, constraints from annotations), the block's `fields[].kind` deciding primitive / value / reference / enum |
| type `concept: aggregate`, `aggregateRoot: true`; other types with `containedIn: Name` | `aggregate Name { … entities { Child … } }` — children = types whose `containedIn` names it (confirm with a `@OneToMany(cascade…)` / composition fact) |
| type `concept: readOnlyEntity`, `syncPattern` | `read-only entity … sourced-from … synced-via …` |
| type `concept: valueType` | `value Name { fields { … } }` |
| type `concept: enum` | `enum Name { camelCase values }` — values from domain-facts `fields[].value` |
| type `concept: command` / `query` | `command` (with `identity` = correlation id) / `query` (`reads-from`, `returns`) |
| type `concept: event`, `eventKind` | `event` / `external event` / `error event` / `temporal event` — `fields { }` from domain-facts |
| type `concept: domainService` / `applicationService` / `infrastructureService` | the matching service block; infrastructure = signatures only + `spi interface` |
| type `concept: repository` | derived from its entity — do NOT hand-author; use it to confirm the entity's persistence |
| type `concept: interface`, `interfaceRole` | `api interface` (`exposes …`) / `spi interface` (`describes …`) |
| type `invariants[]` (+ `enforcement`) | `invariants { name :: "…" { predicate } enforcement … }` inside the type |
| type `stateMachine` | `states { machine Name { state …  final …  a --> b on <operation> } }` — the enum-typed status field in domain-facts is the fact behind it |
| type `relatesTo[]` | `references { }` with cardinality from the declared field type (`List<T>` → `1..N`) |
| type `exposes[]` / `dependsOn[{role:API}]` | the module's `api interface` / `depends on` |
| type `dependsOn[{role:SPI}]`, operation `usesSpi[]` | an `spi interface` + the `infrastructure service` it `describes` |
| operation `handlesCommand` | `"Label" on CommandType { … }` inside the owner (the label is the operation's `name`) |
| operation `safe` / `idempotent` | `safe` / `unsafe` / `idempotent` on the operation |
| operation `preconditions[]` | `precondition name :: "…" { predicate } rejects "violationReason"` — the predicate must be re-expressed in the grammar (Test 3); the domain-facts **throw site** is the fact |
| operation `postconditions[]` | `postcondition name :: "…" { predicate }` |
| operation `emits[]` | `emits Event` (kind `error` → an `error event`); the fact is a `publish`/`throw` call in domain-facts |
| operation `invariantsEnforced[]` | cross-check against the type's `invariants[]`; an invariant named here but absent there → add it to the type |
| type `concept: notDomain` / operation `owner: unknown` | omit (`// NOTE: … (infrastructure)`) unless a fact contradicts |
| module `boundedContextHint` | a `context Name (shortname)` candidate — one `.domain` per context; confirm with the module import graph (few imports across the hint = a boundary) |
| module `apis` / `spis` / `dependsOn` | `module { exposes { } requires { } depends on { } }` |
| module `ubiquitousLanguage[]` | the `:: "description"` texts and the glossary in `gaps.report` |
| module `scc` + `sharedKernelHint` | context-map `shared kernel` when the packages are one context; otherwise a **refactoring note** "package cycle" naming the members and the hint |
| any record `description` | the construct's `:: "…"` description, shortened to one sentence |

---

## 4. Evidence rules (how the Decision Tests read the artifacts)

- **Test 1 — real?** A domain-facts entry (a field, an annotation, a call, a
  throw site, an import) is production evidence. An insights block **alone is
  not**: it must point at a fact — the record's `file`/span and a matching
  domain-facts entry — or be confirmed by reading that span. A block with no
  confirming fact is treated like test-only evidence at best (`// NOTE:
  inferred by codegraph explain, unconfirmed`), or dropped.
- **Confidence.** `confidence ≥ 0.7` with a confirming fact → emit. `0.4 – 0.7`
  → open the anchored span before emitting. `< 0.4` → `// UNCLEAR` or read the
  source as in the manual workflow. Never let a confidence number replace a fact.
- **Test 2 — domain?** `concept: notDomain`, `owner: unknown` on a templated
  accessor, `stereotype` = infrastructure glue are strong hints to omit — but
  apply the test yourself; the model is a colleague, not an oracle.
- **Test 3 — faithful?** Predicates in `preconditions[]` / `invariants[]` are
  prose or pseudo-code, never grammar. Rewrite them against the actual guard
  clause (domain-facts `throws[].anchor` points at it); if the grammar cannot
  say it, `// UNCLEAR` as usual.
- **Test 4 — right construct?** The `concept` is a proposal. Run the construct
  table on it; a `valueType` with an `@Id` field in domain-facts is an entity,
  whatever the block says.
- **Tests still count.** Test-aware enrichment (Phase 2, step 20) is unchanged:
  codegraph does not read test suites.
- **Source comments.** `// source:` uses the record's `file` (root-relative
  under `--src`); add `:L<start>` from the domain-facts anchor when the
  construct comes from one span.

---

## 5. Incremental updates by fingerprint

Every insights record carries a `fingerprint` — a hash of the unit's source,
its facts and its dependencies' fingerprints. Store the map `id → fingerprint`
in `specy/.meta.json` (see the Meta File section). On the next run:

1. Re-extract the model, rebuild `domain-facts.json`, rerun `codegraph explain`
   (unchanged units are reused for free).
2. Diff fingerprints: changed / new / vanished record ids → the definitions to
   re-extract (the filemap maps ids to Specy definitions through `file`).
3. Proceed as in Incremental Update Mode with that set; `git diff` is no longer
   the only delta source and catches nothing the fingerprints miss.
