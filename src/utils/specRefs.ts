function unescapePointerSegment(segment: string): string {
    let decoded = segment;
    try {
        decoded = decodeURIComponent(segment);
    } catch {
    }
    return decoded.replaceAll('~1', '/').replaceAll('~0', '~');
}

export function resolveRef(spec: any, node: any): any {
    const visited = new Set<string>();
    let current = node;

    while (current && typeof current === 'object' && typeof current.$ref === 'string') {
        const ref: string = current.$ref;
        if (!ref.startsWith('#/') || visited.has(ref)) {
            return undefined;
        }
        visited.add(ref);

        current = ref
            .slice(2)
            .split('/')
            .reduce((value, segment) => value?.[unescapePointerSegment(segment)], spec);
    }

    return current;
}
