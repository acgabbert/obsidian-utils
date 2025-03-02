import { App, TFile } from "obsidian";
import { createWorker, type Worker } from "tesseract.js";
import { ParsedIndicators } from "./searchSites";
import { OllamaClient } from "./api/ollama";

export { EmptyOcrProvider, encodeImageFile, initializeWorker, ocr, ocrMultiple, OcrProvider, readImageFile, TesseractOcrProvider };

interface OcrQueueItem {
    image: Buffer;
    resolve: (value: string | PromiseLike<string>) => void;
    reject: (reason?: any) => void;
}

class OcrQueue {
    worker: Worker;
    queue: OcrQueueItem[];
    processing: boolean;
    processingLock: Promise<void> | null;

    constructor(worker: Worker) {
        this.worker = worker;
        this.queue = [];
        this.processing = false;
        this.processingLock = null;
    }

    async addToQueue(image: Buffer) {
        return new Promise((resolve, reject) => {
            this.queue.push({image, resolve, reject});
            if (!this.processing) {this.processQueue();}
        });
    }

    async processQueue() {
        if (this.processing) {
            return;
        }
        this.processing = true;

        while (this.queue.length > 0) {
            const queueItem = this.queue[0];
            if (!queueItem) continue;
            const { image, resolve, reject } = queueItem;
    
            try {
                const { data: { text } } = await this.worker.recognize(image);
                resolve(text);
                this.queue.shift();
            } catch (error) {
                reject(error);
                this.queue.shift();
            }
        }        
        this.processing = false;
    }    
}

async function readImageFile(app: App, file: TFile | null): Promise<Buffer | null> {
    if (!file) return null;
    const arrBuff = await app.vault.readBinary(file);
    const buffer = Buffer.from(arrBuff);
    return buffer;
}

async function encodeImageFile(app: App, file: TFile | null): Promise<string | null> {
    if (!file) return null;
    return Buffer.from((await app.vault.readBinary(file))).toString('base64');
}

async function ocr(app: App, file: TFile | null, worker: Worker | null): Promise<string | null> {
    if (!worker) {
        console.error('OCR worker is not initialized')
        return null;
    }

    const buffer = await readImageFile(app, file);
    if (!buffer) return null;
    const ret = await worker.recognize(buffer);
    return ret.data.text;
}

async function initializeWorker(): Promise<Worker> {
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    return worker;
}

async function ocrMultiple(app: App, files: TFile[] | string[] | null, worker: Worker | null): Promise<Map<string, string> | null> {
    const resultsMap: Map<string, string> = new Map();
    if (!worker) {
        console.error('No worker to complete OCR.')
        return null;
    }
    if (!files) {
        console.error('No files passed to OCR function');
        return null;
    }

    const ocrQueue = new OcrQueue(worker);
    //const results: Array<string> = [];
    for (let file of files) {
        if (typeof file === "string") {
            resultsMap.set(file, "");
            const fileObj = app.vault.getFileByPath(file);
            if (fileObj) file = fileObj;
            else {console.error(`couldn't find file ${file}`); continue};
        } else {
            resultsMap.set(file.path, "");
        }
        const arrBuff = await readImageFile(app, file);
        if (!arrBuff) {
            console.error(`failed to convert ${file.path} to buffer for OCR`)
            continue;
        }
        const buffer = Buffer.from(arrBuff);
        try {
            const text = await ocrQueue.addToQueue(buffer);
            resultsMap.set(file.path, text as string);
        } catch(error) {
            let message = (error instanceof Error ? error.message : String(error))
            console.error(message);
            resultsMap.set(file.path, message);
        }
    }
    return resultsMap;
}

/**
 * Interface for OCR providers that process files and extract indicators
 */
interface OcrProvider {
    /**
     * Process a list of files and extract indicators from each
     * @param app the Obsidian app isntance
     * @param filePaths Array of file paths to process
     * @returns Promis that resovles to a map of filePath to extracted indicators
     */
    processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>>;

    /**
     * Check if the provider is ready to process files
     * @returns boolean indicating if the provider is ready
     */
    isReady(): boolean;
}

class EmptyOcrProvider implements OcrProvider {
    processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>> {
        return Promise.resolve(new Map());
    }

    isReady(): boolean {
        return false;
    }
}

/**
 * OCR provider implementation using Tesseract.js
 */
class TesseractOcrProvider implements OcrProvider {
    private worker: Worker | null;
    private matchExtractor: (text: string) => Promise<ParsedIndicators[]>;

    /**
     * Creates a new TesseractOcrProvider
     * @param worker a Tesseract.js worker
     * @param matchExtractor a function that extracts matches from OCR text
     */
    constructor(
        worker: Worker | null,
        matchExtractor: (text: string) => Promise<ParsedIndicators[]>
    ) {
        this.worker = worker;
        this.matchExtractor = matchExtractor;
    }

    /**
     * Process a list of files and extract indicators from each
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to process
     * @returns promise that resolves to a Map of filePath to extracted indicators
     */
    async processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>> {
        const resultsMap = new Map<string, ParsedIndicators[]>();

        if (!this.isReady() || filePaths.length === 0) {
            return resultsMap;
        }

        try {
            const ocrResults = await ocrMultiple(app, filePaths, this.worker);
            if (!ocrResults) return resultsMap;
            
            for (const [filename, ocrText] of ocrResults?.entries()) {
                const indicators = await this.matchExtractor(ocrText);
                resultsMap.set(filename, indicators);
            }
        } catch (e) {
            console.error("Error during OCR processing:", e)
        }
        return resultsMap;
    }

    /**
     * Check if the provider is ready to process files
     * @returns boolean indicating if the provider is ready
     */
    isReady(): boolean {
        return this.worker !== null;
    }

    /**
     * Update the Tesseract worker
     * @param worker the new Tesseract worker
     */
    updateWorker(worker: Worker): void {
        if (this.worker) this.worker.terminate();
        this.worker = worker;
    }
}

class OllamaOcrProvider implements OcrProvider {
    private client: OllamaClient;
    app: App;
    private matchExtractor: (text: string) => Promise<ParsedIndicators[]>;
    private ocrPrompt: string;

    /**
     * Creates a new OllamaOcrProvider
     * @param worker a Tesseract.js worker
     * @param matchExtractor a function that extracts matches from OCR text
     */
    constructor(
        app: App,
        client: OllamaClient,
        matchExtractor: (text: string) => Promise<ParsedIndicators[]>
    ) {
        this.app = app;
        this.client = client;
        this.matchExtractor = matchExtractor;
        this.ocrPrompt = "Extract all text from the image. Respond with only the extracted text."
    }

    /**
     * Process a list of files and extract indicators from each
     * @param app the Obsidian app instance
     * @param files Array of TFile objects to process
     * @returns promise that resolves to a Map of filePath to extracted indicators
     */
    async processFiles(files: TFile[]): Promise<Map<string, ParsedIndicators[]>> {
        const resultsMap = new Map<string, ParsedIndicators[]>();

        if (!this.isReady() || files.length === 0) {
            return resultsMap;
        }

        try {
            const ocrResults = await ocrMultiple(this.app, filePaths, this.worker);
            if (!ocrResults) return resultsMap;
            
            for (const [filename, ocrText] of ocrResults?.entries()) {
                const indicators = await this.matchExtractor(ocrText);
                resultsMap.set(filename, indicators);
            }
        } catch (e) {
            console.error("Error during OCR processing:", e)
        }
        return resultsMap;
    }

    /**
     * Check if the provider is ready to process files
     * @returns boolean indicating if the provider is ready
     */
    isReady(): boolean {
        return this.client !== null;
    }

    /**
     * Return extracted text from an image file.
     * @param file a TFile object
     * @returns the extracted text
     */
    async ocrImage(file: TFile): Promise<string> {
        const encoded = await encodeImageFile(this.app, file);
        if (!encoded) return "";
        const message = await this.client.generateWithImages(this.ocrPrompt, [encoded]);
        return message.response;
    }

    /**
     * Return a map of 
     */
    async ocrMultiple(files: TFile[]): Promise<Map<string, string> | null> {
        const resultsMap: Map<string, string> = new Map();
        if (!this.isReady()) return resultsMap;

        for (let file of files)

        return resultsMap;
    }

    /**
     * Set the OCR prompt.
     * @param prompt prompt to be used for OCR
     */
    setOcrPrompt(prompt: string): void {
        this.ocrPrompt = prompt;
    }
}