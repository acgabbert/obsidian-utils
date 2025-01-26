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

interface Message {
    role: Role;
    content?: string;
    tool_calls?: ToolCall[];
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
    messages: Array<Message>;
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

interface OpenAiClientConfig {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    headers?: Record<string, string>;
    systemMessage?: string;
    tools?: Tool[];
}

class OpenAICompatibleClient {
    baseURL: string;
    apiKey: string;
    headers: Record<string, string>;
    model: string;
    private messageHistory!: Message[];
    private systemMessage?: Message;
    private tools?: Tool[];

    constructor(config: OpenAiClientConfig) {
        this.baseURL = config.baseUrl ?? 'https://api.openai.com/v1';
        this.apiKey = config.apiKey ?? '';
        this.model = config.model ?? '';
        this.tools = config.tools;
        this.headers = {
            'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
            'Content-Type': 'application/json',
            ...config.headers
        };
        if (config.systemMessage) {
            this.systemMessage = {
                role: 'system',
                content: config.systemMessage
            };
        }
        this.tools = config.tools;
        this.clearHistory();
    }

    async chat(content: string): Promise<ChatCompletionResponse> {
        const userMessage: Message = {
            role: 'user',
            content: content
        }

        this.messageHistory.push(userMessage);

        const messages: Message[] = [];

        if (this.systemMessage) {
            messages.push(this.systemMessage);
        }

        messages.push(...this.messageHistory.slice(0, -1));

        messages.push(userMessage);

        const requestBody: ChatCompletionRequest = {
            messages: messages,
            model: this.model,
            tools: this.tools
        }

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

    clearHistory(): void {
        if (this.systemMessage) {
            this.messageHistory = [{
                role: 'system',
                content: this.systemMessage.content
            }];
        } else {
            this.messageHistory = [];
        }
    }

    getHistory(): Message[] {
        return [...this.messageHistory];
    }

    setSystemPrompt(message: string): void {
        this.systemMessage = {
            role: 'system',
            content: message
        };
    }

    setBaseUrl(url: string) {
        this.baseURL = url;
    }

    addHeader(key: string, value: string): void {
        this.headers[key] = value;
    }

    removeHeader(key: string): void {
        delete this.headers[key];
    }
}