#!/usr/bin/env python3
"""EA-metamodel.svg — the Enterprise Architecture metamodel (ENTERPRISE-ARCHITECTURE-METAMODEL.md)."""
import sys
from metamodel_diagram import Diagram

d = Diagram(["Enterprise Architecture", "Metamodel"], "Specy Enterprise Architecture Metamodel",
            height=2092, edges="clean")
B, E, G = d.box, d.edge, d.group

BAND = (60, 711, 1362, 2013)     # x of the four slots of a cross-cutting band (boxes 521 wide)
COL = (494, 1046, 1598, 2150)    # x of the four package columns of the chain (boxes 384 wide)
BW, CW = 521, 384
LANE = 100                       # left of Practice: the lane of the root's edge up to Principle

# --- top band: governance, cross-cutting (it constrains every package below), on two rows:
#     what is stated and enforced on the first (principle, rule, fitness function, decision),
#     how to comply and the exceptions on the second (practice, pattern, waiver, technology)
B("principle", BAND[0], 0, "Principle", w=BW, sub="statement, rationale, implications", anchor="principle")
B("practice", BAND[0] + LANE, 0, "Practice", w=BW - LANE,
  sub=["what people do, why and how;", "radar ring: adopt | trial | assess | hold"], anchor="practice")
B("rule", BAND[1], 0, "Rule", w=BW, sub=["checkable constraint;", "risk, severity, remediation window"], anchor="rule")
B("pattern", BAND[1], 0, "Pattern", w=BW, sub=["reusable way to comply with rules;", "candidate | proven | deprecated"], anchor="pattern")
B("fitness", BAND[2], 0, "Fitness Function", w=BW, sub=["preventive | detective check", "on model, code or runtime"], anchor="fitness-function")
B("waiver", BAND[2], 0, "Waiver", w=BW, sub=["time-boxed exception", "for named elements"], anchor="waiver")
B("decision", BAND[3], 0, "Decision", w=BW, sub=["context, alternatives, consequences; decider, scope;",
                                                  "establishes principles, rules, patterns, plateaus, gaps"], anchor="decision")
B("technology", BAND[3], 0, "Technology", w=BW, sub=["component | library;", "radar ring: adopt | trial | assess | hold"], anchor="technology")

# --- the chain, left to right: the root, then strategy and organization (enterprise scope) ...
B("enterprise", 60, 0, "Enterprise", w=300, kind="hub", sub=["the root; the organization of", ".domain and .arch models"], anchor="enterprise")
B("valuestream", COL[0], 0, "Value Stream", w=CW, sub=["ordered stages, each", "a business capability"], anchor="value-stream")
B("capability", COL[0], 0, "Capability", w=CW, sub=["what the enterprise can do:", "business | technical"], anchor="capability")
B("goal", COL[0], 0, "Goal", w=CW, sub=["outcome pursued, measured", "by metrics, with a horizon"], anchor="goal")
B("metric", COL[0], 0, "Metric", w=CW, sub=["indicator, source, frequency;", "leading | lagging"], anchor="metric")
B("team", COL[0], 0, "Team", w=CW, sub=["stream-aligned | platform |", "enabling | complicated-subsystem"], anchor="team")
B("ownership", COL[0], 0, "Ownership", w=CW, sub=["one team, one element, one role:", "owner | steward | operator | sponsor"], anchor="ownership")

# --- ... then the packages where the Specy models live (bounded-context scope)
B("subdomain", COL[1], 0, "Subdomain", w=CW, sub=["problem space:", "core | supporting | generic"], anchor="subdomain")
B("bc", COL[1], 0, "Bounded Context", w=CW, kind="hub", sub="one language, one owning team", anchor="bounded-context")
B("aggregate", COL[1], 0, "Aggregate", w=CW, sub=["consistency boundary;", "system of record for its data"], anchor="aggregate")
B("system", COL[2], 0, "System", w=CW, sub=["unit of the application portfolio;", ".arch level 0"], anchor="system")
B("container", COL[2], 0, "Container", w=CW, sub="deployable or runnable unit", anchor="container")
B("api", COL[2], 0, "API", w=CW, sub=["published surface; consumed through", "dependencies with criticality"], anchor="api")
B("schema", COL[2], 0, "Schema", w=CW, sub=["data shape, at rest or in motion;", "classification, retention"], anchor="schema")
B("lineage", COL[2], 0, "Lineage", w=CW, sub="a schema derives from another", anchor="lineage")
B("environment", COL[3], 0, "Environment", w=CW, sub="production, staging, …", anchor="environment")
B("node", COL[3], 0, "Node", w=CW, sub=["where containers run: provider,", "region, zone; nodes nest"], anchor="node")
B("resource", COL[3], 0, "Resource", w=CW, sub=["provisioned unit;", "where data lives; tenancy"], anchor="resource")

GTOP, GAP, HEAD, PAD = 280, 48, 58, 24            # first governance row, gap inside a group, frame metrics
NEXT = PAD + 40 + HEAD                            # from the last box of a frame to the first box of the frame below
# governance: four slots of two rows; the principle (one subtitle line) centred on the first row
gb = d.stack(["rule", "pattern"], GTOP, GAP)
d.stack(["fitness", "waiver"], GTOP, GAP)
d.stack(["decision", "technology"], GTOP, GAP)
p, pr = d.boxes["principle"], d.boxes["practice"]
p.y = d.boxes["rule"].cy - p.h / 2
pr.y = d.boxes["pattern"].y
TOP = gb + NEXT                                   # first box of the chain
SHIFT = 100                                       # the solid packages, centred on the taller strategy column
y = d.stack(["valuestream", "capability", "goal", "metric"], TOP, GAP)
org_bottom = d.stack(["team", "ownership"], y + NEXT, GAP)
y = d.stack(["system", "container", "api"], TOP + SHIFT, GAP)
data_bottom = d.stack(["schema", "lineage"], y + NEXT, GAP)
d.stack(["subdomain", "bc", "aggregate"], TOP + SHIFT + 96, GAP + 52)
d.stack(["environment", "node", "resource"], TOP + SHIFT + 80, GAP + 82)
ent, goal, team = d.boxes["enterprise"], d.boxes["goal"], d.boxes["team"]
ent.y = (goal.cy + team.cy - ent.h) / 2
bottom = max(org_bottom, data_bottom)

# --- bottom band: transformation, cross-cutting (it moves every package above from plateau to plateau)
BY = bottom + PAD + 40 + PAD
B("plateau", BAND[0], BY, "Plateau", w=BW, sub=["baseline | transition | target;", "elements with provenance and verified-on"], anchor="plateau")
B("gap", BAND[1], BY, "Gap", w=BW, sub=["the difference between two plateaus;", "impact, effort"], anchor="gap")
B("initiative", BAND[2], BY, "Initiative", w=BW, sub=["body of work that closes gaps", "and serves goals"], anchor="initiative")
B("milestone", BAND[3], BY, "Milestone", w=BW, sub=["dated checkpoint; plateau reached,", "metric value contributed"], anchor="milestone")

# --- packages: dashed = enterprise scope, solid = bounded-context scope (described by the Specy models)
G("governance", "Governance", ["principle", "practice", "rule", "pattern", "fitness", "waiver", "decision", "technology"],
  sub="cross-cutting — constrains every element of every package", anchor="governance-package")
G("strategy", "Strategy", ["valuestream", "capability", "goal", "metric"], sub="why", anchor="strategy-package")
G("organization", "Organization", ["team", "ownership"], sub="who", anchor="organization-package")
G("domain", "Domain", ["subdomain", "bc", "aggregate"], sub=".domain", kind="solid", anchor="domain-package")
G("system", "System", ["system", "container", "api"], sub=".arch, level 0", kind="solid", anchor="system-package")
G("data", "Data", ["schema", "lineage"], sub=".dataop, .arch", kind="solid", anchor="data-package")
G("deployment", "Deployment", ["environment", "node", "resource"], sub=".arch", kind="solid", anchor="deployment-package")
G("transformation", "Transformation", ["plateau", "gap", "initiative", "milestone"], label_at="bottom",
  sub="cross-cutting — moves every package from one plateau to the next", anchor="transformation-package")
d.legend(430, d.H - 62, [("dashed", "enterprise scope — described by this metamodel only"),
                         ("solid", "bounded-context scope — described by the Specy models (.domain, .arch, .dataop)")])

# --- edges.  A cardinality sits outside the frame of the package it points into (OUT), and under
#     its curve rather than over it when the curve comes down onto the port (UNDER).
DOWN = dict(src_side="bottom", dst_side="top")
UP = dict(src_side="top", dst_side="bottom")
BACK = dict(src_side="left", dst_side="right")
OUT = dict(card_dx=-22)
UNDER = dict(card_dy=37)
BELOW_GOV = gb + PAD + 34                         # baseline of a card just under the governance frame
# the root (up to the principle through the lane left of the practice)
LX = BAND[0] + LANE / 2
E("enterprise", "principle", "0..n", src_t=(LX - ent.x) / ent.w, dst_t=(LX - p.x) / p.w,
  card_dy=BELOW_GOV - (p.y1 + 32), **UP)
pl = d.boxes["plateau"]                           # down to the plateau in the same lane: one vertical line
E("enterprise", "plateau", "1..n", src_t=(LX - ent.x) / ent.w, dst_t=(LX - pl.x) / pl.w,
  card_dy=-38, **DOWN)                            # above the band's frame
E("enterprise", "goal", "1..n", src_t=0.3, **OUT)
E("enterprise", "team", "1..n", src_t=0.7, **OUT, **UNDER)
# the chain
E("valuestream", "capability", "1..n", **DOWN)
E("goal", "capability", "0..n", **UP)
E("goal", "metric", "0..n", **DOWN)
E("team", "ownership", "0..n", **DOWN)
E("capability", "subdomain", "1..n", **OUT, **UNDER)
E("ownership", "bc", "1", **OUT)
E("subdomain", "bc", "0..n", **DOWN)
E("bc", "aggregate", "0..n", **DOWN)
E("bc", "system", "1..n", **OUT)
E("aggregate", "schema", "0..n", **OUT, **UNDER)
E("system", "container", "0..n", **DOWN)
E("container", "api", "0..n", **DOWN)
E("api", "schema", "0..n", src_t=0.72, dst_t=0.72, card_dy=-56, **DOWN)   # between the two frames
E("schema", "lineage", "0..n", **DOWN)
E("container", "node", "0..n", src_t=0.65, **OUT, **UNDER)
E("container", "technology", "0..1", src_t=0.3, dst_side="bottom", dst_t=0.1,
  card_dy=BELOW_GOV - (d.boxes["technology"].y1 + 32))
E("schema", "resource", "0..n", **OUT, **UNDER)
E("environment", "node", "0..n", **DOWN)
E("node", "resource", "0..n", **DOWN)
# governance and transformation
E("principle", "rule", "1..n")
E("principle", "practice", "0..n", dst_t=(p.cx - pr.x) / pr.w, **DOWN)
E("rule", "fitness", "0..n", src_t=0.35, dst_t=0.35)
E("rule", "waiver", "0..n", src_t=0.65, **UNDER)
E("rule", "pattern", "0..n", **DOWN)
E("decision", "waiver", "0..n", **BACK, **UNDER)
E("decision", "technology", "0..n", **DOWN)
E("gap", "plateau", "2", **BACK)
E("initiative", "gap", "1..n", **BACK)
E("initiative", "milestone", "1..n")

d.write(sys.argv[1] if len(sys.argv) > 1 else "EA-metamodel.svg")
