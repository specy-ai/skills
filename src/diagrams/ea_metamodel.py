#!/usr/bin/env python3
"""specy-EA-metamodel.svg — the Enterprise Architecture metamodel (ENTERPRISE-ARCHITECTURE-METAMODEL.md)."""
import sys
from metamodel_diagram import Diagram

d = Diagram(["Enterprise Architecture", "Metamodel"], "Specy Enterprise Architecture Metamodel",
            height=1712, edges="clean")
B, E, G = d.box, d.edge, d.group

BAND = (60, 711, 1362, 2013)     # x of the four slots of a cross-cutting band (boxes 521 wide)
COL = (494, 1046, 1598, 2150)    # x of the four package columns of the chain (boxes 384 wide)
BW, CW = 521, 384

# --- top band: governance, cross-cutting (it constrains every package below)
B("principle", BAND[0], 336, "Principle", w=BW, sub="statement, rationale, implications", anchor="principle")
B("rule", BAND[1], 336, "Rule", w=BW, sub="checkable constraint on a kind of element", anchor="rule")
B("fitness", BAND[2], 280, "Fitness Function", w=BW, sub="repeatable check on models, code or runtime", anchor="fitness-function")
B("waiver", BAND[2], 392, "Waiver", w=BW, sub="time-boxed exception for named elements", anchor="waiver")
B("decision", BAND[3], 336, "Decision", w=BW, sub="context, decision, consequences, status", anchor="decision")

# --- the chain, left to right: the root, then strategy and organization (enterprise scope) ...
B("enterprise", 60, 850, "Enterprise", w=300, kind="hub", sub=["the root; the organization", "of the domain model"], anchor="enterprise")
B("goal", COL[0], 0, "Goal", w=CW, sub=["strategic outcome the enterprise", "pursues, measured, with a horizon"], anchor="goal")
B("capability", COL[0], 0, "Capability", w=CW, sub=["what the business is able to do,", "whoever does it"], anchor="capability")
B("team", COL[0], 0, "Team", w=CW, sub=["stream-aligned | platform |", "enabling | complicated-subsystem"], anchor="team")
B("ownership", COL[0], 0, "Ownership", w=CW, sub=["one team, one element, one role:", "owner | steward | operator"], anchor="ownership")

# --- ... then the packages where the Specy models live (bounded-context scope)
B("subdomain", COL[1], 0, "Subdomain", w=CW, sub=["an area of the problem space:", "core | supporting | generic"], anchor="subdomain")
B("bc", COL[1], 0, "Bounded Context", w=CW, kind="hub", sub="one language, one owning team", anchor="bounded-context")
B("aggregate", COL[1], 0, "Aggregate", w=CW, sub=["consistency boundary;", "system of record for its data"], anchor="aggregate")
B("system", COL[2], 0, "System", w=CW, sub="unit of the application portfolio", anchor="system")
B("container", COL[2], 0, "Container", w=CW, sub="deployable or runnable unit", anchor="container")
B("api", COL[2], 0, "API", w=CW, sub="provided interfaces and channels", anchor="api")
B("schema", COL[2], 0, "Schema", w=CW, sub="data shape, at rest or in motion", anchor="schema")
B("lineage", COL[2], 0, "Lineage", w=CW, sub="a schema derives from another", anchor="lineage")
B("environment", COL[3], 0, "Environment", w=CW, sub="production, staging, …", anchor="environment")
B("node", COL[3], 0, "Node", w=CW, sub="where containers run; nodes nest", anchor="node")
B("resource", COL[3], 0, "Resource", w=CW, sub="provisioned unit; where data lives", anchor="resource")

TOP, GAP, HEAD, PAD = 604, 48, 58, 24             # first box of the chain, gap inside a group, frame metrics
NEXT = PAD + 40 + HEAD                            # from the last box of a frame to the first box of the frame below
y = d.stack(["goal", "capability"], TOP, GAP)
d.stack(["team", "ownership"], y + NEXT, GAP)
y = d.stack(["system", "container", "api"], TOP, GAP)
bottom = d.stack(["schema", "lineage"], y + NEXT, GAP)
d.stack(["subdomain", "bc", "aggregate"], TOP + 96, GAP + 12)
d.stack(["environment", "node", "resource"], TOP + 80, GAP + 82)

# --- bottom band: transformation, cross-cutting (it moves every package above from plateau to plateau)
BY = bottom + PAD + 40 + PAD
B("plateau", BAND[0], BY, "Plateau", w=BW, sub="stable state: baseline | transition | target", anchor="plateau")
B("gap", BAND[1], BY, "Gap", w=BW, sub="the difference between two plateaus", anchor="gap")
B("initiative", BAND[2], BY, "Initiative", w=BW, sub="body of work that closes gaps and serves goals", anchor="initiative")
B("milestone", BAND[3], BY, "Milestone", w=BW, sub="dated checkpoint; a plateau reached", anchor="milestone")

# --- packages: dashed = enterprise scope (new), solid = bounded-context scope (where the Specy models live)
G("governance", "Governance", ["principle", "rule", "fitness", "waiver", "decision"],
  sub="cross-cutting — constrains every element of every package", anchor="governance-package")
G("strategy", "Strategy", ["goal", "capability"], sub="why", anchor="strategy-package")
G("organization", "Organization", ["team", "ownership"], sub="who", anchor="organization-package")
G("domain", "Domain", ["subdomain", "bc", "aggregate"], sub=".domain", kind="solid", anchor="domain-package")
G("system", "System", ["system", "container", "api"], sub=".arch", kind="solid", anchor="system-package")
G("data", "Data", ["schema", "lineage"], sub=".dataop, .arch", kind="solid", anchor="data-package")
G("deployment", "Deployment", ["environment", "node", "resource"], sub=".arch", kind="solid", anchor="deployment-package")
G("transformation", "Transformation", ["plateau", "gap", "initiative", "milestone"], label_at="bottom",
  sub="cross-cutting — moves every package from one plateau to the next", anchor="transformation-package")
d.legend(430, d.H - 62, [("dashed", "enterprise scope — new in this metamodel"),
                         ("solid", "bounded-context scope — where the Specy models live (.domain, .arch, .dataop)")])

# --- edges.  A cardinality sits outside the frame of the package it points into (OUT), and under
#     its curve rather than over it when the curve comes down onto the port (UNDER).
DOWN = dict(src_side="bottom", dst_side="top")
BACK = dict(src_side="left", dst_side="right")
OUT = dict(card_dx=-22)
UNDER = dict(card_dy=37)
# the root
E("enterprise", "principle", "0..n", src_side="top", dst_side="bottom", dst_t=0.288)
E("enterprise", "plateau", "1..n", dst_t=0.288, card_dy=-38, **DOWN)   # above the band's frame
E("enterprise", "goal", "1..n", src_t=0.3, **OUT)
E("enterprise", "team", "1..n", src_t=0.7, **OUT, **UNDER)
# the chain
E("goal", "capability", "0..n", **DOWN)
E("team", "ownership", "0..n", **DOWN)
E("capability", "subdomain", "1..n", **OUT)
E("ownership", "bc", "1", **OUT)
E("subdomain", "bc", "1..n", **DOWN)
E("bc", "aggregate", "0..n", **DOWN)
E("bc", "system", "1..n", **OUT)
E("aggregate", "schema", "0..n", **OUT, **UNDER)
E("system", "container", "1..n", **DOWN)
E("container", "api", "0..n", **DOWN)
E("api", "schema", "0..n", src_t=0.72, dst_t=0.72, **DOWN)
E("schema", "lineage", "0..n", **DOWN)
E("container", "node", "0..n", **OUT, **UNDER)
E("schema", "resource", "0..n", **OUT, **UNDER)
E("environment", "node", "1..n", **DOWN)
E("node", "resource", "0..n", **DOWN)
# governance and transformation
E("principle", "rule", "1..n")
E("rule", "fitness", "0..n", src_t=0.35)
E("rule", "waiver", "0..n", src_t=0.65, **UNDER)
E("decision", "waiver", "0..n", **BACK, **UNDER)
E("gap", "plateau", "2", **BACK)
E("initiative", "gap", "1..n", **BACK)
E("initiative", "milestone", "1..n")

d.write(sys.argv[1] if len(sys.argv) > 1 else "specy-EA-metamodel.svg")
