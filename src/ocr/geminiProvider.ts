import { App, TFile } from "obsidian";
import { ParsedIndicators } from "../searchSites";
import { ParallelOcrProvider } from "./provider"
import { encodeImageFile } from "./utils";
import { GeminiClient } from "../api/gemini";

export class GeminiOcrProvider extends ParallelOcrProvider {
    private client: GeminiClient;
    private initialized: boolean = false;

    /**
     * Creates a new OllamaOcrProvider
     * @param client an OllamaClient
     * @param matchExtractor a function that extracts indicators from text
     * @param maxConcurrent maximum number of concurrent OCR operations
     */
    constructor(
        client: GeminiClient,
        matchExtractor: (text: string) => Promise<ParsedIndicators[]>,
        maxConcurrent: number = 4
    ) {
        const geminiOcrProcessor = async(app: App, file: TFile, signal: AbortSignal): Promise<string> => {
            if (signal.aborted) {
                throw new Error('Operation cancelled');
            }

            const buffer = await encodeImageFile(app, file);
            if (!buffer) {
                throw new Error(`Failed to read file: ${file.path}`);
            }

            console.log(`analyzing ${file.path} with gemini`)

            // Set up a listener for the abort event
            const abortPromise = new Promise<never>((_, reject) => {
                const abortHandler = () => {
                    reject(new Error('Operation cancelled'));
                };
                signal.addEventListener('abort', abortHandler, { once: true });
                return () => signal.removeEventListener('abort', abortHandler);
            });

            // Race the actual operation against a potential abort signal
            return Promise.race([
                client.imageRequest(
                    "Extract all text from the image. Respond with only the extracted text.",
                    [buffer]    
                ).then(response => {console.log(file.path, response); return response || ""}),
                abortPromise
            ])
        }

        super(geminiOcrProcessor, matchExtractor, maxConcurrent);

        this.client = client;
        this.initialized = true;
    }
}