import { App, Plugin, TFile } from "obsidian";
import { OllamaClient } from "../api/ollama"
import { ParsedIndicators } from "../searchSites";
import { ParallelOcrProvider } from "./provider"
import { encodeImageFile, readImageFile } from "./utils";

export class OllamaOcrProvider extends ParallelOcrProvider {
    private client: OllamaClient;
    private initialized: boolean = false;

    /**
     * Creates a new OllamaOcrProvider
     * @param client an OllamaClient
     * @param matchExtractor a function that extracts indicators from text
     * @param maxConcurrent maximum number of concurrent OCR operations
     */
    constructor(
        client: OllamaClient,
        matchExtractor: (text: string) => Promise<ParsedIndicators[]>,
        maxConcurrent: number = 4
    ) {
        const ollamaOcrProcessor = async(app: App, file: TFile, signal: AbortSignal): Promise<string> => {
            if (signal.aborted) {
                throw new Error('Operation cancelled');
            }

            const buffer = await encodeImageFile(app, file);
            if (!buffer) {
                throw new Error(`Failed to read file: ${file.path}`);
            }

            // Set up a listener for the abort event
            const abortPromise = new Promise<never>((_, reject) => {
                const abortHandler = () => {
                    reject(new Error('Operation cancelled'));
                };
                signal.addEventListener('abort', abortHandler, { once: true });
                setTimeout(() => signal.removeEventListener('abort', abortHandler), 0);
            });

            // Race the actual operation against a potential abort signal
            return Promise.race([
                client.generateWithImages(
                    "Extract all text from the image. Respond with only the extracted text.",
                    [buffer]    
                ).then(response => response.response || ""),
                abortPromise
            ])
        }

        super(ollamaOcrProcessor, matchExtractor, maxConcurrent);

        this.client = client;
        this.initialized = true;
    }
}