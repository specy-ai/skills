# TypeScript / NestJS — domain → code heuristics

Realizes the stack-agnostic contract for TypeScript + NestJS. Keep `domain/` free of `@nestjs/*`
imports; push Nest decorators to `application/` and `infrastructure/`.

## Structure

| Domain building block | TypeScript / NestJS code |
|---|---|
| Value type | A `class` with a `private constructor` + static `create(...)` factory that validates invariants and throws `DomainError`; expose `readonly` fields and an `equals(other)`. Or a branded type for simple wrappers. |
| Enum | A TypeScript `enum` or `as const` union. Value-backed enum → a `const` map of value objects keyed by code. |
| Identity | A branded type or small value class: `class OrderId { private constructor(readonly value: string){} static of(v: string){...} }` — not a bare `string`. |
| Entity | A `class` with a `readonly id`, `private` mutable fields, **no public setters** — state changes via methods only. Identity equality via `id`. |
| Aggregate root | The entity class; contained entities are private fields reached through the root. Only the root gets a repository. |
| Field `required`/`min`/`max`/`pattern`/`immutable` | validate in the value/entity factory; `immutable` → `readonly`. `unique` → enforced in the repository adapter. |
| Command | `class PlaceOrder { constructor(readonly correlationId: CommandId, ...) {} }` + a handler. |
| Query | `class GetOrder { constructor(readonly id: OrderId) {} }` + a read handler returning the declared type. |
| Event | `class OrderPlaced { constructor(readonly orderId: OrderId, ...) {} }` published via an `EventPublisher` port (or `@nestjs/cqrs` `EventBus`). `error`/`temporal` classifiers map to failure events / scheduled emitters. |
| Repository (derived) | Port `interface OrderRepository { store(o: Order): Promise<void>; getById(id: OrderId): Promise<Order \| null>; remove(id: OrderId): Promise<void>; search(...): Promise<Order[]> }` + `findByX` from queries. Adapter in `infrastructure/` (TypeORM/Prisma) bound via a Nest provider token. |
| Domain service | Plain `class` with pure methods (no `@Injectable`); provided via a factory if injected. |
| Application service | `@Injectable()` orchestrator: loads aggregate, calls operation, persists, publishes events. No business rules. |
| Infrastructure service | Port interface in `domain/`; `@Injectable()` adapter in `infrastructure/` bound by token (ACL). |

## Flow

| Domain building block | TypeScript / NestJS code |
|---|---|
| Operation `"place order" on PlaceOrder` | a method on the aggregate returning the next state; a `@CommandHandler(PlaceOrder)` (`@nestjs/cqrs`) or an application-service method loads/creates the aggregate, calls it, persists, publishes. |
| `accepts a : A` | typed method parameters. |
| `precondition "x" { cond } violation "msg"` | `if (!(cond)) throw new DomainError('msg');` at method top. |
| `creates Entity { f = v }` | `Entity.create({...})` factory. |
| `sets Entity { f = v }` | a private mutation method. |
| `emits Event { ... }` | `this.publisher.publish(new Event(...))` (or collect and publish after persist). |
| `foreach xs as x { ... }` | `for (const x of xs) { ... }`. |
| Invariant (`reject`/`compensation`/`alert`) | guard throwing before commit / issue corrective command / log via a notification port. |
| Reaction `reaction "r" { triggered-by E, effects C }` | an `@EventsHandler(E)` (cqrs) or `@OnEvent('E')` listener that (checks guard, then) dispatches command `C` via the `CommandBus`. |
| State machine | a `status` field + transitions enforced in operations; state invariants checked while in that state. |
| Agreement / reconciliation | a saga (`@Saga` in cqrs, or a process-manager service) reacting to participant events, checking the predicate, issuing compensating commands with retry/escalation. |

## Conventions
- Folders: `<context>/{domain,application,infrastructure}/<module>`.
- `satisfies [REQ-...]` → `/** satisfies: REQ-ORD-001 */` on the class/method.
- Domain layer imports only TS std + own types; no `@nestjs/*`.
- Prefer constructor injection with interface tokens (`@Inject(ORDER_REPOSITORY)`).
