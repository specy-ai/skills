/**
 * The .synth converter beyond the example files: every construct of the
 * language round-trips through the DSL printer, JSON and the canonical
 * Markdown; a loosely written Markdown scenario (a title instead of
 * `# scenario`, `- Label:` lists, alias columns, figures as lists, a stray
 * paragraph) is read with the right warnings; a scenario that names no domain
 * is refused.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { codecFor, read, write } from '../src/formats/index.js';
import { validateDocument } from '../src/formats/kit/schema.js';
import { jsonDiff } from '../src/formats/kit/text.js';
import { pct, populationLine } from '../src/formats/synth/printer.js';

const examples = resolve(import.meta.dirname, '../../../../examples/ecommerce/v2');
const domainText = readFileSync(resolve(examples, 'orders.domain'), 'utf8');
const companions = [{ fileName: 'orders.domain', text: domainText }];
const codec = codecFor('synth');

function strip(model: unknown): unknown {
    const m = JSON.parse(JSON.stringify(model)) as Record<string, unknown>;
    delete m.parser;
    return m;
}

const FULL = `scenario FullCoverage :: "Every construct of the language, for the round-trip tests" {
    satisfies [REQ-ORD-001, REQ-ORD-002]
    domain-source "orders.domain"
    requirements-source "orders.sysreq"
    seed "spring-2025"
    horizon 2025-01-01 .. 2025-04-01
    as-of 2025-04-01T00:00:00Z

    populations {
        Customer  count 50 since 2024-01-01 :: "Half of them signed up last year"
        Order     count 120 clock placedAt
        OrderLine per Order 1..5
        Payment   per Order exactly 1
    }

    outcomes {
        curve monthlyRevenue Order.totalAmount.amount by Order.placedAt per month alpha 3 :: "Three months" {
            satisfies [REQ-ORD-003]
            2025-01: 18000 over 40 rows
            2025-02: 19500 over 40 rows
            2025-03: 21000 over 40 rows
        }
        share paymentByStatus Payment.method given Payment.status :: "Cards fail more" {
            captured: { creditCard: 60%, paypal: 30%, bankTransfer: 10% }
            failed: { creditCard: 80%, paypal: 20% }
        }
        mix Order.OrderLifecycle {
            delivered: 70%
            cancelled: 30%
        }
        rate availability Product.available = true : 90% :: "Most products are available" satisfies [REQ-ORD-004]
        rate activeCustomers Customer.status = active by Customer.createdAt per month {
            2025-01: 5%
            2025-02: 0.06
            2025-03: 7%
        }
        rollup Order.totalAmount.amount from OrderLine.total.amount
    }

    givens {
        Product rows [
            { name: "Chair", price: { amount: 49.9, currency: "EUR" }, available: true, stockQuantity: 12, tags: [ "wood", "oak" ] },
            { name: "Table", price: { amount: 199, currency: "EUR" }, available: false, stockQuantity: 0, description: null }
        ] :: "Two products"
    }

    vocabulary {
        locale "en-GB"
        pack "vocab/uk.json"
        Customer.name words [ "Ada", "Grace", "Linus" ] :: "First names only"
        Product.description words "vocab/blurbs.txt"
    }

    distributions {
        Product.price.amount lognormal median 25 sigma 0.9
        Order.customer zipf 0.8 :: "Regulars"
        Customer.createdAt uniform
    }

    options {
        alpha 2
        decimals 2
        null-rate 20%
        default-dwell 1d
        dwell {
            draft --> confirmed : 4h
            confirmed --> shipped : "3 days"
        }
        reaction-latency 1min
        rejections 3
    }
}
`;

const TOTALS = `scenario Totals :: "A total and a compound rate" {
    domain-source "orders.domain"
    seed 1
    horizon 2025-01-01 .. 2025-02-01

    populations {
        Customer count 20
        Product count 5
        Order count 40
        OrderLine per Order 1..3
        Payment per Order exactly 1
    }

    outcomes {
        total revenue Order.totalAmount.amount = 12000 alpha 2 :: "January" satisfies [REQ-ORD-003]
        rate goodCards not (Payment.method = bankTransfer or Payment.method = paypal) : 55%
        rate active Customer.status = active : 0.9
    }
}
`;

const RULES = `scenario Rules :: "Conditional rules, among and grammars" {
    domain-source "orders.domain"
    seed 3
    horizon 2025-01-01 .. 2025-02-01

    populations {
        Customer count 20
        Product count 5
        Order count 40
        OrderLine per Order 1..3
        Payment per Order exactly 1
    }

    vocabulary {
        locale fr
        Product.name grammar "vocab/product-names.json" :: "composed"
        Product.description grammar "vocab/blurbs.json" by Product.available
    }

    distributions {
        Product.price.amount lognormal median 30 sigma 0.6
        Product.price.amount when Product.rating = 5 lognormal median 120 sigma 0.4 :: "five stars"
        Order.totalAmount.currency when Order.shippingAddress.country = GB among [ GBP ]
        Order.totalAmount.currency when Order.shippingAddress.country = "CH" among [ CHF: 80%, EUR: 20% ]
        Payment.method when Order.status = cancelled among [ bankTransfer ]
        Product.stockQuantity when Product.available = false among [ 0 ]
        Product.rating among [ 3, 4, 5 ]
    }
}
`;

describe('every construct round-trips', () => {
    for (const [name, text] of [
        ['full coverage', FULL],
        ['totals and compound rates', TOTALS],
        ['conditional rules and grammars', RULES],
    ] as const) {
        it(`${name}: DSL -> model -> DSL / JSON / Markdown -> same model`, async () => {
            const a = await read({ text, fileName: 'x.synth', companions });
            expect(a.diagnostics.map(d => d.message)).toEqual([]);
            expect(validateDocument(codec.schema(), a.model).map(d => d.message)).toEqual([]);

            const printed = write(codec, a.model, 'dsl');
            const b = await read({ text: printed, fileName: 'x.synth', companions });
            expect(b.diagnostics.map(d => `${d.line}: ${d.message}\n${printed.split('\n')[d.line - 1]}`)).toEqual([]);
            expect(jsonDiff(strip(a.model), strip(b.model))).toEqual([]);

            const json = write(codec, a.model, 'json', true);
            const c = await read({ text: json, fileName: 'x.synth.json', companions });
            expect(c.diagnostics.map(d => d.message)).toEqual([]);
            expect(jsonDiff(strip(a.model), strip(c.model))).toEqual([]);

            const md = write(codec, a.model, 'markdown');
            const d = await read({ text: md, fileName: 'x.synth.md', companions });
            expect(d.diagnostics.map(x => `${x.line}: [${x.severity}] ${x.message}\n    ${md.split('\n')[x.line - 1]}`)).toEqual([]);
            expect(jsonDiff(strip(a.model), strip(d.model))).toEqual([]);
        });
    }

    it('the full-coverage Markdown shows every block', async () => {
        const a = await read({ text: FULL, fileName: 'x.synth', companions });
        const md = write(codec, a.model, 'markdown');
        for (const line of [
            'specy: synth',
            'domain: orders.domain',
            'requirements: orders.sysreq',
            '# scenario FullCoverage',
            '**Seed:** `spring-2025`',
            '**Horizon:** 2025-01-01 .. 2025-04-01',
            '## Populations',
            '| Customer | 50 |  |  | 2024-01-01 |  | Half of them signed up last year |',
            '### curve monthlyRevenue',
            '| 2025-01 | 18000 | 40 |',
            '### share paymentByStatus',
            '| captured | creditCard | 60% |',
            '**Predicate:** `Product.available = true`',
            '**Value:** 90%',
            '### given Product',
            '| Chair | {"amount":49.9,"currency":"EUR"} | true | 12 | ["wood","oak"] |  |',
            '**Locale:** en-GB',
            '- `Customer.name`: "Ada", "Grace", "Linus" — First names only',
            '| `Product.price.amount` | lognormal | 25 | 0.9 |  |  |',
            '**Null rate:** 20%',
            '- confirmed --> shipped: 3 days',
        ]) {
            expect(md, `expected the Markdown to contain ${JSON.stringify(line)}`).toContain(line);
        }
    });
});

describe('a loosely written scenario', () => {
    const loose = `---
specy: synth
domain: orders.domain
---

# Spring campaign

A quarter of orders for the spring campaign.

- Seed: 7
- Horizon: 2025-01-01 → 2025-04-01
- As of: 2025-04-01

This paragraph is a stray note that maps to nothing.

## Rows

| Table | Rows | Parent | Min | Max |
|---|---|---|---|---|
| Customer | 40 | | | |
| Order | 100 | | | |
| OrderLine | | Order | 1 | 4 |
| Payment | | Order | exactly 1 | |

## Outcomes

### curve monthlyRevenue

- Measure: Order.totalAmount.amount
- By: Order.placedAt
- Per: month
- 2025-01: 10000 over 30 rows
- 2025-02: 12000 (over 35 rows)
- 2025-03: 14000 over 35 rows

### Lifecycle mix Order.OrderLifecycle

| State | % |
|---|---|
| delivered | 80 % |
| cancelled | 20% |

### share Payment.method

- creditCard: 0.6
- paypal: 0.4

## Settings

- Alpha: 2
- Dwell:
  - draft --> confirmed: 4h
`;

    it('reads into the scenario, with the warnings that say what was assumed and what was left', async () => {
        const r = await read({ text: loose, fileName: 'spring.md', language: 'synth', companions });
        const errors = r.diagnostics.filter(d => d.severity === 'error');
        expect(errors.map(d => `${d.line}: ${d.message}`)).toEqual([]);
        const codes = r.diagnostics.map(d => d.code);
        expect(codes).toContain('MD-DEFAULT-KIND');
        expect(codes).toContain('MD-UNMAPPED');
        const unmapped = r.diagnostics.find(d => d.code === 'MD-UNMAPPED')!;
        expect(unmapped.line).toBe(14);
        expect(unmapped.message).toContain('stray note');

        const m = r.model as Record<string, any>;
        expect(m.name).toBe('SpringCampaign');
        expect(m.description).toBe('A quarter of orders for the spring campaign.');
        expect(m.seed).toBe(7);
        expect(m.horizon).toEqual({ from: '2025-01-01', to: '2025-04-01' });
        expect(m.asOf).toBe('2025-04-01');
        expect(m.populations).toEqual([
            { entity: 'Customer', count: 40 },
            { entity: 'Order', count: 100 },
            { entity: 'OrderLine', per: 'Order', min: 1, max: 4 },
            { entity: 'Payment', per: 'Order', exactly: 1 },
        ]);
        expect(m.outcomes).toEqual([
            { kind: 'curve', name: 'monthlyRevenue', measure: 'Order.totalAmount.amount', by: 'Order.placedAt', period: 'month', values: { '2025-01': 10000, '2025-02': 12000, '2025-03': 14000 }, counts: { '2025-01': 30, '2025-02': 35, '2025-03': 35 } },
            { kind: 'mix', machine: 'Order.OrderLifecycle', values: { delivered: 0.8, cancelled: 0.2 } },
            { kind: 'share', dimension: 'Payment.method', values: { creditCard: 0.6, paypal: 0.4 } },
        ]);
        expect(m.options).toEqual({ alpha: 2, dwell: { 'draft->confirmed': '4h' } });
        expect(r.dsl).toContain('domain-source "orders.domain"');
        expect(r.dsl).toContain('// unmapped (markdown line 14)');
    });

    it('a scenario that names no domain is an error on the heading', async () => {
        const r = await read({ text: loose.replace('domain: orders.domain\n', ''), fileName: 'spring.md', language: 'synth', companions });
        const err = r.diagnostics.find(d => d.code === 'MD-DOMAIN');
        expect(err?.severity).toBe('error');
        expect(err?.line).toBe(5);
        expect(r.ok).toBe(false);
    });

    it('a **Domain:** line stands in for the front matter', async () => {
        const text = loose.replace('domain: orders.domain\n', '').replace('- Seed: 7', '- Domain: orders.domain\n- Seed: 7');
        const r = await read({ text, fileName: 'spring.md', language: 'synth', companions });
        expect(r.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
        expect((r.model as Record<string, unknown>).domain).toBe('orders.domain');
    });
});

describe('the printer', () => {
    it('writes an open range, a fraction a percentage cannot carry, and bare dates', () => {
        expect(populationLine({ entity: 'OrderLine', per: 'Order', min: 1 })).toBe('OrderLine per Order 1..n');
        expect(populationLine({ entity: 'Customer', count: 300, since: '2023-01-01', clock: 'createdAt', description: 'old' })).toBe('Customer count 300 since 2023-01-01 clock createdAt :: "old"');
        expect(pct(0.72)).toBe('72%');
        expect(pct(0.07)).toBe('7%');
        expect(pct(1 / 3)).toBe(String(1 / 3));
    });
});
