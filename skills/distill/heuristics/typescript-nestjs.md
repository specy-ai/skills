# TypeScript / NestJS Heuristics

## Struct

| Source Pattern | Specy Type |
|---|---|
| TypeORM `@Entity()` class | `entity` |
| Class with only readonly fields, no id | `value` |
| TypeScript `enum` / `const enum` / union literal types | `enum` |
| Class name ending in `Command`, DTO with write intent | `command` |
| Class name ending in `Event` | `event` |
| `@PrimaryGeneratedColumn("uuid")` | field type `uuid unique immutable` |

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
| `@CommandHandler(Command)` / method in `CommandHandler` | `interaction` block |
| `@OnEvent("EventName")` / `@EventPattern(...)` | event-triggered `interaction` block |
| `this.repository.findOne(...)` | `resolves Entity from dotPath` |
| `this.repository.save(new Entity(...))` | `creates Entity` |
| `throw new BadRequestException(msg)` / guard condition | `fails "msg" when { condition }` |
| `this.eventEmitter.emit(...)` / `this.eventBus.publish(...)` | `emits Event` |
| `for (const item of entity.items)` / `entity.items.forEach(item => ...)` | `foreach Entity.items as item { ... }` |
| `entity.items.map(item => ...)` with mutation side effects | `foreach Entity.items as item { ... }` |
| Inside loop: `item.related.field = value` | `sets item.related.field to value` (cross-aggregate) |
| `otherEntity.field = value` where otherEntity ≠ primary aggregate | `sets OtherEntity.field to value` (cross-aggregate, add `::`) |

## Test Assertions (Jest / Vitest)

| Test Pattern | Evidence for |
|---|---|
| `expect(service.handle(...)).rejects.toThrow('msg')` | `fails "msg"` — confirms guard message |
| `expect(result.status).toBe('failed')` | `sets Entity.status to failed` |
| `expect(eventEmitter.emit).toHaveBeenCalledWith('EventName', ...)` | `emits Event` |
| `expect(eventEmitter.emit).not.toHaveBeenCalled()` | Confirms event is NOT emitted on this path |
| `expect(notificationService.send).toHaveBeenCalled()` | `triggers notification` |
| `jest.spyOn(repository, 'findOne').mockResolvedValue(entity)` | `resolves Entity` |
| `jest.spyOn(service, 'compute').mockResolvedValue(result)` | `delegates Service.operation` |
| `it('should ... when ...', ...)` / `describe` (2+ on same handler with different preconditions) | Branch decomposition signal |
