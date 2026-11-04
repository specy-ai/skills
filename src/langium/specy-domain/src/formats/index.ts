/**
 * The format layer: every codec registered, and the conversion API.
 *
 * Importing this module is what makes `codecFor(language)` work; the CLI, the
 * browser bundle and the tests import it once.
 */
import { registerCodec } from './kit/codec.js';
import { architectureCodec } from './architecture/codec.js';
import { domainCodec } from './domain/codec.js';
import { prdCodec } from './prd/codec.js';
import { synthCodec } from './synth/codec.js';
import { sysreqCodec } from './sysreq/codec.js';

registerCodec(domainCodec);
registerCodec(synthCodec);
registerCodec(prdCodec);
registerCodec(sysreqCodec);
registerCodec(architectureCodec);

export { convert, detect, read, write, formatDiagnostics, type ConvertRequest, type ConvertResult, type ReadResult } from './convert.js';
export {
    codecFor,
    registeredLanguages,
    normalizeFormat,
    normalizeLanguage,
    LANGUAGES,
    FORMATS,
    type Diagnostic,
    type Format,
    type Language,
    type ModelCodec,
    type ParseContext,
} from './kit/codec.js';
export { detectFromFileName, detectFormatFromText } from './kit/detect.js';
export { domainCodec, synthCodec, prdCodec, sysreqCodec, architectureCodec };
