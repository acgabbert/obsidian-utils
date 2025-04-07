import { App, TFile } from "obsidian";

export { encodeImageFile, readImageFile }

/**
 * Reads the contents of an image file into a Buffer.
 * @param app Obsidian app instance
 * @param file an Obsidian TFile
 * @returns the image in a Buffer format
 */
async function readImageFile(app: App, file: TFile): Promise<Buffer> {
    const arrBuff = await app.vault.readBinary(file);
    const buffer = Buffer.from(arrBuff);
    return buffer;
}

/**
 * base64 encodes an image file
 * @param app Obsidian app instance
 * @param file an Obsidian TFile
 * @returns the base64-encoded image
 */
async function encodeImageFile(app: App, file: TFile): Promise<string> {
    return (await readImageFile(app, file)).toString('base64');
}