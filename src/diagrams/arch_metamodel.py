#!/usr/bin/env python3
"""specy-Arch-metamodel.svg — the Software Architecture metamodel (SOFTWARE-ARCHITECTURE-METAMODEL.md)."""
import sys
from metamodel_diagram import Diagram

d = Diagram(["Software Architecture", "Metamodel"], "Specy Software Architecture Metamodel", seed=31)
B, E = d.box, d.edge

# --- left: the C4 containment chain (architecture → system → container → component)
B("arch", 60, 250, "Architecture", w=340, kind="hub", sub="domain-source, requirements-source", anchor="architecture-root")
B("person", 480, 250, "Person (Actor)", w=300, sub="end user, operator, administrator", anchor="person-actor")
B("external", 480, 390, "External System", w=300, sub="opaque; provides and consumes interfaces", anchor="external-system")
B("system", 100, 460, "System", w=320, kind="hub", sub="the one system in focus", anchor="system")
B("container", 140, 670, "Container", w=320, kind="hub", sub="technology: a free-form string", anchor="level-2--container")
B("environment", 140, 890, "Environment", w=320, sub="deploys containers, with replica hints", anchor="deployment-view")
B("module", 480, 570, "Domain Module", w=300, sub="realizes (many-to-many)", anchor="relationship-to-the-domain-metamodel")

# --- centre: the component hub and what hangs off it
B("component", 860, 610, "Component", w=360, kind="hub", sub=["provides / requires interfaces,", "publishes to / subscribes to channels"], anchor="level-3--component")
B("interface", 1300, 250, "Interface", w=360, sub="a first-class named contract: the provided / required port", anchor="interface")
B("channel", 1300, 480, "Channel", w=360, sub="named topic or queue hosted on a broker container", anchor="channels-first-class-async")
B("connector", 1300, 710, "Connector", w=360, sub="from consumer to provider, over a protocol, sync | async | streaming", anchor="connector")
B("bc", 1300, 940, "Bounded Context", w=360, sub="optional DDD grouping; a component references at most one", anchor="bounded-context")

# --- right: contracts, messages, ports
B("operation", 1740, 250, "Operation", w=340, sub="camelCase · request-response | safe | oneway | streaming; returns a type, throws exceptions", anchor="operation")
B("argument", 2160, 250, "Argument", w=380, sub="ordinal, optional | required, type, default", anchor="argument")
B("message", 1740, 480, "Message Type", w=340, sub="struct or imported domain event carried by the channel", anchor="channels-first-class-async")
B("port", 1740, 710, "Port", w=340, sub="provided | required interface of a component, container or external system", anchor="provided-and-required-ports")

# --- bottom right: the Thrift-inspired type system
B("type", 2160, 900, "Type", w=380, sub="primitive · list<T>, set<T>, map<K,V> · named · imported from the domain", anchor="type-system-thrift-inspired")
grid = (("struct", "Struct", "struct"), ("enum", "Enum", "enum"),
        ("union", "Union", "union"), ("typedef", "Typedef", "typedef"),
        ("exception", "Exception", "exception"), ("imported", "Imported", "importing-domain-types"))
for i, (k, label, anchor) in enumerate(grid):
    B(k, 2160 + (i % 2) * 195, 1050 + (i // 2) * 84, label, w=185, anchor=anchor)
B("field", 1740, 1100, "Field", w=340, sub="ordinal, optional | required, type, name, default", anchor="field")

# --- edges
E("arch", "person", "0..n", src_t=0.35)
E("arch", "external", "0..n", src_t=0.75)
E("arch", "system", "1", src_side="bottom", dst_side="top", src_t=0.45, dst_t=0.45)
E("system", "container", "1..n", src_side="bottom", dst_side="top", src_t=0.45, dst_t=0.45)
E("container", "environment", "0..n", src_side="bottom", dst_side="top", src_t=0.45, dst_t=0.45)
E("container", "component", "0..n", src_t=0.3)
E("component", "module", "0..n", src_side="left", dst_side="right", src_t=0.15, dst_t=0.5)
E("external", "interface", "0..n", src_t=0.4, dst_t=0.25)
E("component", "interface", "0..n", src_t=0.5, dst_t=0.6)
E("component", "channel", "0..n", src_t=0.5)
E("component", "connector", "0..n", src_t=0.5)
E("component", "bc", "0..1", src_t=0.5)
E("interface", "operation", "1..n")
E("operation", "argument", "1..n")
E("argument", "type", "1", src_side="bottom", dst_side="top")
E("channel", "message", "1..n")
E("connector", "port", None)
E("type", "exception", None, src_side="bottom", dst_side="top", src_t=0.25, dst_t=0.5, straight=True)
E("type", "imported", None, src_side="bottom", dst_side="top", src_t=0.75, dst_t=0.5, straight=True)
E("struct", "field", "1..n", src_side="left", dst_side="right", dst_t=0.3)
E("exception", "field", "1..n", src_side="left", dst_side="right", dst_t=0.7)

d.write(sys.argv[1] if len(sys.argv) > 1 else "specy-Arch-metamodel.svg")
