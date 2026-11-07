import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import stream from 'node:stream';
import { isPublicDeployment } from '../config/publicDeployment.js';
import { AppError } from '../errors/AppError.js';

const BLOCKED_RANGES = new net.BlockList();
BLOCKED_RANGES.addSubnet('0.0.0.0', 8, 'ipv4');
BLOCKED_RANGES.addSubnet('10.0.0.0', 8, 'ipv4');
BLOCKED_RANGES.addSubnet('100.64.0.0', 10, 'ipv4');
BLOCKED_RANGES.addSubnet('127.0.0.0', 8, 'ipv4');
BLOCKED_RANGES.addSubnet('169.254.0.0', 16, 'ipv4');
BLOCKED_RANGES.addSubnet('172.16.0.0', 12, 'ipv4');
BLOCKED_RANGES.addSubnet('192.0.0.0', 24, 'ipv4');
BLOCKED_RANGES.addSubnet('192.168.0.0', 16, 'ipv4');
BLOCKED_RANGES.addSubnet('198.18.0.0', 15, 'ipv4');
BLOCKED_RANGES.addSubnet('224.0.0.0', 3, 'ipv4');
BLOCKED_RANGES.addSubnet('::', 127, 'ipv6');
BLOCKED_RANGES.addSubnet('64:ff9b::', 96, 'ipv6');
BLOCKED_RANGES.addSubnet('2002::', 16, 'ipv6');
BLOCKED_RANGES.addSubnet('fc00::', 7, 'ipv6');
BLOCKED_RANGES.addSubnet('fe80::', 10, 'ipv6');
BLOCKED_RANGES.addSubnet('ff00::', 8, 'ipv6');

function bareHost(host: string): string {
    return host.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
}

function unmapIPv4(address: string): string {
    const mapped = /^::ffff:(.+)$/.exec(address)?.[1];
    if (!mapped) return address;
    if (net.isIPv4(mapped)) return mapped;
    const words = mapped.split(':').map((word) => parseInt(word, 16));
    if (words.length !== 2 || words.some((word) => Number.isNaN(word))) return address;
    return [words[0] >> 8, words[0] & 255, words[1] >> 8, words[1] & 255].join('.');
}

export function isBlockedAddress(address: string): boolean {
    const bare = unmapIPv4(bareHost(address));
    const family = net.isIPv4(bare) ? 'ipv4' : net.isIPv6(bare) ? 'ipv6' : null;
    return family !== null && BLOCKED_RANGES.check(bare, family);
}

function blockedTarget(host: string): AppError {
    return new AppError('TARGET_NOT_ALLOWED', { host });
}

export function blockedTargetOf(error: unknown): AppError | null {
    for (let current: unknown = error; current instanceof Error; current = current.cause) {
        if (current instanceof AppError && current.code === 'TARGET_NOT_ALLOWED') return current;
    }
    return null;
}

const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, []);
        if (addresses.some(({ address }) => isBlockedAddress(address))) return callback(blockedTarget(hostname), []);
        if (options.all) return callback(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
    });
};

function refusedSocket(host: string): stream.Duplex {
    const socket = new net.Socket();
    process.nextTick(() => socket.destroy(blockedTarget(host)));
    return socket;
}

function literalBlocked(host: string | null | undefined): string | null {
    const bare = bareHost(host ?? '');
    return net.isIP(bare) && isBlockedAddress(bare) ? bare : null;
}

class GuardedHttpAgent extends http.Agent {
    createConnection(options: http.ClientRequestArgs, callback?: (err: Error | null, stream: stream.Duplex) => void) {
        const blocked = literalBlocked(options.host);
        return blocked ? refusedSocket(blocked) : super.createConnection(options, callback);
    }
}

class GuardedHttpsAgent extends https.Agent {
    createConnection(options: http.ClientRequestArgs, callback?: (err: Error | null, stream: stream.Duplex) => void) {
        const blocked = literalBlocked(options.host);
        return blocked ? refusedSocket(blocked) : super.createConnection(options, callback);
    }
}

let agents: { httpAgent: http.Agent; httpsAgent: https.Agent } | undefined;

export function outboundAgents(): { httpAgent?: http.Agent; httpsAgent?: https.Agent } {
    if (!isPublicDeployment()) return {};
    agents ??= {
        httpAgent: new GuardedHttpAgent({ lookup: guardedLookup }),
        httpsAgent: new GuardedHttpsAgent({ lookup: guardedLookup }),
    };
    return agents;
}

export function outboundLookup(): net.LookupFunction | undefined {
    return isPublicDeployment() ? guardedLookup : undefined;
}

export async function assertPublicTarget(url: string): Promise<void> {
    if (!isPublicDeployment()) return;

    let host: string;
    try {
        host = bareHost(new URL(url).hostname);
    } catch {
        return;
    }

    if (net.isIP(host)) {
        if (isBlockedAddress(host)) throw blockedTarget(host);
        return;
    }

    let addresses: dns.LookupAddress[];
    try {
        addresses = await dns.promises.lookup(host, { all: true });
    } catch {
        return;
    }
    if (addresses.some(({ address }) => isBlockedAddress(address))) throw blockedTarget(host);
}
