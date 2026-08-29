import { SpectralResponseDto, SpectralSeverity } from '../dtos/SpectralResponseDto.js';

export const SEVERITY_PENALTY: Record<SpectralSeverity, number> = {
    'Error': 10,
    'Warning': 4,
    'Info': 1,
    'Hint': 0.5,
    'Unknown': 0,
};

export function calculateContractScore(issues: SpectralResponseDto[]): number {
    const totalPenalty = issues.reduce((sum, issue) => {
        return sum + (SEVERITY_PENALTY[issue.severity] ?? 0);
    }, 0);
    return Math.max(0, Math.min(100, 100 - totalPenalty));
}
