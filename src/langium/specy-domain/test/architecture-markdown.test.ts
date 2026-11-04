/**
 * The .arch Markdown reader on a document written loosely, as an author or a
 * language model would: group headings instead of kind words, `- Label:` lists,
 * label aliases, a struct given as a table with aliased columns, an enum as a
 * list, a dependency heading without the kind word, and a paragraph the
 * conventions have no place for — which must come out as MD-UNMAPPED, on its
 * line, and not stop the rest from being read.
 */
import { describe, expect, it } from 'vitest';
import { read, write, codecFor } from '../src/formats/index.js';
import type { ArchitectureDocument } from '../src/formats/architecture/model.js';

const loose = `---
specy: architecture
---

# Architecture: Sniplink

A URL shortener, as its platform team sees it.

- Domain source: sniplink.domain
- Requirements source: sniplink.sysreq

## Persons

### Visitor
Follows a short link.

### Publisher

## External systems

### SafeBrowsing
Threat intelligence.
- Provides: ThreatLookup

## System: Sniplink

**Satisfies**: REQ-NFR-001 · **Realizes**: context "Link Shortening"

**Bounded contexts:**
- Shortening — Links and slugs

**Imports:**
- value type Slug
- event LinkShortened

This paragraph is a remark the conventions have no place for.

### Types

#### ShortLinkDTO (struct)
| field | type | required | description |
|---|---|---|---|
| slug | \`Slug\` | yes | the slug |
| target | string | no | |

#### Disposition (enum)
- redirected
- warningShown = 3

#### Url (typedef)
**Type:** string

### Interfaces

#### LinkCommands
Write side.
\`\`\`specy
createShortLink(1: required string target, 2: optional Slug customSlug) returns ShortLinkDTO throws (SlugTaken)
safe resolveBySlug(1: required string slug) returns ShortLinkDTO
\`\`\`

### Containers

#### EdgeApi
- Technology: Clojure/Ring
- Provides: LinkCommands

##### LinkController (component)
- Bounded context: Shortening
- Provides: LinkCommands
- Publishes: LinkShortened to linkEvents

#### EventBus
- Tech: Kafka

### Channels

#### linkEvents
**Broker:** EventBus
**Carries:** LinkShortened

### Connectors
- \`Publisher -> EdgeApi.LinkCommands over "HTTPS" sync\` — the console
- \`LinkController -> EventBus over "Kafka" async\`

### Environment: production
\`\`\`specy
deploy EdgeApi replicas 2
\`\`\`
`;

describe('a loosely written .arch Markdown', () => {
    it('is read into the model, with the remark reported as unmapped', async () => {
        const r = await read({ text: loose, fileName: 'sniplink.arch.md' });
        const errors = r.diagnostics.filter(d => d.severity === 'error');
        expect(errors.map(d => `${d.line}: ${d.message}`)).toEqual([]);
        const unmapped = r.diagnostics.filter(d => d.code === 'MD-UNMAPPED');
        expect(unmapped.map(d => d.line)).toEqual([loose.split('\n').findIndex(l => l.startsWith('This paragraph')) + 1]);

        const doc = r.model as ArchitectureDocument;
        const a = doc.architecture!;
        expect(a.name).toBe('Sniplink');
        expect(a.description).toBe('A URL shortener, as its platform team sees it.');
        expect(a.domainSources).toEqual(['sniplink.domain']);
        expect(a.requirementsSource).toBe('sniplink.sysreq');
        expect(a.persons?.map(p => p.name)).toEqual(['Visitor', 'Publisher']);
        expect(a.persons?.[0].description).toBe('Follows a short link.');
        expect(a.externalSystems).toEqual([{ name: 'SafeBrowsing', description: 'Threat intelligence.', provides: ['ThreatLookup'] }]);

        const s = a.system!;
        expect(s.satisfies).toEqual(['REQ-NFR-001']);
        expect(s.realizes).toEqual([{ kind: 'context', name: 'Link Shortening' }]);
        expect(s.boundedContexts).toEqual([{ name: 'Shortening', description: 'Links and slugs' }]);
        expect(s.types).toEqual([
            { kind: 'import', name: 'Slug', imports: 'value type' },
            { kind: 'import', name: 'LinkShortened', imports: 'event' },
            {
                kind: 'struct',
                name: 'ShortLinkDTO',
                fields: [
                    { ordinal: 1, requiredness: 'required', type: 'Slug', name: 'slug', description: 'the slug' },
                    { ordinal: 2, requiredness: 'optional', type: 'string', name: 'target' },
                ],
            },
            { kind: 'enum', name: 'Disposition', members: [{ name: 'redirected', value: 1 }, { name: 'warningShown', value: 3 }] },
            { kind: 'typedef', name: 'Url', type: 'string' },
        ]);
        expect(s.interfaces?.[0].name).toBe('LinkCommands');
        expect(s.interfaces?.[0].operations?.map(o => `${o.style ?? ''}${o.name}`)).toEqual(['createShortLink', 'saferesolveBySlug']);
        expect(s.interfaces?.[0].operations?.[0].throws).toEqual(['SlugTaken']);
        expect(s.containers?.map(c => [c.name, c.technology])).toEqual([
            ['EdgeApi', 'Clojure/Ring'],
            ['EventBus', 'Kafka'],
        ]);
        expect(s.containers?.[0].components).toEqual([
            { name: 'LinkController', boundedContext: 'Shortening', provides: ['LinkCommands'], publishes: [{ message: 'LinkShortened', channel: 'linkEvents' }] },
        ]);
        expect(s.channels).toEqual([{ name: 'linkEvents', broker: 'EventBus', carries: ['LinkShortened'] }]);
        expect(s.connectors).toEqual([
            { from: 'Publisher', to: 'EdgeApi.LinkCommands', protocol: 'HTTPS', style: 'sync', description: 'the console' },
            { from: 'LinkController', to: 'EventBus', protocol: 'Kafka', style: 'async' },
        ]);
        expect(s.environments).toEqual([{ name: 'production', deploys: [{ containers: ['EdgeApi'], replicas: 2 }] }]);

        // and what the reader produced is what the writer writes back, modulo the remark
        const canonical = write(codecFor('architecture'), r.model, 'markdown');
        const again = await read({ text: canonical, fileName: 'sniplink.arch.md' });
        expect(again.diagnostics).toEqual([]);
        expect(JSON.stringify(again.model)).toBe(JSON.stringify(r.model));
    });

    it('names what a required clause is missing', async () => {
        const md = `# organization Acme\n\n## system CRM\n\n### hotspot Drift\n\n**Concerns:** 1\n\n## dependency CRM -> ERP\n\n### flow 1 "Invoices"\n\n**To:** ERP\n`;
        const r = await read({ text: md, fileName: 'acme.arch.md' });
        const codes = r.diagnostics.map(d => d.code);
        expect(codes).toContain('MD-HOTSPOT');
        expect(codes).toContain('MD-CARRIES');
    });

    it('reads a level-0 landscape written with aliases', async () => {
        const md = `---
specy: architecture
---
# organisation Acme

**Phases:**
- Phase1 — Go-live
- Phase2

**Areas:**
- Finance — Money

## external system Banks
**Masters:** BankStatement

## Systems

### ERP
Accounting.
- Technology: NetSuite
- Area: Finance
- Used by: FinanceStaff
- Masters: Invoice, JournalEntry
- Handles: BankStatement
- Realizes: context Finance

#### hotspot MonthEndClose
The close waits on manual imports.
**Concerns:** 1, Invoice

## Dependencies

### ERP → Banks
Statements and payments.
- Patterns: PublishedLanguage
- Criticality: degraded

#### flow 1 "Statements"
- Carries: BankStatement
- Mechanism: over "EBICS" automated

#### flow 2 "Payments"
- Carries: PaymentOrder
- To: Banks
- Phases:
  - Phase1 over "SFTP" manual
  - Phase2 automated
`;
        const r = await read({ text: md, fileName: 'acme.arch.md' });
        expect(r.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
        const o = (r.model as ArchitectureDocument).organization!;
        expect(o.phases).toEqual([{ name: 'Phase1', description: 'Go-live' }, { name: 'Phase2' }]);
        expect(o.externalSystems).toEqual([{ name: 'Banks', masters: ['BankStatement'] }]);
        expect(o.systems?.[0]).toEqual({
            name: 'ERP',
            description: 'Accounting.',
            technology: 'NetSuite',
            realizes: [{ kind: 'context', name: 'Finance' }],
            area: 'Finance',
            usedBy: ['FinanceStaff'],
            masters: ['Invoice', 'JournalEntry'],
            handles: ['BankStatement'],
            hotspots: [{ name: 'MonthEndClose', description: 'The close waits on manual imports.', concerns: [1, 'Invoice'] }],
        });
        expect(o.dependencies?.[0]).toEqual({
            downstream: 'ERP',
            upstream: 'Banks',
            patterns: ['PublishedLanguage'],
            criticality: 'degraded',
            description: 'Statements and payments.',
            flows: [
                { number: 1, label: 'Statements', carries: [{ concept: 'BankStatement' }], mechanism: { over: 'EBICS', mode: 'automated' } },
                { number: 2, label: 'Payments', carries: [{ concept: 'PaymentOrder' }], to: 'Banks', phases: [{ phase: 'Phase1', over: 'SFTP', mode: 'manual' }, { phase: 'Phase2', mode: 'automated' }] },
            ],
        });
    });
});
