/**
 * Normalizer: Langium AST of a .arch file -> the architecture document.
 *
 * One root per file: `architecture` (levels 1–3) or `organization` (level 0,
 * whose systems may carry levels 2–3 inline under `detail`). Members of a
 * system body are grouped by kind (bounded contexts, types, interfaces,
 * containers, channels, connectors, environments) in document order within
 * each group; the DSL accepts them in any order, so grouping loses no meaning
 * and gives JSON, YAML and Markdown a stable shape. DSL keywords stay strings
 * (`required`, `async`, `Conformist`), references stay the names as written
 * (`Finance.Invoice`, `LinkController.LinkCommands`), and every text that may
 * span lines is collapsed to one line.
 */
import * as ast from '../../generated/ast.js';
import { ARCHITECTURE_SCHEMA, PARSER_VERSION } from '../../cli/version.js';
import { collapse, compact, nonEmpty } from '../kit/text.js';

// ---------------------------------------------------------------------------
// Document types
// ---------------------------------------------------------------------------

export interface Described {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export interface RealizesRef {
    kind: 'module' | 'context' | 'interface' | 'event' | 'value type';
    name: string;
}

export interface PersonModel extends Described {}

export interface ExternalSystemModel extends Described {
    realizes?: RealizesRef[];
    provides?: string[];
    consumes?: string[];
    /** Organization only: the concepts the external system is the system of record for. */
    masters?: string[];
}

export interface FieldModel {
    ordinal: number;
    requiredness: 'required' | 'optional';
    type: string;
    name: string;
    default?: unknown;
    description?: string;
}

export interface UnionMemberModel {
    ordinal: number;
    type: string;
    name: string;
}

export interface EnumMemberModel {
    name: string;
    value: number;
}

export type TypeModel =
    | (Described & { kind: 'struct'; satisfies?: string[]; fields: FieldModel[] })
    | (Described & { kind: 'exception'; fields: FieldModel[] })
    | (Described & { kind: 'union'; members: UnionMemberModel[] })
    | (Described & { kind: 'enum'; members: EnumMemberModel[] })
    | { kind: 'typedef'; name: string; type: string }
    | { kind: 'import'; name: string; imports: 'value type' | 'event' };

export interface ArgModel {
    ordinal: number;
    requiredness: 'required' | 'optional';
    type: string;
    name: string;
    default?: unknown;
}

export interface OperationModel {
    style?: 'safe' | 'oneway' | 'streaming';
    name: string;
    args?: ArgModel[];
    /** A type, or `void`. */
    returns: string;
    throws?: string[];
    description?: string;
    metadata?: Record<string, unknown>;
}

export interface InterfaceModel extends Described {
    satisfies?: string[];
    realizes?: RealizesRef[];
    operations?: OperationModel[];
}

export interface ComponentModel extends Described {
    satisfies?: string[];
    realizes?: RealizesRef[];
    boundedContext?: string;
    provides?: string[];
    requires?: string[];
    publishes?: { message: string; channel: string }[];
    subscribes?: string[];
}

export interface ContainerModel extends Described {
    technology?: string;
    satisfies?: string[];
    realizes?: RealizesRef[];
    provides?: string[];
    requires?: string[];
    components?: ComponentModel[];
}

export interface ChannelModel extends Described {
    broker: string;
    carries: string[];
}

export interface ConnectorModel {
    from: string;
    to: string;
    protocol: string;
    style: 'sync' | 'async' | 'streaming';
    description?: string;
    metadata?: Record<string, unknown>;
}

export interface DeployModel {
    containers: string[];
    replicas?: number;
}

export interface ResourceModel extends Described {
    instantiates?: string;
    technology?: string;
    tenancy?: 'shared' | 'dedicated';
    stores?: string[];
}

export interface NodeModel extends Described {
    provider?: string;
    region?: string;
    zone?: string;
    nodes?: NodeModel[];
    deploys?: DeployModel[];
    resources?: ResourceModel[];
}

export interface EnvironmentModel extends Described {
    deploys?: DeployModel[];
    nodes?: NodeModel[];
}

/** The members of a system body — levels 2 and 3, shared by both roots. */
export interface SystemMembers {
    boundedContexts?: Described[];
    types?: TypeModel[];
    interfaces?: InterfaceModel[];
    containers?: ContainerModel[];
    channels?: ChannelModel[];
    connectors?: ConnectorModel[];
    environments?: EnvironmentModel[];
}

export interface SystemModel extends Described, SystemMembers {
    satisfies?: string[];
    realizes?: RealizesRef[];
}

export interface ArchitectureModel extends Described {
    domainSources?: string[];
    requirementsSource?: string;
    persons?: PersonModel[];
    externalSystems?: ExternalSystemModel[];
    system?: SystemModel;
}

export interface HotspotModel extends Described {
    /** Flow numbers and concept names. */
    concerns?: (number | string)[];
}

export interface OrgSystemModel extends Described {
    technology?: string;
    satisfies?: string[];
    realizes?: RealizesRef[];
    area?: string;
    usedBy?: string[];
    masters?: string[];
    handles?: string[];
    hotspots?: HotspotModel[];
    detailedIn?: string;
    /** Levels 2–3 when the system is detailed inline. */
    detail?: SystemMembers;
}

export interface MechanismModel {
    over?: string;
    mode?: 'manual' | 'automated';
}

export interface FlowModel {
    number: number;
    label: string;
    description?: string;
    metadata?: Record<string, unknown>;
    carries: { concept: string; as?: string }[];
    /** The receiving system, when data goes against the default direction. */
    to?: string;
    mechanism?: MechanismModel;
    phases?: ({ phase: string } & MechanismModel)[];
}

export interface DependencyModel {
    downstream: string;
    upstream: string;
    patterns?: string[];
    criticality?: 'critical' | 'degraded' | 'tolerant';
    description?: string;
    metadata?: Record<string, unknown>;
    flows?: FlowModel[];
}

export interface OrganizationModel extends Described {
    domainSources?: string[];
    requirementsSource?: string;
    phases?: Described[];
    areas?: Described[];
    persons?: PersonModel[];
    externalSystems?: ExternalSystemModel[];
    systems?: OrgSystemModel[];
    dependencies?: DependencyModel[];
}

export interface ArchitectureDocument {
    $schema: string;
    parser: { name: string; version: string };
    architecture?: ArchitectureModel;
    organization?: OrganizationModel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function descOf(d: ast.Description | undefined): string | undefined {
    return collapse(d?.text);
}

function metaOf(m: ast.ArchMetadataBlock | undefined): Record<string, unknown> | undefined {
    if (!m || !m.entries.length) return undefined;
    const out: Record<string, unknown> = {};
    for (const e of m.entries) out[e.key] = literalOf(e.value);
    return out;
}

function literalOf(l: ast.ArchLiteral | undefined): unknown {
    if (!l) return undefined;
    if (ast.isArchStringLiteral(l)) return collapse(l.value);
    if (ast.isArchNumberLiteral(l)) return Number(l.value);
    if (ast.isArchBooleanLiteral(l)) return l.value === 'true';
    return null;
}

function satisfiesOf(s: ast.SatisfiesDecl | undefined): string[] | undefined {
    return s && s.ids.length ? [...s.ids] : undefined;
}

function realizesOf(r: ast.ArchRealizesDecl | undefined): RealizesRef[] | undefined {
    if (!r) return undefined;
    return nonEmpty(
        r.refs.map(ref => ({
            kind: (ref.kind === 'value' ? 'value type' : ref.kind) as RealizesRef['kind'],
            name: ref.name ?? '',
        })),
    );
}

export function typeToString(t: ast.ArchFieldType | undefined): string {
    if (!t) return 'unknown';
    if (ast.isArchPrimitiveType(t)) return t.value;
    if (ast.isArchCollectionType(t)) {
        return t.valueType
            ? `${t.kind}<${typeToString(t.elementType)}, ${typeToString(t.valueType)}>`
            : `${t.kind}<${typeToString(t.elementType)}>`;
    }
    return t.typeName;
}

function conceptOf(c: ast.ArchConceptRef): string {
    return c.context ? `${c.context}.${c.name}` : c.name;
}

function connectorRefOf(r: ast.ArchConnectorRef): string {
    return r.segments.join('.');
}

function described(node: { name: string; description?: ast.Description; metadata?: ast.ArchMetadataBlock }): Described {
    return compact({ name: node.name, description: descOf(node.description), metadata: metaOf(node.metadata) });
}

// ---------------------------------------------------------------------------
// Levels 1–3
// ---------------------------------------------------------------------------

function externalSystemOf(e: ast.ArchExternalSystemDef | ast.ArchOrgExternalSystemDef): ExternalSystemModel {
    const provides: string[] = [];
    const consumes: string[] = [];
    const masters: string[] = [];
    for (const c of e.clauses) {
        if (ast.isArchProvidesClause(c)) provides.push(c.interface);
        else if (ast.isArchConsumesClause(c)) consumes.push(c.interface);
        else if (ast.isArchMastersClause(c)) masters.push(...c.concepts.map(conceptOf));
    }
    return compact({
        ...described(e),
        realizes: realizesOf(e.realizes),
        provides: nonEmpty(provides),
        consumes: nonEmpty(consumes),
        masters: nonEmpty(masters),
    });
}

function fieldOf(f: ast.ArchFieldDef): FieldModel {
    return compact({
        ordinal: Number(f.ordinal),
        requiredness: f.requiredness as FieldModel['requiredness'],
        type: typeToString(f.type),
        name: f.name,
        default: literalOf(f.default),
        description: descOf(f.description),
    });
}

function typeDefOf(t: ast.ArchNamedTypeDef): TypeModel {
    if (ast.isArchStructDef(t)) {
        return compact({ kind: 'struct', ...described(t), satisfies: satisfiesOf(t.satisfies), fields: t.fields.map(fieldOf) }) as TypeModel;
    }
    if (ast.isArchExceptionDef(t)) {
        return compact({ kind: 'exception', ...described(t), fields: t.fields.map(fieldOf) }) as TypeModel;
    }
    if (ast.isArchUnionDef(t)) {
        return compact({
            kind: 'union',
            ...described(t),
            members: t.members.map(m => ({ ordinal: Number(m.ordinal), type: typeToString(m.type), name: m.name })),
        }) as TypeModel;
    }
    if (ast.isArchEnumDef(t)) {
        return compact({ kind: 'enum', ...described(t), members: t.members.map(m => ({ name: m.name, value: Number(m.value) })) }) as TypeModel;
    }
    if (ast.isArchTypedefDef(t)) {
        return { kind: 'typedef', name: t.name, type: typeToString(t.type) };
    }
    return { kind: 'import', name: t.name, imports: t.event ? 'event' : 'value type' };
}

function operationOf(op: ast.ArchOperationDef): OperationModel {
    return compact({
        style: op.style as OperationModel['style'],
        name: op.name,
        args: nonEmpty(
            op.args.map(a =>
                compact({
                    ordinal: Number(a.ordinal),
                    requiredness: a.requiredness as ArgModel['requiredness'],
                    type: typeToString(a.type),
                    name: a.name,
                    default: literalOf(a.default),
                }),
            ),
        ),
        returns: op.void ? 'void' : typeToString(op.returnType),
        throws: nonEmpty([...op.throws]),
        description: descOf(op.description),
        metadata: metaOf(op.metadata),
    });
}

function interfaceOf(i: ast.ArchInterfaceDef): InterfaceModel {
    return compact({
        ...described(i),
        satisfies: satisfiesOf(i.satisfies),
        realizes: realizesOf(i.realizes),
        operations: nonEmpty(i.operations.map(operationOf)),
    });
}

function componentOf(c: ast.ArchComponentDef): ComponentModel {
    const provides: string[] = [];
    const requires: string[] = [];
    const publishes: { message: string; channel: string }[] = [];
    const subscribes: string[] = [];
    let boundedContext: string | undefined;
    for (const cl of c.clauses) {
        if (ast.isArchBoundedContextRef(cl)) boundedContext = cl.name;
        else if (ast.isArchProvidesClause(cl)) provides.push(cl.interface);
        else if (ast.isArchRequiresClause(cl)) requires.push(cl.interface);
        else if (ast.isArchPublishesClause(cl)) publishes.push({ message: cl.message, channel: cl.channel });
        else if (ast.isArchSubscribesClause(cl)) subscribes.push(cl.channel);
    }
    return compact({
        ...described(c),
        satisfies: satisfiesOf(c.satisfies),
        realizes: realizesOf(c.realizes),
        boundedContext,
        provides: nonEmpty(provides),
        requires: nonEmpty(requires),
        publishes: nonEmpty(publishes),
        subscribes: nonEmpty(subscribes),
    });
}

function containerOf(c: ast.ArchContainerDef): ContainerModel {
    const provides: string[] = [];
    const requires: string[] = [];
    const components: ComponentModel[] = [];
    for (const cl of c.clauses) {
        if (ast.isArchProvidesClause(cl)) provides.push(cl.interface);
        else if (ast.isArchRequiresClause(cl)) requires.push(cl.interface);
        else if (ast.isArchComponentDef(cl)) components.push(componentOf(cl));
    }
    return compact({
        ...described(c),
        technology: c.technology?.value,
        satisfies: satisfiesOf(c.satisfies),
        realizes: realizesOf(c.realizes),
        provides: nonEmpty(provides),
        requires: nonEmpty(requires),
        components: nonEmpty(components),
    });
}

function channelOf(c: ast.ArchChannelDef): ChannelModel {
    return compact({ ...described(c), broker: c.broker, carries: [...c.carries] });
}

function connectorOf(c: ast.ArchConnectorDef): ConnectorModel {
    return compact({
        from: connectorRefOf(c.from),
        to: connectorRefOf(c.to),
        protocol: c.protocol,
        style: c.style as ConnectorModel['style'],
        description: descOf(c.description),
        metadata: metaOf(c.metadata),
    });
}

function deployOf(d: ast.ArchDeployClause): DeployModel {
    return compact({ containers: [...d.containers], replicas: d.replicas !== undefined ? Number(d.replicas) : undefined });
}

function resourceOf(r: ast.ArchResourceDef): ResourceModel {
    return compact({
        ...described(r),
        instantiates: r.instantiates,
        technology: r.technology?.value,
        tenancy: r.tenancy as ResourceModel['tenancy'],
        stores: nonEmpty([...r.stores]),
    });
}

function nodeOf(n: ast.ArchNodeDef): NodeModel {
    const attrs: Record<string, string> = {};
    for (const a of n.attributes) if (a.kind && a.value !== undefined) attrs[a.kind] = a.value;
    const nodes: NodeModel[] = [];
    const deploys: DeployModel[] = [];
    const resources: ResourceModel[] = [];
    for (const m of n.members) {
        if (ast.isArchNodeDef(m)) nodes.push(nodeOf(m));
        else if (ast.isArchDeployClause(m)) deploys.push(deployOf(m));
        else resources.push(resourceOf(m));
    }
    return compact({
        ...described(n),
        provider: attrs.provider,
        region: attrs.region,
        zone: attrs.zone,
        nodes: nonEmpty(nodes),
        deploys: nonEmpty(deploys),
        resources: nonEmpty(resources),
    });
}

function environmentOf(e: ast.ArchEnvironmentDef): EnvironmentModel {
    const deploys: DeployModel[] = [];
    const nodes: NodeModel[] = [];
    for (const m of e.members) {
        if (ast.isArchDeployClause(m)) deploys.push(deployOf(m));
        else nodes.push(nodeOf(m));
    }
    return compact({ ...described(e), deploys: nonEmpty(deploys), nodes: nonEmpty(nodes) });
}

function membersOf(members: ast.ArchSystemMember[]): SystemMembers {
    const out: Required<SystemMembers> = { boundedContexts: [], types: [], interfaces: [], containers: [], channels: [], connectors: [], environments: [] };
    for (const m of members) {
        if (ast.isArchBoundedContextDecl(m)) out.boundedContexts.push(described(m));
        else if (ast.isArchNamedTypeDef(m)) out.types.push(typeDefOf(m));
        else if (ast.isArchInterfaceDef(m)) out.interfaces.push(interfaceOf(m));
        else if (ast.isArchContainerDef(m)) out.containers.push(containerOf(m));
        else if (ast.isArchChannelDef(m)) out.channels.push(channelOf(m));
        else if (ast.isArchConnectorDef(m)) out.connectors.push(connectorOf(m));
        else if (ast.isArchEnvironmentDef(m)) out.environments.push(environmentOf(m));
    }
    return compact({
        boundedContexts: nonEmpty(out.boundedContexts),
        types: nonEmpty(out.types),
        interfaces: nonEmpty(out.interfaces),
        containers: nonEmpty(out.containers),
        channels: nonEmpty(out.channels),
        connectors: nonEmpty(out.connectors),
        environments: nonEmpty(out.environments),
    });
}

function systemOf(s: ast.ArchSystemDef): SystemModel {
    return compact({
        ...described(s),
        satisfies: satisfiesOf(s.satisfies),
        realizes: realizesOf(s.realizes),
        ...membersOf(s.members),
    });
}

function architectureOf(a: ast.ArchArchitectureDef): ArchitectureModel {
    const domainSources: string[] = [];
    let requirementsSource: string | undefined;
    const persons: PersonModel[] = [];
    const externalSystems: ExternalSystemModel[] = [];
    let system: SystemModel | undefined;
    for (const m of a.members) {
        if (ast.isArchDomainSourceDecl(m)) domainSources.push(m.path);
        else if (ast.isArchRequirementsSourceDecl(m)) requirementsSource = m.path;
        else if (ast.isArchPersonDef(m)) persons.push(described(m));
        else if (ast.isArchExternalSystemDef(m)) externalSystems.push(externalSystemOf(m));
        else if (ast.isArchSystemDef(m)) system = systemOf(m);
    }
    return compact({
        ...described(a),
        domainSources: nonEmpty(domainSources),
        requirementsSource,
        persons: nonEmpty(persons),
        externalSystems: nonEmpty(externalSystems),
        system,
    });
}

// ---------------------------------------------------------------------------
// Level 0
// ---------------------------------------------------------------------------

function hotspotOf(h: ast.ArchHotspotDef): HotspotModel {
    return compact({
        ...described(h),
        concerns: nonEmpty(h.concerns.map(c => (ast.isArchFlowConcern(c) ? Number(c.number) : conceptOf(c)))),
    });
}

function orgSystemOf(s: ast.ArchOrgSystemDef): OrgSystemModel {
    let area: string | undefined;
    const usedBy: string[] = [];
    const masters: string[] = [];
    const handles: string[] = [];
    const hotspots: HotspotModel[] = [];
    let detailedIn: string | undefined;
    for (const c of s.level0) {
        if (ast.isArchAreaRef(c)) area = c.name;
        else if (ast.isArchUsedByClause(c)) usedBy.push(...c.persons);
        else if (ast.isArchMastersClause(c)) masters.push(...c.concepts.map(conceptOf));
        else if (ast.isArchHandlesClause(c)) handles.push(...c.concepts.map(conceptOf));
        else if (ast.isArchHotspotDef(c)) hotspots.push(hotspotOf(c));
        else if (ast.isArchDetailedInDecl(c)) detailedIn = c.path;
    }
    const detail = s.members.length ? membersOf(s.members) : undefined;
    return compact({
        ...described(s),
        technology: s.technology?.value,
        satisfies: satisfiesOf(s.satisfies),
        realizes: realizesOf(s.realizes),
        area,
        usedBy: nonEmpty(usedBy),
        masters: nonEmpty(masters),
        handles: nonEmpty(handles),
        hotspots: nonEmpty(hotspots),
        detailedIn,
        detail: detail && Object.keys(detail).length ? detail : undefined,
    });
}

function mechanismOf(m: ast.ArchMechanism | undefined): MechanismModel | undefined {
    if (!m) return undefined;
    return compact({ over: m.medium, mode: m.mode as MechanismModel['mode'] });
}

function flowOf(f: ast.ArchFlowDef): FlowModel {
    return compact({
        number: Number(f.number),
        label: collapse(f.label) ?? '',
        description: descOf(f.description),
        metadata: metaOf(f.metadata),
        carries: f.carries.map(c => compact({ concept: conceptOf(c.concept), as: c.becomes ? conceptOf(c.becomes) : undefined })),
        to: f.to,
        mechanism: mechanismOf(f.mechanism),
        phases: nonEmpty(f.phases.map(p => compact({ phase: p.phase, ...mechanismOf(p.mechanism) }))),
    });
}

function dependencyOf(d: ast.ArchDependencyDef): DependencyModel {
    return compact({
        downstream: d.downstream,
        upstream: d.upstream,
        patterns: nonEmpty([...d.patterns]),
        criticality: d.criticality as DependencyModel['criticality'],
        description: descOf(d.description),
        metadata: metaOf(d.metadata),
        flows: nonEmpty(d.flows.map(flowOf)),
    });
}

function organizationOf(o: ast.ArchOrganizationDef): OrganizationModel {
    const domainSources: string[] = [];
    let requirementsSource: string | undefined;
    const phases: Described[] = [];
    const areas: Described[] = [];
    const persons: PersonModel[] = [];
    const externalSystems: ExternalSystemModel[] = [];
    const systems: OrgSystemModel[] = [];
    const dependencies: DependencyModel[] = [];
    for (const m of o.members) {
        if (ast.isArchDomainSourceDecl(m)) domainSources.push(m.path);
        else if (ast.isArchRequirementsSourceDecl(m)) requirementsSource = m.path;
        else if (ast.isArchPhaseDef(m)) phases.push(described(m));
        else if (ast.isArchAreaDef(m)) areas.push(described(m));
        else if (ast.isArchPersonDef(m)) persons.push(described(m));
        else if (ast.isArchOrgExternalSystemDef(m)) externalSystems.push(externalSystemOf(m));
        else if (ast.isArchOrgSystemDef(m)) systems.push(orgSystemOf(m));
        else if (ast.isArchDependencyDef(m)) dependencies.push(dependencyOf(m));
    }
    return compact({
        ...described(o),
        domainSources: nonEmpty(domainSources),
        requirementsSource,
        phases: nonEmpty(phases),
        areas: nonEmpty(areas),
        persons: nonEmpty(persons),
        externalSystems: nonEmpty(externalSystems),
        systems: nonEmpty(systems),
        dependencies: nonEmpty(dependencies),
    });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function normalizeArchitecture(file: ast.ArchFile): ArchitectureDocument {
    const doc: ArchitectureDocument = {
        $schema: ARCHITECTURE_SCHEMA,
        parser: { name: 'specy-architecture', version: PARSER_VERSION },
    };
    for (const root of file.roots ?? []) {
        if (ast.isArchArchitectureDef(root)) doc.architecture = architectureOf(root);
        else if (ast.isArchOrganizationDef(root)) doc.organization = organizationOf(root);
    }
    return doc;
}
