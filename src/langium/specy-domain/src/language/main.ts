/**
 * Language server entry point for the Specy Domain DSL.
 *
 * Speaks LSP over stdio (or IPC, when a client asks for it), so any editor can
 * drive it: neovim via `vim.lsp.config`, and the VS Code client in
 * src/extension/main.ts, which already points at the built form of this file
 * (out/language/main.js).
 *
 * Run directly:  node out/language/main.js --stdio
 */
import { startLanguageServer } from 'langium/lsp';
import { NodeFileSystem } from 'langium/node';
import { ProposedFeatures, createConnection } from 'vscode-languageserver/node.js';
import { createSpecyDomainLspServices } from './specy-domain-module.js';

// The transport is chosen from argv by vscode-languageserver: --stdio, --node-ipc,
// or --socket. Nothing here needs to care which one the editor picked.
const connection = createConnection(ProposedFeatures.all);

const { shared } = createSpecyDomainLspServices({ connection, ...NodeFileSystem });

startLanguageServer(shared);
