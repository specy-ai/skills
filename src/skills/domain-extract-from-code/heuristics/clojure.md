# Clojure Heuristics

## Struct

| Source Pattern | Specy Type |
|---|---|
| `defrecord` with `:id` field | `entity` |
| `defrecord` without `:id` field | `value` |
| Keyword set used as allowed values, `s/def` with `#{...}` | `enum` |
| Map spec with command-like name (`::place-order`) | `command` |
| Map spec with event-like name (`::order-placed`) | `event` |
| `:id` field defined as `uuid?` or generated via `(random-uuid)` | `identity` field with type `uuid` (e.g. `identity id : uuid`) |
| `s/def` + `s/keys :req [...]` | `required` fields |
| `s/def` + `s/keys :opt [...]` | `optional` fields |
| `s/and`, `s/int-in`, `s/double-in` | numeric constraints |
| `defrecord` that owns other entities via nested collections (e.g. `:items` containing child entities) | `aggregate` root marker |

## Flow

| Source Pattern | Specy Construct |
|---|---|
| Pure function performing stateless business logic (calculations, cross-entity rules, no DB/IO) | `domain service` |
| Function orchestrating use cases (calls repositories + domain functions) | `application service` |
| Function adapting to external systems (payment gateways, email, notification services, HTTP clients) | `infrastructure service` |
| `defmulti` / `defmethod` dispatching on command type | entity/aggregate `operation` (command-triggered) |
| `(get-by-id db ...)` / query function | `resolves Entity from dotPath` |
| `(create! db ...)` / `(save! db ...)` | `creates Entity` |
| `(when (not ...) (throw ...))` | `precondition name :: "description" { condition } rejects "message"` |
| `(emit! ...)` / `(publish! ...)` | `emits Event` |
| `(assoc entity :field value)` | `sets Entity { field = value }` |
| `defmulti` / `defmethod` dispatching on event type that issues a command in response | `reaction Name { trigger EventName, guard { expression }, effect CommandName }` |
| `(doseq [item (:items entity)] ...)` / `(run! ... (:items entity))` | `foreach Entity.items as item { ... }` |
| `(mapv #(assoc-in % [:related :field] value) (:items entity))` | `foreach Entity.items as item { sets RelatedType { field = value } }` |
| `(assoc other-entity :field value)` where other-entity ≠ primary aggregate | `sets OtherEntity { field = value }` (cross-aggregate, add `::`) |

## Test Assertions (clojure.test)

| Test Pattern | Evidence for |
|---|---|
| `(is (thrown-with-msg? ExceptionInfo #"msg" (handle! cmd)))` | `precondition` with `rejects` — confirms rejection message |
| `(is (= :failed (:status (get-entity db id))))` | `sets Entity { status = failed }` |
| `(is (contains? @emitted-events :order-placed))` | `emits OrderPlaced` |
| `(is (not (contains? @emitted-events :order-placed)))` | Confirms event is NOT emitted on this path |
| `(is (= 1 (count @sent-notifications)))` | `NotificationService.op(args)` service call |
| `(deftest test-handle-when-*` (2+ on same handler with different preconditions) | Branch decomposition signal |
