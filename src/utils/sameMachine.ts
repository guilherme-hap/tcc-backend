import dns from 'node:dns/promises';
import os from 'node:os';
import type { SharedMachineStatus } from '../interfaces/evaluation.interface.js';

export type LookupAll = (hostname: string) => Promise<{ address: string }[]>;
export type ListInterfaces = () => NodeJS.Dict<os.NetworkInterfaceInfo[]>;

const IPV4_MAPPED_PREFIX = '::ffff:';

function normalizeAddress(address: string): string {
    const withoutZone = address.split('%')[0].toLowerCase();
    return withoutZone.startsWith(IPV4_MAPPED_PREFIX) ? withoutZone.slice(IPV4_MAPPED_PREFIX.length) : withoutZone;
}

function isLoopback(address: string): boolean {
    return address.startsWith('127.') || address === '::1' || address === '0.0.0.0' || address === '::';
}

export async function detectSharedMachine(
    hostname: string,
    lookupAll: LookupAll = (host) => dns.lookup(host, { all: true }),
    listInterfaces: ListInterfaces = os.networkInterfaces,
): Promise<SharedMachineStatus> {
    let resolved: { address: string }[];
    try {
        resolved = await lookupAll(hostname.replace(/^\[|\]$/g, ''));
    } catch {
        return 'unverified';
    }
    if (resolved.length === 0) return 'unverified';

    const local = new Set(
        Object.values(listInterfaces())
            .flatMap((entries) => entries ?? [])
            .map((entry) => normalizeAddress(entry.address)),
    );

    return resolved.some(({ address }) => {
        const normalized = normalizeAddress(address);
        return isLoopback(normalized) || local.has(normalized);
    }) ? 'shared' : 'separate';
}
