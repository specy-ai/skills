# TypeScript / NestJS Heuristics

## Struct

| Source Pattern | Specy Type |
|---|---|
| TypeORM `@Entity()` class | `entity` |
| Class with only readonly fields, no id | `value` |
| TypeScript `enum` / `const enum` / union literal types | `enum` |
| Class name ending in `Command`, DTO with write intent | `command` |
| Class name ending in `Event` | `event` |
| `@PrimaryGeneratedColumn("uuid")` | `identity` field with type `uuid` (e.g. `identity id : uuid`) |
| `@AggregateRoot` base class, or entity that owns other entities via `{ cascade: true, eager: true }` relations | `aggregate` root marker |

## Constraints

| Decorator (class-validator) | Specy Constraint |
|---|---|
| `@IsNotEmpty()`, `@IsDefined()` | `required` |
| `@IsOptional()` | `optional` |
| `@IsString()`, `@IsUUID()`, `@IsEmail()` | type hint (map to correct primitive) |
| `@MinLength(n)` | `minLength(n)` |
| `@MaxLength(n)` | `maxLength(n)` |
| `@Min(n)` | `min(n)` |
| `@Max(n)` | `max(n)` |
| `@Matches(regex)` | `pattern("regex")` |

## Flow

| Source Pattern | Specy Construct |
|---|---|
| Injectable class with stateless business logic (calculations, cross-entity rules, no DB/IO) | `domain service` |
| Injectable class / controller orchestrating use cases (calls repositories + domain services) | `application service` |
| Injectable class adapting to external systems (payment gateways, email, notification services) | `infrastructure service` |
| `@CommandHandler(Command)` / method in `CommandHandler` | entity/aggregate `operation` (command-triggered) |
| `this.repository.findOne(...)` | `resolves Entity from dotPath` |
| `this.repository.save(new Entity(...))` | `creates Entity` |
| `throw new BadRequestException(msg)` / guard condition | `precondition name :: "description" { condition } rejects "message"` |
| `this.eventEmitter.emit(...)` / `this.eventBus.publish(...)` | `emits Event` |
| `@OnEvent("EventName")` / `@EventPattern(...)` handler that issues a command in response to an event | `policy Name { trigger EventName, guard { expression }, effect CommandName }` |
| `for (const item of entity.items)` / `entity.items.forEach(item => ...)` | `foreach Entity.items as item { ... }` |
| `entity.items.map(item => ...)` with mutation side effects | `foreach Entity.items as item { ... }` |
| Inside loop: `item.related.field = value` | `sets RelatedType { field = value }` (cross-aggregate, inside `foreach`) |
| `otherEntity.field = value` where otherEntity ≠ primary aggregate | `sets OtherEntity { field = value }` (cross-aggregate, add `::`) |

## Test Assertions (Jest / Vitest)

| Test Pattern | Evidence for |
|---|---|
| `expect(service.handle(...)).rejects.toThrow('msg')` | `precondition` with `rejects` — confirms rejection message |
| `expect(result.status).toBe('failed')` | `sets Entity { status = failed }` |
| `expect(eventEmitter.emit).toHaveBeenCalledWith('EventName', ...)` | `emits Event` |
| `expect(eventEmitter.emit).not.toHaveBeenCalled()` | Confirms event is NOT emitted on this path |
| `expect(notificationService.send).toHaveBeenCalled()` | `NotificationService.op(args)` service call |
| `jest.spyOn(repository, 'findOne').mockResolvedValue(entity)` | `resolves Entity` |
| `jest.spyOn(service, 'compute').mockResolvedValue(result)` | `Service.op(args)` direct service call |
| `it('should ... when ...', ...)` / `describe` (2+ on same handler with different preconditions) | Branch decomposition signal |
