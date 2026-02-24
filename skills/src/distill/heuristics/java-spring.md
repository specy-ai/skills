# Java / Spring Boot Heuristics

## Struct

| Source Pattern | Specy Type |
|---|---|
| `@Entity` class | `entity` |
| `@Embeddable` class | `value` |
| `enum` declaration | `enum` |
| Class name ending in `Command`, `*Cmd` | `command` |
| Class name ending in `Event`, `*Evt` | `event` |
| `@Id` field | add `unique immutable` |
| `@GeneratedValue` + UUID type | field type `uuid` |

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
| `@Service` / `@CommandHandler` method | `interaction` block |
| `@EventListener` / `@TransactionalEventListener` method | event-triggered `interaction` block |
| `repository.findById(...)` / `repository.findBy*(...)` | `resolves Entity from dotPath` |
| `new Entity(...)` / `repository.save(newEntity)` | `creates Entity` |
| `if (condition) throw new ...Exception(msg)` | `fails "msg" when { condition }` |
| `entity.setField(value)` / `entity.field = value` | `sets Entity.field to value` |
| `publisher.publishEvent(new Event(...))` / `eventBus.publish(...)` | `emits Event` |
| `for (Item item : entity.getItems())` / `entity.getItems().forEach(item -> ...)` | `foreach Entity.items as item { ... }` |
| `entity.getItems().stream().forEach(...)` / `.map(...)` with side effects | `foreach Entity.items as item { ... }` |
| Inside loop: `item.getRelated().setField(value)` | `sets item.related.field to value` (cross-aggregate) |
| `otherEntity.setField(value)` where otherEntity ≠ primary aggregate | `sets OtherEntity.field to value` (cross-aggregate, add `::`) |

## Test Assertions (JUnit / Mockito)

| Test Pattern | Evidence for |
|---|---|
| `assertThrows(FooException.class, () -> service.handle(...))` | `fails` — exception class + message confirm guard |
| `assertEquals(Status.FAILED, payment.getStatus())` | `sets Payment.status to failed` |
| `verify(publisher).publishEvent(any(OrderPlaced.class))` | `emits OrderPlaced` |
| `verify(publisher, never()).publishEvent(any(OrderPlaced.class))` | Confirms event is NOT emitted on this path |
| `verify(notificationService).send(any())` | `triggers notification` |
| `when(repository.findById(id)).thenReturn(entity)` | `resolves Entity from Command.field` |
| `when(service.compute(...)).thenReturn(result)` | `delegates Service.operation` |
| `@Test` method named `should_*_when_*` (2+ on same handler with different preconditions) | Branch decomposition signal |
