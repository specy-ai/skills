#!/usr/bin/env python3
"""specy-PRD-metamodel.svg — the Product Requirement metamodel (PRODUCT-REQ-METAMODEL.md)."""
import sys
from metamodel_diagram import Diagram

d = Diagram(["Product Requirement", "Metamodel"], "Specy Product Requirement Metamodel", seed=11)
B, E = d.box, d.edge

# --- left: the product and its context (chain, like the DDD organization column)
B("problem", 60, 260, "Problem Statement", w=320, sub="Situation, Complication, Question", anchor="problem-statement")
B("evidence", 440, 260, "Supporting Evidence", w=340, sub="Type, Summary, Source, Date, Confidence", anchor="supporting-evidence")
B("product", 100, 450, "Product", w=320, kind="hub", sub="Vision, Scope, Non-goals")
B("persona", 160, 660, "Persona", w=320, kind="hub", sub="Role, Goals, Frustrations, Context, Weight")
B("job", 160, 860, "Job", w=320, sub="Statement, Type, Importance, Satisfaction")
B("outcome", 160, 1040, "Desired Outcome", w=320, sub="Statement, Importance, Current satisfaction", anchor="desired-outcome")

# --- uncertainty the product carries (fan-out from the product)
B("assumption", 560, 600, "Assumption", w=280, sub="Statement, Impact if wrong, Validation plan, Status")
B("risk", 560, 740, "Risk", w=280, sub="Likelihood, Impact, Mitigation, Owner")
B("constraint", 560, 880, "Constraint", w=280, sub="Statement, Source, Impact")
B("question", 560, 1010, "Open Question", w=280, sub="Question, Context, Owner, Deadline, Status", anchor="open-question")

d.stack(("assumption", "risk", "constraint", "question"), 600, gap=36)

# --- centre: the feature hub and what hangs off it
B("feature", 880, 470, "Feature", w=420, kind="hub", sub=["FEAT-NNN · Summary, Value proposition,", "Priority (MoSCoW), Status, Non-goals"])
B("story", 1340, 250, "User Story", w=340, sub="US-NNN · As a <persona>, I want <action>, so that <outcome>", anchor="user-story")
B("journey", 1340, 420, "User Journey", w=340, sub="Persona, Trigger, Outcome", anchor="user-journey")
B("goal", 1340, 620, "Goal", w=340, sub="Statement, Horizon, Owner")
B("hypothesis", 1340, 780, "Hypothesis", w=340, sub="Intervention, Expected outcome, Mechanism, Validation method, Status")
B("release", 1340, 970, "Release", w=340, sub="Target date, Theme, Status, Entry & Exit criteria")

# --- right: details
B("criterion", 1760, 250, "Acceptance Criterion", w=340, sub="AC-NNN-NN · a testable condition", anchor="user-story")
B("step", 1760, 420, "Journey Step", w=340, sub="Action, System response, Channel, Emotional tone, Order", anchor="journey-step")
B("metric", 1760, 620, "Success Metric", w=340, sub="Indicator, Target, Baseline, Measurement method", anchor="success-metric")
B("sysreq", 2180, 250, "System Requirement", w=380, sub="EARS statement whose source references the FEAT / US / AC identifier", anchor="traceability-to-system-requirements")

# --- edges
E("product", "problem", "1", src_side="top", dst_side="bottom", src_t=0.5, dst_t=0.5)
E("problem", "evidence", "0..n")
E("product", "persona", "1..n", src_side="bottom", dst_side="top", src_t=0.45, dst_t=0.45)
E("persona", "job", "0..n", src_side="bottom", dst_side="top")
E("job", "outcome", "1..n", src_side="bottom", dst_side="top")
for i, k in enumerate(("assumption", "risk", "constraint", "question")):
    E("product", k, "0..n", src_side="right", src_t=0.82)
E("product", "feature", "0..n", src_side="right", src_t=0.5)
E("product", "goal", "1..n", src_side="right", src_t=0.66, dst_t=0.25)
E("feature", "story", "1..n", src_t=0.5)
E("feature", "journey", "0..n", src_t=0.5)
E("feature", "goal", "0..n", src_t=0.5, dst_t=0.75)
E("feature", "hypothesis", "0..1", src_t=0.5)
E("feature", "release", "0..1", src_t=0.5)
E("hypothesis", "goal", "1", src_side="top", dst_side="bottom")
E("story", "criterion", "0..n")
E("journey", "step", "1..n")
E("goal", "metric", "1..n")
E("criterion", "sysreq", "0..n")

d.write(sys.argv[1] if len(sys.argv) > 1 else "specy-PRD-metamodel.svg")
