import { App, TFile } from "obsidian";
import { createWorker, Worker } from "tesseract.js";

export { initializeWorker, ocr, readImageFile };

async function readImageFile(app: App, file: TFile | null): Promise<ArrayBuffer | null> {
    if (!file) return null;
    return await app.vault.readBinary(file);
}

async function ocr(app: App, file: TFile | null, worker: Worker | null): Promise<string | null> {
    if (!worker) {
        console.error('OCR worker is not initialized')
        return null;
    }

    const arrBuff = await readImageFile(app, file);
    if (!arrBuff) return null;
    const buffer = Buffer.from(arrBuff);
    const ret = await worker.recognize(buffer);
    return ret.data.text;
}

async function initializeWorker(): Promise<Worker> {
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    return worker;
}