export function jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret?.trim()) {
        throw new Error('JWT_SECRET environment variable is not configured');
    }
    return secret;
}
