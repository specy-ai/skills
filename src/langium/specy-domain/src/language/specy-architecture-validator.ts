/**
 * Semantic rules of the .arch language that the grammar leaves to a validator
 * (SOFTWARE-ARCHITECTURE-METAMODEL.md): one root per file; at most one
 * requirements-source; a system's `area` and `detailed-in` at most once; a
 * system detailed inline or by `detailed-in`, not both; flow numbers unique in
 * the organization; a flow's phases declared by the organization, each listed at
 * most once; a dependency's patterns at most one per side, Partnership alone.
 * Every rule is an error on the node that breaks it.
 */
import type { ValidationAcceptor, ValidationChecks } from 'langium';
import * as ast from '../generated/ast.js';
import type { SpecyArchitectureServices } from './specy-architecture-module.js';

const DOWNSTREAM = new Set(['CS', 'Conformist', 'ACL']);
const UPSTREAM = new Set(['OHS']);
const SYMMETRIC = new Set(['SharedKernel', 'PublishedLanguage', 'Partnership']);

export class SpecyArchitectureValidator {
    checkFile(file: ast.ArchFile, accept: ValidationAcceptor): void {
        if (file.roots.length > 1) {
            for (const root of file.roots.slice(1)) {
                accept('error', 'One root per file: a .arch file holds one architecture or one organization.', { node: root, property: 'name' });
            }
        }
    }

    checkArchitecture(a: ast.ArchArchitectureDef, accept: ValidationAcceptor): void {
        const sources = a.members.filter(ast.isArchRequirementsSourceDecl);
        for (const s of sources.slice(1)) accept('error', 'At most one requirements-source per architecture.', { node: s });
        const systems = a.members.filter(ast.isArchSystemDef);
        for (const s of systems.slice(1)) accept('error', 'An architecture has one system in focus.', { node: s, property: 'name' });
    }

    checkOrganization(o: ast.ArchOrganizationDef, accept: ValidationAcceptor): void {
        const sources = o.members.filter(ast.isArchRequirementsSourceDecl);
        for (const s of sources.slice(1)) accept('error', 'At most one requirements-source per organization.', { node: s });
        if (!o.members.some(ast.isArchOrgSystemDef)) {
            accept('error', 'An organization declares at least one system.', { node: o, property: 'name' });
        }
        const phases = new Set(o.members.filter(ast.isArchPhaseDef).map(p => p.name));
        const flowNumbers = new Map<string, ast.ArchFlowDef>();
        for (const d of o.members.filter(ast.isArchDependencyDef)) {
            for (const f of d.flows) {
                const seen = flowNumbers.get(f.number);
                if (seen) accept('error', `Flow number ${f.number} is already used; flow numbers are unique in the organization and never reused.`, { node: f, property: 'number' });
                else flowNumbers.set(f.number, f);
                const listed = new Set<string>();
                for (const p of f.phases) {
                    if (!phases.has(p.phase)) accept('error', `Phase ${p.phase} is not declared by the organization.`, { node: p, property: 'phase' });
                    if (listed.has(p.phase)) accept('error', `Phase ${p.phase} is listed twice on flow ${f.number}.`, { node: p, property: 'phase' });
                    listed.add(p.phase);
                }
            }
        }
    }

    checkOrgSystem(s: ast.ArchOrgSystemDef, accept: ValidationAcceptor): void {
        const areas = s.level0.filter(ast.isArchAreaRef);
        for (const a of areas.slice(1)) accept('error', 'A system belongs to at most one area.', { node: a });
        const detailedIn = s.level0.filter(ast.isArchDetailedInDecl);
        for (const d of detailedIn.slice(1)) accept('error', 'detailed-in appears at most once.', { node: d });
        if (detailedIn.length && s.members.length) {
            accept('error', `System ${s.name} is detailed inline and by detailed-in: choose one.`, { node: detailedIn[0] });
        }
    }

    checkDependency(d: ast.ArchDependencyDef, accept: ValidationAcceptor): void {
        const down = d.patterns.filter(p => DOWNSTREAM.has(p));
        const up = d.patterns.filter(p => UPSTREAM.has(p));
        const sym = d.patterns.filter(p => SYMMETRIC.has(p));
        if (down.length > 1) accept('error', `At most one downstream pattern (CS, Conformist, ACL): found ${down.join(', ')}.`, { node: d, property: 'patterns' });
        if (up.length > 1) accept('error', 'At most one upstream pattern (OHS).', { node: d, property: 'patterns' });
        if (sym.length > 1) accept('error', `At most one symmetric pattern: found ${sym.join(', ')}.`, { node: d, property: 'patterns' });
        if (d.patterns.includes('Partnership') && d.patterns.length > 1) {
            accept('error', 'Partnership excludes the one-sided patterns.', { node: d, property: 'patterns' });
        }
        if (d.downstream === d.upstream) accept('error', 'A system does not depend on itself.', { node: d, property: 'upstream' });
    }

    checkNode(n: ast.ArchNodeDef, accept: ValidationAcceptor): void {
        const seen = new Set<string>();
        for (const a of n.attributes) {
            if (a.kind && seen.has(a.kind)) accept('error', `${a.kind} appears twice on node ${n.name}.`, { node: a });
            if (a.kind) seen.add(a.kind);
        }
    }
}

export function registerArchitectureValidationChecks(services: SpecyArchitectureServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SpecyArchitectureValidator;
    const checks: ValidationChecks<ast.SpecyDomainAstType> = {
        ArchFile: validator.checkFile,
        ArchArchitectureDef: validator.checkArchitecture,
        ArchOrganizationDef: validator.checkOrganization,
        ArchOrgSystemDef: validator.checkOrgSystem,
        ArchDependencyDef: validator.checkDependency,
        ArchNodeDef: validator.checkNode,
    };
    registry.register(checks, validator);
}
