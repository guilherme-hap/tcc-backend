export type SpectralSeverity = 'Error' | 'Warning' | 'Info' | 'Hint' | 'Unknown';

export interface ISpectralItemResponse {
    endpoint: string;
    method: string;
    rule: string | number;
    message: string;
    severity: SpectralSeverity;
}

export class SpectralResponseDto {
    endpoint: string;
    method: string;
    rule: string | number;
    message: string;
    severity: SpectralSeverity;

    constructor(data: ISpectralItemResponse) {
        this.endpoint = data.endpoint;
        this.method = data.method;
        this.rule = data.rule;
        this.message = data.message;
        this.severity = data.severity;
    }

    private static severityMap: Record<number, SpectralSeverity> = {
        0: 'Error',
        1: 'Warning',
        2: 'Info',
        3: 'Hint'
    };

    public static fromRawResult(result: any): SpectralResponseDto {
        let endpoint = 'global';
        let method = 'N/A';

        if (result.path && Array.isArray(result.path) && result.path.length >= 2 && result.path[0] === 'paths') {
            endpoint = String(result.path[1]);
            if (result.path.length >= 3) {
                method = String(result.path[2]).toUpperCase();
            }
        }

        return new SpectralResponseDto({
            endpoint,
            method,
            rule: result.code,
            message: result.message,
            severity: this.severityMap[result.severity] || 'Unknown'
        });
    }

    public static formatSpectralResults(rawResults: any[]): SpectralResponseDto[] {
        if (!Array.isArray(rawResults)) {
            return [];
        }
        return rawResults.map(result => this.fromRawResult(result));
    }

    public static fromRawResults(rawResults: any[]): SpectralResponseDto[] {
        return this.formatSpectralResults(rawResults);
    }
}
