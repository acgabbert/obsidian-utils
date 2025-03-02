import { App, Plugin, TFile } from "obsidian";
import { createWorker, type Worker } from "tesseract.js";
import { ParsedIndicators } from "../searchSites";
import { OcrProvider, ParallelOcrProvider } from "./provider";
import { OcrTask, ProgressCallback } from "./tasks";
import { readImageFile } from "./utils";

/**
 * Updated Tesseract OCR provider that supports the new provider interface
 */
export class TesseractOcrProvider implements OcrProvider {
    private plugin: Plugin;
    private worker: Worker | null;
    private delegateProvider: ParallelOcrProvider | null = null;
    
    /**
     * Creates a new TesseractOcrProvider
     * @param worker a Tesseract.js worker
     * @param matchExtractor a function that extracts matches from OCR text
     */
    constructor(
        plugin: Plugin,
        worker: Worker | null,
        matchExtractor: (text: string) => Promise<ParsedIndicators[]>
    ) {
        this.plugin = plugin;
        this.worker = worker;
        
        if (worker) {
            // Create a Tesseract OCR processor
            const tesseractProcessor = async (app: App, file: TFile, signal: AbortSignal): Promise<string> => {
                if (signal.aborted) {
                    throw new Error('Operation cancelled');
                }
                
                const buffer = await readImageFile(app, file);
                if (!buffer) {
                    throw new Error(`Failed to read file: ${file.path}`);
                }
                
                const result = await this.worker!.recognize(buffer);
                return result.data.text;
            };
            
            // Create delegate provider with max concurrency of 1 (single worker)
            this.delegateProvider = new ParallelOcrProvider(
                tesseractProcessor,
                matchExtractor,
                1
            );
        }
    }

    /**
     * Process files and extract indicators
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to process
     * @returns Promise that resolves to a map of filePath to extracted indicators
     */
    async processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>> {
        if (!this.isReady() || !this.delegateProvider) {
            return new Map();
        }
        
        return this.delegateProvider.processFiles(app, filePaths);
    }

    /**
     * Add files to the processing queue
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to add
     */
    addFiles(app: App, filePaths: string[]): void {
        if (this.delegateProvider) {
            this.delegateProvider.addFiles(app, filePaths);
        }
    }

    /**
     * Cancel all ongoing OCR operations
     */
    cancel(): void {
        if (this.delegateProvider) {
            this.delegateProvider.cancel();
        }
    }

    /**
     * Set a callback for progress reporting
     * @param callback Function to call with progress updates
     */
    setProgressCallback(callback: ProgressCallback): void {
        if (this.delegateProvider) {
            this.delegateProvider.setProgressCallback(callback);
        }
    }

    /**
     * Check if provider is ready to process files
     * @returns boolean indicating if the provider is ready
     */
    isReady(): boolean {
        return this.worker !== null;
    }

    /**
     * Get the current status of all tasks
     * @returns Map of task IDs to task objects
     */
    getTasksStatus(): Map<string, OcrTask> {
        if (this.delegateProvider) {
            return this.delegateProvider.getTasksStatus();
        }
        return new Map();
    }

    /**
     * Update the Tesseract worker
     * @param worker the new Tesseract worker
     */
    updateWorker(worker: Worker): void {
        if (this.worker) {
            this.worker.terminate();
        }
        
        this.worker = worker;
        
        // Recreate the delegate provider with the new worker
        if (worker && this.delegateProvider) {
            const matchExtractor = (this.delegateProvider as any).matchExtractor;
            
            const tesseractProcessor = async (app: App, file: TFile, signal: AbortSignal): Promise<string> => {
                if (signal.aborted) {
                    throw new Error('Operation cancelled');
                }
                
                const buffer = await readImageFile(app, file);
                if (!buffer) {
                    throw new Error(`Failed to read file: ${file.path}`);
                }
                
                const result = await this.worker!.recognize(buffer);
                return result.data.text;
            };
            
            this.delegateProvider = new ParallelOcrProvider(
                tesseractProcessor,
                matchExtractor,
                1
            );
        }
    }
}