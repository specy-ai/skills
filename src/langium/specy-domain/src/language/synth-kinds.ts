/**
 * The kinds of value a vocabulary binding may name (`Iban as iban`), what each
 * applies to, and the lengths synthy's generator for it can produce. One table
 * for the validator (SYN-E024) and the editor's completion; synthy's registry of
 * typed generators is the other side of it and must list the same names.
 *
 *   text        a text field (string), or a value type with exactly one text field
 *   number      a numeric field (int, integer, long, decimal), or a value type with exactly one
 *   money       a numeric field, or a value type with exactly one numeric field (the amount)
 *               and at most one text field (the currency)
 *
 * `length` is the [min, max] number of characters the generator produces; a field
 * whose minLength/maxLength excludes the whole range cannot hold any of them.
 * `text` has none: it only turns name-based inference off.
 */
export type KindTarget = 'text' | 'number' | 'money';

export interface SynthKind {
    readonly name: string;
    readonly applies: KindTarget;
    readonly length?: { readonly min: number; readonly max: number };
}

export const SYNTH_KINDS: readonly SynthKind[] = [
    { name: 'email', applies: 'text', length: { min: 14, max: 64 } },
    { name: 'phone', applies: 'text', length: { min: 10, max: 20 } },
    { name: 'url', applies: 'text', length: { min: 20, max: 80 } },
    { name: 'slug', applies: 'text', length: { min: 3, max: 48 } },
    { name: 'postcode', applies: 'text', length: { min: 3, max: 10 } },
    { name: 'iban', applies: 'text', length: { min: 16, max: 27 } },
    { name: 'bic', applies: 'text', length: { min: 8, max: 11 } },
    { name: 'siren', applies: 'text', length: { min: 9, max: 9 } },
    { name: 'siret', applies: 'text', length: { min: 14, max: 14 } },
    { name: 'vat', applies: 'text', length: { min: 11, max: 14 } },
    { name: 'isbn', applies: 'text', length: { min: 13, max: 13 } },
    { name: 'ean', applies: 'text', length: { min: 13, max: 13 } },
    { name: 'card', applies: 'text', length: { min: 15, max: 16 } },
    { name: 'color', applies: 'text', length: { min: 7, max: 7 } },
    { name: 'ip', applies: 'text', length: { min: 9, max: 15 } },
    { name: 'plate', applies: 'text', length: { min: 7, max: 10 } },
    { name: 'text', applies: 'text' },
    { name: 'percentage', applies: 'number' },
    { name: 'money', applies: 'money' },
];

export const SYNTH_KIND_NAMES: readonly string[] = SYNTH_KINDS.map(k => k.name);

export function synthKind(name: string | undefined): SynthKind | undefined {
    return name === undefined ? undefined : SYNTH_KINDS.find(k => k.name === name);
}
