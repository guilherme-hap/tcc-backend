import pg from 'pg';
import { dbConnection } from '../config/database.js';

const LOAD_TEST_LOCK_KEY = 7_204_001;

export async function withLoadTestAdvisoryLock<T>(task: () => Promise<T>): Promise<T> {
    const client = new pg.Client(dbConnection);
    client.on('error', (err: Error) => {
        console.error('[LoadLock] Lock connection error:', err.message);
    });
    await client.connect();

    try {
        await client.query('SELECT pg_advisory_lock($1)', [LOAD_TEST_LOCK_KEY]);
        return await task();
    } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [LOAD_TEST_LOCK_KEY]).catch(() => undefined);
        await client.end().catch(() => undefined);
    }
}
