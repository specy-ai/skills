# Generic Heuristics (any language/framework)

Always load this file. It provides language-agnostic patterns used as a base for all stacks.

## Naming Patterns

| Source Pattern | Inference |
|---|---|
| Class/module named `*Service`, `*Handler`, `*UseCase`, `*Interactor` | Likely contains `interaction` logic |
| Class/module named `*Repository`, `*Store`, `*Dao` | The generic type it manages is likely an `entity` |
| Class/module named `*Saga`, `*Listener`, `*Subscriber`, `*Consumer` | Likely contains event-triggered `interaction` logic |
| Class/module named `*Policy`, `*Validator`, `*Guard`, `*Rule`, `*Specification` | Likely contains `policy` or `invariant` logic |
| Class/module named `*Event`, `*Message` with past-tense name | Likely an `event` |
| Class/module named `*Command`, `*Request` with imperative name | Likely a `command` |
| CRUD-only code with no explicit events | Run deliberation panel — PO decides if events matter; use `// NOTE` to signal the gap |

## Type Mapping

| Source Type | Specy Primitive |
|---|---|
| `String`, `string`, `str`, `TEXT`, `VARCHAR` | `string` |
| `int`, `Integer`, `Long`, `long`, `Int`, `Short` | `int` |
| `BigDecimal`, `double`, `Double`, `float`, `Float`, `Decimal`, `Number` | `decimal` |
| `boolean`, `Boolean`, `bool`, `Bool` | `boolean` |
| `LocalDate`, `Date`, `date`, `NaiveDate` | `date` |
| `LocalDateTime`, `DateTime`, `Instant`, `Timestamp`, `ZonedDateTime`, `OffsetDateTime` | `datetime` |
| `UUID`, `uuid`, `Uuid`, `GUID` | `uuid` |
| `List<T>`, `ArrayList<T>`, `T[]`, `Array<T>`, `Vec<T>`, `vector`, `[]T` | `list<T>` |
| `Set<T>`, `HashSet<T>`, `TreeSet<T>`, `LinkedHashSet<T>` | `set<T>` |

When a source type does not map to a primitive, check if it corresponds to another domain type (entity, value, enum). If it does, use the Specy typeName. If it is a technical type with no domain meaning (e.g. `HttpRequest`, `Logger`), omit it.

## Services

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Interface or class without state, with business calculation method(s) | `service` block |
| Constructor injection of a non-repository interface | potential `service` |
| Call to a service method inside a command handler | `delegates` clause |
| Service result assigned to an entity field | `sets Entity.field to Service.operation` |

### What to model

- **Model:** business calculations (scoring, pricing, weight), business checks (eligibility, time window), external integrations with business scope (federation, notification)
- **Do not model** (use `// NOTE` instead): pure technical processing (image resize, password hash, compression), infrastructure (logging, cache, rate limiting)
- **Decision criterion:** if the result affects an entity field via `sets` or conditions the flow via `fails`, it is a business service

## Collection Iteration (`foreach`)

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Loop over a collection field of a resolved entity with per-item mutation | `foreach Entity.collection as alias { sets alias.field to ... }` |
| Loop over a collection field with per-item event emission | `foreach Entity.collection as alias { emits Event }` |
| Loop over a collection field with per-item validation/guard | `foreach Entity.collection as alias { fails "msg" when { ... } }` |

### Rules

- The collection must be a `list<T>` field in the structural model.
- The alias scopes dot-paths inside the body — `alias.field` navigates the item, not the collection.
- If the loop body contains no verifiable mutation or emission, omit the `foreach` and use `// NOTE:` to describe the iteration effect.
- **Decision criterion:** if each iteration produces a verifiable mutation (`sets`) or emission (`emits`), use `foreach`. If the iteration effect is only describable as narrative, use `// NOTE:` or `// UNCLEAR:`.

## Cross-Aggregate Mutation

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Mutation on an entity not resolved as the primary aggregate | `sets OtherEntity.field to value` (cross-aggregate `sets`) |
| Mutation via dot-path navigation through relationships | `sets Entity.relation.field to value` |
| Mutation inside a loop on a related entity's field | `foreach ... as alias { sets alias.related.field to value }` |

### Rules

- The target dot-path must be reachable from a `resolves` or `creates` entity — either directly or via relationship navigation.
- Add `:: "justification"` when the business reason for the cross-aggregate mutation is not obvious from the construct alone.
- **Decision criterion:** if the code modifies a field on an entity other than the primary aggregate, it is a cross-aggregate mutation. If verifiable (the assignment is in the code), use `sets`. If not verifiable, use `// NOTE:` or `// UNCLEAR:`.

## Notifications and Side-Effects (`triggers notification`)

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Call to `*NotificationService`, `*EmailService`, `*SmsService`, `*MessagingService`, `*PushService` | `triggers notification "description"` |
| Event listener whose only effect is sending a message (no entity mutation) | `triggers notification "description" on Event` |
| Call to `send*`, `notify*`, `publish*` on a non-domain service inside an event handler | `triggers notification "description"` |
| Webhook dispatch, HTTP callback to an external system | `triggers notification "description"` |

### Rules

- The string literal must describe the notification in business language ("Notify customer that order is confirmed"), not technical language ("Send email via SES").
- Use `on EventType` when the notification is directly caused by a specific event and the interaction reacts to that event.
- Use `:: "justification"` when the notification is a contractual or regulatory obligation.
- **Do not use** `triggers notification` for: internal logging, metrics emission, cache invalidation — these are infrastructure (`// NOTE`).
- **Decision criterion:** if a non-technical stakeholder would say "the customer must be notified when X happens", it is a `triggers notification`.

## Inter-Context Communication (`triggers Context.Command`)

### Identification

| Source Pattern | Specy Construct |
|---|---|
| REST/gRPC call to another bounded context's service | `triggers Context.Command` |
| Message published to a topic/queue named after another domain (e.g. `shipping.prepare`) | `triggers Shipping.PrepareShipment` |
| Saga step invoking another context's command handler | `triggers Context.Command` |
| Choreography: event emission consumed by another context that triggers a command | `triggers Context.Command` |

### Rules

- The dot-path must be `ContextName.CommandName` — the context name matches another `.struct` file's `domain` declaration; the command name matches a `command` defined in that `.struct`.
- Add `:: "justification"` when the business reason for the cross-context trigger is not obvious.
- If the target context's `.struct` is not available, use `// NOTE: cross-context trigger — target .struct not yet extracted`.
- **Do not use** for intra-context event emission — use `emits Event` instead.
- **Decision criterion:** if the code triggers behaviour in a *different* bounded context (different aggregate root, different deployment unit, different team), it is a `triggers Context.Command`.

## Test Correlation & Branch Decomposition

### Correlating tests to production code

| Strategy | Fiability | Method |
|---|---|---|
| Import/require | High | Test file imports the handler class → direct link |
| Naming convention | Medium | `FooServiceTest` → `FooService`, `foo.spec.ts` → `foo.service.ts` |
| Subject under test | Low | Test instantiates or calls a class → inferred link |

Use the highest-fiability strategy available. When no correlation is found, skip the test file — do not guess.

### What test assertions evidence

| Assertion pattern | Evidence for |
|---|---|
| `assertThrows` / `expect(...).rejects.toThrow` / `(is (thrown? ...))` | `fails` — confirms guard condition + message |
| `assertEquals(value, entity.getField())` / `expect(result.field).toBe(value)` | `sets Entity.field to value` — confirms mutation target and value |
| `verify(publisher).publishEvent(any(Event.class))` / `expect(emitter.emit).toHaveBeenCalledWith(...)` | `emits Event` — confirms event emission |
| `verify(notificationService).send(...)` / `expect(notifService.send).toHaveBeenCalled()` | `triggers notification` — confirms side-effect |
| `when(service.compute(...)).thenReturn(...)` / `jest.spyOn(service, 'compute')` | `delegates Service.operation` — confirms delegation |
| `when(repository.findById(id)).willReturn(entity)` / `mockResolvedValue(entity)` | `resolves Entity` — confirms resolution pattern |
| Test name: `should_X_when_Y` | Candidate interaction label — often more expressive than method names |

### Branch decomposition

When **2+ tests** target the **same handler** with **different preconditions** and **different assertions**, this signals branching. Each test case represents a distinct business behaviour.

**Rule:** decompose into separate event-triggered interactions with complementary guards.

Example signal:
- `should_allow_retry_when_retryCount_below_3` → interaction "Allow payment retry" with `fails ... when { Payment.retryCount >= 3 }`
- `should_mark_permanent_failure_after_3_retries` → interaction "Mark payment as permanently failed" with `fails ... when { Payment.retryCount < 3 }`

**Decision criterion:** if the tests assert different mutations (`sets`) or different side-effects (`emits`, `triggers notification`) depending on preconditions, decompose. If the tests only vary in error messages for the same outcome, keep as a single interaction with multiple `fails`.

## Repositories

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Interface `I*Repository` / class `*Repository` | `repository` block |
| Method `findById(id)` | `operation findById` |
| Method `findBy*(field)` | `operation findBy*` |
| Method `exists*(field)` / `existsBy*(field)` | `operation exists*` |
| Method `save(entity)` / `create(input)` | `operation save` |
| Method `delete(id)` / `remove(id)` | `operation delete` |
| `repository.findById(cmd.id)` in a handler | `resolves Entity via Repository.findById from Command.field` |
| `repository.findBy*(cmd.field)` in a handler | `resolves Entity via Repository.findBy* from Command.field` |

### Filtering

- **Model**: findById, findByField (used in `resolves`), save, delete, existsBy (used in a guard/check)
- **Do not model** (`// NOTE: query-only`): search, pagination, count for dashboards, aggregations for UI
- **Criterion**: if the operation is called in a use case that produces an `interaction`, it deserves a declaration
