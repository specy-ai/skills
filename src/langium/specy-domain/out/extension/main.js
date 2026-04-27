import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';
let client;
export function activate(context) {
    client = startLanguageClient(context);
}
export function deactivate() {
    if (client) {
        return client.stop();
    }
    return undefined;
}
function startLanguageClient(context) {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.js'));
    const serverOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc },
    };
    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'specy-domain' }],
    };
    const client = new LanguageClient('specy-domain', 'Specy Domain', serverOptions, clientOptions);
    client.start();
    return client;
}
//# sourceMappingURL=main.js.map