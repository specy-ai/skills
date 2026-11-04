/**
 * DSL printer for the architecture document: the inverse of the normalizer
 * (model.ts). `printArchitecture(doc)` writes a `.arch` text the parser reads
 * back into the same document — the round trip the tests pin on both example
 * files. Members come out grouped as the normalizer groups them (bounded
 * contexts, types, interfaces, containers, channels, connectors, environments),
 * one house style, comments gone.
 *
 * The block printers are exported for the Markdown writer, whose islands are
 * written in DSL syntax (interface operations, environments).
 */
import { IndentWriter, describe, isTypeName, literal, quote, satisfiesInline } from '../kit/dsl.js';
import type {
    ArchitectureDocument,
    ArchitectureModel,
    ComponentModel,
    ConnectorModel,
    ContainerModel,
    DependencyModel,
    DeployModel,
    EnvironmentModel,
    ExternalSystemModel,
    FieldModel,
    FlowModel,
    HotspotModel,
    InterfaceModel,
    MechanismModel,
    NodeModel,
    OperationModel,
    OrgSystemModel,
    OrganizationModel,
    RealizesRef,
    ResourceModel,
    SystemMembers,
    SystemModel,
    TypeModel,
} from './model.js';

export function printArchitecture(doc: ArchitectureDocument): string {
    const w = new IndentWriter('  ');
    if (doc.architecture) printArchitectureRoot(w, doc.architecture);
    if (doc.organization) printOrganizationRoot(w, doc.organization);
    return w.toString();
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function metaHead(metadata: Record<string, unknown> | undefined): string {
    if (!metadata || !Object.keys(metadata).length) return '';
    return ` meta { ${Object.entries(metadata)
        .map(([k, v]) => `${k} = ${literal(v)}`)
        .join(' ')} }`;
}

/** `name :: "description" meta { … }` — the head of most declarations. */
function head(keyword: string, name: string, c: { description?: string; metadata?: Record<string, unknown> }): string {
    return `${keyword} ${name}${describe(c.description)}${metaHead(c.metadata)}`;
}

/** A system name: bare when it is a type name, quoted otherwise. */
function systemName(name: string): string {
    return isTypeName(name) ? name : quote(name);
}

export function realizesText(refs: RealizesRef[] | undefined): string {
    if (!refs?.length) return '';
    return ` realizes ${refs.map(r => `${r.kind} ${r.kind === 'module' || r.kind === 'context' ? (isTypeName(r.name) ? r.name : quote(r.name)) : r.name}`).join(', ')}`;
}

function technologyText(t: string | undefined): string {
    return t ? ` technology ${quote(t)}` : '';
}

// ---------------------------------------------------------------------------
// architecture root
// ---------------------------------------------------------------------------

function printArchitectureRoot(w: IndentWriter, a: ArchitectureModel): void {
    w.block(head('architecture', systemName(a.name), a), () => {
        for (const d of a.domainSources ?? []) w.line(`domain-source ${quote(d)}`);
        if (a.requirementsSource) w.line(`requirements-source ${quote(a.requirementsSource)}`);
        if (a.persons?.length) w.blank();
        for (const p of a.persons ?? []) w.line(head('person', p.name, p));
        for (const e of a.externalSystems ?? []) {
            w.blank();
            printExternalSystem(w, e);
        }
        if (a.system) {
            w.blank();
            printSystem(w, a.system);
        }
    });
}

function printExternalSystem(w: IndentWriter, e: ExternalSystemModel): void {
    const h = head('externalSystem', e.name, e) + realizesText(e.realizes);
    if (!e.provides?.length && !e.consumes?.length && !e.masters?.length) {
        w.line(h);
        return;
    }
    w.block(h, () => {
        for (const p of e.provides ?? []) w.line(`provides ${p}`);
        for (const c of e.consumes ?? []) w.line(`consumes ${c}`);
        if (e.masters?.length) w.line(`masters ${e.masters.join(', ')}`);
    });
}

function printSystem(w: IndentWriter, s: SystemModel): void {
    w.block(head('system', systemName(s.name), s) + satisfiesInline(s.satisfies) + realizesText(s.realizes), () => {
        printMembers(w, s);
    });
}

export function printMembers(w: IndentWriter, m: SystemMembers): void {
    let first = true;
    const section = (): void => {
        if (!first) w.blank();
        first = false;
    };
    if (m.boundedContexts?.length) {
        section();
        for (const b of m.boundedContexts) w.line(head('boundedContext', b.name, b));
    }
    if (m.types?.length) {
        section();
        for (const t of m.types) printType(w, t);
    }
    for (const i of m.interfaces ?? []) {
        section();
        printInterface(w, i);
    }
    for (const c of m.containers ?? []) {
        section();
        printContainer(w, c);
    }
    for (const c of m.channels ?? []) {
        section();
        printChannel(w, c);
    }
    if (m.connectors?.length) {
        section();
        for (const c of m.connectors) printConnector(w, c);
    }
    for (const e of m.environments ?? []) {
        section();
        printEnvironment(w, e);
    }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export function fieldLine(f: FieldModel): string {
    return `${f.ordinal}: ${f.requiredness} ${f.type} ${f.name}${f.default !== undefined ? ` = ${literal(f.default)}` : ''}${describe(f.description)}`;
}

export function printType(w: IndentWriter, t: TypeModel): void {
    switch (t.kind) {
        case 'struct':
            w.block(head('struct', t.name, t) + satisfiesInline(t.satisfies), () => {
                for (const f of t.fields) w.line(fieldLine(f));
            });
            return;
        case 'exception':
            w.block(head('exception', t.name, t), () => {
                for (const f of t.fields) w.line(fieldLine(f));
            });
            return;
        case 'union':
            w.block(head('union', t.name, t), () => {
                for (const m of t.members) w.line(`${m.ordinal}: ${m.type} ${m.name}`);
            });
            return;
        case 'enum':
            w.block(head('enum', t.name, t), () => {
                for (const m of t.members) w.line(`${m.name} = ${m.value}`);
            });
            return;
        case 'typedef':
            w.line(`typedef ${t.name} = ${t.type}`);
            return;
        case 'import':
            w.line(`import ${t.imports} ${t.name} from domain`);
            return;
    }
}

/** The body of a type as an island (struct/exception/union/enum members, one per line). */
export function typeBodyIsland(t: TypeModel): string | undefined {
    const w = new IndentWriter('  ');
    if (t.kind === 'struct' || t.kind === 'exception') for (const f of t.fields) w.line(fieldLine(f));
    else if (t.kind === 'union') for (const m of t.members) w.line(`${m.ordinal}: ${m.type} ${m.name}`);
    else if (t.kind === 'enum') for (const m of t.members) w.line(`${m.name} = ${m.value}`);
    else return undefined;
    return w.toString();
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export function operationLine(op: OperationModel): string {
    const args = (op.args ?? []).map(a => `${a.ordinal}: ${a.requiredness} ${a.type} ${a.name}${a.default !== undefined ? ` = ${literal(a.default)}` : ''}`).join(', ');
    const throws = op.throws?.length ? ` throws (${op.throws.join(', ')})` : '';
    return `${op.style ? `${op.style} ` : ''}${op.name}(${args}) returns ${op.returns}${throws}${describe(op.description)}${metaHead(op.metadata)}`;
}

function printInterface(w: IndentWriter, i: InterfaceModel): void {
    w.block(head('interface', i.name, i) + satisfiesInline(i.satisfies) + realizesText(i.realizes), () => {
        for (const op of i.operations ?? []) w.line(operationLine(op));
    });
}

/** The operations of an interface as an island, one signature per line. */
export function operationsIsland(ops: OperationModel[] | undefined): string | undefined {
    if (!ops?.length) return undefined;
    const w = new IndentWriter('  ');
    for (const op of ops) w.line(operationLine(op));
    return w.toString();
}

// ---------------------------------------------------------------------------
// Containers, components, channels, connectors
// ---------------------------------------------------------------------------

function printContainer(w: IndentWriter, c: ContainerModel): void {
    const h = head('container', c.name, c) + technologyText(c.technology) + satisfiesInline(c.satisfies) + realizesText(c.realizes);
    if (!c.provides?.length && !c.requires?.length && !c.components?.length) {
        w.line(h);
        return;
    }
    w.block(h, () => {
        for (const p of c.provides ?? []) w.line(`provides ${p}`);
        for (const r of c.requires ?? []) w.line(`requires ${r}`);
        for (const comp of c.components ?? []) {
            w.blank();
            printComponent(w, comp);
        }
    });
}

function printComponent(w: IndentWriter, c: ComponentModel): void {
    const h = head('component', c.name, c) + satisfiesInline(c.satisfies) + realizesText(c.realizes);
    if (!c.boundedContext && !c.provides?.length && !c.requires?.length && !c.publishes?.length && !c.subscribes?.length) {
        w.line(h);
        return;
    }
    w.block(h, () => {
        if (c.boundedContext) w.line(`boundedContext ${c.boundedContext}`);
        for (const p of c.provides ?? []) w.line(`provides ${p}`);
        for (const r of c.requires ?? []) w.line(`requires ${r}`);
        for (const p of c.publishes ?? []) w.line(`publishes ${p.message} to ${p.channel}`);
        for (const s of c.subscribes ?? []) w.line(`subscribes ${s}`);
    });
}

function printChannel(w: IndentWriter, c: { name: string; broker: string; carries: string[]; description?: string; metadata?: Record<string, unknown> }): void {
    w.block(`channel ${c.name} on ${c.broker}${describe(c.description)}${metaHead(c.metadata)}`, () => {
        w.line(`carries ${c.carries.join(', ')}`);
    });
}

export function connectorLine(c: ConnectorModel): string {
    return `connect ${c.from} -> ${c.to} over ${quote(c.protocol)} ${c.style}${describe(c.description)}${metaHead(c.metadata)}`;
}

function printConnector(w: IndentWriter, c: ConnectorModel): void {
    w.line(connectorLine(c));
}

// ---------------------------------------------------------------------------
// Deployment
// ---------------------------------------------------------------------------

function deployLine(d: DeployModel): string {
    return `deploy ${d.containers.join(', ')}${d.replicas !== undefined ? ` replicas ${d.replicas}` : ''}`;
}

function printResource(w: IndentWriter, r: ResourceModel): void {
    const h =
        head('resource', r.name, r) +
        (r.instantiates ? ` instantiates ${r.instantiates}` : '') +
        technologyText(r.technology) +
        (r.tenancy ? ` tenancy ${r.tenancy}` : '');
    if (!r.stores?.length) {
        w.line(h);
        return;
    }
    w.block(h, () => w.line(`stores ${r.stores!.join(', ')}`));
}

function printNode(w: IndentWriter, n: NodeModel): void {
    const attrs = (n.provider ? ` provider ${quote(n.provider)}` : '') + (n.region ? ` region ${quote(n.region)}` : '') + (n.zone ? ` zone ${quote(n.zone)}` : '');
    w.block(head('node', n.name, n) + attrs, () => printEnvironmentMembers(w, n));
}

function printEnvironmentMembers(w: IndentWriter, e: { deploys?: DeployModel[]; nodes?: NodeModel[]; resources?: ResourceModel[] }): void {
    for (const d of e.deploys ?? []) w.line(deployLine(d));
    for (const r of e.resources ?? []) printResource(w, r);
    for (const n of e.nodes ?? []) printNode(w, n);
}

function printEnvironment(w: IndentWriter, e: EnvironmentModel): void {
    w.block(head('environment', e.name, e), () => printEnvironmentMembers(w, e));
}

/** The body of an environment (deploys and nodes) as an island. */
export function environmentIsland(e: EnvironmentModel): string | undefined {
    if (!e.deploys?.length && !e.nodes?.length) return undefined;
    const w = new IndentWriter('  ');
    printEnvironmentMembers(w, e);
    return w.toString();
}

// ---------------------------------------------------------------------------
// organization root
// ---------------------------------------------------------------------------

function printOrganizationRoot(w: IndentWriter, o: OrganizationModel): void {
    w.block(head('organization', o.name, o), () => {
        for (const d of o.domainSources ?? []) w.line(`domain-source ${quote(d)}`);
        if (o.requirementsSource) w.line(`requirements-source ${quote(o.requirementsSource)}`);
        if (o.phases?.length) w.blank();
        for (const p of o.phases ?? []) w.line(head('phase', p.name, p));
        if (o.areas?.length) w.blank();
        for (const a of o.areas ?? []) w.line(head('area', a.name, a));
        if (o.persons?.length) w.blank();
        for (const p of o.persons ?? []) w.line(head('person', p.name, p));
        for (const e of o.externalSystems ?? []) {
            w.blank();
            printExternalSystem(w, e);
        }
        for (const s of o.systems ?? []) {
            w.blank();
            printOrgSystem(w, s);
        }
        for (const d of o.dependencies ?? []) {
            w.blank();
            printDependency(w, d);
        }
    });
}

export function hotspotLines(h: HotspotModel): string {
    return `hotspot ${h.name}${describe(h.description ?? '')}${metaHead(h.metadata)}${h.concerns?.length ? ` concerns ${h.concerns.join(', ')}` : ''}`;
}

function printOrgSystem(w: IndentWriter, s: OrgSystemModel): void {
    const h = head('system', s.name, s) + technologyText(s.technology) + satisfiesInline(s.satisfies) + realizesText(s.realizes);
    const hasLevel0 = s.area || s.usedBy?.length || s.masters?.length || s.handles?.length || s.hotspots?.length || s.detailedIn;
    if (!hasLevel0 && !s.detail) {
        w.line(h);
        return;
    }
    w.block(h, () => {
        if (s.area) w.line(`area ${s.area}`);
        if (s.usedBy?.length) w.line(`used-by ${s.usedBy.join(', ')}`);
        if (s.masters?.length) w.line(`masters ${s.masters.join(', ')}`);
        if (s.handles?.length) w.line(`handles ${s.handles.join(', ')}`);
        for (const hs of s.hotspots ?? []) w.line(hotspotLines(hs));
        if (s.detailedIn) w.line(`detailed-in ${quote(s.detailedIn)}`);
        if (s.detail) {
            w.blank();
            printMembers(w, s.detail);
        }
    });
}

export function mechanismText(m: MechanismModel | undefined): string {
    if (!m) return '';
    return `${m.over !== undefined ? ` over ${quote(m.over)}` : ''}${m.mode ? ` ${m.mode}` : ''}`;
}

export function flowHead(f: FlowModel): string {
    const carries = f.carries.map(c => `${c.concept}${c.as ? ` as ${c.as}` : ''}`).join(', ');
    return `flow ${f.number} ${quote(f.label)}${describe(f.description)}${metaHead(f.metadata)} carries ${carries}${f.to ? ` to ${f.to}` : ''}`;
}

function printFlow(w: IndentWriter, f: FlowModel): void {
    const h = flowHead(f);
    if (f.phases?.length) {
        w.block(h, () => {
            for (const p of f.phases!) w.line(`phase ${p.phase}${mechanismText(p)}`);
        });
    } else {
        w.line(h + mechanismText(f.mechanism));
    }
}

function printDependency(w: IndentWriter, d: DependencyModel): void {
    const h =
        `dependency ${d.downstream} -> ${d.upstream}` +
        (d.patterns?.length ? ` : ${d.patterns.join(', ')}` : '') +
        (d.criticality ? ` criticality ${d.criticality}` : '') +
        describe(d.description) +
        metaHead(d.metadata);
    if (!d.flows?.length) {
        w.line(h);
        return;
    }
    w.block(h, () => {
        for (const f of d.flows!) printFlow(w, f);
    });
}

/** The flows of a dependency as an island. */
export function flowsIsland(flows: FlowModel[] | undefined): string | undefined {
    if (!flows?.length) return undefined;
    const w = new IndentWriter('  ');
    for (const f of flows) printFlow(w, f);
    return w.toString();
}
