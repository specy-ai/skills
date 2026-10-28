/**
 * Read-side view of a .domain AST for the .synth language: which names are row
 * sources, what a path segment may resolve to next, and the type at a path's
 * leaf. It mirrors `DomainIndex.resolve` in synthy (src/domain/index.ts) on the
 * AST instead of the JSON, so the editor accepts exactly the paths the generator
 * accepts: identity and fields are columns, a value-typed field opens the value
 * type's fields, a reference or an entity-typed field leaves the table.
 */
import { AstUtils, UriUtils, type AstNode, type LangiumDocument, type LangiumDocuments, type URI } from 'langium';
import * as ast from '../generated/ast.js';

export type EntityLike = ast.EntityDef | ast.AggregateDef | ast.ReadOnlyEntityDef;
export type RowSource = EntityLike | ast.ValueDef;
export type Construct = RowSource | ast.EnumDef;

export interface LeafType {
    kind: 'primitive' | 'enum' | 'value' | 'entity' | 'collection' | 'machine' | 'unknown';
    /** As written in the model: `decimal`, `Money`, `list<OrderLine>`. */
    name: string;
    def?: Construct;
    element?: LeafType;
}

export interface ResolvedSynthPath {
    root: RowSource;
    /** The node the last segment resolved to (the root itself for a bare entity path). */
    last: AstNode;
    leaf: LeafType;
    /** True when the path crosses a reference or an entity-typed field: it leaves the root's table. */
    viaReference: boolean;
    /** Flattened column on the root's table, when the path stays within it and names a field. */
    column?: string;
    segments: string[];
}

/** Same sets as synthy's domain index. */
export const NUMERIC_PRIMITIVES = new Set(['int', 'integer', 'long', 'decimal']);
export const TEMPORAL_PRIMITIVES = new Set(['date', 'datetime']);

export function isEntityLike(n: AstNode | undefined): n is EntityLike {
    return !!n && (ast.isEntityDef(n) || ast.isAggregateDef(n) || ast.isReadOnlyEntityDef(n));
}

export function isRowSource(n: AstNode | undefined): n is RowSource {
    return isEntityLike(n) || ast.isValueDef(n);
}

/** Cardinality `a..b`: single when b is 1. */
export function isSingleCardinality(raw: string | undefined): boolean {
    const m = /^(\d+)\.\.(\d+|[nN])$/.exec(raw ?? '');
    return !m || m[2] === '1';
}

const cache = new WeakMap<ast.DomainFile, DomainAstIndex>();

export class DomainAstIndex {
    private readonly byName = new Map<string, Construct>();

    private constructor(readonly root: ast.DomainFile) {
        for (const n of AstUtils.streamAllContents(root)) {
            if (isRowSource(n) || ast.isEnumDef(n)) this.byName.set(n.name, n);
        }
    }

    /** One index per parsed domain file; a reparse yields a new root and a new index. */
    static of(root: ast.DomainFile): DomainAstIndex {
        let idx = cache.get(root);
        if (!idx) cache.set(root, (idx = new DomainAstIndex(root)));
        return idx;
    }

    construct(name: string | undefined): Construct | undefined {
        return name ? this.byName.get(name) : undefined;
    }

    rowSources(): RowSource[] {
        return [...this.byName.values()].filter(isRowSource);
    }

    constructs(): Construct[] {
        return [...this.byName.values()];
    }

    /** Identity and fields: what a population's clock may name. */
    columnsOf(c: RowSource): AstNode[] {
        return isEntityLike(c) ? [c.identity, ...c.fields.fields] : [...c.fields.fields];
    }

    machinesOf(c: AstNode | undefined): ast.StateMachineDef[] {
        return isEntityLike(c) && !ast.isReadOnlyEntityDef(c) ? (c.states?.machines ?? []) : [];
    }

    statesOf(m: ast.StateMachineDef): ast.StateDef[] {
        return m.members.filter(ast.isStateDef);
    }

    transitionsOf(m: ast.StateMachineDef): ast.TransitionDef[] {
        return m.members.filter(ast.isTransitionDef);
    }

    /** Every state name a machine mentions: declared states plus transition endpoints. */
    stateNamesOf(m: ast.StateMachineDef): string[] {
        const names = new Set<string>(this.statesOf(m).map(s => s.name));
        for (const t of this.transitionsOf(m)) {
            if (t.source !== '[*]') names.add(t.source);
            names.add(t.target);
        }
        return [...names];
    }

    /** States reachable from the start pseudo-state by following transitions. */
    reachableStatesOf(m: ast.StateMachineDef): Set<string> {
        const next = new Map<string, string[]>();
        for (const t of this.transitionsOf(m)) {
            const list = next.get(t.source) ?? [];
            list.push(t.target);
            next.set(t.source, list);
        }
        const seen = new Set<string>();
        const todo = [...(next.get('[*]') ?? [])];
        while (todo.length) {
            const s = todo.pop()!;
            if (seen.has(s)) continue;
            seen.add(s);
            todo.push(...(next.get(s) ?? []));
        }
        return seen;
    }

    /** Enums whose members are instances of a value type: the ones a given may supply. */
    valueEnums(): ast.EnumDef[] {
        return [...this.byName.values()].filter((c): c is ast.EnumDef => ast.isEnumDef(c) && !!c.valueType);
    }

    /** What the next path segment may name after `node`. */
    membersOf(node: AstNode | undefined): AstNode[] {
        if (isEntityLike(node)) return [node.identity, ...node.fields.fields, ...(node.references?.refs ?? []), ...this.machinesOf(node)];
        if (ast.isValueDef(node)) return [...node.fields.fields];
        if (ast.isFieldDecl(node) || ast.isIdentityDecl(node)) {
            const t = this.typeOf(node.type);
            const def = t.kind === 'collection' ? t.element?.def : t.def;
            return isRowSource(def) ? this.membersOf(def) : [];
        }
        if (ast.isReferenceDecl(node)) {
            const def = this.construct(node.target);
            return isRowSource(def) ? this.membersOf(def) : [];
        }
        return [];
    }

    typeOf(t: ast.FieldType | undefined): LeafType {
        if (!t) return { kind: 'unknown', name: '?' };
        if (ast.isPrimitiveType(t)) return { kind: 'primitive', name: t.value };
        if (ast.isCollectionType(t)) {
            const element = this.typeOf(t.elementType);
            return { kind: 'collection', name: `${t.kind}<${element.name}>`, element };
        }
        if (ast.isGenericType(t)) return { kind: 'unknown', name: t.$cstNode?.text ?? t.typeName };
        const def = this.construct(t.typeName);
        if (ast.isEnumDef(def)) return { kind: 'enum', name: t.typeName, def };
        if (ast.isValueDef(def)) return { kind: 'value', name: t.typeName, def };
        if (isEntityLike(def)) return { kind: 'entity', name: t.typeName, def };
        return { kind: 'unknown', name: t.typeName };
    }

    /** The type a resolved segment stands for. */
    leafOf(node: AstNode): LeafType {
        if (isRowSource(node)) return { kind: ast.isValueDef(node) ? 'value' : 'entity', name: node.name, def: node };
        if (ast.isFieldDecl(node) || ast.isIdentityDecl(node)) return this.typeOf(node.type);
        if (ast.isReferenceDecl(node)) {
            const def = this.construct(node.target);
            const element: LeafType = { kind: ast.isValueDef(def) ? 'value' : 'entity', name: node.target, def: isRowSource(def) ? def : undefined };
            return isSingleCardinality(node.cardinality) ? element : { kind: 'collection', name: `list<${node.target}>`, element };
        }
        if (ast.isStateMachineDef(node)) return { kind: 'machine', name: node.name };
        return { kind: 'unknown', name: '?' };
    }

    /** Follow a .synth path through resolved references. Undefined when any segment is unresolved. */
    resolvePath(path: ast.SynthPath | undefined): ResolvedSynthPath | undefined {
        const root = path?.root?.ref;
        if (!path || !isRowSource(root)) return undefined;
        let viaReference = false;
        const column: string[] = [];
        let last: AstNode = root;
        for (const step of path.steps) {
            const t = step.target?.ref;
            if (!t) return undefined;
            if (ast.isReferenceDecl(t)) viaReference = true;
            else if (ast.isFieldDecl(t) || ast.isIdentityDecl(t)) {
                const lt = this.typeOf(t.type);
                if (lt.kind === 'entity' || (lt.kind === 'collection' && (lt.element?.kind === 'entity' || lt.element?.kind === 'value'))) viaReference = true;
                column.push(t.name);
            }
            last = t;
        }
        return {
            root,
            last,
            leaf: this.leafOf(last),
            viaReference,
            column: viaReference || column.length === 0 ? undefined : column.join('_'),
            segments: [root.name, ...path.steps.map(s => s.target?.$refText ?? '?')],
        };
    }

    /** The enum an outcome's dimension or predicate path ends on, if any. */
    enumAt(path: ast.SynthPath | undefined): ast.EnumDef | undefined {
        const r = this.resolvePath(path);
        return r && r.leaf.kind === 'enum' && ast.isEnumDef(r.leaf.def) ? r.leaf.def : undefined;
    }

    /** `Entity` (first machine) or `Entity.Machine`, as a mix names it. */
    machineAt(path: ast.SynthPath | undefined): ast.StateMachineDef | undefined {
        const root = path?.root?.ref;
        if (!path || !isEntityLike(root)) return undefined;
        if (path.steps.length === 0) return this.machinesOf(root)[0];
        if (path.steps.length > 1) return undefined;
        const m = path.steps[0].target?.ref;
        return ast.isStateMachineDef(m) ? m : undefined;
    }
}

export interface DomainLookup {
    /** The `domain-source` path as written. */
    declared?: string;
    uri?: URI;
    document?: LangiumDocument;
    index?: DomainAstIndex;
}

/** The .domain a node's .synth file declares, if that document is loaded. */
export function domainOf(node: AstNode, documents: LangiumDocuments): DomainLookup {
    const doc = AstUtils.getDocument(node);
    const file = doc.parseResult.value as ast.SynthFile;
    const declared = file.scenario?.domainSource?.path;
    if (!declared) return {};
    const uri = UriUtils.resolvePath(UriUtils.dirname(doc.uri), declared);
    const document = documents.getDocument(uri);
    const root = document?.parseResult.value;
    return { declared, uri, document, index: root && ast.isDomainFile(root) ? DomainAstIndex.of(root) : undefined };
}

/** The segment before a path step: the root for the first step, the previous step otherwise. */
export function previousOf(step: ast.SynthPathStep): AstNode | undefined {
    const path = step.$container;
    const i = step.$containerIndex ?? 0;
    if (ast.isGivenColumn(path)) return i === 0 ? path.$container.entity?.ref : path.steps[i - 1]?.target?.ref;
    return i === 0 ? path.root?.ref : path.steps[i - 1]?.target?.ref;
}

/** The construct a given's rows are rows of: the entity or value type, or an enum's value type. */
export function givenRowsOf(index: DomainAstIndex, g: ast.GivenDecl): RowSource | undefined {
    const target = g.entity?.ref;
    if (ast.isEnumDef(target)) {
        const vt = index.construct(target.valueType);
        return isRowSource(vt) ? vt : undefined;
    }
    return isRowSource(target) ? target : undefined;
}

/** True for the first step of a mix's path: the place that names a state machine. */
export function isMachineStep(step: ast.SynthPathStep): boolean {
    return (step.$containerIndex ?? 0) === 0 && ast.isMixOutcome(step.$container.$container);
}

/** A short label for a resolved node in a message: `entity Order`, `field Order.totalAmount : Money`. */
export function describeNode(n: AstNode | undefined): string {
    if (!n) return 'an unresolved element';
    if (ast.isEntityDef(n)) return `entity ${n.name}`;
    if (ast.isAggregateDef(n)) return `aggregate ${n.name}`;
    if (ast.isReadOnlyEntityDef(n)) return `read-only entity ${n.name}`;
    if (ast.isValueDef(n)) return `value type ${n.name}`;
    if (ast.isEnumDef(n)) return `enum ${n.name}`;
    if (ast.isFieldDecl(n) || ast.isIdentityDecl(n)) return `${ast.isIdentityDecl(n) ? 'identity' : 'field'} ${ownerName(n)}.${n.name} : ${n.type.$cstNode?.text ?? '?'}`;
    if (ast.isReferenceDecl(n)) return `reference ${ownerName(n)}.${n.name} : ${n.target} ${n.cardinality}`;
    if (ast.isStateMachineDef(n)) return `machine ${ownerName(n)}.${n.name}`;
    if (ast.isStateDef(n)) return `state ${n.name}`;
    if (ast.isEnumValue(n)) return `member ${n.name}`;
    return n.$type;
}

function ownerName(n: AstNode): string {
    const owner = AstUtils.getContainerOfType(n, (x): x is Construct => isRowSource(x) || ast.isEnumDef(x));
    return owner?.name ?? '?';
}
