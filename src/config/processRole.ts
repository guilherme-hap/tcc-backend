export type ProcessRole = 'api' | 'load-worker';

let current: ProcessRole = 'api';

export function setProcessRole(role: ProcessRole): void {
    current = role;
}

export function processRole(): ProcessRole {
    return current;
}

export function loadWorkerMode(): 'embedded' | 'external' {
    return process.env.LOAD_WORKER_MODE === 'external' ? 'external' : 'embedded';
}
