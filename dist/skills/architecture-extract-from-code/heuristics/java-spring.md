# Java / Spring Boot Architecture Heuristics

## Containers

| Source signal | Container inference |
|---|---|
| One module/jar with a `@SpringBootApplication` main class | one runnable `container` — technology `"Java/Spring Boot"` |
| Multi-module Maven/Gradle build, each with its own `@SpringBootApplication` | one `container` per deployable module |
| `application.yml` datasource / JPA config | a database `container` — technology from the JDBC URL (`"PostgreSQL"`, `"MySQL"`, …), no components |
| `spring-kafka`, `KafkaTemplate`, `@KafkaListener` | a broker `container` technology `"Kafka"` (host for channels) |
| `spring-rabbit`, `RabbitTemplate`, `@RabbitListener` | a broker `container` technology `"RabbitMQ"` |
| `RedisTemplate`, `spring-data-redis` | a cache/store `container` technology `"Redis"` |
| `@Scheduled`, Quartz, Spring Batch `Job` | a scheduled-job `container` technology `"Spring Scheduler"` (publishes temporal-driven messages) |
| A separate frontend module (`package.json` + bundler) served as SPA | a `container` technology e.g. `"React SPA"` |

## Components (inside a container)

| Source signal | Component inference |
|---|---|
| `@RestController` / `@Controller` class | `component` (an HTTP edge) — **provides** an interface derived from its request mappings |
| `@Service` / `@Component` with business methods | `component` realizing a domain module |
| `@Repository` / Spring Data interface | usually folded into the owning component as a **requires** of the database container; not a component of its own unless it is a distinct adapter |
| `@FeignClient`, `RestTemplate`/`WebClient` bean, gRPC stub | the calling class **requires** an interface satisfied by an `externalSystem` or another container — model the connector |
| `@KafkaListener` / `@RabbitListener` method | the enclosing `component` **subscribes** the channel the topic maps to |
| `KafkaTemplate.send(...)` / `rabbitTemplate.convertAndSend(...)` | the enclosing `component` **publishes** the message type **to** that channel |
| package boundary (`com.acme.billing.*`) aligning with a domain module | the package is a strong `component` / `boundedContext` boundary |

## Interfaces and operations

| Source signal | Interface / operation inference |
|---|---|
| Group of `@RequestMapping`/`@GetMapping`/`@PostMapping` on one controller | one `interface` the controller **provides**; one `operation` per endpoint |
| `@GetMapping` (read, no mutation) | `safe` operation (→ query) |
| `@PostMapping`/`@PutMapping`/`@PatchMapping`/`@DeleteMapping` | bare request-response operation (→ command) |
| `void` handler that only emits a message / returns `202 Accepted` | `oneway` operation returning `void` (→ event emission) |
| `Flux<T>` / SSE / streaming return | `streaming` operation |
| A Java `interface` used as a client/port contract (`*Client`, `*Gateway`, `*Port`) | an architecture `interface` the consumer **requires** |
| Method parameters | Thrift args: `@RequestBody` DTO → `required` struct-typed arg; `@RequestParam(required=false)` → `optional`; assign ordinals in declaration order from `1:` |
| `@ResponseStatus`/thrown `*Exception` mapped to a 4xx/5xx | `throws (SomeException)` + an `exception` type |

## Type system mapping

| Java type | .arch type |
|---|---|
| `String` | `string` |
| `int`/`Integer`/`short` | `int` |
| `long`/`Long` | `long` |
| `double`/`Double`/`float`/`BigDecimal` | `double` for floats, `decimal` for `BigDecimal` |
| `boolean`/`Boolean` | `boolean` |
| `UUID` | `uuid` |
| `LocalDate` | `date` |
| `LocalDateTime`/`OffsetDateTime`/`ZonedDateTime` | `datetime` |
| `Instant` | `instant` |
| `Duration`/`Period` | `duration` |
| `byte[]`/`ByteBuffer` | `binary` |
| `List<T>`/`T[]` | `list<T>` |
| `Set<T>` | `set<T>` |
| `Map<K,V>` | `map<K, V>` |
| Request/response DTO `record`/`class` | `struct` (fields ordinaled in declaration order; non-null/`@NotNull` → `required`, nullable/`Optional<T>` → `optional`) |
| `enum` | `enum` (members ordinaled `= 1, 2, …`) |
| A DTO that is exactly a domain value type and `.domain` exists | `import value type X from domain` |

## Connectors and channels

| Source signal | Wiring |
|---|---|
| `@FeignClient(name="payments")` → external | `connect Caller.PaymentPort -> Payments.X over "REST/JSON" sync` |
| `WebClient`/`RestTemplate` to another internal container | `connect A.Port -> B over "REST/JSON" sync` |
| gRPC stub | `over "gRPC" sync` (or `streaming` for streaming RPCs) |
| `@KafkaListener(topics="link.created")` | `channel linkCreated on EventBus { carries LinkCreated }` + subscriber `subscribes linkCreated` |
| `KafkaTemplate.send("link.created", evt)` | publisher `publishes LinkCreated to linkCreated`; the message type is the imported domain event when names align |
| The topic carries a serialized domain event | `import event LinkCreated from domain` for the carried type |

## Deployment hints

| Source signal | Environment inference |
|---|---|
| Spring profiles (`application-prod.yml`, `application-staging.yml`) | one `environment` per profile |
| `replicas:` in a `k8s/*.yaml` / Helm `values.yaml` | `deploy Container replicas N` |
| `docker-compose.yml` services | container placement in a `local`/`dev` environment |

### Deployment: nodes and resources

| Source signal | Inference |
|---|---|
| `spring.cloud.aws.region.static`, `AWS_REGION` in a k8s `Deployment`'s `env`, a Terraform `provider "aws"` block | `provider` / `region` of the `node` the container runs on |
| Helm `values-<cluster>.yaml`, an Argo CD `Application` `destination` | one `node` per target cluster, nested in its region node |
| `spring.datasource.url` host of a managed instance (`….<region>.rds.amazonaws.com`, a Cloud SQL socket factory) matching a database in Terraform/CloudFormation | a `resource` that `instantiates` the database container; `technology` from the IaC engine and version |
| `spring.kafka.bootstrap-servers` pointing at a managed cluster (MSK, Confluent Cloud) declared in IaC | a `resource` that `instantiates` the broker container |
| Spring Data repositories, Flyway/Liquibase migrations writing to that datasource | `stores`, only for records that match a struct the `.arch` declares |

Each node and resource gets a `// source:`; `provider`, `region` and `zone` are written only when a file states them.

## Cross-system integration (level 0 — organization runs only)

| Source signal | Level-0 inference |
|---|---|
| `@FeignClient`, a `WebClient` / `RestClient` / `RestTemplate` bean, a gRPC stub or a vendor SDK bean whose base URL or config key points at another system | an integration with that system: one `automated` flow per business exchange. Its dependency follows the need, not the call — a read makes the caller depend on the callee; a push of the caller's own records makes the callee depend on the caller; a request for the callee to act on the caller's behalf makes the caller depend on it, with a flow `to` the callee |
| `@KafkaListener` / `@RabbitListener` on a topic or queue another system publishes; a `@RestController` registered as that system's webhook | `dependency Subscriber -> Publisher`; flow in the default direction |
| Spring Integration SFTP / file adapters, a Spring Batch job reading another system's export, a `@Scheduled` import | a flow `over "SFTP file"` / `over "scheduled import"`, `automated` |
| A second `DataSource` bean, or native queries across schemas, on another system's database | a flow `over "shared database" automated` |
| A MapStruct `@Mapper` or a hand-written `*Mapper` / `*Translator` between the peer's DTO and a type of our own | `carries X as Y`; `ACL` when it sits in a layer of its own (an `acl` / `anticorruption` / per-peer adapter package) |
| The peer's generated models or shared library types used in `@Entity` classes and services, with no mapper | `Conformist` |
| Resilience4j / Spring Cloud CircuitBreaker `@CircuitBreaker(fallbackMethod = …)`, `@FeignClient(fallback = …)` | `criticality degraded` |
| The exchange only goes through a listener container or an outbox table | `criticality tolerant` |

Patterns, criticality and `as` are written only when the signal is present, and an `ACL` or a criticality cue counts only in the code of the downstream system — the one that needs the other. The direction rule (Phase 2, step 22) and the rest of the evidence rules (*Level-0 inference* table) are in the skill.
