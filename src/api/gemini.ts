import { request, RequestUrlParam } from "obsidian";

interface GeminiRequest {
    contents: {
        parts: GeminiMessagePart[];
    }[];
}

interface GeminiMessagePart {
    text?: string;
    inline_data?: {
        mime_type: string;
        data: string;
    };
    role?: string;
}

interface GeminiResponse {
    candidates: {
        content: {
            parts: GeminiMessagePart[];
            finishReason: string;
            avgLogprobs: number;
        };
    }[];
    usageMetadata: {
        promptTokenCount: number,
        candidatesTokenCount: number,
        totalTokenCount: number,
        promptTokensDetails: TokensDetails[];
        candidatesTokensDetails: TokensDetails[];
        modelVersion: string;
    }
}

export interface GeminiConfig {
    baseUrl?: string;
    model?: string;
    apiKey: string;
}

interface TokensDetails {
    modality: string;
    tokenCount: number;
}

export class GeminiClient {
    protected baseUrl: string = "https://generativelanguage.googleapis.com/v1beta";
    protected model: string = "gemini-2.0-flash";
    protected apiKey: string;

    constructor(config: GeminiConfig) {
        this.baseUrl = config?.baseUrl ?? this.baseUrl;
        this.model = config?.model ?? this.model;
        this.apiKey = config?.apiKey;
    }

    async generateContentRequest(requestBody: GeminiRequest): Promise<string> {
        try {
            const params = new URLSearchParams([
                ["key", this.apiKey]
            ]);
            const body = JSON.stringify(requestBody);
            const url = this.baseUrl + `/models/${this.model}:generateContent?${params.toString()}`;
            console.log(url);
            const requestParams = {
                url: url,
                headers: {"Content-Type": "application/json"},
                body: body,
                method: 'POST',
                throw: true
            } as RequestUrlParam;

            console.log(body);
            const response = JSON.parse(await request(requestParams)) as GeminiResponse;
            const part = response.candidates[0].content.parts[0];
            return part.text ?? "Model did not return a text response.";
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    /**
     * 
     * @param prompt prompt
     * @param image an array of base64-encoded image
     * @returns the model response
     */
    async imageRequest(prompt: string, images: string[]): Promise<string> {
        const promptMessagePart = { text: prompt } as GeminiMessagePart;
        const requestBody = {
            contents: [{
                parts: [promptMessagePart]
            }]
        } as GeminiRequest;
        images.forEach((img) => {
            const imgMessagePart = { 
                inline_data: {
                    // TODO pass mime type or read the image in this function
                    mime_type: 'image/png',
                    data: img
                }
            } as GeminiMessagePart;
            requestBody.contents[0].parts.push(imgMessagePart);
        });

        return await this.generateContentRequest(requestBody);
    }
}