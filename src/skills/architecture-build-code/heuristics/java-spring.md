# Java / Spring Boot — architecture → scaffolding heuristics

Realizes the stack-agnostic Element → code contract for Java 21 + Spring Boot 3, paired with the
`java-spring` stack-binding tables (*type → language type*, *protocol → framework*). One Gradle module per
`container`; shared contracts in a `contracts` module. Generate the **skeleton**; delegate business logic to
the domain layer (`domain-build-code`).

## Types (the contracts)

| `.arch` type | Java |
|---|---|
| `struct S { 1: required string a; 2: optional int b }` | `record S(String a, Integer b) {}` — `required` ⇒ non-null (`Objects.requireNonNull` in compact ctor), `optional` ⇒ nullable/`Optional`. Field order = ordinal order. |
| `enum E { active = 1; … }` | `enum E { ACTIVE, … }` with an `int ordinalValue` carrying the explicit Thrift ordinal (do not rely on Java's positional ordinal). |
| `typedef Url = string` | a newtype `record Url(String value) {}` (avoid bare `String` to keep the alias meaningful). |
| `union U { 1: A a; 2: B b }` | `sealed interface U permits …` + a record per member (oneof). |
| `exception SlugTaken { 1: required string slug }` | `final class SlugTaken extends RuntimeException` carrying the fields; mapped at the edge to the protocol error (HTTP 409 / gRPC `ALREADY_EXISTS`). |
| `import value type Slug from domain` | import the domain value type from the domain module — do not re-declare. |
| `import event LinkCreated from domain` | import the domain event as a channel message type. |
| primitives / containers | per the binding table (`decimal → BigDecimal`, `instant → Instant`, `uuid → UUID`, `binary → byte[]`, `list<T> → List<T>`, …). |

## Interfaces & operations (ports)

| `.arch` | Java |
|---|---|
| `interface LinkCommands { … }` | a Java `interface LinkCommands` owning the operation signatures (the port type). `realizes` a domain interface ⇒ Javadoc `/** realizes: interface … */`. |
| operation *(default)* `createLink(...) returns ShortLinkDTO throws (SlugTaken)` | `ShortLinkDTO createLink(...) throws SlugTaken;` — request-response (command). |
| `safe resolve(...) returns ShortLinkDTO` | idempotent read method `ShortLinkDTO resolve(...);` — no mutation (query). |
| `oneway recordClick(...) returns void` | `void recordClick(...);` fire-and-forget (event emission). |
| `streaming tail(...) returns ClickDTO` | `Flux<ClickDTO> tail(...);` (Reactor) or `Stream<ClickDTO>`. |
| argument `2: optional datetime expiresAt = null` | parameter `LocalDateTime expiresAt` (nullable); default applied at the edge. Keep ordinals if emitting `.proto`/`.thrift` IDL. |

## Components & ports

| `.arch` | Java |
|---|---|
| `component LinkController { provides LinkCommands … }` | `@Component class LinkController implements LinkCommands` — a service skeleton. Each operation body delegates to the realized domain module (`domain-build-code` output) or `throw new UnsupportedOperationException("// UNCLEAR: no domain backing")`. |
| `requires SlugAllocation` | a constructor-injected field `private final SlugAllocation slugAllocation;` typed by the required interface; the bound connector supplies the client implementation. Unwired ⇒ `// UNCLEAR` stub bean + report entry. |
| `realizes module "Link Management"` | Javadoc `/** realizes: module "Link Management" */` and a call seam into that module's application service; never inline domain logic. |
| `boundedContext LinkManagement` | a package segment `…linkmanagement…`. |

## Connectors (transport adapters), per `protocol → framework`

| `.arch` connector | Java (consumer side) | Java (provider side) |
|---|---|---|
| `over "REST/JSON" sync` | a `WebClient`-based client implementing the required interface (outbound adapter). | `@RestController` exposing the provided interface (inbound adapter), Jackson codec. |
| `over "gRPC" sync` | grpc-java blocking stub wrapped to implement the interface. | grpc-java service base impl delegating to the component. |
| `over "Thrift"` | Thrift client. | Thrift processor. |
| `… async` | non-blocking `WebClient`/reactive client or a message send. | `@Async` / reactive endpoint. |
| `… streaming` | reactive client returning `Flux`. | streaming endpoint (SSE / gRPC server-streaming). |
| left side is a `Person` / UI | generate only the provider-side inbound controller. | — |
| right side is an `externalSystem` | generate the outbound client only (it crosses our boundary). | — |

## Channels (first-class async), per broker binding

| `.arch` | Java (`Kafka` → spring-kafka) |
|---|---|
| `channel events on EventBus { carries LinkCreated, ClickRecorded }` | a topic `events`; a typed `KafkaTemplate<…, EventEnvelope>` producer and a `@KafkaListener(topics="events")` consumer scaffold, payloads = the carried (often imported domain) types. |
| component `publishes LinkCreated to events` | a producer method on the component that sends `LinkCreated` to `events`. |
| component `subscribes events` | a `@KafkaListener` handler stub dispatching carried message types into the realized domain reaction. |

## Containers & deployment

| `.arch` | Java / Spring |
|---|---|
| `container Api technology "Clojure/Ring" { … }` | one Gradle module with its own `build.gradle`, deps from the binding, `@SpringBootApplication` composition root wiring its components, adapters, and channel beans. (The `technology` string is descriptive; the binding decides the actual stack.) |
| `container LinkDb technology "PostgreSQL"` | no service module — `application.yml` datasource config + Flyway placeholder under the consuming module; appears in `deploy/`. |
| `container EventBus technology "Kafka"` | no service module — Kafka connection + topic declarations; appears in `deploy/`. |
| container-level `provides`/`requires` | module-level ports (black-box surface) realized by gateway beans. |
| `environment production { deploy Api replicas 3; deploy LinkDb }` | a k8s manifest per environment under `deploy/production/` with `replicas: 3` (placement + replicas only). |

## Conventions
- Package: `<rootPackage>.<container>.<components|adapters.inbound|adapters.outbound|messaging|composition>`.
- `satisfies [NFR-PERF-001]` → `/** satisfies: NFR-PERF-001 */` on the type/interface/component/container.
- Prefer constructor injection; the composition root (`@Configuration`/`@SpringBootApplication`) wires ports
  to connector adapters. No field injection.
- The `contracts` module imports only `java.*` and domain types — no `org.springframework.*`; framework
  annotations live in container modules' adapters.
- Preserve Thrift ordinals + requiredness in any generated `.proto`/`.thrift` IDL.
