/**
 * The domain Markdown reader on a document written loosely — the way a person
 * or a language model writes one before knowing the conventions: group
 * headings, bare names, `- Label: value` lists, alias labels and columns, two
 * labels on one line, a paragraph that belongs nowhere. The reader must get
 * the model right, say what it assumed, and report what it dropped.
 */
import { describe, expect, it } from 'vitest';
import { read } from '../src/formats/index.js';
import type { ConstructModel, DomainModel } from '../src/cli/domain-model.js';

const loose = `
# context Orders

Orders placed by customers.

**Satisfies:** REQ-ORD-001 · **Metadata:** owner = "sales"

## Entities

### Customer

A customer.

- Identity: id : uuid

| name | type | description |
|---|---|---|
| email | string | Contact address |
| age | int? | |

### Order (aggregate)

**Identity**: \`id : uuid\`
**Entities:** OrderLine
**Satisfies:** REQ-ORD-002

This paragraph belongs nowhere in the model.

\`\`\`domain
operations {
  "Place" on PlaceOrder {
    unsafe
    emits OrderPlaced { orderId = id }
  }
}
\`\`\`

## Value Types

### Money

| field | type | constraints |
|---|---|---|
| amount | decimal | min(0) |
| currency | string | required maxLength(3) |

## Commands

### PlaceOrder

- Id: commandId : uuid

## Events

### OrderPlaced

- About: Order

### reaction NotifyOnPlaced

- Triggered by: OrderPlaced
- Effects: NotifyCustomer
`;

function construct(model: DomainModel, group: string, name: string): ConstructModel {
    const c = model.contexts?.[0].definitions?.[group]?.find(x => x.name === name);
    if (!c) throw new Error(`${group}/${name} not found in ${JSON.stringify(model.contexts?.[0].definitions, null, 1)}`);
    return c;
}

describe('a loosely written domain document', () => {
    it('reads into the model, says what it assumed, and reports what it dropped', async () => {
        const r = await read({ text: loose, fileName: 'orders.domain.md' });
        const errors = r.diagnostics.filter(d => d.severity === 'error');
        expect(errors.map(d => `${d.line}: ${d.message}`)).toEqual([]);
        expect(r.ok).toBe(true);
        const model = r.model as DomainModel;

        const ctx = model.contexts![0];
        expect(ctx.name).toBe('Orders');
        expect(ctx.description).toBe('Orders placed by customers.');
        expect((ctx as { satisfies?: string[] }).satisfies).toEqual(['REQ-ORD-001']);
        expect(ctx.metadata).toEqual({ owner: 'sales' });

        const customer = construct(model, 'entities', 'Customer');
        expect(customer.kind).toBe('entity');
        expect(customer.description).toBe('A customer.');
        expect(customer.identity).toEqual({ name: 'id', type: 'uuid' });
        expect(customer.fields).toEqual([
            { name: 'email', type: 'string', description: 'Contact address' },
            { name: 'age', type: 'int', optional: true },
        ]);

        const order = construct(model, 'aggregates', 'Order');
        expect(order.entities).toEqual(['OrderLine']);
        expect(order.satisfies).toEqual(['REQ-ORD-002']);
        expect((order.operations as { name: string; on: string }[]).map(o => [o.name, o.on])).toEqual([['Place', 'PlaceOrder']]);

        expect(construct(model, 'values', 'Money').fields?.map(f => f.constraints)).toEqual([['min(0)'], ['required', 'maxLength(3)']]);
        expect(construct(model, 'commands', 'PlaceOrder').identity).toEqual({ name: 'commandId', type: 'uuid' });
        expect(construct(model, 'events', 'OrderPlaced').about).toBe('Order');
        const reaction = construct(model, 'reactions', 'NotifyOnPlaced');
        expect(reaction.triggeredBy).toEqual(['OrderPlaced']);
        expect(reaction.effects).toBe('NotifyCustomer');

        // what the reader assumed and what it dropped, on the right lines
        const codes = r.diagnostics.map(d => `${d.code}@${d.line}`);
        expect(codes).toContain('MD-DEFAULT-KIND@10'); // Customer under "Entities"
        expect(codes).toContain('MD-UNMAPPED@27'); // the stray paragraph
        expect(r.diagnostics.find(d => d.code === 'MD-UNMAPPED')?.message).toMatch(/belongs nowhere/);
        expect(r.dsl).toMatch(/\/\/ unmapped \(markdown line 27\)/);
    });

    it('names the missing clause of a construct as an error on its heading', async () => {
        const r = await read({ text: '# context X\n\n## query GetOrder\n\n| field | type |\n|---|---|\n| id | uuid |\n', fileName: 'x.domain.md' });
        const messages = r.diagnostics.filter(d => d.severity === 'error').map(d => `${d.line}: ${d.code} ${d.message}`);
        expect(messages.some(m => m.startsWith('3: MD-READS-FROM'))).toBe(true);
        expect(messages.some(m => m.startsWith('3: MD-RETURNS'))).toBe(true);
    });

    it('maps a parser error back to the Markdown line', async () => {
        const md = '# context X\n\n## entity Order\n\n**Identity:** `id : uuid`\n\n```specy\noperations {\n  broken syntax here\n}\n```\n';
        const r = await read({ text: md, fileName: 'x.domain.md' });
        const parserErrors = r.diagnostics.filter(d => d.source === 'parser' && d.severity === 'error');
        expect(parserErrors.length).toBeGreaterThan(0);
        // the island starts on line 7 (the fence), its body on line 8; the broken line is 9
        expect(parserErrors.map(d => d.line)).toContain(9);
    });
});
