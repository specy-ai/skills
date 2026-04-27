import * as vscode from 'vscode';
import * as path from 'node:path';
import { LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind } from 'vscode-languageclient/node.js';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext): void {
    client = startLanguageClient(context);
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

function startLanguageClient(context: vscode.ExtensionContext): LanguageClient {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.js'));

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'specy-domain' }],
    };

    const client = new LanguageClient(
        'specy-domain',
        'Specy Domain',
        serverOptions,
        clientOptions,
    );

    client.start();
    return client;
}
