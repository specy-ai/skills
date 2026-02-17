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
- **Order within `.flow`:** repositories, then services, then interactions, then reactions, then policies, then invariants.

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
6. If `specy/*.struct` files already exist, determine the mode:
   - If the user specified a definition name (e.g. `distill User`, `distill PlaceOrder`) → switch to **targeted mode** (see Targeted Mode section). Skip the rest of this phase and follow the targeted workflow.
   - If the user invoked the skill with the `--full` flag → use **full update mode** unconditionally.
   - Otherwise, if `specy/.meta.json` exists and the saved `gitSha` is reachable in the git history → use **incremental update mode**; otherwise use **full update mode**.
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
   - `service` — interface or class that is stateless with business logic, without identity or persisted state. Do not confuse with repositories (data access) or controllers (infrastructure). Services are behavioral → they produce `service` blocks in the `.flow`, not in the `.struct`.
   - `repository` — interface of persistence for an aggregate root. Contains data access operations (find, save, delete, exists). Does NOT contain business logic. Repositories are behavioral → they produce `repository` blocks in the `.flow`, not in the `.struct`.
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
   - `resolves` → entities loaded/fetched (from repository calls, `.findById`, etc.). The `from` dotPath must point to a field that identifies the entity. When a repository is declared in the `.flow` and the code calls a specific repository operation, add a `via Repository.operation` clause to trace the data access path. The `via` is optional for retrocompatibility. This includes **indirect resolution** — when an entity is loaded via a field of another already-resolved entity. In that case, use a dotPath through the resolved entity:
     ```
     // Direct resolution with via — entity loaded from a command field through a repository:
     resolves User via UserRepository.findById from UpdateProfile.userId

     // Direct resolution without via — retrocompatible form:
     resolves Order from CancelOrder.orderId

     // Indirect resolution — entity loaded via a field of another resolved entity:
     resolves Order via OrderRepository.findById from ShipOrder.orderId
     resolves Payment from Order.paymentId

     // Indirect resolution — chained through a token:
     resolves PasswordResetToken from ResetPassword.token
     resolves Customer from PasswordResetToken.customerId
     ```
     **Every entity you `sets` or reference in a `fails` expression must be explicitly resolved or created.** A `// NOTE: resolved indirectly` comment is NOT a substitute for a `resolves` clause — if the code loads the entity, model it with `resolves`.
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

   // String length — Code: if (name.length > 200) throw ...
   fails "Product name exceeds 200 characters" when {
     size(CreateProduct.name) > 200
   }

   // Self-reference guard — Code: if (userId === targetUserId) throw ...
   fails "Cannot transfer to yourself" when {
     TransferFunds.sourceAccountId = TransferFunds.targetAccountId
   }

   // Ownership check — Code: if (entity.ownerId !== userId) throw ...
   fails "Not authorized to cancel this order" when {
     Order.customer.id != CancelOrder.customerId
   }

   // Entity not found — Code: if (!entity) throw ...
   fails "Order not found" when {
     Order is not defined
   }

   // Existence / duplicate check — Code: if (await repo.exists(a, b)) throw ...
   // Model with resolves + "is defined":
   resolves Payment from ProcessPayment.orderId
   fails "A payment already exists for this order" when {
     Payment is defined
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
   // ❌ WRONG — Customer is not resolved from a payment method
   resolves Customer from ProcessPayment.method

   // ❌ WRONG — Order is not resolved from a reason text
   resolves Order from CancelOrder.reason
   ```
   If the entity is resolved from a field that is not in the command (e.g. only available in the session), add that field to the command first (see Phase 2 rule on command fields), then use it in `resolves`.

   **Anti-pattern — missing indirect resolution:**
   ```
   // ❌ WRONG — sets Customer fields but Customer is not resolved
   interaction ResetPassword {
     on ResetPassword
     resolves PasswordResetToken from ResetPassword.token
     // NOTE: Customer resolved indirectly via token  ← NOT ENOUGH
     sets Customer.password to ResetPassword.newPassword  // ← Customer not in resolves/creates
     sets PasswordResetToken.usedAt to now()
   }

   // ✅ CORRECT — Customer explicitly resolved via indirect dotPath
   interaction ResetPassword {
     on ResetPassword
     resolves PasswordResetToken from ResetPassword.token
     resolves Customer from PasswordResetToken.customerId
     sets PasswordResetToken.usedAt to now()
     // NOTE: Customer.password is set to hashed value of ResetPassword.newPassword
   }
   ```
   - `sets` → field mutations on resolved/created entities. **Every entity referenced in a `sets` clause must appear in a `resolves` or `creates` clause of the same interaction.** If the code updates entities that are not directly resolved (e.g. bulk updates on related records), do not emit a `sets` clause — use a `// NOTE:` comment to describe the side effect instead.
   - `emits` → events published/dispatched
3. **For each service identified in Phase 2** → create a `service` block in the `.flow`:
   - One `service` block per service class/interface.
   - For each public method with business logic → create an `operation` inside the service block.
   - `accepts` → parameters of the method (map types using the type mapping table).
   - `returns` → the return type of the method (if not void).
   - `fails` → error conditions thrown by the service method (same rules as interaction `fails`).
   - `then` → describe the business logic in natural language when it cannot be expressed structurally.
   - `emits` → events published by the service method.
4. **For each call to a service in a command handler** → add a `delegates ServiceName.operationName` clause in the corresponding `interaction` block:
   - Place `delegates` after `fails` and before `sets`.
   - If the result of the service call is assigned to a field of a resolved/created entity, express it with `sets Entity.field to ServiceName.operationName`.
5. **For each repository interface identified in Phase 2** → create a `repository` block in the `.flow`:
   - One `repository` block per repository interface/class.
   - `for` → the entity type the repository manages (the aggregate root).
   - For each method used in the extracted interactions/reactions → create an `operation` inside the repository block.
   - `accepts` → parameters of the method (map types using the type mapping table).
   - `returns` → the return type of the method (if not void).
   - **Only model operations that are referenced by at least one `resolves ... via` clause or used in an extracted interaction.** Do not model query-only methods (pagination, search, aggregation for UI/dashboard). Heuristic: if an operation is not referenced by any `resolves ... via` in the `.flow`, it does not need to be declared. Annotate omissions with `// NOTE: query-only — not modeled`.
6. **For each `repository.findBy*()` call in a command handler** → add `via Repository.operation` in the corresponding `resolves` clause of the `interaction` block.
7. **For each event listener** → create a `reaction` block:
   - `on` → the event typeName
   - `then` → describe the side effect in business language
   - `delegates` → if the reaction calls a service, add a `delegates` clause
   - `sets` → any field mutations
   - `emits` → any chained events
8. **Cross-cutting rules** → create `policy` blocks:
   - Domain rules that span multiple operations or guard multiple commands
   - Express the condition with `when { ... }` and the consequence with `then "..."`
   - **The `when` condition must be a real, evaluable boolean expression — the same tautology prohibition as `fails` applies here.** If the policy's real condition is unexpressible (datetime arithmetic, cross-context queries, external lookups), do NOT emit a `policy` block with a placeholder `when` clause. Instead, write a standalone `// UNCLEAR:` comment describing the rule:
     ```
     // UNCLEAR: policy not expressible — orders can only be modified within 24 hours of placement (datetime arithmetic)
     // UNCLEAR: policy not expressible — payment gateway must confirm card validity before capture (external service call)
     ```
   - Common tautological traps in policies:
     ```
     // WRONG — createdAt is immutable pastOrPresent, always defined
     policy OrderModificationWindow {
       when { Order.createdAt is defined }
       then "Orders can only be modified within 24 hours of placement"
     }

     // WRONG — updatedAt being defined does not capture the time window
     policy OrderEditDeadline {
       when { Order.updatedAt is defined }
       then "Orders can only be edited within 1 hour"
     }

     // WRONG — condition is a status check, not the actual cross-aggregate rule
     policy PaymentRequiredForShipping {
       when { Order.status = confirmed }
       then "A captured payment is required before shipping"
     }
     ```
9. **Structural constraints** → create `invariant` blocks:
   - Conditions that must always be true for an **entity** (never a command, event, or value)
   - Express with `on EntityType`, `must { ... }`, and `message "..."`
   - Validation rules on command inputs belong in `fails` clauses of the corresponding `interaction`, not in invariants
10. Write the `.flow` file following the output conventions.
11. Print a summary:
   ```
   ## Flow Extraction Summary — {domain}
   - Repositories: {count}
   - Services: {count}
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
6. For every `delegates` clause, verify the dot-path resolves to a `service` + `operation` that exists in the `.flow`.
7. For every `resolves ... via Repository.operation` clause, verify the `repository` + `operation` exists in the `.flow`. The `for` entity of the repository must match the type being resolved.
8. For every `accepts` and `returns` clause in a service or repository operation, verify the types resolve in the `.struct` (primitives are always valid).
9. Fix any obvious errors (typos, mismatched casing). For ambiguous cases, add `// UNCLEAR: ...`.
10. For every `policy` block, verify the `when` condition is not tautological (see Quality Rule 6). If it is, remove the `policy` block and replace with a `// UNCLEAR:` comment.
11. Present a final summary:
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
    "src/services/PricingService.java": ["service PricingCalculator"],
    "src/repositories/OrderRepository.java": ["repository OrderRepository"],
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

When `specy/*.struct` files already exist and the user did NOT specify a definition name, the update mode applies. There are two sub-modes: **incremental** (efficient, delta-based) and **full** (fallback). If the user specified a definition name (e.g. `distill User`), see **Targeted Mode** instead.

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

## Targeted Mode

When `specy/*.struct` and `specy/*.flow` files already exist and the user specifies a definition to re-extract by name. This mode re-extracts a single definition (or a coherent unit of definitions) from the source code without touching anything else.

**Invocation:** `distill <DefinitionName>` — where `DefinitionName` is the name of an entity, interaction, command, event, enum, value, reaction, policy, or invariant.

**Pre-condition:** existing `.struct` / `.flow` files must be present. If they are not, refuse and ask the user to run a full distill first.

### Phase 1 — Target Resolution

1. Search all existing `specy/*.struct` and `specy/*.flow` files for a definition matching `DefinitionName`.
2. **If found** — identify:
   - The definition type (entity, interaction, command, etc.)
   - The domain / file pair it belongs to (`{domain}.struct` or `{domain}.flow`)
   - The source file from the `// source:` comment preceding the definition
   - If `specy/.meta.json` exists, cross-reference with the `filemap` for additional source files
3. **If not found** — the definition is new. Search the codebase for a matching class, handler, or type:
   - Look for files matching `*{DefinitionName}*` in the project
   - Apply the extraction heuristics (section 6) to identify what type of definition it should be
   - Identify the bounded context it belongs to from the surrounding code structure
   - If nothing is found, inform the user and stop
4. Determine the **extraction unit** based on the definition type (see below).
5. Display a summary and wait for user confirmation:
   ```
   ## Targeted Extraction
   - Target: {type} {DefinitionName}
   - Source file(s): {list}
   - Extraction unit: {list of definitions to re-extract}
   - Status: {existing — will be updated | new — will be added}
   ```

### Extraction Units

The extraction unit defines what gets re-extracted together. The goal is to maintain internal consistency without re-extracting everything.

**Targeting an entity:**
```
distill User
```
- Re-extract: `entity User`
- Also re-extract: any `enum` or `value` defined in the **same source file** as the entity (they often co-evolve)
- Do NOT re-extract: interactions, commands, events, or definitions from other source files
- Cascade warning: list interactions that `resolves` or `creates` this entity — the user may want to re-extract them too

**Targeting an interaction:**
```
distill PlaceOrder
```
- Re-extract: `interaction PlaceOrder`
- Also re-extract: `command PlaceOrder` (1:1 coupling — the command is the interaction's input contract)
- Also re-extract: every `event` emitted by the interaction (listed in `emits` clauses)
- Do NOT re-extract: resolved entities (they have their own source of truth)
- Cascade warning: list reactions triggered by the emitted events

**Targeting a command:**
```
distill PlaceOrder
```
- If a matching interaction exists, treat as "targeting an interaction" (same extraction unit)
- If no matching interaction exists (orphan command), re-extract just the command

**Targeting an event:**
```
distill OrderPlaced
```
- Re-extract: `event OrderPlaced`
- Cascade warning: list interactions that emit it and reactions that listen to it

**Targeting a reaction:**
```
distill OnOrderPlaced
```
- Re-extract: `reaction OnOrderPlaced`
- Do NOT re-extract: the triggering event (it has its own source of truth)

**Targeting an enum or value:**
```
distill OrderStatus
```
- Re-extract: `enum OrderStatus` (or `value Money`)
- Cascade warning: list entities and interactions that reference it

**Targeting a policy or invariant:**
```
distill MaxOrderAmount
```
- Re-extract: `policy MaxOrderAmount` (or `invariant OrderMustHaveLines`)

### Phases 2–3 — Scoped Extraction

1. Load the existing `.struct` and `.flow` files as the working base.
2. Read **only** the source file(s) identified in Phase 1 — do not read other source files.
3. Re-extract only the definitions in the extraction unit, following the same rules as the main workflow (Phase 2 for struct, Phase 3 for flow).
4. Compare old vs new for each re-extracted definition:
   - **Modified:** show the diff (field added/removed/changed, constraint changed, clause added/removed)
   - **Unchanged:** report "no changes detected" and stop (do not rewrite the file)
   - **New:** show the full definition to be added
5. Present the changes:
   ```
   ## Proposed Changes — {domain}.struct
   ### Modified
   - entity Order: added field "trackingNumber : string optional maxLength(100)"
   - entity Order: field "totalAmount" type changed from int to Money

   ## Proposed Changes — {domain}.flow
   ### Modified
   - interaction ShipOrder: added sets clause "Order.trackingNumber"
   - interaction ShipOrder: added fails clause "Tracking number already assigned"

   ## Cascade Warning
   - entity Order changed → interaction PlaceOrder, interaction ConfirmOrder reference Order (not re-extracted — verify if needed)
   ```
6. Apply after user confirms.

### Phase 4 — Scoped Validation

1. Run cross-validation **only on the re-extracted definitions**, plus any existing definitions that directly reference them.
2. Verify:
   - All `typeName` references resolve
   - All `dotPath` chains resolve
   - All enum values exist
   - All `sets` clauses reference resolved/created entities
   - No tautological conditions
3. Present a scoped validation summary:
   ```
   ## Validation Summary (targeted)
   - Target: {type} {DefinitionName}
   - Definitions validated: {n}
   - Types resolved: {n}/{n}
   - Dot-paths resolved: {n}/{n}
   - Issues corrected: {n}
   - Files updated: {list}
   ```

### End of Run — Meta Update

If `specy/.meta.json` exists, update only the filemap entries corresponding to the re-extracted definitions. Do not change `gitSha` or `lastRun` — targeted mode is a surgical edit, not a full sync.

---

## Extraction Heuristics

During Phase 1, read `heuristics/INDEX.md` and load the relevant heuristic files based on the detected stack. Always load `generic.md` (naming patterns, type mapping, services, repositories). Load the stack-specific file (e.g. `java-spring.md`) when the framework is identified.

---

## Syntax Reference

Read the formal grammars before producing output:

- `specy/grammars/struct.ebnf` — structural model (.struct files)
- `specy/grammars/flow.ebnf` — behavioral model (.flow files)

Read the canonical examples to calibrate output style:

- `specy/examples/orders.struct` — complete structural model
- `specy/examples/orders.flow` — complete behavioral model

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
   - Never subtract datetimes and compare to a bare number (`now() - Order.placedAt > 5`) — the unit is ambiguous. Use `// UNCLEAR:` with a note about the time window.
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
    - **OAuth/auth infrastructure:** entities storing client IDs, client secrets, access tokens, refresh tokens (e.g. `OAuthApp { clientId, clientSecret }`). If OAuth/federation is a domain concept, model the *connection* (user linked to external service) but omit the token storage details.
    - **Monitoring/analytics entities:** access counters, IP tracking, usage metrics (e.g. `ApiMetrics { requestCount, lastRequestIp }`).
    - **Technical token fields on domain entities:** fields like `accessToken`, `refreshToken`, `sessionJwt` on a domain entity are infrastructure concerns. Omit them. Keep the *domain-meaningful* fields (e.g. `externalHandle`, `externalId`) that represent the business relationship.
15. **Field ordering.** Within an entity or value, order fields: identity fields first (id, uuid), then required fields, then optional fields. Within each group, keep the order from the source code.
16. **Section separators.** Use `// ===` comment blocks to separate sections (enums, values, entities, commands, events in `.struct`; interactions, reactions, policies, invariants in `.flow`), matching the style in the canonical examples.
17. **Minimal output.** Do not add fields, constraints, or blocks that are not evidenced by the code. When in doubt, omit rather than invent.
18. **Query-only entities.** If an entity defined in the `.struct` has no corresponding write interaction in the `.flow` (it is only read, never created or mutated by a command handler), annotate it in the `.struct` with `// NOTE: query-only — no write interaction found`. This signals a deliberate observation, not an omission. Common examples: visit/view tracking entities, read-only projections, entities managed by external systems.
19. **Enums without flow references.** If an enum is defined in the `.struct` but never referenced in any `.flow` expression (no `fails`, `sets`, `policy`, or `invariant` uses it), annotate it with `// NOTE: not referenced in flow — used for queries/UI only`. Do not omit it from the struct (it is still part of the domain vocabulary), but flag it.
20. **Service operations use `then` for unexpressible logic.** When a service operation's business logic cannot be captured structurally, describe it with a `then` clause. Use `fails` in operations only when the error condition is formally expressible.
21. **No service for pure infrastructure.** Do not create `service` blocks for image processing, password hashing, logging, caching, rate limiting, or other purely technical concerns. These are infrastructure, not domain logic. Use `// NOTE:` comments instead.
22. **Repository operations are pure data access.** Repository operations contain only `accepts` and `returns` — never `then`, `fails`, `sets`, or `emits`. Business logic belongs in interactions and services, not repositories.
23. **Repository `for` must be an aggregate root.** The `for` clause of a repository must reference an entity (aggregate root), not a value object or an enum.
24. **No repository for technical types.** Do not create `repository` blocks for audit logs, session tokens, or other purely technical persistence concerns — unless they are used in domain interactions.

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
