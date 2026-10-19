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

### Deployment: nodes and resources

| Source signal | Inference |
|---|---|
| AWS CDK stack `env: { region }`, `serverless.yml` `provider.name` / `provider.region`, `AWS_REGION` | `provider` / `region` of the `node` the container runs on |
| k8s manifests or Helm values per cluster | one `node` per cluster, nested in its region node |
| CDK constructs `rds.DatabaseInstance`, `s3.Bucket`, `sqs.Queue`, `elasticache.CfnCacheCluster`, `secretsmanager.Secret`; Terraform equivalents | a `resource` on that node; `technology` from the construct's engine and version |
| TypeORM / Prisma / Mongoose connection `host` or `url` matching such a resource | the resource `instantiates` the database container |
| TypeORM entities, Prisma models, migrations persisted to that datasource | `stores`, only for records that match a struct the `.arch` declares |

Each node and resource gets a `// source:`; `provider`, `region` and `zone` are written only when a file states them.

## Cross-system integration (level 0 — organization runs only)

| Source signal | Level-0 inference |
|---|---|
| `HttpService` / `axios`, a generated client or a vendor SDK provider whose base URL or config key points at another system | an integration with that system: one `automated` flow per business exchange. Its dependency follows the need, not the call — a read makes the caller depend on the callee; a push of the caller's own records makes the callee depend on the caller; a request for the callee to act on the caller's behalf makes the caller depend on it, with a flow `to` the callee |
| `@EventPattern` / `@MessagePattern` on a topic another system publishes; a BullMQ `@Processor` on its queue; a controller registered as that system's webhook | `dependency Subscriber -> Publisher`; flow in the default direction |
| A `@Cron` / `@Interval` job that pulls another system's export; an SFTP client (`ssh2-sftp-client`) | a flow `over "SFTP file"` / `over "scheduled import"`, `automated` |
| A second TypeORM `DataSource` (named connection) or Prisma client on another system's database | a flow `over "shared database" automated` |
| A `*Mapper` / `*Translator` provider between the peer's DTO and a class of our own | `carries X as Y`; `ACL` when it sits in a module of its own (an anti-corruption or per-peer adapter module) |
| The peer's generated types or shared package types used in entities and services, with no mapper | `Conformist` |
| An `opossum` or `cockatiel` circuit breaker / fallback policy around the call | `criticality degraded` |
| The exchange only goes through a queue or broker transport, or an outbox table | `criticality tolerant` |

Patterns, criticality and `as` are written only when the signal is present, and an `ACL` or a criticality cue counts only in the code of the downstream system — the one that needs the other. The direction rule (Phase 2, step 22) and the rest of the evidence rules (*Level-0 inference* table) are in the skill.
