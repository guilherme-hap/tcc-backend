import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { Express } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';

export interface TestServer {
    url: string;
    close: () => Promise<void>;
}

export async function startApp(mount: (app: Express) => void): Promise<TestServer> {
    const app = express();
    app.use(express.json());
    mount(app);
    app.use(errorHandler);

    const server: Server = await new Promise((resolve) => {
        const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const { port } = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((resolve, reject) => {
            server.closeAllConnections();
            server.close((error) => (error ? reject(error) : resolve()));
        }),
    };
}

export async function send(
    url: string,
    method: string,
    options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
    const response = await fetch(url, {
        method,
        headers: {
            ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
            ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
}
