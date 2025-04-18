import { request, RequestUrlParam } from "obsidian";

export { OpenAICompatibleClient, Role, ToolCall, Message, Tool, FunctionConfig, ChatCompletionRequest, ChatCompletionResponse, OpenAiClientConfig };

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
    tool_call_id?: string;
    tool_calls?: ToolCall[];
}

interface Tool {
    type: 'function';
    function: FunctionConfig
}

interface FunctionConfig {
    name: string,
    description?: string,
    parameters: {
        type: "object",
        properties: Record<string, unknown>
    },
    required?: Array<string>;
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


/**
 * An OpenAI-compatible API client leveraging Obsidian's built-in request function.
 */
class OpenAICompatibleClient {
    protected baseURL: string;
    protected apiKey: string;
    protected headers: Record<string, string>;
    protected model: string;
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


    /**
     * Send a user role message to the assistant.
     * @param content the contents of the message
     * @returns a ChatCompletionResponse object
     */
    async chat(content: string): Promise<ChatCompletionResponse> {
        const userMessage: Message = {
            role: 'user',
            content: content
        }

        this.messageHistory.push(userMessage);
        
        return this.conversationRequest();
    }


    /**
     * Make a conversation request with the current message history.
     * @returns a ChatCompletionResponse object
     */
    private async conversationRequest(): Promise<ChatCompletionResponse> {
        const requestBody: ChatCompletionRequest = {
            messages: this.messageHistory,
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
            response.choices.forEach((message) => this.messageHistory.push(message.message));
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }


    /**
     * Clear the current chat history.
     */
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

    
    /**
     * Get the current chat history.
     * @returns an array of messages
     */
    getHistory(): Message[] {
        return [...this.messageHistory];
    }


    /**
     * Set the system message prompt
     * @param message the system message prompt
     */
    setSystemPrompt(message: string): void {
        this.systemMessage = {
            role: 'system',
            content: message
        };
    }

    
    /**
     * Set the client base URL
     * @param url an OpenAI-compatible API base URL
     */
    setBaseUrl(url: string) {
        this.baseURL = url.endsWith("/") ? url.slice(0, -1) : url;
    }


    /**
     * Add an HTTP header to be sent with requests
     * @param key header key
     * @param value header value
     */
    addHeader(key: string, value: string): void {
        this.headers[key] = value;
    }


    /**
     * Remove an HTTP header
     * @param key header key to be removed
     */
    removeHeader(key: string): void {
        delete this.headers[key];
    }

    
    /**
     * Add a tool to the client
     * @param func a FunctionConfig object
     */
    addTool(func: FunctionConfig) {
        let tool: Tool = {type: 'function', function: func};
        if (!this.tools) this.tools = [tool];
        else this.tools.push(tool);
    }


    /**
     * Provide the assistant with a tool response
     * @param id a tool_call_id
     * @param content the contents of the tool response
     * @returns a ChatCompletionRequest object
     */
    async toolResponse(id: string, content: string): Promise<ChatCompletionResponse> {
        this.messageHistory.push({
            role: 'tool',
            tool_call_id: id,
            content: content
        });
        return this.conversationRequest();
    }
}