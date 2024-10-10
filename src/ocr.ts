import { App, TFile } from "obsidian";
import { createWorker, Worker } from "tesseract.js";

export { initializeWorker, ocr, readImageFile };

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
    console.log(ret.data.text);
    return ret.data.text;
}

async function initializeWorker(): Promise<Worker> {
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    return worker;
}