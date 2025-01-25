import { request, RequestUrlParam } from "obsidian";

export { OpenAICompatibleClient }

type Role = 'system' | 'user' | 'assistant' | 'developer' | 'tool';

interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string,
        arguments: string;
    }
}

interface Tool {
    type: 'function';
    function: {
        name: string,
        description?: string,
        parameters: {
            type: "object",
            properties: Record<string, unknown>
        },
        required?: Array<string>;
    }
}

interface ChatCompletionRequest {
    model?: string;
    messages: Array<{
        role: Role;
        content?: string;
    }>;
    tools?: Array<Tool>;
}

interface ChatCompletionResponse {
    id: string,
    object: string,
    created: number,
    model: string,
    choices: Array<{
        index: number,
        message: {
            role: Role,
            content?: string;
            tool_calls?: Array<ToolCall>;
        }
    }>;
}

class OpenAICompatibleClient {
    baseURL: string;
    apiKey: string;
    headers: Record<string, string>;

    constructor(
        baseURL: string = 'https://api.openai.com/v1',
        apiKey?: string,
        defaultHeaders: Record<string, string> = {}
    ) {
        this.baseURL = baseURL;
        this.apiKey = apiKey ?? '';
        this.headers = {
            'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
            'Content-Type': 'application/json',
            ...defaultHeaders
        };
    }

    async chat(requestBody: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        try {
            const body = JSON.stringify(requestBody);
            const params = {
                url: this.baseURL + '/chat/completions',
                headers: this.headers,
                throw: true,
                body: body,
                method: 'POST'
            } as RequestUrlParam;
            const response = JSON.parse(await request(params)) as ChatCompletionResponse;
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
}