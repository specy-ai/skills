<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Data & Operation model metamodel](#data--operation-model-metamodel)
  - [Convention](#convention)
  - [Conformance levels](#conformance-levels)
  - [Model](#model)
  - [Module](#module)
  - [Composition: declarations as trait bundles](#composition-declarations-as-trait-bundles)
    - [Relations as edge kinds](#relations-as-edge-kinds)
  - [Data](#data)
    - [Type](#type)
    - [Struct](#struct)
      - [State](#state)
    - [External declaration](#external-declaration)
  - [Global Binding](#global-binding)
  - [Operation](#operation)
    - [Attachment](#attachment)
    - [Error signature](#error-signature)
    - [Describing processing](#describing-processing)
      - [Level 0 — Description](#level-0--description)
      - [Level 1 — Contract](#level-1--contract)
      - [Level 2 — Flow](#level-2--flow)
    - [Dependency graph](#dependency-graph)
  - [Traceability to the Domain model](#traceability-to-the-domain-model)
  - [Worked example: a designed model (strict)](#worked-example-a-designed-model-strict)
  - [Worked example: an extracted model (observed)](#worked-example-an-extracted-model-observed)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->




# Data & Operation model metamodel

This file defines a foundational representation for describing data structures, operation signatures, global variable bindings, and the contracts and call flows that connect them. It is a **description language**, not a programming language: operations have no bodies — no statements, no branching on the happy path, no loops, no computed expressions. A Data & Operation model describes *what data exists*, *what operations exist over that data*, *what each operation needs* — other operations, global state — and *what each operation guarantees*. How an operation computes its result is deliberately out of scope; a flow, when present, says which declared operations it calls and in what order, never how the values in between are computed.

Conditions appear in exactly three places, all written in the same small predicate language: a struct's named [states](#state) (predicates over an instance), an operation's [contract](#level-1--contract) (predicates over its arguments, its result and the globals it touches), and the guards on a flow's failure exits. None of them is a computation — each is a boolean statement about data.

The Data & Operation model is the "how substrate" beneath the domain model (see DOMAIN-METAMODEL.md). Where the domain model captures business intent — entities, aggregates, commands, events — the Data & Operation model captures the structural skeleton of an implementation: concrete data shapes and the dependency graph of the operations that realize domain behavior. The two models are linked through optional, traceable `implements` relations (see [Traceability to the Domain model](#traceability-to-the-domain-model)).

The model serves two directions. **Designed forward**, by a person or an agent, it is written under the `strict` [conformance level](#conformance-levels): its two graphs (struct references and operation dependencies) are acyclic and its effect declarations are closed-world, so topological ordering, impact analysis, dead-code detection and effect propagation are all decidable by simple graph traversal. **Extracted backward**, from an existing codebase (for instance by lowering a code graph), it is written under the `observed` level: the same syntax, but the rules that real code routinely violates — cycles, unresolved dispatch, types outside the closed type language — are reported as findings instead of rejected. One file format, two confidence levels.

## Convention

Every concept in this metamodel carries a name, a description, and a metadata map (a set of arbitrary key/value pairs). These attributes are implicit and not repeated in each definition below.

**Naming**: struct names use `PascalCase` (`Money`, `PriceEntry`). Operation names, global binding names, and field names use `camelCase` (`reserveStock`, `exchangeRates`, `unitPrice`). Error signature names use `PascalCase` (`InsufficientStock`), mirroring the domain model's error event naming. State labels are free-text string literals in business language (`"a pending task"`).

**Identity**: an element is identified by the structured key *(module, symbol, disambiguator?)*. The symbol is the dotted path below the module (`Money`, `PriceEntry.effectivePrice`, `vatRate`). The disambiguator exists only for overloaded operations and is the parameter type list, written in parentheses (`addLine(OrderLine)` vs `addLine(string, number)`). A rendered qualified name — `pricing.PriceEntry.effectivePrice` — is a display and reference form of that key; two elements are the same exactly when their keys are equal component by component.

**Implicit implementation by naming**: when a Data & Operation model element and a domain model element share the same name (compared case-insensitively, ignoring case-style differences such as `reserveStock` vs `ReserveStock`) within corresponding modules, the `implements` relation is presumed without being declared. An explicit `implements` declaration is only needed when names diverge — and it always wins over the naming presumption.

**Evidence**: a declaration may carry a `// source: path:start-end` comment naming the source location it was written from or extracted from. It is the same convention as every other Specy artifact. Under `observed` every declaration should carry one; under `strict` it is optional. It is a comment to the grammar and a source anchor to the tooling.

Concrete syntax appears throughout in fenced blocks. The normative grammar for it is `src/grammars/data-operation.ebnf`, which pairs with this document section by section: every production there carries a `(metamodel: <Section>)` back-reference to the section below that defines it. Constraints stated here as "shall" but not expressible in a context-free grammar (the acyclicity rules, the closed-world declaration rule, type conformance of initial values, flow/clause agreement) are listed as semantic rules at the foot of the grammar file, each tagged with the conformance level it applies to. The artifact extension is `.dataop`.

## Conformance levels

A model declares its conformance level in its header: `model pricing-engine strict { … }` or `model order-service observed { … }`. When omitted, the level is `strict`.

| | `strict` (default) | `observed` |
|---|---|---|
| Who writes it | a designer or a design agent | an extraction from code |
| Struct reference graph | shall be acyclic | cycles are findings |
| Operation dependency graph | shall be acyclic | cycles are findings |
| Effect declarations | closed-world, complete | complete as far as static analysis could see; blind spots are findings |
| Uncertain dependency (`?`) | not allowed | allowed |
| `opaque` type | not allowed | allowed |
| External declarations | allowed | allowed |
| Flow guards on the happy path | never | never — a body's branching that the flow cannot express is a finding, not a guard |
| Evidence comments | optional | expected on every declaration |

Every syntactic construct is legal at both levels; the levels differ only in which semantic rules reject a model and which merely report on it. A model that passes `strict` validation also passes `observed` validation with no findings. Lowering a code graph into an `observed` model and then tightening it into a `strict` one is the intended path from "what the code does" to "what the design says".

Relations:
- 1..1 "governs" relation with a model

## Model

A Data & Operation model is the top-level container. It groups modules and external declarations, fixes the conformance level, and optionally anchors the whole model to the domain layer it implements.

Relations:
- 1..1 "has" relation with a conformance level (`strict` by default)
- 1..n "contains" relation with modules
- 0..n "declares" relation with external declarations
- 0..1 "implements" relation with a domain bounded context or organization (the domain scope this model realizes)

## Module

A module is the unit of decomposition, mirroring the domain model's module concept. A module groups structs, global bindings, and operations that belong together. References that cross a module boundary shall be qualified with the module name (`pricing.Money`).

A module's dependencies are **derived**, never declared: module A depends on module B when any struct, global binding, or operation of A references an element of B. Under `strict` the derived module dependency graph shall be acyclic — this follows from, and is checked alongside, the acyclicity of the struct reference graph and the operation dependency graph. Under `observed` a module cycle is a finding.

Relations:
- 1..1 "belongs to" relation with a model
- 0..n "declares" relation with structs
- 0..n "declares" relation with global bindings
- 0..n "declares" relation with operations
- 0..n "declares" relation with external declarations
- 0..n "depends on" relation with other modules (derived from element references)
- 0..1 "implements" relation with a domain module (implicit by naming or explicit)

## Composition: declarations as trait bundles

The surface syntax has a handful of keywords — `module`, `struct`, `global`, `operation`, `external` — and the writer never sees anything else. Behind each keyword, however, a declaration is not a node in a class hierarchy but a **sum of traits**: a small closed set of micro-capabilities, each contributing its attributes. The keyword picks the base bundle; the position of the declaration and the shape of its type can add traits to it. This is what lets one construct be several things at once without a hierarchy having to place it — a global whose type is a function is a value holder *and* invocable; an operation written inside a struct is invocable *and* attached to that struct.

| Trait | Attributes contributed | Meaning |
|---|---|---|
| `Named` | `name` | has a name of its own |
| `Module` | `external` | is a unit of decomposition |
| `Type` | `external` | is a named data shape that other declarations can reference |
| `WithChildren` | *(marker)* | lexically contains declarations |
| `ChildOf` | `parent` | is lexically contained in a declaration |
| `AttachedTo` | `attachedTo` | semantically belongs to a struct (a method); may differ from `parent` |
| `Structural` | *(marker)* | holds a value; legal target of an access |
| `Typed` | `type` | has a declared type |
| `WithValue` | `initialValue` | has a declaration-site value |
| `Invocable` | `parameters`, `returnType`, `errors` | can be called |
| `WithStates` | `states` | has named derived conditions |
| `WithContract` | `requires`, `ensures` | has a contract |
| `WithFlow` | `flow` | has an ordered call flow |

| Declaration | Traits |
|---|---|
| `module` | Named, Module, WithChildren |
| `struct` | Named, Type, WithChildren, WithStates |
| schema field | Named, Structural, Typed, ChildOf |
| `global` | Named, Structural, Typed, WithValue, ChildOf |
| `global` whose type is a function type | the above **plus Invocable** |
| `operation` at module level | Named, Invocable, WithContract, WithFlow, ChildOf |
| `operation` nested in a struct, or with `on` | the above **plus AttachedTo** |
| `external module` | Named, Module, with `external = true` |
| `external struct` | Named, Type, with `external = true` |

The trait vocabulary is closed and canonical. It is the level at which this model and a code graph extracted by static analysis meet: a lowering from such a graph maps each of its entities to the bundle above whose traits it carries, and a keyword is chosen from the bundle, never the other way round.

### Relations as edge kinds

Every relation between declarations is one of six edge kinds. The clauses of the surface syntax each emit exactly one kind, so the relation graph of a model is fully determined by its text.

| Edge kind | From → To | Emitted by |
|---|---|---|
| `contains` | WithChildren → ChildOf | lexical nesting |
| `references` | Typed → Type | a field, parameter, return, global or function type naming a struct |
| `invokes` | Invocable → Invocable | `depends on`; a flow's call steps |
| `accesses` (read, write, or both) | Invocable → Structural | `reads`, `writes`; a flow's write steps |
| `throws` | Invocable → error signature | `errors`; a flow's raise steps |
| `implements` | any → domain element | `implements`, `represents`, `corresponds to`, or the naming presumption |

An edge may carry a **provenance**: `declared` (written in the model), `derived` (computed from other declared facts, such as a module dependency), or `candidate` (an uncertain dependency marked `?`, see [Dependency graph](#dependency-graph)). Under `strict` every stored edge is `declared`.

Edges are stored in the outgoing direction only. Inverse views — the callers of an operation, the readers of a global, the operations attached to a struct — are derived and never written.

## Data

Data in a Data & Operation model is JSON-like: the same scalar values as JSON, composed with vectors and maps. There are exactly seven type constructors and no others — no unions, no inheritance, no generics beyond the vector element type.

### Type

A type is one of the following constructors:

| Constructor | Form | Meaning |
|---|---|---|
| Scalar | `string`, `number`, `boolean` | The JSON scalar values. `number` covers integers and decimals alike, as in JSON. |
| Vector | `vector<T>` | An ordered sequence whose elements all conform to the single element type `T`. Vectors are homogeneous — a vector shall not mix element types. |
| Map | `{ field: T, … }` | A record of named fields, each with its own type. **Every field is required** — there are no optional fields. |
| Struct reference | `StructName` | A reference to a defined [struct](#struct) or [external struct](#external-declaration), possibly qualified (`pricing.Money`). |
| Function | `(T, U) -> R`, `(T) -> void` | A value that can be called: the parameter types in order and the return type, or `void` for a function that exists for its effects. This is what lets a [global binding](#global-binding) hold an operation. |
| Opaque | `opaque "…"` | A type the closed type language cannot express, carried as the verbatim signature string of the source it was extracted from (`opaque "java.util.Map<String, Object>"`). **`observed` only.** Nothing can be checked about an opaque value except that it is passed around whole. |
| Nullable marker | `T?` | Admits `null` in addition to the values of `T`. `null` is not a standalone type — it exists only through this marker. Applicable to any type. |

Constraints:
- A type shall not be a union: a field, argument, return, or vector element has exactly one type.
- Absence of a value shall be expressed with the nullable marker, never by omitting a field: a map value always carries all declared fields, some of which may hold `null` when their type is nullable.
- `opaque` shall not appear in a `strict` model. Tightening an `observed` model into a `strict` one means replacing every opaque type with a struct that describes the shape actually used.

The type language is deliberately closed. Its purpose is to make every data shape in the model fully explicit and structurally comparable — two types are the same exactly when their constructor trees are the same. Opaque is the one escape hatch, and it is confined to extracted models precisely so that designed ones stay comparable.

### Struct

A struct is a **named data structure**: the model's unit of vocabulary. Arguments, returns, error payloads, and global bindings refer to data shapes by struct name rather than repeating structural types. A struct groups its data shape, the named conditions of an instance, and the operations that belong to it:

- a mandatory **`schema` block** — the fields, each a name and a [type](#type). This is the shape (a map type), the same field-list machinery as an inline map, given a name.
- an optional **`state` block** — zero or more named [states](#state), each a boolean predicate over an instance.
- zero or more **nested operations** — [operations](#operation) written inside the struct, which are thereby [attached](#attachment) to it. Within a nested operation `_` denotes the receiver instance, exactly as it does in a state predicate.

Constraints:
- Under `strict`, a struct's `schema` block shall only reference **previously defined** structs. There are no forward references and no recursion — a struct shall not reference itself directly or transitively. The struct reference graph is therefore a DAG, and every value described by the model is finite by construction. Under `observed` a cycle in the struct reference graph is a finding.
- The previous-definition rule applies to the `schema` block only. A nested operation's signature may reference any struct of the model.
- A struct name shall be unique within its module.

**Example.**

```
struct Money {
  schema {
    amount:   number
    currency: string
  }
}

struct Task {
  schema {
    name:   string
    status: string
  }

  state {
    "a pending task"   : _.status = "pending"
    "a completed task" : _.status = "done"
  }

  operation complete()
    writes { _.status }
    requires { _.status = "pending" }
    ensures  { _.status = "done" }
}

struct PriceList {
  schema {
    name:    string
    entries: vector<PriceEntry>
  }
}
```

Relations:
- 1..1 "belongs to" relation with a module
- 1..1 "is shaped by" relation with a schema block (a map type)
- 0..n "declares" relation with states
- 0..n "owns" relation with attached operations (nested, or declared elsewhere with `on`)
- 0..n "references" relation with structs (under `strict`: previously defined ones only, forming a DAG)
- 0..1 "represents" relation with a domain entity, value type, or enum (implicit by naming or explicit)

#### State

A state is a **named, derived condition** of a struct instance: a business-language label bound to a boolean predicate evaluated against the instance's own data. Within a predicate, `_` denotes the instance and `_.field` (a dot-path) reaches its fields. The predicate language is small and total — comparisons (`=`, `!=`, `>`, `<`, `>=`, `<=`) between a path and a literal or between two paths, `is null` / `is not null`, membership (`in { … }`), and the boolean connectives `and` / `or` / `not`. It has no function calls, no arithmetic, and — in a state — no reference to anything outside the instance. The same predicate language, with more roots in scope, is what an operation's [contract](#level-1--contract) uses.

States are **derived, not stored**. A struct has no mutable "current state" field, no transitions, and no start state — a state simply *holds* or *does not hold* for a given instance, computed from its data. Two states may hold at once; they need not partition the instance space. This is the deliberate difference from the domain model's Entity state machine (see DOMAIN-METAMODEL.md, State machine), which models stored, mutually exclusive lifecycle states connected by guarded transitions. Here, states are a read-only vocabulary for talking about data.

Relations:
- 1..1 "belongs to" relation with a struct
- 1..1 "is defined by" relation with a boolean predicate over the instance (`_`)

### External declaration

An external declaration names a struct or a module that the model **references but does not describe**: a library type, a platform package, a service owned by another model. It is the closure device — every reference in the model resolves to something declared, and an external declaration is the honest way to declare what lies outside the model's scope.

- `external struct java.util.List` declares a struct with a name and nothing else: no schema, no states, no operations. It can be referenced wherever a struct reference is legal and nothing can be said about its shape — it behaves as a nominal type.
- `external module java.util` declares a module with a name and no declarations. It exists so that external structs have a module to belong to, and so that derived module dependencies on it are visible.

Exactly two things are external-declarable: types and modules. An external *operation* or *global* is deliberately not expressible — a call into a library is a dependency on the library's *module*, recorded by the referencing declaration's derived module dependency, not a fabricated operation with an invented signature.

External declarations are legal at both conformance levels. A designed model may honestly depend on a library type; an extracted one always does.

Relations:
- 1..1 "belongs to" relation with a model or a module
- 0..n "referenced by" relation with typed declarations (derived)

## Global Binding

A global binding is a **named, mutable, typed variable** at module level. It declares a piece of shared state that operations may read or write. A global binding has exactly one type and exactly one **initial value** that shall conform to the declared type:

- for any type but a function type, the initial value is a literal, written in JSON notation;
- for a **function type**, the initial value is the name of an operation whose signature conforms to the function type. The global then holds that operation: it is a value holder *and* invocable, and it may be called through the binding by any operation that declares it in `reads`.

The model therefore fully describes the starting state of the world, including which operation each function-valued global initially holds.

Global bindings are mutable, but mutation is never ambient: a global binding changes only through operations that explicitly declare it in their `writes` list (see [Operation](#operation)). Which operations touch which globals is thus a total, declared fact — the read/write access matrix of the model is closed and analyzable. A function-valued global is how the model expresses a swappable strategy without giving up that closure: rebinding it is a `write`, calling it is a `read`, and the effective dependency at the initial state is derivable from the declared initial value.

**Example.**

```
global standardPriceList: PriceList = {
  "name": "standard",
  "entries": []
}

global vatRate: number = 0.20

global rounding: (Money) -> Money = roundHalfUp
```

Relations:
- 1..1 "belongs to" relation with a module
- 1..1 "is typed by" relation with a type
- 1..1 "is initialized with" relation with a literal value, or an operation when the type is a function type (shall conform to the type)
- 0..n "read by" relation with operations (derived from operations' `reads` declarations)
- 0..n "written by" relation with operations (derived from operations' `writes` declarations)

## Operation

An operation is a **signature with declared needs and guarantees**: a name, typed arguments, at most one typed return, declared error signatures, and — beyond the signature — a complete declaration of what it needs:

- **depends on** — the other operations it calls upon to do its job;
- **reads** — the global bindings whose value it consults, and, for an attached operation, the receiver fields it reads;
- **writes** — the global bindings it mutates, and, for an attached operation, the receiver fields it mutates.

These declarations are **closed-world**: an operation shall declare *every* operation it directly depends on and *every* global binding or receiver field it directly reads or writes. Nothing is accessed that is not declared. Transitive access is not re-declared — it is derivable by walking the dependency graph, which is the point: the direct declarations plus the graph give complete effect information for free.

An operation carries no body. What it may carry instead is a description of its processing at one of three levels — prose, contract, flow — defined in [Describing processing](#describing-processing). None of the three is a computation.

An operation with no return type exists for its effects; such an operation shall declare at least one `writes` — an operation with neither a return nor a write does nothing observable and shall not exist.

Relations:
- 1..1 "belongs to" relation with a module
- 0..1 "attached to" relation with a struct (see [Attachment](#attachment))
- 0..n "has" relation with arguments (each argument: a name and a type)
- 0..1 "returns" relation with a type
- 0..n "declares" relation with error signatures
- 0..n "depends on" relation with other operations (`declared` or `candidate`; under `strict`, shall form a DAG — see [Dependency graph](#dependency-graph))
- 0..n "reads" relation with global bindings and receiver fields
- 0..n "writes" relation with global bindings and receiver fields
- 0..n "requires" relation with preconditions
- 0..n "ensures" relation with postconditions
- 0..1 "describes its processing with" relation with a flow
- 0..1 "implements" relation with a domain operation (implicit by naming or explicit)

**Example.**

```
operation quotePrice(productId: string, quantity: number): Money
  errors {
    UnknownProduct
  }
  depends on { findPriceEntry, applyVat }
  reads { vatRate }
  requires { quantity > 0 }

operation registerDiscount(productId: string, rate: number)
  errors {
    UnknownProduct
    InvalidRate(min: number, max: number)
  }
  depends on { findPriceEntry }
  writes { standardPriceList }
  requires { rate >= 0 and rate <= 1 else InvalidRate }
  implements pricing.GrantProductDiscount
```

### Attachment

An operation may be **attached** to a struct: it is then a method of that struct, and within its clauses and predicates `_` denotes the receiver instance. Attachment is declared in one of two ways:

- **by nesting** — the operation is written inside the struct's block. Its lexical parent and its attachment are the same struct.
- **by the `on` clause** — the operation is written at module level (or inside another struct) with `on StructName` after its return type. Its lexical parent is where it is written; its attachment is the named struct. This is how an extension method, a receiver method declared in a separate file, or a Clojure `extend-type` is described without moving it.

A nested operation without `on` is attached to its enclosing struct. A nested operation *with* `on` is attached to the named struct, not the enclosing one — this is the one case where containment and attachment diverge, and the model keeps both.

An attached operation is referenced from elsewhere by `Struct.operation` (`PriceEntry.effectivePrice`), qualified by module when it crosses a module boundary. Inside the struct it is attached to, the unqualified name suffices.

An attached operation may declare receiver fields in `reads` and `writes` as `_.field` paths. Under the closed-world rule, an attached operation that mutates its receiver shall say so, field by field.

Relations:
- 0..1 "attached to" relation with a struct
- 1..1 "lexically contained in" relation with a module or a struct

### Error signature

An error signature declares a named failure mode of an operation, with an optional data payload describing what accompanies the failure. Errors are part of the signature — a caller knows every way an operation can fail by reading its declaration, without any body to inspect.

The payload, when present, is a map of named typed fields (or a struct reference), following the same type language as everything else.

An error signature may be **bound to a precondition**: `requires { p else E }` states that the violation of `p` is signalled as `E` (see [Level 1 — Contract](#level-1--contract)). An error not bound to any precondition is raised on a condition the contract does not express — typically a failure discovered by a dependency, such as `UnknownProduct` surfacing from `findPriceEntry`.

When an operation implements a domain operation, its error signatures correspond to the domain's error events: an error raised by the implementing operation surfaces as the matching Error Event in the domain model (see DOMAIN-METAMODEL.md, Error Event). The correspondence follows the same implicit-by-naming rule as `implements`.

Relations:
- 1..1 "belongs to" relation with an operation
- 0..1 "carries" relation with a payload type
- 0..n "signals the violation of" relation with preconditions
- 0..1 "corresponds to" relation with a domain error event (implicit by naming or explicit)

### Describing processing

An operation never has a body, but it does need to say what it does. The metamodel offers three levels, each optional, each strictly more constrained than the previous, and each analyzable to the degree it is constrained. Pseudo-code is deliberately absent: it has no grammar to check against, no semantics two readers agree on, and it duplicates the real body one abstraction level up.

| Level | Construct | Checkable | Says |
|---|---|---|---|
| 0 | `:: "description"` | no | why the operation exists and the rationale behind its rules |
| 1 | `requires` / `ensures` | yes | what must hold before the call and what is guaranteed after |
| 2 | `flow` | yes | which declared operations are called with what, in what order, and where the failure exits are |

**Level 1 is the default.** Every operation that implements a domain operation, and every operation that writes, should carry a contract. Level 2 is for orchestrating operations — those whose value lies in the sequence of calls they make, typically application-service operations with several dependencies. Level 0 is for the reason behind a rule, which no predicate expresses. A leaf operation such as `applyVat` may legitimately carry none of the three: its signature and its `reads` already say everything a description language should.

#### Level 0 — Description

The description every concept carries (the `::` operator). One or two sentences of intent: *"Rounds half-up because the ledger does."* It is the right place for rationale and the wrong place for sequence — *"first we look up the entry, then we apply VAT"* is a flow written in a form nothing can check, and belongs at level 2.

#### Level 1 — Contract

A contract is a set of **preconditions** (`requires`) and **postconditions** (`ensures`), each a predicate in the [state predicate language](#state) with a wider set of roots in scope:

| Root | In scope in | Denotes |
|---|---|---|
| an argument name | `requires`, `ensures`, flow guards | the argument's value at the call |
| `_` | attached operations only | the receiver instance (its state after the call, in `ensures`) |
| a global in `reads` or `writes` | `requires`, `ensures`, flow guards | the global's value (after the call, in `ensures`) |
| `result` | `ensures` only | the returned value |
| `old(_)`, `old(g)` | `ensures` only | the receiver's or the global's value before the call |

A **precondition** is an obligation on the caller. It may be bound to an error signature with `else`: `requires { rate >= 0 and rate <= 1 else InvalidRate }` states that the operation checks the condition and signals `InvalidRate` when it fails. A precondition without `else` is a pure contract — its violation is a caller defect, not a signalled failure. Every error named by an `else` shall be declared in the operation's `errors`.

A **postcondition** is a guarantee. It relates the result, the receiver and the written globals after the call to the arguments and to the `old` values before it. It may only mention globals the operation declares in `reads` or `writes`, and `old` may only be applied to `_` or to a global in `writes` — there is no "before" to speak of for anything else.

Contracts mirror the domain model's preconditions and postconditions on operations (see DOMAIN-METAMODEL.md, Precondition and postcondition). When an operation implements a domain operation, the two contracts should be compatible: the implementing precondition no stronger, the implementing postcondition no weaker. Contract compatibility is a traceability audit, not a parse-time rule.

**Example.**

```
operation registerDiscount(productId: string, rate: number)
  errors {
    UnknownProduct
    InvalidRate(min: number, max: number)
  }
  depends on { findPriceEntry }
  writes { standardPriceList }
  requires {
    rate >= 0 and rate <= 1 else InvalidRate
  }
  ensures {
    standardPriceList.name = old(standardPriceList).name
  }
```

Relations (precondition):
- 1..1 "belongs to" relation with an operation
- 1..1 "is defined by" relation with a predicate over the arguments, the receiver and the readable globals
- 0..1 "signals" relation with an error signature (`else`)

Relations (postcondition):
- 1..1 "belongs to" relation with an operation
- 1..1 "is defined by" relation with a predicate over the result, the arguments, the receiver, the declared globals and their `old` values

#### Level 2 — Flow

A flow is an **ordered list of steps** describing the calls an operation makes. It is a sequence diagram in text, not an algorithm. Every step is one of exactly four forms:

| Step | Form | Meaning |
|---|---|---|
| bind | `name = callee(args)` | call a declared dependency and name its result |
| write | `write target = value [when p]` | store a value into a global or a receiver field |
| raise | `raise Error(payload) [when p]` | signal a declared error |
| return | `return value` | end with the named value |

Where `callee` is an operation of the model — module-level, `Struct.op`, `binding.op(…)` for a method on a bound value, `_.op(…)` for a method on the receiver, or a function-valued global — and every argument, value or payload field is a **name in scope** (a parameter, an earlier binding, `_`, a global in `reads`), a dot-path from one, or a literal.

Two rules keep a flow a description rather than a program:

- **No expressions.** A flow computes nothing: there is no arithmetic, no comparison outside a guard, no construction of values except by calling an operation that returns one. If a computation matters enough to mention, it gets a name and becomes an operation. This is a feature: it forces the decomposition into the open, where the dependency graph can see it.
- **The happy path is straight-line.** A `when` guard is legal only on `write` and `raise` steps. A bind step is never conditional and there is no branch, loop or alternative on the success path. If the success path genuinely branches, the branch lives inside a callee. Guarded failure exits are the one piece of control flow worth keeping, because they are exactly what a `throws` edge with a source anchor is evidence of.

**Agreement with the clauses.** When a flow is present, the operation's `depends on`, `reads`, `writes` and `errors` are **derivable from it**: every callee is a dependency, every `write` target is a write, every name read is a read, every `raise` is an error. The declared clauses and the flow shall agree — a callee absent from `depends on`, or a declared dependency the flow never calls, is a defect. In practice the writer keeps the clauses and lets the tool check them, or omits them and lets the tool fill them in.

**Extraction.** A flow is what static analysis can honestly recover from a body: the outgoing invocations in source order give the bind steps, the assignments to globals and fields give the write steps, the throw sites give the raise steps. What it cannot recover — the branching of the success path — is what the `observed` level reports as a finding rather than smuggles into the flow as a guard.

**Example.**

```
operation quotePrice(productId: string, quantity: number): Money
  errors { UnknownProduct }
  depends on { findPriceEntry, PriceEntry.effectivePrice, scale, applyVat }
  reads { vatRate }
  requires { quantity > 0 }
  ensures  { result.currency = "EUR" }
  flow {
    entry = findPriceEntry(productId)
    unit  = entry.effectivePrice()
    gross = scale(unit, quantity)
    net   = applyVat(gross, vatRate)
    return net
  }

operation registerDiscount(productId: string, rate: number)
  errors { UnknownProduct, InvalidRate(min: number, max: number) }
  depends on { findPriceEntry, withDiscount }
  reads { standardPriceList }
  writes { standardPriceList }
  requires { rate >= 0 and rate <= 1 else InvalidRate }
  flow {
    raise InvalidRate(min: 0, max: 1) when rate < 0 or rate > 1
    entry = findPriceEntry(productId)
    write standardPriceList = withDiscount(standardPriceList, entry, rate)
  }
```

Reading the second flow: `UnknownProduct` never appears in a `raise`, yet it is a declared error — it surfaces from `findPriceEntry`. A flow declares the failures the operation *itself* signals; failures propagated from dependencies are declared in `errors` and derivable from the callees' signatures.

Relations (flow):
- 1..1 "belongs to" relation with an operation
- 1..n "consists of" relation with steps, ordered
- 0..n "calls" relation with operations (derived: one `invokes` edge per bind step)
- 0..n "writes" relation with globals and receiver fields (derived: one `accesses` edge per write step)
- 0..n "raises" relation with error signatures (derived: one `throws` edge per raise step)

### Dependency graph

The `depends on` declarations of all operations — together with the callees of every flow, which shall agree with them — form the model's dependency graph.

A dependency may be marked **uncertain** with a trailing `?`: `depends on { render?, renderHtml?, renderPdf? }`. An uncertain dependency records that the call site was observed but its target could not be resolved to a single operation — dispatch through an interface, a dynamic call, a function-valued global whose current value is unknown. Its edge carries the `candidate` provenance. Uncertain dependencies are **`observed` only**: a designed model commits to what it calls.

Under `strict` the graph shall be **acyclic**: no operation depends on itself, directly or transitively — recursion and mutual recursion are not expressible. Together with the closed-world declaration rule, acyclicity makes the model fully analyzable by topological traversal:

- **Effective reads/writes** of an operation = its declared reads/writes ∪ the effective reads/writes of everything it depends on.
- **Effective errors** of an operation = its declared errors, which shall include every error its dependencies can surface that it does not itself handle. The model does not express handling; the declared set is the caller's contract.
- **Impact of changing a struct or global** = the reverse reachability set in the graph.
- **Build/evaluation order** = any topological order of the graph.

Under `observed` a cycle is a **finding**, reported with the operations on it, and the analyses above are computed on the condensation of the graph (strongly connected components collapsed) so that they remain well-defined.

Constraints:
- Under `strict`, the operation dependency graph shall be acyclic; under `observed`, a cycle is a finding.
- An operation shall declare every operation it directly depends on (no undeclared calls).
- An operation shall declare every global binding and receiver field it directly reads or writes (no ambient state access).
- When a flow is present, its callees, write targets, read names and raised errors shall agree with the declared clauses.
- `?` shall not appear in a `strict` model.

## Traceability to the Domain model

The Data & Operation model is linked to the domain model through optional, per-element `implements`/`represents`/`corresponds to` relations. Each relation is implicit when names match (see [Convention](#convention)) and explicit otherwise; explicit declarations always override the naming presumption. All links are optional — a model may describe purely technical machinery with no domain counterpart.

| Data & Operation concept | Domain concept | Relation | Implicit rule |
|---|---|---|---|
| Model | Bounded context / organization | implements | model name matches context shortname |
| Module | Module | implements | same module name |
| Struct | Entity, value type, or enum | represents | same name (`Money` ↔ value `Money`) |
| Operation | Operation | implements | same name, case-style ignored (`reserveStock` ↔ `ReserveStock`); an attached operation matches an operation owned by the represented entity |
| Precondition / postcondition | Precondition / postcondition | refines | via the enclosing operation's `implements`; compatibility audited, not presumed |
| Error signature | Error event | corresponds to | same name |

Traceability is directional: the Data & Operation model points at the domain model, never the reverse — the domain model remains free of implementation concerns. Coverage questions ("which domain operations have no implementing operation?") are answered by inverting the links mechanically. Because an `observed` model carries the same links, the same inversion answers "which domain operations does the code not implement?" directly from an extraction.

## Worked example: a designed model (strict)

A single-module model implementing part of a pricing domain module. The level is `strict` by default; the header could equally say so.

```
model pricing-engine implements pricing {

  module pricing {

    struct Money {
      schema {
        amount:   number
        currency: string
      }
    }

    struct PriceEntry {
      schema {
        productId:    string
        unitPrice:    Money
        discountRate: number?
      }

      state {
        "discounted" : _.discountRate is not null
        "full price" : _.discountRate is null
      }

      operation effectivePrice(): Money
        :: "The unit price after discount, before VAT."
        depends on { discount }
        reads { _.unitPrice, _.discountRate }
        ensures { result.currency = _.unitPrice.currency }
    }

    struct PriceList {
      schema {
        name:    string
        entries: vector<PriceEntry>
      }
    }

    global standardPriceList: PriceList = {
      "name": "standard",
      "entries": []
    }

    global vatRate: number = 0.20

    global rounding: (Money) -> Money = roundHalfUp
      :: "Rounds half-up because the ledger does."

    operation roundHalfUp(price: Money): Money
      ensures { result.currency = price.currency }

    operation discount(price: Money, rate: number?): Money
      ensures { result.currency = price.currency }

    operation scale(price: Money, factor: number): Money
      requires { factor > 0 }
      ensures  { result.currency = price.currency }

    operation applyVat(price: Money, rate: number): Money
      depends on { roundHalfUp }
      reads { rounding }
      ensures { result.currency = price.currency }

    operation findPriceEntry(productId: string): PriceEntry
      errors { UnknownProduct }
      reads { standardPriceList }
      ensures { result.productId = productId }

    operation withDiscount(list: PriceList, entry: PriceEntry, rate: number): PriceList
      ensures { result.name = list.name }

    operation quotePrice(productId: string, quantity: number): Money
      errors { UnknownProduct }
      depends on { findPriceEntry, PriceEntry.effectivePrice, scale, applyVat }
      reads { vatRate }
      requires { quantity > 0 }
      flow {
        entry = findPriceEntry(productId)
        unit  = entry.effectivePrice()
        gross = scale(unit, quantity)
        net   = applyVat(gross, vatRate)
        return net
      }

    operation registerDiscount(productId: string, rate: number)
      errors {
        UnknownProduct
        InvalidRate(min: number, max: number)
      }
      depends on { findPriceEntry, withDiscount }
      reads { standardPriceList }
      writes { standardPriceList }
      requires { rate >= 0 and rate <= 1 else InvalidRate }
      ensures  { standardPriceList.name = old(standardPriceList).name }
      flow {
        raise InvalidRate(min: 0, max: 1) when rate < 0 or rate > 1
        entry = findPriceEntry(productId)
        write standardPriceList = withDiscount(standardPriceList, entry, rate)
      }
      implements pricing.GrantProductDiscount
  }
}
```

Reading the graph: `quotePrice` never declares `standardPriceList` or `rounding`, yet its effective reads include both — derived through `findPriceEntry` and `applyVat`. `applyVat` reads `rounding` and depends on `roundHalfUp`: the read is the call through the function-valued global, the dependency is the operation the global initially holds, and the two agree. `UnknownProduct` raised by `quotePrice` is its own declared error even though the underlying failure originates in `findPriceEntry`: every operation declares the full set of errors it can surface. `registerDiscount` is the only operation that can change any state, and the model says so explicitly — its flow, its `writes` and its postcondition all say the same thing from three angles.

## Worked example: an extracted model (observed)

The same syntax, lowered from a Java codebase by static analysis. Everything the `strict` level forbids is legal here and becomes a finding: the opaque field, the uncertain dispatch, the cycle between `bill` and `render`. Every declaration carries its evidence.

```
model order-service observed implements ordering {

  external module java.util
  external struct java.util.List
  external struct java.util.Map

  module com.acme.order {

    struct Money {
      // source: src/main/java/com/acme/order/Money.java:8-40
      schema {
        amount:   number
        currency: string
      }
    }

    struct OrderLine {
      // source: src/main/java/com/acme/order/OrderLine.java:10-52
      schema {
        productId: string
        qty:       number
        unitPrice: Money
      }

      operation subtotal(): Money
        // source: src/main/java/com/acme/order/OrderLine.java:38-44
        reads { _.qty, _.unitPrice }
    }

    struct Order represents ordering.Order {
      // source: src/main/java/com/acme/order/Order.java:14-88
      schema {
        id:    string
        lines: vector<OrderLine>
        meta:  opaque "java.util.Map<String, Object>"
      }

      operation total(): Money
        // source: src/main/java/com/acme/order/Order.java:52-61
        depends on { OrderLine.subtotal }
        reads { _.lines }
        // FINDING: body iterates over `_.lines` (cyclomatic 2); no straight-line flow can show it

      operation addLine(line: OrderLine)
        // source: src/main/java/com/acme/order/Order.java:63-67
        writes { _.lines }

      operation addLine(productId: string, qty: number)
        // source: src/main/java/com/acme/order/Order.java:69-74
        depends on { addLine(OrderLine) }
        writes { _.lines }
    }

    struct Invoice {
      // source: src/main/java/com/acme/order/Invoice.java:9-33
      schema {
        orderId: string
        total:   Money
      }
    }

    global invoices: vector<Invoice> = []
      // source: src/main/java/com/acme/order/OrderService.java:22

    operation bill(order: Order): Invoice
      // source: src/main/java/com/acme/order/OrderService.java:40-77
      errors { PaymentDeclined corresponds to ordering.PaymentRefused }
      depends on { Order.total, render? }
      reads { invoices }
      writes { invoices }
      flow {
        amount  = order.total()
        // FINDING: `Renderer.render` dispatched through an interface; two implementations in scope
        raise PaymentDeclined when amount.amount > 10000
      }
      // FINDING: cycle bill -> render -> bill

    operation render(invoice: Invoice): string on Invoice
      // source: src/main/java/com/acme/order/InvoiceRenderer.java:18-45
      depends on { bill? }
  }
}
```

Three of the findings are what an `observed` validation reports on this file: the cycle, the two `candidate` dependencies, and the loop in `total` that no straight-line flow can show. Tightening the model into `strict` means resolving each — replacing the interface dispatch with the concrete callee or a function-valued global, breaking the cycle, replacing `opaque` with the shape actually used, and lifting the loop into a named operation (`sumSubtotals(lines: vector<OrderLine>): Money`) so the flow can call it. Each of those is a design decision the extraction surfaced rather than made.
