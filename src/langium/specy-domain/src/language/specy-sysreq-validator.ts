/**
 * Semantic rules of a .sysreq file that the grammar cannot carry:
 *   REQ-E001  a requirement id is declared twice in the file
 *   REQ-E003  a requirement depends on, conflicts with or decomposes into itself
 * A reference to an id the file does not declare is not reported: the target
 * may live in another file of the same project (platform-nfr.sysreq decomposes
 * into the requirements of the context files).
 */
import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { SpecyDomainAstType } from '../generated/ast.js';
import * as ast from '../generated/ast.js';
import type { SpecySysreqServices } from './specy-sysreq-module.js';

export class SpecySysreqValidator {
    checkFile(file: ast.ReqFile, accept: ValidationAcceptor): void {
        const declared = new Map<string, ast.ReqRequirementDef>();
        const all: ast.ReqRequirementDef[] = [];
        for (const set of file.sets ?? []) {
            for (const m of set.members ?? []) {
                if (ast.isReqRequirementDef(m)) all.push(m);
                else if (ast.isReqModuleBlock(m)) all.push(...(m.requirements ?? []));
            }
        }
        for (const r of all) {
            const first = declared.get(r.id);
            if (first) accept('error', `Requirement ${r.id} is declared twice ("${first.name}" and "${r.name}")`, { node: r, property: 'id', code: 'REQ-E001' });
            else declared.set(r.id, r);
        }
        for (const r of all) {
            for (const c of r.clauses ?? []) {
                if (ast.isReqDependsOn(c) || ast.isReqConflictsWith(c) || ast.isReqDecomposedInto(c)) {
                    c.ids.forEach((id, index) => {
                        if (id === r.id) accept('error', `${r.id} refers to itself`, { node: c, property: 'ids', index, code: 'REQ-E003' });
                    });
                }
            }
        }
    }
}

export function registerSysreqValidationChecks(services: SpecySysreqServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SpecySysreqValidator;
    const checks: ValidationChecks<SpecyDomainAstType> = {
        ReqFile: validator.checkFile,
    };
    registry.register(checks, validator);
}
