/**
 * Normalizer: .sysreq AST -> the requirements document.
 *
 * One requirement set per `requirements "…" scoped-to X { }` block, in file
 * order; inside a set, the loose requirements and the modules keep their own
 * order, the prd-source paths are gathered first. A requirement's clauses may
 * be written on either side of the EARS statement in the DSL; the document
 * gives each one place (rationale, source, dependsOn, conflictsWith,
 * decomposedInto, satisfiedBy), so two files that differ only in clause order
 * are the same document.
 *
 * Strings that wrap over lines (statements, rationales, sources) collapse to
 * one line. A satisfaction link's target keeps the DSL spelling
 * (`LoanApplication."Create application"`, `LoanApplication.status`,
 * `CreateLoanApplication`): unambiguous, and what the printer writes back.
 */
import * as ast from '../../generated/ast.js';
import { PARSER_VERSION, SYSREQ_SCHEMA } from '../../cli/version.js';
import { collapse, compact, nonEmpty } from '../kit/text.js';

export type SatisfactionRole =
    | 'implemented-by'
    | 'structured-by'
    | 'enforced-by'
    | 'detected-by'
    | 'quality-constrained-by'
    | 'satisfied-by-infrastructure';

export interface SatisfactionLink {
    role: SatisfactionRole;
    /** Absent for `satisfied-by-infrastructure`. */
    target?: string;
}

export interface Requirement {
    id: string;
    name: string;
    pattern: string;
    rationale?: string;
    statement: string;
    priority: string;
    source?: string;
    dependsOn?: string[];
    conflictsWith?: string[];
    decomposedInto?: string[];
    satisfiedBy?: SatisfactionLink[];
}

export interface RequirementModule {
    name: string;
    requirements?: Requirement[];
}

export interface RequirementSet {
    name: string;
    scope: string;
    prdSources?: string[];
    requirements?: Requirement[];
    modules?: RequirementModule[];
}

export interface SysreqDocument {
    $schema: string;
    parser: { name: string; version: string };
    requirementSets: RequirementSet[];
}

export function normalizeSysreq(file: ast.ReqFile): SysreqDocument {
    return {
        $schema: SYSREQ_SCHEMA,
        parser: { name: 'specy-sysreq', version: PARSER_VERSION },
        requirementSets: (file.sets ?? []).map(normalizeSet),
    };
}

function normalizeSet(set: ast.ReqSetDef): RequirementSet {
    const prdSources: string[] = [];
    const requirements: Requirement[] = [];
    const modules: RequirementModule[] = [];
    for (const m of set.members ?? []) {
        if (ast.isReqPrdSourceDecl(m)) prdSources.push(m.path);
        else if (ast.isReqModuleBlock(m)) {
            modules.push(compact({ name: collapse(m.name) ?? '', requirements: nonEmpty((m.requirements ?? []).map(normalizeRequirement)) }));
        } else requirements.push(normalizeRequirement(m));
    }
    return compact({
        name: collapse(set.name) ?? '',
        scope: set.scope,
        prdSources: nonEmpty(prdSources),
        requirements: nonEmpty(requirements),
        modules: nonEmpty(modules),
    });
}

export function normalizeRequirement(r: ast.ReqRequirementDef): Requirement {
    const req: Requirement = {
        id: r.id,
        name: collapse(r.name) ?? '',
        pattern: r.pattern,
        statement: collapse(r.statement) ?? '',
        priority: r.priority,
    };
    const dependsOn: string[] = [];
    const conflictsWith: string[] = [];
    const decomposedInto: string[] = [];
    const satisfiedBy: SatisfactionLink[] = [];
    for (const c of r.clauses ?? []) {
        if (ast.isReqRationale(c)) req.rationale ??= collapse(c.text);
        else if (ast.isReqSourceDecl(c)) req.source ??= collapse(c.reference);
        else if (ast.isReqDependsOn(c)) dependsOn.push(...c.ids);
        else if (ast.isReqConflictsWith(c)) conflictsWith.push(...c.ids);
        else if (ast.isReqDecomposedInto(c)) decomposedInto.push(...c.ids);
        else if (ast.isReqSatisfiedBy(c)) {
            for (const l of c.links ?? []) {
                satisfiedBy.push(compact({ role: l.role as SatisfactionRole, target: l.target ? refToString(l.target) : undefined }));
            }
        }
    }
    return compact({
        ...req,
        dependsOn: nonEmpty(dependsOn),
        conflictsWith: nonEmpty(conflictsWith),
        decomposedInto: nonEmpty(decomposedInto),
        satisfiedBy: nonEmpty(satisfiedBy),
    }) as Requirement;
}

/** `Type`, `Type.field` or `Type."operation label"` — as the DSL writes it. */
export function refToString(ref: ast.ReqDomainRef): string {
    if (ref.label !== undefined) return `${ref.head}."${ref.label.replace(/"/g, "'")}"`;
    if (ref.member !== undefined) return `${ref.head}.${ref.member}`;
    return ref.head;
}
