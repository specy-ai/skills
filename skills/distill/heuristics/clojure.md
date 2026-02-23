# Clojure Heuristics

## Struct

| Source Pattern | Specy Type |
|---|---|
| `defrecord` with `:id` field | `entity` |
| `defrecord` without `:id` field | `value` |
| Keyword set used as allowed values, `s/def` with `#{...}` | `enum` |
| Map spec with command-like name (`::place-order`) | `command` |
| Map spec with event-like name (`::order-placed`) | `event` |
| `s/def` + `s/keys :req [...]` | `required` fields |
| `s/def` + `s/keys :opt [...]` | `optional` fields |
| `s/and`, `s/int-in`, `s/double-in` | numeric constraints |

## Flow

| Source Pattern | Specy Construct |
|---|---|
| `defmulti` / `defmethod` dispatching on command type | `interaction` block |
| `defmulti` / `defmethod` dispatching on event type | event-triggered `interaction` block |
| `(get-by-id db ...)` / query function | `resolves Entity from dotPath` |
| `(create! db ...)` / `(save! db ...)` | `creates Entity` |
| `(when (not ...) (throw ...))` | `fails "msg" when { condition }` |
| `(emit! ...)` / `(publish! ...)` | `emits Event` |
| `(assoc entity :field value)` | `sets Entity.field to value` |
| `(doseq [item (:items entity)] ...)` / `(run! ... (:items entity))` | `foreach Entity.items as item { ... }` |
| `(mapv #(assoc-in % [:related :field] value) (:items entity))` | `foreach Entity.items as item { sets item.related.field to value }` |
| `(assoc other-entity :field value)` where other-entity ≠ primary aggregate | `sets OtherEntity.field to value` (cross-aggregate, add `::`) |
