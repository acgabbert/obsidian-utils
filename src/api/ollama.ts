import { request, RequestUrlParam } from "obsidian";

export { 
    OllamaClient,
    OllamaChatCompletionRequest,
    OllamaGenerationRequest,
    OllamaChatCompletionResponse,
    OllamaGenerationResponse
}

interface OllamaBaseRequest {
    model: string;
    stream?: boolean;
    keep_alive?: string;
}

interface OllamaGenerationRequest extends OllamaBaseRequest {
    prompt: string;
    images?: string[];
    suffix?: string;
}

interface OllamaChatCompletionRequest extends OllamaBaseRequest {
    messages: OllamaMessage[];
}

interface OllamaBaseResponse {
    model: string;
    created_at: string;
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

interface OllamaGenerationResponse extends OllamaBaseResponse {
    response: string;
}

interface OllamaChatCompletionResponse extends OllamaBaseResponse {
    message: OllamaMessage;
}

interface OllamaMessage {
    role: 'assistant' | 'user' | 'system' | 'tool';
    content: string;
    images?: string[];
}

interface OllamaConfig {
    baseUrl?: string;
    model?: string;
    stream?: boolean;
    systemMessage?: string;
}

/**
 * An Ollama API client leveraging Obsidian's built-in request function.
 */
class OllamaClient {
    protected baseUrl: string;
    protected model: string;
    private stream: boolean = false;
    private messageHistory!: OllamaMessage[];
    private systemMessage?: OllamaMessage;

    constructor(config: OllamaConfig) {
        this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
        // this.stream = config.stream ?? false;
        this.model = config.model ?? '';
        if (config.systemMessage) {
            this.systemMessage = {
                role: 'system',
                content: config.systemMessage
            }
        }
    }

    /**
     * Send a user role message to the assistant.
     * @param content the contents of the message
     * @returns an OllamaChatCompletionResponse object
     */
    async chat(content: string, images?: string[]): Promise<OllamaChatCompletionResponse> {
        const userMessage: OllamaMessage = {
            role: 'user',
            content: content
        }

        if (images && images.length > 0) {
            userMessage.images = images;
        }

        return this.conversationRequest();
    }

    /**
     * 
     * @param prompt prompt
     * @param images an array of base64-encoded images
     * @returns an OllamaGenerationResponse object
     */
    async generate(prompt: string, suffix?: string): Promise<OllamaGenerationResponse> {
        const requestBody: OllamaGenerationRequest = {
            model: this.model,
            prompt: prompt,
            suffix: suffix
        }

        return await this.generationRequest(requestBody);
    }

    /**
     * 
     * @param prompt prompt
     * @param images an array of base64-encoded images
     * @returns an OllamaGenerationResponse object
     */
    async generateWithImages(prompt: string, images: string[]): Promise<OllamaGenerationResponse> {
        const requestBody: OllamaGenerationRequest = {
            model: this.model,
            prompt: prompt,
            images: images
        }

        return await this.generationRequest(requestBody);
    }
    
    /**
     * Make a conversation request with the current message history.
     * @returns an OllamaChatCompletionResponse object
     */
    private async conversationRequest(): Promise<OllamaChatCompletionResponse> {
        const requestBody: OllamaChatCompletionRequest = {
            messages: this.messageHistory,
            model: this.model
        }

        try {
            const body = JSON.stringify(requestBody);
            const params = {
                url: this.baseUrl + '/api/chat',
                throw: true,
                body: body,
                method: 'POST'
            } as RequestUrlParam;
            const response = JSON.parse(await request(params)) as OllamaChatCompletionResponse;
            this.messageHistory.push(response.message);
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    /**
     * Make a generation request with the provided prompt and optional images.
     * @returns an OllamaChatCompletionResponse object
     */
    private async generationRequest(requestBody: OllamaGenerationRequest): Promise<OllamaGenerationResponse> {
        try {
            const body = JSON.stringify(requestBody);
            const params = {
                url: this.baseUrl + '/api/generate',
                throw: true,
                body: body,
                method: 'POST'
            } as RequestUrlParam;
            const response = JSON.parse(await request(params)) as OllamaGenerationResponse;
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
}