import type {
    ConstructModel,
    ContextModel,
    DefinitionGroups,
    DomainModel,
    FieldModel,
    ModuleModel,
    OperationModel,
    OrganizationModel,
    RelationModel,
} from './domain-model.js';

/**
 * Render a normalized {@link DomainModel} as documentation-style Markdown:
 * `#` organization → `##` context → `###` module → `####` construct, with
 * field tables and inline description / satisfies lines.
 */
export function modelToMarkdown(model: DomainModel): string {
    const w = new Writer();

    for (const org of model.organizations ?? []) renderOrganization(w, org);
    // Contexts not nested under an organization.
    for (const ctx of model.contexts ?? []) renderContext(w, ctx, 2);
    // Top-level modules and loose definitions.
    for (const mod of model.modules ?? []) renderModule(w, mod, 3);
    if (model.definitions) renderGroups(w, model.definitions, 4);

    return w.toString();
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

function renderOrganization(w: Writer, org: OrganizationModel): void {
    w.heading(1, org.name);
    renderMeta(w, org.description, undefined, org.metadata);
    for (const ctx of org.contexts ?? []) renderContext(w, ctx, 2);
}

function renderContext(w: Writer, ctx: ContextModel, level: number): void {
    const title = ctx.shortname ? `${ctx.name}  \`(${ctx.shortname})\`` : ctx.name;
    w.heading(level, `${title} Context`);
    renderMeta(w, ctx.description, undefined, ctx.metadata);
    if (ctx.contextMap) renderContextMap(w, ctx.contextMap);
    for (const mod of ctx.modules ?? []) renderModule(w, mod, level + 1);
    if (ctx.definitions) renderGroups(w, ctx.definitions, level + 2);
}

function renderModule(w: Writer, mod: ModuleModel, level: number): void {
    w.heading(level, `Module: ${mod.name}`);
    renderMeta(w, mod.description, undefined, mod.metadata);
    if (mod.dependencies?.length) w.line(`**Depends on:** ${mod.dependencies.join(', ')}`).blank();
    for (const sub of mod.modules ?? []) renderModule(w, sub, level + 1);
    if (mod.definitions) renderGroups(w, mod.definitions, level + 1);
}

function renderContextMap(w: Writer, relations: RelationModel[]): void {
    w.line('**Context map:**');
    for (const r of relations) {
        w.line(`- ${r.direction} \`${r.pattern}\` → ${r.target}`);
    }
    w.blank();
}

// ---------------------------------------------------------------------------
// Definition groups & constructs
// ---------------------------------------------------------------------------

const GROUP_TITLES: Record<string, string> = {
    entities: 'Entities',
    aggregates: 'Aggregates',
    values: 'Value Types',
    enums: 'Enums',
    commands: 'Commands',
    queries: 'Queries',
    events: 'Events',
    services: 'Services',
    reactions: 'Reactions',
    invariants: 'Invariants',
    agreements: 'Agreements',
    statemachines: 'State Machines',
    interfaces: 'Interfaces',
    other: 'Other',
};

const GROUP_ORDER = Object.keys(GROUP_TITLES);

function renderGroups(w: Writer, groups: DefinitionGroups, level: number): void {
    const keys = Object.keys(groups).sort(
        (a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b),
    );
    for (const key of keys) {
        const constructs = groups[key];
        if (!constructs?.length) continue;
        for (const c of constructs) renderConstruct(w, c, level);
    }
}

function groupRank(key: string): number {
    const i = GROUP_ORDER.indexOf(key);
    return i === -1 ? GROUP_ORDER.length : i;
}

function renderConstruct(w: Writer, c: ConstructModel, level: number): void {
    w.heading(level, `${c.kind} ${c.name}`);
    renderMeta(w, c.description, c.satisfies, c.metadata);

    // Enum values
    if (Array.isArray(c.values)) {
        w.line(`Values: ${(c.values as string[]).map(v => `\`${v}\``).join(', ')}`).blank();
    }

    // Aggregate root / contents
    if (c.root) w.line(`**Root:** ${c.root}`);
    if (Array.isArray(c.entities)) w.line(`**Entities:** ${(c.entities as string[]).join(', ')}`);
    if (Array.isArray(c.contains)) w.line(`**Contains:** ${(c.contains as string[]).join(', ')}`);
    if (c.root || c.entities || c.contains) w.blank();

    // Event kind / schedule / source context
    const meta: string[] = [];
    if (c.eventKind) meta.push(`type: ${c.eventKind}`);
    if (c.from) meta.push(`from: ${c.from}`);
    if (c.schedule) meta.push(`schedule: \`${c.schedule}\``);
    if (meta.length) w.line(`_${meta.join(' · ')}_`).blank();

    // Identity
    if (c.identity) {
        const id = c.identity as { name: string; type: string };
        w.line(`**Identity:** \`${id.name} : ${id.type}\``).blank();
    }

    // Fields table
    if (Array.isArray(c.fields) && c.fields.length) {
        renderFieldTable(w, c.fields as FieldModel[]);
    }

    // References
    if (Array.isArray(c.references) && c.references.length) {
        w.line('**References:**');
        for (const r of c.references as { name: string; target: string; cardinality: string }[]) {
            w.line(`- \`${r.name}\` → ${r.target} (${r.cardinality})`);
        }
        w.blank();
    }

    // Reaction wiring
    if (Array.isArray(c.triggers)) w.line(`**Triggered by:** ${(c.triggers as string[]).join(', ')}`);
    if (Array.isArray(c.effects)) w.line(`**Effects:** ${(c.effects as string[]).join(', ')}`);
    if (c.guard !== undefined) w.line(`**Guard:** \`${typeof c.guard === 'string' ? c.guard : JSON.stringify(c.guard)}\``);
    if (c.triggers || c.effects || c.guard !== undefined) w.blank();

    // Operations
    if (Array.isArray(c.operations) && c.operations.length) {
        w.line('**Operations:**');
        for (const op of c.operations as OperationModel[]) renderOperation(w, op);
        w.blank();
    }

    // Invariants
    if (Array.isArray(c.invariants) && c.invariants.length) {
        w.line(`**Invariants:** ${c.invariants.length}`).blank();
    }

    // Exposed operations (interfaces)
    if (Array.isArray(c.exposes) && c.exposes.length) {
        w.line(`**Exposes:** ${(c.exposes as string[]).join(', ')}`).blank();
    }
}

function renderOperation(w: Writer, op: OperationModel): void {
    const parts: string[] = [`\`"${op.name}"\``];
    if (op.trigger?.command) parts.push(`on command ${op.trigger.command}`);
    if (op.trigger?.event) parts.push(`on event ${op.trigger.event}`);
    if (op.accepts?.length) parts.push(`accepts ${op.accepts.join(', ')}`);
    if (op.returns) parts.push(`returns ${op.returns}`);
    if (op.emits?.length) parts.push(`emits ${op.emits.join(', ')}`);
    w.line(`- ${parts.join(' — ')}`);
}

function renderFieldTable(w: Writer, fields: FieldModel[]): void {
    w.line('| field | type | constraints |');
    w.line('|-------|------|-------------|');
    for (const f of fields) {
        const type = f.optional ? `${f.type}?` : f.type;
        const constraints = f.constraints?.length ? f.constraints.join(', ') : '';
        w.line(`| ${f.name} | ${type} | ${constraints} |`);
    }
    w.blank();
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function renderMeta(
    w: Writer,
    description?: string,
    satisfies?: string[],
    metadata?: Record<string, unknown>,
): void {
    if (description) w.line(`_${description}_`);
    if (satisfies?.length) w.line(`Satisfies: ${satisfies.join(', ')}`);
    if (metadata && Object.keys(metadata).length) {
        const pairs = Object.entries(metadata).map(([k, v]) => `${k}=${String(v)}`);
        w.line(`Metadata: ${pairs.join(', ')}`);
    }
    if (description || satisfies?.length || metadata) w.blank();
}

class Writer {
    private lines: string[] = [];

    heading(level: number, text: string): this {
        return this.line(`${'#'.repeat(Math.min(level, 6))} ${text}`).blank();
    }

    line(text: string): this {
        this.lines.push(text);
        return this;
    }

    blank(): this {
        if (this.lines.length && this.lines[this.lines.length - 1] !== '') {
            this.lines.push('');
        }
        return this;
    }

    toString(): string {
        return this.lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    }
}
