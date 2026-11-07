export function isPublicDeployment(): boolean {
    return process.env.PUBLIC_DEPLOYMENT === 'true';
}
