/**
 * The .synth language against the orders example: the scenario parses to the
 * JSON synthy consumes, every name resolves into orders.domain, and each class
 * of mistake is reported where it is made, with the planner's conflict code.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDomain, parseSynth, type ParseDiagnostic } from '../src/browser.js';
import { EmptyFileSystem } from 'langium';
import { expectCompletion } from 'langium/test';
import { createSpecyLspServices } from '../src/language/specy-module.js';
import { SYNTH_KIND_NAMES } from '../src/language/synth-kinds.js';

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
        // no bindings, no key for them: a document written before bindings keeps its bytes
        expect(JSON.stringify(ok.scenario.vocabulary)).toBe('{"locale":"en-GB","pack":"vocab/uk.json","words":[{"field":"Customer.name","file":"names.txt","description":"real names"},{"field":"Customer.shippingAddress.city","values":["Leeds","York"]}]}');
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

    it('reads conditional rules, among and grammars, and refuses what a condition cannot read (SYN-E025, SYN-E026, SYN-E024)', async () => {
        const body = 'populations { Customer count 10\n Product count 5\n Order count 20\n OrderLine per Order 1..3\n Payment per Order exactly 1 }\n vocabulary {\n Product.name grammar "vocab/names.json"\n Product.description grammar "vocab/blurbs.json" by Product.available :: "stock"\n }\n distributions {\n Product.price.amount lognormal median 30 sigma 0.6\n Product.price.amount when Product.rating = 5 lognormal median 120 sigma 0.4\n Order.totalAmount.currency when Order.shippingAddress.country = GB among [ GBP ]\n Order.totalAmount.currency when Order.shippingAddress.country = "CH" among [ CHF: 80%, EUR: 20% ] :: "Swiss"\n Payment.method when Order.status = cancelled among [ bankTransfer ]\n Product.stockQuantity when Product.available = false among [ 0 ]\n }';
        const ok = await parseSynth(scenario(body), domainText);
        expect(messages(errors(ok.diagnostics))).toEqual([]);
        expect(ok.scenario.vocabulary).toEqual({ grammars: [{ field: 'Product.name', file: 'vocab/names.json' }, { field: 'Product.description', file: 'vocab/blurbs.json', by: 'Product.available', description: 'stock' }] });
        expect(ok.scenario.distributions).toEqual([
            { field: 'Product.price.amount', shape: 'lognormal', median: 30, sigma: 0.6 },
            { field: 'Product.price.amount', when: { field: 'Product.rating', value: 5 }, shape: 'lognormal', median: 120, sigma: 0.4 },
            { field: 'Order.totalAmount.currency', when: { field: 'Order.shippingAddress.country', value: 'GB' }, shape: 'among', values: ['GBP'] },
            { field: 'Order.totalAmount.currency', when: { field: 'Order.shippingAddress.country', value: 'CH' }, shape: 'among', values: { CHF: 0.8, EUR: 0.2 }, description: 'Swiss' },
            { field: 'Payment.method', when: { field: 'Order.status', value: 'cancelled' }, shape: 'among', values: ['bankTransfer'] },
            { field: 'Product.stockQuantity', when: { field: 'Product.available', value: false }, shape: 'among', values: [0] },
        ]);
        const bad = await parseSynth(
            scenario('populations { Customer count 10\n Product count 5\n Order count 20\n OrderLine per Order 1..3\n Payment per Order exactly 1 }\n outcomes { share Payment.method { creditCard: 100% } }\n vocabulary {\n Product.name words [ "Lamp" ]\n Product.name grammar "n.json"\n Product.rating grammar "r.json"\n }\n distributions {\n OrderLine.quantity when Product.rating = 5 among [ 1 ]\n Order.totalAmount.currency when Order.customer = x among [ EUR ]\n Order.totalAmount.currency when Order.placedAt = "2025-01-01" among [ EUR ]\n Order.shippingAddress.city when Order.shippingAddress.country = GB among [ London ]\n Payment.method when Payment.status = sent among [ paypal ]\n Payment.method among [ cash ]\n Payment.method among [ creditCard: 50%, paypal: 30% ]\n Product.rating among [ 0, 6 ]\n Order.customer when Order.status = draft zipf\n Order.placedAt among [ "2025-01-01" ]\n Payment.method when Order.status = draft among [ paypal ]\n Payment.method when Order.status = draft uniform\n Payment.method when Order.status = cancelled among [ bankTransfer ]\n Order.totalAmount.currency when Order.shippingAddress.country = GB among [ GBP ]\n Order.shippingAddress.country when Order.totalAmount.currency = GBP among [ GB ]\n }'),
            domainText,
        );
        expect(messages(errors(bad.diagnostics))).toEqual([
            'SYN-E024 Product.name has both a word list and a grammar.',
            'SYN-E024 A grammar applies to a text field; Product.rating is int.',
            'SYN-E025 Payment.method has two distributions.',
            'SYN-E025 Payment.method has two distributions for Order.status = draft.',
            'SYN-E025 The rule on OrderLine.quantity reads Product.rating, which is not a field of OrderLine nor of its parent Order.',
            'SYN-E025 The rule on Order.totalAmount.currency reads Order.customer, a reference.',
            'SYN-E025 The rule on Order.totalAmount.currency reads Order.placedAt, a datetime: conditions read enums, booleans, whole numbers and text.',
            'SYN-E025 The rule on Order.shippingAddress.city reads Order.shippingAddress.country, inside the value it decides.',
            'SYN-E025 The rule on Payment.method compares Payment.status with sent: sent is not a member of PaymentStatus (pending, captured, failed, refunded).',
            'SYN-E025 among on Payment.method: cash is not a member of PaymentMethod (creditCard, bankTransfer, paypal).',
            'SYN-E025 among on Payment.method: the weights sum to 0.8, not 1.',
            'SYN-E025 among on Product.rating: 0 lies outside its bounds [1, 5].',
            'SYN-E025 among on Product.rating: 6 lies outside its bounds [1, 5].',
            'SYN-E025 zipf does not fit Order.customer when Order.status = draft: a reference takes a shape without a condition.',
            'SYN-E025 among does not fit Order.placedAt: it is datetime; among draws enum members, booleans, numbers or texts.',
            'SYN-E026 The rules on Order read each other in a cycle: totalAmount reads shippingAddress, shippingAddress reads totalAmount.',
            'SYN-E026 The rules on Order read each other in a cycle: totalAmount reads shippingAddress, shippingAddress reads totalAmount.',
        ]);
        expect(messages(bad.diagnostics.filter(d => d.severity === 'warning')).filter(m => m.startsWith('SYN-W013'))).toEqual([
            'SYN-W013 The among shape of Payment.method never applies: share Payment.method sets the column.',
            'SYN-W013 The among shape of Payment.method never applies: share Payment.method sets the column.',
            'SYN-W013 The among shape of Payment.method when Order.status = draft never applies: share Payment.method sets the column.',
            'SYN-W013 The uniform shape of Payment.method when Order.status = draft never applies: share Payment.method sets the split exactly.',
            'SYN-W013 The among shape of Payment.method when Order.status = cancelled never applies: share Payment.method sets the column.',
        ]);
    });

    it('copies through one declared reference with from, lets a condition and a by read through one, and refuses the rest (SYN-E025)', async () => {
        const body = 'populations { Customer count 10\n Product count 5\n Order count 20\n OrderLine per Order 1..3\n Payment per Order exactly 1 }\n vocabulary {\n Payment.failureReason grammar "vocab/reasons.json" by Payment.order.status\n }\n distributions {\n Order.shippingAddress from Order.customer.shippingAddress\n Order.shippingAddress when Order.status = draft from Order.customer.shippingAddress :: "drafts too"\n Payment.amount.currency from Payment.order.totalAmount.currency\n Payment.method when Payment.order.status = cancelled among [ bankTransfer ]\n Order.totalAmount.currency when Order.customer.status = suspended among [ EUR ]\n }';
        const ok = await parseSynth(scenario(body), domainText);
        expect(messages(errors(ok.diagnostics))).toEqual([]);
        expect(ok.scenario.vocabulary).toEqual({ grammars: [{ field: 'Payment.failureReason', file: 'vocab/reasons.json', by: 'Payment.order.status' }] });
        expect(ok.scenario.distributions).toEqual([
            { field: 'Order.shippingAddress', shape: 'from', source: 'Order.customer.shippingAddress' },
            { field: 'Order.shippingAddress', when: { field: 'Order.status', value: 'draft' }, shape: 'from', source: 'Order.customer.shippingAddress', description: 'drafts too' },
            { field: 'Payment.amount.currency', shape: 'from', source: 'Payment.order.totalAmount.currency' },
            { field: 'Payment.method', when: { field: 'Payment.order.status', value: 'cancelled' }, shape: 'among', values: ['bankTransfer'] },
            { field: 'Order.totalAmount.currency', when: { field: 'Order.customer.status', value: 'suspended' }, shape: 'among', values: ['EUR'] },
        ]);
        expect(JSON.stringify(ok.scenario.distributions![1])).toBe('{"field":"Order.shippingAddress","when":{"field":"Order.status","value":"draft"},"shape":"from","source":"Order.customer.shippingAddress","description":"drafts too"}');
        const bad = await parseSynth(
            scenario('populations { Customer count 10\n Product count 5\n Order count 20\n OrderLine per Order 1..3\n Payment per Order exactly 1 }\n vocabulary {\n Payment.failureReason grammar "r.json" by Payment.order.customer.status\n }\n distributions {\n Order.shippingAddress from Order.totalAmount\n Payment.amount from Payment.order.customer.shippingAddress\n OrderLine.productPrice from OrderLine.productId.price\n Order.shippingAddress from Order.lines.total\n Order.totalAmount from Order.customer.shippingAddress\n Order.id from Order.customer.id\n Order.customer from Order.customer.status\n Payment.method from Order.status\n Payment.method when Payment.order.customer.status = suspended among [ paypal ]\n OrderLine.quantity when OrderLine.productId.available = false among [ 1 ]\n Order.totalAmount.currency when Order.lines.quantity = 1 among [ EUR ]\n Order.totalAmount.currency when Order.customer.createdAt = "2025-01-01" among [ EUR ]\n Order.totalAmount.currency when Order.customer = x among [ EUR ]\n }'),
            domainText,
        );
        expect(messages(errors(bad.diagnostics))).toEqual([
            'SYN-E025 The grammar of Payment.failureReason reads Payment.order.customer.status, which crosses two references.',
            'SYN-E025 Order.shippingAddress has two distributions.',
            'SYN-E025 from does not fit Order.shippingAddress: the source stays on the row; a copy reads through a reference (Order.customer.shippingAddress).',
            'SYN-E025 from does not fit Payment.amount: the source crosses two references; one is read.',
            'SYN-E025 from does not fit OrderLine.productPrice: the source is an inferred key; a declared reference is read.',
            'SYN-E025 from does not fit Order.shippingAddress: a collection is not copied.',
            'SYN-E025 from does not fit Order.totalAmount: the source is a Address while the field is a Money.',
            'SYN-E025 from does not fit Order.id: the identity is not copied.',
            'SYN-E025 from does not fit Order.customer: a reference takes uniform or zipf.',
            'SYN-E025 from does not fit Payment.method: the source is a path from Order, not from Payment.',
            'SYN-E025 The rule on Payment.method reads Payment.order.customer.status, which crosses two references.',
            'SYN-E025 The rule on OrderLine.quantity reads OrderLine.productId.available, through an inferred key; a declared reference is read.',
            'SYN-E025 The rule on Order.totalAmount.currency reads Order.lines.quantity, through a collection.',
            'SYN-E025 The rule on Order.totalAmount.currency reads Order.customer.createdAt, a datetime: conditions read enums, booleans, whole numbers and text.',
            'SYN-E025 The rule on Order.totalAmount.currency reads Order.customer, a reference.',
        ]);
        expect(bad.diagnostics.filter(d => d.severity === 'warning')).toEqual([]);
    });

    it('places count populations from a since date before the horizon end (SYN-E010)', async () => {
        const ok = await parseSynth(scenario('populations { Customer count 300 since 2023-01-01 clock createdAt :: "the customer base" }'), domainText);
        expect(errors(ok.diagnostics)).toEqual([]);
        expect(ok.scenario.populations).toEqual([{ entity: 'Customer', count: 300, since: '2023-01-01', clock: 'createdAt', description: 'the customer base' }]);
        const late = await parseSynth(scenario('populations { Customer count 300 since 2026-01-01 }'), domainText);
        expect(messages(errors(late.diagnostics))).toEqual(["SYN-E010 since 2026-01-01 must come before the horizon's end."]);
    });
});

describe('typed values: vocabulary bindings', () => {
    it('parses bindings among word lists, in the canonical key order', async () => {
        const r = await parseSynth(scenario('populations { Customer count 10 }\n vocabulary {\n EmailAddress as email :: "the customer\'s own"\n }'), domainText);
        expect(errors(r.diagnostics)).toEqual([]);
        const mixed = await parseSynth(scenario('populations { Customer count 10 }\n vocabulary {\n locale fr\n EmailAddress as email :: "the customer\'s own"\n Customer.name words [ "Ada" ]\n Address.zipCode as postcode\n Customer.shippingAddress.country as text\n }'), domainText);
        expect(messages(errors(mixed.diagnostics))).toEqual([]);
        expect(JSON.stringify(mixed.scenario.vocabulary)).toBe(
            '{"locale":"fr","words":[{"field":"Customer.name","values":["Ada"]}],"bindings":[{"target":"EmailAddress","kind":"email","description":"the customer\'s own"},{"target":"Address.zipCode","kind":"postcode"},{"target":"Customer.shippingAddress.country","kind":"text"}]}',
        );
        expect(r.scenario.vocabulary).toEqual({ bindings: [{ target: 'EmailAddress', kind: 'email', description: "the customer's own" }] });
    });

    it('reads every kind as a kind, and needs no population for the type it binds', async () => {
        const body = SYNTH_KIND_NAMES.map(k => `Customer.name as ${k}`).join('\n ');
        const r = await parseSynth(scenario(`populations { }\n vocabulary {\n ${body}\n }`), domainText);
        // percentage and money do not apply to a string, and Customer.name is bound once: no syntax or linking error
        expect(errors(r.diagnostics).every(d => d.code === 'SYN-E024')).toBe(true);
        expect((r.scenario.vocabulary?.bindings as { kind: string }[]).map(b => b.kind)).toEqual([...SYNTH_KIND_NAMES]);
        const free = await parseSynth(scenario('populations { }\n vocabulary { EmailAddress as email\n Order.totalAmount as money\n Product.rating as percentage }'), domainText);
        expect(errors(free.diagnostics)).toEqual([]);
    });

    it('resolves a field named as', async () => {
        const domain = domainText.replace('country : string\n', 'country : string\n            as : string\n');
        expect(domain).not.toBe(domainText);
        const r = await parseSynth(scenario('populations { Customer count 10 }\n vocabulary {\n Address.as as text\n Customer.shippingAddress.as words [ "x" ]\n }'), domain);
        expect(messages(errors(r.diagnostics))).toEqual([]);
        expect(r.scenario.vocabulary).toEqual({ words: [{ field: 'Customer.shippingAddress.as', values: ['x'] }], bindings: [{ target: 'Address.as', kind: 'text' }] });
    });

    it('completes the kind after as, and only the kinds', async () => {
        const { SpecySynth } = createSpecyLspServices(EmptyFileSystem);
        await expectCompletion(SpecySynth)({
            text: 'scenario T {\n domain-source "orders.domain"\n populations { }\n vocabulary { Iban as <|> }\n}',
            index: 0,
            expectedItems: [...SYNTH_KIND_NAMES],
        });
    });

    it('names the closest kind for an unknown one, and lists the kinds (SYN-E024)', async () => {
        const r = await parseSynth(scenario('populations { }\n vocabulary { EmailAddress as emial\n Address.zipCode as zzzzzzzz }'), domainText);
        const kinds = SYNTH_KIND_NAMES.join(', ');
        expect(messages(errors(r.diagnostics))).toEqual([
            `SYN-E024 Unknown kind "emial". Did you mean 'email'? Kinds: ${kinds}.`,
            `SYN-E024 Unknown kind "zzzzzzzz". Kinds: ${kinds}.`,
        ]);
    });

    it('resolves the target as word lists do (SYN-E001, SYN-E005)', async () => {
        const r = await parseSynth(scenario('populations { }\n vocabulary { Adress.zipCode as postcode\n Address.zipCod as postcode }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            "SYN-E001 'Adress' is not an entity, aggregate, read-only entity or value type of orders.domain. Did you mean 'Address'?",
            "SYN-E005 'zipCod' is not a member of value type Address. Did you mean 'zipCode'?",
        ]);
    });

    it('wants a leaf the kind applies to (SYN-E024)', async () => {
        const r = await parseSynth(scenario('populations { }\n vocabulary {\n Order.placedAt as email\n Customer.status as phone\n Customer as email\n Order.customer.email as email\n Customer.name as percentage\n OrderLine as email\n Address as money\n }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            'SYN-E024 email applies to text fields, or a value type with one text field; Order.placedAt is datetime.',
            'SYN-E024 phone applies to text fields, or a value type with one text field; Customer.status is enum CustomerStatus.',
            'SYN-E024 email applies to text fields, or a value type with one text field; Customer is an entity: name one of its fields (Customer.<field> as email).',
            'SYN-E024 email applies to text fields, or a value type with one text field; Order.customer.email is reached through a reference. Bind Customer.email as email instead.',
            'SYN-E024 percentage applies to numeric fields, or a value type with one numeric field; Customer.name is string.',
            'SYN-E024 email applies to text fields, or a value type with one text field; OrderLine has no text field.',
            'SYN-E024 money applies to numeric fields, or a value type with one numeric field (the amount) and at most one text field (the currency); Address has no numeric field.',
        ]);
    });

    it('asks for Type.field when a value type has several candidate fields (SYN-E024)', async () => {
        const r = await parseSynth(scenario('populations { }\n vocabulary {\n Address as iban\n Order.shippingAddress as postcode\n Address.zipCode as postcode\n }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            'SYN-E024 Address has 4 text fields (street, city, zipCode, country); name the one iban applies to: Address.street as iban.',
            'SYN-E024 Order.shippingAddress (Address) has 4 text fields (street, city, zipCode, country); name the one postcode applies to: Order.shippingAddress.street as postcode.',
        ]);
        const twoTexts = domainText.replace('currency : string default("EUR") maxLength(3)', 'currency : string default("EUR") maxLength(3)\n            label : string');
        const money = await parseSynth(scenario('populations { }\n vocabulary { Money as money\n Money.amount as money }'), twoTexts);
        expect(messages(errors(money.diagnostics))).toEqual([
            'SYN-E024 money takes a value type with one numeric field (the amount) and at most one text field (the currency); Money has 2 text fields (currency, label). Name the amount: Money.amount as money.',
        ]);
    });

    it('refuses two bindings for one target (SYN-E024)', async () => {
        const r = await parseSynth(scenario('populations { }\n vocabulary { EmailAddress as email\n EmailAddress.value as email\n EmailAddress as text }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual(['SYN-E024 EmailAddress has two bindings.']);
    });

    it("refuses a kind whose lengths the field's minLength/maxLength exclude (SYN-E024)", async () => {
        const r = await parseSynth(scenario('populations { }\n vocabulary {\n Address.zipCode as iban\n Money as siren\n Order.shippingAddress.zipCode as postcode\n Customer.name as url\n }'), domainText);
        expect(messages(errors(r.diagnostics))).toEqual([
            'SYN-E024 iban produces 16 to 27 characters; Address.zipCode allows at most 10 (maxLength(10)).',
            'SYN-E024 siren produces 9 characters; Money.currency allows at most 3 (maxLength(3)).',
        ]);
        const long = domainText.replace('zipCode : string maxLength(10)', 'zipCode : string minLength(12)');
        const short = await parseSynth(scenario('populations { }\n vocabulary { Customer.shippingAddress.zipCode as postcode\n Address.zipCode as text }'), long);
        expect(messages(errors(short.diagnostics))).toEqual(['SYN-E024 postcode produces 3 to 10 characters; Customer.shippingAddress.zipCode needs at least 12 (minLength(12)).']);
    });
});
