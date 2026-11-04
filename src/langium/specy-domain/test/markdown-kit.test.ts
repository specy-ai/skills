/**
 * The Markdown kit the readers build on: the block tokenizer keeps line
 * numbers and the structures the conventions use; the label, heading and
 * table helpers accept the spellings MODEL-FORMATS.md lists as tolerated.
 */
import { describe, expect, it } from 'vitest';
import { parseBlocks } from '../src/formats/kit/markdown-blocks.js';
import { buildSections, groupKind, matchHeading, parseItemLabel, parseLabels, splitDash, splitList, stripInline, type KindSpec } from '../src/formats/kit/markdown-reader.js';
import { detectFormatFromText, dslRootKeyword } from '../src/formats/kit/detect.js';
import { parseMetaPairs, quote } from '../src/formats/kit/dsl.js';

describe('block tokenizer', () => {
    it('reads front matter, headings, paragraphs, lists, tables, fences and quotes with their lines', () => {
        const md = [
            '---',
            'specy: domain',
            '---',
            '',
            '# entity Order',
            '',
            'A customer order',
            'that wraps.',
            '',
            '**Identity:** `id : uuid`',
            '',
            '| field | type | constraints |',
            '|---|---|---|',
            '| amount | `decimal` | min(0) |',
            '| note | `string` | pattern("a\\|b") |',
            '',
            '- one',
            '  - nested',
            '- two',
            '  continued',
            '',
            '1. first',
            '2. second',
            '',
            '> quoted statement',
            '',
            '```specy',
            'operations {',
            '}',
            '```',
            '',
            'Setext',
            '------',
            '',
            '<!-- a comment -->',
        ].join('\n');
        const blocks = parseBlocks(md);
        expect(blocks.map(b => b.type)).toEqual(['frontmatter', 'heading', 'paragraph', 'paragraph', 'table', 'list', 'list', 'quote', 'code', 'heading', 'comment']);
        expect(blocks[0]).toMatchObject({ type: 'frontmatter', text: 'specy: domain', line: 1, endLine: 3 });
        expect(blocks[1]).toMatchObject({ type: 'heading', level: 1, text: 'entity Order', line: 5 });
        expect(blocks[2]).toMatchObject({ type: 'paragraph', text: 'A customer order that wraps.', line: 7, endLine: 8 });
        expect(blocks[4]).toMatchObject({ type: 'table', header: ['field', 'type', 'constraints'], line: 12 });
        expect((blocks[4] as { rows: string[][] }).rows[1]).toEqual(['note', '`string`', 'pattern("a|b")']);
        const list = blocks[5] as { items: { text: string; line: number; children: { text: string }[] }[] };
        expect(list.items.map(i => i.text)).toEqual(['one', 'two continued']);
        expect(list.items[0].children.map(c => c.text)).toEqual(['nested']);
        expect(list.items[0].line).toBe(17);
        expect(blocks[6]).toMatchObject({ type: 'list', ordered: true });
        expect(blocks[7]).toMatchObject({ type: 'quote', text: 'quoted statement' });
        expect(blocks[8]).toMatchObject({ type: 'code', lang: 'specy', text: 'operations {\n}', line: 27 });
        expect(blocks[9]).toMatchObject({ type: 'heading', level: 2, text: 'Setext' });
        expect(blocks[10]).toMatchObject({ type: 'comment', text: 'a comment' });
    });

    it('nests sections by heading level', () => {
        const root = buildSections(parseBlocks('# a\n\np\n\n## b\n\n### c\n\n## d\n\n# e\n'));
        expect(root.children.map(s => s.heading!.text)).toEqual(['a', 'e']);
        expect(root.children[0].children.map(s => s.heading!.text)).toEqual(['b', 'd']);
        expect(root.children[0].children[0].children.map(s => s.heading!.text)).toEqual(['c']);
        expect(root.children[0].blocks[0]).toMatchObject({ type: 'paragraph', text: 'p' });
    });
});

describe('labels', () => {
    it('reads the canonical and the tolerated spellings', () => {
        expect(parseLabels('**Identity:** `id : uuid`')).toEqual([{ label: 'identity', value: '`id : uuid`' }]);
        expect(parseLabels('**Identity**: id : uuid')).toEqual([{ label: 'identity', value: 'id : uuid' }]);
        expect(parseLabels('__Reads from__: OrderRepository')).toEqual([{ label: 'reads from', value: 'OrderRepository' }]);
        expect(parseLabels('**Reads-From:** X')).toEqual([{ label: 'reads from', value: 'X' }]);
        expect(parseLabels('**Priority:** must · **Status:** accepted')).toEqual([
            { label: 'priority', value: 'must' },
            { label: 'status', value: 'accepted' },
        ]);
        expect(parseLabels('**References:**')).toEqual([{ label: 'references', value: '' }]);
        expect(parseLabels('A paragraph with **bold** inside')).toBeUndefined();
        expect(parseItemLabel('About: Order')).toEqual({ label: 'about', value: 'Order' });
        expect(parseItemLabel('**About:** Order')).toEqual({ label: 'about', value: 'Order' });
        expect(parseItemLabel('just text')).toBeUndefined();
    });

    it('splits lists and dashes', () => {
        expect(splitList('`A`, B · C; D')).toEqual(['A', 'B', 'C', 'D']);
        expect(splitDash('`lines : OrderLine 1..N` — The line items')).toEqual({ head: '`lines : OrderLine 1..N`', tail: 'The line items' });
        expect(splitDash('eur - Euro')).toEqual({ head: 'eur', tail: 'Euro' });
        expect(splitDash('no dash')).toEqual({ head: 'no dash' });
        expect(stripInline('_An **order**_ with `code` and [a link](http://x)')).toBe('An order with code and a link');
    });

    it('reads metadata pairs back into DSL literals', () => {
        expect(parseMetaPairs('owner = "sales", tier = 1, flag = true, word = plain')).toEqual([
            ['owner', '"sales"'],
            ['tier', '1'],
            ['flag', 'true'],
            ['word', '"plain"'],
        ]);
    });
});

describe('headings', () => {
    const kinds: KindSpec[] = [
        { kind: 'entity', group: ['entities'] },
        { kind: 'read-only entity', words: ['master data'] },
        { kind: 'value', words: ['value type'], group: ['values', 'value types'] },
    ];
    it('matches the kind word first, the trailing form, and defaults under a group', () => {
        expect(matchHeading('entity Order', kinds)).toEqual({ kind: 'entity', rest: 'Order', defaulted: false });
        expect(matchHeading('Entity: Order', kinds)).toEqual({ kind: 'entity', rest: 'Order', defaulted: false });
        expect(matchHeading('Entity — Order', kinds)).toEqual({ kind: 'entity', rest: 'Order', defaulted: false });
        expect(matchHeading('Order (entity)', kinds)).toEqual({ kind: 'entity', rest: 'Order', defaulted: false });
        expect(matchHeading('read-only entity Product', kinds)).toEqual({ kind: 'read-only entity', rest: 'Product', defaulted: false });
        expect(matchHeading('Read only entity Product', kinds)).toEqual({ kind: 'read-only entity', rest: 'Product', defaulted: false });
        expect(matchHeading('Master data: Product', kinds)).toEqual({ kind: 'read-only entity', rest: 'Product', defaulted: false });
        expect(matchHeading('Value type Money', kinds)).toEqual({ kind: 'value', rest: 'Money', defaulted: false });
        expect(matchHeading('Money', kinds, 'value')).toEqual({ kind: 'value', rest: 'Money', defaulted: true });
        expect(matchHeading('Overview', kinds)).toBeUndefined();
        expect(groupKind('Entities', kinds)).toBe('entity');
        expect(groupKind('Value Types', kinds)).toBe('value');
        expect(groupKind('Order', kinds)).toBeUndefined();
    });
});

describe('detection and quoting', () => {
    it('tells the encodings apart from the text', () => {
        expect(detectFormatFromText('{ "a": 1 }')).toBe('json');
        expect(detectFormatFromText('---\nspecy: prd\n---\n# product X')).toBe('markdown');
        expect(detectFormatFromText('$schema: https://specy.ai/schemas/prd/1.json\nproducts: []\n')).toBe('yaml');
        expect(detectFormatFromText('# Business Loan — requirements\nrequirements "X" scoped-to Y {\n}')).toBe('dsl');
        expect(detectFormatFromText('# Orders\n\n**Identity:** id\n')).toBe('markdown');
        expect(detectFormatFromText('module Orders {\n}')).toBe('dsl');
    });

    it('names the language of a DSL text by its root', () => {
        expect(dslRootKeyword('// c\nproduct "X" {}')).toBe('prd');
        expect(dslRootKeyword('requirements "X" scoped-to Y {}')).toBe('sysreq');
        expect(dslRootKeyword('architecture Sniplink {}')).toBe('architecture');
        expect(dslRootKeyword('organization Acme {\n  system Crm {}\n}')).toBe('architecture');
        expect(dslRootKeyword('organization Acme {\n  context Sales {}\n}')).toBe('domain');
        expect(dslRootKeyword('scenario X {}')).toBe('synth');
        expect(dslRootKeyword('entity Order {}')).toBe('domain');
    });

    it('quotes for the DSL lexer', () => {
        expect(quote('a "b" c')).toBe(`"a 'b' c"`);
        expect(quote('back\\slash')).toBe('"back\\\\slash"');
        expect(quote('two\n  lines')).toBe('"two lines"');
    });
});
