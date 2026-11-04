/**
 * DSL printer for the requirements document: the inverse of the normalizer
 * (model.ts). The text it writes parses back to the same document — the round
 * trip the tests pin on every example.
 *
 * House order inside a requirement: rationale, source, the EARS statement,
 * priority, then the traceability clauses (depends-on, conflicts-with,
 * decomposed-into, satisfied-by). A file whose clauses were written in another
 * order comes back in this one: same document, canonical text.
 */
import { IndentWriter, quote } from '../kit/dsl.js';
import type { Requirement, RequirementModule, RequirementSet, SatisfactionLink, SysreqDocument } from './model.js';

export function printSysreq(doc: SysreqDocument): string {
    const w = new IndentWriter('  ');
    for (const set of doc.requirementSets ?? []) {
        printSet(w, set);
        w.blank();
    }
    return w.toString();
}

function printSet(w: IndentWriter, set: RequirementSet): void {
    w.block(`requirements ${quote(set.name)} scoped-to ${set.scope}`, () => {
        for (const p of set.prdSources ?? []) w.line(`prd-source ${quote(p)}`);
        for (const r of set.requirements ?? []) {
            w.blank();
            printRequirement(w, r);
        }
        for (const m of set.modules ?? []) {
            w.blank();
            printModule(w, m);
        }
    });
}

function printModule(w: IndentWriter, m: RequirementModule): void {
    w.block(`module ${quote(m.name)}`, () => {
        for (const r of m.requirements ?? []) {
            w.blank();
            printRequirement(w, r);
        }
    });
}

export function printRequirement(w: IndentWriter, r: Requirement): void {
    w.line(`${r.id} ${quote(r.name)} : ${r.pattern}`);
    // The clauses sit one level in from the id line (no braces, so a nested writer re-indented).
    const inner = new IndentWriter(w.indent);
    if (r.rationale) inner.line(`:: ${quote(r.rationale)}`);
    if (r.source) inner.line(`source ${quote(r.source)}`);
    inner.line(quote(r.statement));
    inner.line(`priority ${r.priority}`);
    if (r.dependsOn?.length) inner.line(`depends-on ${r.dependsOn.join(', ')}`);
    if (r.conflictsWith?.length) inner.line(`conflicts-with ${r.conflictsWith.join(', ')}`);
    if (r.decomposedInto?.length) {
        inner.block('decomposed-into', () => {
            for (const id of r.decomposedInto!) inner.line(id);
        });
    }
    if (r.satisfiedBy?.length) {
        inner.block('satisfied-by', () => {
            for (const l of r.satisfiedBy!) inner.line(linkText(l));
        });
    }
    for (const row of inner.toString().replace(/\s+$/, '').split('\n')) {
        w.line(row === '' ? '' : w.indent + row);
    }
}

export function linkText(l: SatisfactionLink): string {
    return l.role === 'satisfied-by-infrastructure' || !l.target ? l.role : `${l.role} ${l.target}`;
}

/** The clause lines of one requirement, for a Markdown island or a test. */
export function requirementText(r: Requirement): string {
    const w = new IndentWriter('  ');
    printRequirement(w, r);
    return w.toString();
}
