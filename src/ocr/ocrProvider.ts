import { EventEmitter } from "events";

import { IOcrProcessor } from "./baseProcessor";

export interface OcrJobData {
    fileId: string;
    imageData: Buffer;
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
    setDebugging(enabled: boolean): void;
};

export class OcrProvider implements IOcrProvider {
    public readonly emitter: IEventEmitter<OcrProviderEvent>;
    private activeJobs: Set<string> = new Set();
    private isDebugging: boolean = false;
    private processors: IOcrProcessor[];
    // Shared emitter instance for communication between processors and this provider
    private processorEventEmitter: IEventEmitter<OcrProviderEvent>;
    private cacheChecker: OcrCacheChecker;

    constructor(processors: IOcrProcessor[], cacheChecker: OcrCacheChecker, enableDebug: boolean = false) {
        this.processors = processors;
        this.isDebugging = enableDebug;
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
            const jobId = this.getJobId(payload.fileId, payload.processorId);
            this.activeJobs.delete(jobId); // remove on completion
            this.debug(`Completed ${jobId}. Active jobs: ${this.activeJobs.size}`);
            this.emitter.emit('ocr-complete', payload);
        });
        this.processorEventEmitter.on('ocr-error', (payload) => {
            const jobId = this.getJobId(payload.fileId, payload.processorId);
            this.activeJobs.delete(jobId);
            this.debug(`Errored ${jobId}. Active jobs: ${this.activeJobs.size}`);
            this.emitter.emit('ocr-error', payload);
        });
    }

    async processAttachments(parentNoteFileId: string, attachments: OcrJobData[]): Promise<void> {
        this.debug(`Starting processing for ${attachments.length} attachments for note '${parentNoteFileId}'.`);
        
        const allProcessingPromises: Promise<void>[] = [];

        for (const attachmentJob of attachments) {
            this.debug(`Processing attachment: ${attachmentJob.fileId}`);
            for (const processor of this.processors) {
                const jobId = this.getJobId(attachmentJob.fileId, processor.id);
                if (this.cacheChecker(attachmentJob.fileId, processor.id)) {
                    this.debug(`Skipping ${jobId} due to cache hit.`)
                    continue;
                }
                if (this.activeJobs.has(jobId)) {
                    this.debug(`Skipping ${jobId} - already active/queued.`)
                    continue;
                }
                this.activeJobs.add(jobId);
                this.debug(`Queuing ${jobId}. Active jobs: ${this.activeJobs.size}`);
                // Emit queued status before actual processing
                this.processorEventEmitter.emit('ocr-progress', {
                    fileId: attachmentJob.fileId,
                    processorId: processor.id,
                    status: 'queued',
                    message: `Queued for ${processor.id}`
                });
                
                allProcessingPromises.push(
                    processor.processImage(attachmentJob)
                        .catch(err => {
                            console.error(`Error starting ${processor.id} for ${attachmentJob.fileId}:`, err);
                            this.processorEventEmitter.emit('ocr-error', {
                                fileId: attachmentJob.fileId,
                                processorId: processor.id,
                                error: `Failed to initiate processing: ${err.message}`,
                                canRetry: false
                            });
                        })
                );
                this.debug(`queued ${allProcessingPromises.length}`)
            }
        }
        if (this.activeJobs.size > 0) {
            this.debug(`Finished initiating all jobs for note ${parentNoteFileId}. Active jobs: ${this.activeJobs.size}. Waiting for results via events.`);
        } else {
            this.debug(`No active jobs for ${parentNoteFileId}.`)
        }
    }

    public addProcessor(processor: IOcrProcessor): void {
        this.processors.push(processor);
        if (typeof (processor as any).setEventEmitter === 'function') {
            (processor as any).setEventEmitter(this.processorEventEmitter);
        }
    }

    public setDebugging(enabled: boolean): void {
        const changed = this.isDebugging !== enabled;
        this.isDebugging = enabled;
        if (changed) {
            this.debug(`Debugging ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    protected debug(...args: any[]): void {
        if (this.isDebugging) {
            console.log(`[OcrProvider]`, ...args)
        }
    }

    private getJobId(fileId: string, processorId: string): string {
        return `${fileId}-${processorId}`;
    }
}