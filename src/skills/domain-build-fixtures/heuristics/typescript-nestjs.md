# Fixtures heuristic — TypeScript / NestJS

## Destination and export

```
synthy export <out> --to files --format json --dest test/fixtures/synthy
```

JSON tables (one array per table, one row per line), `load.sql`, `questions.json`, `manifest.json`,
`certificate.json`, `traceability.json`.

## Dependencies (dev)

```
npm install -D @duckdb/node-api@1.5.6-r.2
```

The test runner is the project's: vitest or jest (NestJS projects use jest by default).

## Certificate harness

One test per hard question. Verified on the orders example: 111 tests, all passing; vitest 5,
`@duckdb/node-api` 1.5.6-r.2, Node 20+.

```ts
/**
 * The synthy certificate as tests: every hard question of questions.json, re-asked of
 * the fixture files with DuckDB. Re-export the fixtures (synthy export) rather than editing them.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';

const FIXTURES = resolve(__dirname, 'fixtures/synthy');

interface Question { id: string; tier: 'hard' | 'advisory' | 'plausibility'; description: string; sql: string; expected: number | string | boolean }
const questions: Question[] = JSON.parse(readFileSync(resolve(FIXTURES, 'questions.json'), 'utf8'));

/** synthy's comparison: numbers within 1e-9, booleans and text by value. */
function same(observed: unknown, expected: Question['expected']): boolean {
    if (observed === null || observed === undefined) return false;
    if (typeof expected === 'number') return Math.abs(Number(observed) - expected) < 1e-9;
    return String(observed) === String(expected);
}

describe('synthy certificate', () => {
    let db: DuckDBConnection;
    beforeAll(async () => {
        db = await (await DuckDBInstance.create(':memory:')).connect();
        await db.run(`SET file_search_path = '${FIXTURES.replace(/'/g, "''")}'`);
        // load.sql: one statement per line, comments start with --
        for (const line of readFileSync(resolve(FIXTURES, 'load.sql'), 'utf8').split('\n')) if (line.trim() && !line.startsWith('--')) await db.run(line);
    });
    afterAll(() => db?.closeSync());

    for (const q of questions.filter(q => q.tier === 'hard')) {
        it(`${q.id} ${q.description}`, async () => {
            const rows = await (await db.run(q.sql)).getRows();
            const observed = rows[0]?.[0];
            expect(same(typeof observed === 'bigint' ? Number(observed) : observed, q.expected), `expected ${String(q.expected)}, observed ${String(observed)}\n${q.sql}`).toBe(true);
        });
    }
});
```

- In an ES module test file use `import.meta.dirname` instead of `__dirname`.
- Jest: replace the vitest import with jest's globals, give the `beforeAll` a timeout
  (`beforeAll(async () => {…}, 30_000)`), and keep `@duckdb/node-api` out of `transformIgnorePatterns`
  problems by running jest with `ts-jest` or `@swc/jest` as the project already does.
- When synthy itself is a dev dependency, a single test can delegate instead:
  `expect((await verifyDirectory(FIXTURES)).certificate.passed).toBe(true)` with
  `import { verifyDirectory } from 'specy-synthy/node'`. The DuckDB harness above needs no synthy at
  test time and reports each question separately; prefer it.

## Loaders

```ts
const rows = <T>(table: string): T[] => JSON.parse(readFileSync(resolve(FIXTURES, `${table}.json`), 'utf8'));
const orderRows = rows<OrderRow>('Order');   // a JSON import works too, but NodeNext needs `with { type: 'json' }`

const instant = (s: string | null) => (s === null ? undefined : new Date(`${s.replace(' ', 'T')}Z`));   // UTC, no zone in the file

export function loadOrders(): Order[] {
    return orderRows.map(r =>
        Order.rehydrate({                                                 // whatever domain-build-code generated
            id: OrderId.of(r.id),
            totalAmount: Money.of(r.totalAmount_amount, r.totalAmount_currency),
            status: r.status as OrderStatus,
            customerId: CustomerId.of(r.customer_id),
            placedAt: instant(r.placedAt),
        }),
    );
}
```

- Decimals are JSON numbers (at most six decimals); build money value objects from them as the
  domain does (cents, `Decimal`, `big.js`).
- Dates and datetimes are strings in UTC (`2025-02-21 21:18:39`); convert at the boundary.
- `manifest.json` gives each column's `path`, `role` and `target`; use it rather than guessing
  from names.

## Refused commands

A sketch: names depend on the generated code.

```ts
const rejections: Rejection[] = JSON.parse(readFileSync(resolve(FIXTURES, 'synthy_rejections.json'), 'utf8'));
const transitions: Transition[] = JSON.parse(readFileSync(resolve(FIXTURES, 'synthy_transitions.json'), 'utf8'));

/** The state a row stood in at an instant: its last transition at or before it. */
const stateAt = (entity: string, id: string, at: string) =>
    transitions.filter(t => t.entity === entity && t.entity_id === id && t.at <= at).at(-1)?.to_state;

describe('refused commands are refused', () => {
    for (const r of rejections.filter(r => r.about === 'Order')) {
        it(`${r.command} on ${r.about_id} in ${r.state}: ${r.reason}`, () => {
            const order = orderIn(r.about_id, r.state);                              // rehydrated in that state
            const payment = paymentOf(r.about_id, stateAt('Payment', paymentIdOf(r.about_id), r.at));
            expect(() => order.confirm(new ConfirmOrder(order.id), payment)).toThrow(r.reason ?? undefined);
        });
    }
});
```

Timestamps in the files sort as text, so `t.at <= at` compares instants.

## Regeneration

```json
"scripts": {
  "fixtures:regen": "synthy generate specy/scenario.synth --out .synthy-out && synthy export .synthy-out --to files --format json --dest test/fixtures/synthy"
}
```

Replace `synthy` with the command you resolved, or write a small script that reads `$SYNTHY_CLI`
first. Ignore `.synthy-out/` in git.
