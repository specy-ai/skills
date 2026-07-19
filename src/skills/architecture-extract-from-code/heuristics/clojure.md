# Clojure Architecture Heuristics

## Containers

| Source signal | Container inference |
|---|---|
| One `deps.edn`/`project.clj` with a `-main` and an HTTP server start (Ring/Jetty, Pedestal, http-kit) | one runnable `container` — technology `"Clojure/Ring"` (or `"Clojure/Pedestal"`) |
| A `mount`/`integrant`/`component` system map with several started servers | one `container` per independently startable server |
| `next.jdbc` / `clojure.java.jdbc` datasource | a database `container` (technology from the JDBC URL) |
| `jackdaw`/`kafka` client | a broker `container` technology `"Kafka"` |
| `langohr` (RabbitMQ) | a broker `container` technology `"RabbitMQ"` |
| `carmine` (Redis) | a cache `container` technology `"Redis"` |
| A ClojureScript app (`shadow-cljs.edn`, reagent/re-frame) | a `container` technology e.g. `"ClojureScript SPA"` |
| `chime`/`quartzite`/scheduled go-loop | a scheduled-job container/component |

## Components (inside a container)

| Source signal | Component inference |
|---|---|
| A namespace defining Ring routes (`reitit`/`compojure`/Pedestal routes) | `component` (HTTP edge) — **provides** an interface derived from the route table |
| A namespace of pure business functions over domain data | `component` realizing a domain module |
| A `defprotocol` + `defrecord` implementing it (ports & adapters) | the protocol is an architecture `interface`; the record's namespace **provides** it |
| A namespace consuming a `defprotocol` via a started component | the consumer **requires** that interface |
| `mount`/`integrant`/`component` boundaries | strong `component` boundaries |
| A Kafka consumer go-loop / `jackdaw` consumer | the enclosing `component` **subscribes** the mapped channel |
| `producer/send!` / `(produce! ...)` | the enclosing `component` **publishes** the message type **to** that channel |
| An HTTP client call (`clj-http`, `hato`) to another service | the namespace **requires** an interface satisfied by an `externalSystem` or another container |

## Interfaces and operations

| Source signal | Interface / operation inference |
|---|---|
| A route table grouped by resource | one `interface` per coherent route group; one `operation` per route |
| `GET` route / pure read | `safe` operation (→ query) |
| `POST`/`PUT`/`PATCH`/`DELETE` route | bare request-response operation (→ command) |
| Route returning `202`/only producing a message | `oneway` operation returning `void` (→ event emission) |
| SSE / streaming / chunked response | `streaming` operation |
| `defprotocol` methods | architecture `interface` operations; protocol method arglists → Thrift args, ordinals in declaration order from `1:` |
| spec/Malli request schema with optional keys | optional keys → `optional` args/fields; required keys → `required` |
| `ex-info` with an `:error` type mapped to a 4xx/5xx | `throws (SomeException)` + an `exception` type |

## Type system mapping

| Clojure / spec hint | .arch type |
|---|---|
| `string?` | `string` |
| `int?`/`integer?` | `int` (`long` if explicitly long) |
| `double?`/`float?` | `double` |
| `decimal?`/`bigdec` | `decimal` |
| `boolean?` | `boolean` |
| `uuid?` | `uuid` |
| `inst?`/`java.time.Instant` | `instant` |
| `java.time.LocalDate` | `date` |
| `java.time.LocalDateTime` | `datetime` |
| `java.time.Duration` | `duration` |
| `bytes?`/byte array | `binary` |
| `(s/coll-of T)` vector | `list<T>` |
| `(s/coll-of T :kind set?)` | `set<T>` |
| `(s/map-of K V)` | `map<K, V>` |
| A request/response map spec (`s/keys`) | `struct` (ordinal keys in declaration order; `:opt`/`:opt-un` → `optional`, `:req`/`:req-un` → `required`) |
| A closed enumerated set (`#{:a :b}` / `s/def ::status #{…}`) | `enum` (members ordinaled `= 1, 2, …`) |
| A map spec that is exactly a domain value type and `.domain` exists | `import value type X from domain` |

## Connectors and channels

| Source signal | Wiring |
|---|---|
| `clj-http`/`hato` call to an external API | `connect Caller.Port -> ExternalSystem.X over "REST/JSON" sync` |
| Internal HTTP call between containers | `connect A.Port -> B over "REST/JSON" sync` |
| gRPC interop | `over "gRPC" sync` (or `streaming`) |
| `jackdaw` consumer of topic `"link.created"` | `channel linkCreated on EventBus { carries LinkCreated }` + `subscribes linkCreated` |
| `produce!` to topic `"link.created"` | `publishes LinkCreated to linkCreated` |
| Topic carries a serialized domain event | `import event LinkCreated from domain` |

## Deployment hints

| Source signal | Environment inference |
|---|---|
| `:aliases` / env-based config (`environ`, profiles) | one `environment` per profile |
| `replicas:` in `k8s/*.yaml` / Helm | `deploy Container replicas N` |
| `docker-compose.yml` services | placement in a `local`/`dev` environment |
