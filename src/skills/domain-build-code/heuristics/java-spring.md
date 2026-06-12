# Java / Spring Boot — domain → code heuristics

Realizes the stack-agnostic contract for Java 21 + Spring Boot 3. Keep `domain/` framework-free; push
Spring annotations to `application/` and `infrastructure/`.

## Structure

| Domain building block | Java / Spring code |
|---|---|
| Value type | `record` (or `final` class) with a compact constructor that validates invariants; throws `IllegalArgumentException` on violation. Value equality is automatic for records. |
| Enum | `enum`. Value-backed enum → `enum` whose constants hold the value object (the `code` field). |
| Identity | A `record FooId(UUID value)` value type — never a bare `UUID`. |
| Entity | A class with a `private final FooId id;`, private mutable fields, **no public setters** — state changes only via operation methods. `equals`/`hashCode` on id only. |
| Aggregate root | The entity class; contained entities are plain fields reached via the root. Persisted/loaded as a whole. Only the root gets a repository. |
| Field `required` | non-null check in constructor (`Objects.requireNonNull`). `unique` → enforced in repository/DB (`@Column(unique=true)` on the adapter). `min/max/pattern/length` → validate in constructor. `immutable` → `final` field, no setter. date constraints → validate against `Instant.now()`/`LocalDate.now()`. |
| Command | `record PlaceOrder(CommandId correlationId, ...) {}` + a handler (see Flow). |
| Query | `record GetOrder(OrderId id) {}` + a read handler returning the declared type. |
| Event | `record OrderPlaced(OrderId orderId, ...) {}` published via a `DomainEventPublisher` port. `error` events extend a common failure type; `temporal` events are emitted by a scheduler. |
| Repository (derived) | Port interface in `domain/`: `interface OrderRepository { void store(Order o); Optional<Order> getById(OrderId id); void remove(OrderId id); List<Order> search(...); }` + `findByX` from queries. Adapter in `infrastructure/` (Spring Data JPA `@Repository` implementing the port, with a `@Entity` persistence model — keep the JPA model separate from the domain entity, or map). |
| Domain service | Plain `final class` (no `@Service`) with pure methods. Wired as a bean via `@Configuration` if needed. |
| Application service | `@Service` orchestrator: loads aggregate from repository, calls the operation, stores it, publishes events. Holds no business rules. Wrap in `@Transactional`. |
| Infrastructure service | Port interface in `domain/`; `@Service`/`@Component` adapter in `infrastructure/` (the ACL). |

## Flow

| Domain building block | Java / Spring code |
|---|---|
| Operation `"place order" on PlaceOrder` | A method on the aggregate: `Order placeOrder(...) { ...; return this; }`. The command handler (`@Component class PlaceOrderHandler`) loads/creates the aggregate, calls it, persists, and publishes emitted events. |
| `accepts a : A, b : B` | method parameters (typed). |
| `precondition "x" { cond } violation "msg"` | guard at method top: `if (!(cond)) throw new DomainException("msg");` |
| `creates Entity { f = v }` | construct a new aggregate via its constructor/factory. |
| `sets Entity { f = v }` | private mutation method on the entity. |
| `emits Event { ... }` | `events.add(new Event(...))` then `publisher.publish(event)` in the handler after persist. |
| `foreach xs as x { ... }` | `for (var x : xs) { ... }`. |
| Invariant (`reject`) | check inside the operation before returning: throw if violated. `compensation` → publish a corrective command; `alert` → log/notify via an infrastructure port. |
| Reaction `reaction "r" { triggered-by E, effects C }` | `@Component` with `@EventListener`/`@TransactionalEventListener` method on `E` that (checks the guard, then) sends command `C` to its handler. |
| State machine | a `Status status;` field + transitions enforced in operations: `if (status != ACTIVE) throw ...;`. State invariants checked while in that state. |
| Agreement / reconciliation | a saga `@Component` listening to participant events, evaluating the predicate, and issuing compensating commands with retry/escalation. |

## Conventions
- Package: `<root>.<context>.<domain|application|infrastructure>.<module>`.
- `satisfies [REQ-...]` → `/** satisfies: REQ-ORD-001 */` Javadoc on the class/method.
- Prefer constructor injection; no field injection.
- Domain layer imports only `java.*` + own types (no `org.springframework.*`).
