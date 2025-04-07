import { EventEmitter } from "events";

import { GeminiClient } from "../api/gemini";
import { Worker } from "tesseract.js";

export interface OcrJobData {
    fileId: string;
    imageData: Buffer;
}

export interface IOcrProcessor {
    readonly id: string;
    processImage(job: OcrJobData): Promise<void>;
    setEventEmitter?(emitter: IEventEmitter<OcrProviderEvent>): void;
    shutdown?(): Promise<void>;
}

export interface OcrProgressPayload {
    fileId: string;
    processorId: string;
    status: 'queued' | 'processing' | 'retrying';
    progressPercent?: number;
    message?: string;
};

export interface OcrCompletePayload {
    fileId: string;
    processorId: string;
    extractedText: string;
};

export interface OcrErrorPayload {
    fileId: string;
    processorId: string;
    error: string;
    canRetry?: boolean;
};

export type OcrProviderEvent = 
    | { type: 'ocr-progress'; payload: OcrProgressPayload }
    | { type: 'ocr-complete'; payload: OcrCompletePayload }
    | { type: 'ocr-error'; payload: OcrErrorPayload };

export type OcrCacheChecker = (fileId: string, processorId: string) => boolean;

export interface IEventEmitter<TEvent extends { type: string; payload: unknown }> {
    on<K extends TEvent['type']>(event: K, listener: (payload: Extract<TEvent, { type: K }>['payload']) => void): void;
    emit<K extends TEvent['type']>(event: K, payload: Extract<TEvent, { type: K }>['payload']): void;
};

export interface IOcrProvider {
    readonly emitter: IEventEmitter<OcrProviderEvent>;
    processAttachments(fileId: string, attachments: OcrJobData[]): Promise<void>;
    addProcessor(processor: IOcrProcessor): void;
};

abstract class BaseOcrProcessor implements IOcrProcessor {
    readonly id: string;
    protected emitter: IEventEmitter<OcrProviderEvent> | null = null;
    private jobQueue: OcrJobData[] = [];
    private activeTasks: number = 0;
    private maxConcurrency: number;

    constructor(id: string, maxConcurrency: number = 4) {
        this.id = id;
        this.maxConcurrency = Math.max(1, maxConcurrency);
    }

    public setEventEmitter(emitter: IEventEmitter<OcrProviderEvent>): void {
        this.emitter = emitter;
        console.debug(`[${this.id}] Event emitter set.`);
    }

    async processImage(job: OcrJobData): Promise<void> {
        if (!this.emitter) {
            console.error(`[${this.id}] Cannoy queue job for ${job.fileId} - event emitter not configured.`);
            throw new Error(`[${this.id}] Event emitter not configured.`)
        }

        console.debug(`[${this.id}] Queuing job for ${job.fileId}`);
        this.jobQueue.push(job);

        this.emitProgress(job.fileId, 'queued', undefined, `Queued (${this.jobQueue.length} in queue)`);
        this._tryProcessNext();
    }

    protected abstract _performOcr(job: OcrJobData): Promise<string>;

    private _tryProcessNext(): void {
        if (!this.emitter) {
            console.warn(`[${this.id}] Cannot process queue, emitter not set.`);
            return;
        }

        while (this.activeTasks < this.maxConcurrency && this.jobQueue.length > 0) {
            const job = this.jobQueue.shift();
            if (!job) continue;

            this.activeTasks++;
            console.debug(`[${this.id}] Starting task for ${job.fileId}. Active: ${this.activeTasks}/${this.maxConcurrency}`);
            this.emitProgress(job.fileId, 'processing', 0, 'Starting OCR task');

            (async () => {
                try {
                    const extractedText = await this._performOcr(job);
                    console.debug(`[${this.id}] Successfully processed ${job.fileId}`);

                    this.emitter?.emit('ocr-complete', {
                        fileId: job.fileId,
                        processorId: this.id,
                        extractedText: extractedText ?? ''
                    });
                } catch (error: any) {
                    console.error(`[${this.id}] Error processing ${job.fileId}`, error);
                    this.emitter?.emit('ocr-error', {
                        fileId: job.fileId,
                        processorId: this.id,
                        error: error.message || "OCR processing failed",
                        canRetry: false
                    });
                } finally {
                    this.activeTasks--;
                    console.debug(`[${this.id}] Finished task for ${job.fileId}. Active: ${this.activeTasks}/${this.maxConcurrency}`);
                    this._tryProcessNext();
                }
            })();
        }
    }

    protected emitProgress(fileId: string, status: OcrProgressPayload['status'], progressPercent?: number, message?: string): void {
        if (this.emitter) {
            this.emitter.emit('ocr-progress', {
                fileId,
                processorId: this.id,
                status,
                progressPercent,
                message
            });
        } else {
            console.warn(`[${this.id}] Cannot emit progress for ${fileId}, emitter not initialized.`);
        }
    }

    public async shutdown(): Promise<void> {
        console.debug(`[${this.id}] Base shutdown called.`);
    }
}

export class GeminiOcrProcessor implements IOcrProcessor {
    readonly id: string = 'gemini-ocr';
    private client: GeminiClient;
    private emitter: IEventEmitter<OcrProviderEvent> | null = null;

    constructor(key: string) {
        this.client = new GeminiClient({apiKey: key});
        console.debug(`[${this.id}] Processor initialized (waiting for emitter).`);
    }

    public setEventEmitter(emitter: IEventEmitter<OcrProviderEvent>): void {
        this.emitter = emitter;
        console.debug(`[${this.id}] Event emitter set.`);
    }

    async processImage(job: OcrJobData): Promise<void> {
        if (!this.emitter) {
            console.error(`[${this.id}] Error: Event emitter not set before calling processImage.`);
            throw new Error(`[${this.id}] Event emitter not configured.`);
        }

        const { fileId, imageData } = job;

        this.emitProgress(fileId, 'processing', 0, 'Starting Gemini OCR');

        try {
            const prompt = "Extract all text visible in this image.";
            this.emitProgress(fileId, 'processing', 10, 'Sending request to Gemini');
            const result = await this.client.imageRequest(prompt, [imageData.toString('base64')]);

            if (result === "Model did not return a text response") {
                throw new Error("Gemini API returned no text.");
            }

            this.emitProgress(fileId, 'processing', 100, 'Received response from Gemini');

            this.emitter.emit('ocr-complete', {
                fileId,
                processorId: this.id,
                extractedText: result
            });

            console.debug(`[${this.id}] Sucessfully processed ${fileId}`)
        } catch (error: any) {
            console.error(`[${this.id}] Error processing ${fileId}.`, error);
            this.emitter.emit('ocr-error', {
                fileId,
                processorId: this.id,
                error: error.message,
                canRetry: true
            });
        }
    }

    private emitProgress(fileId: string, status: OcrProgressPayload['status'], progressPercent?: number, message?: string): void {
        this.emitter!.emit('ocr-progress', {
            fileId,
            processorId: this.id,
            status,
            progressPercent,
            message
        });
    }
}

export class TesseractOcrProcessor extends BaseOcrProcessor {
    private worker: Worker;

    constructor(worker: Worker) {
        super('tesseract', 1);
        this.worker = worker;
        console.debug(`[${this.id}] Processor initialized (waiting for emitter).`);
    }

    protected async _performOcr(job: OcrJobData): Promise<string> {
        const { fileId, imageData } = job;
        console.debug(`[${this.id}] Worker starting recognize for ${fileId}`);
        const result = await this.worker.recognize(imageData);
        return result.data.text;
    }

    public async shutdown(): Promise<void> {
        await super.shutdown();
        if (this.worker) {
            console.debug(`[${this.id}] Terminating tesseract worker.`)
            await this.worker.terminate();
        }
    }
}

export class OcrProvider implements IOcrProvider {
    public readonly emitter: IEventEmitter<OcrProviderEvent>;
    private processors: IOcrProcessor[];
    // Shared emitter instance for communication between processors and this provider
    private processorEventEmitter: IEventEmitter<OcrProviderEvent>;
    private cacheChecker: OcrCacheChecker;

    constructor(processors: IOcrProcessor[], cacheChecker: OcrCacheChecker) {
        this.processors = processors;
        this.emitter = new EventEmitter() as IEventEmitter<OcrProviderEvent>;
        this.processorEventEmitter = new EventEmitter() as IEventEmitter<OcrProviderEvent>;
        this.cacheChecker = cacheChecker;

        this.processors.forEach(processor => {
            if (typeof (processor as any).setEventEmitter === 'function') {
                (processor as any).setEventEmitter(this.processorEventEmitter);
            }
        });

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.processorEventEmitter.on('ocr-progress', (payload) => {
            // Relay progress events directly
            this.emitter.emit('ocr-progress', payload);
        });
        this.processorEventEmitter.on('ocr-complete', (payload) => {
            // Relay complete events directly
            this.emitter.emit('ocr-complete', payload);
        });
        this.processorEventEmitter.on('ocr-error', (payload) => {
            // Relay error events directly
            this.emitter.emit('ocr-error', payload);
        });
    }

    async processAttachments(parentNoteFileId: string, attachments: OcrJobData[]): Promise<void> {
        console.debug(`[OcrProvider] Starting processing for ${attachments.length} attachments for note '${parentNoteFileId}'.`);
        
        const allProcessingPromises: Promise<void>[] = [];

        for (const attachmentJob of attachments) {
            console.debug(`[OcrProvider] Processing attachment: ${attachmentJob.fileId}`);
            for (const processor of this.processors) {
                if (this.cacheChecker(attachmentJob.fileId, processor.id)) {
                    console.log(`[OcrProvider] Skipping ${processor.id} for ${attachmentJob.fileId} due to cache hit.`)
                    continue;
                }
                // Emit queued status before actual processing
                this.processorEventEmitter.emit('ocr-progress', {
                    fileId: attachmentJob.fileId,
                    processorId: processor.id,
                    status: 'queued',
                    message: `Queued for ${processor.id}`
                });
                /*
                await processor.processImage(attachmentJob)
                    .catch(err => {
                        console.error(`[OcrProvider] Error starting ${processor.id} for ${attachmentJob.fileId}:`, err);
                        this.processorEventEmitter.emit('ocr-error', {
                            fileId: attachmentJob.fileId,
                            processorId: processor.id,
                            error: `Failed to initiate processing: ${err.message}`,
                            canRetry: false
                        });
                    });*/
                allProcessingPromises.push(
                    processor.processImage(attachmentJob)
                        .catch(err => {
                            console.error(`[OcrProvider] Error starting ${processor.id} for ${attachmentJob.fileId}:`, err);
                            this.processorEventEmitter.emit('ocr-error', {
                                fileId: attachmentJob.fileId,
                                processorId: processor.id,
                                error: `Failed to initiate processing: ${err.message}`,
                                canRetry: false
                            });
                        })
                );
                console.log(`queued ${allProcessingPromises.length}`)
            }
        }
        // await Promise.allSettled(allProcessingPromises);

        console.debug(`[OcrProvider] Finished initiating all jobs for note ${parentNoteFileId}. Waiting for results via events.`);
    }

    public addProcessor(processor: IOcrProcessor): void {
        this.processors.push(processor);
        if (typeof (processor as any).setEventEmitter === 'function') {
            (processor as any).setEventEmitter(this.processorEventEmitter);
        }
    }
}