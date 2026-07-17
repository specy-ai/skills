<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Data & Operation model metamodel](#data--operation-model-metamodel)
  - [Convention](#convention)
  - [Model](#model)
  - [Module](#module)
  - [Data](#data)
    - [Type](#type)
    - [Schema](#schema)
  - [Global Binding](#global-binding)
  - [Operation](#operation)
    - [Error signature](#error-signature)
    - [Dependency graph](#dependency-graph)
  - [Traceability to the Domain model](#traceability-to-the-domain-model)
  - [Worked example](#worked-example)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->




# Data & Operation model metamodel

This file defines a foundational representation for describing data structures, operation signatures, and global variable bindings. It is a **description language**, not a programming language: there are no statements, no expressions, no control structures (no branching, no loops). A Data & Operation model describes *what data exists*, *what operations exist over that data*, and *what each operation needs* — other operations, global state — to do its job. How an operation computes its result is deliberately out of scope.

The Data & Operation model is the "how substrate" beneath the domain model (see DOMAIN-METAMODEL.md). Where the domain model captures business intent — entities, aggregates, commands, events — the Data & Operation model captures the structural skeleton of an implementation: concrete data shapes and the dependency graph of the operations that realize domain behavior. The two models are linked through optional, traceable `implements` relations (see [Traceability to the Domain model](#traceability-to-the-domain-model)).

Because the model is purely declarative and its two graphs (schema references and operation dependencies) are required to be acyclic, it is mechanically analyzable: topological ordering, impact analysis, dead-code detection, and effect propagation are all decidable by simple graph traversal.

## Convention

Every concept in this metamodel carries a name, a description, and a metadata map (a set of arbitrary key/value pairs). These attributes are implicit and not repeated in each definition below.

**Naming**: schema names use `PascalCase` (`Money`, `PriceEntry`). Operation names, global binding names, and field names use `camelCase` (`reserveStock`, `exchangeRates`, `unitPrice`). Error signature names use `PascalCase` (`InsufficientStock`), mirroring the domain model's error event naming.

**Implicit implementation by naming**: when a Data & Operation model element and a domain model element share the same name (compared case-insensitively, ignoring case-style differences such as `reserveStock` vs `ReserveStock`) within corresponding modules, the `implements` relation is presumed without being declared. An explicit `implements` declaration is only needed when names diverge — and it always wins over the naming presumption.

Illustrative concrete syntax appears throughout in fenced blocks. It is a **sketch**, not a normative grammar: no `.ebnf` is paired with this metamodel yet, and the sketched notation may evolve when a formal grammar is written.

## Model

A Data & Operation model is the top-level container. It groups modules and optionally anchors the whole model to the domain layer it implements.

Relations:
- 1..n "contains" relation with modules
- 0..1 "implements" relation with a domain bounded context or organization (the domain scope this model realizes)

## Module

A module is the unit of decomposition, mirroring the domain model's module concept. A module groups schemas, global bindings, and operations that belong together. References that cross a module boundary shall be qualified with the module name (`pricing.Money`).

A module's dependencies are **derived**, never declared: module A depends on module B when any schema, global binding, or operation of A references an element of B. The derived module dependency graph shall be acyclic — this follows from, and is checked alongside, the acyclicity of the schema reference graph and the operation dependency graph.

Relations:
- 1..1 "belongs to" relation with a model
- 0..n "declares" relation with schemas
- 0..n "declares" relation with global bindings
- 0..n "declares" relation with operations
- 0..n "depends on" relation with other modules (derived from element references, shall be acyclic)
- 0..1 "implements" relation with a domain module (implicit by naming or explicit)

## Data

Data in a Data & Operation model is JSON-like: the same scalar values as JSON, composed with vectors and maps. There are exactly five type constructors and no others — no unions, no inheritance, no generics beyond the vector element type.

### Type

A type is one of the following constructors:

| Constructor | Form | Meaning |
|---|---|---|
| Scalar | `string`, `number`, `boolean` | The JSON scalar values. `number` covers integers and decimals alike, as in JSON. |
| Vector | `vector<T>` | An ordered sequence whose elements all conform to the single element type `T`. Vectors are homogeneous — a vector shall not mix element types. |
| Map | `{ field: T, … }` | A record of named fields, each with its own type. **Every field is required** — there are no optional fields. |
| Schema reference | `SchemaName` | A reference to a previously defined [schema](#schema), possibly qualified (`pricing.Money`). |
| Nullable marker | `T?` | Admits `null` in addition to the values of `T`. `null` is not a standalone type — it exists only through this marker. Applicable to any type. |

Constraints:
- A type shall not be a union: a field, argument, return, or vector element has exactly one type.
- Absence of a value shall be expressed with the nullable marker, never by omitting a field: a map value always carries all declared fields, some of which may hold `null` when their type is nullable.

The type language is deliberately closed. Its purpose is to make every data shape in the model fully explicit and structurally comparable — two types are the same exactly when their constructor trees are the same.

### Schema

A schema is a **named type definition**: a name bound to a type, almost always a map type. Schemas are the vocabulary of the model — arguments, returns, error payloads, and global bindings refer to data shapes by schema name rather than repeating structural types.

Constraints:
- A schema shall only reference **previously defined** schemas. There are no forward references and no recursion — a schema shall not reference itself directly or transitively. The schema reference graph is therefore a DAG, and every value described by the model is finite by construction.
- A schema name shall be unique within its module.

**Example.**

```
schema Money {
  amount: number
  currency: string
}

schema PriceEntry {
  productId: string
  unitPrice: Money
  discountRate: number?
}

schema PriceList {
  name: string
  entries: vector<PriceEntry>
}
```

Relations:
- 1..1 "belongs to" relation with a module
- 1..1 "is defined by" relation with a type
- 0..n "references" relation with previously defined schemas (shall form a DAG, no self-reference)
- 0..1 "represents" relation with a domain entity, value type, or enum (implicit by naming or explicit)

## Global Binding

A global binding is a **named, mutable, typed variable** at module level. It declares a piece of shared state that operations may read or write. A global binding has exactly one type and exactly one **initial value** — a literal, written in JSON notation, that shall conform to the declared type. The model therefore fully describes the starting state of the world.

Global bindings are mutable, but mutation is never ambient: a global binding changes only through operations that explicitly declare it in their `writes` list (see [Operation](#operation)). Which operations touch which globals is thus a total, declared fact — the read/write access matrix of the model is closed and analyzable.

**Example.**

```
global standardPriceList: PriceList = {
  "name": "standard",
  "entries": []
}

global vatRate: number = 0.20
```

Relations:
- 1..1 "belongs to" relation with a module
- 1..1 "is typed by" relation with a type
- 1..1 "is initialized with" relation with a literal value (shall conform to the type)
- 0..n "read by" relation with operations (derived from operations' `reads` declarations)
- 0..n "written by" relation with operations (derived from operations' `writes` declarations)

## Operation

An operation is a **pure signature**: a name, typed arguments, at most one typed return, and declared error signatures. An operation carries no body — no algorithm, no control flow, no expressions. What it does carry, beyond its signature, is a complete declaration of what it needs:

- **depends on** — the other operations it calls upon to do its job;
- **reads** — the global bindings whose value it consults;
- **writes** — the global bindings it mutates.

These declarations are **closed-world**: an operation shall declare *every* operation it directly depends on and *every* global binding it directly reads or writes. Nothing is accessed that is not declared. Transitive access is not re-declared — it is derivable by walking the dependency graph, which is the point: the direct declarations plus the DAG give complete effect information for free.

An operation with no return type exists for its effects; such an operation shall declare at least one `writes` — an operation with neither a return nor a write does nothing observable and shall not exist.

Relations:
- 1..1 "belongs to" relation with a module
- 0..n "has" relation with arguments (each argument: a name and a type)
- 0..1 "returns" relation with a type
- 0..n "declares" relation with error signatures
- 0..n "depends on" relation with other operations (shall form a DAG, see [Dependency graph](#dependency-graph))
- 0..n "reads" relation with global bindings
- 0..n "writes" relation with global bindings
- 0..1 "implements" relation with a domain operation (implicit by naming or explicit)

**Example.**

```
operation quotePrice(productId: string, quantity: number): Money
  errors {
    UnknownProduct
  }
  depends on { findPriceEntry, applyVat }
  reads { vatRate }

operation registerDiscount(productId: string, rate: number)
  errors {
    UnknownProduct
    InvalidRate(min: number, max: number)
  }
  depends on { findPriceEntry }
  writes { standardPriceList }
  implements pricing.GrantProductDiscount
```

### Error signature

An error signature declares a named failure mode of an operation, with an optional data payload describing what accompanies the failure. Errors are part of the signature — a caller knows every way an operation can fail by reading its declaration, without any body to inspect.

The payload, when present, is a map of named typed fields (or a schema reference), following the same type language as everything else.

When an operation implements a domain operation, its error signatures correspond to the domain's error events: an error raised by the implementing operation surfaces as the matching Error Event in the domain model (see DOMAIN-METAMODEL.md, Error Event). The correspondence follows the same implicit-by-naming rule as `implements`.

Relations:
- 1..1 "belongs to" relation with an operation
- 0..1 "carries" relation with a payload type
- 0..1 "corresponds to" relation with a domain error event (implicit by naming or explicit)

### Dependency graph

The `depends on` declarations of all operations form the model's dependency graph. This graph shall be **acyclic**: no operation depends on itself, directly or transitively — recursion and mutual recursion are not expressible. Together with the closed-world declaration rule, acyclicity makes the model fully analyzable by topological traversal:

- **Effective reads/writes** of an operation = its declared reads/writes ∪ the effective reads/writes of everything it depends on.
- **Impact of changing a schema or global** = the reverse reachability set in the graph.
- **Build/evaluation order** = any topological order of the graph.

Constraints:
- The operation dependency graph shall be acyclic.
- An operation shall declare every operation it directly depends on (no undeclared calls).
- An operation shall declare every global binding it directly reads or writes (no ambient state access).

## Traceability to the Domain model

The Data & Operation model is linked to the domain model through optional, per-element `implements`/`represents`/`corresponds to` relations. Each relation is implicit when names match (see [Convention](#convention)) and explicit otherwise; explicit declarations always override the naming presumption. All links are optional — a model may describe purely technical machinery with no domain counterpart.

| Data & Operation concept | Domain concept | Relation | Implicit rule |
|---|---|---|---|
| Model | Bounded context / organization | implements | model name matches context shortname |
| Module | Module | implements | same module name |
| Schema | Entity, value type, or enum | represents | same name (`Money` ↔ value `Money`) |
| Operation | Operation | implements | same name, case-style ignored (`reserveStock` ↔ `ReserveStock`) |
| Error signature | Error event | corresponds to | same name |

Traceability is directional: the Data & Operation model points at the domain model, never the reverse — the domain model remains free of implementation concerns. Coverage questions ("which domain operations have no implementing operation?") are answered by inverting the links mechanically.

## Worked example

A single-module model implementing part of a pricing domain module:

```
model pricing-engine implements pricing {

  module pricing {

    schema Money {
      amount: number
      currency: string
    }

    schema PriceEntry {
      productId: string
      unitPrice: Money
      discountRate: number?
    }

    schema PriceList {
      name: string
      entries: vector<PriceEntry>
    }

    global standardPriceList: PriceList = {
      "name": "standard",
      "entries": []
    }

    global vatRate: number = 0.20

    operation findPriceEntry(productId: string): PriceEntry
      errors {
        UnknownProduct
      }
      reads { standardPriceList }

    operation applyVat(price: Money): Money
      reads { vatRate }

    operation quotePrice(productId: string, quantity: number): Money
      errors {
        UnknownProduct
      }
      depends on { findPriceEntry, applyVat }

    operation registerDiscount(productId: string, rate: number)
      errors {
        UnknownProduct
        InvalidRate(min: number, max: number)
      }
      depends on { findPriceEntry }
      writes { standardPriceList }
      implements pricing.GrantProductDiscount
  }
}
```

Reading the graph: `quotePrice` never declares `standardPriceList` or `vatRate`, yet its effective reads include both — derived through `findPriceEntry` and `applyVat`. `UnknownProduct` raised by `quotePrice` is its own declared error even though the underlying failure originates in `findPriceEntry`: every operation declares the full set of errors it can surface. `registerDiscount` is the only operation that can change any state, and the model says so explicitly.
