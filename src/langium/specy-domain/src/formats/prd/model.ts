/**
 * Normalizer: .prd AST -> the product requirements document.
 *
 * The document is the PRD as data: one object per product, its members
 * grouped by kind (personas, jobs, goals, features, …) in the order the
 * metamodel presents them, every text collapsed to one line, every keyword
 * kept as the DSL spells it (`event-driven` stays `event-driven`, `must` stays
 * `must`). Elements keep their stable ids (FEAT-001, US-004, AC-004-02) when
 * the file carries them. The shape is described by
 * src/schemas/prd.schema.json; the printer (printer.ts) writes it back as DSL.
 */
import * as ast from '../../generated/ast.js';
import { PARSER_VERSION, PRD_SCHEMA } from '../../cli/version.js';
import { collapse, compact, nonEmpty } from '../kit/text.js';

export interface PrdDocument {
    $schema: string;
    parser: { name: string; version: string };
    products: PrdProduct[];
}

export interface PrdProduct {
    name: string;
    vision?: string;
    scope?: string[];
    nonGoals?: string[];
    problem?: { situation: string; complication: string; question: string };
    evidence?: PrdEvidence[];
    personas?: PrdPersona[];
    jobs?: PrdJob[];
    goals?: PrdGoal[];
    hypotheses?: PrdHypothesis[];
    features?: PrdFeature[];
    assumptions?: PrdAssumption[];
    risks?: PrdRisk[];
    constraints?: PrdConstraint[];
    openQuestions?: PrdOpenQuestion[];
    releases?: PrdRelease[];
    journeys?: PrdJourney[];
}

export interface PrdEvidence {
    name: string;
    type: string;
    summary: string;
    sourceReference: string;
    date: string;
    confidence: string;
    supports: string;
}

export interface PrdPersona {
    name: string;
    role: string;
    goals: string[];
    frustrations: string[];
    context: string;
    weight: string;
}

export interface PrdDesiredOutcome {
    statement: string;
    importance: string;
    currentSatisfaction: string;
}

export interface PrdJob {
    name: string;
    persona: string;
    statement: string;
    type: string;
    importance: string;
    satisfaction: string;
    relatedTo?: string[];
    desiredOutcomes?: PrdDesiredOutcome[];
}

export interface PrdMetric {
    indicator: string;
    target: string;
    baseline?: string;
    measurement: string;
}

export interface PrdGoal {
    name: string;
    statement: string;
    horizon: string;
    owner: string;
    metrics?: PrdMetric[];
}

export interface PrdHypothesis {
    name: string;
    intervention: string;
    expectedOutcome: string;
    mechanism: string;
    validationMethod: string;
    status: string;
    proposes: string;
    predicts: string;
    supportedBy?: string[];
}

export interface PrdDesignReference {
    name: string;
    url: string;
}

export interface PrdAcceptanceCriterion {
    id?: string;
    text: string;
}

export interface PrdStory {
    id?: string;
    title: string;
    acceptanceCriteria: PrdAcceptanceCriterion[];
}

export interface PrdFeature {
    id?: string;
    name: string;
    summary: string;
    persona: string;
    valueProposition: string;
    priority: string;
    status: string;
    addresses?: string[];
    advances?: string[];
    testedBy?: string;
    designReferences?: PrdDesignReference[];
    nonGoals?: string[];
    stories?: PrdStory[];
}

export interface PrdAssumption {
    name: string;
    statement: string;
    impactIfWrong: string;
    validationPlan: string;
    status: string;
    underpins?: string[];
}

export interface PrdRisk {
    name: string;
    statement: string;
    likelihood: string;
    impact: string;
    mitigation: string;
    owner: string;
    threatens?: string[];
}

export interface PrdConstraint {
    name: string;
    statement: string;
    source: string;
    constrains?: string[];
}

export interface PrdOpenQuestion {
    name: string;
    question: string;
    context: string;
    owner: string;
    deadline: string;
    status: string;
    blocks?: string[];
    resolution?: string;
}

export interface PrdRelease {
    name: string;
    targetDate?: string;
    theme?: string;
    status?: string;
    dependsOn?: string[];
    includes?: string[];
    entryCriteria?: string[];
    exitCriteria?: string[];
}

export interface PrdStep {
    /** `step 1 { … }` or `1 { … }`. */
    number?: number;
    /** `"what the persona does" { … }` — the name doubles as the action. */
    name?: string;
    action?: string;
    systemResponse?: string;
    channel?: string;
    emotionalTone?: string;
    order?: number;
}

export interface PrdJourney {
    name: string;
    persona: string;
    trigger: string;
    outcome: string;
    designReferences?: PrdDesignReference[];
    steps?: PrdStep[];
}

// ---------------------------------------------------------------------------

const text = (s: string | undefined): string => collapse(s) ?? '';
const texts = (list: string[]): string[] => list.map(s => text(s));

export function normalizePrd(file: ast.PrdFile): PrdDocument {
    return {
        $schema: PRD_SCHEMA,
        parser: { name: 'specy-prd', version: PARSER_VERSION },
        products: (file.products ?? []).map(normalizeProduct),
    };
}

function normalizeProduct(p: ast.PrdProductDef): PrdProduct {
    const out: PrdProduct = { name: text(p.name) };
    const scope: string[] = [];
    const nonGoals: string[] = [];
    const push = <K extends keyof PrdProduct>(key: K, value: NonNullable<PrdProduct[K]> extends (infer T)[] ? T : never): void => {
        ((out[key] as unknown[] | undefined) ??= []).push(value);
        void ((out[key] as unknown[]) satisfies unknown[]);
    };
    for (const m of p.members ?? []) {
        if (ast.isPrdVisionDecl(m)) out.vision ??= text(m.text);
        else if (ast.isPrdScopeBlock(m)) scope.push(...texts(m.items));
        else if (ast.isPrdNonGoalsBlock(m)) nonGoals.push(...texts(m.items));
        else if (ast.isPrdProblemBlock(m)) out.problem ??= { situation: text(m.situation), complication: text(m.complication), question: text(m.question) };
        else if (ast.isPrdEvidenceDef(m)) push('evidence', evidence(m));
        else if (ast.isPrdPersonaDef(m)) push('personas', persona(m));
        else if (ast.isPrdJobDef(m)) push('jobs', job(m));
        else if (ast.isPrdGoalDef(m)) push('goals', goal(m));
        else if (ast.isPrdHypothesisDef(m)) push('hypotheses', hypothesis(m));
        else if (ast.isPrdFeatureDef(m)) push('features', feature(m));
        else if (ast.isPrdAssumptionDef(m)) push('assumptions', assumption(m));
        else if (ast.isPrdRiskDef(m)) push('risks', risk(m));
        else if (ast.isPrdConstraintDef(m)) push('constraints', constraint(m));
        else if (ast.isPrdOpenQuestionDef(m)) push('openQuestions', openQuestion(m));
        else if (ast.isPrdReleaseDef(m)) push('releases', release(m));
        else if (ast.isPrdJourneyDef(m)) push('journeys', journey(m));
    }
    out.scope = nonEmpty(scope);
    out.nonGoals = nonEmpty(nonGoals);
    // the metamodel's order, whatever the file's
    const ordered: PrdProduct = {
        name: out.name,
        vision: out.vision,
        scope: out.scope,
        nonGoals: out.nonGoals,
        problem: out.problem,
        evidence: out.evidence,
        personas: out.personas,
        jobs: out.jobs,
        goals: out.goals,
        hypotheses: out.hypotheses,
        features: out.features,
        assumptions: out.assumptions,
        risks: out.risks,
        constraints: out.constraints,
        openQuestions: out.openQuestions,
        releases: out.releases,
        journeys: out.journeys,
    };
    return compact(ordered);
}

function evidence(e: ast.PrdEvidenceDef): PrdEvidence {
    return { name: text(e.name), type: e.type, summary: text(e.summary), sourceReference: text(e.sourceReference), date: e.date, confidence: e.confidence, supports: text(e.supports) };
}

function persona(p: ast.PrdPersonaDef): PrdPersona {
    return { name: text(p.name), role: text(p.role), goals: texts(p.goals), frustrations: texts(p.frustrations), context: text(p.context), weight: p.weight };
}

function job(j: ast.PrdJobDef): PrdJob {
    return compact({
        name: text(j.name),
        persona: text(j.persona),
        statement: text(j.statement),
        type: j.type,
        importance: j.importance,
        satisfaction: j.satisfaction,
        relatedTo: nonEmpty(texts(j.relatedTo)),
        desiredOutcomes: j.outcomes ? nonEmpty(j.outcomes.outcomes.map(o => ({ statement: text(o.statement), importance: o.importance, currentSatisfaction: o.currentSatisfaction }))) : undefined,
    });
}

function goal(g: ast.PrdGoalDef): PrdGoal {
    return compact({
        name: text(g.name),
        statement: text(g.statement),
        horizon: g.horizon,
        owner: text(g.owner),
        metrics: nonEmpty(g.metrics.map(m => compact({ indicator: text(m.indicator), target: text(m.target), baseline: m.baseline === undefined ? undefined : text(m.baseline), measurement: text(m.measurement) }))),
    });
}

function hypothesis(h: ast.PrdHypothesisDef): PrdHypothesis {
    return compact({
        name: text(h.name),
        intervention: text(h.intervention),
        expectedOutcome: text(h.expectedOutcome),
        mechanism: text(h.mechanism),
        validationMethod: text(h.validationMethod),
        status: h.status,
        proposes: text(h.proposes),
        predicts: text(h.predicts),
        supportedBy: nonEmpty(texts(h.supportedBy)),
    });
}

function designReferences(block: ast.PrdDesignReferencesBlock | undefined): PrdDesignReference[] | undefined {
    return block ? nonEmpty(block.references.map(r => ({ name: text(r.name), url: text(r.url) }))) : undefined;
}

function feature(f: ast.PrdFeatureDef): PrdFeature {
    return compact({
        id: f.id,
        name: text(f.name),
        summary: text(f.summary),
        persona: text(f.persona),
        valueProposition: text(f.valueProposition),
        priority: f.priority,
        status: f.status,
        addresses: nonEmpty(texts(f.addresses)),
        advances: nonEmpty(texts(f.advances)),
        testedBy: f.testedBy === undefined ? undefined : text(f.testedBy),
        designReferences: designReferences(f.designReferences),
        nonGoals: f.nonGoals ? nonEmpty(texts(f.nonGoals.items)) : undefined,
        stories: f.stories
            ? nonEmpty(
                  f.stories.stories.map(s =>
                      compact({
                          id: s.id,
                          title: text(s.title),
                          acceptanceCriteria: s.criteria.map(c => compact({ id: c.id, text: text(c.text) })),
                      }),
                  ),
              )
            : undefined,
    });
}

function assumption(a: ast.PrdAssumptionDef): PrdAssumption {
    return compact({ name: text(a.name), statement: text(a.statement), impactIfWrong: text(a.impactIfWrong), validationPlan: text(a.validationPlan), status: a.status, underpins: nonEmpty(texts(a.underpins)) });
}

function risk(r: ast.PrdRiskDef): PrdRisk {
    return compact({ name: text(r.name), statement: text(r.statement), likelihood: r.likelihood, impact: r.impact, mitigation: r.mitigation, owner: text(r.owner), threatens: nonEmpty(texts(r.threatens)) });
}

function constraint(c: ast.PrdConstraintDef): PrdConstraint {
    return compact({ name: text(c.name), statement: text(c.statement), source: c.source, constrains: nonEmpty(texts(c.constrains)) });
}

function openQuestion(q: ast.PrdOpenQuestionDef): PrdOpenQuestion {
    return compact({
        name: text(q.name),
        question: text(q.question),
        context: text(q.context),
        owner: text(q.owner),
        deadline: q.deadline,
        status: q.status,
        blocks: nonEmpty(texts(q.blocks)),
        resolution: q.resolution === undefined ? undefined : text(q.resolution),
    });
}

function release(r: ast.PrdReleaseDef): PrdRelease {
    const out: PrdRelease = { name: text(r.name) };
    for (const m of r.members) {
        if (ast.isPrdTargetDateDecl(m)) out.targetDate ??= text(m.value);
        else if (ast.isPrdThemeDecl(m)) out.theme ??= text(m.value);
        else if (ast.isPrdReleaseStatusDecl(m)) out.status ??= m.value;
        else if (ast.isPrdDependsOnDecl(m)) out.dependsOn = [...(out.dependsOn ?? []), ...texts(m.items)];
        else if (ast.isPrdIncludesBlock(m)) out.includes = [...(out.includes ?? []), ...texts(m.items)];
        else if (ast.isPrdEntryCriteriaBlock(m)) out.entryCriteria = [...(out.entryCriteria ?? []), ...texts(m.items)];
        else if (ast.isPrdExitCriteriaBlock(m)) out.exitCriteria = [...(out.exitCriteria ?? []), ...texts(m.items)];
    }
    return compact(out);
}

function journey(j: ast.PrdJourneyDef): PrdJourney {
    return compact({
        name: text(j.name),
        persona: text(j.persona),
        trigger: text(j.trigger),
        outcome: text(j.outcome),
        designReferences: designReferences(j.designReferences),
        steps: j.steps ? nonEmpty(j.steps.steps.map(step)) : undefined,
    });
}

function step(s: ast.PrdStepDef): PrdStep {
    const out: PrdStep = {};
    if (s.number !== undefined) out.number = Number(s.number);
    if (s.name !== undefined) out.name = text(s.name);
    for (const m of s.members) {
        if (ast.isPrdStepActionDecl(m)) out.action ??= text(m.value);
        else if (ast.isPrdStepSystemResponseDecl(m)) out.systemResponse ??= text(m.value);
        else if (ast.isPrdStepChannelDecl(m)) out.channel ??= m.value;
        else if (ast.isPrdStepToneDecl(m)) out.emotionalTone ??= m.value;
        else if (ast.isPrdStepOrderDecl(m)) out.order ??= Number(m.value);
    }
    return compact(out);
}
