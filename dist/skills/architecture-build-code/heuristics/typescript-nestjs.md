# TypeScript / NestJS — architecture → scaffolding heuristics

Realizes the stack-agnostic Element → code contract for TypeScript + NestJS, paired with the
`typescript-nestjs` stack-binding tables. One Nx app/lib per `container`; shared contracts in a `contracts`
lib. Generate the **skeleton**; delegate business logic to the domain layer (`domain-build-code`).

## Types (the contracts)

| `.arch` type | TypeScript |
|---|---|
| `struct S { 1: required string a; 2: optional int b }` | `interface S { a: string; b?: number }` (DTO edge: a `class` with `class-validator` decorators). `required` ⇒ non-optional, `optional` ⇒ `?`. |
| `enum E { active = 1; … }` | `enum E { active = 1, … }` — keep the Thrift ordinal as the numeric value. |
| `typedef Url = string` | a branded type `type Url = string & { readonly __brand: 'Url' }`. |
| `union U { 1: A a; 2: B b }` | a discriminated union `type U = ({ kind: 'a' } & A) \| ({ kind: 'b' } & B)`. |
| `exception SlugTaken { 1: required string slug }` | `class SlugTaken extends Error { constructor(readonly slug: string) … }`; mapped at the edge to a Nest `HttpException` (409). |
| `import value type Slug from domain` | import the domain type from the domain lib — do not re-declare. |
| `import event LinkCreated from domain` | import the domain event as a channel message type. |
| primitives / containers | per the binding table (`long → bigint`, `decimal → string` with a `// NOTE`, `binary → Buffer`, `list<T> → T[]`, `set<T> → Set<T>`, `map → Map`). |

## Interfaces & operations (ports)

| `.arch` | TypeScript |
|---|---|
| `interface LinkCommands { … }` | a TS `interface LinkCommands` (the port type) owning operation signatures; injected via a Nest provider token. |
| operation *(default)* `createLink(...) returns ShortLinkDTO throws (SlugTaken)` | `createLink(...): Promise<ShortLinkDTO>` (rejects with `SlugTaken`) — command. |
| `safe resolve(...)` | `resolve(...): Promise<ShortLinkDTO>` — idempotent read (query). |
| `oneway recordClick(...) returns void` | `recordClick(...): void` (fire-and-forget). |
| `streaming tail(...)` | `tail(...): Observable<ClickDTO>` (RxJS) or an `AsyncIterable`. |
| argument `2: optional datetime expiresAt = null` | `expiresAt?: Date` with default applied at the edge. Keep ordinals in any generated `.proto`. |

## Components & ports

| `.arch` | NestJS |
|---|---|
| `component LinkController { provides LinkCommands … }` | an `@Injectable()` class implementing `LinkCommands`; each method delegates to the realized domain module or `throw new Error('// UNCLEAR: no domain backing')`. |
| `requires SlugAllocation` | a constructor-injected `private readonly slugAllocation: SlugAllocation` (Nest DI token); the bound connector supplies the client. Unwired ⇒ `// UNCLEAR` stub provider. |
| `realizes module "Link Management"` | a `// realizes: module "Link Management"` comment + a call seam into that module's application service. |
| `boundedContext LinkManagement` | a folder/module segment `link-management`. |

## Connectors (transport adapters), per `protocol → framework`

| `.arch` connector | TS (consumer side) | TS (provider side) |
|---|---|---|
| `over "REST/JSON" sync` | a `@Injectable` client using Nest `HttpService` (axios) implementing the required interface. | a Nest `@Controller` exposing the provided interface. |
| `over "gRPC" sync` | a gRPC `ClientProxy` wrapped to implement the interface. | a `@GrpcMethod` controller. |
| `… async` | a non-blocking client or `ClientProxy.emit`. | an `@EventPattern` handler. |
| `… streaming` | client returning `Observable`. | a streaming `@GrpcStreamMethod` / SSE endpoint. |
| left side is a `Person` / UI | generate only the provider-side controller. | — |
| right side is an `externalSystem` | generate the outbound client only. | — |

## Channels (first-class async), per broker binding

| `.arch` | NestJS (`Kafka` → microservice transport) |
|---|---|
| `channel events on EventBus { carries LinkCreated, ClickRecorded }` | a Kafka microservice client (`ClientKafka`) producer + an `@EventPattern('events')` consumer scaffold typed by the carried message types. |
| component `publishes LinkCreated to events` | a producer method emitting `LinkCreated` to `events`. |
| component `subscribes events` | an `@EventPattern` handler dispatching carried messages into the realized domain reaction. |

## Containers & deployment

| `.arch` | NestJS |
|---|---|
| `container Api technology "…" { … }` | one Nx app with its own `main.ts` bootstrap + root `AppModule` wiring its components, adapter providers, and channel clients. |
| `container LinkDb technology "PostgreSQL"` | no app — TypeORM/Prisma datasource config under the consuming app; appears in `deploy/`. |
| `container EventBus technology "Kafka"` | no app — Kafka transport config + topic names; appears in `deploy/`. |
| container-level `provides`/`requires` | module-level ports realized by gateway providers. |
| `environment production { deploy Api replicas 3 }` | a `docker-compose.yml` (or k8s) per environment under `deploy/production/` with the replica hint. |

## Conventions
- Layout: `<container>/src/{components,adapters/inbound,adapters/outbound,messaging,composition}`.
- `satisfies [NFR-PERF-001]` → a `// satisfies: NFR-PERF-001` comment on the type/interface/component.
- DI by token + constructor injection; the root module wires ports to connector adapters.
- The `contracts` lib holds pure types + interfaces (no `@nestjs/*`); decorators live in app adapters.
- Preserve Thrift ordinals + requiredness in any generated `.proto`.
