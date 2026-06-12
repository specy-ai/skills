# Clojure — domain → code heuristics

Realizes the stack-agnostic contract idiomatically in Clojure: data-first (maps + specs), pure domain
functions, side effects pushed to the edges. Keep the `domain` namespaces pure; put IO/adapters in
`infrastructure`.

## Structure

| Domain building block | Clojure code |
|---|---|
| Value type | A `clojure.spec.alpha` spec (`s/def`) + a `->value` constructor fn that `s/assert`s invariants (transactional constructor: invalid ⇒ throws). Values are plain immutable maps/records. |
| Enum | A set of keywords: `(s/def ::status #{:active :deactivated :deleted})`. Value-backed enum → a map keyed by code. |
| Identity | A namespaced-keyword id field with a spec (e.g. `::order-id` as `uuid?`); ids are values in the entity map. |
| Entity | An immutable map with a spec describing its fields; "mutation" = pure functions returning a new map. Identity = the id key. |
| Aggregate root | The root entity map containing/owning contained entities; operations are pure fns `(operation root args) -> root'`. Only the root has a repository. |
| Field `required`/`min`/`max`/`pattern`/`immutable` | encoded in the entity/value spec (`s/keys :req`, predicates, `re-matches`); `immutable` enforced by never providing an update fn for that key. `unique` enforced in the repository adapter. |
| Command | A spec'd map `(s/def ::place-order (s/keys :req [::correlation-id ...]))` + a handler fn. |
| Query | A spec'd request map + a read fn returning the declared shape. |
| Event | A spec'd map (past-tense name) published via an event-publisher port (a protocol or a fn passed in). `error`/`temporal` are just events with a classifier key. |
| Repository (derived) | A protocol `(defprotocol OrderRepository (store [_ order]) (get-by-id [_ id]) (remove* [_ id]) (search [_ criteria]))` + `find-by-*` from queries. Adapter `reify`/`defrecord` in `infrastructure`. |
| Domain service | A namespace of pure functions spanning entities; no IO. |
| Application service | A function that takes ports (repository, publisher) + a command, loads the aggregate, calls the domain fn, stores, publishes — the only place effects happen. |
| Infrastructure service | A protocol in `domain` + a `defrecord` adapter in `infrastructure` (ACL). |

## Flow

| Domain building block | Clojure code |
|---|---|
| Operation `"place order" on PlaceOrder` | a pure fn `(place-order order cmd) -> order'` in the aggregate ns; the application handler threads it: `(->> (get-by-id repo id) (place-order cmd) (store repo))` then publishes. |
| `accepts a : A` | fn parameters (spec'd). |
| `precondition "x" { cond } violation "msg"` | `(when-not cond (throw (ex-info "msg" {:type :precondition})))` at fn top. |
| `creates Entity { f = v }` | a `->entity` constructor returning a new map. |
| `sets Entity { f = v }` | `(assoc entity :f v)` in a named fn. |
| `emits Event { ... }` | return emitted events as data (e.g. `{:state order' :events [...]}`); the handler publishes them. |
| `foreach xs as x { ... }` | `(reduce ... xs)` / `(mapv ...)` — return new state, no in-place effects. |
| Invariant (`reject`/`compensation`/`alert`) | a predicate checked before returning (throw on `reject`); `compensation` → return a corrective command; `alert` → emit an alert event. |
| Reaction `reaction "r" { triggered-by E, effects C }` | a handler registered for event `E` that (checks guard, then) dispatches command `C` (via a command bus / queue). |
| State machine | a `:status` key + a transition map `{:active #{:deactivated :deleted}}`; operations assert the transition is allowed; state invariants checked while in that state. |
| Agreement / reconciliation | a process fn subscribed to participant events that checks the predicate and issues compensating commands with retry/escalation. |

## Conventions
- Namespaces: `<context>.<domain|application|infrastructure>.<module>`.
- `satisfies [REQ-...]` → a `;; satisfies: REQ-ORD-001` comment (or `:satisfies` metadata) on the def.
- Domain namespaces are pure (no `clojure.java.jdbc`, no `http`); effects live in `infrastructure`.
- Validate at boundaries with `s/assert` / `s/conform`.
