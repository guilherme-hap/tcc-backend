import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export function credentialsKey(): Buffer {
    const key = Buffer.from(process.env.CREDENTIALS_KEY ?? '', 'base64');
    if (key.length !== KEY_BYTES) {
        throw new Error('CREDENTIALS_KEY environment variable must hold 32 bytes in base64');
    }
    return key;
}

export function encryptCredential(value: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, credentialsKey(), iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
}

export function decryptCredential(stored: string, context: string): string {
    const [iv, tag, data] = stored.split('.').map((part) => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv(ALGORITHM, credentialsKey(), iv);
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
