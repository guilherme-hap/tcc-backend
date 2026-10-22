import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';

export type LookupAll = (hostname: string) => Promise<{ address: string }[]>;
export type ListInterfaces = () => NodeJS.Dict<os.NetworkInterfaceInfo[]>;
export type DetectContainer = () => Promise<boolean>;

export type SharedMachineCheck =
    | { status: 'shared' | 'separate' }
    | { status: 'unverified'; cause: 'unresolved' }
    | { status: 'unverified'; cause: 'container-network'; address: string };

const IPV4_MAPPED_PREFIX = '::ffff:';
const HOST_ALIASES = new Set(['host.docker.internal', 'gateway.docker.internal', 'host.containers.internal']);
const CONTAINER_MARKERS = ['/.dockerenv', '/run/.containerenv'];

const PRIVATE_RANGES = new net.BlockList();
PRIVATE_RANGES.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE_RANGES.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE_RANGES.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE_RANGES.addSubnet('fc00::', 7, 'ipv6');

function normalizeAddress(address: string): string {
    const withoutZone = address.split('%')[0].toLowerCase();
    return withoutZone.startsWith(IPV4_MAPPED_PREFIX) ? withoutZone.slice(IPV4_MAPPED_PREFIX.length) : withoutZone;
}

function isLoopback(address: string): boolean {
    return address.startsWith('127.') || address === '::1' || address === '0.0.0.0' || address === '::';
}

function isPrivate(address: string): boolean {
    const family = net.isIPv6(address) ? 'ipv6' : net.isIPv4(address) ? 'ipv4' : null;
    return family !== null && PRIVATE_RANGES.check(address, family);
}

let inContainer: Promise<boolean> | undefined;

export function detectContainer(): Promise<boolean> {
    inContainer ??= Promise.all(CONTAINER_MARKERS.map((path) => fs.access(path).then(() => true, () => false)))
        .then((markers) => markers.some(Boolean));
    return inContainer;
}

export async function detectSharedMachine(
    hostname: string,
    lookupAll: LookupAll = (host) => dns.lookup(host, { all: true }),
    listInterfaces: ListInterfaces = os.networkInterfaces,
    container: DetectContainer = detectContainer,
): Promise<SharedMachineCheck> {
    const bareHostname = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (HOST_ALIASES.has(bareHostname)) return { status: 'shared' };

    let resolved: { address: string }[];
    try {
        resolved = await lookupAll(bareHostname);
    } catch {
        return { status: 'unverified', cause: 'unresolved' };
    }
    if (resolved.length === 0) return { status: 'unverified', cause: 'unresolved' };

    const local = new Set(
        Object.values(listInterfaces())
            .flatMap((entries) => entries ?? [])
            .map((entry) => normalizeAddress(entry.address)),
    );
    const addresses = resolved.map(({ address }) => normalizeAddress(address));
    if (addresses.some((address) => isLoopback(address) || local.has(address))) return { status: 'shared' };

    const privateAddress = (await container()) ? addresses.find(isPrivate) : undefined;
    return privateAddress === undefined
        ? { status: 'separate' }
        : { status: 'unverified', cause: 'container-network', address: privateAddress };
}
