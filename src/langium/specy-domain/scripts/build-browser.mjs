// Bundles src/browser.ts for the browser: an IIFE (window.SpecyDomainLangium)
// for pages without a build step, such as the Specy app, and an ESM file.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'out/browser');
mkdirSync(out, { recursive: true });

const common = {
    entryPoints: [resolve(root, 'src/browser.ts')],
    bundle: true,
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'info',
};

await build({ ...common, format: 'iife', globalName: 'SpecyDomainLangium', outfile: resolve(out, 'specy-domain-langium.js') });
await build({ ...common, format: 'esm', outfile: resolve(out, 'specy-domain-langium.mjs') });
