/**
 * The .synth language against the orders example: the scenario parses to the
 * JSON synthy consumes, every name resolves into orders.domain, and each class
 * of mistake is reported where it is made, with the planner's conflict code.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDomain, parseSynth, type ParseDiagnostic } from '../src/browser.js';

const examples = resolve(import.meta.dirname, '../../../../examples/ecommerce/v2');
const domainText = readFileSync(resolve(examples, 'orders.domain'), 'utf8');
const ordersSynth = readFileSync(resolve(examples, 'orders.synth'), 'utf8');

const scenario = (body: string, header = 'domain-source "orders.domain"\n    horizon 2025-01-01 .. 2025-07-01') => `scenario T {\n    ${header}\n    ${body}\n}`;
const errors = (d: ParseDiagnostic[]) => d.filter(x => x.severity === 'error');
const messages = (d: ParseDiagnostic[]) => d.map(x => `${x.code ?? '-'} ${x.message}`);

describe('orders.synth', () => {
    it('parses to the scenario JSON synthy consumes', async () => {
        const r = await parseSynth(ordersSynth, domainText, 'orders.synth');
        expect(messages(r.diagnostics)).toEqual([]);
        expect(r.ok).toBe(true);
        expect(r.scenario).toEqual({
            $schema: 'https://specy.ai/schemas/synth-scenario/1.json',
            parser: { name: 'specy-synth', version: expect.any(String) },
            name: 'OrdersH1_2025',
            description: 'Six months of e-commerce orders with a declared monthly revenue curve, lifecycle mix and payment-method split.',
            domain: 'orders.domain',
            seed: 42,
            horizon: { from: '2025-01-01', to: '2025-07-01' },
            asOf: '2025-07-01T00:00:00Z',
            populations: [
                { entity: 'Customer', count: 200 },
                { entity: 'Product', count: 60 },
                { entity: 'Order', count: 1200 },
                { entity: 'OrderLine', per: 'Order', min: 1, max: 5 },
                { entity: 'Payment', per: 'Order', exactly: 1 },
            ],
            outcomes: [
                { kind: 'curve', name: 'monthlyRevenue', measure: 'Order.totalAmount.amount', by: 'Order.placedAt', period: 'month', values: { '2025-01': 180000, '2025-02': 195000, '2025-03': 210000, '2025-04': 205000, '2025-05': 230000, '2025-06': 260000 } },
                { kind: 'mix', machine: 'Order.OrderLifecycle', values: { delivered: 0.72, shipped: 0.06, confirmed: 0.08, draft: 0.04, cancelled: 0.1 } },
                { kind: 'share', dimension: 'Payment.method', values: { creditCard: 0.6, paypal: 0.3, bankTransfer: 0.1 } },
                { kind: 'rollup', total: 'Order.totalAmount.amount', parts: 'OrderLine.total.amount' },
                { kind: 'rate', predicate: 'Product.available = true', values: 0.9 },
            ],
            options: { dwell: { 'draft->confirmed': '4h', 'confirmed->shipped': '2d', 'shipped->delivered': '3d', 'draft->cancelled': '1d', 'confirmed->cancelled': '1d' } },
        });
    });

    it('still parses the domain on the same services', async () => {
        const r = await parseDomain(domainText, 'orders.domain');
        expect(r.ok).toBe(true);
        expect(r.model.parser?.name).toBe('specy-domain');
        expect(r.model.modules?.[0].name).toBe('Orders');
    });
});

describe('references into the domain', () => {
    it('names the closest entity for an unknown one', async () => {
        const r = await parseSynth(scenario('populations { Oder count 10 }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual(["SYN-E001 'Oder' is not an entity, aggregate, read-only entity or value type of orders.domain. Did you mean 'Order'?"]);
    });

    it('checks each path segment against the previous one, without cascading', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 }\n outcomes { total Order.totalAmout.amount = 5 }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual(["SYN-E005 'totalAmout' is not a member of entity Order. Did you mean 'totalAmount'?"]);
    });

    it('opens a value type but refuses to cross a reference', async () => {
        const ok = await parseSynth(scenario('populations { Order count 10 }\n outcomes { total Order.totalAmount.amount = 5 }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        const bad = await parseSynth(scenario('populations { Order count 10 Customer count 2 }\n outcomes { share Order.customer.status { active: 100% } }'), domainText);
        expect(messages(errors(bad.diagnostics))).toEqual(["SYN-E006 Path Order.customer.status crosses a reference; an outcome must pin a column of Order's own table."]);
    });

    it('knows which enum a share or rate member belongs to', async () => {
        const r = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { share Payment.method { visa: 100% } }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual(["SYN-E007 'visa' is not a member of the enum behind Payment.method. Known: creditCard, bankTransfer, paypal."]);
    });

    it('offers only the machines of an entity to a mix, and its states to the entries', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 }\n outcomes { mix Order.Lifecycle { delivred: 100% } }'), domainText);
        expect(messages(errors(r.diagnostics))).toContain("SYN-E008 'Lifecycle' is not a state machine of entity Order. Known: OrderLifecycle.");
        const r2 = await parseSynth(scenario('populations { Order count 10 }\n outcomes { mix Order { delivred: 100% } }'), domainText);
        expect(messages(errors(r2.diagnostics))).toEqual(["SYN-E008 'delivred' is not a state of Order. Did you mean 'delivered'?"]);
    });

    it('resolves a field named like a keyword', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 OrderLine per Order 1..3 }\n outcomes { rollup Order.totalAmount.amount from OrderLine.total.amount }'), domainText);
        expect(errors(r.diagnostics)).toEqual([]);
        expect(r.scenario.outcomes?.[0]).toEqual({ kind: 'rollup', total: 'Order.totalAmount.amount', parts: 'OrderLine.total.amount' });
    });

    it('names the domain file when nothing in it matches', async () => {
        // In the browser the domain text is always supplied; an empty one still resolves nothing.
        const r = await parseSynth('scenario T { domain-source "missing.domain" populations { Order count 1 } }', '', 'x.synth');
        expect(messages(errors(r.diagnostics))).toEqual(["SYN-E001 'Order' is not an entity, aggregate, read-only entity or value type of missing.domain."]);
    });
});

describe("the planner's rules at edit time", () => {
    it('types measures, clocks and dimensions (SYN-E006)', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 clock status }\n outcomes { total Order.status = 5\n share Order.placedAt { true: 100% } }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            'SYN-E006 clock status of Order must be a date or datetime field; it is OrderStatus.',
            'SYN-E006 Path Order.status is OrderStatus; expected a numeric field (int, long, decimal).',
            'SYN-E006 Path Order.placedAt is datetime; expected an enum or boolean field.',
        ]);
    });

    it('wants shares and mixes to sum to 1, in percent or fractions (SYN-E007, SYN-E008)', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 Payment per Order exactly 1 }\n outcomes { share Payment.method { creditCard: 50%, paypal: 0.3 }\n mix Order { delivered: 0.5, draft: 0.5, cancelled: 10% } }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            'SYN-E007 Shares of Payment.method sum to 0.8, not 1. Make them sum to 1, or omit a member to leave it at 0.',
            'SYN-E008 Mix of Order sum to 1.1, not 1. Make them sum to 1, or omit a member to leave it at 0.',
        ]);
    });

    it('refuses an unreachable state (SYN-E008)', async () => {
        const r = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { mix Payment.PaymentLifecycle { refunded: 100% } }'), domainText);
        expect(errors(r.diagnostics)).toEqual([]);
        const unreachable = domainText.replace('captured --> refunded on "Refund a captured payment"', '');
        const r2 = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { mix Payment.PaymentLifecycle { refunded: 100% } }'), unreachable);
        expect(messages(errors(r2.diagnostics))).toEqual(['SYN-E008 State "refunded" is not reachable from [*] in Payment.PaymentLifecycle.']);
    });

    it('checks period keys against the period and the horizon (SYN-E010)', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 }\n outcomes { curve Order.totalAmount.amount by Order.placedAt per month { 2025-01: 10, 2025-Q1: 10, 2024-12: 10 } }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            'SYN-E010 "2025-Q1" is not a month key. Keys look like 2025-01 (month), 2025-Q1 (quarter), 2025-W03 (week), 2025-01-15 (day), 2025 (year).',
            'SYN-E010 Period 2024-12 lies outside the horizon.',
        ]);
    });

    it('wants a count population under a curve and a per parent under a rollup (SYN-E011, SYN-E013)', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 Payment per Order exactly 1 OrderLine count 30 }\n outcomes { total Payment.amount.amount = 5\n rollup Order.totalAmount.amount from OrderLine.total.amount }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            'SYN-E011 A total needs a count population; Payment is per Order.',
            'SYN-E013 OrderLine must be declared per Order for the rollup to hold.',
        ]);
    });

    it('reads durations and warns on dwells no machine declares (SYN-E015)', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 }\n options { default-dwell "soon" dwell { draft --> confirmed : 4h  shipped --> draft : 1d } }'), domainText);
        expect(messages(r.diagnostics)).toEqual([
            'SYN-E015 Cannot read duration "soon": use 4h, 2d, 45min, 30s, 1w or an ISO duration such as "PT2H".',
            '- No state machine declares a transition shipped --> draft; this dwell will never apply.',
        ]);
    });

    it('keeps one outcome per column and one period per time axis (SYN-E012)', async () => {
        const r = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { total Payment.amount.amount = 5\n curve Payment.amount.amount by Payment.processedAt per month { 2025-01: 5 }\n rate Payment.method = paypal by Payment.processedAt per quarter { 2025-Q1: 10% } }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            'SYN-E012 Two outcomes pin Payment.amount.amount.',
            'SYN-E012 Outcomes on Payment by Payment.processedAt disagree on the period: month and quarter.',
        ]);
        const second = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { curve Payment.amount.amount by Payment.processedAt per month { 2025-01: 5 }\n rate Payment.method = paypal by Payment.createdAt per month { 2025-01: 10% } }'), domainText);
        expect(errors(second.diagnostics)).toEqual([]);
    });

    it('reads compound rate predicates and writes them in one spelling (SYN-E009)', async () => {
        const ok = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { rate Payment.method = paypal and not (Payment.status=captured or Payment.status = refunded) : 20% }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        expect(ok.scenario.outcomes?.[0]).toEqual({ kind: 'rate', predicate: 'Payment.method = paypal and not (Payment.status = captured or Payment.status = refunded)', values: 0.2 });
        const two = await parseSynth(scenario('populations { Payment count 10\n Order count 5 }\n outcomes { rate Payment.method = paypal and Order.status = draft : 20% }'), domainText);
        expect(messages(errors(two.diagnostics))).toEqual(["SYN-E009 A rate's predicate reads one entity; this one reads Payment and Order."]);
        const bare = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { rate Payment.method != paypal or Payment.method : 20% }'), domainText);
        expect(messages(errors(bare.diagnostics))).toEqual(['SYN-E009 Predicate on enum PaymentMethod needs "= member".']);
    });

    it('splits a share per value of another column with given (SYN-E007, SYN-E012)', async () => {
        const ok = await parseSynth(scenario('populations { Customer count 10 }\n outcomes { share Customer.status { active: 80%, suspended: 20% }\n share segment Customer.email.value given Customer.status { } } '.replace('share segment Customer.email.value given Customer.status { } ', '')), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        const given = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { mix Payment { pending: 50%, captured: 50% }\n share Payment.method given Payment.status {\n captured: { creditCard: 70%, paypal: 30% }\n pending: { bankTransfer: 100% }\n } }'), domainText);
        expect(errors(given.diagnostics)).toEqual([]);
        expect(given.scenario.outcomes?.[1]).toEqual({ kind: 'share', dimension: 'Payment.method', given: 'Payment.status', values: { captured: { creditCard: 0.7, paypal: 0.3 }, pending: { bankTransfer: 1 } } });
        const flat = await parseSynth(scenario('populations { Payment count 10 }\n outcomes { share Payment.method given Payment.status { creditCard: 100% } }'), domainText);
        expect(messages(errors(flat.diagnostics))).toContain('SYN-E007 With "given", each value of Payment.status maps to a split: creditCard: { … }.');
        const unset = await parseSynth(scenario('populations { Customer count 10 }\n outcomes { share Customer.status given Customer.status { active: { active: 100% } } }'), domainText);
        expect(messages(errors(unset.diagnostics))).toContain('SYN-E012 A share of Customer.status cannot be given itself.');
    });

    it('keys a curve on a per population by its parent\'s clock (SYN-E006, SYN-E011)', async () => {
        const ok = await parseSynth(scenario('populations { Order count 10\n Payment per Order exactly 1 }\n outcomes { curve Payment.amount.amount by Order.placedAt per month { 2025-01: 500 } }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        const own = await parseSynth(scenario('populations { Order count 10\n Payment per Order exactly 1 }\n outcomes { curve Payment.amount.amount by Payment.createdAt per month { 2025-01: 500 } }'), domainText);
        expect(messages(errors(own.diagnostics))).toEqual(["SYN-E011 A curve by a field of Payment needs a count population; Payment is per Order. Key it by Order's clock instead."]);
        const other = await parseSynth(scenario('populations { Order count 10\n Customer count 4\n Payment per Order exactly 1 }\n outcomes { curve Payment.amount.amount by Customer.createdAt per month { 2025-01: 500 } }'), domainText);
        expect(messages(errors(other.diagnostics))).toEqual(['SYN-E006 by Customer.createdAt must be a field of Payment or of its parent Order.']);
    });

    it('reads the reaction latency and the rejections per precondition (SYN-E015)', async () => {
        const ok = await parseSynth(scenario('populations { Order count 10 }\n options { reaction-latency 30s\n rejections 5 }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        expect(ok.scenario.options).toEqual({ reactionLatency: '30s', rejections: 5 });
        const bad = await parseSynth(scenario('populations { Order count 10 }\n options { reaction-latency "soon"\n rejections 2.5 }'), domainText);
        expect(messages(errors(bad.diagnostics)).map(m => m.split(':')[0])).toEqual(['SYN-E015 Cannot read duration "soon"', 'SYN-E015 rejections is a count of commands per precondition']);
    });

    it('carries satisfies ids and names into the JSON', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 }\n outcomes { total revenue Order.totalAmount.amount = 5 :: "H1 revenue" satisfies [REQ-ORD-010, REQ-FIN-002] }'), domainText);
        expect(errors(r.diagnostics)).toEqual([]);
        expect(r.scenario.outcomes?.[0]).toEqual({ kind: 'total', name: 'revenue', measure: 'Order.totalAmount.amount', value: 5, description: 'H1 revenue', satisfies: ['REQ-ORD-010', 'REQ-FIN-002'] });
    });

    it('reads inline given rows', async () => {
        const r = await parseSynth(scenario('populations { Order count 10 }\n givens { Product rows [ { name: "Lamp", price: { amount: 12.5, currency: "EUR" }, available: true, tags: ["a", "b"] } ] }'), domainText);
        expect(errors(r.diagnostics)).toEqual([]);
        expect(r.scenario.givens).toEqual([{ entity: 'Product', rows: [{ name: 'Lamp', price: { amount: 12.5, currency: 'EUR' }, available: true, tags: ['a', 'b'] }] }]);
    });

    it('maps given columns and gives the instances of an enum of a value type (SYN-E023, SYN-E014)', async () => {
        const ok = await parseSynth(scenario('populations { Order count 10 }\n givens { Product csv "catalogue.csv" :: "the export" {\n name from "title"\n price.amount from "price_eur"\n } }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        expect(ok.scenario.givens).toEqual([{ entity: 'Product', csv: 'catalogue.csv', columns: { name: 'title', 'price.amount': 'price_eur' }, description: 'the export' }]);
        const bad = await parseSynth(scenario('populations { Order count 10 }\n givens { Product csv "c.csv" {\n nme from "title"\n price from "p"\n name from "a"\n name from "b"\n } }'), domainText);
        expect(messages(errors(bad.diagnostics))).toEqual([
            "SYN-E023 'nme' is not a member of entity Product. Did you mean 'name'?",
            'SYN-E023 price is a value of Money; map its fields (price.<field>).',
            'SYN-E023 name is mapped twice.',
        ]);
        const clash = await parseSynth(scenario('populations { Order count 10 }\n outcomes { share Product.available { true: 90% false: 10% } }\n givens { Product csv "c.csv" { available from "in_stock" } }'), domainText);
        expect(messages(errors(clash.diagnostics))).toEqual(['SYN-E014 share Product.available sets available, which the given supplies (from "in_stock").']);
        const per = await parseSynth(scenario('populations { Order count 10\n Payment per Order exactly 1 }\n givens { Payment csv "p.csv" }'), domainText);
        expect(messages(errors(per.diagnostics))[0]).toMatch(/^SYN-E014 Payment is given, so its rows are not generated per Order/);
        const all = readFileSync(resolve(examples, '../../conformance/all-constructs.domain'), 'utf8');
        const enumGiven = await parseSynth('scenario T {\n domain-source "all-constructs.domain"\n populations { }\n givens { Currencies rows [ { code: "usd", precision: 2 } ] { precision from "digits" } } }', all);
        expect(errors(enumGiven.diagnostics)).toEqual([]);
        expect(enumGiven.scenario.givens).toEqual([{ entity: 'Currencies', rows: [{ code: 'usd', precision: 2 }], columns: { precision: 'digits' } }]);
    });

    it('reads the vocabulary: a locale, a pack, word lists for text fields (SYN-E024)', async () => {
        const ok = await parseSynth(scenario('populations { Customer count 10 }\n vocabulary {\n locale "en-GB"\n pack "vocab/uk.json"\n Customer.name words "names.txt" :: "real names"\n Customer.shippingAddress.city words [ "Leeds", "York" ]\n }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        expect(ok.scenario.vocabulary).toEqual({ locale: 'en-GB', pack: 'vocab/uk.json', words: [{ field: 'Customer.name', file: 'names.txt', description: 'real names' }, { field: 'Customer.shippingAddress.city', values: ['Leeds', 'York'] }] });
        const bad = await parseSynth(scenario('populations { Customer count 10\n Order count 5 }\n vocabulary {\n locale klingon\n Order.totalAmount.amount words [ "x" ]\n Customer.shippingAddress.zipCode words [ "75001", "SW1A 1AA-LONDON" ]\n Customer.name words [ "a" ]\n Customer.name words [ "b" ]\n }'), domainText);
        expect(messages(errors(bad.diagnostics)).map(m => m.split(';')[0].split('. ')[0])).toEqual([
            'SYN-E024 Unknown locale "klingon"',
            'SYN-E024 Customer.name has two word lists.',
            'SYN-E024 Words apply to text fields',
            'SYN-E024 "SW1A 1AA-LONDON" is longer than maxLength(10) of Customer.shippingAddress.zipCode.',
        ]);
    });

    it('reads distributions and refuses a shape the field cannot take (SYN-E025, SYN-W013)', async () => {
        const ok = await parseSynth(scenario('populations { Customer count 10\n Product count 5\n Order count 20\n OrderLine per Order 1..3 }\n distributions {\n Product.price.amount lognormal median 25 sigma 0.9 :: "skewed"\n OrderLine.productId zipf 1.1\n Order.customer zipf\n Customer.createdAt uniform\n Customer.status zipf 2\n }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        expect(ok.scenario.distributions).toEqual([
            { field: 'Product.price.amount', shape: 'lognormal', median: 25, sigma: 0.9, description: 'skewed' },
            { field: 'OrderLine.productId', shape: 'zipf', exponent: 1.1 },
            { field: 'Order.customer', shape: 'zipf' },
            { field: 'Customer.createdAt', shape: 'uniform' },
            { field: 'Customer.status', shape: 'zipf', exponent: 2 },
        ]);
        const bad = await parseSynth(scenario('populations { Customer count 10\n Product count 5\n Payment count 3 }\n outcomes { share Payment.method { creditCard: 100% } }\n distributions {\n Product.price.amount zipf 2\n Customer.createdAt lognormal\n Customer.name zipf\n Product.available uniform\n Product.rating zipf 9\n Product.price.amount lognormal median 25\n Payment.method zipf\n }'), domainText);
        expect(messages(errors(bad.diagnostics)).map(m => m.split(':')[0])).toEqual([
            'SYN-E025 Product.price.amount has two distributions.',
            'SYN-E025 zipf does not fit Product.price.amount',
            'SYN-E025 lognormal does not fit Customer.createdAt',
            'SYN-E025 zipf does not fit Customer.name',
            'SYN-E025 uniform does not fit Product.available',
            'SYN-E025 A Zipf exponent is in (0, 5]; got 9.',
        ]);
        expect(messages(bad.diagnostics.filter(d => d.severity === 'warning')).filter(m => m.startsWith('SYN-W013'))).toEqual(['SYN-W013 The zipf shape of Payment.method never applies: share Payment.method sets the split exactly.']);
    });

    it('places count populations from a since date before the horizon end (SYN-E010)', async () => {
        const ok = await parseSynth(scenario('populations { Customer count 300 since 2023-01-01 clock createdAt :: "the customer base" }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        expect(ok.scenario.populations).toEqual([{ entity: 'Customer', count: 300, since: '2023-01-01', clock: 'createdAt', description: 'the customer base' }]);
        const late = await parseSynth(scenario('populations { Customer count 300 since 2026-01-01 }'), domainText);
        expect(messages(errors(late.diagnostics))).toEqual(["SYN-E010 since 2026-01-01 must come before the horizon's end."]);
    });
});

