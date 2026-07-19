# TypeScript / NestJS Architecture Heuristics

## Containers

| Source signal | Container inference |
|---|---|
| One `main.ts` with `NestFactory.create(...)` | one runnable `container` — technology `"Node/NestJS"` |
| Nx/Turborepo monorepo with several `apps/*` | one `container` per app |
| `@nestjs/typeorm` / Prisma datasource | a database `container` (technology from the dialect: `"PostgreSQL"`, …) |
| `@nestjs/microservices` Kafka transport, `kafkajs` | a broker `container` technology `"Kafka"` |
| `@nestjs/microservices` RMQ transport, `amqplib` | a broker `container` technology `"RabbitMQ"` |
| `ioredis` / `cache-manager` | a cache `container` technology `"Redis"` |
| A separate `apps/web` (Next/React/Vite) | a `container` technology e.g. `"Next.js SPA"` |
| `@Cron`/`@Interval` (`@nestjs/schedule`) | a scheduled-job container or component (publishes temporal-driven messages) |

## Components (inside a container)

| Source signal | Component inference |
|---|---|
| `@Controller()` class | `component` (HTTP edge) — **provides** an interface derived from its route handlers |
| `@Injectable()` service with business methods | `component` realizing a domain module |
| NestJS `@Module()` boundary | a strong `component` / `boundedContext` grouping |
| Repository / Prisma client usage | folded as a **requires** of the database container |
| `@MessagePattern`/`@EventPattern` handler | the enclosing `component` **subscribes** the mapped channel |
| `clientProxy.emit(topic, msg)` / `producer.send(...)` | the enclosing `component` **publishes** the message type **to** that channel |
| `HttpService`/`axios`/generated gRPC client to another service | the class **requires** an interface satisfied by an `externalSystem` or another container |

## Interfaces and operations

| Source signal | Interface / operation inference |
|---|---|
| Route handlers on one `@Controller` | one `interface` the controller **provides**; one `operation` per handler |
| `@Get()` (read) | `safe` operation (→ query) |
| `@Post()`/`@Put()`/`@Patch()`/`@Delete()` | bare request-response operation (→ command) |
| Handler returning `void`/`202` that only emits a message | `oneway` operation returning `void` (→ event emission) |
| `Observable<T>` / SSE / streaming response | `streaming` operation |
| A TS `interface`/abstract class used as an injection token / port | an architecture `interface` the consumer **requires** |
| Handler args | `@Body() dto` → `required` struct arg; `@Query('x') x?: T` → `optional`; ordinals in declaration order from `1:` |
| Thrown `HttpException`/`BadRequestException` etc. | `throws (SomeException)` + an `exception` type |

## Type system mapping

| TS type | .arch type |
|---|---|
| `string` | `string` |
| `number` | `int` (or `double`/`decimal` when the field is monetary/fractional — judge by name/usage) |
| `bigint` | `long` |
| `boolean` | `boolean` |
| `Date` | `datetime` |
| branded `Uuid`/`string & {…}` UUID | `uuid` |
| `Buffer`/`Uint8Array` | `binary` |
| `T[]`/`Array<T>` | `list<T>` |
| `Set<T>` | `set<T>` |
| `Map<K,V>`/`Record<K,V>` | `map<K, V>` |
| DTO `class`/`interface`/`type` | `struct` (fields ordinaled in declaration order; `field?:` or `@IsOptional()` → `optional`, else `required`) |
| `enum`/string-literal union | `enum` (members ordinaled `= 1, 2, …`) |
| A DTO that is exactly a domain value type and `.domain` exists | `import value type X from domain` |

## Connectors and channels

| Source signal | Wiring |
|---|---|
| `HttpService`/`axios` to an external API | `connect Caller.Port -> ExternalSystem.X over "REST/JSON" sync` |
| Internal `HttpService` call between containers | `connect A.Port -> B over "REST/JSON" sync` |
| gRPC client (`@nestjs/microservices` GRPC) | `over "gRPC" sync` (or `streaming`) |
| `@EventPattern('link.created')` | `channel linkCreated on EventBus { carries LinkCreated }` + `subscribes linkCreated` |
| `client.emit('link.created', evt)` | `publishes LinkCreated to linkCreated` |
| Topic carries a serialized domain event | `import event LinkCreated from domain` |

## Deployment hints

| Source signal | Environment inference |
|---|---|
| `.env.production` / `NODE_ENV` profiles | one `environment` per profile |
| `replicas:` in `k8s/*.yaml` / Helm | `deploy Container replicas N` |
| `docker-compose.yml` services | placement in a `local`/`dev` environment |
