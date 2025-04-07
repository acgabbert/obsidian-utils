import { GeminiClient } from "../api/gemini";
import { BaseOcrProcessor } from "./baseProcessor";
import { IEventEmitter, OcrJobData, OcrProviderEvent } from "./ocrProvider";


export class GeminiOcrProcessor extends BaseOcrProcessor {
    private client: GeminiClient;

    constructor(key: string, enableDebug: boolean = false) {
        super('gemini-ocr', 4, enableDebug);
        this.client = new GeminiClient({apiKey: key});
        this.debug(`Processor initialized (waiting for emitter).`);
    }

    protected async _performOcr(job: OcrJobData): Promise<string> {
        const { fileId, imageData } = job;
        try {
            const prompt = "Extract all text visible in this image.";
            const result = await this.client.imageRequest(prompt, [imageData.toString('base64')]);
            return result;
        } catch (error) {
            console.error(`Error processing ${fileId}:`, error);
            return "";
        }
    }
}