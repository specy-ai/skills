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
| `@EventListener` / `@TransactionalEventListener` method | `reaction` block |
| `repository.findById(...)` / `repository.findBy*(...)` | `resolves Entity from dotPath` |
| `new Entity(...)` / `repository.save(newEntity)` | `creates Entity` |
| `if (condition) throw new ...Exception(msg)` | `fails "msg" when { condition }` |
| `entity.setField(value)` / `entity.field = value` | `sets Entity.field to value` |
| `publisher.publishEvent(new Event(...))` / `eventBus.publish(...)` | `emits Event` |
