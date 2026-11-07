import swagger2 from '@stoplight/spectral-rulesets/dist/oas/schemas/oas/v2.0.json' with { type: 'json' };

interface SchemaDefinition {
    [keyword: string]: unknown;
    required?: string[];
    properties?: Record<string, { [keyword: string]: unknown; enum?: unknown[] }>;
    oneOf?: { [keyword: string]: unknown; $ref?: string }[];
}

export interface ValidatorMessage {
    property: string | null;
    message: string;
}

export interface DeclaredFormatSplit {
    in: string;
    messages: string[];
    others: string[];
}

const definitions: Record<string, SchemaDefinition> = swagger2.definitions;
const REQUIRED = /must have required property "([^"]+)"/;
const UNEXPECTED = /^Property "([^"]+)" is not expected to be here/;
const ALLOWED_VALUES = 'must be equal to one of the allowed values: ';

function collectChains(name: string, parents: SchemaDefinition[], chains: Map<string, SchemaDefinition[]>) {
    const definition = definitions[name];
    if (!definition) return chains;
    const chain = [...parents, definition];
    const declared = definition.properties?.in?.enum;
    if (declared?.length === 1) return chains.set(String(declared[0]), chain);
    for (const branch of definition.oneOf ?? []) {
        if (branch.$ref) collectChains(branch.$ref.replace('#/definitions/', ''), chain, chains);
    }
    return chains;
}

const CHAINS = collectChains('parameter', [], new Map());

function defines(chain: SchemaDefinition[], property: string): boolean {
    return chain.some((definition) => definition.properties !== undefined && Object.hasOwn(definition.properties, property));
}

function enumOf(schema: { [keyword: string]: unknown; enum?: unknown[] } | undefined): unknown[] | undefined {
    if (schema?.enum) return schema.enum;
    const ref = typeof schema?.$ref === 'string' ? definitions[schema.$ref.replace('#/definitions/', '')] : undefined;
    return Array.isArray(ref?.enum) ? ref.enum : undefined;
}

function belongsTo(chain: SchemaDefinition[], { property, message }: ValidatorMessage): boolean {
    const required = REQUIRED.exec(message);
    if (required && property === null) return chain.some((definition) => definition.required?.includes(required[1]));

    const unexpected = UNEXPECTED.exec(message);
    if (unexpected) return !defines(chain.slice(-1), unexpected[1]);

    if (property === null) return true;
    if (!defines(chain, property)) return false;
    if (!message.includes(ALLOWED_VALUES)) return true;

    const allowed = chain.map((definition) => enumOf(definition.properties?.[property])).filter((values) => values !== undefined).at(-1);
    return allowed !== undefined && message.includes(`${ALLOWED_VALUES}${allowed.map((value) => JSON.stringify(value)).join(', ')}.`);
}

export function splitByDeclaredFormat(parameter: unknown, messages: ValidatorMessage[]): DeclaredFormatSplit | null {
    const declared = typeof parameter === 'object' && parameter !== null ? (parameter as { in?: unknown }).in : undefined;
    const chain = typeof declared === 'string' ? CHAINS.get(declared) : undefined;
    if (!chain) return null;

    const own = messages.filter((message) => belongsTo(chain, message));
    if (own.length === 0) return null;

    return {
        in: declared as string,
        messages: own.map(({ message }) => message),
        others: messages.filter((message) => !own.includes(message)).map(({ message }) => message),
    };
}
