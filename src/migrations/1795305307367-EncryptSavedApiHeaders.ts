import { MigrationInterface, QueryRunner } from 'typeorm';
import { decryptSettings, encryptSettings, type SavedApiSettings } from '../utils/savedApiSettings.js';

interface SettingsRow {
    id: string;
    user_id: string;
    default_settings: SavedApiSettings;
}

async function rewriteHeaders(
    queryRunner: QueryRunner,
    transform: (settings: SavedApiSettings, userId: string) => SavedApiSettings,
): Promise<void> {
    const rows: SettingsRow[] = await queryRunner.query(
        `SELECT id, user_id, default_settings FROM saved_apis WHERE default_settings->'loadTestOptions'->'headers' IS NOT NULL`,
    );
    for (const row of rows) {
        await queryRunner.query(
            `UPDATE saved_apis SET default_settings = $2 WHERE id = $1`,
            [row.id, JSON.stringify(transform(row.default_settings, row.user_id))],
        );
    }
}

export class EncryptSavedApiHeaders1795305307367 implements MigrationInterface {
    name = 'EncryptSavedApiHeaders1795305307367';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await rewriteHeaders(queryRunner, encryptSettings);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await rewriteHeaders(queryRunner, decryptSettings);
    }
}
