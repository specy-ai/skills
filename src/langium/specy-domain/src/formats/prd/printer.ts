/**
 * DSL printer for the product requirements document: the inverse of the
 * normalizer (model.ts). `printPrd(document)` writes a `.prd` text that the
 * parser reads back into the same document — the round trip the tests pin on
 * every example. Members come out in the metamodel's order; comments are gone.
 */
import { IndentWriter, quote } from '../kit/dsl.js';
import type { PrdDesignReference, PrdDocument, PrdFeature, PrdGoal, PrdJob, PrdJourney, PrdProduct, PrdRelease, PrdStep } from './model.js';

export function printPrd(doc: PrdDocument): string {
    const w = new IndentWriter('  ');
    for (const p of doc.products ?? []) {
        printProduct(w, p);
        w.blank();
    }
    return w.toString();
}

/** `keyword "a", "b"` — a comma list of strings. */
function inlineList(w: IndentWriter, keyword: string, items: string[] | undefined): void {
    if (items?.length) w.line(`${keyword} ${items.map(quote).join(', ')}`);
}

/** `keyword { "a" "b" }` — one string per line. */
function block(w: IndentWriter, keyword: string, items: string[] | undefined): void {
    if (!items?.length) return;
    w.block(keyword, () => {
        for (const it of items) w.line(quote(it));
    });
}

function printProduct(w: IndentWriter, p: PrdProduct): void {
    w.block(`product ${quote(p.name)}`, () => {
        if (p.vision !== undefined) w.line(`vision ${quote(p.vision)}`);
        block(w, 'scope', p.scope);
        block(w, 'non-goals', p.nonGoals);
        if (p.problem) {
            w.block('problem', () => {
                w.line(`situation ${quote(p.problem!.situation)}`);
                w.line(`complication ${quote(p.problem!.complication)}`);
                w.line(`question ${quote(p.problem!.question)}`);
            });
        }
        for (const e of p.evidence ?? []) {
            w.blank();
            w.block(`evidence ${quote(e.name)}`, () => {
                w.line(`type ${e.type}`);
                w.line(`summary ${quote(e.summary)}`);
                w.line(`source-reference ${quote(e.sourceReference)}`);
                w.line(`date ${e.date}`);
                w.line(`confidence ${e.confidence}`);
                w.line(`supports ${quote(e.supports)}`);
            });
        }
        for (const x of p.personas ?? []) {
            w.blank();
            w.block(`persona ${quote(x.name)}`, () => {
                w.line(`role ${quote(x.role)}`);
                block(w, 'goals', x.goals.length ? x.goals : ['']);
                block(w, 'frustrations', x.frustrations.length ? x.frustrations : ['']);
                w.line(`context ${quote(x.context)}`);
                w.line(`weight ${x.weight}`);
            });
        }
        for (const j of p.jobs ?? []) {
            w.blank();
            printJob(w, j);
        }
        for (const g of p.goals ?? []) {
            w.blank();
            printGoal(w, g);
        }
        for (const h of p.hypotheses ?? []) {
            w.blank();
            w.block(`hypothesis ${quote(h.name)}`, () => {
                w.line(`intervention ${quote(h.intervention)}`);
                w.line(`expected-outcome ${quote(h.expectedOutcome)}`);
                w.line(`mechanism ${quote(h.mechanism)}`);
                w.line(`validation-method ${quote(h.validationMethod)}`);
                w.line(`status ${h.status}`);
                w.line(`proposes ${quote(h.proposes)}`);
                w.line(`predicts ${quote(h.predicts)}`);
                inlineList(w, 'supported-by', h.supportedBy);
            });
        }
        for (const f of p.features ?? []) {
            w.blank();
            printFeature(w, f);
        }
        for (const a of p.assumptions ?? []) {
            w.blank();
            w.block(`assumption ${quote(a.name)}`, () => {
                w.line(`statement ${quote(a.statement)}`);
                w.line(`impact-if-wrong ${quote(a.impactIfWrong)}`);
                w.line(`validation-plan ${quote(a.validationPlan)}`);
                w.line(`status ${a.status}`);
                inlineList(w, 'underpins', a.underpins);
            });
        }
        for (const r of p.risks ?? []) {
            w.blank();
            w.block(`risk ${quote(r.name)}`, () => {
                w.line(`statement ${quote(r.statement)}`);
                w.line(`likelihood ${r.likelihood}`);
                w.line(`impact ${r.impact}`);
                w.line(`mitigation ${r.mitigation}`);
                w.line(`owner ${quote(r.owner)}`);
                inlineList(w, 'threatens', r.threatens);
            });
        }
        for (const c of p.constraints ?? []) {
            w.blank();
            w.block(`constraint ${quote(c.name)}`, () => {
                w.line(`statement ${quote(c.statement)}`);
                w.line(`source ${c.source}`);
                inlineList(w, 'constrains', c.constrains);
            });
        }
        for (const q of p.openQuestions ?? []) {
            w.blank();
            w.block(`open-question ${quote(q.name)}`, () => {
                w.line(`question ${quote(q.question)}`);
                w.line(`context ${quote(q.context)}`);
                w.line(`owner ${quote(q.owner)}`);
                w.line(`deadline ${q.deadline}`);
                w.line(`status ${q.status}`);
                inlineList(w, 'blocks', q.blocks);
                if (q.resolution !== undefined) w.line(`resolution ${quote(q.resolution)}`);
            });
        }
        for (const r of p.releases ?? []) {
            w.blank();
            printRelease(w, r);
        }
        for (const j of p.journeys ?? []) {
            w.blank();
            printJourney(w, j);
        }
    });
}

function printJob(w: IndentWriter, j: PrdJob): void {
    w.block(`job ${quote(j.name)}`, () => {
        w.line(`persona ${quote(j.persona)}`);
        w.line(`statement ${quote(j.statement)}`);
        w.line(`type ${j.type}`);
        w.line(`importance ${j.importance}`);
        w.line(`satisfaction ${j.satisfaction}`);
        inlineList(w, 'related-to', j.relatedTo);
        if (j.desiredOutcomes?.length) {
            w.block('desired-outcomes', () => {
                for (const o of j.desiredOutcomes!) {
                    w.block(quote(o.statement), () => {
                        w.line(`importance ${o.importance}`);
                        w.line(`current-satisfaction ${o.currentSatisfaction}`);
                    });
                }
            });
        }
    });
}

function printGoal(w: IndentWriter, g: PrdGoal): void {
    w.block(`goal ${quote(g.name)}`, () => {
        w.line(`statement ${quote(g.statement)}`);
        w.line(`horizon ${g.horizon}`);
        w.line(`owner ${quote(g.owner)}`);
        for (const m of g.metrics ?? []) {
            w.block('metric', () => {
                w.line(`indicator ${quote(m.indicator)}`);
                w.line(`target ${quote(m.target)}`);
                if (m.baseline !== undefined) w.line(`baseline ${quote(m.baseline)}`);
                w.line(`measurement ${quote(m.measurement)}`);
            });
        }
    });
}

function printDesignReferences(w: IndentWriter, refs: PrdDesignReference[] | undefined): void {
    if (!refs?.length) return;
    w.block('design-references', () => {
        for (const r of refs) w.line(`${quote(r.name)} -> ${quote(r.url)}`);
    });
}

function printFeature(w: IndentWriter, f: PrdFeature): void {
    w.block(`feature ${f.id ? `${f.id} ` : ''}${quote(f.name)}`, () => {
        w.line(`summary ${quote(f.summary)}`);
        w.line(`persona ${quote(f.persona)}`);
        w.line(`value-proposition ${quote(f.valueProposition)}`);
        w.line(`priority ${f.priority}`);
        w.line(`status ${f.status}`);
        inlineList(w, 'addresses', f.addresses);
        inlineList(w, 'advances', f.advances);
        if (f.testedBy !== undefined) w.line(`tested-by ${quote(f.testedBy)}`);
        printDesignReferences(w, f.designReferences);
        block(w, 'non-goals', f.nonGoals);
        if (f.stories?.length) {
            w.block('stories', () => {
                for (const s of f.stories!) {
                    w.block(`${s.id ? `${s.id} ` : ''}${quote(s.title)}`, () => {
                        w.block('acceptance-criteria', () => {
                            for (const c of s.acceptanceCriteria.length ? s.acceptanceCriteria : [{ text: '' }]) {
                                w.line(`${c.id ? `${c.id} ` : ''}${quote(c.text)}`);
                            }
                        });
                    });
                }
            });
        }
    });
}

function printRelease(w: IndentWriter, r: PrdRelease): void {
    w.block(`release ${quote(r.name)}`, () => {
        if (r.targetDate !== undefined) w.line(`target-date ${quote(r.targetDate)}`);
        if (r.theme !== undefined) w.line(`theme ${quote(r.theme)}`);
        if (r.status !== undefined) w.line(`status ${r.status}`);
        inlineList(w, 'depends-on', r.dependsOn);
        block(w, 'includes', r.includes);
        block(w, 'entry-criteria', r.entryCriteria);
        block(w, 'exit-criteria', r.exitCriteria);
    });
}

function printJourney(w: IndentWriter, j: PrdJourney): void {
    w.block(`journey ${quote(j.name)} for ${quote(j.persona)}`, () => {
        w.line(`trigger ${quote(j.trigger)}`);
        w.line(`outcome ${quote(j.outcome)}`);
        printDesignReferences(w, j.designReferences);
        if (j.steps?.length) {
            w.block('steps', () => {
                for (const s of j.steps!) printStep(w, s);
            });
        }
    });
}

export function printStep(w: IndentWriter, s: PrdStep): void {
    const head = s.number !== undefined ? `step ${s.number}` : quote(s.name ?? '');
    w.block(head, () => {
        if (s.action !== undefined) w.line(`action ${quote(s.action)}`);
        if (s.systemResponse !== undefined) w.line(`system-response ${quote(s.systemResponse)}`);
        if (s.channel !== undefined) w.line(`channel ${s.channel}`);
        if (s.emotionalTone !== undefined) w.line(`emotional-tone ${s.emotionalTone}`);
        if (s.order !== undefined) w.line(`order ${s.order}`);
    });
}
