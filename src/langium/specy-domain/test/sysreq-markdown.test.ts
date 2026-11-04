/**
 * The .sysreq Markdown reader on a document written loosely, the way a
 * reviewer or a language model writes one: a group heading, bare names, label
 * lists, aliases, a statement as a paragraph, a table of requirements, and a
 * paragraph that belongs to no clause and must come back as unmapped.
 */
import { describe, expect, it } from 'vitest';
import { read, write, codecFor } from '../src/formats/index.js';
import type { SysreqDocument } from '../src/formats/sysreq/model.js';

const loose = `---
specy: sysreq
---

# Requirements: Link Shortening

**Scope:** UrlShortenerContext
**PRD source:** url-shortener.prd

## Requirements

### REQ-LNK-001 — Short link generation

- Pattern: event-driven
- Priority: must
- Source: AC-001-01

**Why:** Core utility — the fundamental action that brings publishers to the product.

> When a publisher submits a URL, the system shall generate a unique short link
> and return it within 1 second.

**Depends on:** REQ-SAF-001, REQ-LNK-002
**Satisfied by:**
- implemented by \`ShortLink."Shorten a URL"\`
- structured-by ShortLink.slug
- Infrastructure

### Clipboard copy

**Id:** REQ-LNK-002
**Pattern:** Event driven · **Priority:** Won't

When a short link is generated, the system shall copy it to the clipboard.

This sentence is a stray remark that belongs to no clause.

## module Safety

| id | name | pattern | priority | statement | source |
|---|---|---|---|---|---|
| REQ-SAF-001 | Safety scan | ubiquitous | must | The system shall scan every destination URL. | Constraint: Link safety |
| REQ-SAF-002 | Rescan | event-driven | should | When a link is clicked, the system shall rescan its destination. | |
`;

describe('a loosely written requirements document', () => {
    it('reads into the same structure the DSL gives', async () => {
        const r = await read({ text: loose, fileName: 'loose.sysreq.md' });
        const codes = r.diagnostics.map(d => d.code);
        expect(r.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
        // the stray paragraph is reported, on its line, and kept as a comment in the DSL
        const unmapped = r.diagnostics.filter(d => d.code === 'MD-UNMAPPED');
        expect(unmapped).toHaveLength(1);
        expect(unmapped[0].line).toBe(loose.split('\n').findIndex(l => l.startsWith('This sentence')) + 1);
        expect(r.dsl).toContain('// unmapped (markdown line');
        // the paragraph statement of the second requirement is accepted, with a warning saying so
        expect(codes).toContain('MD-STATEMENT-PARAGRAPH');

        const doc = r.model as SysreqDocument;
        expect(doc.requirementSets).toHaveLength(1);
        const set = doc.requirementSets[0];
        expect(set.name).toBe('Link Shortening');
        expect(set.scope).toBe('UrlShortenerContext');
        expect(set.prdSources).toEqual(['url-shortener.prd']);

        const [first, second] = set.requirements!;
        expect(first).toEqual({
            id: 'REQ-LNK-001',
            name: 'Short link generation',
            pattern: 'event-driven',
            priority: 'must',
            source: 'AC-001-01',
            rationale: 'Core utility — the fundamental action that brings publishers to the product.',
            statement: 'When a publisher submits a URL, the system shall generate a unique short link and return it within 1 second.',
            dependsOn: ['REQ-SAF-001', 'REQ-LNK-002'],
            satisfiedBy: [
                { role: 'implemented-by', target: 'ShortLink."Shorten a URL"' },
                { role: 'structured-by', target: 'ShortLink.slug' },
                { role: 'satisfied-by-infrastructure' },
            ],
        });
        expect(second).toEqual({
            id: 'REQ-LNK-002',
            name: 'Clipboard copy',
            pattern: 'event-driven',
            priority: 'wont',
            statement: 'When a short link is generated, the system shall copy it to the clipboard.',
        });

        const mod = set.modules![0];
        expect(mod.name).toBe('Safety');
        expect(mod.requirements!.map(q => [q.id, q.priority, q.source])).toEqual([
            ['REQ-SAF-001', 'must', 'Constraint: Link safety'],
            ['REQ-SAF-002', 'should', undefined],
        ]);

        // and the canonical Markdown of what was read comes back identical, without a diagnostic
        const md = write(codecFor('sysreq'), doc, 'markdown');
        const again = await read({ text: md, fileName: 'loose.sysreq.md' });
        expect(again.diagnostics).toEqual([]);
        expect(JSON.stringify(again.model)).toBe(JSON.stringify(doc));
    });

    it('names the clause to add when a requirement is incomplete', async () => {
        const text = `# requirements "Gaps" scoped-to Gaps\n\n## REQ-GAP-001 Missing bits\n\n**Priority:** high\n`;
        const r = await read({ text, fileName: 'gaps.sysreq.md' });
        const messages = r.diagnostics.filter(d => d.severity === 'error').map(d => `${d.code}: ${d.message}`);
        expect(messages.some(m => m.startsWith('MD-PATTERN'))).toBe(true);
        expect(messages.some(m => m.startsWith('MD-STATEMENT'))).toBe(true);
        expect(messages.some(m => m.startsWith('MD-PRIORITY') && m.includes('"high"'))).toBe(true);
    });

    it('refuses a requirement outside a set, and a set without a scope', async () => {
        const r = await read({ text: `# REQ-X-001 Orphan\n\n**Pattern:** ubiquitous\n**Priority:** must\n\n> The system shall exist.\n`, fileName: 'orphan.sysreq.md' });
        expect(r.diagnostics.map(d => d.code)).toContain('MD-NO-SET');
        const s = await read({ text: `# requirements "No scope"\n\n## REQ-X-001 Orphan\n\n**Pattern:** ubiquitous\n**Priority:** must\n\n> The system shall exist.\n`, fileName: 'noscope.sysreq.md' });
        expect(s.diagnostics.map(d => d.code)).toContain('MD-SCOPE');
    });
});
