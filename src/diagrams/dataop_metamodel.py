#!/usr/bin/env python3
"""specy-DataOp-metamodel.svg — the Data & Operation metamodel (DATA-OPERATION-METAMODEL.md)."""
import sys
from metamodel_diagram import Diagram

d = Diagram(["Data & Operation", "Metamodel"], "Specy Data & Operation Metamodel", seed=43)
B, E = d.box, d.edge

# --- left: the containment chain (model → module → declarations) and the trait vocabulary
B("model", 60, 250, "Model", w=300, kind="hub", sub="strict | observed; implements a bounded context or organization", anchor="model")
B("module", 60, 560, "Module", w=340, kind="hub", sub="derived dependencies; implements a domain module", anchor="module")
B("external", 60, 800, "External declaration", w=340, sub="external module | external struct — named, never described", anchor="external-declaration")
B("traits", 60, 990, "Trait bundle", w=340,
  sub="Named · Module · Type · WithChildren · ChildOf · AttachedTo · Structural · Typed · WithValue · Invocable · WithStates · WithContract · WithFlow",
  anchor="composition-declarations-as-trait-bundles")

# --- second column: conformance, global state and the operation hub
B("conformance", 440, 230, "Conformance level", w=420, sub="strict (designed) · observed (extracted)", anchor="conformance-levels")
B("global", 440, 460, "Global binding", w=420, kind="hub", sub="typed, mutable, one initial value; a function-typed global holds an operation", anchor="global-binding")
B("operation", 440, 820, "Operation", w=420, kind="hub", sub="signature · depends on · reads · writes — closed-world, no body", anchor="operation")
B("argument", 480, 1040, "Argument", w=170, sub="name: type", anchor="operation")
B("error", 670, 1040, "Error\nsignature", w=170, sub="optional payload", anchor="error-signature")

# --- centre: the struct hub, its parts, and what hangs off an operation
B("struct", 960, 250, "Struct", w=380, kind="hub", sub="schema, states and attached operations; represents an entity, value or enum", anchor="struct")
B("state", 960, 440, "State", w=160, sub="named predicate over the instance _", anchor="state")
B("field", 1140, 440, "Schema field", w=200, sub="name: type — every field required", anchor="struct")
B("attachment", 960, 640, "Attachment", w=380, sub="nested in a struct or declared with on Struct; _ denotes the receiver", anchor="attachment")
B("processing", 960, 840, "Processing description", w=380, sub="level 0 prose · level 1 contract · level 2 flow — never pseudo-code", anchor="describing-processing")
B("depgraph", 960, 1020, "Dependency graph", w=380, sub="depends on + flow callees; strict: acyclic · observed: cycles and ? candidates are findings", anchor="dependency-graph")

# --- fourth column: the three levels of processing description
B("description", 1400, 660, "Description (level 0)", w=360, sub=":: intent and rationale in prose — not checkable", anchor="level-0--description")
B("contract", 1400, 840, "Contract (level 1)", w=360, sub="requires { p else Error } · ensures { result, old(x) } — checkable", anchor="level-1--contract")
B("flow", 1400, 1020, "Flow (level 2)", w=360, sub="ordered steps: bind · write · raise · return — straight-line happy path, no expressions", anchor="level-2--flow")

# --- right: the closed type language, the relation graph and the bridge to the domain model
B("edges", 1900, 250, "Edge kind", w=640, sub="contains · references · invokes · accesses · throws · implements — provenance: declared | derived | candidate", anchor="relations-as-edge-kinds")
B("type", 1900, 470, "Type", w=640, sub="string · number · boolean · vector<T> · { field: T } · Struct · (T) -> R · opaque · T?", anchor="type")
B("domain", 1900, 840, "Domain model traceability", w=640,
  sub="model - bounded context · module - module · struct - entity, value, enum · operation - operation · error - error event; implicit by naming",
  anchor="traceability-to-the-domain-model")

# --- edges
E("model", "conformance", "1", src_t=0.3)
E("model", "module", "1..n", src_side="bottom", dst_side="top", src_t=0.5, dst_t=0.5)
E("module", "external", "0..n", src_side="bottom", dst_side="top", src_t=0.5, dst_t=0.5)
E("module", "struct", "0..n", src_side="top", dst_side="left", src_t=0.97, dst_t=0.7)
E("module", "global", "0..n", src_t=0.5, dst_t=0.75)
E("module", "operation", "0..n", src_t=0.85, dst_t=0.3, card_at="src")
E("struct", "state", "0..n", src_side="bottom", dst_side="top", src_t=0.25, dst_t=0.5)
E("struct", "field", "1..n", src_side="bottom", dst_side="top", src_t=0.8, dst_t=0.5)
E("field", "type", "1", dst_t=0.4)
E("operation", "global", "0..n", src_side="top", dst_side="bottom", src_t=0.5, dst_t=0.5)
E("operation", "argument", "0..n", src_side="bottom", dst_side="top", src_t=0.3, dst_t=0.5)
E("operation", "error", "0..n", src_side="bottom", dst_side="top", src_t=0.7, dst_t=0.5)
E("operation", "attachment", "0..1", src_t=0.2, dst_t=0.5)
E("operation", "processing", "0..1", src_t=0.5, dst_t=0.5)
E("operation", "depgraph", "0..n", src_t=0.85, dst_t=0.5)
E("processing", "description", "0..1", dst_t=0.5)
E("processing", "contract", "0..n", dst_t=0.5)
E("processing", "flow", "0..1", dst_t=0.4)
E("contract", "domain", "0..1", dst_t=0.5)
E("flow", "depgraph", None, src_side="left", dst_side="right", src_t=0.8, dst_t=0.8)

d.write(sys.argv[1] if len(sys.argv) > 1 else "specy-DataOp-metamodel.svg")
