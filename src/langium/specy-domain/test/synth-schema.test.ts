/**
 * The scenario document and its JSON Schema (src/schemas/synth-scenario.schema.json):
 * whatever specy-synth emits validates, in JSON and in YAML, and the schema
 * refuses the structural mistakes a hand-written JSON or YAML file can make.
 * Semantic checks (does Order.totalAmount resolve?) stay with synthy check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseSynth } from '../src/browser.js';
import { SYNTH_SCENARIO_SCHEMA } from '../src/cli/version.js';

const root = resolve(import.meta.dirname, '..');
const examples = resolve(root, '../../../examples/ecommerce/v2');
const schema = JSON.parse(readFileSync(resolve(root, '../../schemas/synth-scenario.schema.json'), 'utf8'));
const domainText = readFileSync(resolve(examples, 'orders.domain'), 'utf8');
const ordersSynth = readFileSync(resolve(examples, 'orders.synth'), 'utf8');

// strictRequired only lints `required` inside oneOf/not branches; every other strict rule applies
const validate = new Ajv2020({ allErrors: true, strict: true, strictRequired: false }).compile(schema);
const errorsOf = (doc: unknown) => (validate(doc) ? [] : (validate.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`));
const synthCli = (...args: string[]) => spawnSync(process.execPath, [resolve(root, 'out/cli/synth.js'), ...args], { encoding: 'utf8' });

async function orders() {
    const r = await parseSynth(ordersSynth, domainText, 'orders.synth');
    expect(r.ok).toBe(true);
    return JSON.parse(JSON.stringify(r.scenario)) as Record<string, any>;
}

describe('the scenario schema', () => {
    it('is the schema the parser names in $schema', () => {
        expect(schema.$id).toBe(SYNTH_SCENARIO_SCHEMA);
    });

    it('accepts what specy-synth parse emits', async () => {
        const doc = await orders();
        expect(doc.$schema).toBe(SYNTH_SCENARIO_SCHEMA);
        expect(errorsOf(doc)).toEqual([]);
    });

    it('accepts the catalogue example: given columns, a vocabulary and distributions', async () => {
        const r = await parseSynth(readFileSync(resolve(examples, 'catalogue.synth'), 'utf8'), domainText, 'catalogue.synth');
        expect(r.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
        const doc = JSON.parse(JSON.stringify(r.scenario)) as Record<string, any>;
        expect(errorsOf(doc)).toEqual([]);
        expect(Object.keys(doc).slice(-3)).toEqual(['givens', 'vocabulary', 'distributions']);
        expect(errorsOf({ ...doc, vocabulary: { locale: 'fr', words: [{ field: 'Product.name' }] } })).not.toEqual([]);
        expect(errorsOf({ ...doc, distributions: [{ field: 'Product.price.amount', shape: 'zipf', median: 3 }] })).not.toEqual([]);
        expect(errorsOf({ ...doc, givens: [{ entity: 'Product', csv: 'c.csv', columns: { 'price amount': 'x' } }] })).not.toEqual([]);
    });

    it('accepts every outcome kind, givens and options as the parser writes them', async () => {
        const text = `scenario Full :: "all of it" {
    satisfies [REQ-ORD-001]
    domain-source "orders.domain"
    requirements-source "orders.sysreq"
    seed "s-1"
    horizon 2025-01-01 .. 2025-04-01
    as-of 2025-03-31T12:00:00Z
    populations {
        Order count 300 clock placedAt :: "orders"
        OrderLine per Order 1..3
        Payment count 300
        Product count 2
        Customer count 50
    }
    outcomes {
        curve revenue Order.totalAmount.amount by Order.placedAt per month alpha 3 :: "monthly" {
            satisfies [REQ-ORD-002]
            2025-01: 1000 over 100 rows
            2025-02: 1000 over 100 rows
            2025-03: 1000 over 100 rows
        }
        share Payment.method given Payment.status { captured: { creditCard: 60%  paypal: 0.3  bankTransfer: 10% } pending: { paypal: 100% } }
        rate Customer.status = active and not Customer.status = closed by Customer.createdAt per month { 2025-01: 90%  2025-02: 95% }
        rollup Order.totalAmount.amount from OrderLine.total.amount
    }
    givens {
        Product rows [ { name: "Pen", available: true }, { name: "Ink", available: false } ]
    }
    options {
        null-rate 5%
        decimals 2
        alpha 2
        default-dwell "PT2H"
        dwell { draft --> confirmed : 4h }
        rejections 2
        reaction-latency 30s
    }
}`;
        const r = await parseSynth(text, domainText, 'full.synth');
        expect(r.diagnostics.filter(d => d.severity === 'error').map(d => `${d.code ?? '-'} ${d.message}`)).toEqual([]);
        const doc = JSON.parse(JSON.stringify(r.scenario));
        expect(errorsOf(doc)).toEqual([]);
        // the canonical key order: options sorted whatever the text order
        expect(Object.keys(doc.options)).toEqual(['alpha', 'decimals', 'nullRate', 'defaultDwell', 'dwell', 'reactionLatency', 'rejections']);
        expect(doc.outcomes[1]).toEqual({ kind: 'share', dimension: 'Payment.method', given: 'Payment.status', values: { captured: { creditCard: 0.6, paypal: 0.3, bankTransfer: 0.1 }, pending: { paypal: 1 } } });
        expect(doc.outcomes[2].predicate).toBe('Customer.status = active and not Customer.status = closed');
        expect(Object.keys(doc.outcomes[0])).toEqual(['kind', 'name', 'measure', 'by', 'period', 'alpha', 'values', 'counts', 'description', 'satisfies']);
    });

    it('refuses the structural mistakes of a hand-written document', async () => {
        const base = await orders();
        const cases: [string, (d: Record<string, any>) => void, string][] = [
            ['unknown key', d => { d.seeed = 1; }, 'must NOT have additional properties'],
            ['count and per', d => { d.populations[0].per = 'Order'; }, 'must match exactly one schema in oneOf'],
            ['per without cardinality', d => { delete d.populations[4].exactly; }, 'must match exactly one schema in oneOf'],
            ['fraction above 1', d => { d.outcomes[1].values.delivered = 1.2; }, 'must be <= 1'],
            ['period key', d => { d.outcomes[0].values['2025-1'] = 5; }, 'must match pattern'],
            ['unknown kind', d => { d.outcomes[2].kind = 'shares'; }, 'must be equal to one of the allowed values'],
            ['missing measure', d => { delete d.outcomes[0].measure; }, "must have required property 'measure'"],
            ['dot-path', d => { d.outcomes[3].total = 'Order..totalAmount'; }, 'must match pattern'],
            ['requirement id', d => { d.satisfies = ['ORD-1']; }, 'must match pattern'],
            ['given with a flat split', d => { d.outcomes[2].given = 'Payment.status'; }, 'must be object'],
            ['a split per value without given', d => { d.outcomes[2].values = { captured: { creditCard: 1 } }; }, 'must be number'],
            ['predicate', d => { d.outcomes.push({ kind: 'rate', predicate: 'Order.status = = draft', values: 0.5 }); }, 'must match pattern'],
            ['rejections', d => { d.options = { rejections: -1 }; }, 'must be >= 0'],
            ['duration', d => { d.options.dwell['draft->confirmed'] = 'four hours'; }, 'must match pattern'],
            ['entity-qualified dwell key', d => { d.options.dwell['Order.draft->confirmed'] = '1d'; }, 'must match pattern'],
            ['instant', d => { d.asOf = '07/01/2025'; }, 'must match pattern'],
            ['rate per period without by', d => { d.outcomes[4].values = { '2025-01': 0.5 }; }, "must have required property 'by'"],
        ];
        for (const [label, mutate, expected] of cases) {
            const doc = JSON.parse(JSON.stringify(base));
            mutate(doc);
            const errs = errorsOf(doc);
            expect(errs.join('\n'), label).toContain(expected);
        }
    });

    it('accepts percentage strings and ISO durations where the loader does', async () => {
        const doc = await orders();
        doc.outcomes[2].values = { creditCard: '60%', paypal: '30%', bankTransfer: '10%' };
        doc.options.defaultDwell = 'PT2H30M';
        doc.options.dwell['draft->confirmed'] = '45 minutes';
        expect(errorsOf(doc)).toEqual([]);
        for (const bad of ['P', 'PT', '4 parsecs', '']) {
            doc.options.defaultDwell = bad;
            expect(errorsOf(doc).length, bad).toBeGreaterThan(0);
        }
    });
});

describe('specy-synth parse -f yaml', () => {
    const file = resolve(examples, 'orders.synth');

    it('writes the same document as JSON', () => {
        const json = synthCli('parse', file, '--strict');
        const yaml = synthCli('parse', file, '--strict', '-f', 'yaml');
        expect(json.status).toBe(0);
        expect(yaml.status).toBe(0);
        expect(parseYaml(yaml.stdout, { schema: 'core' })).toEqual(JSON.parse(json.stdout));
        expect(errorsOf(parseYaml(yaml.stdout))).toEqual([]);
    });

    it('quotes what a YAML 1.1 reader would retype, and nothing else', () => {
        const yaml = synthCli('parse', file, '--strict', '-f', 'yaml').stdout;
        expect(yaml).toContain('from: "2025-01-01"');
        expect(yaml).toContain('asOf: "2025-07-01T00:00:00Z"');
        expect(yaml).toContain('  2025-01: 180000');
        expect(yaml).toContain('predicate: Product.available = true');
        expect(yaml).toContain('draft->confirmed: 4h');
    });

    it('refuses an unknown format', () => {
        const r = synthCli('parse', file, '-f', 'xml');
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('json or yaml');
    });
});
