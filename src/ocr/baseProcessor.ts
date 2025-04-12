import { IEventEmitter, OcrJobData, OcrProgressPayload, OcrProviderEvent } from "./ocrProvider";


export interface IOcrProcessor {
    readonly id: string;
    processImage(job: OcrJobData): Promise<void>;
    setEventEmitter?(emitter: IEventEmitter<OcrProviderEvent>): void;
    shutdown?(): Promise<void>;
}

export abstract class BaseOcrProcessor implements IOcrProcessor {
    readonly id: string;
    private isDebugging: boolean = false;
    protected emitter: IEventEmitter<OcrProviderEvent> | null = null;
    private jobQueue: OcrJobData[] = [];
    private activeTasks: number = 0;
    private maxConcurrency: number;

    constructor(id: string, maxConcurrency: number = 4, enableDebug: boolean = false) {
        this.id = id;
        this.maxConcurrency = Math.max(1, maxConcurrency);
        this.isDebugging = enableDebug;
    }

    public setEventEmitter(emitter: IEventEmitter<OcrProviderEvent>): void {
        this.emitter = emitter;
        this.debug(`Event emitter set.`);
    }

    async processImage(job: OcrJobData): Promise<void> {
        if (!this.emitter) {
            console.error(`[${this.id}] Cannot queue job for ${job.fileId} - event emitter not configured.`);
            throw new Error(`[${this.id}] Event emitter not configured.`)
        }

        this.debug(`Queuing job for ${job.fileId}`);
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
            this.debug(`Starting task for ${job.fileId}. Active: ${this.activeTasks}/${this.maxConcurrency}`);
            this.emitProgress(job.fileId, 'processing', 0, 'Starting OCR task');

            (async () => {
                try {
                    const extractedText = await this._performOcr(job);
                    this.debug(`Successfully processed ${job.fileId}`);

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
                    this.debug(`Finished task for ${job.fileId}. Active: ${this.activeTasks}/${this.maxConcurrency}`);
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

    public setDebugging(enabled: boolean): void {
        const changed = this.isDebugging !== enabled;
        this.isDebugging = enabled;
        if (changed) {
            this.debug(`Debugging ${enabled ? 'enabled' : 'disabled'}.`);
        }
    }

    protected debug(...args: any[]): void {
        if (this.isDebugging) {
            console.debug(`[${this.id}]`, ...args);
        }
    }

    public async shutdown(): Promise<void> {
        this.debug(`Base shutdown called.`);
    }
}