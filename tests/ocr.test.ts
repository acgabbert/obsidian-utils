import fs from 'fs';

import { initializeWorker, ocr } from "../src";
import { App, TFile } from 'obsidian';

describe('OCR functionality', () => {
    let worker: Tesseract.Worker;

    beforeAll(async () => {
        worker = await initializeWorker();
    });

    afterAll(async () => {
        await worker.terminate();
    });
    
    let mockApp: App;
    let mockFile: TFile | null;
    let mockWorker;
    const imagePath = 'tests/assets/ip_tests.png';

    beforeEach(() => {
        mockApp = {
            vault: {
                readBinary: jest.fn().mockReturnValue(() => {
                    let buff = fs.readFileSync(imagePath);
                    const arrBuff = buff.buffer.slice(
                        buff.byteOffset,
                        buff.byteOffset + buff.byteLength
                    );
                    return arrBuff;
                })()
            }
        } as unknown as App;
        mockFile = {
            path: './assets/ip_tests.png'
        } as unknown as TFile;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should correctly recognize text from a sample image', async () => {
        const worker = await initializeWorker();
        await ocr(mockApp, mockFile, worker);
    });
})