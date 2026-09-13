export function findMatchingSpecPath(targetPath: string, spec: any): string | undefined {
    if (!spec?.paths) return undefined;

    if (spec.paths[targetPath]) return targetPath;

    const targetSegments = targetPath.split('/').filter(Boolean);

    if (targetSegments.length === 0) {
        return undefined;
    }

    let bestMatch: string | undefined;

    for (const specPathKey of Object.keys(spec.paths)) {
        const specSegments = specPathKey.split('/').filter(Boolean);

        if (specSegments.length < targetSegments.length) continue;

        const offset = specSegments.length - targetSegments.length;
        const isSuffixMatch = targetSegments.every((seg, i) => {
            const specSeg = specSegments[offset + i];

            if (seg === specSeg) return true;

            return seg.startsWith('{') && specSeg.startsWith('{');
        });

        if (isSuffixMatch) {
            if (!bestMatch || specSegments.length < bestMatch.split('/').filter(Boolean).length) {
                bestMatch = specPathKey;
            }
        }
    }

    return bestMatch;
}
