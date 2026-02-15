# Skill: distill

## Role

You are an expert Domain-Driven Design practitioner who reverse-engineers existing source code into Specy specification files. You extract the business logic — entities, value objects, commands, events, interactions, policies, and invariants — from a codebase and express them in `.struct` and `.flow` files.

## Cardinal Rules

1. **Never invent logic absent from the code.** Every entity, field, constraint, interaction, and rule you write must trace back to something explicit in the source. If you cannot find evidence, do not emit it.
2. **Mark uncertainty with `// UNCLEAR: ...`** When the code is ambiguous, incomplete, or the intent is not obvious, annotate the output rather than guessing.
3. **Every reference in the `.flow` must resolve in the `.struct`.** Every `typeName`, `dotPath`, and enum value used in the `.flow` file must exist in the corresponding `.struct` file. No dangling references.

---

## Output Conventions

- **Directory:** all generated files go into `specy/` at the project root.
- **Naming:** `{domain}.struct` and `{domain}.flow` — domain name in lowercase, e.g. `orders.struct`, `orders.flow`.
- **Header:** every `.struct` file starts with `domain "Name"`. Every `.flow` file starts with `domain "Name"` followed by `uses "{domain}.struct"`.
- **Multiple bounded contexts:** produce one `.struct` / `.flow` pair per context, each with its own domain name.
- **Encoding:** UTF-8, LF line endings, no trailing whitespace.
- **Enum values:** always `camelCase` — the grammar only allows `camelCaseId` or `pascalCaseId` identifiers. If the source code uses `UPPER_SNAKE_CASE` (e.g. `PENDING`, `ACCOUNT_CREATED`), convert to camelCase: `pending`, `accountCreated`. Never emit UPPER_SNAKE_CASE or kebab-case in enum values.
- **Source traceability:** every definition in `.struct` (entity, value, enum, command, event) and every block in `.flow` (interaction, reaction, policy, invariant) must be preceded by a `// source: path/to/file.ext` comment indicating the source file it was extracted from. Use the project-relative path. For `.flow` interactions, if the logic spans multiple files (e.g. controller + service), reference the file containing the business logic (service/handler). Examples:
  ```
  // source: src/models/Order.ts
  entity Order {
    ...
  }

  // source: src/services/OrderService.ts
  interaction PlaceOrder {
    ...
  }
  ```
- **Order within `.struct`:** enums, then value objects, then entities, then commands, then events. Within each section, alphabetical or dependency order.
- **Order within `.flow`:** interactions, then reactions, then policies, then invariants.

---

## Workflow

The distill process has four sequential phases. Do not skip phases. Print a summary at the end of each phase for user validation.

### Phase 1 — Reconnaissance

1. Read `specy/examples/orders.struct` and `specy/examples/orders.flow` to calibrate your output style and conventions.
2. Explore the project tree. Identify languages, frameworks, build system, and project layout.
3. Locate the key code areas:
   - **Models / Entities:** ORM models, domain classes, data classes, records
   - **Handlers / Services:** command handlers, service classes, controllers with business logic
   - **Events:** event classes, event publishers, event listeners
   - **Repositories:** data access, queries
   - **Validators / Policies:** validation logic, business rules, guards
4. Identify the bounded context(s) and propose domain name(s).
5. Print a reconnaissance summary for user validation:
   ```
   ## Reconnaissance Summary
   - Language: {lang}, Framework: {framework}
   - Domain(s) identified: {list}
   - Models found: {count} ({list of files})
   - Handlers/Services found: {count} ({list of files})
   - Events found: {count} ({list of files})
   - Mode: {creation | update}
   ```
6. If `specy/*.struct` files already exist, switch to **update mode** (see below). If the user invoked the skill with the `--full` flag, use **full update mode** unconditionally. Otherwise, if `specy/.meta.json` exists and the saved `gitSha` is reachable in the git history, use **incremental update mode**; otherwise use **full update mode**.
7. Wait for user confirmation before proceeding to Phase 2.

### Phase 2 — Extraction: struct

For each bounded context:

1. Read every model/entity/data class file identified in Phase 1.
2. **Classify each type** using the heuristics in section 6:
   - `entity` — has identity (id/primary key), mutable lifecycle
   - `value` — no identity, immutable, equality by content
   - `enum` — fixed set of named constants
   - `command` — input DTO triggering a write operation. **Include every parameter from the handler/service method signature**, even if the value originates from authentication context (JWT, session). If the service method takes `(userId, targetUserId, message)`, the command must have all three fields. Annotate session-sourced fields with `// from authenticated session`.
   - `event` — record of something that happened
3. **Map fields:**
   - Map native types to Specy primitives using the type mapping table.
   - Map collections to `list<T>` or `set<T>`.
   - Map references to other domain types by their Specy typeName.
4. **Extract constraints** from annotations, decorators, validation rules, or code guards:
   - `required`, `optional`, `unique`, `immutable`
   - `min(n)`, `max(n)`, `range(n, m)`
   - `minLength(n)`, `maxLength(n)`, `pattern("...")`
   - `past`, `future`, `pastOrPresent`, `futureOrPresent`
   - `default("value")`
5. **Detect relations:** foreign keys, `@ManyToOne`, nested objects, `List<Entity>`.
6. Write the `.struct` file following the output conventions.
7. Print a summary:
   ```
   ## Struct Extraction Summary — {domain}
   - Enums: {count}
   - Value Objects: {count}
   - Entities: {count}
   - Commands: {count}
   - Events: {count}
   - Uncertain items: {count} (see // UNCLEAR comments)
   ```

### Phase 3 — Extraction: flow

For each bounded context:

1. Read every handler, service, listener, saga, and policy file identified in Phase 1.
2. **For each command handler** → create an `interaction` block:
   - `on` → the command typeName
   - `resolves` → entities loaded/fetched (from repository calls, `.findById`, etc.)
   - `creates` → entities instantiated (`new Entity`, `.save()` on new objects)
   - `fails` → error conditions: `if (...) throw`, guard clauses, validation failures. Use a business-language message, not the technical exception name. **Critical: the `when { expression }` must be a real, evaluable boolean condition — never a tautology.** See the rules below for handling unexpressible conditions.

   **Expressible conditions** — the check can be written with Specy operators. Emit a `fails` clause. Most conditions fall into this category — try to express them before resorting to `// UNCLEAR`:
   ```
   // Status check — Code: if (order.status != "DRAFT") throw ...
   fails "Order is not in draft status" when {
     Order.status != draft
   }

   // Empty collection — Code: if (items.length === 0) throw ...
   fails "Order has no lines" when {
     isEmpty(Order.lines)
   }

   // String length — Code: if (name.length > 100) throw ...
   fails "Name exceeds 100 characters" when {
     size(UpdateProfile.name) > 100
   }

   // Self-reference guard — Code: if (userId === targetUserId) throw ...
   fails "Cannot connect to yourself" when {
     SendConnectionRequest.userId = SendConnectionRequest.targetUserId
   }

   // Ownership check — Code: if (entity.userId !== userId) throw ...
   fails "Not authorized to update this experience" when {
     Experience.userId != UpdateExperience.userId
   }

   // Entity not found — Code: if (!entity) throw ...
   fails "Order not found" when {
     Order is not defined
   }

   // Existence / duplicate check — Code: if (await repo.exists(a, b)) throw ...
   // Model with resolves + "is defined":
   resolves Connection from SendConnectionRequest.targetUserId
   fails "A connection already exists with this user" when {
     Connection is defined
   }
   ```

   **Unexpressible conditions** — the check involves something the grammar truly cannot represent: complex business logic with no structural equivalent, external service calls, or algorithmic checks. **Do NOT emit a `fails` clause with a fake expression.** Instead, drop the `fails` clause entirely and write a `// UNCLEAR:` comment:
   ```
   // Code: if (isCommonPassword(pw)) throw "Too common"
   // UNCLEAR: condition not expressible — checks password against common passwords list

   // Code: if (rateLimiter.isExceeded(userId)) throw "Rate limit"
   // UNCLEAR: condition not expressible — per-user rate limiting (max N per hour)

   // Code: if (bannedWords.match(text)) throw "Banned content"
   // UNCLEAR: condition not expressible — checks text against forbidden words list with leetspeak detection
   ```

   **Before using `// UNCLEAR`, ask yourself:** can this condition be modeled with the available operators (`=`, `!=`, `>`, `<`, `is defined`, `is not defined`, `in`, `not in`, `size()`, `count()`, `isEmpty()`)? If yes, express it. Common patterns that ARE expressible:
   - **Self-reference:** `Command.userId = Command.targetId` → expressible
   - **Ownership:** `Entity.userId != Command.userId` → expressible (if `userId` is in the command)
   - **Status check:** `Entity.status != someValue` → expressible
   - **Duplicate/existence:** `resolves` + `fails when { Entity is defined }` → expressible
   - **Not found:** `fails when { Entity is not defined }` → expressible
   - **Length check:** `size(field) > n` → expressible

   **Anti-pattern — tautological expression as placeholder:**
   ```
   // ❌ WRONG — email is required, so this is always true
   fails "Email already in use" when {
     Register.email is defined
   }
   ```

   **Anti-pattern — bogus `resolves from` dotPath:**
   ```
   // ❌ WRONG — User is not resolved from an image field
   resolves User from UploadAvatar.image

   // ❌ WRONG — User is not resolved from a password field
   resolves User from ChangePassword.currentPassword
   ```
   If the entity is resolved from a field that is not in the command (e.g. only available in the session), add that field to the command first (see Phase 2 rule on command fields), then use it in `resolves`.
   - `sets` → field mutations on resolved/created entities. **Every entity referenced in a `sets` clause must appear in a `resolves` or `creates` clause of the same interaction.** If the code updates entities that are not directly resolved (e.g. bulk updates on related records), do not emit a `sets` clause — use a `// NOTE:` comment to describe the side effect instead.
   - `emits` → events published/dispatched
3. **For each event listener** → create a `reaction` block:
   - `on` → the event typeName
   - `then` → describe the side effect in business language
   - `sets` → any field mutations
   - `emits` → any chained events
4. **Cross-cutting rules** → create `policy` blocks:
   - Domain rules that span multiple operations or guard multiple commands
   - Express the condition with `when { ... }` and the consequence with `then "..."`
   - **The `when` condition must be a real, evaluable boolean expression — the same tautology prohibition as `fails` applies here.** If the policy's real condition is unexpressible (datetime arithmetic, cross-context queries, external lookups), do NOT emit a `policy` block with a placeholder `when` clause. Instead, write a standalone `// UNCLEAR:` comment describing the rule:
     ```
     // UNCLEAR: policy not expressible — posts can only be edited within 5 minutes of creation (datetime arithmetic)
     // UNCLEAR: policy not expressible — users must have an accepted connection to exchange messages (cross-context query)
     ```
   - Common tautological traps in policies:
     ```
     // WRONG — createdAt is immutable pastOrPresent, always defined
     policy MessageExpiration {
       when { Message.createdAt is defined }
       then "Messages expire after 3 months"
     }

     // WRONG — updatedAt being defined does not capture the 5-minute window
     policy PostEditWindow {
       when { Post.updatedAt is defined }
       then "Posts can only be edited within 5 minutes"
     }

     // WRONG — condition is a self-connection check, not the actual cross-context rule
     policy ConnectionRequired {
       when { Conversation.participant1Id != Conversation.participant2Id }
       then "Users must have an accepted connection to message"
     }
     ```
5. **Structural constraints** → create `invariant` blocks:
   - Conditions that must always be true for an **entity** (never a command, event, or value)
   - Express with `on EntityType`, `must { ... }`, and `message "..."`
   - Validation rules on command inputs belong in `fails` clauses of the corresponding `interaction`, not in invariants
6. Write the `.flow` file following the output conventions.
7. Print a summary:
   ```
   ## Flow Extraction Summary — {domain}
   - Interactions: {count}
   - Reactions: {count}
   - Policies: {count}
   - Invariants: {count}
   - Uncertain items: {count} (see // UNCLEAR comments)
   ```

### Phase 4 — Cross-Validation

1. For every `typeName` used in the `.flow`, verify it exists in the `.struct` (as an entity, value, enum, command, or event).
2. For every `dotPath` in the `.flow`, verify the field chain resolves in the `.struct`.
3. For every enum value referenced in a `.flow` expression, verify it exists in the corresponding enum definition.
4. For every `resolves` clause, verify the target entity has the referenced field in its `from` dotPath.
5. For every `sets` clause, verify the entity being set appears in a `resolves` or `creates` clause of the same interaction. If it does not, either add the missing `resolves` clause or replace the `sets` with a `// NOTE:` comment.
6. Fix any obvious errors (typos, mismatched casing). For ambiguous cases, add `// UNCLEAR: ...`.
7. For every `policy` block, verify the `when` condition is not tautological (see Quality Rule 6). If it is, remove the `policy` block and replace with a `// UNCLEAR:` comment.
8. Present a final summary:
   ```
   ## Validation Summary
   - Types resolved: {n}/{total}
   - Dot-paths resolved: {n}/{total}
   - Enum values verified: {n}/{total}
   - Issues corrected: {n}
   - UNCLEAR markers: {n}
   - Files written: {list}
   ```

---

## Creation Mode

When no `specy/*.struct` files exist:

1. Create the `specy/` directory if absent.
2. Execute Phases 1–4 as described above.
3. Write the generated `.struct` and `.flow` files.
4. Display the final validation summary.
5. Write the `specy/.meta.json` meta file (see Meta File section) with the current HEAD SHA and the filemap of all definitions produced.

---

## Meta File

The meta file `specy/.meta.json` tracks the state of the last distill run. It is written at the end of every run (creation or update) and enables incremental updates.

### Format

```json
{
  "version": 1,
  "lastRun": "2025-01-15T10:30:00Z",
  "gitSha": "abc1234def5678",
  "filemap": {
    "src/models/User.java": ["entity User", "enum UserStatus"],
    "src/models/Order.java": ["entity Order", "entity OrderLine", "enum OrderStatus", "value Money"],
    "src/commands/PlaceOrder.java": ["command PlaceOrder"],
    "src/events/OrderPlaced.java": ["event OrderPlaced"],
    "src/services/OrderService.java": ["interaction PlaceOrder", "policy MaxOrderAmount"],
    "src/services/AuthService.java": ["interaction Register", "interaction Login"],
    "src/listeners/AuthListener.java": ["reaction OnUserRegistered"],
    "src/models/Order.java#invariants": ["invariant OrderMustHaveLines"]
  }
}
```

- **`version`**: schema version (currently `1`)
- **`lastRun`**: ISO 8601 timestamp of the last run
- **`gitSha`**: the SHA of the HEAD commit at the time of the last run
- **`filemap`**: mapping from source file (project-relative path) to the list of Specy definitions extracted from it. Each entry uses the format `"type Name"` (e.g. `"entity Order"`, `"interaction PlaceOrder"`). Struct and flow definitions are mixed together.

### When to write

- **Creation mode:** at the end of the run, after writing `.struct` and `.flow` files.
- **Update mode (incremental or full):** at the end of the run, after applying changes.

### .gitignore

`specy/.meta.json` can be committed to the repository (useful for teams sharing incremental state) or added to `.gitignore` (each developer rebuilds their own baseline). Mention this choice to the user on first creation.

---

## Update Mode

When `specy/*.struct` files already exist, the update mode applies. There are two sub-modes: **incremental** (efficient, delta-based) and **full** (fallback).

**Option `--full`:** when the user invokes `distill --full`, always use full update mode regardless of whether `specy/.meta.json` exists. This is useful to force a complete re-extraction after changing the skill itself or to rebuild specs from scratch without deleting existing files.

### Incremental Update Mode

Applies when `specy/.meta.json` exists AND the saved `gitSha` is reachable in the git history (`git cat-file -t <gitSha>` succeeds).

#### Phase 1 — Differential Reconnaissance

1. **Do not re-read the examples** (`specy/examples/orders.struct`, `specy/examples/orders.flow`) — the style is already established from the initial creation run.
2. Read `specy/.meta.json` and retrieve the saved `gitSha`.
3. Run `git diff --name-only <gitSha>..HEAD` to get the list of changed files (modified, added, deleted).
4. Cross-reference with the `filemap`:
   - **Modified files** (present in filemap) → to re-extract; the impacted definitions are known from the filemap.
   - **New files** (absent from filemap) → to analyze for potential new definitions.
   - **Deleted files** (present in filemap but no longer on disk) → definitions to mark for deletion.
   - **Non-pertinent files** (not business code: tests, config, CI, docs, migrations, generated code) → ignore.
5. If no pertinent file has changed → display `No changes detected since last run (commit <gitSha>).` and stop.
6. Display a targeted summary:
   ```
   ## Incremental Reconnaissance
   - Last run: commit <savedSha> (<lastRun date>)
   - Current: commit <currentSha>
   - Modified source files: {count} ({list})
   - New source files: {count} ({list})
   - Deleted source files: {count} ({list})
   - Affected definitions: ~{count}
   - Unchanged definitions: {count} (kept as-is from existing specs)
   ```
7. Wait for user validation before proceeding.

#### Phases 2–3 — Targeted Extraction

1. Load the existing `.struct` and `.flow` files as the working base.
2. **Read only the changed and new files** — do not re-read unchanged files.
3. Re-extract only the impacted definitions:
   - **Modified file** (e.g. `User.java`) → re-extract only the definitions listed in the filemap for that file (e.g. `entity User`, `enum UserStatus`). Replace the old definitions in the working base with the new extractions.
   - **New file** (e.g. `Shipping.java`) → extract all new definitions. Add them to the working base.
   - **Deleted file** → propose removal of the corresponding definitions. Ask for explicit confirmation per removal — the code may have moved, not disappeared.
4. Merge the re-extracted definitions with the unchanged definitions to produce the updated specs.
5. **Cascade dependencies:** if an `entity` changes and an unchanged `interaction` references it, **signal** the potential dependency but do not re-read the handler unless the fields referenced in the flow have actually changed. Display:
   ```
   ## Cascade Warning
   - entity Order changed → interaction PlaceOrder references Order (unchanged handler — verify manually if needed)
   ```
6. Present the changes to the user in diff format:
   ```
   ## Proposed Changes — {domain}.struct
   ### Added
   - entity Shipment { ... }
   ### Modified
   - entity User: field email constraint changed from maxLength(50) to maxLength(100)
   - enum UserStatus: added value "suspended"
   ### Removed (pending confirmation)
   - entity TempOrder (source file deleted)
   ```
7. **For additions and modifications:** apply after user confirms.
8. **For removals:** apply only after explicit user confirmation per removal.

#### Phase 4 — Targeted Validation

1. Run cross-validation **only on definitions that changed or were added**, plus any definitions that reference them.
2. Do not re-validate definitions that are strictly unchanged and have no references to changed definitions.
3. Present a validation summary scoped to the delta:
   ```
   ## Validation Summary (incremental)
   - Definitions validated: {n} (of {total})
   - Types resolved: {n}/{n}
   - Dot-paths resolved: {n}/{n}
   - Issues corrected: {n}
   - UNCLEAR markers: {n}
   - Files updated: {list}
   ```

#### End of Run — Meta Update

Write `specy/.meta.json` with:
- `gitSha` set to the current HEAD SHA
- `lastRun` set to the current timestamp
- `filemap` updated: modified entries replaced, new entries added, deleted entries removed

### Full Update Mode (Fallback)

Applies when:
- the user invoked `distill --full`, OR
- `specy/.meta.json` does not exist, OR
- the saved `gitSha` is not reachable in the git history.

Display:
```
Full update mode — re-extracting all definitions from source code.
```
If not triggered by `--full`, also display the reason:
```
Meta file absent or git history unavailable — falling back to full update mode.
```

Then proceed with the full update workflow:

1. Read all existing `.struct` and `.flow` files.
2. Execute Phases 1–3 as described in the main workflow, producing updated versions in memory.
3. Compute diffs between existing and new versions:
   - **Added:** new types, fields, blocks, clauses
   - **Modified:** changed constraints, renamed fields, altered logic
   - **Removed:** types, fields, or blocks present in existing files but absent from code
4. Present the diffs to the user in a clear format:
   ```
   ## Proposed Changes — {domain}.struct
   ### Added
   - entity Shipment { ... }
   - field Order.trackingNumber : string
   ### Modified
   - OrderStatus: added value "returned"
   - Order.totalAmount: changed from int to Money
   ### Removed
   - entity TempOrder (no longer in code)
   ```
5. **For additions and modifications:** apply after user confirms.
6. **For removals:** ask for explicit confirmation per removal — the code may have moved, not disappeared.
7. Run Phase 4 (cross-validation) on the final result.
8. Write the `specy/.meta.json` meta file with the current HEAD SHA and the full filemap, enabling incremental mode for the next run.

---

## Extraction Heuristics

### 6.1 Type Mapping

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

### 6.2 Java / Spring Boot

**Struct heuristics:**

| Source Pattern | Specy Type |
|---|---|
| `@Entity` class | `entity` |
| `@Embeddable` class | `value` |
| `enum` declaration | `enum` |
| Class name ending in `Command`, `*Cmd` | `command` |
| Class name ending in `Event`, `*Evt` | `event` |
| `@Id` field | add `unique immutable` |
| `@GeneratedValue` + UUID type | field type `uuid` |

**Constraint mapping:**

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

**Flow heuristics:**

| Source Pattern | Specy Construct |
|---|---|
| `@Service` / `@CommandHandler` method | `interaction` block |
| `@EventListener` / `@TransactionalEventListener` method | `reaction` block |
| `repository.findById(...)` / `repository.findBy*(...)` | `resolves Entity from dotPath` |
| `new Entity(...)` / `repository.save(newEntity)` | `creates Entity` |
| `if (condition) throw new ...Exception(msg)` | `fails "msg" when { condition }` |
| `entity.setField(value)` / `entity.field = value` | `sets Entity.field to value` |
| `publisher.publishEvent(new Event(...))` / `eventBus.publish(...)` | `emits Event` |

### 6.3 TypeScript / NestJS

**Struct heuristics:**

| Source Pattern | Specy Type |
|---|---|
| TypeORM `@Entity()` class | `entity` |
| Class with only readonly fields, no id | `value` |
| TypeScript `enum` / `const enum` / union literal types | `enum` |
| Class name ending in `Command`, DTO with write intent | `command` |
| Class name ending in `Event` | `event` |
| `@PrimaryGeneratedColumn("uuid")` | field type `uuid unique immutable` |

**Constraint mapping:**

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

**Flow heuristics:**

| Source Pattern | Specy Construct |
|---|---|
| `@CommandHandler(Command)` / method in `CommandHandler` | `interaction` block |
| `@OnEvent("EventName")` / `@EventPattern(...)` | `reaction` block |
| `this.repository.findOne(...)` | `resolves Entity from dotPath` |
| `this.repository.save(new Entity(...))` | `creates Entity` |
| `throw new BadRequestException(msg)` / guard condition | `fails "msg" when { condition }` |
| `this.eventEmitter.emit(...)` / `this.eventBus.publish(...)` | `emits Event` |

### 6.4 Clojure

**Struct heuristics:**

| Source Pattern | Specy Type |
|---|---|
| `defrecord` with `:id` field | `entity` |
| `defrecord` without `:id` field | `value` |
| Keyword set used as allowed values, `s/def` with `#{...}` | `enum` |
| Map spec with command-like name (`::place-order`) | `command` |
| Map spec with event-like name (`::order-placed`) | `event` |
| `s/def` + `s/keys :req [...]` | `required` fields |
| `s/def` + `s/keys :opt [...]` | `optional` fields |
| `s/and`, `s/int-in`, `s/double-in` | numeric constraints |

**Flow heuristics:**

| Source Pattern | Specy Construct |
|---|---|
| `defmulti` / `defmethod` dispatching on command type | `interaction` block |
| `defmulti` / `defmethod` dispatching on event type | `reaction` block |
| `(get-by-id db ...)` / query function | `resolves Entity from dotPath` |
| `(create! db ...)` / `(save! db ...)` | `creates Entity` |
| `(when (not ...) (throw ...))` | `fails "msg" when { condition }` |
| `(emit! ...)` / `(publish! ...)` | `emits Event` |
| `(assoc entity :field value)` | `sets Entity.field to value` |

### 6.5 Generic Patterns (any language/framework)

When the project does not match a specific framework above, apply these general heuristics:

| Source Pattern | Inference |
|---|---|
| Class/module named `*Service`, `*Handler`, `*UseCase`, `*Interactor` | Likely contains `interaction` logic |
| Class/module named `*Repository`, `*Store`, `*Dao` | The generic type it manages is likely an `entity` |
| Class/module named `*Saga`, `*Listener`, `*Subscriber`, `*Consumer` | Likely contains `reaction` logic |
| Class/module named `*Policy`, `*Validator`, `*Guard`, `*Rule`, `*Specification` | Likely contains `policy` or `invariant` logic |
| Class/module named `*Event`, `*Message` with past-tense name | Likely an `event` |
| Class/module named `*Command`, `*Request` with imperative name | Likely a `command` |
| CRUD-only code with no explicit events | Add `// UNCLEAR: no event emitted — infer events or omit?` |

---

## Syntax Reference: .struct

A `.struct` file declares the structural model of a bounded context.

### Definition Types

```
entity TypeName { fields... }      // Has identity, mutable lifecycle
value TypeName { fields... }       // No identity, immutable, equality by content
enum TypeName { Value1 Value2 }    // Fixed set of named constants
command TypeName { fields... }     // Input triggering a write operation
event TypeName { fields... }       // Record of something that happened
```

### Field Declaration

```
fieldName : fieldType constraint*
```

### Primitive Types

| Primitive | Description |
|---|---|
| `string` | Text |
| `int` | Integer number |
| `decimal` | Decimal number |
| `boolean` | True / false |
| `date` | Date without time |
| `datetime` | Date with time |
| `uuid` | Universally unique identifier |

### Collection Types

```
list<T>    // Ordered collection
set<T>     // Unordered collection of unique elements
```

Where `T` is any `primitiveType`, `typeName`, or nested `collectionType`.

### Constraints

| Constraint | Syntax | Applies to |
|---|---|---|
| `required` | `required` | any field |
| `optional` | `optional` | any field |
| `unique` | `unique` | any field |
| `immutable` | `immutable` | any field |
| `default` | `default("value")` | any field |
| `min` | `min(n)` | numeric fields |
| `max` | `max(n)` | numeric fields |
| `range` | `range(n, m)` | numeric fields |
| `minLength` | `minLength(n)` | string fields |
| `maxLength` | `maxLength(n)` | string fields |
| `pattern` | `pattern("regex")` | string fields |
| `past` | `past` | date/datetime fields |
| `future` | `future` | date/datetime fields |
| `pastOrPresent` | `pastOrPresent` | date/datetime fields |
| `futureOrPresent` | `futureOrPresent` | date/datetime fields |

### Mini-Example

```
domain "Orders"

// source: src/models/OrderStatus.java
enum OrderStatus {
  draft
  confirmed
  shipped
  delivered
  cancelled
}

// source: src/models/Money.java
value Money {
  amount : decimal min(0)
  currency : string default("EUR") maxLength(3)
}

// source: src/models/Order.java
entity Order {
  id : uuid unique immutable
  customer : Customer
  lines : list<OrderLine>
  status : OrderStatus default("draft")
  totalAmount : Money
  shippingAddress : Address
  estimatedDelivery : date optional futureOrPresent
  placedAt : datetime optional pastOrPresent
  createdAt : datetime immutable pastOrPresent
}

// source: src/commands/PlaceOrder.java
command PlaceOrder {
  customerId : uuid
  lines : list<OrderLine>
  shippingAddress : Address
}

// source: src/events/OrderPlaced.java
event OrderPlaced {
  orderId : uuid
  customerId : uuid
  totalAmount : Money
  placedAt : datetime
}
```

Full grammar: `specy/grammars/struct.ebnf`

---

## Syntax Reference: .flow

A `.flow` file declares the behavioral model of a bounded context.

### Header

```
domain "Name"
uses "name.struct"
```

### Block Types

**Interaction** — triggered by a command:

```
interaction Identifier {
  on CommandType
  resolves EntityType from dotPath      // 0..n
  creates EntityType                    // 0..n
  fails "message" when { expression }   // 0..n
  sets dotPath to valueExpr             // 0..n
  emits EventType                       // 0..n
}
```

**Reaction** — triggered by an event:

```
reaction Identifier {
  on EventType
  then "description of side effect"     // 1..n
  emits EventType                       // 0..n
  sets dotPath to valueExpr             // 0..n
}
```

**Policy** — domain-wide rule:

```
policy Identifier {
  when { expression }
  then "consequence description"
}
```

**Invariant** — structural constraint on an entity (never on a command or event):

```
invariant Identifier {
  on EntityType
  must { expression }
  message "violation message"
}
```

### Expression System

**Comparison operators:** `=`, `!=`, `>`, `<`, `>=`, `<=`

**Logical operators:** `and`, `or`, `not`

**Arithmetic operators:** `+`, `-`, `*`, `/`

**Defined checks:**

```
dotPath is defined
dotPath is not defined
```

**Set membership:**

```
dotPath in {value1, value2, ...}
dotPath not in {value1, value2, ...}
```

**Built-in functions:**

| Function | Description | Use for |
|---|---|---|
| `count(dotPath)` | Number of elements in a collection | `count(Order.lines) > 5` |
| `sum(dotPath)` | Sum of numeric values in a collection | `sum(Order.lines.lineTotal.amount)` |
| `size(dotPath)` | Length of a string, or size of a collection | `size(Customer.name) >= 2` |
| `isEmpty(dotPath)` | True if collection is empty or string is blank | `isEmpty(Order.lines)` |
| `isNotEmpty(dotPath)` | True if collection has elements or string is non-blank | `isNotEmpty(Post.content)` |
| `now()` | Current datetime | `sets Order.placedAt to now()` |
| `today()` | Current date | `Order.estimatedDelivery <= today()` |

**Important:** use `size(field)` to check string length — never compare a string field directly to a number (`name > 100` is invalid, write `size(name) > 100`). Use `count(field)` only on `list<T>` or `set<T>` fields, never on `string` fields.

**Valid value expressions (right-hand side of `sets ... to`):**

- Dot-path: `Command.field`, `Entity.field`
- Function call: `now()`, `sum(Order.lines.lineTotal.amount)`
- Literals: `"text"`, `42`, `3.14`, `true`, `false`
- Enum values (bare identifiers): `draft`, `confirmed`

There is no `null` literal. To represent clearing a field, use `// NOTE: sets field to empty/null` as a comment.

**Grouping:** `( expression )`

**Dot-paths:** `Entity.field`, `Entity.field.nestedField`, `Command.field`

### Mini-Example

```
domain "Orders"
uses "orders.struct"

// source: src/services/OrderService.java
interaction PlaceOrder {
  on PlaceOrder

  resolves Customer from PlaceOrder.customerId
  creates Order

  fails "Customer not found or inactive" when {
    Customer.status != active
  }

  fails "Order has no lines" when {
    isEmpty(PlaceOrder.lines)
  }

  sets Order.status to draft
  sets Order.placedAt to now()
  sets Order.totalAmount to sum(Order.lines.lineTotal)

  emits OrderPlaced
}

// source: src/listeners/OrderEventListener.java
reaction OnOrderConfirmed {
  on OrderConfirmed

  then "Notify customer that order is confirmed"
  then "Trigger shipment preparation"
}

// source: src/services/OrderService.java
policy MaxOrderAmount {
  when {
    Order.totalAmount.amount > 10000
  }
  then "Orders above 10000 require manual approval before confirmation"
}

// source: src/models/Order.java
invariant OrderMustHaveLines {
  on Order
  must {
    isNotEmpty(Order.lines)
  }
  message "An order must contain at least one line"
}
```

Full grammar: `specy/grammars/flow.ebnf`

---

## Canonical Example

Before starting Phase 2, read the canonical example files to calibrate your output style:

- `specy/examples/orders.struct` — complete structural model for an e-commerce domain
- `specy/examples/orders.flow` — complete behavioral model for the same domain

These files demonstrate the expected naming conventions, formatting, level of detail, and organization. Match their style in your output.

---

## Quality Rules

1. **No invention.** Every element in the output must be traceable to source code. If you cannot find it in the code, do not write it. Use `// UNCLEAR: ...` for ambiguous cases.
2. **One interaction per command.** Each command type gets exactly one `interaction` block. Do not merge multiple commands into one interaction.
3. **Enum values in camelCase.** Every enum value must be a valid `camelCaseId` (starts with a lowercase letter, no underscores). Convert `UPPER_SNAKE_CASE` from source code: `ACCOUNT_CREATED` → `accountCreated`, `PENDING` → `pending`.
4. **Enum values verified.** Every enum value used in a `.flow` expression (e.g. `Order.status != draft`) must exist in the corresponding `enum` definition in the `.struct`.
5. **Dot-paths resolved.** Every `dotPath` in the `.flow` must chain through fields that exist in the `.struct`. `Order.totalAmount.amount` requires `Order` to have a `totalAmount` field of type `Money`, and `Money` to have an `amount` field.
6. **Expressions must be valid — no tautologies, no bogus dotPaths.** Every `when { ... }` and `must { ... }` block must contain a real boolean expression that evaluates correctly given the types in the `.struct`. Specific rules:
   - Never compare a `string` field directly to a number — use `size(field)` for string length checks.
   - Never use `count()` on a `string` field — `count()` is for `list<T>` / `set<T>` only.
   - Never write `field is defined` on a `required` or `immutable` field as a stand-in for a condition you cannot express. A required/immutable field is always defined — this is a tautology. Use `// UNCLEAR:` instead. This applies to both `fails` clauses and `policy` `when` clauses.
   - Never subtract datetimes and compare to a bare number (`now() - Post.createdAt > 5`) — the unit is ambiguous. Use `// UNCLEAR:` with a note about the time window.
   - Never write a `resolves Entity from Command.someField` where `someField` has no relation to the entity's identity. If the field you need is not in the command, add it to the command first (see Phase 2).
   - **Try to express conditions before resorting to `// UNCLEAR`.** Self-reference checks, ownership checks, status checks, not-found checks, and existence/duplicate checks are all expressible with Specy operators. Reserve `// UNCLEAR` for conditions that truly cannot be modeled: password strength, rate limiting, regex matching, external API calls, algorithmic checks.
7. **No `null` literal.** The grammar has no `null` value. If the code sets a field to null, express it with a `// NOTE:` comment instead of `sets ... to null`.
8. **Invariants on entities only.** The `on` clause of an `invariant` must reference an `entity` type, never a `command`, `event`, or `value`. Input validation rules belong in `fails` clauses of the corresponding `interaction`.
9. **`creates` must list all created entities.** If an interaction creates a new entity instance, it must appear in a `creates` clause — do not omit the primary entity being created.
10. **Business-language messages.** Failure messages, policy consequences, and invariant messages must use domain vocabulary, not technical jargon. Write `"Customer not found or inactive"`, not `"EntityNotFoundException"`.
11. **Preserve source vocabulary.** Use the same names as the code: if the code says `Order`, write `Order`, not `PurchaseOrder`. If the code says `cancel`, write `cancel`, not `abort`.
12. **Naming convention: interaction = command name.** The interaction identifier matches the command name: `command PlaceOrder` → `interaction PlaceOrder`.
13. **Naming convention: reaction = On + event name.** The reaction identifier is the event name prefixed with `On`: `event OrderPlaced` → `reaction OnOrderPlaced`.
14. **No technical artifacts.** Do not include framework-specific types, infrastructure code, or ORM metadata in the output. Extract only domain concepts. Specifically exclude:
    - **OAuth/auth infrastructure:** entities storing client IDs, client secrets, access tokens, refresh tokens (e.g. `MastodonApp { clientId, clientSecret }`). If federation/OAuth is a domain concept, model the *connection* (user linked to external service) but omit the token storage details.
    - **Monitoring/analytics entities:** access counters, IP tracking, usage metrics (e.g. `RssMetrics { accessCount, lastAccessIp }`).
    - **Technical token fields on domain entities:** fields like `accessToken`, `refreshJwt`, `accessJwt` on a `User` entity are infrastructure concerns. Omit them. Keep the *domain-meaningful* fields (e.g. `mastodonHandle`, `blueskyDid`) that represent the business relationship.
15. **Field ordering.** Within an entity or value, order fields: identity fields first (id, uuid), then required fields, then optional fields. Within each group, keep the order from the source code.
16. **Section separators.** Use `// ===` comment blocks to separate sections (enums, values, entities, commands, events in `.struct`; interactions, reactions, policies, invariants in `.flow`), matching the style in the canonical examples.
17. **Minimal output.** Do not add fields, constraints, or blocks that are not evidenced by the code. When in doubt, omit rather than invent.
18. **Query-only entities.** If an entity defined in the `.struct` has no corresponding write interaction in the `.flow` (it is only read, never created or mutated by a command handler), annotate it in the `.struct` with `// NOTE: query-only — no write interaction found`. This signals a deliberate observation, not an omission. Common examples: visit/view tracking entities, read-only projections, entities managed by external systems.
19. **Enums without flow references.** If an enum is defined in the `.struct` but never referenced in any `.flow` expression (no `fails`, `sets`, `policy`, or `invariant` uses it), annotate it with `// NOTE: not referenced in flow — used for queries/UI only`. Do not omit it from the struct (it is still part of the domain vocabulary), but flag it.

---

## Edge Cases

### Anemic Models (CRUD without business logic)
When entities are plain data holders with no validation or business rules, look for logic in services, controllers, and middleware. The business rules may live outside the model classes. If truly no rules exist, produce a minimal `.struct` with the entities and a `.flow` with basic CRUD interactions, and annotate: `// NOTE: anemic model — business logic may be elsewhere`.

### Multiple Bounded Contexts
If the codebase contains distinct domains (e.g. Orders, Inventory, Shipping), produce a separate `.struct` / `.flow` pair for each. Name them `orders.struct`, `inventory.struct`, etc.

### Shared Types Across Contexts
If a type (e.g. `Money`, `Address`) is used in multiple bounded contexts, duplicate it in each `.struct` file. Each context must be self-contained.

### Generated Code
Ignore generated code (protobuf stubs, ORM migrations, GraphQL types, Swagger DTOs) unless it reveals domain concepts not found elsewhere. Annotate with `// NOTE: extracted from generated code`.

### Tests as a Source of Truth
Read test files — they often encode business rules more explicitly than production code. Test assertions like `assertThrows(...)` or `expect(...).toThrow(...)` reveal `fails` conditions. Test setup reveals entity creation patterns.

### Large Projects
If the project has more than ~50 model classes or ~30 service classes, ask the user to scope the extraction to a specific bounded context or module before proceeding. Do not attempt to extract everything at once.

### Missing Events
When a command handler mutates state but does not publish an event, annotate with `// UNCLEAR: no event emitted — consider adding {SuggestedEventName}`. Do not invent the event.

### Unexpressible Conditions (uniqueness, external calls, regex, rate limits)
Many real-world guard conditions cannot be expressed with Specy operators. Common examples:
- **Uniqueness checks** (`if (await repo.existsByEmail(email))`)
- **Password strength** (common password lists, entropy checks)
- **Rate limiting** (in-memory or Redis-based throttling)
- **External API validation** (OAuth token verification, payment gateway)
- **Complex regex matching** (email format, URL validation, banned word lists with leetspeak)
- **Cross-entity lookups** (checking existence in another aggregate)

For all of these: **do not emit a `fails` clause with a placeholder expression**. Instead, replace with a comment:
```
// UNCLEAR: condition not expressible — checks email uniqueness against database
// UNCLEAR: condition not expressible — validates password against common passwords list (NIST SP 800-63B)
// UNCLEAR: condition not expressible — per-user rate limiting (max N requests per hour)
```

The `fails` clause requires a `when { expression }` that is a real evaluable condition. If you cannot write one, the `fails` clause must be omitted entirely. A `// UNCLEAR:` comment preserves the information without producing invalid output.

### Inheritance and Polymorphism
When entities use inheritance (e.g. `Payment` → `CreditCardPayment`, `BankTransferPayment`):
- If the subtypes differ only in a type field → model as a single entity with an enum field. Add `// NOTE: collapsed inheritance hierarchy into enum`.
- If the subtypes have genuinely different fields → model as separate entities. Add `// NOTE: split from inheritance hierarchy`.
- Document the choice with a comment so the user can review.
