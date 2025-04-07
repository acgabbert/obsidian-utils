import { Worker } from "tesseract.js";

import { BaseOcrProcessor } from "./baseProcessor";
import { OcrJobData } from "./ocrProvider";


export class TesseractOcrProcessor extends BaseOcrProcessor {
    private worker: Worker;

    constructor(worker: Worker, enableDebug: boolean = false) {
        super('tesseract', 1, enableDebug);
        this.worker = worker;
        this.debug(`[${this.id}] Processor initialized (waiting for emitter).`);
    }

    protected async _performOcr(job: OcrJobData): Promise<string> {
        const { fileId, imageData } = job;
        this.debug(`[${this.id}] Worker starting recognize for ${fileId}`);
        const result = await this.worker.recognize(imageData);
        return result.data.text;
    }

    public async shutdown(): Promise<void> {
        await super.shutdown();
        if (this.worker) {
            this.debug(`[${this.id}] Terminating tesseract worker.`)
            await this.worker.terminate();
        }
    }
}