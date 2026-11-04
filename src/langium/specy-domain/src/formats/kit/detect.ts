/**
 * Which language, which encoding. The file name says it when it follows the
 * convention `<name>.<language>[.json|.yaml|.yml|.md]`; otherwise the text
 * itself is asked, cheaply: a `$schema` URL, a front matter, a root keyword.
 */
import type { Format, Language } from './codec.js';

const EXT = /\.(domain|prd|sysreq|arch|architecture|synth)(?:\.(json|ya?ml|md|markdown))?$/i;

export interface Detected {
    language?: Language;
    format?: Format;
}

export function detectFromFileName(fileName: string | undefined): Detected {
    if (!fileName) return {};
    const m = EXT.exec(fileName);
    if (!m) {
        const ext = /\.(json|ya?ml|md|markdown)$/i.exec(fileName);
        return ext ? { format: formatOfExt(ext[1]) } : {};
    }
    return { language: languageOfExt(m[1]), format: m[2] ? formatOfExt(m[2]) : 'dsl' };
}

function languageOfExt(ext: string): Language {
    const e = ext.toLowerCase();
    if (e === 'arch' || e === 'architecture') return 'architecture';
    return e as Language;
}

function formatOfExt(ext: string): Format {
    const e = ext.toLowerCase();
    if (e === 'json') return 'json';
    if (e === 'md' || e === 'markdown') return 'markdown';
    if (e === 'yaml' || e === 'yml') return 'yaml';
    return 'dsl';
}

const SCHEMA_LANG: Record<string, Language> = {
    'domain-model': 'domain',
    prd: 'prd',
    'product-requirements': 'prd',
    sysreq: 'sysreq',
    'system-requirements': 'sysreq',
    architecture: 'architecture',
    'synth-scenario': 'synth',
};

export function languageOfSchemaId(id: string | undefined): Language | undefined {
    if (!id) return undefined;
    const m = /\/schemas\/([a-z-]+)\/\d+\.json$/.exec(id);
    return m ? SCHEMA_LANG[m[1]] : undefined;
}

/** The encoding of a text whose file name said nothing. */
export function detectFormatFromText(text: string): Format {
    const t = text.replace(/^﻿/, '');
    const trimmed = t.trimStart();
    if (trimmed.startsWith('{')) return 'json';
    if (/^---\s*\n[\s\S]*?\n(---|\.\.\.)\s*(\n|$)/.test(trimmed) && /^specy\s*:/m.test(trimmed)) return 'markdown';
    if (/^\s*(\$schema|parser|specy)\s*:/m.test(t) && !/^\s*[a-z-]+\s+[A-Z"]/m.test(t.split('\n')[0] ?? '')) {
        // A YAML document opens with its header keys; a Markdown one with a heading or a front matter.
        if (!/^#{1,6}\s/m.test(t) && !/^\s*\*\*[^*]+\*\*/m.test(t)) return 'yaml';
    }
    if (dslRootKeyword(t)) return 'dsl';
    if (/^#{1,6}\s+\S/m.test(t) || /^\s*\*\*[^*]+:?\*\*/m.test(t) || /^\s*\|.*\|\s*$/m.test(t)) return 'markdown';
    if (/^[A-Za-z_$][\w-]*\s*:\s*(\S|$)/m.test(trimmed)) return 'yaml';
    return 'dsl';
}

const ROOTS: [RegExp, Language][] = [
    [/^\s*product\s+"/m, 'prd'],
    [/^\s*requirements\s+"/m, 'sysreq'],
    [/^\s*scenario\s+[A-Za-z_]/m, 'synth'],
    [/^\s*architecture\s+[A-Z"]/m, 'architecture'],
];

/** The language a DSL text opens with, from its root keyword (comments skipped). */
export function dslRootKeyword(text: string): Language | undefined {
    const body = text.replace(/^\s*(\/\/|#)[^\n]*$/gm, '');
    for (const [re, lang] of ROOTS) if (re.test(body)) return lang;
    if (/^\s*organization\s+[A-Z]/m.test(body)) {
        // Both .domain and .arch open with `organization`: the members tell them apart.
        return /^\s*(system|dependency|area|phase|externalSystem)\b/m.test(body) ? 'architecture' : 'domain';
    }
    if (/^\s*(context|module|entity|aggregate|value|enum|command|query|event|external\s+event|error\s+event|temporal\s+event|domain\s+service|application\s+service|infrastructure\s+service|repository|read-only|api\s+interface|spi\s+interface|reaction|invariant|agreement)\b/m.test(body)) {
        return 'domain';
    }
    return undefined;
}

/** The language a non-DSL document names: `$schema`, or the `specy` front-matter key, or a Markdown root heading. */
export function detectLanguageFromDocument(format: Format, text: string, doc?: Record<string, unknown>, header?: Record<string, string>): Language | undefined {
    if (doc && typeof doc.$schema === 'string') {
        const l = languageOfSchemaId(doc.$schema);
        if (l) return l;
    }
    if (doc && typeof doc.parser === 'object' && doc.parser && typeof (doc.parser as { name?: unknown }).name === 'string') {
        const n = (doc.parser as { name: string }).name;
        if (n === 'specy-domain') return 'domain';
        if (n === 'specy-synth') return 'synth';
        if (n === 'specy-prd') return 'prd';
        if (n === 'specy-sysreq') return 'sysreq';
        if (n === 'specy-architecture') return 'architecture';
    }
    const fm = header?.specy ?? header?.language;
    if (fm) {
        const v = fm.toLowerCase().replace(/^\./, '');
        if (v === 'arch' || v === 'architecture') return 'architecture';
        if (v === 'domain' || v === 'prd' || v === 'sysreq' || v === 'synth') return v;
    }
    if (format === 'markdown') {
        const h = /^#{1,6}\s+([a-z-]+(?:\s+[a-z]+)?)\b/im.exec(text);
        if (h) {
            const w = h[1].toLowerCase();
            if (w.startsWith('product')) return 'prd';
            if (w.startsWith('requirements')) return 'sysreq';
            if (w.startsWith('scenario')) return 'synth';
            if (w.startsWith('architecture')) return 'architecture';
            if (/^(context|module|entity|aggregate|value|enum|command|query|event|read-only)/.test(w)) return 'domain';
        }
    }
    if (doc) {
        if ('products' in doc || 'product' in doc) return 'prd';
        if ('requirementSets' in doc || 'requirements' in doc) return 'sysreq';
        if ('populations' in doc) return 'synth';
        if ('architecture' in doc || ('organization' in doc && 'systems' in ((doc.organization as object) ?? {}))) return 'architecture';
        if ('organizations' in doc || 'contexts' in doc || 'modules' in doc || 'definitions' in doc) return 'domain';
    }
    return undefined;
}
