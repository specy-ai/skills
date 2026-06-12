# Java / Spring Boot Heuristics

## Struct

| Source Pattern | Specy Type |
|---|---|
| `@Entity` class | `entity` |
| `@Embeddable` class | `value` |
| `enum` declaration | `enum` |
| Class name ending in `Command`, `*Cmd` | `command` |
| Class name ending in `Event`, `*Evt` | `event` |
| `@Id` field | `identity` field declaration (e.g. `identity id : uuid`) |
| `@GeneratedValue` + UUID type | field type `uuid` |
| `@Aggregate` / `@AggregateRoot` annotation, or class that owns other entities via `@OneToMany(cascade = ALL, orphanRemoval = true)` composition | `aggregate` root marker |

## Constraints

| Java Annotation | Specy Constraint |
|---|---|
| `@NotNull`, `@NotBlank`, `@NotEmpty` | `required` |
| `@Column(nullable = false)` | `required` |
| `@Column(unique = true)` | `unique` |
| `@Size(min = n, max = m)` | `minLength(n) maxLength(m)` |
| `@Min(n)` | `min(n)` |
| `@Max(n)` | `max(n)` |
| `@Pattern(regexp = "...")` | `pattern("...")` |
| `@Past` | `past` |
| `@Future` | `future` |
| `@PastOrPresent` | `pastOrPresent` |
| `@FutureOrPresent` | `futureOrPresent` |
| `@Column(updatable = false)` | `immutable` |
| `final` field (on entity) | `immutable` |

## Flow

| Source Pattern | Specy Construct |
|---|---|
| `@Service` class with stateless business logic (calculations, cross-entity rules, no DB/IO) | `domain service` |
| `@Service` / `@RestController` class orchestrating use cases (calls repositories + domain services) | `application service` |
| `@Service` / `@Component` class adapting to external systems (payment gateways, email, notifications) | `infrastructure service` |
| `@Service` / `@CommandHandler` method | entity/aggregate `operation` (command-triggered) |
| `repository.findById(...)` / `repository.findBy*(...)` | `resolves Entity from dotPath` |
| `new Entity(...)` / `repository.save(newEntity)` | `creates Entity` |
| `if (condition) throw new ...Exception(msg)` | `precondition name :: "description" { condition } rejects "message"` |
| `entity.setField(value)` / `entity.field = value` | `sets Entity { field = value }` |
| `publisher.publishEvent(new Event(...))` / `eventBus.publish(...)` | `emits Event` |
| `@EventListener` / `@TransactionalEventListener` method that issues a command in response to an event | `reaction Name { trigger EventName, guard { expression }, effect CommandName }` |
| `for (Item item : entity.getItems())` / `entity.getItems().forEach(item -> ...)` | `foreach Entity.items as item { ... }` |
| `entity.getItems().stream().forEach(...)` / `.map(...)` with side effects | `foreach Entity.items as item { ... }` |
| Inside loop: `item.getRelated().setField(value)` | `sets RelatedType { field = value }` (cross-aggregate, inside `foreach`) |
| `otherEntity.setField(value)` where otherEntity ≠ primary aggregate | `sets OtherEntity { field = value }` (cross-aggregate, add `::`) |

## Test Assertions (JUnit / Mockito)

| Test Pattern | Evidence for |
|---|---|
| `assertThrows(FooException.class, () -> service.handle(...))` | `precondition` with `rejects` — exception class + message confirm rejection |
| `assertEquals(Status.FAILED, payment.getStatus())` | `sets Payment.status to failed` |
| `verify(publisher).publishEvent(any(OrderPlaced.class))` | `emits OrderPlaced` |
| `verify(publisher, never()).publishEvent(any(OrderPlaced.class))` | Confirms event is NOT emitted on this path |
| `verify(notificationService).send(any())` | `NotificationService.op(args)` service call |
| `when(repository.findById(id)).thenReturn(entity)` | `resolves Entity from Command.field` |
| `when(service.compute(...)).thenReturn(result)` | `Service.op(args)` direct service call |
| `@Test` method named `should_*_when_*` (2+ on same handler with different preconditions) | Branch decomposition signal |
