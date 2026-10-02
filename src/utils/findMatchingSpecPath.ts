export function findMatchingSpecPath(targetPath: string, spec: any): string | undefined {
    if (!spec?.paths) return undefined;

    if (spec.paths[targetPath]) return targetPath;

    const targetSegments = targetPath.split('/').filter(Boolean);

    if (targetSegments.length === 0) {
        return undefined;
    }

    let bestMatch: { path: string; length: number; templated: number } | undefined;

    for (const specPathKey of Object.keys(spec.paths)) {
        const specSegments = specPathKey.split('/').filter(Boolean);

        if (specSegments.length < targetSegments.length) continue;

        const offset = specSegments.length - targetSegments.length;
        let templated = 0;
        const isSuffixMatch = targetSegments.every((seg, i) => {
            const specSeg = specSegments[offset + i];

            if (seg === specSeg) return true;
            if (!specSeg.startsWith('{')) return false;

            templated++;
            return true;
        });

        if (!isSuffixMatch) continue;

        const isBetter = !bestMatch
            || specSegments.length < bestMatch.length
            || (specSegments.length === bestMatch.length && templated < bestMatch.templated);

        if (isBetter) {
            bestMatch = { path: specPathKey, length: specSegments.length, templated };
        }
    }

    return bestMatch?.path;
}
