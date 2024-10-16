import { Notice, Platform } from "obsidian";

export { encryptString, decryptString };

// @ts-ignore
let safeStorage: Electron.SafeStorage | null = null;

if (Platform.isDesktop) {
    // @ts-ignore
    safeStorage = require("electron")?.remote?.safeStorage;
}

function encryptString(val: string): string {
    if (Platform.isDesktop && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
            const buff = safeStorage.encryptString(val) as Buffer;
            return buff.toString("base64");
        } catch(err) {
            console.error(`Failed to encrypt passed value. ${err}`);
            new Notice("Failed to encrypt input string. Check console for error details.");
            return "";
        }
    }
    console.error(`Safe storage provider not available.`);
    new Notice("Failed to encrypt input string. Check console for error details.");
    return "";
}

function decryptString(val: string): string {
    if (Platform.isDesktop && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
            const buff = Buffer.from(val, "base64");
            return safeStorage.decryptString(buff) as string;
        } catch(err) {
            console.error(`Failed to decrypt passed value. ${err}`);
            new Notice("Failed to decrypt input string. Check console for error details.");
            return "";
        }
    }
    console.error(`Safe storage provider not available.`);
    new Notice("Failed to decrypt input string. Check console for error details.");
    return "";
}