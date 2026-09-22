#!/usr/bin/env python3
"""specy-SysReq-metamodel.svg — the System Requirement metamodel (SYSTEM-REQ-METAMODEL.md)."""
import sys
from metamodel_diagram import Diagram

d = Diagram(["System Requirement", "Metamodel"], "Specy System Requirement Metamodel", height=1440, seed=23)
B, E = d.box, d.edge

# --- left: scope, requirement set, the requirement hub, provenance and relations
B("scope", 60, 300, "Bounded Context\nor Organization", w=320, sub="scope of a set and its requirements", anchor="scoping")
B("reqset", 60, 560, "Requirement Set", w=380, kind="hub", sub="prd-source (path to the PRD file)", anchor="requirement-set")
B("module", 60, 820, "Module", w=320, sub="the domain module whose interface realizes the set", anchor="requirement-set")
B("requirement", 540, 700, "Requirement", w=380, kind="hub", sub=["REQ-XXX-NNN · Statement, Pattern,", "Rationale, Priority (MoSCoW)"])
B("prdelem", 340, 1000, "PRD Element", w=300, sub="Feature FEAT-NNN, User Story US-NNN, Acceptance Criterion AC-NNN-NN, Goal, Constraint", anchor="requirement")
B("related", 680, 1000, "Related\nRequirement", w=300, sub="depends on, conflicts with, decomposed into", anchor="requirement")

# --- middle column: what a requirement is made of (fan-out from the hub)
B("ears", 1040, 250, "EARS Statement", w=360, sub=["[While <precondition>,]", "[When | If | Where <trigger>,]", "the <system> shall <response>."], anchor="ears--easy-approach-to-requirements-syntax")
B("pattern", 1040, 454, "Pattern", w=360, sub="one of the six EARS patterns", anchor="ears-patterns")
B("priority", 1040, 602, "Priority", w=360, sub="must, should, could, wont", anchor="requirement")
B("nfr", 1040, 750, "Non-functional\nRequirement", w=360, sub="same EARS syntax: constrains how well, not what", anchor="non-functional-requirements")
B("crosscut", 1040, 960, "Cross-cutting NFR", w=360, sub="scoped to the organization, decomposed into context-level obligations", anchor="cross-cutting-nfrs--scoping-beyond-a-single-bounded-context")
B("domain", 1040, 1136, "Domain Element", w=360, sub="satisfies REQ-… (declared on the domain side); the role is derived", anchor="traceability")
B("loop", 1040, 1312, "Verification Loop", w=360, anchor="integration-with-verification-loops")

# --- right: the EARS ruleset parts (in sentence order)
for i, (k, label, sub) in enumerate((("precond", "Precondition", "While … — 0..n (three at most)"),
                                      ("trigger", "Trigger", "When | If | Where … — 0..1"),
                                      ("sysname", "System Name", "the <system name> — exactly 1"),
                                      ("response", "System Response", "shall … — 1..n"))):
    B(k, 1480 + i * 274, 278, label, w=262, sub=sub, anchor="the-ears-ruleset")
# --- the six patterns
pats = (("ubiquitous", "Ubiquitous", "no keyword", "ubiquitous"),
        ("statedriven", "State-driven", "While", "state-driven-while"),
        ("eventdriven", "Event-driven", "When", "event-driven-when"),
        ("unwanted", "Unwanted Behavior", "If … then", "unwanted-behavior-if-then"),
        ("optional", "Optional Feature", "Where", "optional-feature-where"),
        ("complex", "Complex", "While + When | If | Where", "complex"))
for i, (k, label, sub, anchor) in enumerate(pats):
    B(k, 1480 + (i % 3) * 360, 454 + (i // 3) * 106, label, w=340, sub=sub, anchor=anchor)
# --- NFR categories
cats = ("Performance", "Reliability", "Security", "Operability", "Scalability", "Compliance", "Resilience")
for i, c in enumerate(cats):
    B("cat_" + c.lower(), 1480 + (i % 4) * 270, 770 + (i // 4) * 86, c, w=250, anchor="nfr-categories-and-their-domain-anchors")
B("ctxreq", 1480, 960, "Context-level Requirement", w=400, sub="a derived obligation, scoped to its bounded context", anchor="decomposition-into-context-level-obligations")
# --- satisfaction roles
roles = ("structured-by", "enforced-by", "implemented-by", "detected-by", "reconciled-by", "quality-constrained-by", "satisfied-by-infrastructure")
for i, r in enumerate(roles):
    B("role_" + r, 0, 1136 + (0 if i < 4 else 86), r, anchor="satisfaction-roles")
d.row([f"role_{r}" for r in roles[:4]], 1480, gap=20); d.row([f"role_{r}" for r in roles[4:]], 1480, gap=20)
# --- verification loops
for i, l in enumerate(("Build", "Check", "Observe")):
    B("loop_" + l.lower(), 1480 + i * 270, 1312, l, w=250, sub={"Build": "intent → code", "Check": "code → intent", "Observe": "runtime → intent"}[l],
      anchor="integration-with-verification-loops")

# --- edges
E("reqset", "scope", "1", src_side="top", dst_side="bottom", src_t=0.4, dst_t=0.6)
E("reqset", "module", "0..1", src_side="bottom", dst_side="top", src_t=0.4, dst_t=0.5)
E("reqset", "requirement", "1..n", src_t=0.5, dst_t=0.5)
E("requirement", "prdelem", "0..1", src_side="bottom", dst_side="top", src_t=0.3, dst_t=0.5)
E("requirement", "related", "0..n", src_side="bottom", dst_side="top", src_t=0.7, dst_t=0.5)
E("requirement", "ears", "1", src_t=0.5)
E("requirement", "pattern", "1", src_t=0.5)
E("requirement", "priority", "1", src_t=0.5)
E("requirement", "nfr", None, src_t=0.5)
E("requirement", "crosscut", None, src_t=0.5)
E("requirement", "domain", "0..n", src_t=0.5)
E("requirement", "loop", None, src_t=0.5)
E("ears", "response", None, straight=True)                  # bus behind the four parts, in sentence order
E("pattern", "eventdriven", None, dst_t=0.5)                 # bus behind the first row of patterns
E("pattern", "complex", None, dst_t=0.5)                     # ... and the second
E("nfr", "cat_operability", None, dst_t=0.5)
E("nfr", "cat_resilience", None, dst_t=0.5)
E("crosscut", "ctxreq", "1..n")
E("domain", "role_detected-by", None, dst_t=0.5)
E("domain", "role_satisfied-by-infrastructure", None, dst_t=0.5)
E("loop", "loop_observe", None, straight=True)

d.write(sys.argv[1] if len(sys.argv) > 1 else "specy-SysReq-metamodel.svg")
