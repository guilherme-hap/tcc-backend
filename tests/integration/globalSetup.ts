import 'dotenv/config';
import pg from 'pg';

const TEST_DATABASE = 'specping_test';

async function adminQuery(sql: string): Promise<void> {
    const client = new pg.Client({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: 'postgres',
    });
    await client.connect();
    try {
        await client.query(sql);
    } finally {
        await client.end();
    }
}

export async function setup(): Promise<() => Promise<void>> {
    await adminQuery(`DROP DATABASE IF EXISTS "${TEST_DATABASE}" WITH (FORCE)`);
    await adminQuery(`CREATE DATABASE "${TEST_DATABASE}"`);

    return async () => {
        await adminQuery(`DROP DATABASE IF EXISTS "${TEST_DATABASE}" WITH (FORCE)`);
    };
}
