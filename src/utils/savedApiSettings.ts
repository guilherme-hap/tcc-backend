import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';
import { decryptCredential, encryptCredential } from './credentialCipher.js';

export interface SavedApiSettings {
    rulesConfig?: Record<string, boolean>;
    loadTestOptions?: LoadTestOptionsInput;
}

function headerContext(userId: string, name: string): string {
    return JSON.stringify([userId, name]);
}

function mapHeaderValues<T extends SavedApiSettings | null | undefined>(
    settings: T,
    transform: (value: string, name: string) => string,
): T {
    const headers = settings?.loadTestOptions?.headers;
    if (!settings || !headers) return settings;

    return {
        ...settings,
        loadTestOptions: {
            ...settings.loadTestOptions,
            headers: Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, transform(value, name)])),
        },
    };
}

export function encryptSettings<T extends SavedApiSettings | null | undefined>(settings: T, userId: string): T {
    return mapHeaderValues(settings, (value, name) => encryptCredential(value, headerContext(userId, name)));
}

export function decryptSettings<T extends SavedApiSettings | null | undefined>(settings: T, userId: string): T {
    return mapHeaderValues(settings, (value, name) => decryptCredential(value, headerContext(userId, name)));
}
