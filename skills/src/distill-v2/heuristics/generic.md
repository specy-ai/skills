# Generic Heuristics (any language/framework)

Always load this file. It provides language-agnostic patterns used as a base for all stacks.

## Naming Patterns

| Source Pattern | Inference |
|---|---|
| Class/module named `*Service`, `*Handler`, `*UseCase`, `*Interactor` | Likely contains entity operation logic |
| Class/module named `*Repository`, `*Store`, `*Dao` | The generic type it manages is likely an `entity` (no repository construct in v2 — use for resolution patterns) |
| Class/module named `*Saga`, `*Listener`, `*Subscriber`, `*Consumer` | Likely contains event-triggered entity operation logic |
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
| Call to a service method inside a command handler | direct service call `Service.op(args)` in operation body |
| Service result assigned to an entity field | inline as `field = Service.op(args)` inside `creates`/`sets` assignment block |

### What to model

- **Model:** business calculations (scoring, pricing, weight), business checks (eligibility, time window), external integrations with business scope (federation, notification)
- **Do not model** (use `// NOTE` instead): pure technical processing (image resize, password hash, compression), infrastructure (logging, cache, rate limiting)
- **Decision criterion:** if the result affects an entity field via `sets`/`creates` assignments or a service call appears in the operation body as a side-effect, it is a business service

### Service call syntax

Service calls appear directly in the operation body as statements:

```
StockService.restock(Order.lines)
```

When a service result feeds into an entity field, inline it as a value expression inside the assignment block:

```
creates Order {
    totalAmount = PricingCalculator.computeTotal(placeOrder.lines)
}
```

Add `:: "justification"` when the business reason for invoking the service is not obvious from context alone.

## Collection Iteration (`foreach`)

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Loop over a collection field of a resolved entity with per-item mutation | `foreach Entity.collection as alias { sets TypeName { field = ... } }` |
| Loop over a collection field with per-item event emission | `foreach Entity.collection as alias { emits EventType { field = ... } }` |
| Loop over a collection field with per-item service or entity call | `foreach Entity.collection as alias { ServiceName.op(alias) }` |
| Loop over a collection field with per-item resolution | `foreach Entity.collection as alias { resolves TypeName from alias.fieldId }` |

### Rules

- The collection must be a `list<T>` field in the structural model.
- The alias scopes dot-paths inside the body — `alias.field` navigates the item, not the collection.
- The `foreach` body allows: `resolves`, `sets`, `emits`, entity calls (`TypeName.op(args)`), service calls (`Service.op(args)`), and `policy` calls. It does **not** allow `fails` — replace any per-item guard with a named `policy` call.
- If the loop body contains no verifiable mutation, emission, or call, omit the `foreach` and use `// NOTE:` to describe the iteration effect.
- **Decision criterion:** if each iteration produces a verifiable mutation (`sets`), emission (`emits`), or call, use `foreach`. If the iteration effect is only describable as narrative, use `// NOTE:` or `// UNCLEAR:`.

### Example

```
foreach Order.lines as line {
    resolves Product from line.productId
    Product.increase(line.quantity)
}
```

## Cross-Aggregate Mutation

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Mutation on an entity not resolved as the primary aggregate | `sets OtherEntity { field = value }` (cross-aggregate `sets`) |
| Mutation via dot-path navigation through relationships | `sets Entity { field = value }` after resolving the target entity |
| Mutation inside a loop on a related entity's field | `foreach ... as alias { sets TypeName { field = value } }` |

### Rules

- The target entity must be reachable from a `resolves` or `creates` clause earlier in the same operation — either directly or via relationship navigation.
- Use `sets TypeName { field = value }` blocks; there is no dot-path field targeting syntax (`sets Entity.field to value` does not exist in v2). If you need to update a nested field, resolve the intermediate entity first.
- Add `:: "justification"` when the business reason for the cross-aggregate mutation is not obvious from the construct alone.
- **Decision criterion:** if the code modifies a field on an entity other than the primary aggregate, it is a cross-aggregate mutation. If verifiable (the assignment is in the code), use `sets`. If not verifiable, use `// NOTE:` or `// UNCLEAR:`.

## Service Calls for Side-Effects

### Identification

| Source Pattern | Specy Construct |
|---|---|
| Call to `*NotificationService`, `*EmailService`, `*SmsService`, `*MessagingService`, `*PushService` | `NotificationService.op(args)` service call in operation body |
| Event listener whose only effect is sending a message (no entity mutation) | event-triggered operation body with `ServiceName.op(args)` |
| Call to `send*`, `notify*`, `publish*` on a non-domain service inside a handler | service call statement in operation body |
| Webhook dispatch, HTTP callback to an external system | service call statement, `// NOTE: external HTTP callback` if not in domain scope |

### Rules

- Model the notification/messaging capability as a `service` block with typed operation parameters.
- Call the service directly inside the operation body: `NotificationService.notifyCustomer(id, "message")`.
- The argument string literal must describe the notification in business language ("Your order has been confirmed"), not technical language ("Send email via SES").
- Use `:: "justification"` when the side-effect is a contractual or regulatory obligation.
- **Do not model** as service calls: internal logging, metrics emission, cache invalidation — these are infrastructure (`// NOTE`).
- **Decision criterion:** if a non-technical stakeholder would say "the customer must be notified when X happens", model it as a service call to a notification service.

### Example

```
service NotificationService {
    operations {
        notifyCustomer(customerId: uuid, message: string) :: "Send a notification to a customer" {
        }
    }
}

// Inside an entity operation:
"Notify customer when order is confirmed" when OrderConfirmed then NotifyOrderConfirmation {
    NotificationService.notifyCustomer(Order.customer.id, "Your order has been confirmed")
}
```

## Inter-Context Communication

### Identification

| Source Pattern | Specy Construct |
|---|---|
| REST/gRPC call to another bounded context's service | `Context.CommandName(namedArgs) :: "justification"` |
| Message published to a topic/queue named after another domain (e.g. `shipping.prepare`) | `Shipping.PrepareShipment(orderId = Order.id) :: "justification"` |
| Saga step invoking another context's command handler | `Context.CommandName(namedArgs)` |
| Choreography: event emission consumed by another context that triggers a command | `Context.CommandName(namedArgs)` |

### Rules

- The call form is `ContextName.CommandName(namedArgs)` — the context name matches a `module` declaration in another `.domain.specy` file; the command name matches a `command` defined in that file.
- Named arguments (`field = value`) are required when the target command has more than one field, to make the mapping explicit.
- Add `:: "justification"` when the business reason for the cross-context call is not obvious.
- If the target module's `.domain.specy` is not yet extracted, use `// NOTE: cross-context call — target module not yet extracted`.
- **Do not use** for intra-context event emission — use `emits EventType { ... }` instead.
- **Decision criterion:** if the code triggers behaviour in a *different* bounded context (different aggregate root, different deployment unit, different team), it is a cross-context call.

### Example

```
Shipping.PrepareShipment(orderId = Order.id) :: "Launch shipping process"
```

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
| `assertThrows` / `expect(...).rejects.toThrow` / `(is (thrown? ...))` | Named `policy` with rejection condition |
| `assertEquals(value, entity.getField())` / `expect(result.field).toBe(value)` | `sets Entity { field = value }` — confirms mutation target and value |
| `verify(publisher).publishEvent(any(Event.class))` / `expect(emitter.emit).toHaveBeenCalledWith(...)` | `emits EventType { field = value }` — confirms event emission |
| `verify(notificationService).send(...)` / `expect(notifService.send).toHaveBeenCalled()` | `NotificationService.op(args)` service call — confirms side-effect |
| `when(service.compute(...)).thenReturn(...)` / `jest.spyOn(service, 'compute')` | `Service.op(args)` direct call — confirms delegation |
| `when(repository.findById(id)).willReturn(entity)` / `mockResolvedValue(entity)` | `resolves Entity from dotPath` — confirms resolution pattern |
| Test name: `should_X_when_Y` | Candidate operation label — often more expressive than method names |

### Branch decomposition

When **2+ tests** target the **same handler** with **different preconditions** and **different assertions**, this signals branching. Each test case represents a distinct business behaviour.

**Rule:** decompose into separate entity operations with complementary guards.

Example signal:
- `should_allow_retry_when_retryCount_below_3` → operation "Allow payment retry" with `policy retryCountBelowThreshold(Payment)`
- `should_mark_permanent_failure_after_3_retries` → operation "Mark payment as permanently failed" with `policy retryLimitReached(Payment)`

**Decision criterion:** if the tests assert different mutations (`sets`) or different side-effects (`emits`, service calls) depending on preconditions, decompose into separate operations. If the tests only vary in error messages for the same outcome, keep as a single operation with multiple `policy` calls.
