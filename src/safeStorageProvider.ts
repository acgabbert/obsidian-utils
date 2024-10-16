import { Platform } from "obsidian";

export { encryptString, decryptString };

// @ts-ignore
let safeStorage: Electron.SafeStorage | null = null;

if (Platform.isDesktop) {
    // @ts-ignore
    safeStorage = require("electron")?.remote?.safeStorage;
}

function encryptString(val: string): string | null {
    if (Platform.isDesktop && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
            const buff = safeStorage.encryptString(val) as Buffer;
            return buff.toString("base64");
        } catch(err) {
            console.error(`Failed to encrypt passed value. ${err}`);
            return null;
        }
    }
    console.error(`Safe storage provider not available.`);
    return null;
}

function decryptString(val: string): string | null {
    if (Platform.isDesktop && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
            const buff = Buffer.from(val, "base64");
            return safeStorage.decryptString(buff) as string;
        } catch(err) {
            console.error(`Failed to decrypt passed value. ${err}`);
            return null;
        }
    }
    console.error(`Safe storage provider not available.`);
    return null;
}