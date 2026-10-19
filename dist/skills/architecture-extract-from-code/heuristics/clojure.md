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

### Deployment: nodes and resources

| Source signal | Inference |
|---|---|
| Aero `config.edn` `#profile` with `:region` / `:aws-region`, `AWS_REGION` in a k8s manifest, a Terraform `provider` block | `provider` / `region` of the `node` the container runs on |
| k8s manifests or Helm values per cluster | one `node` per cluster, nested in its region node |
| next.jdbc / HikariCP `:jdbcUrl` pointing at a managed instance declared in Terraform | a `resource` that `instantiates` the database container; `technology` from the IaC engine and version |
| Datomic Cloud client config (`:system`, `:region`) | a `resource` with `technology "Datomic Cloud"` on the node of that region |
| next.jdbc / HoneySQL writes or Migratus migrations against that datasource | `stores`, only for records that match a struct the `.arch` declares |

Each node and resource gets a `// source:`; `provider`, `region` and `zone` are written only when a file states them.

## Cross-system integration (level 0 — organization runs only)

| Source signal | Level-0 inference |
|---|---|
| `clj-http` / `hato` calls, or a vendor SDK client, whose base URL or config key points at another system | an integration with that system: one `automated` flow per business exchange. Its dependency follows the need, not the call — a read makes the caller depend on the callee; a push of the caller's own records makes the callee depend on the caller; a request for the callee to act on the caller's behalf makes the caller depend on it, with a flow `to` the callee |
| A `jackdaw` consumer on a topic another system publishes; a route registered as that system's webhook | `dependency Subscriber -> Publisher`; flow in the default direction |
| A `chime` / scheduled go-loop job that pulls another system's export; an SFTP client (`clj-ssh`) | a flow `over "SFTP file"` / `over "scheduled import"`, `automated` |
| A second `next.jdbc` datasource on another system's database | a flow `over "shared database" automated` |
| Translation functions between the peer's map shape and our own (`order->shipment`, `->invoice`) | `carries X as Y`; `ACL` when they sit in a namespace of their own (an `acl` / `anticorruption` / per-peer adapter namespace) |
| The peer's map shape or specs passed as they are into our core namespaces and persistence | `Conformist` |
| A `diehard` circuit breaker or fallback around the call | `criticality degraded` |
| The exchange only goes through a topic consumer or an outbox table | `criticality tolerant` |

Patterns, criticality and `as` are written only when the signal is present, and an `ACL` or a criticality cue counts only in the code of the downstream system — the one that needs the other. The direction rule (Phase 2, step 22) and the rest of the evidence rules (*Level-0 inference* table) are in the skill.
