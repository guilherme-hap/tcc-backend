import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginSchema, registerSchema } from '../../src/schemas/auth.schema.js';
import { loadTestOptionsSchema } from '../../src/schemas/loadTestOptions.schema.js';
import { createSavedApiSchema, updateSavedApiSchema } from '../../src/schemas/savedApi.schema.js';
import { credentialsKey, decryptCredential, encryptCredential } from '../../src/utils/credentialCipher.js';
import { decryptSettings, encryptSettings } from '../../src/utils/savedApiSettings.js';

afterEach(() => vi.unstubAllEnvs());

describe('opções do teste de carga', () => {
    const valid = (options: unknown) => loadTestOptionsSchema.safeParse(options).success;

    it('aplica os limites padrão', () => {
        expect(valid({ connections: 50 })).toBe(true);
        expect(valid({ connections: 51 })).toBe(false);
        expect(valid({ duration: 61 })).toBe(false);
    });

    it('amplia os limites com carga elevada', () => {
        expect(valid({ connections: 500, allowHighLoad: true })).toBe(true);
        expect(valid({ connections: 501, allowHighLoad: true })).toBe(false);
    });

    it('exige duração maior que quatro vezes o tempo-alvo', () => {
        expect(valid({ duration: 4, targetLatency: 1000 })).toBe(false);
        expect(valid({ duration: 5, targetLatency: 1000 })).toBe(true);
    });

    it('recusa nome e valor inválidos de cabeçalho', () => {
        expect(valid({ headers: { 'X-Api-Key': 'abc' } })).toBe(true);
        expect(valid({ headers: { 'nome invalido': 'abc' } })).toBe(false);
        expect(valid({ headers: { 'X-Api-Key': 'a\r\nb' } })).toBe(false);
    });

    it('limita as repetições', () => {
        expect(valid({ repetitions: 10 })).toBe(true);
        expect(valid({ repetitions: 11 })).toBe(false);
    });
});

describe('schemas de conta e de API salva', () => {
    it('valida e-mail e tamanho da senha', () => {
        expect(registerSchema.safeParse({ email: 'a@test.local', password: '12345678' }).success).toBe(true);
        expect(registerSchema.safeParse({ email: 'a@test.local', password: '1234567' }).success).toBe(false);
        expect(registerSchema.safeParse({ email: 'invalido', password: '12345678' }).success).toBe(false);
        expect(loginSchema.safeParse({ email: 'a@test.local', password: '' }).success).toBe(false);
    });

    it('exige nome e URL para salvar uma API', () => {
        expect(createSavedApiSchema.safeParse({ name: 'a', openApiUrl: 'https://a.test/o.json' }).success).toBe(true);
        expect(createSavedApiSchema.safeParse({ name: '  ', openApiUrl: 'https://a.test/o.json' }).success).toBe(false);
        expect(createSavedApiSchema.safeParse({ name: 'a', openApiUrl: 'ftp://a.test' }).success).toBe(false);
    });

    it('exige ao menos um campo na edição', () => {
        expect(updateSavedApiSchema.safeParse({}).success).toBe(false);
        expect(updateSavedApiSchema.safeParse({ name: 'b' }).success).toBe(true);
    });
});

describe('cifra de credenciais', () => {
    it('recupera o valor original, inclusive com acentos', () => {
        expect(decryptCredential(encryptCredential('Bearer ação-123', 'ctx'), 'ctx')).toBe('Bearer ação-123');
    });

    it('gera um texto cifrado diferente a cada vez', () => {
        expect(encryptCredential('mesmo', 'ctx')).not.toBe(encryptCredential('mesmo', 'ctx'));
    });

    it('detecta adulteração do valor cifrado', () => {
        const [iv, tag, data] = encryptCredential('segredo', 'ctx').split('.');
        const flipped = Buffer.from(data, 'base64url');
        flipped[0] ^= 1;

        expect(() => decryptCredential([iv, tag, flipped.toString('base64url')].join('.'), 'ctx')).toThrow();
    });

    it('não decifra com outra chave', () => {
        const stored = encryptCredential('segredo', 'ctx');
        vi.stubEnv('CREDENTIALS_KEY', Buffer.alloc(32, 9).toString('base64'));

        expect(() => decryptCredential(stored, 'ctx')).toThrow();
    });

    it('não decifra em outro contexto', () => {
        expect(() => decryptCredential(encryptCredential('segredo', 'ctx'), 'outro')).toThrow();
    });

    it('recusa chave ausente ou de tamanho errado', () => {
        vi.stubEnv('CREDENTIALS_KEY', '');
        expect(() => credentialsKey()).toThrow();
        vi.stubEnv('CREDENTIALS_KEY', Buffer.alloc(16).toString('base64'));
        expect(() => credentialsKey()).toThrow();
    });

    it('cifra só os valores dos cabeçalhos e preserva o resto', () => {
        const settings = { rulesConfig: { a: true }, loadTestOptions: { connections: 3, headers: { Authorization: 'segredo' } } };
        const encrypted = encryptSettings(settings, 'usuario-a');

        expect(encrypted.rulesConfig).toEqual({ a: true });
        expect(encrypted.loadTestOptions?.connections).toBe(3);
        expect(Object.keys(encrypted.loadTestOptions?.headers ?? {})).toEqual(['Authorization']);
        expect(encrypted.loadTestOptions?.headers?.Authorization).not.toBe('segredo');
        expect(decryptSettings(encrypted, 'usuario-a')).toEqual(settings);
    });

    it('vincula o valor ao usuário e ao nome do cabeçalho', () => {
        const encrypted = encryptSettings({ loadTestOptions: { headers: { Authorization: 'segredo' } } }, 'usuario-a');
        const renamed = { loadTestOptions: { headers: { 'X-Outro': encrypted.loadTestOptions!.headers!.Authorization } } };

        expect(() => decryptSettings(encrypted, 'usuario-b')).toThrow();
        expect(() => decryptSettings(renamed, 'usuario-a')).toThrow();
    });

    it('mantém configurações vazias', () => {
        expect(encryptSettings(null, 'usuario-a')).toBeNull();
        expect(encryptSettings(undefined, 'usuario-a')).toBeUndefined();
        expect(encryptSettings({ rulesConfig: { a: false } }, 'usuario-a')).toEqual({ rulesConfig: { a: false } });
    });
});
