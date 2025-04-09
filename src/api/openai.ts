import { request, RequestUrlParam } from "obsidian";

export { OpenAICompatibleClient, ObsidianLLMTool, Role, ToolCall, Message, Tool, FunctionConfig, ChatCompletionRequest, ChatCompletionResponse, OpenAiClientConfig };

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

interface ObsidianLLMTool {
    toolConfig: Tool;
    implementation: (args: any) => Promise<string>;
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
    tools?: ObsidianLLMTool[];
    toolCallLimit?: number;
    isDebugging?: boolean;
}


/**
 * An OpenAI-compatible API client leveraging Obsidian's built-in request function.
 */
class OpenAICompatibleClient {
    protected baseURL: string;
    protected defaultEndpoint: string = "/chat/completions";
    protected name: string = "OpenAI-Compatible Client";
    protected isDebugging: boolean = false;
    protected apiKey: string;
    protected headers: Record<string, string>;
    protected model: string;
    protected messageHistory!: Message[];
    protected systemMessage?: Message;
    protected tools?: ObsidianLLMTool[];
    protected toolCallLimit: number;

    constructor(config: OpenAiClientConfig) {
        this.baseURL = config.baseUrl ?? 'https://api.openai.com/v1';
        this.apiKey = config.apiKey ?? '';
        this.model = config.model ?? '';
        this.isDebugging = config.isDebugging || false;
        this.toolCallLimit = config.toolCallLimit ?? 5;
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
    async chat(content: string, model?: string): Promise<ChatCompletionResponse> {
        const userMessage: Message = {
            role: 'user',
            content: content
        }

        this.messageHistory.push(userMessage);
        
        let response = await this.conversationRequest(model);
        let toolCallCount = 0;

        while (
            response.choices[0].message.tool_calls &&
            response.choices[0].message.tool_calls.length > 0 &&
            toolCallCount < this.toolCallLimit
        ) {
            toolCallCount++;
            const toolCalls = response.choices[0].message.tool_calls;

            for (const toolCall of toolCalls) {
                const toolResult = await this.executeToolCall(toolCall);
                this.messageHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                });
            }

            response = await this.conversationRequest(model);
        }

        return response;
    }


    /**
     * Make a conversation request with the current message history.
     * @returns a ChatCompletionResponse object
     */
    protected async conversationRequest(model?: string): Promise<ChatCompletionResponse> {
        model = model ?? this.model;
        const requestBody: ChatCompletionRequest = {
            messages: this.messageHistory,
            model: model,
            tools: this.tools?.map(tool => tool.toolConfig)
        }

        try {
            const body = JSON.stringify(requestBody);
            const params = {
                url: this.baseURL + this.defaultEndpoint,
                headers: this.headers,
                throw: true,
                body: body,
                method: 'POST'
            } as RequestUrlParam;
            const response = JSON.parse(await request(params)) as ChatCompletionResponse;
            this.debug(`Received ${response.choices.length} messages:`);
            this.debug(response);
            response.choices.forEach((message) => this.messageHistory.push(message.message));
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    /**
     * Execute a tool call.
     * @param toolCall 
     */
    protected async executeToolCall(toolCall: ToolCall): Promise<string> {
        const functionName = toolCall.function.name;
        const toolFunction = this.tools?.find(tool => tool.toolConfig.function.name === functionName)?.implementation;
        if (!toolFunction) {
            const message = `No tool exists with name ${functionName}.`;
            console.error(message);
            return message;
        }

        let argsObject: any = {};

        try {
            argsObject = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            console.error("Failed to parse tool arguments:", e);
            return "Error: Failed to parse tool arguments."
        }

        this.debug(`Executing ${functionName} with args: ${argsObject}`);
        
        try {
            return await toolFunction(argsObject) ?? "Tool returned no results.";
        } catch (e) {
            console.error(`Error executing tool ${functionName}`, e);
            return `Error executing tool ${functionName}.`;
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
     * @param func a ObsidianTool object
     */
    addTool(tool: ObsidianLLMTool) {
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

    /**
     * Get the list of tools.
     * @returns the list of tools.
     */
    getTools(): ObsidianLLMTool[] | undefined {
        return this.tools;
    }

    /**
     * Set API key.
     * @param key API key string
     */
    setApiKey(key: string): void {
        this.apiKey = key;
        this.headers.Authorization = this.apiKey ? `Bearer ${this.apiKey}` : '';
    }

    /**
     * Set default model.
     * @param model model selection
     */
    setModel(model: string): void {
        this.model = model;
    }

    /**
     * Log a debug message if configured.
     * @param message the message to be logged
     */
    debug(message: any): void {
        if (this.isDebugging) {
            console.debug(`[${this.name}] ${message}`);
        }
    }
}