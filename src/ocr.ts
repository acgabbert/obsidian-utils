import { App, TFile } from "obsidian";
import { createWorker, type Worker } from "tesseract.js";

export { initializeWorker, ocr, ocrMultiple, readImageFile };

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

async function ocrMultiple(app: App, files: TFile[] | string[] | null, worker: Worker | null) {
    if (!worker) {
        worker = await initializeWorker();
    }
    if (!files) {
        console.error('No files passed to OCR function');
        return null;
    }

    const ocrQueue = new OcrQueue(worker);
    const results: Array<string> = [];
    for (let file of files) {
        if (typeof file === "string") {
            const fileObj = app.vault.getFileByPath(file);
            if (fileObj) file = fileObj;
            else {console.error(`couldn't find file ${file}`); continue};
        }
        const arrBuff = await readImageFile(app, file);
        if (!arrBuff) {
            console.error(`failed to convert ${file.path} to buffer for OCR`)
            continue;
        }
        const buffer = Buffer.from(arrBuff);
        const text = await ocrQueue.addToQueue(buffer);
        results.push(text as string);
    }
    return results;
}