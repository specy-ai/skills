# Generic Heuristics (any language/framework)

Always load this file. It provides language-agnostic patterns used as a base for all stacks.

## Naming Patterns

| Source Pattern | Inference |
|---|---|
| Class/module named `*Service`, `*Handler`, `*UseCase`, `*Interactor` | Likely contains `interaction` logic |
| Class/module named `*Repository`, `*Store`, `*Dao` | The generic type it manages is likely an `entity` |
| Class/module named `*Saga`, `*Listener`, `*Subscriber`, `*Consumer` | Likely contains `reaction` logic |
| Class/module named `*Policy`, `*Validator`, `*Guard`, `*Rule`, `*Specification` | Likely contains `policy` or `invariant` logic |
| Class/module named `*Event`, `*Message` with past-tense name | Likely an `event` |
| Class/module named `*Command`, `*Request` with imperative name | Likely a `command` |
| CRUD-only code with no explicit events | Add `// UNCLEAR: no event emitted — infer events or omit?` |

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
