/**
 * Version of the parser and of the clean JSON it emits. Bumped whenever the
 * shape of `specy-domain parse` output changes in a way consumers must know
 * about (1.1.0: `kind` discriminators on ambiguous expression and clause nodes,
 * and this header). Consumers such as synthy pin the minimum they accept.
 */
export const PARSER_VERSION = '1.1.0';
