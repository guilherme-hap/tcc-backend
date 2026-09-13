import axios from 'axios';

export async function fetchOpenApiSpec(openApiUrl: string): Promise<any> {
    const response = await axios.get(openApiUrl);
    const data = response.data;
    return typeof data === 'string' ? JSON.parse(data) : data;
}
