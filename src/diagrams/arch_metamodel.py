#!/usr/bin/env python3
"""specy-Arch-metamodel.svg — the Software Architecture metamodel (SOFTWARE-ARCHITECTURE-METAMODEL.md)."""
import sys
from metamodel_diagram import Diagram

d = Diagram(["Software Architecture", "Metamodel"], "Specy Software Architecture Metamodel",
            height=2005, seed=31, edges="clean")
B, E = d.box, d.edge

# The picture reads top-down along the spine in the centre: organization → system → container → component.
# Level 0 is the band on top (left of the spine: dependencies, flows, concepts; right of it: the context
# of a system and the root of a single-system file); levels 2-3 hang off the container and the component.
RIGHT, LOW = 30, 585             # where the contracts block sits: below the level-0 / level-1 band, and far
                                 # enough from the component for the cardinalities to clear the fan of edges


def C(id, x, y, *a, **k):        # a box of the contracts block (interfaces, messages, ports, types), placed
    return B(id, x + RIGHT, y + LOW, *a, **k)   # relative to that block


# --- centre: the spine; the area sits between the organization and its systems, right of the lane
#     their edge runs in
B("organization", 850, 250, "Organization", w=380, kind="hub", sub=["level-0 root: the system landscape;", "domain-source, requirements-source"], anchor="organization")
B("area", 950, 442, "Area", w=270, sub="groups systems as the business sees them", anchor="area")
B("system", 860, 612, "System", w=360, kind="hub", sub=["purpose, technology, used-by,", "masters / handles, hotspots"], anchor="system")
B("container", 880, 1110, "Container", w=320, kind="hub", sub="technology: a free-form string", anchor="level-2--container")
B("component", 880, 1338, "Component", w=320, kind="hub", sub=["provides / requires interfaces,", "publishes to / subscribes to channels"], anchor="level-3--component")

# --- top left: level 0, how the systems depend on each other and what they hold
B("phase", 420, 250, "Phase", w=360, sub="stage of the integration roadmap, in chronological order", anchor="phase")
B("dependency", 420, 398, "Dependency", w=360, sub=["downstream → upstream; criticality", "CS | Conformist | ACL | OHS |", "SharedKernel | PublishedLanguage", "| Partnership"], anchor="dependency")
B("flow", 60, 410, "Flow", w=300, sub="number, label, direction; mechanism: over a medium, manual | automated", anchor="flow")
B("hotspot", 420, 623, "Hotspot", w=360, sub="known point of fragility or effort in operating a system", anchor="hotspot")
B("concept", 420, 787, "Concept Reference", w=360, sub="a domain concept: entity, aggregate, value, event…; resolved against a domain source", anchor="concept-reference")

# --- top right: level 1, the context of a system — and the root of a single-system file
B("person", 1330, 442, "Person (Actor)", w=300, sub="end user, operator, administrator", anchor="person-actor")
B("arch", 1330, 612, "Architecture", w=380, kind="hub", sub=["one system in focus;", "domain-source, requirements-source"], anchor="architecture-root")
B("external", 1790, 623, "External System", w=300, sub="opaque; provides and consumes interfaces", anchor="external-system")

# --- left of the container: the deployment view (environment → node → resource)
B("environment", 440, 977, "Environment", w=320, sub="contains nodes; deploys containers, with replica hints", anchor="deployment-view")
B("node", 60, 1107, "Node", w=320, sub="where containers run; provider, region, zone", anchor="node")
B("resource", 440, 1237, "Resource", w=320, sub="where data lives: instantiates a data store or broker; tenancy; stores structs", anchor="resource")
B("module", 460, 1420, "Domain Module", w=300, sub="realizes (many-to-many)", anchor="relationship-to-the-domain-metamodel")

# --- right of the component: what hangs off it
C("interface", 1300, 250, "Interface", w=360, sub="a first-class named contract: the provided / required port", anchor="interface")
C("channel", 1300, 480, "Channel", w=360, sub="named topic or queue hosted on a broker container", anchor="channels-first-class-async")
C("connector", 1300, 710, "Connector", w=360, sub="from consumer to provider, over a protocol, sync | async | streaming", anchor="connector")
C("bc", 1300, 940, "Bounded Context", w=360, sub="optional DDD grouping; a component references at most one", anchor="bounded-context")

# --- right: contracts, messages, ports
C("operation", 1740, 250, "Operation", w=340, sub="camelCase · request-response | safe | oneway | streaming; returns a type, throws exceptions", anchor="operation")
C("argument", 2160, 250, "Argument", w=380, sub="ordinal, optional | required, type, default", anchor="argument")
C("message", 1740, 480, "Message Type", w=340, sub="struct or imported domain event carried by the channel", anchor="channels-first-class-async")
C("port", 1740, 710, "Port", w=340, sub="provided | required interface of a component, container or external system", anchor="provided-and-required-ports")

# --- bottom right: the Thrift-inspired type system
C("type", 2160, 900, "Type", w=380, sub="primitive · list<T>, set<T>, map<K,V> · named · imported from the domain", anchor="type-system-thrift-inspired")
grid = (("struct", "Struct", "struct"), ("enum", "Enum", "enum"),
        ("union", "Union", "union"), ("typedef", "Typedef", "typedef"),
        ("exception", "Exception", "exception"), ("imported", "Imported", "importing-domain-types"))
for i, (k, label, anchor) in enumerate(grid):
    C(k, 2160 + (i % 2) * 195, 1050 + (i // 2) * 84, label, w=185, anchor=anchor)
C("field", 1740, 1100, "Field", w=340, sub="ordinal, optional | required, type, name, default", anchor="field")

# --- edges.  A cardinality sits under its curve rather than over it when the curve comes down onto
#     the port (UNDER), and left of it when the curve comes down from the right (LEFT).
DOWN = dict(src_side="bottom", dst_side="top")
UP = dict(src_side="top", dst_side="bottom")
BACK = dict(src_side="left", dst_side="right")
UNDER = dict(card_dy=36)
LEFT = dict(card_dx=-64)
# level 0: the organization holds its systems, areas, phases, dependencies, persons and external systems
E("organization", "system", "1..n", src_t=0.145, dst_t=0.125, **DOWN)     # the lane left of the area
E("organization", "area", "0..n", src_t=0.658, dst_t=0.556, **DOWN)
E("organization", "phase", "0..n", src_t=0.42, **BACK)
E("organization", "dependency", "0..n", src_t=0.85, dst_t=0.15, **BACK, **UNDER)
E("organization", "person", "0..n", src_t=0.8, dst_side="top", dst_t=0.3)
E("organization", "external", "0..n", src_t=0.3, dst_side="top")
# a system sits in an area, is used by persons, masters and handles domain concepts, has hotspots
E("system", "area", "0..1", src_t=0.667, dst_t=0.556, **UP)
E("system", "person", "0..n", src_t=0.15, dst_t=0.85)
E("system", "hotspot", "0..n", **BACK, **UNDER)
E("system", "concept", "0..n", src_t=0.9, dst_t=0.3, **BACK, **UNDER)
# a dependency goes from a system to a system and is detailed by flows; a flow carries domain concepts,
# with a mechanism per phase; a hotspot concerns flows and concepts
E("dependency", "system", "2", src_t=0.85, dst_t=0.1, **UNDER)
E("dependency", "flow", "0..n", **BACK)
E("flow", "phase", "0..n", src_side="top", dst_side="left")
E("flow", "concept", "1..n", src_side="bottom", dst_side="left", src_t=0.3, **UNDER)
E("hotspot", "flow", "0..n", src_side="left", dst_side="bottom", dst_t=0.75)
E("hotspot", "concept", "0..n", **DOWN)
# level 1: the root of a single-system file, its one system and their neighbours
E("arch", "system", "1", **BACK)
E("arch", "person", "0..n", src_t=0.474, dst_t=0.6, **UP)
E("arch", "external", "0..n")
E("external", "interface", "0..n", src_t=0.25, dst_t=0.8, **DOWN, **LEFT)
# levels 2-3
E("system", "container", "0..n", **DOWN)
E("container", "component", "0..n", **DOWN)
E("component", "module", "0..n", src_t=0.774, **BACK)
E("component", "interface", "0..n", src_t=0.5, dst_t=0.6)
E("component", "channel", "0..n", src_t=0.5)
E("component", "connector", "0..n", src_t=0.5)
E("component", "bc", "0..1", src_t=0.5, **UNDER)
E("interface", "operation", "1..n", dst_t=0.413)
E("operation", "argument", "1..n", src_t=0.413)
E("argument", "type", "1", src_side="bottom", dst_side="top")
E("channel", "message", "1..n")
E("connector", "port", None, dst_t=0.413)
E("type", "exception", None, src_side="bottom", dst_side="top", src_t=0.25, dst_t=0.5, straight=True)
E("type", "imported", None, src_side="bottom", dst_side="top", src_t=0.75, dst_t=0.5, straight=True)
E("struct", "field", "1..n", dst_t=0.15, **BACK, **UNDER)
E("exception", "field", "1..n", dst_t=0.85, **BACK)
# the deployment view: nodes nest, host containers and provide resources; a resource instantiates a container
E("container", "environment", "0..n", src_t=0.15, dst_t=0.7, **BACK)
E("environment", "node", "0..n", src_side="left", dst_side="top", src_t=0.4, **LEFT)
E("node", "node", "0..1", src_side="bottom", src_t=0.1, dst_side="bottom", dst_t=0.42)   # nested in
E("node", "container", "0..n")
E("node", "resource", "0..n", src_side="bottom", src_t=0.7, dst_side="left", **UNDER)
E("resource", "container", "0..1", src_t=0.3, dst_t=0.85)

d.write(sys.argv[1] if len(sys.argv) > 1 else "specy-Arch-metamodel.svg")
